const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const supabase = require('../config/supabase');

// Protect all company routes
router.use(authMiddleware);

/**
 * GET /company
 * Returns the Organization row for the currently logged-in user,
 * scoped by organization_id from their JWT token.
 *
 * Schema: id, organization_name, organization_code,
 *         subscription_plan, status, created_at, updated_at
 */
const getCompany = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;

    if (!orgId) {
      return res.status(400).json({ message: 'No organization ID found on user account.' });
    }

    const { data: org, error } = await supabase
      .from('organization')
      .select('id, organization_name, organization_code, subscription_plan, status, created_at, updated_at')
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    if (!org) {
      return res.status(404).json({ message: 'Organization not found.' });
    }

    // Fetch the first user in the org as "created by" (oldest created_at)
    const { data: adminUser } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const createdByName = adminUser
      ? `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() || adminUser.email
      : null;

    return res.status(200).json({
      id:                org.id,
      name:              org.organization_name,
      code:              org.organization_code,
      subscription_plan: org.subscription_plan,
      status:            org.status,
      created_at:        org.created_at,
      updated_at:        org.updated_at,
      created_by_name:   createdByName,
    });
  } catch (err) {
    console.error('GET /company error:', err);
    return res.status(500).json({ message: err.message || 'Failed to fetch company information.' });
  }
};

const auditService = require('../services/auditService');

const updateCompany = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;

    if (!orgId) {
      return res.status(400).json({ message: 'No organization ID found on user account.' });
    }

    const { name, code } = req.body;

    const updatePayload = { updated_at: new Date().toISOString() };
    if (name !== undefined && name.trim()) updatePayload.organization_name = name.trim();
    if (code !== undefined && code.trim()) updatePayload.organization_code = code.trim();

    const { data: updated, error } = await supabase
      .from('organization')
      .update(updatePayload)
      .eq('id', orgId)
      .select('id, organization_name, organization_code, subscription_plan, status, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    auditService.logSetupActivity({
      organization_id: orgId,
      user_id: req.user?.id,
      action: 'UPDATE',
      entity_type: 'organization',
      entity_id: orgId,
      entity_name: updated?.organization_name || name || 'Company Settings',
      module_name: 'Company Info',
    }).catch(err => console.error('❌ Audit log error:', err.message));

    return res.status(200).json({
      id:                updated.id,
      name:              updated.organization_name,
      code:              updated.organization_code,
      subscription_plan: updated.subscription_plan,
      status:            updated.status,
      created_at:        updated.created_at,
      updated_at:        updated.updated_at,
    });
  } catch (err) {
    console.error('PUT /company error:', err);
    return res.status(500).json({ message: err.message || 'Failed to update company information.' });
  }
};

router.get('/company', getCompany);
router.get('/organization', getCompany);
router.get('/organization/details', getCompany);
router.put('/company', updateCompany);
router.put('/organization', updateCompany);

module.exports = router;

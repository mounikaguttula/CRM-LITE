const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * User Service
 * Handles user fetching and invitation business logic.
 */
class UserService {
  async getUsersByOrganization(organizationId) {
    if (!organizationId) {
      const error = new Error('Organization ID is required.');
      error.statusCode = 400;
      throw error;
    }

    const { data: rows, error } = await supabase
      .from('users')
      .select('*, roles(role_name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      const err = new Error(`Failed to fetch users: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    return (rows || []).map((u) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      status: u.status,
      role: u.roles?.role_name || null,
      role_id: u.role_id,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));
  }

  async inviteUser(organizationId, { email, first_name, last_name, password }) {
    if (!organizationId) {
      const error = new Error('Organization ID is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!email || !first_name) {
      const error = new Error('Email and first name are required.');
      error.statusCode = 400;
      throw error;
    }

    let password_hash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      password_hash = await bcrypt.hash(password, salt);
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          id: crypto.randomUUID(),
          organization_id: organizationId,
          first_name,
          last_name: last_name || '',
          email,
          password_hash,
          status: password ? 'active' : 'invited',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('*, roles(role_name)')
      .single();

    if (error) {
      const err = new Error(`Failed to invite user: ${error.message}`);
      err.statusCode = 400;
      throw err;
    }

    return {
      id: newUser.id,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      email: newUser.email,
      status: newUser.status,
      role: newUser.roles?.role_name || null,
      role_id: newUser.role_id,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at,
    };
  }

  async deleteUser(organizationId, userId, currentUserId) {
    if (!organizationId || !userId) {
      const error = new Error('Organization ID and User ID are required.');
      error.statusCode = 400;
      throw error;
    }

    if (currentUserId && userId === currentUserId) {
      const error = new Error('You cannot delete your own logged-in account.');
      error.statusCode = 400;
      throw error;
    }

    // Protect Administrator accounts from deletion
    const { data: targetUser } = await supabase
      .from('users')
      .select('*, roles(role_name)')
      .eq('id', userId)
      .maybeSingle();

    const targetRole = String(targetUser?.roles?.role_name || targetUser?.role || '').toLowerCase();
    if (targetRole.includes('admin')) {
      const error = new Error('Administrator accounts cannot be deleted by anyone.');
      error.statusCode = 403;
      throw error;
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('organization_id', organizationId);

    if (error) {
      const err = new Error(`You cannot delete or edit this user account due to missing permissions or data dependencies.`);
      err.statusCode = 400;
      throw err;
    }

    return { success: true, message: 'User deleted successfully.' };
  }
}

module.exports = new UserService();

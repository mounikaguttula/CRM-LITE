const bcrypt = require('bcryptjs');
const { signToken } = require('../utils/jwt');
const supabase = require('../config/supabase');
const auditService = require('./auditService');

const login = async (email, password) => {
  // Query users table joined with Organization and Roles
  const { data: user, error } = await supabase
    .from('users')
    .select('*, organization(*), roles(*)')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw { statusCode: 401, message: 'Invalid credentials. User not found.' };
  }

  // Compare hashed password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw { statusCode: 401, message: 'Invalid credentials. Password incorrect.' };
  }

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
  const initials = fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const resolvedRole = user.roles?.role_name || (user.role_id ? 'Administrator' : 'User');

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: fullName,
    role: resolvedRole,
    role_id: user.role_id,
    organization_id: user.organization_id,
  };

  const token = signToken(tokenPayload);

  const userProfile = {
    id: user.id,
    name: fullName,
    email: user.email,
    role: resolvedRole,
    role_id: user.role_id,
    organization_id: user.organization_id,
    avatar: initials || 'U',
    organization: user.organization ? {
      id: user.organization.id,
      name: user.organization.organization_name,
      code: user.organization.organization_code,
      plan: user.organization.subscription_plan,
    } : null,
  };

  // Start audit log session for successful login
  try {
    await auditService.startSession({
      organization_id: user.organization_id,
      user_id: user.id,
      user_email: user.email,
      name: fullName,
    });
  } catch (auditErr) {
    console.error('❌ Audit startSession error in login:', auditErr.message);
  }

  return { token, user: userProfile };
};

const registerOrganization = async ({ orgName, companyCode, organizationCode, adminEmail, adminPassword, firstName, lastName }) => {
  // 1. Insert into Organization
  const { data: org, error: orgError } = await supabase
    .from('organization')
    .insert([{
      organization_name: orgName,
      organization_code: organizationCode || companyCode || `CODE_${Date.now()}`,
      subscription_plan: 'enterprise',
      status: 'active',
    }])
    .select()
    .single();

  if (orgError) {
    throw { statusCode: 400, message: `Failed to create organization: ${orgError.message}` };
  }

  // 2. Hash Password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(adminPassword, salt);

  // 3. Create Admin User
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert([{
      organization_id: org.id,
      first_name: firstName || 'Admin',
      last_name: lastName || 'User',
      email: adminEmail,
      password_hash,
      status: 'active',
    }])
    .select()
    .single();

  if (userError) {
    throw { statusCode: 400, message: `Failed to create admin user: ${userError.message}` };
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const token = signToken({
    id: user.id,
    email: user.email,
    name: fullName,
    role: 'Administrator',
    role_id: user.role_id,
    organization_id: org.id,
  });

  // Start audit log session for organization registration login
  try {
    await auditService.startSession({
      organization_id: org.id,
      user_id: user.id,
      user_email: user.email,
      name: fullName,
    });
  } catch (auditErr) {
    console.error('❌ Audit startSession error in registerOrganization:', auditErr.message);
  }

  return {
    organization: org,
    user: {
      id: user.id,
      name: fullName,
      email: user.email,
      role: 'Administrator',
      organization_id: org.id,
    },
    token,
  };
};

const getUserProfile = async (userId) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('*, organization(*), roles(*)')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw { statusCode: 404, message: 'User profile not found.' };
  }

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
  const initials = fullName.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const roleName = user.roles?.role_name || (user.role_id ? 'Administrator' : 'User');

  return {
    id: user.id,
    name: fullName,
    email: user.email,
    role: roleName,
    role_id: user.role_id,
    status: user.status || 'active',
    organization_id: user.organization_id,
    avatar: initials || 'U',
    organization: user.organization ? {
      id: user.organization.id,
      name: user.organization.organization_name,
      code: user.organization.organization_code,
      plan: user.organization.subscription_plan,
    } : null,
  };
};

module.exports = {
  login,
  registerOrganization,
  getUserProfile,
};

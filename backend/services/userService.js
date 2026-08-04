const supabase = require('../config/supabase');

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

  async inviteUser(organizationId, { email, first_name, last_name }) {
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

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          organization_id: organizationId,
          first_name,
          last_name: last_name || '',
          email,
          status: 'invited',
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
}

module.exports = new UserService();

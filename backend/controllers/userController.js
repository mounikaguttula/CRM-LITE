const userService = require('../services/userService');


/**
 * User Controller
 * Handles user management HTTP requests.
 */
const getUsers = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const users = await userService.getUsersByOrganization(organizationId);
    return res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};


const inviteUser = async (req, res, next) => {
  try {
    const organizationId = req.user?.organization_id;
    const { email, first_name, last_name, password } = req.body;
    const newUser = await userService.inviteUser(organizationId, { email, first_name, last_name, password });
    return res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
};


module.exports = {
  getUsers,
  inviteUser,
};




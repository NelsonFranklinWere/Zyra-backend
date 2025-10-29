const { db } = require('../config/database');
const logger = require('../utils/logger');

const userController = {
  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = db('users')
        .select('id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'is_verified', 'created_at')
        .orderBy('created_at', 'desc');

      // Apply filters
      if (search) {
        query = query.where(function() {
          this.where('email', 'ilike', `%${search}%`)
            .orWhere('first_name', 'ilike', `%${search}%`)
            .orWhere('last_name', 'ilike', `%${search}%`);
        });
      }

      if (role) {
        query = query.where('role', role);
      }

      if (status === 'active') {
        query = query.where('is_active', true);
      } else if (status === 'inactive') {
        query = query.where('is_active', false);
      }

      const users = await query.limit(limit).offset(offset);
      const total = await query.clone().count('* as count').first();

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total.count),
            pages: Math.ceil(total.count / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting all users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get users'
      });
    }
  },

  // Get user by ID
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.userId;

      // Users can only view their own profile unless they're admin
      if (id !== requestingUserId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const user = await db('users')
        .select('id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'is_verified', 'preferences', 'created_at', 'updated_at')
        .where({ id })
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user'
      });
    }
  },

  // Update user
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.userId;
      const { first_name, last_name, preferences } = req.body;

      // Users can only update their own profile unless they're admin
      if (id !== requestingUserId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updateData = {};
      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;
      if (preferences) updateData.preferences = preferences;
      updateData.updated_at = new Date();

      const updatedUser = await db('users')
        .where({ id })
        .update(updateData)
        .returning(['id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'is_verified', 'preferences', 'updated_at']);

      if (updatedUser.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: updatedUser[0],
        message: 'User updated successfully'
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  },

  // Delete user (admin only)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (id === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      const deletedUser = await db('users')
        .where({ id })
        .del()
        .returning(['id', 'email', 'first_name', 'last_name']);

      if (deletedUser.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: deletedUser[0],
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  },

  // Activate user (admin only)
  async activateUser(req, res) {
    try {
      const { id } = req.params;

      const updatedUser = await db('users')
        .where({ id })
        .update({ is_active: true, updated_at: new Date() })
        .returning(['id', 'email', 'first_name', 'last_name', 'is_active']);

      if (updatedUser.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: updatedUser[0],
        message: 'User activated successfully'
      });
    } catch (error) {
      logger.error('Error activating user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to activate user'
      });
    }
  },

  // Deactivate user (admin only)
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent admin from deactivating themselves
      if (id === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }

      const updatedUser = await db('users')
        .where({ id })
        .update({ is_active: false, updated_at: new Date() })
        .returning(['id', 'email', 'first_name', 'last_name', 'is_active']);

      if (updatedUser.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: updatedUser[0],
        message: 'User deactivated successfully'
      });
    } catch (error) {
      logger.error('Error deactivating user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user'
      });
    }
  },

  // Get user statistics
  async getUserStats(req, res) {
    try {
      const totalUsers = await db('users').count('* as count').first();
      const activeUsers = await db('users').where('is_active', true).count('* as count').first();
      const verifiedUsers = await db('users').where('is_verified', true).count('* as count').first();
      
      // Get users by role
      const usersByRole = await db('users')
        .select('role')
        .count('* as count')
        .groupBy('role');

      // Get recent registrations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentRegistrations = await db('users')
        .where('created_at', '>=', thirtyDaysAgo)
        .count('* as count')
        .first();

      res.json({
        success: true,
        data: {
          total: parseInt(totalUsers.count),
          active: parseInt(activeUsers.count),
          verified: parseInt(verifiedUsers.count),
          recent: parseInt(recentRegistrations.count),
          byRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = parseInt(item.count);
            return acc;
          }, {})
        }
      });
    } catch (error) {
      logger.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user statistics'
      });
    }
  }
};

module.exports = userController;

const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// User management routes
router.get('/', requireAdmin, userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', requireAdmin, userController.deleteUser);
router.put('/:id/activate', requireAdmin, userController.activateUser);
router.put('/:id/deactivate', requireAdmin, userController.deactivateUser);

// User statistics
router.get('/stats/overview', userController.getUserStats);

module.exports = router;


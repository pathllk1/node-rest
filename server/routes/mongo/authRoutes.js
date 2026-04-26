import express from 'express';
import { login, logout, getCurrentUser, refreshToken, register } from '../../controllers/mongo/authController.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';
import { loginRateLimit } from '../../middleware/mongo/rateLimitMiddleware.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/login', loginRateLimit, login);
router.post('/register', loginRateLimit, register);

// Protected routes
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);
router.post('/refresh', authMiddleware, refreshToken);

export default router;

import express from 'express';
import { 
  getPublicData, 
  getProtectedData, 
  getDashboardData,
  getProfileData
} from '../../controllers/pageController.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/public', getPublicData);

// Protected routes
router.get('/protected', authMiddleware, getProtectedData);
router.get('/dashboard', authMiddleware, getDashboardData);
router.get('/profile', authMiddleware, getProfileData);

export default router;

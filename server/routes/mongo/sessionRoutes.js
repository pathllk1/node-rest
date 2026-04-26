/**
 * Session Management Routes
 * Multi-device session and login history management
 */

import express from 'express';
import {
  getSessions,
  revokeSession,
  revokeOtherSessions,
  markDeviceTrusted,
  getLoginHistoryEndpoint,
  getSuspiciousActivityEndpoint,
  logoutAllDevices,
} from '../../controllers/mongo/sessionController.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Session management
router.get('/sessions', getSessions);
router.delete('/sessions/:device_id', revokeSession);
router.post('/sessions/revoke-others', revokeOtherSessions);
router.post('/sessions/:device_id/trust', markDeviceTrusted);

// Login audit & security
router.get('/login-history', getLoginHistoryEndpoint);
router.get('/suspicious-activity', getSuspiciousActivityEndpoint);

// Logout all devices
router.post('/logout-all-devices', logoutAllDevices);

export default router;

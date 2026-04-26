import express from 'express';
import * as settingsController from '../../controllers/mongo/settingsController.js';
import * as systemConfigController from '../../controllers/mongo/systemConfigController.js';

const router = express.Router();

// System config endpoints (must come BEFORE /:key routes to avoid conflicts)
router.get('/system-config/gst-status', systemConfigController.getGstStatus);
router.put('/system-config/gst-status', systemConfigController.toggleGstStatus);
router.get('/system-config/all', systemConfigController.getAllSettings);
router.get('/system-config/:key', systemConfigController.getSetting);
router.put('/system-config/:key', systemConfigController.updateSetting);

// Settings endpoints
router.get('/', settingsController.getAllSettings);
router.post('/', settingsController.createSetting);
router.get('/:key', settingsController.getSetting);
router.put('/:key', settingsController.updateSetting);

export default router;

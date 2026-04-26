import express from 'express';
import {
  createMasterRoll,
  getAllMasterRolls,
  getMasterRollById,
  updateMasterRoll,
  deleteMasterRoll,
  searchMasterRolls,
  getMasterRollStats,
  getActivityLog,
  bulkImportMasterRolls,
  exportMasterRolls,
  bulkCreateMasterRoll,
  bulkDeleteMasterRolls,
  lookupIFSC,
  generateAppointmentLetter
} from '../../controllers/mongo/masterRoll.controller.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// All routes require authentication (applied at app level)
// Additional role-based restrictions applied per route

// Bulk Operations (must come BEFORE /:id routes)
router.post('/bulk-import', bulkImportMasterRolls);
router.post("/bulk", bulkCreateMasterRoll);                   // Bulk create (manager/admin only)
router.delete('/bulk-delete', bulkDeleteMasterRolls);         // Bulk delete (manager/admin only)

// Specific routes (must come BEFORE /:id routes)
router.get('/stats', getMasterRollStats);                     // Get statistics
router.get('/search', searchMasterRolls);                     // Search
router.get('/export', exportMasterRolls);                     // Export
router.get('/lookup-ifsc/:ifsc', lookupIFSC);                 // IFSC lookup using Razorpay API

// CRUD Operations
router.post('/', createMasterRoll);                           // Create (all authenticated users)
router.get('/', getAllMasterRolls);                           // Read all (firm-specific)
router.get('/:id/activity', getActivityLog);                  // Get activity log (must come BEFORE /:id)
router.post('/:id/appointment-letter', generateAppointmentLetter);  // Generate appointment letter
router.get('/:id', getMasterRollById);                        // Read one (firm-specific)
router.put('/:id', updateMasterRoll);                         // Update (firm-specific)
router.delete('/:id', deleteMasterRoll);                      // Delete (manager/admin only)

export default router;
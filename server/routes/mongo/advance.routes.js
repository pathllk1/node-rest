import express from 'express';
import {
  getEmployeeAdvanceBalance,
  getEmployeeAdvanceHistory,
  getAllEmployeeBalances,
  recordAdvance,
  deleteAdvanceRecord
} from '../../controllers/mongo/advance.controller.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/advances/balance/:masterRollId
router.get('/balance/:masterRollId', getEmployeeAdvanceBalance);

// GET /api/advances/bulk-balances
router.get('/bulk-balances', getAllEmployeeBalances);

// GET /api/advances/history/:masterRollId
router.get('/history/:masterRollId', getEmployeeAdvanceHistory);

// POST /api/advances/record
router.post('/record', recordAdvance);

// DELETE /api/advances/:id
router.delete('/:id', deleteAdvanceRecord);

export default router;

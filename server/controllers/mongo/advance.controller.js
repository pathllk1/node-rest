import { Advance, MasterRoll } from '../../models/index.js';
import mongoose from 'mongoose';

/**
 * Get active advance balance for an employee
 */
export async function getEmployeeAdvanceBalance(req, res) {
  try {
    const { masterRollId } = req.params;
    const firmId = req.user.firm_id;

    const pipeline = [
      { $match: { master_roll_id: new mongoose.Types.ObjectId(masterRollId), firm_id: new mongoose.Types.ObjectId(firmId) } },
      {
        $group: {
          _id: null,
          totalAdvance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', 0] }
          },
          totalRepayment: {
            $sum: { $cond: [{ $eq: ['$type', 'REPAYMENT'] }, '$amount', 0] }
          }
        }
      }
    ];

    const result = await Advance.aggregate(pipeline);
    
    if (result.length === 0) {
      return res.json({ success: true, balance: 0 });
    }

    const balance = result[0].totalAdvance - result[0].totalRepayment;
    res.json({ success: true, balance });
  } catch (error) {
    console.error('Error fetching advance balance:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Get advance history for an employee
 */
export async function getEmployeeAdvanceHistory(req, res) {
  try {
    const { masterRollId } = req.params;
    const firmId = req.user.firm_id;

    const history = await Advance.find({ 
      master_roll_id: masterRollId, 
      firm_id: firmId 
    })
    .sort({ date: -1, createdAt: -1 })
    .lean();

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching advance history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Get all employee balances for a firm (Bulk)
 */
export async function getAllEmployeeBalances(req, res) {
  try {
    const firmId = req.user.firm_id;

    const pipeline = [
      { $match: { firm_id: new mongoose.Types.ObjectId(firmId) } },
      {
        $group: {
          _id: '$master_roll_id',
          totalAdvance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', 0] }
          },
          totalRepayment: {
            $sum: { $cond: [{ $eq: ['$type', 'REPAYMENT'] }, '$amount', 0] }
          }
        }
      },
      {
        $project: {
          masterRollId: '$_id',
          balance: { $subtract: ['$totalAdvance', '$totalRepayment'] }
        }
      }
    ];

    const results = await Advance.aggregate(pipeline);
    const balanceMap = {};
    results.forEach(r => {
      balanceMap[r.masterRollId] = r.balance;
    });

    res.json({ success: true, balances: balanceMap });
  } catch (error) {
    console.error('Error fetching bulk balances:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Record a new advance (Disbursement)
 */
export async function recordAdvance(req, res) {
  try {
    const { masterRollId, amount, date, paymentMode, remarks, bankDetails } = req.body;
    const firmId = req.user.firm_id;
    const userId = req.user.id;

    if (!masterRollId || !amount || !date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const doc = await Advance.create({
      firm_id: firmId,
      master_roll_id: masterRollId,
      type: 'ADVANCE',
      amount: parseFloat(amount),
      date,
      payment_mode: paymentMode || 'CASH',
      bank_account_details: bankDetails,
      remarks,
      created_by: userId,
      updated_by: userId
    });

    res.status(201).json({ success: true, message: 'Advance recorded successfully', data: doc });
  } catch (error) {
    console.error('Error recording advance:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Delete an advance record
 */
export async function deleteAdvanceRecord(req, res) {
  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;

    const record = await Advance.findOne({ _id: id, firm_id: firmId });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    if (record.payment_mode === 'WAGE_DEDUCTION' && record.wage_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete a wage deduction repayment from here. Edit the wage record instead.' 
      });
    }

    await Advance.deleteOne({ _id: id });
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting advance record:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

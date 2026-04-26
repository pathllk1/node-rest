/**
 * Wages Controller — Mongoose version
 *
 * Key changes from the SQLite version:
 *  - All db.prepare().run/get/all replaced with Mongoose model queries
 *  - db.transaction() for bulk ops replaced with individual awaited calls
 *    (same partial-success behaviour as the original)
 *  - Wage.getLastWageForEmployee replaced with Wage.findOne sort query
 *  - Wage.getByFirmAndMonth replaced with Wage.find filter
 *  - Date comparisons for eligibility work on strings (YYYY-MM-DD) — same logic as original
 *  - IDs are MongoDB ObjectIds instead of integers
 */

import { Wage, MasterRoll, Advance } from '../../models/index.js';

/* ── HELPER FUNCTIONS ────────────────────────────────────────────────────── */

function getMonthEndDate(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const nextMonth = parseInt(month) === 12 ? '01' : String(parseInt(month) + 1).padStart(2, '0');
  const nextYear  = parseInt(month) === 12 ? parseInt(year) + 1 : year;
  const lastDay   = new Date(nextYear, parseInt(nextMonth) - 1, 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

function getMonthStartDate(yearMonth) {
  return `${yearMonth}-01`;
}

function isEmployeeEligible(employee, yearMonth) {
  const monthStart = getMonthStartDate(yearMonth);
  const monthEnd   = getMonthEndDate(yearMonth);

  if (employee.date_of_joining > monthEnd) return false;
  if (employee.date_of_exit && employee.date_of_exit < monthStart) return false;

  return true;
}

function calculateNetSalary(gross, epf, esic, otherDeduction, otherBenefit, advanceDeduction = 0) {
  return gross - ((epf ?? 0) + (esic ?? 0) + (otherDeduction ?? 0) + (advanceDeduction ?? 0)) + (otherBenefit ?? 0);
}

function calculatePerDayWage(gross, wageDays) {
  return wageDays > 0 ? parseFloat((gross / wageDays).toFixed(2)) : 0;
}

const MONTH_REGEX = /^\d{4}-\d{2}$/;

/* ── GET EMPLOYEES FOR WAGES ─────────────────────────────────────────────── */

export async function getEmployeesForWages(req, res) {
  try {
    const { month }  = req.body;
    const firmId     = req.user.firm_id;

    if (!month)                    return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    if (!MONTH_REGEX.test(month))  return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });

    // All active employees for this firm
    const employees = await MasterRoll.find({ firm_id: firmId, status: 'Active' })
      .select('employee_name aadhar bank account_no p_day_wage project site date_of_joining date_of_exit')
      .sort({ employee_name: 1 })
      .lean();

    // Employees who already have wages this month
    const paidDocs = await Wage.find({ firm_id: firmId, salary_month: month })
      .select('master_roll_id')
      .lean();

    const paidSet = new Set(paidDocs.map(d => String(d.master_roll_id)));

    const eligibleEmployees = await Promise.all(
      employees
        .filter(emp => isEmployeeEligible(emp, month) && !paidSet.has(String(emp._id)))
        .map(async emp => {
          const lastWage = await Wage.findOne({ master_roll_id: emp._id, firm_id: firmId })
            .sort({ salary_month: -1 })
            .lean();

          return {
            master_roll_id:   emp._id,
            employee_name:    emp.employee_name,
            aadhar:           emp.aadhar,
            bank:             emp.bank,
            account_no:       emp.account_no,
            p_day_wage:       emp.p_day_wage         ?? 0,
            project:          emp.project            ?? '',
            site:             emp.site               ?? '',
            last_wage_days:   lastWage?.wage_days     ?? 26,
            last_gross_salary: lastWage?.gross_salary ?? (emp.p_day_wage ?? 0) * 26,
            date_of_joining:  emp.date_of_joining,
            date_of_exit:     emp.date_of_exit,
          };
        })
    );

    res.json({
      success: true,
      data:    eligibleEmployees,
      meta: {
        total:        eligibleEmployees.length,
        total_active: employees.length,
        already_paid: paidDocs.length,
        month,
        firmId,
      },
    });
  } catch (error) {
    console.error('Error fetching employees for wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET EXISTING WAGES FOR MONTH ────────────────────────────────────────── */

export async function getExistingWagesForMonth(req, res) {
  try {
    const { month } = req.query;
    const firmId    = req.user.firm_id;

    if (!month)                   return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });
    if (!MONTH_REGEX.test(month)) return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });

    // Get wages first
    const rawWages = await Wage.find({ firm_id: firmId, salary_month: month })
      .populate('created_by', 'fullname')
      .populate('updated_by', 'fullname')
      .lean();

    // Get all unique master_roll_ids
    const masterRollIds = [...new Set(rawWages.map(w => w.master_roll_id).filter(id => id))];

    // Fetch master roll data
    const masterRolls = await MasterRoll.find({ _id: { $in: masterRollIds } })
      .select('employee_name aadhar bank account_no project site')
      .lean();

    // Create lookup map
    const masterRollMap = new Map();
    masterRolls.forEach(mr => {
      masterRollMap.set(mr._id.toString(), mr);
    });

    // Merge data — also expose _id as a plain string `id` so the frontend
    // can use wage.id consistently (lean() returns _id as ObjectId, not id).
    const wages = rawWages.map(wage => {
      const masterRoll = masterRollMap.get(wage.master_roll_id?.toString());
      if (masterRoll) {
        wage.master_roll_id = {
          ...masterRoll,
          _id: masterRoll._id,
        };
      }
      return {
        ...wage,
        id: wage._id.toString(), // normalize: frontend uses wage.id everywhere
      };
    });

    // Sort by employee name
    wages.sort((a, b) => {
      const aName = a.master_roll_id?.employee_name || '';
      const bName = b.master_roll_id?.employee_name || '';
      return aName.localeCompare(bName);
    });

    res.json({ success: true, data: wages, meta: { total: wages.length, month, firmId } });
  } catch (error) {
    console.error('Error fetching existing wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── CREATE WAGES (BULK) ─────────────────────────────────────────────────── */

export async function createWagesBulk(req, res) {
  try {
    const { month, wages } = req.body;
    const userId  = req.user.id;
    const firmId  = req.user.firm_id;

    if (!month || !Array.isArray(wages) || wages.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid wage data. Provide month and wages array.' });
    }
    if (!MONTH_REGEX.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM' });
    }

    const results = [];

    for (const wage of wages) {
      try {
        if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
          results.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Missing required fields' });
          continue;
        }

        // Check for duplicate
        const existing = await Wage.findOne({ firm_id: firmId, master_roll_id: wage.master_roll_id, salary_month: month }).lean();
        if (existing) {
          results.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Wage already exists for this employee in this month' });
          continue;
        }

        // Verify employee belongs to firm
        const employee = await MasterRoll.findOne({ _id: wage.master_roll_id, firm_id: firmId })
          .select('project site')
          .lean();

        if (!employee) {
          results.push({ master_roll_id: wage.master_roll_id, success: false, message: 'Employee not found' });
          continue;
        }

        const doc = await Wage.create({
          firm_id:          firmId,
          master_roll_id:   wage.master_roll_id,
          p_day_wage:       calculatePerDayWage(wage.gross_salary, wage.wage_days),
          wage_days:        wage.wage_days,
          project:          employee.project           ?? null,
          site:             employee.site              ?? null,
          gross_salary:     wage.gross_salary,
          epf_deduction:    wage.epf_deduction         ?? 0,
          esic_deduction:   wage.esic_deduction        ?? 0,
          other_deduction:  wage.other_deduction       ?? 0,
          other_benefit:    wage.other_benefit         ?? 0,
          advance_deduction: wage.advance_deduction     ?? 0,
          net_salary:       calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction),
          salary_month:     month,
          paid_date:        wage.paid_date             ?? null,
          cheque_no:        wage.cheque_no             ?? null,
          paid_from_bank_ac: wage.paid_from_bank_ac    ?? null,
          created_by:       userId,
          updated_by:       userId,
        });

        // If there's an advance deduction, record it in the Advance model
        if (wage.advance_deduction > 0) {
          await Advance.create({
            firm_id: firmId,
            master_roll_id: wage.master_roll_id,
            type: 'REPAYMENT',
            amount: wage.advance_deduction,
            date: wage.paid_date || new Date().toISOString().split('T')[0],
            payment_mode: 'WAGE_DEDUCTION',
            wage_id: doc._id,
            remarks: `Repayment from wages - ${month}`,
            created_by: userId,
            updated_by: userId
          });
        }

        results.push({ master_roll_id: wage.master_roll_id, wage_id: doc._id, success: true });
      } catch (error) {
        results.push({ master_roll_id: wage.master_roll_id, success: false, message: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      message: `Wages created successfully. Success: ${successCount}, Failed: ${failureCount}`,
      results,
      meta:    { total: wages.length, success: successCount, failed: failureCount, month },
    });
  } catch (error) {
    console.error('Error creating wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── UPDATE SINGLE WAGE ──────────────────────────────────────────────────── */

export async function updateWage(req, res) {
  try {
    const { id }     = req.params;
    const userId     = req.user.id;
    const firmId     = req.user.firm_id;

    const { wage_days, gross_salary, epf_deduction, esic_deduction,
            other_deduction, other_benefit, advance_deduction, paid_date, cheque_no, paid_from_bank_ac } = req.body;

    if (!wage_days || gross_salary === undefined) {
      return res.status(400).json({ success: false, message: 'wage_days and gross_salary are required' });
    }

    const existingWage = await Wage.findOne({ _id: id, firm_id: firmId });
    if (!existingWage) {
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    existingWage.p_day_wage       = calculatePerDayWage(gross_salary, wage_days);
    existingWage.wage_days        = wage_days;
    existingWage.gross_salary     = gross_salary;
    existingWage.epf_deduction    = epf_deduction    ?? 0;
    existingWage.esic_deduction   = esic_deduction   ?? 0;
    existingWage.other_deduction  = other_deduction  ?? 0;
    existingWage.other_benefit    = other_benefit    ?? 0;
    existingWage.advance_deduction = advance_deduction ?? 0;
    existingWage.net_salary       = calculateNetSalary(gross_salary, epf_deduction, esic_deduction, other_deduction, other_benefit, existingWage.advance_deduction);
    existingWage.paid_date        = paid_date        ?? null;
    existingWage.cheque_no        = cheque_no        ?? null;
    existingWage.paid_from_bank_ac = paid_from_bank_ac ?? null;
    existingWage.updated_by       = userId;

    await existingWage.save();

    // Sync Advance model repayment
    if (existingWage.advance_deduction > 0) {
      await Advance.findOneAndUpdate(
        { wage_id: existingWage._id, type: 'REPAYMENT' },
        {
          firm_id: firmId,
          master_roll_id: existingWage.master_roll_id,
          type: 'REPAYMENT',
          amount: existingWage.advance_deduction,
          date: existingWage.paid_date || new Date().toISOString().split('T')[0],
          payment_mode: 'WAGE_DEDUCTION',
          wage_id: existingWage._id,
          remarks: `Repayment from wages - ${existingWage.salary_month}`,
          updated_by: userId,
          $setOnInsert: { created_by: userId }
        },
        { upsert: true }
      );
    } else {
      await Advance.deleteOne({ wage_id: existingWage._id, type: 'REPAYMENT' });
    }

    res.json({ success: true, message: 'Wage updated successfully', data: existingWage });
  } catch (error) {
    console.error('Error updating wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── BULK UPDATE WAGES ───────────────────────────────────────────────────── */

export async function updateWagesBulk(req, res) {
  try {
    const { wages } = req.body;
    const userId    = req.user.id;
    const firmId    = req.user.firm_id;

    if (!Array.isArray(wages) || wages.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid wage data. Provide wages array.' });
    }

    const results = [];

    for (const wage of wages) {
      try {
        if (!wage.id || !wage.wage_days || wage.gross_salary === undefined) {
          results.push({ id: wage.id, success: false, message: 'Missing required fields: id, wage_days, gross_salary' });
          continue;
        }

        const doc = await Wage.findOne({ _id: wage.id, firm_id: firmId });
        if (!doc) {
          results.push({ id: wage.id, success: false, message: 'Wage record not found or access denied' });
          continue;
        }

        doc.p_day_wage        = calculatePerDayWage(wage.gross_salary, wage.wage_days);
        doc.wage_days         = wage.wage_days;
        doc.gross_salary      = wage.gross_salary;
        doc.epf_deduction     = wage.epf_deduction    ?? 0;
        doc.esic_deduction    = wage.esic_deduction   ?? 0;
        doc.other_deduction   = wage.other_deduction  ?? 0;
        doc.other_benefit     = wage.other_benefit    ?? 0;
        doc.advance_deduction = wage.advance_deduction ?? 0;
        doc.net_salary        = calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction);
        doc.paid_date         = wage.paid_date        ?? null;
        doc.cheque_no         = wage.cheque_no        ?? null;
        doc.paid_from_bank_ac = wage.paid_from_bank_ac ?? null;
        doc.updated_by        = userId;

        await doc.save();

        // Sync Advance model repayment
        if (doc.advance_deduction > 0) {
          // Update or create repayment record
          await Advance.findOneAndUpdate(
            { wage_id: doc._id, type: 'REPAYMENT' },
            {
              firm_id: firmId,
              master_roll_id: doc.master_roll_id,
              type: 'REPAYMENT',
              amount: doc.advance_deduction,
              date: doc.paid_date || new Date().toISOString().split('T')[0],
              payment_mode: 'WAGE_DEDUCTION',
              wage_id: doc._id,
              remarks: `Repayment from wages - ${doc.salary_month}`,
              updated_by: userId,
              $setOnInsert: { created_by: userId }
            },
            { upsert: true }
          );
        } else {
          // If deduction is now 0, remove any existing repayment record linked to this wage
          await Advance.deleteOne({ wage_id: doc._id, type: 'REPAYMENT' });
        }

        results.push({ id: wage.id, success: true, message: 'Updated' });
      } catch (error) {
        results.push({ id: wage.id, success: false, message: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Wages updated successfully. Success: ${successCount}, Failed: ${results.length - successCount}`,
      results,
      meta:    { total: wages.length, success: successCount, failed: results.length - successCount },
    });
  } catch (error) {
    console.error('Error bulk updating wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── DELETE SINGLE WAGE ──────────────────────────────────────────────────── */

export async function deleteWage(req, res) {
  try {
    const { id } = req.params;
    const firmId = req.user.firm_id;

    const deleted = await Wage.findOneAndDelete({ _id: id, firm_id: firmId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    }

    // Also delete any repayment linked to this wage
    await Advance.deleteMany({ wage_id: id });

    res.json({ success: true, message: 'Wage deleted successfully', deletedId: id });
  } catch (error) {
    console.error('Error deleting wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── BULK DELETE WAGES ───────────────────────────────────────────────────── */

export async function deleteWagesBulk(req, res) {
  try {
    const { ids } = req.body;
    const firmId  = req.user.firm_id;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid data. Provide ids array.' });
    }

    const results = [];

    for (const id of ids) {
      try {
        const deleted = await Wage.findOneAndDelete({ _id: id, firm_id: firmId });
        if (deleted) {
          // Also delete any repayment linked to this wage
          await Advance.deleteMany({ wage_id: id });
          results.push({ id, success: true,  message: 'Deleted' });
        } else {
          results.push({ id, success: false, message: 'Wage record not found or access denied' });
        }
      } catch (error) {
        results.push({ id, success: false, message: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      message: `Wages deleted successfully. Success: ${successCount}, Failed: ${results.length - successCount}`,
      results,
      meta:    { total: ids.length, success: successCount, failed: results.length - successCount },
    });
  } catch (error) {
    console.error('Error bulk deleting wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGE BY ID ──────────────────────────────────────────────────────── */

export async function getWageById(req, res) {
  try {
    const wage = await Wage.findOne({ _id: req.params.id, firm_id: req.user.firm_id }).lean();
    if (!wage) return res.status(404).json({ success: false, message: 'Wage record not found or access denied' });
    res.json({ success: true, data: wage });
  } catch (error) {
    console.error('Error fetching wage:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGES HISTORY FOR EMPLOYEE ───────────────────────────────────────── */

export async function getWagesHistoryForEmployee(req, res) {
  try {
    const { masterRollId } = req.params;
    const firmId = req.user.firm_id;

    if (!masterRollId) {
      return res.status(400).json({ success: false, message: 'Master roll ID is required' });
    }

    // Verify the employee belongs to the user's firm
    const employee = await MasterRoll.findOne({ _id: masterRollId, firm_id: firmId })
      .select('employee_name')
      .lean();

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found or access denied' });
    }

    // Get all wages for this employee, sorted by month descending
    const wages = await Wage.find({ master_roll_id: masterRollId, firm_id: firmId })
      .select('salary_month wage_days gross_salary net_salary epf_deduction esic_deduction other_deduction other_benefit paid_date')
      .sort({ salary_month: -1 })
      .lean();

    // Format the data for frontend
    const history = wages.map(wage => ({
      id: wage._id.toString(),
      month: wage.salary_month,
      wage_days: wage.wage_days,
      gross_salary: wage.gross_salary,
      net_salary: wage.net_salary,
      epf_deduction: wage.epf_deduction,
      esic_deduction: wage.esic_deduction,
      other_deduction: wage.other_deduction,
      other_benefit: wage.other_benefit,
      paid_date: wage.paid_date
    }));

    res.json({
      success: true,
      data: {
        employee: {
          id: masterRollId,
          name: employee.employee_name
        },
        history: history,
        totalRecords: history.length
      }
    });
  } catch (error) {
    console.error('Error fetching wages history:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}

/* ── GET WAGES FOR MONTH (deprecated — use getExistingWagesForMonth) ─────── */

export async function getWagesForMonth(req, res) {
  try {
    const { month } = req.query;
    const firmId    = req.user.firm_id;

    if (!month) return res.status(400).json({ success: false, message: 'Month required (format: YYYY-MM)' });

    const wages = await Wage.find({ firm_id: firmId, salary_month: month })
      .populate('master_roll_id', 'employee_name aadhar bank account_no project site')
      .populate('created_by',     'fullname')
      .populate('updated_by',     'fullname');

    // Sort by employee name after population
    wages.sort((a, b) =>
      (a.master_roll_id?.employee_name ?? '').localeCompare(b.master_roll_id?.employee_name ?? '')
    );

    res.json({ success: true, data: wages, meta: { total: wages.length, month } });
  } catch (error) {
    console.error('Error fetching wages:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
}
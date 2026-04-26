import { MasterRoll } from '../../models/index.js';

/* ── REQUIRED FIELDS ────────────────────────────────────────────────────── */

const REQUIRED_FIELDS = [
  'employee_name', 'father_husband_name', 'date_of_birth',
  'aadhar', 'phone_no', 'address', 'bank', 'account_no',
  'ifsc', 'date_of_joining',
];

/* ── CREATE ─────────────────────────────────────────────────────────────── */

export const createMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id, fullname, username } = req.user;

    for (const field of REQUIRED_FIELDS) {
      if (!req.body[field]) {
        return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
      }
    }

    const doc = await MasterRoll.create({
      firm_id,
      ...req.body,
      status:     req.body.status ?? 'Active',
      created_by: user_id,
      updated_by: user_id,
    });

    res.status(201).json({
      success:    true,
      id:         doc._id,
      message:    'Employee added to master roll',
      created_by: { id: user_id, name: fullname, username },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Employee with this Aadhar already exists in your firm' });
    }
    res.status(400).json({ success: false, error: err.message });
  }
};

/* ── READ ALL ────────────────────────────────────────────────────────────── */

export const getAllMasterRolls = async (req, res) => {
  try {
    const { firm_id, role } = req.user;
    const { activeOnly, all_firms } = req.query;

    const filter = (role === 'admin' && all_firms === 'true') ? {} : { firm_id };

    if (activeOnly === 'true') {
      filter.status = 'Active';
    }

    const rows = await MasterRoll.find(filter)
      .populate('firm_id',    'name code')
      .populate('created_by', 'fullname username')
      .populate('updated_by', 'fullname username')
      .sort({ createdAt: -1 })
      .lean();

    // Transform _id to id for frontend compatibility
    const transformedRows = rows.map(row => ({
      ...row,
      id: row._id.toString(),
      _id: row._id.toString()  // Keep _id for MongoDB operations
    }));

    res.json({ success: true, count: transformedRows.length, data: transformedRows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── READ ONE ────────────────────────────────────────────────────────────── */

export const getMasterRollById = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const row = await MasterRoll.findOne({ _id: req.params.id, firm_id })
      .populate('firm_id',    'name code')
      .populate('created_by', 'fullname username')
      .populate('updated_by', 'fullname username')
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    // Transform _id to id for frontend compatibility
    const transformedRow = {
      ...row,
      id: row._id.toString(),
      _id: row._id.toString()
    };

    res.json({ success: true, data: transformedRow });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── UPDATE ─────────────────────────────────────────────────────────────── */

export const updateMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id, role } = req.user;
    const { id } = req.params;

    const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
    const existing = await MasterRoll.findOne(filter);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    // Apply partial update — only overwrite fields present in the request body
    const UPDATABLE = [
      'employee_name', 'father_husband_name', 'date_of_birth', 'aadhar', 'pan',
      'phone_no', 'address', 'bank', 'account_no', 'ifsc', 'branch', 'uan',
      'esic_no', 's_kalyan_no', 'category', 'p_day_wage', 'project', 'site',
      'date_of_joining', 'date_of_exit', 'doe_rem', 'status',
    ];

    for (const field of UPDATABLE) {
      if (req.body[field] !== undefined) existing[field] = req.body[field];
    }
    existing.updated_by = user_id;

    await existing.save();

    console.log(`[UPDATE] Employee ${id} updated successfully`);
    res.json({ success: true, message: 'Employee updated successfully', updated_by: user_id });
  } catch (err) {
    console.error('[UPDATE] Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
};

/* ── DELETE ─────────────────────────────────────────────────────────────── */

export const deleteMasterRoll = async (req, res) => {
  try {
    const { firm_id, role } = req.user;
    const { id } = req.params;

    const filter = role === 'super_admin' ? { _id: id } : { _id: id, firm_id };
    const deleted = await MasterRoll.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── SEARCH ─────────────────────────────────────────────────────────────── */

export const searchMasterRolls = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const regex = new RegExp(q, 'i');

    const rows = await MasterRoll.find({
      firm_id,
      $or: [
        { employee_name: regex },
        { aadhar:        regex },
        { phone_no:      regex },
        { project:       regex },
        { site:          regex },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── STATISTICS ─────────────────────────────────────────────────────────── */

export const getMasterRollStats = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const [result] = await MasterRoll.aggregate([
     { $match: { firm_id: new mongoose.Types.ObjectId(firm_id) } },
      {
        $group: {
          _id:              null,
          total_employees:  { $sum: 1 },
          active_employees: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          exited_employees: { $sum: { $cond: [{ $ifNull: ['$date_of_exit', false] }, 1, 0] } },
          total_projects:   { $addToSet: '$project' },
          total_sites:      { $addToSet: '$site' },
        },
      },
      {
        $project: {
          _id:              0,
          total_employees:  1,
          active_employees: 1,
          exited_employees: 1,
          total_projects:   { $size: '$total_projects' },
          total_sites:      { $size: '$total_sites' },
        },
      },
    ]);

    res.json({ success: true, data: result ?? { total_employees: 0, active_employees: 0, exited_employees: 0, total_projects: 0, total_sites: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── ACTIVITY LOG ────────────────────────────────────────────────────────── */

export const getActivityLog = async (req, res) => {
  try {
    const { firm_id } = req.user;

    const doc = await MasterRoll.findOne({ _id: req.params.id, firm_id })
      .populate('created_by', 'fullname username role')
      .populate('updated_by', 'fullname username role')
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Employee not found or access denied' });
    }

    const activities = [
      {
        action:    'created',
        timestamp: doc.createdAt,
        user_name: doc.created_by?.fullname ?? null,
        username:  doc.created_by?.username ?? null,
        user_role: doc.created_by?.role     ?? null,
      },
    ];

    // Only add an 'updated' entry if the document was actually modified after creation
    if (doc.updatedAt && doc.updatedAt.getTime() !== doc.createdAt.getTime()) {
      activities.push({
        action:    'updated',
        timestamp: doc.updatedAt,
        user_name: doc.updated_by?.fullname ?? null,
        username:  doc.updated_by?.username ?? null,
        user_role: doc.updated_by?.role     ?? null,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── BULK IMPORT ─────────────────────────────────────────────────────────── */

export const bulkImportMasterRolls = async (req, res) => {
  try {
    const { firm_id, role, id: user_id } = req.user;
    const { employees } = req.body;

    if (role === 'user') {
      return res.status(403).json({ success: false, error: 'Only managers and admins can bulk import' });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid employees array' });
    }

    const settled = await Promise.allSettled(
      employees.map((emp, i) =>
        MasterRoll.create({ firm_id, ...emp, created_by: user_id, updated_by: user_id })
          .then(doc => ({ index: i, id: doc._id, name: emp.employee_name }))
      )
    );

    const success = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed  = settled
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ index: i, name: employees[i]?.employee_name, error: r.reason.message }));

    res.status(201).json({ success: true, imported: success.length, failed: failed.length, details: { success, failed } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── BULK CREATE (raw array body) ────────────────────────────────────────── */

export const bulkCreateMasterRoll = async (req, res) => {
  try {
    const { firm_id, id: user_id } = req.user;
    const rows = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    let successCount = 0;
    const errors = [];

    for (const item of rows) {
      if (!item.employee_name || !item.aadhar) {
        errors.push('Skipped row: Missing Name or Aadhar');
        continue;
      }

      try {
        await MasterRoll.create({
          firm_id,
          employee_name:       item.employee_name,
          father_husband_name: item.father_husband_name ?? '',
          date_of_birth:       item.date_of_birth       ?? '',
          aadhar:              String(item.aadhar),
          pan:                 item.pan                 ?? null,
          phone_no:            String(item.phone_no ?? ''),
          address:             item.address             ?? '',
          bank:                item.bank                ?? '',
          account_no:          String(item.account_no ?? ''),
          ifsc:                item.ifsc                ?? '',
          branch:              item.branch              ?? null,
          uan:                 item.uan                 ?? null,
          esic_no:             item.esic_no             ?? null,
          s_kalyan_no:         item.s_kalyan_no         ?? null,
          category:            item.category            ?? 'UNSKILLED',
          p_day_wage:          item.p_day_wage          ?? 0,
          project:             item.project             ?? null,
          site:                item.site                ?? null,
          date_of_joining:     item.date_of_joining     ?? new Date().toISOString().split('T')[0],
          date_of_exit:        item.date_of_exit        ?? null,
          doe_rem:             item.doe_rem             ?? null,
          status:              item.status              ?? 'Active',
          created_by:          user_id,
          updated_by:          user_id,
        });
        successCount++;
      } catch (err) {
        if (err.code === 11000) {
          errors.push(`Duplicate Aadhar: ${item.aadhar} (${item.employee_name})`);
        } else {
          errors.push(`Error for ${item.employee_name}: ${err.message}`);
        }
      }
    }

    res.json({
      success:  true,
      message:  `Processed ${rows.length} rows.`,
      imported: successCount,
      failed:   errors.length,
      errors,
    });
  } catch (err) {
    console.error('Bulk create error:', err);
    res.status(500).json({ success: false, error: 'Bulk upload failed on server.' });
  }
};

/* ── BULK DELETE ─────────────────────────────────────────────────────────── */

export const bulkDeleteMasterRolls = async (req, res) => {
  try {
    const { firm_id, role, id: user_id, fullname, username } = req.user;
    const { ids } = req.body;

    if (role === 'user') {
      return res.status(403).json({ success: false, error: 'Only managers and admins can bulk delete employees' });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No employee IDs provided' });
    }

    let successCount = 0;
    const failedIds = [];

    for (const id of ids) {
      try {
        const deleted = await MasterRoll.findOneAndDelete({ _id: id, firm_id });
        if (deleted) {
          successCount++;
        } else {
          failedIds.push({ id, reason: 'Not found or access denied' });
        }
      } catch (err) {
        failedIds.push({ id, reason: err.message });
      }
    }

    res.json({
      success:    true,
      message:    `Deleted ${successCount} out of ${ids.length} employees`,
      deleted:    successCount,
      failed:     failedIds.length,
      failedIds,
      deleted_by: { id: user_id, name: fullname, username, role },
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Bulk delete failed on server' });
  }
};

/* ── EXPORT ──────────────────────────────────────────────────────────────── */

export const exportMasterRolls = async (req, res) => {
  try {
    const { firm_id } = req.user;
    const rows = await MasterRoll.find({ firm_id }).sort({ createdAt: -1 }).lean();
    const format = req.query.format ?? 'json';

    if (format === 'csv') {
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'No data to export' });
      }

      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row =>
        Object.values(row).map(val =>
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=master_rolls.csv');
      return res.send([headers, ...csvRows].join('\n'));
    }

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── IFSC LOOKUP (no DB dependency) ─────────────────────────────────────── */

export const lookupIFSC = async (req, res) => {
  try {
    const { ifsc } = req.params;

    if (!ifsc || typeof ifsc !== 'string' || ifsc.length !== 11) {
      return res.status(400).json({ success: false, error: 'Invalid IFSC code. Must be exactly 11 characters.' });
    }

    const normalizedIFSC = ifsc.toUpperCase();
    const response = await fetch(`https://ifsc.razorpay.com/${normalizedIFSC}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'MasterRoll-System/1.0' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: `IFSC "${normalizedIFSC}" not found. Please check the code.` });
      }
      return res.status(response.status).json({ success: false, error: `IFSC lookup failed (HTTP ${response.status}).` });
    }

    const data = await response.json();

    if (!data.BANK) {
      return res.status(502).json({ success: false, error: 'Invalid response from IFSC service.' });
    }

    res.json({
      success: true,
      data: {
        ifsc: normalizedIFSC,
        bank: data.BANK, branch: data.BRANCH, address: data.ADDRESS,
        city: data.CITY,  state:  data.STATE,  district: data.DISTRICT,
        bankcode: data.BANKCODE, micr: data.MICR,
      },
    });
  } catch (error) {
    console.error('[IFSC LOOKUP] Error:', error);
    res.status(500).json({ success: false, error: 'Unable to reach IFSC lookup service.' });
  }
};

/* ── APPOINTMENT LETTER GENERATION ──────────────────────────────────────── */

/**
 * Normalize a raw category/designation string from the database to a
 * professional title, regardless of casing or delimiter used at storage time.
 *
 * Covers the full spectrum of construction/contract labour designations:
 *   unskilled, skilled, semi skilled, semi-skilled, helper, technician …
 *
 * @param {string|null} raw  - value from employee.category
 * @returns {string}         - properly capitalised professional designation
 */
function normalizeDesignation(raw) {
  if (!raw || typeof raw !== 'string') return 'General Worker';

  /* Collapse all separators (hyphen / underscore / multiple spaces) → single space,
     then lowercase for lookup */
  const key = raw.trim().toLowerCase().replace(/[-_\s]+/g, ' ');

  const MAP = {
    /* Labour categories */
    'unskilled':         'Unskilled Worker',
    'unskilled worker':  'Unskilled Worker',
    'unskilled labour':  'Unskilled Worker',
    'unskilled laborer': 'Unskilled Worker',
    'skilled':           'Skilled Worker',
    'skilled worker':    'Skilled Worker',
    'skilled labour':    'Skilled Worker',
    'semi skilled':      'Semi-Skilled Worker',
    'semi-skilled':      'Semi-Skilled Worker',
    'semi skilled worker': 'Semi-Skilled Worker',
    'worker':            'General Worker',
    'general worker':    'General Worker',
    'labour':            'General Labour',
    'laborer':           'General Labour',
    'labourer':          'General Labour',
    'general labour':    'General Labour',
    /* Trade designations */
    'helper':            'Helper',
    'technician':        'Technician',
    'electrician':       'Electrician',
    'plumber':           'Plumber',
    'carpenter':         'Carpenter',
    'mason':             'Mason',
    'bar bender':        'Bar Bender',
    'bar bender helper': 'Bar Bender Helper',
    'welder':            'Welder',
    'fitter':            'Fitter',
    'painter':           'Painter',
    'operator':          'Machine Operator',
    'machine operator':  'Machine Operator',
    'excavator operator':'Excavator Operator',
    'crane operator':    'Crane Operator',
    'forklift operator': 'Forklift Operator',
    'supervisor':        'Supervisor',
    'site supervisor':   'Site Supervisor',
    'foreman':           'Foreman',
    'driver':            'Driver',
    'hv driver':         'Heavy Vehicle Driver',
    'heavy vehicle driver': 'Heavy Vehicle Driver',
    'security':          'Security Guard',
    'security guard':    'Security Guard',
    'watchman':          'Watchman',
    'cleaner':           'Cleaner / Housekeeping',
    'housekeeping':      'Cleaner / Housekeeping',
    'cook':              'Cook',
    'store keeper':      'Store Keeper',
    'storekeeper':       'Store Keeper',
    'data entry':        'Data Entry Operator',
    'data entry operator': 'Data Entry Operator',
    'accountant':        'Accountant',
    'engineer':          'Engineer',
    'site engineer':     'Site Engineer',
    'project manager':   'Project Manager',
    'manager':           'Manager',
  };

  if (MAP[key]) return MAP[key];

  /* Fallback: title-case the raw value so it at least looks professional */
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Generate an Appointment Letter (.docx) for an employee.
 *
 * Design goals:
 *  • Fits on ONE A4 page (top/bottom space reserved for pre-printed letterhead).
 *  • 10 pt body, compact line spacing, narrow L/R margins.
 *  • Statutory + bank data presented inline to save vertical space.
 *  • Police verification clause states the CORRECT obligation:
 *      – Submit at the time of joining; certificate must not be older than
 *        six (6) months from its date of issue.
 */
export const generateAppointmentLetter = async (req, res) => {
  try {
    const { id }      = req.params;
    const { firm_id } = req.user;

    /* ── Fetch & authorise ─────────────────────────────────────────── */
    const employee = await MasterRoll.findById(id).lean();

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (employee.firm_id.toString() !== firm_id.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    /* ── Load docx ─────────────────────────────────────────────────── */
    let docx;
    try {
      docx = await import('docx');
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Document generation library not installed. Run: npm install docx',
      });
    }

    const {
      Document, Packer, Paragraph, TextRun,
      AlignmentType, convertInchesToTwip, UnderlineType,
    } = docx;

    /* ── Helpers ───────────────────────────────────────────────────── */
    const FONT = 'Times New Roman';
    const SZ   = 22;           /* half-points → 11 pt */
    const SZ_SM = 20;          /* 10 pt for statutory detail lines */

    function fmt(dateStr) {
      if (!dateStr) return '—';
      try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
      } catch { return String(dateStr); }
    }

    /**
     * Shorthand paragraph factory.
     * @param {Array}  runs    - array of TextRun instances
     * @param {object} [opts]  - extra Paragraph options
     */
    function para(runs, opts = {}) {
      return new Paragraph({
        children: runs,
        alignment: AlignmentType.JUSTIFIED,
        ...opts,
      });
    }

    /** Inline label + value TextRun pair */
    function field(label, value) {
      return [
        new TextRun({ text: label, bold: true, font: FONT, size: SZ_SM }),
        new TextRun({ text: String(value || '—'), font: FONT, size: SZ_SM }),
      ];
    }

    /* ── Prepare data ──────────────────────────────────────────────── */
    const employeeName  = employee.employee_name        || 'Employee Name';
    const fatherName    = employee.father_husband_name  || '—';
    const address       = employee.address              || '—';
    const designation   = normalizeDesignation(employee.category);
    const dailyWage     = employee.p_day_wage           ?? '—';
    const project       = employee.project              || '—';
    const site          = employee.site                 || project;
    const doj           = fmt(employee.date_of_joining);
    const aadhar        = employee.aadhar               || '—';
    const pan           = employee.pan                  || 'Not Available';
    const bank          = employee.bank                 || '—';
    const accountNo     = employee.account_no           || '—';
    const ifsc          = employee.ifsc                 || '—';
    const esicNo        = employee.esic_no              || 'Not Enrolled';
    const uanNo         = employee.uan                  || 'Not Enrolled';
    const sKalyanNo     = employee.s_kalyan_no          || null;
    const today         = fmt(new Date());

    /* Generate a reference number: APPT/<year>/<padded numeric part of _id> */
    const refNo = `APPT/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`;

    /* ── Build document ────────────────────────────────────────────── */
    const SP = (after, before = 0) => ({ spacing: { before, after } });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            /* Top/bottom kept large for pre-printed company letterhead.
               Left/right narrowed to maximise usable width. */
            margins: {
              top:    convertInchesToTwip(1.20),
              bottom: convertInchesToTwip(1.10),
              left:   convertInchesToTwip(0.20),
              right:  convertInchesToTwip(0.20),
            },
          },
        },

        children: [

          /* ── Ref & Date (same line, right-aligned date) ─────────── */
          para([
            new TextRun({ text: `Ref. No.: ${refNo}`, font: FONT, size: SZ }),
            new TextRun({ text: `\t\tDate: ${today}`, font: FONT, size: SZ }),
          ], { ...SP(80) }),

          /* ── Address block ──────────────────────────────────────── */
          para([new TextRun({ text: `To,`, font: FONT, size: SZ })],
               { ...SP(40) }),
          para([new TextRun({ text: employeeName, bold: true, font: FONT, size: SZ })],
               { ...SP(40) }),
          para([new TextRun({ text: `S/O: ${fatherName}`, font: FONT, size: SZ })],
               { ...SP(40) }),
          para([new TextRun({ text: address, font: FONT, size: SZ })],
               { ...SP(100) }),

          /* ── Subject ────────────────────────────────────────────── */
          para([
            new TextRun({ text: 'Sub: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: 'Appointment Letter', bold: true, underline: { type: UnderlineType.SINGLE }, font: FONT, size: SZ }),
          ], { ...SP(80) }),

          /* ── Salutation ─────────────────────────────────────────── */
          para([new TextRun({ text: `Dear ${employeeName},`, font: FONT, size: SZ })],
               { ...SP(80) }),

          /* ── Opening ────────────────────────────────────────────── */
          para([new TextRun({
            text: `We are pleased to appoint you as ${designation} with our organisation, with effect from ${doj}. `
                + `This appointment is offered on the terms and conditions set out below.`,
            font: FONT, size: SZ,
          })], { ...SP(80), indent: { firstLine: 0 } }),

          /* ── Terms of Employment ────────────────────────────────── */
          para([new TextRun({ text: 'Terms of Employment', bold: true, font: FONT, size: SZ })],
               { ...SP(60), before: 80 }),

          para([
            new TextRun({ text: 'Designation: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: `${designation}`, font: FONT, size: SZ }),
            new TextRun({ text: '    Project / Site: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: `${project} / ${site}`, font: FONT, size: SZ }),
          ], { ...SP(50), indent: { left: 200 } }),

          para([
            new TextRun({ text: 'Date of Joining: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: doj, font: FONT, size: SZ }),
            new TextRun({ text: '    Daily Wage: ', bold: true, font: FONT, size: SZ }),
            new TextRun({ text: `₹${dailyWage} per day`, font: FONT, size: SZ }),
          ], { ...SP(50), indent: { left: 200 } }),

          para([
            new TextRun({
              text: 'Your employment is governed by the applicable provisions of the Contract Labour (Regulation & Abolition) Act, 1970, '
                  + 'the Building & Other Construction Workers Act, 1996, and all other relevant labour legislation.',
              font: FONT, size: SZ_SM,
            }),
          ], { ...SP(80), indent: { left: 200 } }),

          /* ── Statutory & Bank Details (compact two-column style) ── */
          para([new TextRun({ text: 'Statutory & Bank Details', bold: true, font: FONT, size: SZ })],
               { ...SP(50), before: 80 }),

          para([
            ...field('Aadhar: ', aadhar),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('PAN: ', pan),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            ...field('UAN: ', uanNo),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('ESIC No.: ', esicNo),
            ...(sKalyanNo ? [
              new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
              ...field('S. Kalyan No.: ', sKalyanNo),
            ] : []),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            ...field('Bank: ', bank),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('A/C No.: ', accountNo),
            new TextRun({ text: '    ', font: FONT, size: SZ_SM }),
            ...field('IFSC: ', ifsc),
          ], { ...SP(80), indent: { left: 200 } }),

          /* ── Police Verification ────────────────────────────────── */
          /* CORRECT LOGIC:
               • Employee must submit a Police Clearance Certificate (PCC)
                 AT THE TIME OF JOINING — not after some grace period.
               • The PCC submitted must have been issued within the
                 preceding six (6) months from the date of joining.
               • A certificate older than six months is NOT acceptable.         */
          para([new TextRun({ text: 'Police Verification', bold: true, font: FONT, size: SZ })],
               { ...SP(50), before: 80 }),

          para([new TextRun({
            text: 'Submission of a valid Police Clearance Certificate (PCC) is mandatory at the time of joining. '
                + 'The certificate must have been issued within six (6) months preceding your date of joining; '
                + 'any certificate older than six months will not be accepted. '
                + 'Failure to produce a valid PCC on or before the date of joining may result in deferral or cancellation of this appointment.',
            font: FONT, size: SZ_SM,
          })], { ...SP(80), indent: { left: 200 } }),

          /* ── General Conditions ─────────────────────────────────── */
          para([new TextRun({ text: 'General Conditions', bold: true, font: FONT, size: SZ })],
               { ...SP(50), before: 80 }),

          para([
            new TextRun({ text: '(a) ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: 'You shall comply with all company rules, site regulations, and applicable labour laws throughout your tenure.', font: FONT, size: SZ_SM }),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            new TextRun({ text: '(b) ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: 'Either party may terminate this appointment by giving notice as prescribed under the applicable labour law or by payment in lieu thereof.', font: FONT, size: SZ_SM }),
          ], { ...SP(40), indent: { left: 200 } }),

          para([
            new TextRun({ text: '(c) ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: 'All personal data furnished by you shall be maintained in strict confidence and used solely for employment and statutory compliance purposes.', font: FONT, size: SZ_SM }),
          ], { ...SP(80), indent: { left: 200 } }),

          /* ── Closing ────────────────────────────────────────────── */
          para([new TextRun({
            text: 'Kindly sign and return the duplicate copy of this letter as acknowledgement of your acceptance of the above terms.',
            font: FONT, size: SZ,
          })], { ...SP(80) }),

          para([new TextRun({ text: 'Yours faithfully,', font: FONT, size: SZ })],
               { ...SP(40) }),

          para([new TextRun({ text: '\n\n', font: FONT, size: SZ })], { ...SP(40) }),

          para([new TextRun({ text: '________________________________', font: FONT, size: SZ })],
               { ...SP(40) }),

          para([new TextRun({ text: 'Authorised Signatory', bold: true, font: FONT, size: SZ })],
               { ...SP(20) }),
          para([new TextRun({ text: '(For and on behalf of the Company)', font: FONT, size: SZ_SM })],
               { ...SP(80) }),

          /* ── Employee Acceptance ────────────────────────────────── */
          para([new TextRun({
            text: '─────────────────────── EMPLOYEE ACCEPTANCE ───────────────────────',
            font: FONT, size: SZ_SM,
          })], { alignment: AlignmentType.CENTER, ...SP(60) }),

          para([new TextRun({
            text: 'I hereby accept the appointment on the terms and conditions stated above and confirm that I have submitted / will submit '
                + 'a Police Clearance Certificate issued within the preceding six (6) months on or before my date of joining.',
            font: FONT, size: SZ_SM,
          })], { ...SP(60) }),

          para([
            new TextRun({ text: 'Signature: _________________________    ', font: FONT, size: SZ_SM }),
            new TextRun({ text: 'Date: _____________________', font: FONT, size: SZ_SM }),
          ], { ...SP(40) }),

          para([
            new TextRun({ text: 'Name: ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: employeeName, font: FONT, size: SZ_SM }),
            new TextRun({ text: '    Aadhar No.: ', bold: true, font: FONT, size: SZ_SM }),
            new TextRun({ text: aadhar, font: FONT, size: SZ_SM }),
          ], { ...SP(0) }),

        ],
      }],
    });

    /* ── Pack & send ───────────────────────────────────────────────── */
    const buffer   = await Packer.toBuffer(doc);
    const safeName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Appointment_Letter_${safeName}_${Date.now()}.docx`;

    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('[APPOINTMENT LETTER] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate appointment letter: ' + error.message,
    });
  }
};
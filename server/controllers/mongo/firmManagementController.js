import bcrypt from 'bcrypt';
import { Firm, User, Stock, Bill, Party } from '../../models/index.js';

/* ── ROLE GUARD HELPER ─────────────────────────────────────────────────── */

function requireSuperAdmin(req, res) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'You are not permitted to perform this action' });
    return false;
  }
  return true;
}

/* ── LOCATION PROCESSING HELPER ─────────────────────────────────────────
 *
 * Normalises and validates the locations[] array coming from the frontend.
 *
 * Rules:
 *  1. Strip the UI-only _fetched flag.
 *  2. Ensure state_code is always derived from the first two chars of gst_number
 *     (in case the frontend skipped the derivation for a manually-typed GSTIN).
 *  3. Guarantee exactly one entry has is_default: true.
 *  4. If the array is empty and legacy top-level fields exist, synthesise a
 *     single PPOB entry from them (backward-compatibility path).
 * ──────────────────────────────────────────────────────────────────────── */

function processLocations(locations, legacyFields = {}) {
  let locs = Array.isArray(locations) ? [...locations] : [];

  // Legacy fallback: no locations sent but old-style fields present
  if (locs.length === 0 && (legacyFields.gst_number || legacyFields.address)) {
    locs = [{
      gst_number:        legacyFields.gst_number || '',
      state_code:        legacyFields.gst_number ? legacyFields.gst_number.substring(0, 2) : '',
      state:             legacyFields.state      || '',
      registration_type: 'PPOB',
      address:           legacyFields.address    || '',
      city:              legacyFields.city        || '',
      pincode:           legacyFields.pincode     || '',
      is_default:        true,
    }];
  }

  // Normalise each entry
  locs = locs.map(loc => {
    const { _fetched, ...clean } = loc; // strip UI-only flag

    // Always derive state_code from GSTIN — never trust the frontend blindly
    if (clean.gst_number && clean.gst_number.length >= 2) {
      clean.state_code = clean.gst_number.substring(0, 2);
    }

    // Default registration_type
    if (!clean.registration_type) clean.registration_type = 'PPOB';

    return clean;
  });

  // Ensure exactly one default
  if (locs.length > 0 && !locs.some(l => l.is_default)) {
    locs[0].is_default = true;
  }

  return locs;
}

/* Build the legacy top-level field sync object from the default location */
function syncLegacyFields(processedLocations) {
  const def = processedLocations.find(l => l.is_default) || processedLocations[0] || {};
  return {
    gst_number: def.gst_number || '',
    address:    def.address    || '',
    city:       def.city       || '',
    state:      def.state      || '',
    pincode:    def.pincode    || '',
  };
}

/* ── CREATE FIRM ─────────────────────────────────────────────────────────── */

export async function createFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const {
      name, legal_name, phone_number, secondary_phone, email, website,
      business_type, industry_type, establishment_year, employee_count,
      registration_number, registration_date, cin_number, pan_number,
      tax_id, vat_number, bank_account_number, bank_name,
      bank_branch, ifsc_code, payment_terms, status, license_numbers,
      insurance_details, currency, timezone, fiscal_year_start,
      invoice_prefix, quote_prefix, po_prefix, logo_url,
      invoice_template, enable_e_invoice,
      admin_account,
      locations,
      // Legacy field fallbacks (in case old clients still send them)
      gst_number, address, city, state, country, pincode,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Firm name is required' });
    }

    const existingFirm = await Firm.findOne({ name }).lean();
    if (existingFirm) {
      return res.status(409).json({ error: 'A firm with this name already exists' });
    }

    // Process and normalise the unified locations array
    const processedLocations = processLocations(locations, { gst_number, address, city, state, pincode });
    const legacy = syncLegacyFields(processedLocations);

    const firm = await Firm.create({
      name,
      legal_name,
      locations:  processedLocations,

      // Sync legacy top-level fields from the default location
      ...legacy,
      country: country || 'India',

      phone_number, secondary_phone, email, website,
      business_type, industry_type, establishment_year, employee_count,
      registration_number, registration_date, cin_number, pan_number,
      tax_id, vat_number, bank_account_number, bank_name,
      bank_branch, ifsc_code, payment_terms,
      status: status ?? 'approved',
      license_numbers, insurance_details,
      currency:          currency          ?? 'INR',
      timezone:          timezone          ?? 'Asia/Kolkata',
      fiscal_year_start, invoice_prefix, quote_prefix, po_prefix,
      logo_url, invoice_template,
      enable_e_invoice: !!enable_e_invoice,
    });

    let message = 'Firm created successfully';

    const a = admin_account;
    if (a && (a.fullname || a.username || a.email || a.password)) {
      const { fullname, username, email: adminEmail, password } = a;
      if (!fullname || !username || !adminEmail || !password) {
        return res.status(400).json({ error: 'All admin account fields are required' });
      }
      const [uTaken, eTaken] = await Promise.all([
        User.findOne({ username }).lean(),
        User.findOne({ email: adminEmail }).lean(),
      ]);
      if (uTaken) return res.status(409).json({ error: 'Username already exists' });
      if (eTaken) return res.status(409).json({ error: 'Email already exists' });

      const hashedPassword = await bcrypt.hash(password, 12);
      await User.create({
        fullname, username, email: adminEmail, password: hashedPassword,
        role: 'admin', firm_id: firm._id, status: 'approved',
      });
      message = 'Firm and admin account created successfully';
    }

    res.status(201).json({ message, firmId: firm._id });
  } catch (err) {
    console.error('Error creating firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── GET ALL FIRMS ───────────────────────────────────────────────────────── */

export async function getAllFirms(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const firms = await Firm.find().sort({ createdAt: -1 }).lean();
    res.json({ firms });
  } catch (err) {
    console.error('Error fetching firms:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── GET FIRM BY ID ──────────────────────────────────────────────────────── */

export async function getFirm(req, res) {
  if (!req.user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const firm = await Firm.findById(req.params.id).lean();
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    res.json({ firm });
  } catch (err) {
    console.error('Error fetching firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── UPDATE FIRM ─────────────────────────────────────────────────────────── */

export async function updateFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;

  try {
    const { id } = req.params;
    const existing = await Firm.findById(id).lean();
    if (!existing) return res.status(404).json({ error: 'Firm not found' });

    const { name, enable_e_invoice, locations, ...rest } = req.body;

    if (name) {
      const clash = await Firm.findOne({ name, _id: { $ne: id } }).lean();
      if (clash) return res.status(409).json({ error: 'Another firm with this name already exists' });
    }

    const updateFields = { ...rest };
    if (name              !== undefined) updateFields.name             = name;
    if (enable_e_invoice  !== undefined) updateFields.enable_e_invoice = !!enable_e_invoice;

    if (locations !== undefined) {
      const processedLocations = processLocations(locations);
      updateFields.locations = processedLocations;

      // Keep legacy top-level fields in sync
      const legacy = syncLegacyFields(processedLocations);
      Object.assign(updateFields, legacy);
    }

    await Firm.findByIdAndUpdate(id, { $set: updateFields });
    res.json({ message: 'Firm updated successfully' });
  } catch (err) {
    console.error('Error updating firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── DELETE FIRM ─────────────────────────────────────────────────────────── */

export async function deleteFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const existing = await Firm.findById(id).lean();
    if (!existing) return res.status(404).json({ error: 'Firm not found' });

    const [uC, sC, bC, pC] = await Promise.all([
      User.countDocuments({ firm_id: id }),
      Stock.countDocuments({ firm_id: id }),
      Bill.countDocuments({ firm_id: id }),
      Party.countDocuments({ firm_id: id }),
    ]);

    if (uC > 0)            return res.status(400).json({ error: 'Remove associated users first.' });
    if (sC > 0 || bC > 0 || pC > 0) {
      return res.status(400).json({ error: 'Remove associated business data first.' });
    }

    await Firm.findByIdAndDelete(id);
    res.json({ message: 'Firm deleted successfully' });
  } catch (err) {
    console.error('Error deleting firm:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── ASSIGN / UNASSIGN USER TO FIRM ─────────────────────────────────────── */

export async function assignUserToFirm(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  try {
    const { userId, firmId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (firmId) {
      const firm = await Firm.findById(firmId).lean();
      if (!firm) return res.status(404).json({ error: 'Firm not found' });
    }

    await User.findByIdAndUpdate(userId, { $set: { firm_id: firmId ?? null } });
    res.json({ message: 'User assignment updated' });
  } catch (err) {
    console.error('Error assigning user:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── GET ALL USERS WITH FIRMS ────────────────────────────────────────────── */

export async function getAllUsersWithFirms(req, res) {
  if (!req.user) return res.status(403).json({ error: 'Unauthorized' });
  try {
    let query = {};
    if (req.user.role === 'admin') query.firm_id = req.user.firm_id;
    const users = await User.find(query).populate('firm_id', 'name').lean();
    const shaped = users.map(u => ({
      _id: u._id, fullname: u.fullname, username: u.username, email: u.email,
      role: u.role, status: u.status,
      firm_id:   u.firm_id?._id  ?? null,
      firm_name: u.firm_id?.name ?? null,
    }));
    res.json({ users: shaped });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/* ── CREATE USER (ADMIN ONLY) ───────────────────────────────────────────── */

export async function createUser(req, res) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { fullname, username, email, password, role } = req.body;
    if (!fullname || !username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const [uT, eT] = await Promise.all([
      User.findOne({ username }).lean(),
      User.findOne({ email }).lean(),
    ]);
    if (uT) return res.status(409).json({ error: 'Username exists' });
    if (eT) return res.status(409).json({ error: 'Email exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({
      fullname, username, email, password: hashedPassword, role,
      firm_id: req.user.firm_id, status: 'approved',
    });
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUser(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const { id } = req.params;
    const { fullname, username, email, role, status } = req.body;

    if (!fullname || !username || !email || !role || !status) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['user', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser || targetUser.role === 'super_admin') {
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(targetUser.firm_id || '') !== String(req.user.firm_id || '')) {
      return res.status(403).json({ error: 'You can only edit users from your own firm' });
    }

    const isSelf = String(targetUser._id) === String(req.user.id);
    if (isSelf && (targetUser.role !== role || targetUser.status !== status)) {
      return res.status(400).json({ error: 'You cannot change your own role or status' });
    }

    const [usernameTaken, emailTaken] = await Promise.all([
      User.findOne({ username, _id: { $ne: id } }).lean(),
      User.findOne({ email, _id: { $ne: id } }).lean(),
    ]);

    if (usernameTaken) return res.status(409).json({ error: 'Username exists' });
    if (emailTaken) return res.status(409).json({ error: 'Email exists' });

    targetUser.fullname = fullname;
    targetUser.username = username;
    targetUser.email = email;
    targetUser.role = role;
    targetUser.status = status;

    await targetUser.save();

    res.json({
      message: 'User updated successfully',
      user: {
        _id: targetUser._id,
        fullname: targetUser.fullname,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
        firm_id: targetUser.firm_id,
      },
    });
  } catch (err) {
    console.error('Error updating user:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Database Seed Script — Mongoose version
 * Creates initial firms and users for development/testing.
 *
 * Usage:
 *   node server/utils/mongo/seed.js
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from './mongoose.config.js';
import { Firm, User } from '../../models/index.js';

/* ─────────────────────────────────────────────
   SEED DATA
───────────────────────────────────────────── */

const FIRMS = [
  {
    code:   'ACME',
    status: 'approved',
    data: {
      name:                'Acme Corporation',
      code:                'ACME',
      description:         'Leading construction company',
      legal_name:          'Acme Corporation Pvt. Ltd.',
      address:             '123 Business Park',
      city:                'Mumbai',
      state:               'Maharashtra',
      country:             'India',
      pincode:             '400001',
      phone_number:        '+91-22-1234-5678',
      secondary_phone:     '+91-22-1234-5679',
      email:               'info@acme.com',
      website:             'www.acme.com',
      business_type:       'Construction',
      industry_type:       'Infrastructure',
      establishment_year:  2010,
      employee_count:      150,
      registration_number: 'REG123456',
      registration_date:   '2010-01-15',
      cin_number:          'U45200MH2010PTC123456',
      pan_number:          'AAACR5055K',
      gst_number:          '27AABCT1234H1Z0',
      bank_account_number: '1234567890123456',
      bank_name:           'HDFC Bank',
      bank_branch:         'Mumbai Main',
      ifsc_code:           'HDFC0000001',
      payment_terms:       'Net 30',
      status:              'approved',
      currency:            'INR',
      timezone:            'Asia/Kolkata',
      fiscal_year_start:   '2024-04-01',
      invoice_prefix:      'INV',
      quote_prefix:        'QT',
      po_prefix:           'PO',
      invoice_template:    'standard',
      enable_e_invoice:    true,
    },
    users: [
      { username: 'admin',   email: 'admin@acme.com',   fullname: 'Admin User',   role: 'admin',   password: 'admin123',   status: 'approved' },
      { username: 'manager', email: 'manager@acme.com', fullname: 'Manager User', role: 'manager', password: 'manager123', status: 'approved' },
      { username: 'user',    email: 'user@acme.com',    fullname: 'Regular User', role: 'user',    password: 'user123',    status: 'approved' },
    ],
  },
  {
    code:   'BUILD',
    status: 'pending',
    data: {
      name:                'BuildTech Industries',
      code:                'BUILD',
      description:         'Modern construction solutions',
      legal_name:          'BuildTech Industries Pvt. Ltd.',
      address:             '456 Tech Park',
      city:                'Bangalore',
      state:               'Karnataka',
      country:             'India',
      pincode:             '560001',
      phone_number:        '+91-80-1234-5678',
      email:               'info@buildtech.com',
      website:             'www.buildtech.com',
      business_type:       'Construction',
      industry_type:       'Infrastructure',
      establishment_year:  2015,
      employee_count:      100,
      registration_number: 'REG654321',
      registration_date:   '2015-06-20',
      cin_number:          'U45200KA2015PTC654321',
      pan_number:          'AABCT1234K',
      gst_number:          '29AABCT1234H1Z0',
      bank_account_number: '9876543210123456',
      bank_name:           'ICICI Bank',
      bank_branch:         'Bangalore Main',
      ifsc_code:           'ICIC0000001',
      payment_terms:       'Net 45',
      status:              'pending',
      currency:            'INR',
      timezone:            'Asia/Kolkata',
      fiscal_year_start:   '2024-04-01',
      invoice_prefix:      'INV',
      invoice_template:    'standard',
      enable_e_invoice:    false,
    },
    users: [
      { username: 'buildadmin', email: 'admin@buildtech.com', fullname: 'Build Admin', role: 'admin', password: 'build123', status: 'pending' },
    ],
  },
  {
    code:   'METRO',
    status: 'approved',
    data: {
      name:                'Metro Constructions',
      code:                'METRO',
      description:         'Urban development specialists',
      legal_name:          'Metro Constructions Pvt. Ltd.',
      address:             '789 Metro Plaza',
      city:                'Delhi',
      state:               'Delhi',
      country:             'India',
      pincode:             '110001',
      phone_number:        '+91-11-1234-5678',
      email:               'info@metro.com',
      website:             'www.metro.com',
      business_type:       'Construction',
      industry_type:       'Urban Development',
      establishment_year:  2012,
      employee_count:      200,
      registration_number: 'REG789012',
      registration_date:   '2012-03-10',
      cin_number:          'U45200DL2012PTC789012',
      pan_number:          'AABCT5678K',
      gst_number:          '07AABCT1234H1Z0',
      bank_account_number: '5555555555555555',
      bank_name:           'Axis Bank',
      bank_branch:         'Delhi Main',
      ifsc_code:           'AXIS0000001',
      payment_terms:       'Net 30',
      status:              'approved',
      currency:            'INR',
      timezone:            'Asia/Kolkata',
      fiscal_year_start:   '2024-04-01',
      invoice_prefix:      'INV',
      invoice_template:    'standard',
      enable_e_invoice:    true,
    },
    users: [
      { username: 'metroadmin', email: 'admin@metro.com', fullname: 'Metro Admin', role: 'admin', password: 'metro123', status: 'approved' },
    ],
  },
];

/* ─────────────────────────────────────────────
   SEED FUNCTION
───────────────────────────────────────────── */

async function seed() {
  console.log('🌱 Starting database seed...\n');

  for (const firmDef of FIRMS) {
    // ── Create or retrieve firm ───────────────────────────────
    let firm = await Firm.findOne({ code: firmDef.code });

    if (!firm) {
      firm = await Firm.create(firmDef.data);
      console.log(`✅ Created firm: ${firm.name} (${firm.code})`);
    } else {
      console.log(`ℹ️  Firm already exists: ${firm.name} (${firm.code})`);
    }

    // ── Create users for this firm ───────────────────────────
    for (const u of firmDef.users) {
      const exists = await User.findOne({ username: u.username });

      if (exists) {
        console.log(`ℹ️  User already exists: ${u.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(u.password, 12);

      await User.create({
        username: u.username,
        email:    u.email,
        fullname: u.fullname,
        password: hashedPassword,
        role:     u.role,
        firm_id:  firm._id,
        status:   u.status,
      });

      const note = u.status === 'pending' ? ' (PENDING APPROVAL)' : '';
      console.log(`✅ Created ${u.role}: ${u.email} (password: ${u.password})${note}`);
    }

    console.log('');
  }

  console.log('🎉 Seed completed successfully!\n');
  console.log('📝 Test Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Firm: ACME (Approved)');
  console.log('  Admin:   admin@acme.com   / admin123');
  console.log('  Manager: manager@acme.com / manager123');
  console.log('  User:    user@acme.com    / user123');
  console.log('');
  console.log('Firm: BUILD (Pending Approval)');
  console.log('  Admin:   admin@buildtech.com / build123');
  console.log('  (Cannot log in until firm is approved)');
  console.log('');
  console.log('Firm: METRO (Approved)');
  console.log('  Admin:   admin@metro.com / metro123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/* ─────────────────────────────────────────────
   ENTRY POINT
───────────────────────────────────────────── */

connectDB()
  .then(() => seed())
  .then(() => disconnectDB())
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });

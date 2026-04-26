/**
 * Seed Super Admin — Mongoose version
 * Creates a super_admin user and initialises the gst_enabled setting
 * if they don't already exist.
 *
 * Usage:
 *   node server/utils/mongo/seed-super-admin.js
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDB, disconnectDB } from './mongoose.config.js';
import { User, Settings } from '../../models/index.js';

export async function seedSuperAdmin() {
  try {
    // ── Super admin ──────────────────────────────────────────────
    const existing = await User.findOne({ role: 'super_admin' }).lean();

    if (existing) {
      console.log('✅ Super admin already exists');
    } else {
      const plainPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      await User.create({
        username: 'superadmin',
        email:    'superadmin@system.com',
        fullname: 'Super Administrator',
        password: hashedPassword,
        role:     'super_admin',
        firm_id:  null,
        status:   'approved',
      });

      console.log('✅ Super admin created successfully');
      console.log('📧  Email:    superadmin@system.com');
      console.log(`🔑  Password: ${plainPassword}`);
      console.log('⚠️   IMPORTANT: Change the password after first login!');
    }

    // ── Global GST setting ───────────────────────────────────────
    const gstSetting = await Settings.findOne({ setting_key: 'gst_enabled' }).lean();

    if (!gstSetting) {
      await Settings.create({
        setting_key:   'gst_enabled',
        setting_value: 'true',
        description:   'Global GST calculation toggle',
      });
      console.log('✅ GST setting initialised');
    }

  } catch (err) {
    console.error('❌ Error seeding super admin:', err);
    throw err;
  }
}

// ── Run directly ─────────────────────────────────────────────────
console.log('Script started...');
console.log('process.argv[1]:', process.argv[1]);

// Check if this script is being run directly (simpler approach)
const isDirectRun = process.argv[1].endsWith('seed-super-admin.js') || process.argv[1].includes('seed-super-admin.js');
console.log('Is direct run:', isDirectRun);

if (isDirectRun) {
  console.log('Running seed script...');
  connectDB()
    .then(() => {
      console.log('Connected to database');
      return seedSuperAdmin();
    })
    .then(() => {
      console.log('Seed completed successfully');
      console.log('Done');
      disconnectDB();
    })
    .catch(err => {
      console.error('Script execution failed:', err);
      process.exit(1);
    });
} else {
  console.log('Script not running directly - exiting');
}

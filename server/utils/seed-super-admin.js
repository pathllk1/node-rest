import { db, Settings } from './db.js';
import bcrypt from 'bcrypt';

/**
 * Seed Super Admin
 * Creates a super admin user if one doesn't exist
 * Super admin doesn't belong to any firm and can manage all firms
 */

async function seedSuperAdmin() {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = db.prepare(`
      SELECT * FROM users WHERE role = 'super_admin'
    `).get();

    if (existingSuperAdmin) {
      console.log('✅ Super admin already exists');
    } else {
      // Create super admin
      const password = 'SuperAdmin@123'; // Change this in production!
      const hashedPassword = await bcrypt.hash(password, 12);

      const result = db.prepare(`
        INSERT INTO users (username, email, fullname, password, role, firm_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'superadmin',
        'superadmin@system.com',
        'Super Administrator',
        hashedPassword,
        'super_admin',
        null,
        'approved'
      );

      console.log('✅ Super admin created successfully');
      console.log('📧 Email: superadmin@system.com');
      console.log('🔑 Password: SuperAdmin@123');
      console.log('⚠️  IMPORTANT: Change the password after first login!');
    }

    // Initialize gst_enabled setting if it doesn't exist
    const existingGstSetting = Settings.getByKey.get('gst_enabled');
    if (!existingGstSetting) {
      Settings.create.run(
        'gst_enabled',
        'true',
        'Global GST calculation toggle'
      );
      console.log('✅ GST setting initialized');
    }

  } catch (err) {
    console.error('❌ Error seeding super admin:', err);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSuperAdmin().then(() => {
    console.log('Done');
    process.exit(0);
  });
}

export { seedSuperAdmin };

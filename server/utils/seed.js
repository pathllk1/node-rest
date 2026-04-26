import { db, Firm, User } from './db.js';
import bcrypt from 'bcrypt';

/**
 * Seed script to create initial firms and admin users
 * Run this once to set up test data
 */

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create default firm 1 (approved) - check if exists first
    let firm1 = Firm.getByCode.get('ACME');
    if (!firm1) {
      firm1 = Firm.create.run({
        name: 'Acme Corporation',
        code: 'ACME',
        description: 'Leading construction company',
        legal_name: 'Acme Corporation Pvt. Ltd.',
        address: '123 Business Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: '400001',
        phone_number: '+91-22-1234-5678',
        secondary_phone: '+91-22-1234-5679',
        email: 'info@acme.com',
        website: 'www.acme.com',
        business_type: 'Construction',
        industry_type: 'Infrastructure',
        establishment_year: 2010,
        employee_count: 150,
        registration_number: 'REG123456',
        registration_date: '2010-01-15',
        cin_number: 'U45200MH2010PTC123456',
        pan_number: 'AAACR5055K',
        gst_number: '27AABCT1234H1Z0',
        tax_id: 'TAX123456',
        vat_number: 'VAT123456',
        bank_account_number: '1234567890123456',
        bank_name: 'HDFC Bank',
        bank_branch: 'Mumbai Main',
        ifsc_code: 'HDFC0000001',
        payment_terms: 'Net 30',
        status: 'approved',
        license_numbers: 'LIC123456',
        insurance_details: 'Comprehensive Coverage',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        fiscal_year_start: '2024-04-01',
        invoice_prefix: 'INV',
        quote_prefix: 'QT',
        po_prefix: 'PO',
        logo_url: null,
        invoice_template: 'standard',
        enable_e_invoice: 1
      });
      console.log('✅ Created firm: Acme Corporation (ACME)');
    } else {
      console.log('ℹ️  Firm already exists: Acme Corporation (ACME)');
      firm1 = { lastInsertRowid: firm1.id };
    }

    // Create admin user for firm 1
    const hashedPassword1 = await bcrypt.hash('admin123', 12);
    try {
      const admin1 = User.create.run({
        username: 'admin',
        email: 'admin@acme.com',
        fullname: 'Admin User',
        password: hashedPassword1,
        role: 'admin',
        firm_id: firm1.lastInsertRowid,
        status: 'approved'
      });
      console.log('✅ Created admin user: admin@acme.com (password: admin123)');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('ℹ️  Admin user already exists: admin@acme.com');
      } else {
        throw err;
      }
    }

    // Create manager user for firm 1
    const hashedPassword2 = await bcrypt.hash('manager123', 12);
    try {
      const manager1 = User.create.run({
        username: 'manager',
        email: 'manager@acme.com',
        fullname: 'Manager User',
        password: hashedPassword2,
        role: 'manager',
        firm_id: firm1.lastInsertRowid,
        status: 'approved'
      });
      console.log('✅ Created manager user: manager@acme.com (password: manager123)');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('ℹ️  Manager user already exists: manager@acme.com');
      } else {
        throw err;
      }
    }

    // Create regular user for firm 1
    const hashedPassword3 = await bcrypt.hash('user123', 12);
    try {
      const user1 = User.create.run({
        username: 'user',
        email: 'user@acme.com',
        fullname: 'Regular User',
        password: hashedPassword3,
        role: 'user',
        firm_id: firm1.lastInsertRowid,
        status: 'approved'
      });
      console.log('✅ Created regular user: user@acme.com (password: user123)');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('ℹ️  Regular user already exists: user@acme.com');
      } else {
        throw err;
      }
    }

    // Create default firm 2 (pending approval)
    let firm2 = Firm.getByCode.get('BUILD');
    if (!firm2) {
      firm2 = Firm.create.run({
        name: 'BuildTech Industries',
        code: 'BUILD',
        description: 'Modern construction solutions',
        legal_name: 'BuildTech Industries Pvt. Ltd.',
        address: '456 Tech Park',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        pincode: '560001',
        phone_number: '+91-80-1234-5678',
        secondary_phone: '+91-80-1234-5679',
        email: 'info@buildtech.com',
        website: 'www.buildtech.com',
        business_type: 'Construction',
        industry_type: 'Infrastructure',
        establishment_year: 2015,
        employee_count: 100,
        registration_number: 'REG654321',
        registration_date: '2015-06-20',
        cin_number: 'U45200KA2015PTC654321',
        pan_number: 'AABCT1234K',
        gst_number: '29AABCT1234H1Z0',
        tax_id: 'TAX654321',
        vat_number: 'VAT654321',
        bank_account_number: '9876543210123456',
        bank_name: 'ICICI Bank',
        bank_branch: 'Bangalore Main',
        ifsc_code: 'ICIC0000001',
        payment_terms: 'Net 45',
        status: 'pending',
        license_numbers: 'LIC654321',
        insurance_details: 'Standard Coverage',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        fiscal_year_start: '2024-04-01',
        invoice_prefix: 'INV',
        quote_prefix: 'QT',
        po_prefix: 'PO',
        logo_url: null,
        invoice_template: 'standard',
        enable_e_invoice: 0
      });
      console.log('✅ Created firm: BuildTech Industries (BUILD) - PENDING');
    } else {
      console.log('ℹ️  Firm already exists: BuildTech Industries (BUILD)');
      firm2 = { lastInsertRowid: firm2.id };
    }

    // Create admin user for firm 2
    const hashedPassword4 = await bcrypt.hash('build123', 12);
    try {
      const admin2 = User.create.run({
        username: 'buildadmin',
        email: 'admin@buildtech.com',
        fullname: 'Build Admin',
        password: hashedPassword4,
        role: 'admin',
        firm_id: firm2.lastInsertRowid,
        status: 'pending'
      });
      console.log('✅ Created admin user: admin@buildtech.com (password: build123) - PENDING APPROVAL');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('ℹ️  Admin user already exists: admin@buildtech.com');
      } else {
        throw err;
      }
    }

    // Create default firm 3 (approved)
    let firm3 = Firm.getByCode.get('METRO');
    if (!firm3) {
      firm3 = Firm.create.run({
        name: 'Metro Constructions',
        code: 'METRO',
        description: 'Urban development specialists',
        legal_name: 'Metro Constructions Pvt. Ltd.',
        address: '789 Metro Plaza',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        pincode: '110001',
        phone_number: '+91-11-1234-5678',
        secondary_phone: '+91-11-1234-5679',
        email: 'info@metro.com',
        website: 'www.metro.com',
        business_type: 'Construction',
        industry_type: 'Urban Development',
        establishment_year: 2012,
        employee_count: 200,
        registration_number: 'REG789012',
        registration_date: '2012-03-10',
        cin_number: 'U45200DL2012PTC789012',
        pan_number: 'AABCT5678K',
        gst_number: '07AABCT1234H1Z0',
        tax_id: 'TAX789012',
        vat_number: 'VAT789012',
        bank_account_number: '5555555555555555',
        bank_name: 'Axis Bank',
        bank_branch: 'Delhi Main',
        ifsc_code: 'AXIS0000001',
        payment_terms: 'Net 30',
        status: 'approved',
        license_numbers: 'LIC789012',
        insurance_details: 'Premium Coverage',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        fiscal_year_start: '2024-04-01',
        invoice_prefix: 'INV',
        quote_prefix: 'QT',
        po_prefix: 'PO',
        logo_url: null,
        invoice_template: 'standard',
        enable_e_invoice: 1
      });
      console.log('✅ Created firm: Metro Constructions (METRO)');
    } else {
      console.log('ℹ️  Firm already exists: Metro Constructions (METRO)');
      firm3 = { lastInsertRowid: firm3.id };
    }

    // Create admin user for firm 3
    const hashedPassword5 = await bcrypt.hash('metro123', 12);
    try {
      const admin3 = User.create.run({
        username: 'metroadmin',
        email: 'admin@metro.com',
        fullname: 'Metro Admin',
        password: hashedPassword5,
        role: 'admin',
        firm_id: firm3.lastInsertRowid,
        status: 'approved'
      });
      console.log('✅ Created admin user: admin@metro.com (password: metro123)');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('ℹ️  Admin user already exists: admin@metro.com');
      } else {
        throw err;
      }
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Firm: ACME (Approved)');
    console.log('  Admin:   admin@acme.com / admin123');
    console.log('  Manager: manager@acme.com / manager123');
    console.log('  User:    user@acme.com / user123');
    console.log('');
    console.log('Firm: BUILD (Pending Approval)');
    console.log('  Admin:   admin@buildtech.com / build123');
    console.log('  (Cannot login until firm is approved)');
    console.log('');
    console.log('Firm: METRO (Approved)');
    console.log('  Admin:   admin@metro.com / metro123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (err) {
    console.error('❌ Seed failed:', err);
    throw err;
  }
}

// Run seed
seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
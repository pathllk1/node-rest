/**
 * Create Test User with Properly Hashed Password
 * Usage: node server/utils/mongo/create-test-user.js
 */

import 'dotenv/config.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDB } from './mongoose.config.js';
import { User, Firm } from '../../models/index.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function createTestUser() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB');

    // Get or create a test firm
    let firm = await Firm.findOne({ code: 'TEST' });
    if (!firm) {
      firm = await Firm.create({
        name: 'Test Firm',
        code: 'TEST',
        status: 'approved',
      });
      console.log('✅ Created test firm: TEST');
    } else {
      console.log('✅ Using existing test firm: TEST');
    }

    // Define test users to create
    const testUsers = [
      {
        username: 'admin',
        email: 'admin@test.com',
        fullname: 'Admin User',
        plainPassword: 'admin123',
        role: 'admin',
        firm_id: firm._id,
        status: 'approved',
      },
      {
        username: 'manager',
        email: 'manager@test.com',
        fullname: 'Manager User',
        plainPassword: 'manager123',
        role: 'manager',
        firm_id: firm._id,
        status: 'approved',
      },
      {
        username: 'user',
        email: 'user@test.com',
        fullname: 'Regular User',
        plainPassword: 'user123',
        role: 'user',
        firm_id: firm._id,
        status: 'approved',
      },
      {
        username: 'superadmin',
        email: 'superadmin@test.com',
        fullname: 'Super Admin User',
        plainPassword: 'superadmin123',
        role: 'super_admin',
        firm_id: null, // Super admin doesn't belong to a firm
        status: 'approved',
      },
    ];

    // Create each test user
    for (const testUser of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({
          $or: [{ username: testUser.username }, { email: testUser.email }],
        });

        if (existingUser) {
          console.log(
            `ℹ️  User already exists: ${testUser.username} (${testUser.email})`
          );
          continue;
        }

        // Hash the password using bcrypt
        const hashedPassword = await bcrypt.hash(
          testUser.plainPassword,
          BCRYPT_ROUNDS
        );

        // Create the user
        const createdUser = await User.create({
          username: testUser.username,
          email: testUser.email,
          fullname: testUser.fullname,
          password: hashedPassword,
          role: testUser.role,
          firm_id: testUser.firm_id,
          status: testUser.status,
        });

        console.log(`✅ Created user: ${testUser.username}`);
        console.log(`   Email: ${testUser.email}`);
        console.log(`   Password: ${testUser.plainPassword}`);
        console.log(`   Role: ${testUser.role}`);
        console.log(`   Status: approved`);
        console.log('');
      } catch (err) {
        if (err.message.includes('duplicate')) {
          console.log(
            `ℹ️  User already exists: ${testUser.username}`
          );
        } else {
          console.error(`❌ Error creating user ${testUser.username}:`, err.message);
        }
      }
    }

    console.log('🎉 Test user creation complete!');
    console.log('\n📝 Test Credentials:');
    console.log('  Admin:      admin / admin123');
    console.log('  Manager:    manager / manager123');
    console.log('  User:       user / user123');
    console.log('  SuperAdmin: superadmin / superadmin123');
    console.log('\n💡 All passwords are bcrypt hashed with 12 salt rounds');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
createTestUser();

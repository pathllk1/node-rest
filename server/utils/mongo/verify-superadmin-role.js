/**
 * Verify Super Admin User Role
 * Debug script to check if superadmin user has the correct role in the database
 * Usage: node server/utils/mongo/verify-superadmin-role.js
 */

import 'dotenv/config.js';
import mongoose from 'mongoose';
import { connectDB } from './mongoose.config.js';
import { User } from '../../models/index.js';

async function verifySuperAdminRole() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB\n');

    // Find the superadmin user
    console.log('🔍 Looking for superadmin user...');
    const superadmin = await User.findOne({ username: 'superadmin' });

    if (!superadmin) {
      console.log('❌ Superadmin user not found in database');
      process.exit(1);
    }

    console.log('\n📋 Superadmin User Details:');
    console.log('━'.repeat(60));
    console.log('ID:       ', superadmin._id.toString());
    console.log('Username: ', superadmin.username);
    console.log('Email:    ', superadmin.email);
    console.log('Fullname: ', superadmin.fullname);
    console.log('Role:     ', superadmin.role);
    console.log('Status:   ', superadmin.status);
    console.log('━'.repeat(60));

    // Check if role is correct
    if (superadmin.role === 'super_admin') {
      console.log('\n✅ Role is CORRECT: "super_admin"');
    } else if (superadmin.role === 'superadmin') {
      console.log('\n⚠️  Role is INCORRECT: "superadmin" (missing underscore!)');
      console.log('   Should be: "super_admin"');
    } else {
      console.log(`\n❌ Role is WRONG: "${superadmin.role}"`);
      console.log('   Should be: "super_admin"');
    }

    // Check if status is approved
    if (superadmin.status !== 'approved') {
      console.log(`\n⚠️  Status is not approved: "${superadmin.status}"`);
      console.log('   This might prevent authentication!');
    } else {
      console.log('\n✅ Status is approved');
    }

    // Show what will be in the token
    console.log('\n📦 Token Payload Will Include:');
    console.log('━'.repeat(60));
    console.log('role:', superadmin.role);
    console.log('id:  ', superadmin._id.toString());
    console.log('━'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifySuperAdminRole();

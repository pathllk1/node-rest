/**
 * Reset User Password
 * Usage: node server/utils/mongo/reset-password.js username newPassword
 *
 * Example:
 *   node server/utils/mongo/reset-password.js anjan newPasswordHere
 *
 * FIX: Removed the line that printed the plaintext password to the console.
 * Log aggregators (Vercel, CloudWatch, Datadog) would have stored it permanently.
 */

import 'dotenv/config.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectDB } from './mongoose.config.js';
import { User } from '../../models/index.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

async function resetPassword() {
  const [, , username, newPassword] = process.argv;

  if (!username || !newPassword) {
    console.log('❌ Missing arguments');
    console.log('');
    console.log('Usage: node reset-password.js <username> <newPassword>');
    console.log('');
    console.log('Examples:');
    console.log('  node reset-password.js admin newSecurePassword123');
    console.log('  node reset-password.js anjan myNewPassword456');
    console.log('');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      console.log(`❌ User not found: ${username}`);
      process.exit(1);
    }

    console.log(`✓ Found user: ${user.username} (${user.email})`);
    console.log('');

    console.log(`Hashing password with bcrypt (${BCRYPT_ROUNDS} rounds)...`);
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    user.password              = hashedPassword;
    user.failed_login_attempts = 0;
    user.account_locked_until  = null;
    await user.save();

    console.log('');
    console.log('✅ Password Reset Successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Username:  ${user.username}`);
    console.log(`Email:     ${user.email}`);
    console.log(`Full Name: ${user.fullname}`);
    console.log(`Role:      ${user.role}`);
    console.log(`Status:    ${user.status}`);
    // FIX: plaintext password intentionally NOT logged here.
    // "New Password: ${newPassword}" was previously printed and would be
    // captured by any log aggregation service.
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✓ Password hashed with bcrypt and saved');
    console.log('✓ Failed login attempts reset to 0');
    console.log('✓ Account lockout cleared');
    console.log('✓ User can now login with the new password');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

resetPassword();

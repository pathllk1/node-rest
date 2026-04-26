import crypto from 'crypto';
import { TokenBlacklist, RefreshToken, LoginAudit, TokenSessionDevice } from '../../models/index.js';
import User from '../../models/User.model.js'; // FIX: imported for tokens_invalidated_at

/**
 * Add a token to the blacklist (revoke it immediately)
 */
export async function addTokenToBlacklist(user_id, token, expires_at, reason = 'logout') {
  try {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');
    await TokenBlacklist.create({ user_id, token_hash, reason, expires_at });
    console.log(`✅ Token blacklisted for user ${user_id}: ${reason}`);
  } catch (error) {
    console.error('❌ Error blacklisting token:', error.message);
    throw error;
  }
}

/**
 * Check if a token is blacklisted
 * Fails SECURE: if the DB check fails, we treat the token as blacklisted.
 */
export async function isTokenBlacklisted(token) {
  try {
    const token_hash  = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await TokenBlacklist.findOne({ token_hash }).lean();
    return !!blacklisted;
  } catch (error) {
    console.error('❌ Error checking token blacklist:', error.message);
    return true; // Fail secure
  }
}

/**
 * Revoke all refresh tokens for a user AND set the global invalidation timestamp.
 *
 * FIX: Previously only refresh tokens were revoked in the DB. Any live access
 * tokens (up to 15 min remaining) could still be used after "logout all devices".
 * Now we also set User.tokens_invalidated_at, which authMiddleware checks during
 * the refresh path to reject tokens issued before this timestamp.
 *
 * @param {string} user_id - User ObjectId
 * @param {string} reason  - Revocation reason
 */
export async function revokeAllUserTokens(user_id, reason = 'manual-revoke') {
  try {
    // Mark all refresh tokens as revoked
    const result = await RefreshToken.updateMany(
      { user_id, is_revoked: false },
      { $set: { is_revoked: true, revoked_reason: reason, revoked_at: new Date() } }
    );

    // FIX: stamp the User so authMiddleware can invalidate any live access tokens
    // during their next refresh attempt (covers the 15-min access token window)
    await User.findByIdAndUpdate(user_id, { tokens_invalidated_at: new Date() });

    console.log(`✅ Revoked ${result.modifiedCount} token(s) for user ${user_id}: ${reason}`);
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error revoking user tokens:', error.message);
    throw error;
  }
}

/**
 * Revoke all tokens with the same family ID (refresh chain compromise)
 */
export async function revokeTokenFamily(family_id, reason = 'security') {
  try {
    const result = await RefreshToken.updateMany(
      { token_family_id: family_id, is_revoked: false },
      { $set: { is_revoked: true, revoked_reason: reason, revoked_at: new Date() } }
    );
    console.log(`✅ Revoked token family ${family_id} (${result.modifiedCount} tokens): ${reason}`);
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error revoking token family:', error.message);
    throw error;
  }
}

/**
 * Log a login attempt (success or failure)
 */
export async function logLoginAttempt(options) {
  try {
    const {
      user_id,
      status         = 'failed',
      ip_address,
      user_agent     = null,
      device_id      = null,
      failure_reason = null,
      location       = null,
    } = options;

    await LoginAudit.create({
      user_id,
      status,
      ip_address,
      user_agent,
      device_id,
      failure_reason,
      location,
    });
  } catch (error) {
    console.error('❌ Error logging login attempt:', error.message);
    // Never throw — logging must not affect the auth flow
  }
}

/**
 * Get login history for a user (recent logins)
 */
export async function getLoginHistory(user_id, limit = 10) {
  try {
    return await LoginAudit.find({ user_id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('❌ Error fetching login history:', error.message);
    return [];
  }
}

/**
 * Get suspicious login attempts (failed/locked/suspicious) in the last N minutes
 */
export async function getSuspiciousAttempts(user_id, minutes = 15) {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await LoginAudit.find({
      user_id,
      createdAt: { $gte: since },
      status:    { $in: ['failed', 'locked', 'suspicious'] },
    }).lean();
  } catch (error) {
    console.error('❌ Error fetching suspicious attempts:', error.message);
    return [];
  }
}

/**
 * Register or update a device
 */
export async function registerDevice(options) {
  try {
    const {
      user_id,
      device_id,
      device_name     = null,
      device_type     = 'unknown',
      browser         = null,
      os              = null,
      ip_address,
      is_trusted      = false,
      token_family_id = null,
    } = options;

    const existingDevice = await TokenSessionDevice.findOne({ user_id, device_id });

    if (existingDevice) {
      existingDevice.last_used_at    = new Date();
      existingDevice.ip_address      = ip_address;
      existingDevice.token_family_id = token_family_id;
      await existingDevice.save();
      return { created: false, device: existingDevice };
    }

    const newDevice = await TokenSessionDevice.create({
      user_id, device_id, device_name, device_type,
      browser, os, ip_address, is_trusted, token_family_id,
    });
    console.log(`✅ New device registered: ${device_id} for user ${user_id}`);
    return { created: true, device: newDevice };
  } catch (error) {
    console.error('❌ Error registering device:', error.message);
    throw error;
  }
}

/**
 * Get all devices/sessions for a user
 */
export async function getUserSessions(user_id) {
  try {
    return await TokenSessionDevice.find({ user_id })
      .sort({ last_used_at: -1 })
      .lean();
  } catch (error) {
    console.error('❌ Error fetching user sessions:', error.message);
    return [];
  }
}

/**
 * Revoke a specific device/session
 */
export async function revokeDevice(user_id, device_id) {
  try {
    const result = await RefreshToken.updateMany(
      { user_id, device_id, is_revoked: false },
      { $set: { is_revoked: true, revoked_reason: 'device-revoked', revoked_at: new Date() } }
    );
    await TokenSessionDevice.deleteOne({ user_id, device_id });
    console.log(`✅ Device ${device_id} revoked for user ${user_id} (${result.modifiedCount} tokens)`);
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error revoking device:', error.message);
    throw error;
  }
}

/**
 * Mark a device as trusted
 */
export async function trustDevice(user_id, device_id) {
  try {
    const result = await TokenSessionDevice.updateOne(
      { user_id, device_id },
      { $set: { is_trusted: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Device ${device_id} marked as trusted for user ${user_id}`);
    }
    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Error trusting device:', error.message);
    throw error;
  }
}

/**
 * Clean up expired/revoked tokens and blacklist entries.
 * Note: MongoDB TTL indexes on both models handle this automatically,
 * but this function can be called manually for immediate cleanup.
 */
export async function cleanupExpiredTokens() {
  try {
    const now = new Date();

    const refreshResult   = await RefreshToken.deleteMany({ expires_at: { $lt: now } });
    const blacklistResult = await TokenBlacklist.deleteMany({ expires_at: { $lt: now } });

    console.log(
      `🧹 Cleanup: deleted ${refreshResult.deletedCount} expired refresh tokens, ` +
      `${blacklistResult.deletedCount} blacklist entries`
    );

    return {
      deletedRefreshTokens:   refreshResult.deletedCount,
      deletedBlacklistEntries: blacklistResult.deletedCount,
    };
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

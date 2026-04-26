/**
 * Rate Limiting & Brute Force Protection Middleware
 *
 * FIX: Replaced in-memory Map with MongoDB-backed RateLimit model.
 * The previous Map was per-process — on multi-core clusters or Vercel
 * serverless, each worker had its own Map, multiplying the effective
 * attempt budget by worker count. MongoDB gives a single shared store.
 *
 * FIX: Uses req.ip (set correctly by Express when trust proxy is configured)
 * instead of manually reading x-forwarded-for, which could be spoofed by clients.
 */

import RateLimit from '../../models/RateLimit.model.js';

const RATE_LIMIT_ATTEMPTS    = parseInt(process.env.RATE_LIMIT_ATTEMPTS           || '5',  10);
const RATE_LIMIT_WINDOW_MS   = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES     || '15', 10) * 60 * 1000;
const ACCOUNT_LOCK_DURATION_MS = parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES || '15', 10) * 60 * 1000;

/**
 * Get client IP — relies on app.set('trust proxy', 1) in server.js
 * so Express resolves req.ip from X-Forwarded-For correctly and safely.
 */
function getClientIP(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getRateLimitKey(ip) {
  return `login:ip:${ip}`;
}

/* ─────────────────────────────────────────────────────────────────────────
   IP-LEVEL RATE LIMIT MIDDLEWARE
───────────────────────────────────────────────────────────────────────── */

/**
 * Rate limiting middleware for the login endpoint.
 * Limits attempts per IP address using MongoDB for cross-process consistency.
 * Fails OPEN on DB error — degraded rate-limit is better than blocking all logins.
 */
export const loginRateLimit = async (req, res, next) => {
  const ip  = getClientIP(req);
  const key = getRateLimitKey(ip);
  const now = new Date();

  try {
    const entry = await RateLimit.findOne({ key }).lean();

    if (!entry) {
      // First attempt from this IP
      await RateLimit.create({
        key,
        count:         1,
        first_attempt: now,
        locked_until:  null,
        expires_at:    new Date(Date.now() + RATE_LIMIT_WINDOW_MS * 2),
      });
      return next();
    }

    // ── IP is currently locked ────────────────────────────────────────
    if (entry.locked_until && now < entry.locked_until) {
      const remainingMs   = entry.locked_until - now;
      const remainingMins = Math.ceil(remainingMs / 1000 / 60);
      console.warn(`🚫 IP ${ip} is rate-limited. Remaining: ${remainingMins} min`);
      return res.status(429).json({
        success:    false,
        error:      `Too many login attempts. Please try again in ${remainingMins} minute(s).`,
        retryAfter: remainingMs,
      });
    }

    // ── Rate limit window has expired — reset ─────────────────────────
    const windowExpired = (now - new Date(entry.first_attempt)) > RATE_LIMIT_WINDOW_MS;
    if (windowExpired) {
      await RateLimit.updateOne({ key }, {
        $set: {
          count:         1,
          first_attempt: now,
          locked_until:  null,
          expires_at:    new Date(Date.now() + RATE_LIMIT_WINDOW_MS * 2),
        },
      });
      return next();
    }

    // ── Increment counter ─────────────────────────────────────────────
    const newCount = entry.count + 1;

    if (newCount >= RATE_LIMIT_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
      await RateLimit.updateOne({ key }, {
        $set: {
          count:        newCount,
          locked_until: lockedUntil,
          // Extend TTL so the lock record isn't auto-deleted before it expires
          expires_at:   new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS + RATE_LIMIT_WINDOW_MS),
        },
      });
      console.warn(`⚠️ IP ${ip} locked after ${newCount} attempts. Duration: ${ACCOUNT_LOCK_DURATION_MS / 60000} min`);
      return res.status(429).json({
        success:    false,
        error:      `Too many login attempts. Please try again in ${ACCOUNT_LOCK_DURATION_MS / 60000} minute(s).`,
        retryAfter: ACCOUNT_LOCK_DURATION_MS,
      });
    }

    await RateLimit.updateOne({ key }, { $set: { count: newCount } });

    const remaining = RATE_LIMIT_ATTEMPTS - newCount;
    console.log(`⚠️ Login attempt from ${ip}. Remaining before lock: ${remaining}`);
    next();

  } catch (error) {
    // Fail open — a DB outage should not block all logins
    console.error('❌ Rate limit DB check failed, failing open:', error.message);
    next();
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   PER-ACCOUNT LOCKOUT (stored in User document — unchanged)
───────────────────────────────────────────────────────────────────────── */

/**
 * Throws if the user account is currently locked.
 * Clears the lock if the lock period has already expired.
 */
export const checkAccountLockout = async (User, user) => {
  if (!user) return null;

  const now = new Date();

  if (user.account_locked_until && user.account_locked_until > now) {
    const remainingMs   = user.account_locked_until - now;
    const remainingMins = Math.ceil(remainingMs / 1000 / 60);
    console.warn(`🔒 Account ${user.username} is locked. Remaining: ${remainingMins} min`);
    throw new Error(`Account is temporarily locked. Please try again in ${remainingMins} minute(s).`);
  }

  // Lock period has expired — clean up
  if (user.account_locked_until && user.account_locked_until <= now) {
    user.failed_login_attempts = 0;
    user.account_locked_until  = null;
    await user.save();
  }

  return user;
};

/**
 * Record a failed login attempt against the user account.
 * Locks the account after MAX_FAILED_ATTEMPTS consecutive failures.
 */
export const recordFailedAttempt = async (User, user) => {
  if (!user) return;

  user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;

  const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS || '3', 10);

  if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
    user.account_locked_until = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
    console.warn(
      `🔒 Account ${user.username} locked after ${user.failed_login_attempts} failed attempts. ` +
      `Duration: ${ACCOUNT_LOCK_DURATION_MS / 60000} min`
    );
  }

  await user.save();
};

/**
 * Reset failed attempt counter on successful login.
 */
export const resetFailedAttempts = async (user) => {
  if (user.failed_login_attempts > 0 || user.account_locked_until) {
    user.failed_login_attempts = 0;
    user.account_locked_until  = null;
    await user.save();
  }
};

/**
 * No-op: MongoDB TTL index on RateLimit.expires_at handles cleanup automatically.
 * Kept for API compatibility — the server.js setInterval call is harmless.
 */
export const cleanupRateLimitEntries = () => {
  // MongoDB TTL index handles this automatically.
};

/**
 * Get rate limit status for an IP (monitoring / debug).
 */
export const getRateLimitStatus = async (ip) => {
  const key = getRateLimitKey(ip);
  try {
    const entry = await RateLimit.findOne({ key }).lean();
    if (!entry) return { limited: false, attempts: 0 };

    const now      = new Date();
    const isLocked = entry.locked_until && now < entry.locked_until;
    return {
      limited:          !!isLocked,
      attempts:         entry.count,
      lockedUntil:      entry.locked_until,
      remainingLockMs:  isLocked ? entry.locked_until - now : 0,
    };
  } catch {
    return { limited: false, attempts: 0 };
  }
};

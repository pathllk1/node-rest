import crypto from 'crypto';
import mongoose from 'mongoose';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from '../../utils/mongo/tokenUtils.js';
import { isTokenBlacklisted } from '../../utils/mongo/tokenRevocationUtils.js';
import { RefreshToken } from '../../models/index.js';
import User from '../../models/User.model.js';  // FIX: added for tokens_invalidated_at check

const ACCESS_LIFE_MS = 15 * 60 * 1000; // 15 minutes

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

/** SHA-256 hash a raw token string — matches how tokens are stored at login */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Write the new access token + expiry into response cookies */
function setAccessCookies(res, newAccessToken) {
  const newExpiryTimestamp = Date.now() + ACCESS_LIFE_MS;
  
  // For cross-site cookies (different domains), use sameSite: 'none' + secure: true
  // For same-site cookies (same domain), use sameSite: 'lax'
  const sameSitePolicy = process.env.COOKIE_SAMESITE || 'lax';
  const isSecure = process.env.NODE_ENV === 'production' || sameSitePolicy === 'none';

  res.cookie('accessToken', newAccessToken, {
    httpOnly: true,
    secure:   isSecure,
    sameSite: sameSitePolicy,
    maxAge:   ACCESS_LIFE_MS,
  });

  res.cookie('tokenExpiry', newExpiryTimestamp.toString(), {
    httpOnly: false,
    sameSite: sameSitePolicy,
    secure:   isSecure,
    maxAge:   ACCESS_LIFE_MS,
  });
}

/** Clear both auth cookies and return a 401 */
function clearAndReject(res, message = 'Session expired, please login again') {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('tokenExpiry');
  return res.status(401).json({ success: false, message });
}

/* ─────────────────────────────────────────────────────────────────────────
   authMiddleware — protect routes that require a valid session
───────────────────────────────────────────────────────────────────────── */

export const authMiddleware = async (req, res, next) => {
  try {
    const accessToken  = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    // ── No tokens at all ──────────────────────────────────────────────
    if (!accessToken && !refreshToken) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // ── Try access token first ────────────────────────────────────────
    if (accessToken) {
      try {
        // Check if access token is blacklisted (covers logout + logout-all)
        if (await isTokenBlacklisted(accessToken)) {
          console.warn('🚫 Access token is blacklisted');
          return clearAndReject(res, 'Your session has been invalidated. Please login again.');
        }

        const decoded = verifyAccessToken(accessToken);

        // Token type validation — prevents token substitution attack
        // (verifyAccessToken already checks this, but belt-and-braces)
        if (decoded.type !== 'access') {
          console.warn('⚠️ Invalid token type in access token');
          return clearAndReject(res, 'Invalid token');
        }

        req.user = decoded;
        return next();
      } catch (error) {
        // Access token missing, invalid, or expired — fall through to refresh flow
        console.log('ℹ️ Access token invalid/expired, attempting refresh...');
      }
    }

    // ── No refresh token to fall back on ─────────────────────────────
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    // ── Check if refresh token is blacklisted ────────────────────────
    if (await isTokenBlacklisted(refreshToken)) {
      console.warn('🚫 Refresh token is blacklisted');
      return clearAndReject(res, 'Session has been revoked. Please login again.');
    }

    // ── Verify refresh token signature ────────────────────────────────
    let refreshDecoded;
    try {
      refreshDecoded = verifyRefreshToken(refreshToken);

      // Token type validation
      if (refreshDecoded.type !== 'refresh') {
        console.warn('⚠️ Invalid token type in refresh token');
        return clearAndReject(res, 'Invalid token');
      }
    } catch (error) {
      console.warn('⚠️ Refresh token verification failed:', error.message);
      return clearAndReject(res);
    }

    // ── DB cross-check: token hash must exist and not be expired/revoked ──
    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({
      user_id:    new mongoose.Types.ObjectId(refreshDecoded.id),
      token_hash: tokenHash,
    }).lean();

    if (!storedToken) {
      // Token was rotated, deleted, or never stored — likely a replay attack
      console.warn('🚫 Refresh token not found in DB (possible replay attack)');
      return clearAndReject(res, 'Invalid session, please login again');
    }

    // Check if token is revoked
    if (storedToken.is_revoked) {
      console.warn(`🚫 Refresh token is revoked: ${storedToken.revoked_reason}`);
      return clearAndReject(res, 'Session has been revoked. Please login again.');
    }

    // Check token expiration
    if (new Date(storedToken.expires_at) < new Date()) {
      console.log('ℹ️ Refresh token has expired in DB');
      return clearAndReject(res);
    }

    // ── Token Family Validation (detect compromised refresh chains) ───
    if (storedToken.token_family_id && storedToken.token_family_id !== refreshDecoded.family_id) {
      console.warn(
        `🚨 SECURITY: Token family mismatch! Expected ${storedToken.token_family_id}, ` +
        `got ${refreshDecoded.family_id}. Possible token theft detected.`
      );
      try {
        await RefreshToken.updateMany(
          { token_family_id: storedToken.token_family_id },
          { $set: { is_revoked: true, revoked_reason: 'security_family_mismatch', revoked_at: new Date() } }
        );
        console.warn('🔒 Entire token family revoked due to security breach');
      } catch (error) {
        console.error('❌ Failed to revoke token family:', error.message);
      }
      return clearAndReject(res, 'Security violation detected. Please login again.');
    }

    // ── FIX: Check global token invalidation timestamp ────────────────
    // revokeAllUserTokens() (logout-all-devices) sets tokens_invalidated_at on the User.
    // Any refresh token issued BEFORE that timestamp must be rejected, even if the
    // DB record hasn't been marked revoked yet (race condition protection).
    const userDoc = await User.findById(refreshDecoded.id)
      .select('status tokens_invalidated_at')
      .lean();

    if (!userDoc) {
      console.warn('🚫 User not found during token refresh');
      return clearAndReject(res, 'User not found. Please login again.');
    }

    // Check if account is still active
    if (userDoc.status !== 'approved') {
      console.warn(`🚫 User ${refreshDecoded.id} account is no longer approved`);
      return clearAndReject(res, 'Account access revoked. Please contact your administrator.');
    }

    // Check global invalidation: token was issued before the revoke-all timestamp
    if (
      userDoc.tokens_invalidated_at &&
      new Date(storedToken.createdAt) < new Date(userDoc.tokens_invalidated_at)
    ) {
      console.warn(`🚫 Token issued before global invalidation for user ${refreshDecoded.id}`);
      return clearAndReject(res, 'Session invalidated. Please login again.');
    }

    // ── Issue new access token ────────────────────────────────────────;

    const newAccessToken = generateAccessToken({
      id:        refreshDecoded.id,
      username:  refreshDecoded.username,
      email:     refreshDecoded.email,
      role:      refreshDecoded.role,
      firm_id:   refreshDecoded.firm_id,
      device_id: refreshDecoded.device_id,
      family_id: refreshDecoded.family_id,
    });

    setAccessCookies(res, newAccessToken);

    req.user           = refreshDecoded;
    req.tokenRefreshed = true;

    return next();

  } catch (error) {
    console.error('❌ authMiddleware error:', error);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   optionalAuth — attach user if valid access token present, never block
───────────────────────────────────────────────────────────────────────── */

export const optionalAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (accessToken) {
      try {
        if (await isTokenBlacklisted(accessToken)) {
          req.user = null;
          return next();
        }
        const decoded = verifyAccessToken(accessToken);
        req.user = decoded.type === 'access' ? decoded : null;
      } catch {
        req.user = null;
      }
    }
  } catch {
    // swallow — optional auth must never block
  }
  next();
};

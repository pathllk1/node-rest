/**
 * Token Utility - Enhanced with HS256/HS512
 * JWT generation and verification with explicit algorithm support.
 * Uses HMAC SHA-256 for access tokens and HMAC SHA-512 for refresh tokens.
 */

import jwt from 'jsonwebtoken';
import 'dotenv/config';

const ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error('❌ ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in .env');
}

// Validate secret key length (should be 256+ bits = 32+ bytes)
if (ACCESS_TOKEN_SECRET.length < 32) {
  console.warn('⚠️ ACCESS_TOKEN_SECRET is less than 256-bit. For production, use at least 32 bytes.');
}
if (REFRESH_TOKEN_SECRET.length < 32) {
  console.warn('⚠️ REFRESH_TOKEN_SECRET is less than 256-bit. For production, use at least 32 bytes.');
}

const ACCESS_TOKEN_EXPIRY  = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d';  // 30 days

/**
 * Generate a short-lived access token (HS256)
 * @param {Object} payload
 * @returns {string}
 */
export function generateAccessToken(payload) {
  return jwt.sign(
    {
      ...payload,
      type: 'access', // Prevent token substitution attacks
    },
    ACCESS_TOKEN_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRY,
    }
  );
}

/**
 * Generate a long-lived refresh token (HS512)
 * @param {Object} payload
 * @returns {string}
 */
export function generateRefreshToken(payload) {
  return jwt.sign(
    {
      ...payload,
      type: 'refresh', // Prevent token substitution attacks
    },
    REFRESH_TOKEN_SECRET,
    {
      algorithm: 'HS512',
      expiresIn: REFRESH_TOKEN_EXPIRY,
    }
  );
}

/**
 * Verify an access token — throws on invalid/expired
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
    algorithms: ['HS256'], // Accept only HS256
  });

  // Verify token type to prevent substitution attacks
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }

  return decoded;
}

/**
 * Verify a refresh token — throws on invalid/expired
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
    algorithms: ['HS512'], // Accept only HS512
  });

  // Verify token type to prevent substitution attacks
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }

  return decoded;
}

/**
 * Generate both tokens at once for a user document
 * @param {{ _id, username, email, role, firm_id }} user - Mongoose user doc (or plain object)
 * @param {Object} options - Optional { device_id, family_id }
 * @returns {{ accessToken: string, refreshToken: string }}
 */
export function generateTokenPair(user, options = {}) {
  const payload = {
    id:        user._id ?? user.id,
    username:  user.username,
    email:     user.email,
    role:      user.role,
    firm_id:   user.firm_id ?? null,
  };

  // Add optional fields
  if (options.device_id) {
    payload.device_id = options.device_id;
  }
  if (options.family_id) {
    payload.family_id = options.family_id;
  }

  return {
    accessToken:  generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}


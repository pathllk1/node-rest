import { generateCSRFToken, getCSRFTokenFromRequest } from '../utils/csrfUtils.js';
import crypto from 'crypto';

/**
 * Middleware to generate CSRF token if not present
 * Sets token in non-httpOnly cookie accessible to JS
 */
export const csrfGenerateToken = (req, res, next) => {
  try {
    // Check if token already exists in cookie
    let csrfToken = req.cookies.csrfToken;
    
    if (!csrfToken) {
      // Generate new CSRF token
      csrfToken = generateCSRFToken();
      
      // Set token in non-httpOnly cookie so JavaScript can read it
      // For cross-site cookies (different domains), use sameSite: 'none' + secure: true
      const sameSitePolicy = process.env.COOKIE_SAMESITE || 'lax';
      const isSecure = process.env.NODE_ENV === 'production' || sameSitePolicy === 'none';
      
      res.cookie('csrfToken', csrfToken, {
        httpOnly: false, // Allow JS to read this
        secure: isSecure,
        sameSite: sameSitePolicy,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }
    
    next();
  } catch (error) {
    console.error('[CSRF_GENERATE_ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'CSRF token generation failed'
    });
  }
};

/**
 * Middleware to validate CSRF token on state-changing requests
 * Skips GET, HEAD, OPTIONS requests
 * Requires valid CSRF token for POST, PUT, DELETE, PATCH
 * Uses timing-safe comparison to prevent timing attacks
 */
export const csrfValidateToken = (req, res, next) => {
  try {
    // Skip validation for safe HTTP methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Skip validation for login/register endpoints (user doesn't have CSRF token yet)
    if (req.path === '/api/auth/login' || req.path === '/api/auth/register') {
      return next();
    }

    // Get CSRF token from request (header or body)
    const clientToken = getCSRFTokenFromRequest(req);
    
    if (!clientToken) {
      console.warn('[CSRF_VALIDATE] ❌ CSRF token missing for', req.path);
      return res.status(403).json({
        success: false,
        message: 'CSRF token missing'
      });
    }
    
    // Get stored token from cookie
    const storedToken = req.cookies.csrfToken;
    
    if (!storedToken) {
      console.warn('[CSRF_VALIDATE] ❌ CSRF token not found in session');
      return res.status(403).json({
        success: false,
        message: 'CSRF token not found in session'
      });
    }
    
    // Verify token with timing-safe comparison to prevent timing attacks
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(clientToken),
        Buffer.from(storedToken)
      );
      
      if (!isValid) {
        console.warn('[CSRF_VALIDATE] ❌ CSRF token mismatch');
        return res.status(403).json({
          success: false,
          message: 'Invalid CSRF token'
        });
      }
    } catch (error) {
      // timingSafeEqual throws if buffer lengths differ
      console.warn('[CSRF_VALIDATE] ❌ CSRF token comparison error:', error.message);
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token'
      });
    }

    next();
  } catch (error) {
    console.error('[CSRF_VALIDATION_ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'CSRF validation error'
    });
  }
};

/**
 * Middleware to refresh CSRF token (optional, for extra security after sensitive operations)
 */
export const csrfRefreshToken = (req, res, next) => {
  try {
    const newCSRFToken = generateCSRFToken();
    
    // For cross-site cookies (different domains), use sameSite: 'none' + secure: true
    const sameSitePolicy = process.env.COOKIE_SAMESITE || 'lax';
    const isSecure = process.env.NODE_ENV === 'production' || sameSitePolicy === 'none';
    
    res.cookie('csrfToken', newCSRFToken, {
      httpOnly: false,
      secure: isSecure,
      sameSite: sameSitePolicy,
      maxAge: 24 * 60 * 60 * 1000
    });
    
    next();
  } catch (error) {
    console.error('[CSRF_REFRESH_ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'CSRF token refresh failed'
    });
  }
};

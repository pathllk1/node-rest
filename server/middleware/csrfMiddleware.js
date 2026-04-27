/**
 * CSRF Middleware - Updated for Bearer Token / JWT-bound CSRF
 * 
 * This new system does NOT use cookies.
 * Instead, the CSRF token is embedded in the JWT (accessToken).
 * The client must send the same CSRF token in the X-CSRF-Token header.
 * 
 * Note: Actual validation now happens in authMiddleware for authenticated routes.
 * This middleware remains for backward compatibility or for routes that 
 * want explicit CSRF check without full auth (though rare in this setup).
 */

import { getCSRFTokenFromRequest } from '../utils/csrfUtils.js';

/**
 * Middleware to generate CSRF token
 * @deprecated - CSRF tokens are now generated during login/token-refresh and embedded in JWT
 */
export const csrfGenerateToken = (req, res, next) => {
  // If user is authenticated, we could send the token in a header for convenience
  if (req.user && req.user.csrf_token) {
    res.setHeader('X-CSRF-Token', req.user.csrf_token);
  }
  next();
};

/**
 * Middleware to validate CSRF token on state-changing requests
 * This is a secondary check. Primary check is in authMiddleware.
 */
export const csrfValidateToken = (req, res, next) => {
  const method = req.method;
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!stateChangingMethods.includes(method)) {
    return next();
  }

  // Skip for public routes that don't have JWT yet
  const publicRoutes = ['/api/auth/login', '/api/auth/register'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // If authMiddleware already ran, it already validated CSRF.
  // We can check if req.user exists and has been validated.
  if (req.user && req.user.csrf_token) {
    const clientToken = getCSRFTokenFromRequest(req);
    if (!clientToken || clientToken !== req.user.csrf_token) {
      console.warn('[CSRF] ❌ Secondary validation failed');
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token',
        code: 'CSRF_ERROR'
      });
    }
  }

  next();
};

export const csrfRefreshToken = (req, res, next) => {
  // CSRF tokens are rotated when the JWT is refreshed.
  next();
};

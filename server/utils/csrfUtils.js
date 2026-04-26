import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32; // 32 bytes = 256 bits

/**
 * Generate a new CSRF token
 * @returns {string} Random hex-encoded CSRF token
 */
export const generateCSRFToken = () => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * Extract CSRF token from request
 * Checks header first, then body
 * @param {Object} req - Express request object
 * @returns {string|null} CSRF token or null
 */
export const getCSRFTokenFromRequest = (req) => {
  // Check X-CSRF-Token header (preferred for API requests)
  if (req.headers['x-csrf-token']) {
    return req.headers['x-csrf-token'];
  }
  
  // Fallback to form body (for form submissions)
  if (req.body && req.body._csrf) {
    return req.body._csrf;
  }
  
  return null;
};

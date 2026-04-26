/**
 * auth.js — Role & Firm Guard Middleware
 *
 * IMPORTANT: authenticateJWT has been removed from this file.
 * It was broken — it used bcrypt.compare() against SHA-256 hashes (always false),
 * never set the refreshed access token cookie, and manually faked the exp field.
 *
 * Use authMiddleware from authMiddleware.js for ALL route protection.
 * This file only exports role/firm guard helpers that do NOT touch tokens.
 */

/**
 * Middleware to check if user has a specific role.
 * Must be used AFTER authMiddleware.
 * @param {string|string[]} requiredRoles
 */
export function requireRole(requiredRoles) {
  if (!Array.isArray(requiredRoles)) requiredRoles = [requiredRoles];

  return (req, res, next) => {
    console.log('[requireRole DEBUG]', {
      hasReqUser:    !!req.user,
      userRole:      req.user?.role ?? null,
      requiredRoles,
      match:         req.user ? requiredRoles.includes(req.user.role) : false,
    });

    if (!req.user) {
      console.warn('⚠️ [requireRole] No req.user — authMiddleware may not be applied.');
      return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }

    if (!requiredRoles.includes(req.user.role)) {
      console.warn(
        `⚠️ [requireRole] Role mismatch: user="${req.user.role}" ` +
        `not in required=[${requiredRoles.join(', ')}]`
      );
      return res.status(403).json({ error: 'You are not permitted to perform this action' });
    }

    next();
  };
}

/**
 * Middleware to restrict access to a specific firm.
 * Must be used AFTER authMiddleware.
 * @param {string} firmId
 */
export const requireFirm = (firmId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (req.user.firm_id !== firmId) {
      return res.status(403).json({ success: false, error: 'Access denied. Wrong firm.' });
    }
    next();
  };
};

/**
 * Middleware to allow admins (any firm) or same-firm users.
 * Must be used AFTER authMiddleware.
 */
export const requireSameFirmOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Admins bypass firm check
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    return next();
  }

  const targetFirmId = req.params.firm_id || req.body.firm_id || req.query.firm_id;

  if (req.user.firm_id !== targetFirmId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You can only access data from your firm.',
    });
  }

  next();
};

/**
 * Security Headers Middleware
 * FIX: HSTS is now enabled automatically in production (was commented out).
 * It will only fire when NODE_ENV=production, so local dev is unaffected.
 */

export const securityMiddleware = (req, res, next) => {
  // CSP disabled to resolve production connection issues
  /*
  res.setHeader(
    'Content-Security-Policy',
    ...
  );
  */

  // ── XSS Protection (legacy browsers) ─────────────────────────────
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // ── Prevent MIME type sniffing ────────────────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // ── Clickjacking protection ───────────────────────────────────────
  res.setHeader('X-Frame-Options', 'DENY');

  // ── HSTS — enabled in production, skipped in dev/test ────────────
  // FIX: previously commented out. Now auto-enabled when NODE_ENV=production.
  // 1 year max-age, all subdomains, preload-ready.
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ── Referrer Policy ───────────────────────────────────────────────
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── Permissions Policy (disable unused browser features) ─────────
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  next();
};

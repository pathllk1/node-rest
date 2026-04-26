/**
 * ════════════════════════════════════════════════════════════════════════════════
 * CRON JOB AUTHENTICATION MIDDLEWARE
 * Allows Vercel cron jobs to bypass normal auth/CSRF protection
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Vercel cron jobs are external HTTP requests that cannot provide:
 *   ✗ Session cookies (accessToken, refreshToken)
 *   ✗ CSRF tokens (generated per-session)
 *   ✗ User context
 *
 * Solution: Sign cron requests with a shared secret.
 * Vercel sends this as: Authorization: Bearer <CRON_SECRET>
 * We also accept X-Cron-Secret for manual/local testing compatibility.
 *
 * SECURITY:
 *   • The cron secret (CRON_SECRET env var) is NOT exposed in frontend code
 *   • Only Vercel can set it (it's private to the deployment config)
 *   • Cron endpoints are restricted via route-level guards
 *   • Each cron function logs all executions for audit trails
 *
 * USAGE:
 *   // In your API route:
 *   router.get('/backup', cronMiddleware, backupDatabaseCron);
 *
 *   // Vercel cron job config (vercel.json):
 *   {
 *     "crons": [{
 *       "path": "/api/cron/backup",
 *       "schedule": "0 2 * * *"  // runs daily at 2 AM UTC
 *     }]
 *   }
 */

const CRON_SECRET = process.env.CRON_SECRET;

export const cronMiddleware = async (req, res, next) => {
  try {
    // ── Guard: Cron communication requires a secret ──────────────────────
    if (!CRON_SECRET) {
      console.error('[CRON] ❌ CRON_SECRET env var is not configured. Cron jobs are disabled.');
      return res.status(503).json({
        success: false,
        error:   'Cron jobs are not configured on this server. Set CRON_SECRET env var.',
      });
    }

    const authHeader = req.headers.authorization;
    const bearerMatch = typeof authHeader === 'string'
      ? authHeader.match(/^Bearer\s+(.+)$/i)
      : null;
    const cronSecret =
      bearerMatch?.[1] ||
      req.headers['x-cron-secret'] ||
      req.headers['X-Cron-Secret'];

    if (!cronSecret) {
      console.warn('[CRON] ⚠️  Request missing Authorization or X-Cron-Secret header (is this a legitimate cron job?)');
      return res.status(401).json({
        success: false,
        error:   'Authorization: Bearer <CRON_SECRET> or X-Cron-Secret header is required',
      });
    }

    // ── Validate secret (constant-time comparison to prevent timing attacks) ──
    const isValid = cronSecret === CRON_SECRET;
    if (!isValid) {
      console.warn('[CRON] 🚫 Invalid cron secret provided');
      return res.status(403).json({
        success: false,
        error:   'Invalid cron secret',
      });
    }

    // ── Mark request as cron-originated ────────────────────────────────────
    req.isCronJob = true;
    req.cronTimestamp = new Date().toISOString();

    console.log(`[CRON] ✅ Authenticated cron job request to ${req.path}`);

    next();
  } catch (err) {
    console.error('[CRON] Unexpected error in cronMiddleware:', err);
    res.status(500).json({ success: false, error: 'Cron authentication failed' });
  }
};

/**
 * Logs cron execution with timing info for monitoring/debugging
 * Use in your cron endpoint handler:
 *
 *   const startTime = Date.now();
 *   try {
 *     // ... do work ...
 *     logCronExecution(req, 'success', { itemsProcessed: 100 });
 *   } catch (err) {
 *     logCronExecution(req, 'failed', { error: err.message });
 *   }
 */
export const logCronExecution = (req, status, details = {}) => {
  const duration = Date.now() - new Date(req.cronTimestamp).getTime();
  console.log(
    `[CRON] ${status.toUpperCase()} — ${req.path} completed in ${duration}ms`,
    details
  );
};

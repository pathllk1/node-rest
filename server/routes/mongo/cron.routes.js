/**
 * ════════════════════════════════════════════════════════════════════════════════
 * CRON JOB ROUTES
 * Scheduled tasks that run on Vercel via cron jobs
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * All routes in this file:
 *   • Require Authorization: Bearer <CRON_SECRET> (or X-Cron-Secret for manual tests)
 *   • Bypass normal auth + CSRF checks (cron uses header-based auth instead)
 *   • Log execution time and results
 *   • Return structured JSON responses for monitoring
 */

import express from 'express';
import { cronMiddleware, logCronExecution } from '../../middleware/mongo/cronMiddleware.js';
import { backupDatabaseCron } from '../../controllers/mongo/database.controller.js';

const router = express.Router();

// All cron routes require cron authentication
router.use(cronMiddleware);

/**
 * GET /api/cron/backup
 * Vercel Cron Job: Daily database backup
 *
 * Vercel will call this every day at the configured time with:
 *   GET /api/cron/backup
 *   Authorization: Bearer <CRON_SECRET env var>
 *
 * Schedule in vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/cron/backup",
 *       "schedule": "0 2 * * *"  // daily at 2 AM UTC
 *     }]
 *   }
 */
const runBackup = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('[CRON] Starting daily database backup...');

    // Call the cron-aware backup controller
    // (same backup logic, but without role-based auth check)
    await backupDatabaseCron(req, res);

    const duration = Date.now() - startTime;
    const status = res.statusCode;
    if (status >= 200 && status < 300) {
      logCronExecution(req, 'success', { durationMs: duration, statusCode: status });
    } else {
      logCronExecution(req, 'failed', { durationMs: duration, statusCode: status });
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[CRON] Backup failed:', err);
    logCronExecution(req, 'failed', {
      error: err.message,
      durationMs: duration,
    });

    // Only respond if not already sent (backupDatabaseCron might have sent a response)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error:   'Cron backup failed',
        details: err.message,
      });
    }
  }
};

router.get('/backup', runBackup);
router.post('/backup', runBackup);

export default router;

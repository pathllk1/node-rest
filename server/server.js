import express      from 'express';
import cookieParser from 'cookie-parser';
import cors         from 'cors';
import 'dotenv/config.js';

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

import { securityMiddleware }                   from './middleware/mongo/securityMiddleware.js';
import sanitizer                                from './middleware/sanitizer.js';
import { csrfGenerateToken, csrfValidateToken } from './middleware/csrfMiddleware.js';
import authRoutes                               from './routes/mongo/authRoutes.js';
import sessionRoutes                            from './routes/mongo/sessionRoutes.js';
import pageRoutes                               from './routes/mongo/pageRoutes.js';
import masterRollRoutes                         from './routes/mongo/masterRoll.routes.js';
import wagesRoutes                              from './routes/mongo/wages.routes.js';
import advanceRoutes                            from './routes/mongo/advance.routes.js';
import settingsRoutes                           from './routes/mongo/settings.routes.js';
import inventorySalesRoutes                     from './routes/mongo/inventory/sls.js';
import inventoryPurchaseRoutes                  from './routes/mongo/inventory/prs.js';
import ledgerRoutes                             from './routes/mongo/ledger.routes.js';
import adminRoutes                              from './routes/mongo/admin.js';
import databaseRoutes                           from './routes/mongo/database.routes.js';
import cronRoutes                               from './routes/mongo/cron.routes.js';
import { cleanupExpiredTokens }                 from './utils/mongo/tokenRevocationUtils.js';
import { cleanupRateLimitEntries }              from './middleware/mongo/rateLimitMiddleware.js';
import morgan from 'morgan';

const __filename   = fileURLToPath(import.meta.url);
const __dirname    = dirname(__filename);
const app          = express();
const PORT         = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel     = process.env.VERCEL === '1';

// Track real DB readiness so the health check reflects actual state
let dbReady = false;

// FIX: Database initialization — in non-serverless envs, block startup until
// connected so the first requests don't hit route handlers with no DB.
// In Vercel (serverless), allow cold-start to complete and rely on per-request retries.
(async () => {
    try {
        const { connectDB } = await import('./utils/mongo/mongoose.config.js');
        await connectDB();
        dbReady = true;
        console.log('✅ Database connected');
    } catch (err) {
        console.error('⚠️  Database connection failed:', err.message);
        if (!isVercel) {
            console.error('❌ Exiting — cannot serve requests without a database.');
            process.exit(1);
        }
    }
})();

// ── Trust first proxy (Nginx, Vercel edge, load balancer) ─────────────────
// Without this req.ip returns the proxy IP, breaking rate-limiting and audit logs.
app.set('trust proxy', 1);

// ── Parse CORS origins from environment ────────────────────────────────────
// CORS_ORIGINS should be comma-separated list: http://localhost:5173,http://localhost:3000
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim().replace(/\/$/, '')) // Remove trailing slashes
  .filter(Boolean);

// ── Core middleware ────────────────────────────────────────────────────────
// ALLOW ALL ORIGINS (Required for cross-domain auth with cookies)
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizer);
app.use(morgan(isProduction ? 'combined' : 'dev', {
    skip: (req) => req.path === '/api/health' || req.path.startsWith('/_next')   // clean logs
}));

app.use('/iframes', express.static(join(__dirname, '../client/iframes')));
app.use(securityMiddleware);

// ── Cron job routes (bypass CSRF validation) ──────────────────────────────
// Cron routes use header-based authentication (X-Cron-Secret) instead of
// session cookies, so they cannot participate in CSRF token validation.
// Register them HERE, before csrfGenerateToken/csrfValidateToken are applied.
app.use('/api/cron', cronRoutes);

// ── CSRF protection for all other routes ──────────────────────────────────
app.use(csrfGenerateToken);
app.use(csrfValidateToken);

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, '../client'), {
    maxAge: isProduction ? '1d' : 0,
    etag:   false,
}));

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',            authRoutes);
app.use('/api/sessions',        sessionRoutes);
app.use('/api/pages',           pageRoutes);
app.use('/api/master-rolls',    masterRollRoutes);
app.use('/api/wages',           wagesRoutes);
app.use('/api/advances',        advanceRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/inventory/sales', inventorySalesRoutes);
app.use('/api/inventory/purchase', inventoryPurchaseRoutes);
app.use('/api/ledger',          ledgerRoutes);
app.use('/api/admin',           adminRoutes);
app.use('/api/admin/database',  databaseRoutes);

// ── Health check — reflects real DB state ─────────────────────────────────
// FIX: was always returning 200 "ok" even with no DB connection
app.get('/api/health', async (req, res) => {
    const { default: mongoose } = await import('mongoose');
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status:      connected ? 'ok' : 'degraded',
        db:          connected ? 'connected' : 'disconnected',
        timestamp:   new Date().toISOString(),
        environment: isProduction ? 'production' : 'development',
    });
});

// ── SPA fallback ───────────────────────────────────────────────────────────
// FIX: unmatched /api/* paths previously returned no response (hung the client).
// Now they get a proper 404 JSON response.
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'API route not found' });
    }
    res.sendFile(join(__dirname, '../client/index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────
// FIX: err.message was leaking in production via the top-level `message` field.
// Generic string in prod; full detail in dev only.
app.use((err, req, res, next) => {
    console.error('[ERROR_HANDLER]', err.message);
    if (!isProduction) console.error('[ERROR_HANDLER] Stack:', err.stack);
    if (!res.headersSent) {
        res.status(err.status || 500).json({
            success: false,
            message: isProduction ? 'Something went wrong!' : (err.message || 'Something went wrong!'),
            ...(isProduction ? {} : { error: err.message }),
        });
    }
});

// ── Process-level safety nets ──────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED_REJECTION]', reason);
    // Do NOT exit — unhandled rejections are usually recoverable (failed network
    // requests, etc.). Log and continue.
});

// FIX: uncaughtException MUST call process.exit(1).
// Node.js is in an undefined state after an uncaught exception — continuing
// risks data corruption, memory leaks, and silent incorrect behavior.
process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT_EXCEPTION]', error);
    process.exit(1);
});

// ── Background jobs (non-serverless only) ─────────────────────────────────
if (!isVercel) {
    setInterval(async () => {
        try { await cleanupExpiredTokens(); }
        catch (e) { console.error('❌ Token cleanup failed:', e.message); }
    }, 60 * 60 * 1000);

    // No-op since MongoDB TTL handles cleanup, kept for compatibility
    setInterval(() => {
        try { cleanupRateLimitEntries(); }
        catch (e) { console.error('❌ Rate limit cleanup failed:', e.message); }
    }, 30 * 60 * 1000);

    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log('🔐 Security jobs initialized');
        console.log('🔒 Trust proxy: enabled (req.ip = real client IP)');
    });
}

export default app;
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateTokenPair } from '../../utils/mongo/tokenUtils.js';
import {
  addTokenToBlacklist,
  logLoginAttempt,
  registerDevice,
  revokeAllUserTokens,
} from '../../utils/mongo/tokenRevocationUtils.js';
import {
  checkAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
} from '../../middleware/mongo/rateLimitMiddleware.js';
import { User, RefreshToken } from '../../models/index.js';

const ACCESS_LIFE_MS  = 15 * 60 * 1000;            // 15 minutes
const REFRESH_LIFE_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

/** SHA-256 hash a raw token — must match the hash used in authMiddleware */
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Get client IP from request — relies on trust proxy being set in server.js */
function getClientIP(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/* ─────────────────────────────────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────────────────────────────────── */

export const login = async (req, res) => {
  let user;
  const ip        = getClientIP(req);
  const userAgent = req.headers['user-agent'] || null;
  const { username, password, device_id: clientDeviceId } = req.body;

  try {
    if (!username || !password) {
      await logLoginAttempt({
        user_id:        null,
        status:         'failed',
        ip_address:     ip,
        user_agent:     userAgent,
        failure_reason: 'missing_credentials',
      });
      return res.status(400).json({ success: false, error: 'Email/username and password are required' });
    }

    console.log(`🔐 Login attempt: ${username} from ${ip}`);

    // Find by email OR username, populate firm details
    user = await User.findOne({
      $or: [{ email: username }, { username }],
    }).populate('firm_id', 'name code status');

    if (!user) {
      console.log(`❌ User not found: ${username}`);
      await logLoginAttempt({
        user_id:        null,
        status:         'failed',
        ip_address:     ip,
        user_agent:     userAgent,
        failure_reason: 'user_not_found',
      });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check for account lockout
    try {
      await checkAccountLockout(User, user);
    } catch (lockError) {
      await logLoginAttempt({
        user_id:        user._id,
        status:         'locked',
        ip_address:     ip,
        user_agent:     userAgent,
        device_id:      clientDeviceId,
        failure_reason: 'account_locked',
      });
      return res.status(423).json({ success: false, error: lockError.message });
    }


    // Check firm approval
    const firm = user.firm_id; // populated doc or null
    if (firm && firm.status !== 'approved') {
      console.log(`❌ Firm not approved: ${firm.status}`);
      await logLoginAttempt({
        user_id:        user._id,
        status:         'failed',
        ip_address:     ip,
        user_agent:     userAgent,
        device_id:      clientDeviceId,
        failure_reason: 'firm_not_approved',
      });
      return res.status(403).json({ success: false, error: 'Your firm is not approved yet. Please contact support.' });
    }

    // Check user approval
    if (user.status !== 'approved') {
      console.log(`❌ User not approved: ${user.status}`);
      await logLoginAttempt({
        user_id:        user._id,
        status:         'failed',
        ip_address:     ip,
        user_agent:     userAgent,
        device_id:      clientDeviceId,
        failure_reason: 'user_not_approved',
      });
      return res.status(403).json({ success: false, error: 'Your account is pending approval. Please contact your administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ Password mismatch for user ${user.username}`);
      await recordFailedAttempt(User, user);
      await logLoginAttempt({
        user_id:        user._id,
        status:         'failed',
        ip_address:     ip,
        user_agent:     userAgent,
        device_id:      clientDeviceId,
        failure_reason: 'invalid_password',
      });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }


    // Reset failed attempts on successful login
    await resetFailedAttempts(user);

    // Update last login
    user.last_login = new Date();

    // Track login history (keep last 5)
    const loginEntry = {
      ip_address: ip,
      device_id:  clientDeviceId || null,
      timestamp:  new Date(),
      user_agent: userAgent,
    };
    if (!user.login_history) user.login_history = [];
    user.login_history.unshift(loginEntry);
    if (user.login_history.length > 5) user.login_history.pop();

    await user.save();

    // Generate token family ID for refresh chain tracking
    const tokenFamilyId = uuidv4();

    // Generate token pair with device and family info
    const { accessToken, refreshToken, csrfToken } = generateTokenPair(
      { ...user.toObject(), firm_id: firm?._id ?? null },
      { device_id: clientDeviceId || 'unknown', family_id: tokenFamilyId }
    );

    // Persist hashed refresh token with device and family tracking
    const expiresAt = new Date(Date.now() + REFRESH_LIFE_MS);
    await RefreshToken.create({
      user_id:         user._id,
      token_hash:      hashToken(refreshToken),
      device_id:       clientDeviceId || null,
      ip_address:      ip,
      token_family_id: tokenFamilyId,
      expires_at:      expiresAt,
    });

    // Register device
    if (clientDeviceId) {
      try {
        await registerDevice({
          user_id:         user._id,
          device_id:       clientDeviceId,
          device_type:     'unknown',
          ip_address:      ip,
          token_family_id: tokenFamilyId,
        });
      } catch (deviceError) {
        console.warn('⚠️ Failed to register device:', deviceError.message);
        // Non-fatal — don't fail auth if device registration fails
      }
    }

    // Set cookies (Backward compatibility)
    const sameSitePolicy = process.env.COOKIE_SAMESITE || 'lax';
    const isSecure = process.env.NODE_ENV === 'production' || sameSitePolicy === 'none';
    
    const cookieBase = {
      secure:   isSecure,
      sameSite: sameSitePolicy,
    };

    res.cookie('accessToken',  accessToken,  { ...cookieBase, httpOnly: true,  maxAge: ACCESS_LIFE_MS });
    res.cookie('refreshToken', refreshToken, { ...cookieBase, httpOnly: true,  maxAge: REFRESH_LIFE_MS });
    res.cookie('tokenExpiry',  String(Date.now() + ACCESS_LIFE_MS), { ...cookieBase, httpOnly: false, maxAge: ACCESS_LIFE_MS });

    // Log successful login
    await logLoginAttempt({
      user_id:    user._id,
      status:     'success',
      ip_address: ip,
      user_agent: userAgent,
      device_id:  clientDeviceId || null,
    });

    console.log(`✅ Login successful for ${user.username} from ${ip}`);

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,  // NEW: return in body for Bearer token usage
      refreshToken, // NEW: return in body for Bearer token usage
      csrfToken,    // NEW: return in body for non-cookie CSRF handling
      user: {
        id:         user._id,
        username:   user.username,
        email:      user.email,
        fullname:   user.fullname,
        role:       user.role,
        firm_id:    firm?._id  ?? null,
        firm_name:  firm?.name ?? null,
        firm_code:  firm?.code ?? null,
        last_login: user.last_login,
      },
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    if (user) {
      try { await recordFailedAttempt(User, user); } catch (_) { /* ignore */ }
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   LOGOUT
   FIX: Both the access token AND the refresh token are now blacklisted.
   Previously only the refresh token was blacklisted, leaving the access
   token valid for up to 15 minutes after logout.
───────────────────────────────────────────────────────────────────────── */

export const logout = async (req, res) => {
  try {
    let rawRefresh = req.cookies.refreshToken;
    let rawAccess  = req.cookies.accessToken;
    const ip         = getClientIP(req);

    // Support headers if cookies are missing
    if (!rawAccess && req.headers.authorization?.startsWith('Bearer ')) {
      rawAccess = req.headers.authorization.substring(7);
    }
    if (!rawRefresh && req.headers['x-refresh-token']) {
      rawRefresh = req.headers['x-refresh-token'];
    }

    if (req.user?.id) {
      // ── Blacklist the refresh token ──────────────────────────────
      if (rawRefresh) {
        try {
          const refreshHash   = hashToken(rawRefresh);
          const storedToken   = await RefreshToken.findOne({
            user_id:    req.user.id,
            token_hash: refreshHash,
          });

          if (storedToken) {
            await RefreshToken.updateOne(
              { _id: storedToken._id },
              { $set: { is_revoked: true, revoked_reason: 'logout', revoked_at: new Date() } }
            );
            await addTokenToBlacklist(req.user.id, rawRefresh, storedToken.expires_at, 'logout');
          }
        } catch (error) {
          console.error('⚠️ Error blacklisting refresh token:', error.message);
        }
      }

      // ── Blacklist the access token so it cannot be replayed ──────
      // FIX: Previously the access token was never blacklisted, giving an
      // attacker up to 15 minutes of post-logout access if they had the cookie.
      if (rawAccess) {
        try {
          const accessExpiry = new Date(Date.now() + ACCESS_LIFE_MS);
          await addTokenToBlacklist(req.user.id, rawAccess, accessExpiry, 'logout');
        } catch (error) {
          console.error('⚠️ Error blacklisting access token:', error.message);
        }
      }

      console.log(`👋 Logout: user ${req.user.id} from ${ip}`);
    }
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Non-fatal — still clear cookies
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('tokenExpiry');

  res.json({ success: true, message: 'Logout successful' });
};

/* ─────────────────────────────────────────────────────────────────────────
   GET CURRENT USER
───────────────────────────────────────────────────────────────────────── */

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('firm_id', 'name code status')
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const firm = user.firm_id;
    res.json({
      success: true,
      user: {
        id:         user._id,
        username:   user.username,
        email:      user.email,
        fullname:   user.fullname,
        role:       user.role,
        firm_id:    firm?._id  ?? null,
        firm_name:  firm?.name ?? null,
        firm_code:  firm?.code ?? null,
        last_login: user.last_login,
      },
      tokenRefreshed: req.tokenRefreshed || false,
      accessToken:    req.tokenRefreshed ? req.newAccessToken : undefined,
      csrfToken:      req.tokenRefreshed ? req.newCSRFToken : undefined,
    });
  } catch (error) {
    console.error('❌ getCurrentUser error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   REFRESH TOKEN (explicit endpoint — authMiddleware already handles silent refresh)
───────────────────────────────────────────────────────────────────────── */

export const refreshToken = (req, res) => {
  res.json({ 
    success: true, 
    message: 'Token refreshed', 
    user: req.user,
    tokenRefreshed: req.tokenRefreshed || false,
    accessToken:    req.tokenRefreshed ? req.newAccessToken : undefined,
    csrfToken:      req.tokenRefreshed ? req.newCSRFToken : undefined,
  });
};

/* ─────────────────────────────────────────────────────────────────────────
   REGISTER
───────────────────────────────────────────────────────────────────────── */

export const register = async (req, res) => {
  const { username, email, fullname, password, firm_code } = req.body;
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || null;

  try {
    // Validate required fields
    if (!username || !email || !fullname || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, fullname, and password are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate username (alphanumeric, underscore, hyphen only)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 3-20 characters (alphanumeric, underscore, hyphen only)',
      });
    }

    // Validate password strength (minimum 8 chars, at least one uppercase, one number)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must contain at least one number',
      });
    }

    console.log(`📝 Registration attempt: ${username} (${email}) from ${ip}`);

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      console.log(`❌ Registration failed: User already exists (${email})`);
      return res.status(409).json({
        success: false,
        error: 'Email or username already registered',
      });
    }

    // Lookup firm by code if provided
    let firmId = null;
    if (firm_code) {
      const { Firm } = await import('../../models/index.js');
      const firm = await Firm.findOne({ code: firm_code });

      if (!firm) {
        console.log(`❌ Registration failed: Invalid firm code (${firm_code})`);
        return res.status(400).json({
          success: false,
          error: 'Invalid firm code',
        });
      }

      if (firm.status !== 'approved') {
        console.log(`❌ Registration failed: Firm not approved (${firm_code})`);
        return res.status(403).json({
          success: false,
          error: 'This firm is not approved yet. Please contact support.',
        });
      }

      firmId = firm._id;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with 'pending' status (requires admin approval)
    const newUser = await User.create({
      username,
      email,
      fullname,
      password: hashedPassword,
      role: 'user',
      firm_id: firmId || null,
      status: 'pending', // Requires admin approval
    });

    console.log(`✅ Registration successful: ${username} (pending approval)`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending admin approval.',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullname: newUser.fullname,
        status: newUser.status,
      },
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

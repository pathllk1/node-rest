# Authentication & Security

The system employs a multi-layered security approach focusing on robust session management and data integrity.

## Core Features

### 1. Dual-Token JWT Authentication
*   **Access Token:** Short-lived (15 minutes), used for immediate API authorization.
*   **Refresh Token:** Long-lived (30 days), used to generate new access tokens.
*   **Storage:** Tokens are delivered as `HttpOnly`, `SameSite: Strict`, and `Secure` cookies, mitigating XSS and CSRF risks.
*   **Hash Storage:** Refresh tokens are hashed before storage in MongoDB for an extra layer of protection.

### 2. Session & Device Management
*   **Device Tracking:** Each refresh token is linked to a browser session and device fingerprint.
*   **Revocation:** Users and admins can revoke individual sessions or all active sessions for a user, effectively "signing out" from specific devices.
*   **Audit Logging:** Login attempts (success/failure) and session activities are logged.

### 3. CSRF Protection
*   The application uses a dual-token CSRF mechanism.
*   A CSRF cookie is set, and state-changing requests (POST, PUT, DELETE) must include a matching `X-CSRF-Token` header.
*   Cron routes and internal APIs have specific bypass rules while maintaining overall security.

### 4. Rate Limiting & Brute-Force Protection
*   **Account Lockout:** Multiple failed login attempts trigger temporary account lockouts.
*   **IP-Based Limiting:** API requests are rate-limited per IP to prevent DoS and automated attacks.
*   **RateLimit Model:** Tracks request frequency and enforces cooldown periods.

### 5. Input Sanitization & XSS Protection
*   All incoming request bodies are passed through a global sanitizer middleware using the `xss` library.
*   Sensitive fields are handled specifically to prevent SQL injection (via Prisma) and NoSQL injection (via Mongoose).

## Key Implementation Files
*   `server/middleware/mongo/securityMiddleware.js`: General security headers and policies.
*   `server/middleware/csrfMiddleware.js`: CSRF token generation and validation.
*   `server/middleware/sanitizer.js`: Global XSS sanitizer.
*   `server/utils/mongo/tokenUtils.js`: JWT and refresh token logic.
*   `server/routes/mongo/auth.js`: Authentication endpoints.

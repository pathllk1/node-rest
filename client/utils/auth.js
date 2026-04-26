import { api } from './api.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.refreshInterval = null;
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionWarningTimeout = null;
  }

  /**
   * Generate or retrieve device ID
   * Used to track devices and manage multi-device sessions
   */
  getOrCreateDeviceId() {
    const storageKey = 'app_device_id';
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
      // Generate new device ID using combination of data
      deviceId = this.generateDeviceId();
      localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
  }

  /**
   * Generate a unique device identifier
   * Uses user-agent, screen resolution, timezone, and random data
   */
  generateDeviceId() {
    const screenData = `${window.screen.width}x${window.screen.height}`;
    const timezoneOffset = new Date().getTimezoneOffset();
    const platform = navigator.platform || 'unknown';
    const randomPart = Math.random().toString(36).substring(2, 15);

    // Create a simple fingerprint
    const fingerprint = `${screenData}-${timezoneOffset}-${platform}-${randomPart}`;
    
    // Simple hash function for fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `dev_${Math.abs(hash)}_${Date.now()}`;
  }

  /**
   * Login user with credentials and device tracking
   */
  async login(username, password) {
    try {
      const response = await api.post('/api/auth/login', {
        username,
        password,
        device_id: this.deviceId, // Send device ID to backend
      });

      if (response.success) {
        this.currentUser = response.user;
        this.isAuthenticated = true;
        this.startAutoRefresh();
        return response;
      }

      throw new Error(response.message);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout and clear authentication
   */
  async logout() {
    try {
      await api.post('/api/auth/logout');
      this.currentUser = null;
      this.isAuthenticated = false;
      this.stopAutoRefresh();
      this.stopSessionWarning();
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    try {
      const response = await api.get('/api/auth/me');

      if (response.success) {
        this.currentUser = response.user;
        this.isAuthenticated = true;
        this.startAutoRefresh();
        return true;
      }

      return false;
    } catch (error) {
      this.currentUser = null;
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken() {
    try {
      const response = await api.post('/api/auth/refresh');

      if (response.success) {
        console.log('Token refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.currentUser = null;
      this.isAuthenticated = false;
      this.stopAutoRefresh();
      return false;
    }
  }

  /**
   * Start automatic token refresh with jittered interval
   * Prevents predictable token refresh patterns
   */
  startAutoRefresh() {
    // Clear any existing interval
    this.stopAutoRefresh();

    // Refresh token before expiry with random jitter (8-12 minutes)
    const baseInterval = 10 * 60 * 1000; // 10 minutes
    const jitter = Math.random() * 4 * 60 * 1000; // ±2 minutes random
    const interval = baseInterval - 2 * 60 * 1000 + jitter; // 8-12 min

    this.refreshInterval = setInterval(async () => {
      console.log('Auto-refreshing token...');
      await this.refreshToken();
    }, interval);

    // Setup session expiry warning (2 minutes before logout)
    this.setupSessionExpiryWarning();
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Setup warning for session expiry (2 minutes before token expires)
   */
  setupSessionExpiryWarning() {
    const tokenExpiryCookie = this.getTokenExpiry();
    if (!tokenExpiryCookie) return;

    const expiryTime = parseInt(tokenExpiryCookie, 10);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    const warningTime = 2 * 60 * 1000; // 2 minutes

    if (timeUntilExpiry > warningTime) {
      const timeUntilWarning = timeUntilExpiry - warningTime;

      this.sessionWarningTimeout = setTimeout(() => {
        this.showSessionExpiryWarning();
      }, timeUntilWarning);
    }
  }

  /**
   * Show session expiry warning to user
   */
  showSessionExpiryWarning() {
    const message =
      'Your session is about to expire in 2 minutes. Click anywhere to stay logged in.';
    console.warn('⏰ SESSION WARNING:', message);

    // Dispatch custom event so app can show UI warning
    window.dispatchEvent(
      new CustomEvent('session-expiry-warning', {
        detail: { message },
      })
    );
  }

  /**
   * Stop session expiry warning
   */
  stopSessionWarning() {
    if (this.sessionWarningTimeout) {
      clearTimeout(this.sessionWarningTimeout);
      this.sessionWarningTimeout = null;
    }
  }

  /**
   * Get token expiry timestamp from cookie
   */
  getTokenExpiry() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'tokenExpiry') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Get all active sessions (devices)
   */
  async getSessions() {
    try {
      const response = await api.get('/api/sessions/sessions');
      return response.sessions || [];
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  }

  /**
   * Revoke a specific session/device
   */
  async revokeSession(deviceId) {
    try {
      const response = await api.delete(`/api/sessions/sessions/${deviceId}`);
      return response.success;
    } catch (error) {
      console.error('Error revoking session:', error);
      return false;
    }
  }

  /**
   * Logout from all other devices
   */
  async revokeOtherSessions() {
    try {
      const response = await api.post('/api/sessions/sessions/revoke-others');
      return response.success;
    } catch (error) {
      console.error('Error revoking other sessions:', error);
      return false;
    }
  }

  /**
   * Get login history
   */
  async getLoginHistory(limit = 10) {
    try {
      const response = await api.get(`/api/sessions/login-history?limit=${limit}`);
      return response.history || [];
    } catch (error) {
      console.error('Error fetching login history:', error);
      return [];
    }
  }

  /**
   * Get suspicious activity
   */
  async getSuspiciousActivity(minutes = 60) {
    try {
      const response = await api.get(`/api/sessions/suspicious-activity?minutes=${minutes}`);
      return response.suspiciousAttempts || [];
    } catch (error) {
      console.error('Error fetching suspicious activity:', error);
      return [];
    }
  }

  /**
   * Get current user
   */
  getUser() {
    return this.currentUser;
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.isAuthenticated;
  }

  /**
   * Get device ID
   */
  getDeviceId() {
    return this.deviceId;
  }
}

export const authManager = new AuthManager();


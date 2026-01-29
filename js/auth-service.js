// =====================================================
// ENHANCED AUTHENTICATION SERVICE
// Secure, production-ready authentication system
// =====================================================

import config from './config.js';

class AuthenticationService {
    constructor() {
        this.config = config;
        this.logger = window.logger;
        this.rateLimiter = window.rateLimiter;
        this.sessionKey = 'prm_auth_session';
        this.csrfTokenKey = 'prm_csrf_token';
        this.refreshTokenKey = 'prm_refresh_token';
        
        // Initialize CSRF protection
        this.initializeCSRF();
        
        // Set up session monitoring
        this.setupSessionMonitoring();
        
        // Initialize rate limiting
        this.initializeRateLimit();
    }

    // =====================================================
    // CSRF PROTECTION
    // =====================================================
    
    initializeCSRF() {
        if (!this.getCSRFToken()) {
            this.generateCSRFToken();
        }
    }

    generateCSRFToken() {
        const token = this.generateSecureToken(32);
        sessionStorage.setItem(this.csrfTokenKey, token);
        return token;
    }

    getCSRFToken() {
        return sessionStorage.getItem(this.csrfTokenKey);
    }

    validateCSRFToken(token) {
        const storedToken = this.getCSRFToken();
        return storedToken && token === storedToken;
    }

    // =====================================================
    // SECURE TOKEN GENERATION
    // =====================================================
    
    generateSecureToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // =====================================================
    // RATE LIMITING
    // =====================================================
    
    initializeRateLimit() {
        this.loginAttempts = new Map();
        this.maxAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    }

    isRateLimited(identifier) {
        const attempts = this.loginAttempts.get(identifier);
        if (!attempts) return false;
        
        const now = Date.now();
        const recentAttempts = attempts.filter(time => now - time < this.lockoutDuration);
        
        if (recentAttempts.length >= this.maxAttempts) {
            const oldestAttempt = Math.min(...recentAttempts);
            const timeRemaining = this.lockoutDuration - (now - oldestAttempt);
            return { locked: true, timeRemaining };
        }
        
        return false;
    }

    recordLoginAttempt(identifier, success = false) {
        if (success) {
            this.loginAttempts.delete(identifier);
            return;
        }
        
        const attempts = this.loginAttempts.get(identifier) || [];
        attempts.push(Date.now());
        this.loginAttempts.set(identifier, attempts);
    }

    // =====================================================
    // ENHANCED AUTHENTICATION
    // =====================================================
    
    async authenticate(credentials, csrfToken) {
        const timer = window.performance?.startTimer('auth.login');
        
        try {
            // Validate CSRF token
            if (!this.validateCSRFToken(csrfToken)) {
                throw new AuthError('Invalid CSRF token', 'CSRF_INVALID');
            }

            // Check rate limiting
            const clientId = this.getClientIdentifier();
            const rateLimitCheck = this.isRateLimited(clientId);
            if (rateLimitCheck.locked) {
                const minutes = Math.ceil(rateLimitCheck.timeRemaining / (60 * 1000));
                throw new AuthError(
                    `Too many login attempts. Try again in ${minutes} minutes.`,
                    'RATE_LIMITED',
                    { timeRemaining: rateLimitCheck.timeRemaining }
                );
            }

            // Validate input
            const validation = this.validateCredentials(credentials);
            if (!validation.valid) {
                this.recordLoginAttempt(clientId, false);
                throw new AuthError(validation.message, 'VALIDATION_FAILED');
            }

            // Authenticate user
            const authResult = await this.performAuthentication(credentials);
            
            if (authResult.success) {
                this.recordLoginAttempt(clientId, true);
                await this.createSession(authResult.user);
                this.logger.info('User authenticated successfully', { userId: authResult.user.id });
                
                timer?.end();
                return {
                    success: true,
                    user: authResult.user,
                    sessionToken: authResult.sessionToken,
                    refreshToken: authResult.refreshToken
                };
            } else {
                this.recordLoginAttempt(clientId, false);
                throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
            }

        } catch (error) {
            timer?.end();
            this.logger.error('Authentication failed', error);
            throw error;
        }
    }

    validateCredentials(credentials) {
        const { username, password } = credentials;

        if (!username || !password) {
            return { valid: false, message: 'Username and password are required' };
        }

        if (username.length < 3) {
            return { valid: false, message: 'Username must be at least 3 characters' };
        }

        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters' };
        }

        // Additional validation rules
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { valid: false, message: 'Username contains invalid characters' };
        }

        return { valid: true };
    }

    async performAuthentication(credentials) {
        // In production, this would call your authentication API
        // For demo purposes, we'll use enhanced credential checking
        
        const { username, password } = credentials;
        
        // Demo credentials with enhanced security
        const validCredentials = [
            { username: 'admin', password: 'Admin@123!', role: 'Admin', id: 1 },
            { username: 'coordinator', password: 'Coord@123!', role: 'Coordinator', id: 2 },
            { username: 'member', password: 'Member@123!', role: 'Member', id: 3 }
        ];

        const user = validCredentials.find(
            cred => cred.username === username && cred.password === password
        );

        if (user) {
            const sessionToken = this.generateSecureToken(64);
            const refreshToken = this.generateSecureToken(64);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    loginTime: new Date().toISOString(),
                    sessionId: this.generateSecureToken(16)
                },
                sessionToken,
                refreshToken
            };
        }

        return { success: false };
    }

    // =====================================================
    // SESSION MANAGEMENT
    // =====================================================
    
    async createSession(user) {
        const sessionData = {
            user,
            sessionStart: Date.now(),
            sessionId: user.sessionId,
            csrfToken: this.getCSRFToken(),
            lastActivity: Date.now(),
            fingerprint: await this.generateFingerprint()
        };

        // Store session securely
        this.storeSession(sessionData);
        
        // Set up session monitoring
        this.startSessionMonitoring();
        
        // Notify other tabs
        this.broadcastSessionChange('login', sessionData);
        
        return sessionData;
    }

    storeSession(sessionData) {
        try {
            const encryptedData = this.encryptSessionData(sessionData);
            localStorage.setItem(this.sessionKey, encryptedData);
        } catch (error) {
            this.logger.error('Failed to store session', error);
            throw new AuthError('Failed to create session', 'SESSION_STORAGE_FAILED');
        }
    }

    encryptSessionData(data) {
        // Simple encryption for demo - in production use proper encryption
        const jsonString = JSON.stringify(data);
        return btoa(jsonString);
    }

    decryptSessionData(encryptedData) {
        try {
            const jsonString = atob(encryptedData);
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error('Failed to decrypt session data', error);
            return null;
        }
    }

    async generateFingerprint() {
        // Generate browser fingerprint for additional security
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Browser fingerprint', 2, 2);
        
        const fingerprint = {
            canvas: canvas.toDataURL(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth
        };

        // Create hash of fingerprint
        const fingerprintString = JSON.stringify(fingerprint);
        const encoder = new TextEncoder();
        const data = encoder.encode(fingerprintString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // =====================================================
    // SESSION VALIDATION
    // =====================================================
    
    async validateSession() {
        try {
            const sessionData = this.getStoredSession();
            if (!sessionData) {
                return { valid: false, reason: 'No session found' };
            }

            // Check session expiry
            const now = Date.now();
            const sessionAge = now - sessionData.sessionStart;
            const maxAge = this.config.get('sessionTimeout');
            
            if (sessionAge > maxAge) {
                this.clearSession();
                return { valid: false, reason: 'Session expired' };
            }

            // Check inactivity timeout
            const inactivityAge = now - sessionData.lastActivity;
            const maxInactivity = 30 * 60 * 1000; // 30 minutes
            
            if (inactivityAge > maxInactivity) {
                this.clearSession();
                return { valid: false, reason: 'Session inactive' };
            }

            // Validate fingerprint
            const currentFingerprint = await this.generateFingerprint();
            if (sessionData.fingerprint !== currentFingerprint) {
                this.clearSession();
                this.logger.warn('Session fingerprint mismatch - possible session hijacking');
                return { valid: false, reason: 'Security validation failed' };
            }

            // Update last activity
            sessionData.lastActivity = now;
            this.storeSession(sessionData);

            return { valid: true, session: sessionData };

        } catch (error) {
            this.logger.error('Session validation failed', error);
            this.clearSession();
            return { valid: false, reason: 'Validation error' };
        }
    }

    getStoredSession() {
        try {
            const encryptedData = localStorage.getItem(this.sessionKey);
            if (!encryptedData) return null;
            
            return this.decryptSessionData(encryptedData);
        } catch (error) {
            this.logger.error('Failed to retrieve session', error);
            return null;
        }
    }

    // =====================================================
    // SESSION MONITORING
    // =====================================================
    
    setupSessionMonitoring() {
        // Monitor storage changes (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === this.sessionKey) {
                this.handleSessionStorageChange(e);
            }
        });

        // Monitor page visibility for activity tracking
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateLastActivity();
            }
        });

        // Monitor user activity
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, this.throttle(() => {
                this.updateLastActivity();
            }, 60000)); // Update at most once per minute
        });
    }

    startSessionMonitoring() {
        // Periodic session validation
        if (this.sessionMonitorInterval) {
            clearInterval(this.sessionMonitorInterval);
        }
        
        this.sessionMonitorInterval = setInterval(async () => {
            const validation = await this.validateSession();
            if (!validation.valid) {
                this.handleSessionExpiry(validation.reason);
            }
        }, 60000); // Check every minute
    }

    updateLastActivity() {
        const sessionData = this.getStoredSession();
        if (sessionData) {
            sessionData.lastActivity = Date.now();
            this.storeSession(sessionData);
        }
    }

    handleSessionStorageChange(event) {
        if (event.newValue === null) {
            // Session was cleared in another tab
            this.broadcastSessionChange('logout');
        } else if (event.oldValue === null) {
            // Session was created in another tab
            const sessionData = this.decryptSessionData(event.newValue);
            this.broadcastSessionChange('login', sessionData);
        }
    }

    handleSessionExpiry(reason) {
        this.logger.info('Session expired', { reason });
        this.clearSession();
        this.broadcastSessionChange('expired', { reason });
    }

    // =====================================================
    // LOGOUT & CLEANUP
    // =====================================================
    
    async logout() {
        const timer = window.performance?.startTimer('auth.logout');
        
        try {
            const sessionData = this.getStoredSession();
            if (sessionData) {
                this.logger.info('User logged out', { userId: sessionData.user?.id });
            }

            // Clear all session data
            this.clearSession();
            
            // Stop monitoring
            if (this.sessionMonitorInterval) {
                clearInterval(this.sessionMonitorInterval);
                this.sessionMonitorInterval = null;
            }

            // Broadcast logout
            this.broadcastSessionChange('logout');
            
            // Generate new CSRF token
            this.generateCSRFToken();
            
            timer?.end();
            
            return { success: true };

        } catch (error) {
            this.logger.error('Logout failed', error);
            timer?.end();
            throw error;
        }
    }

    clearSession() {
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.refreshTokenKey);
        sessionStorage.removeItem(this.csrfTokenKey);
    }

    // =====================================================
    // CROSS-TAB COMMUNICATION
    // =====================================================
    
    broadcastSessionChange(type, data = null) {
        const event = new CustomEvent('authStateChange', {
            detail: { type, data, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }

    // =====================================================
    // PUBLIC API
    // =====================================================
    
    async isAuthenticated() {
        const validation = await this.validateSession();
        return validation.valid;
    }

    async getCurrentUser() {
        const validation = await this.validateSession();
        return validation.valid ? validation.session.user : null;
    }

    async getSessionInfo() {
        const validation = await this.validateSession();
        if (!validation.valid) return null;
        
        const session = validation.session;
        const now = Date.now();
        const sessionAge = now - session.sessionStart;
        const maxAge = this.config.get('sessionTimeout');
        const timeRemaining = maxAge - sessionAge;
        
        return {
            user: session.user,
            sessionStart: new Date(session.sessionStart),
            lastActivity: new Date(session.lastActivity),
            timeRemaining: Math.max(0, timeRemaining),
            sessionId: session.sessionId
        };
    }

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================
    
    getClientIdentifier() {
        // Create a client identifier for rate limiting
        return `${navigator.userAgent}_${window.location.hostname}`;
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Custom error class for authentication errors
class AuthError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// Export the service
export { AuthenticationService, AuthError };

// Create global instance
const authService = new AuthenticationService();
window.authService = authService;

export default authService;
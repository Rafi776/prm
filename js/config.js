// =====================================================
// CONFIGURATION MANAGEMENT
// Environment-based configuration for security
// =====================================================

class ConfigManager {
    constructor() {
        this.config = this.loadConfig();
        this.validateConfig();
    }

    loadConfig() {
        // In production, these should come from environment variables
        // For demo purposes, we'll use a secure configuration object
        const environment = this.getEnvironment();
        
        const configs = {
            development: {
                apiUrl: 'http://localhost:3000/api',
                supabaseUrl: process.env.VITE_SUPABASE_URL || 'your-supabase-url',
                supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key',
                enableLogging: true,
                enableDebug: true,
                sessionTimeout: 6 * 60 * 60 * 1000, // 6 hours
                maxFileSize: 10 * 1024 * 1024, // 10MB
                allowedFileTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
                rateLimit: {
                    requests: 100,
                    windowMs: 15 * 60 * 1000 // 15 minutes
                }
            },
            staging: {
                apiUrl: 'https://staging-api.prm.com/api',
                supabaseUrl: process.env.VITE_SUPABASE_URL,
                supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
                enableLogging: true,
                enableDebug: false,
                sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours
                maxFileSize: 10 * 1024 * 1024,
                allowedFileTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
                rateLimit: {
                    requests: 200,
                    windowMs: 15 * 60 * 1000
                }
            },
            production: {
                apiUrl: 'https://api.prm.com/api',
                supabaseUrl: process.env.VITE_SUPABASE_URL,
                supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
                enableLogging: false,
                enableDebug: false,
                sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours in production
                maxFileSize: 5 * 1024 * 1024, // 5MB in production
                allowedFileTypes: ['application/pdf', 'image/png', 'image/jpeg'],
                rateLimit: {
                    requests: 500,
                    windowMs: 15 * 60 * 1000
                }
            }
        };

        return {
            environment,
            ...configs[environment],
            // Security headers
            security: {
                contentSecurityPolicy: {
                    'default-src': ["'self'"],
                    'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net'],
                    'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
                    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
                    'connect-src': ["'self'", 'https://*.supabase.co'],
                    'font-src': ["'self'", 'https:'],
                    'object-src': ["'none'"],
                    'media-src': ["'self'"],
                    'frame-src': ["'none'"]
                },
                headers: {
                    'X-Content-Type-Options': 'nosniff',
                    'X-Frame-Options': 'DENY',
                    'X-XSS-Protection': '1; mode=block',
                    'Referrer-Policy': 'strict-origin-when-cross-origin',
                    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
                }
            },
            // Feature flags
            features: {
                enableNotifications: environment !== 'development',
                enableAdvancedAnalytics: environment === 'production',
                enableWorkflowEngine: false, // Coming in Phase 3
                enableMobileApp: false, // Coming in Phase 4
                enableRealTimeUpdates: true,
                enableFileUpload: true,
                enableBulkOperations: environment !== 'development',
                enableAuditLogging: environment === 'production'
            },
            // Application metadata
            app: {
                name: 'PRM - PR Marketing & ICT Taskforce',
                version: '2.0.0',
                description: 'Bangladesh Scouts Rover Region Management System',
                author: 'PRM Development Team',
                license: 'MIT',
                repository: 'https://github.com/prm/taskforce-management'
            }
        };
    }

    getEnvironment() {
        // Detect environment from various sources
        if (typeof process !== 'undefined' && process.env.NODE_ENV) {
            return process.env.NODE_ENV;
        }
        
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'development';
            } else if (hostname.includes('staging')) {
                return 'staging';
            } else {
                return 'production';
            }
        }
        
        return 'development';
    }

    validateConfig() {
        const required = ['supabaseUrl', 'supabaseAnonKey'];
        const missing = required.filter(key => !this.config[key] || this.config[key].includes('your-'));
        
        if (missing.length > 0) {
            console.warn('Missing required configuration:', missing);
            if (this.config.environment === 'production') {
                throw new Error(`Missing required configuration in production: ${missing.join(', ')}`);
            }
        }
    }

    get(key) {
        return this.getNestedValue(this.config, key);
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    isFeatureEnabled(feature) {
        return this.get(`features.${feature}`) === true;
    }

    getSecurityHeaders() {
        return this.get('security.headers');
    }

    getCSPDirectives() {
        const csp = this.get('security.contentSecurityPolicy');
        return Object.entries(csp)
            .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
            .join('; ');
    }

    // Rate limiting helper
    createRateLimiter() {
        const { requests, windowMs } = this.get('rateLimit');
        const requestCounts = new Map();

        return {
            isAllowed: (identifier) => {
                const now = Date.now();
                const windowStart = now - windowMs;
                
                // Clean old entries
                for (const [key, timestamps] of requestCounts.entries()) {
                    const validTimestamps = timestamps.filter(t => t > windowStart);
                    if (validTimestamps.length === 0) {
                        requestCounts.delete(key);
                    } else {
                        requestCounts.set(key, validTimestamps);
                    }
                }
                
                // Check current identifier
                const timestamps = requestCounts.get(identifier) || [];
                const validTimestamps = timestamps.filter(t => t > windowStart);
                
                if (validTimestamps.length >= requests) {
                    return false;
                }
                
                validTimestamps.push(now);
                requestCounts.set(identifier, validTimestamps);
                return true;
            },
            getRemainingRequests: (identifier) => {
                const timestamps = requestCounts.get(identifier) || [];
                const now = Date.now();
                const windowStart = now - windowMs;
                const validTimestamps = timestamps.filter(t => t > windowStart);
                return Math.max(0, requests - validTimestamps.length);
            }
        };
    }

    // Logging helper
    createLogger() {
        const enableLogging = this.get('enableLogging');
        const enableDebug = this.get('enableDebug');
        
        return {
            debug: (...args) => {
                if (enableDebug) console.debug('[DEBUG]', ...args);
            },
            info: (...args) => {
                if (enableLogging) console.info('[INFO]', ...args);
            },
            warn: (...args) => {
                if (enableLogging) console.warn('[WARN]', ...args);
            },
            error: (...args) => {
                console.error('[ERROR]', ...args);
                // In production, send to error tracking service
                if (this.config.environment === 'production') {
                    this.sendToErrorTracking('error', args);
                }
            }
        };
    }

    sendToErrorTracking(level, args) {
        // Placeholder for error tracking service integration
        // In production, integrate with Sentry, LogRocket, etc.
        try {
            if (window.Sentry) {
                window.Sentry.captureMessage(args.join(' '), level);
            }
        } catch (error) {
            console.error('Failed to send error to tracking service:', error);
        }
    }

    // Performance monitoring
    createPerformanceMonitor() {
        return {
            startTimer: (name) => {
                const start = performance.now();
                return {
                    end: () => {
                        const duration = performance.now() - start;
                        this.logPerformance(name, duration);
                        return duration;
                    }
                };
            },
            
            logPerformance: (name, duration) => {
                if (this.get('enableDebug')) {
                    console.debug(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
                }
                
                // In production, send to analytics
                if (this.config.environment === 'production') {
                    this.sendToAnalytics('performance', { name, duration });
                }
            }
        };
    }

    sendToAnalytics(event, data) {
        // Placeholder for analytics service integration
        try {
            if (window.gtag) {
                window.gtag('event', event, data);
            }
        } catch (error) {
            console.error('Failed to send analytics:', error);
        }
    }
}

// Create global config instance
const config = new ConfigManager();

// Export for use in other modules
window.config = config;

// Export logger and performance monitor for global use
window.logger = config.createLogger();
window.performance = config.createPerformanceMonitor();
window.rateLimiter = config.createRateLimiter();

// Development helpers
if (config.get('enableDebug')) {
    window.debugConfig = () => {
        console.table({
            Environment: config.get('environment'),
            'API URL': config.get('apiUrl'),
            'Session Timeout': `${config.get('sessionTimeout') / (60 * 1000)} minutes`,
            'Max File Size': `${config.get('maxFileSize') / (1024 * 1024)} MB`,
            'Rate Limit': `${config.get('rateLimit.requests')} requests per ${config.get('rateLimit.windowMs') / (60 * 1000)} minutes`
        });
        
        console.log('Feature Flags:', config.get('features'));
        console.log('Security Headers:', config.get('security.headers'));
    };
    
    console.log('🔧 Debug mode enabled. Type debugConfig() to see configuration.');
}

export default config;
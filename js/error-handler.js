// =====================================================
// COMPREHENSIVE ERROR HANDLING SYSTEM
// Production-ready error management and user feedback
// =====================================================

import config from './config.js';

class ErrorHandler {
    constructor() {
        this.config = config;
        this.logger = window.logger;
        this.errorQueue = [];
        this.maxQueueSize = 100;
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        
        this.setupGlobalErrorHandling();
        this.setupUnhandledRejectionHandling();
    }

    // =====================================================
    // GLOBAL ERROR HANDLING SETUP
    // =====================================================
    
    setupGlobalErrorHandling() {
        // Catch all JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleGlobalError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error?.stack
            });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason,
                stack: event.reason?.stack
            });
        });

        // Catch resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleResourceError({
                    type: 'resource',
                    element: event.target.tagName,
                    source: event.target.src || event.target.href,
                    message: 'Failed to load resource'
                });
            }
        }, true);
    }

    setupUnhandledRejectionHandling() {
        // Prevent default browser behavior for unhandled rejections
        window.addEventListener('unhandledrejection', (event) => {
            event.preventDefault();
        });
    }

    // =====================================================
    // ERROR CLASSIFICATION AND HANDLING
    // =====================================================
    
    handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        // Log the error
        this.logError(errorInfo);
        
        // Add to error queue for batch processing
        this.addToErrorQueue(errorInfo);
        
        // Show user-friendly message
        this.showUserError(errorInfo);
        
        // Handle specific error types
        this.handleSpecificError(errorInfo);
        
        // Send to monitoring service
        this.sendToMonitoring(errorInfo);
        
        return errorInfo;
    }

    classifyError(error, context) {
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            stack: error.stack,
            type: this.determineErrorType(error),
            severity: this.determineSeverity(error),
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                userId: context.userId,
                action: context.action,
                component: context.component,
                ...context
            },
            error: {
                name: error.name,
                code: error.code,
                status: error.status,
                details: error.details
            },
            retryable: this.isRetryable(error),
            userVisible: this.shouldShowToUser(error)
        };

        return errorInfo;
    }

    determineErrorType(error) {
        if (error.name === 'AuthError') return 'authentication';
        if (error.name === 'ValidationError') return 'validation';
        if (error.name === 'NetworkError') return 'network';
        if (error.name === 'TypeError') return 'type';
        if (error.name === 'ReferenceError') return 'reference';
        if (error.name === 'SyntaxError') return 'syntax';
        if (error.code === 'PERMISSION_DENIED') return 'permission';
        if (error.status >= 400 && error.status < 500) return 'client';
        if (error.status >= 500) return 'server';
        return 'unknown';
    }

    determineSeverity(error) {
        if (error.name === 'AuthError') return 'high';
        if (error.name === 'ValidationError') return 'low';
        if (error.status >= 500) return 'critical';
        if (error.status >= 400) return 'medium';
        if (error.name === 'TypeError' || error.name === 'ReferenceError') return 'high';
        return 'medium';
    }

    isRetryable(error) {
        const retryableTypes = ['network', 'server'];
        const retryableCodes = [408, 429, 500, 502, 503, 504];
        
        return retryableTypes.includes(this.determineErrorType(error)) ||
               retryableCodes.includes(error.status);
    }

    shouldShowToUser(error) {
        const userVisibleTypes = ['authentication', 'validation', 'permission'];
        const hiddenTypes = ['syntax', 'reference', 'type'];
        
        const errorType = this.determineErrorType(error);
        
        if (hiddenTypes.includes(errorType)) return false;
        if (userVisibleTypes.includes(errorType)) return true;
        
        // Show network errors to users
        if (errorType === 'network') return true;
        
        // Show client errors (4xx) to users
        if (error.status >= 400 && error.status < 500) return true;
        
        return false;
    }

    // =====================================================
    // ERROR LOGGING AND MONITORING
    // =====================================================
    
    logError(errorInfo) {
        const logLevel = this.getLogLevel(errorInfo.severity);
        const logMessage = `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}`;
        
        this.logger[logLevel](logMessage, {
            id: errorInfo.id,
            type: errorInfo.type,
            severity: errorInfo.severity,
            context: errorInfo.context,
            stack: errorInfo.stack
        });
    }

    getLogLevel(severity) {
        switch (severity) {
            case 'critical': return 'error';
            case 'high': return 'error';
            case 'medium': return 'warn';
            case 'low': return 'info';
            default: return 'warn';
        }
    }

    addToErrorQueue(errorInfo) {
        this.errorQueue.push(errorInfo);
        
        // Maintain queue size
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue.shift();
        }
        
        // Process queue periodically
        this.processErrorQueue();
    }

    processErrorQueue() {
        // Batch process errors for analytics
        if (this.errorQueue.length >= 10 || this.shouldFlushQueue()) {
            this.flushErrorQueue();
        }
    }

    shouldFlushQueue() {
        const lastFlush = this.lastQueueFlush || 0;
        const flushInterval = 5 * 60 * 1000; // 5 minutes
        return Date.now() - lastFlush > flushInterval;
    }

    flushErrorQueue() {
        if (this.errorQueue.length === 0) return;
        
        const errors = [...this.errorQueue];
        this.errorQueue = [];
        this.lastQueueFlush = Date.now();
        
        // Send batch to monitoring service
        this.sendErrorBatch(errors);
    }

    // =====================================================
    // USER-FRIENDLY ERROR DISPLAY
    // =====================================================
    
    showUserError(errorInfo) {
        if (!errorInfo.userVisible) return;
        
        const userMessage = this.getUserFriendlyMessage(errorInfo);
        const errorType = this.getErrorDisplayType(errorInfo);
        
        this.displayErrorToUser(userMessage, errorType, errorInfo);
    }

    getUserFriendlyMessage(errorInfo) {
        const messageMap = {
            authentication: 'Please log in to continue.',
            permission: 'You don\'t have permission to perform this action.',
            validation: errorInfo.message,
            network: 'Connection problem. Please check your internet connection.',
            server: 'Server error. Please try again later.',
            client: 'Request failed. Please check your input and try again.'
        };

        return messageMap[errorInfo.type] || 'An unexpected error occurred. Please try again.';
    }

    getErrorDisplayType(errorInfo) {
        switch (errorInfo.severity) {
            case 'critical':
            case 'high':
                return 'error';
            case 'medium':
                return 'warning';
            case 'low':
                return 'info';
            default:
                return 'error';
        }
    }

    displayErrorToUser(message, type, errorInfo) {
        // Create or update error display
        this.createErrorNotification({
            id: errorInfo.id,
            message,
            type,
            duration: this.getNotificationDuration(type),
            actions: this.getErrorActions(errorInfo)
        });
    }

    createErrorNotification({ id, message, type, duration, actions = [] }) {
        // Remove existing notification with same ID
        const existing = document.getElementById(`error-${id}`);
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.id = `error-${id}`;
        notification.className = this.getNotificationClasses(type);
        
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                    ${this.getErrorIcon(type)}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium">${this.escapeHtml(message)}</p>
                    ${actions.length > 0 ? this.renderErrorActions(actions) : ''}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="flex-shrink-0 text-gray-400 hover:text-gray-600">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        // Add to page
        this.getNotificationContainer().appendChild(notification);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }

        return notification;
    }

    getNotificationClasses(type) {
        const baseClasses = 'fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border p-4 mb-2';
        
        const typeClasses = {
            error: 'border-red-200 bg-red-50',
            warning: 'border-yellow-200 bg-yellow-50',
            info: 'border-blue-200 bg-blue-50',
            success: 'border-green-200 bg-green-50'
        };

        return `${baseClasses} ${typeClasses[type] || typeClasses.error}`;
    }

    getErrorIcon(type) {
        const icons = {
            error: '<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>',
            warning: '<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
            info: '<svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>',
            success: '<svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>'
        };

        return icons[type] || icons.error;
    }

    getNotificationDuration(type) {
        const durations = {
            error: 8000,    // 8 seconds
            warning: 6000,  // 6 seconds
            info: 4000,     // 4 seconds
            success: 3000   // 3 seconds
        };

        return durations[type] || durations.error;
    }

    getNotificationContainer() {
        let container = document.getElementById('error-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'error-notifications';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }
        return container;
    }

    // =====================================================
    // ERROR RECOVERY AND RETRY LOGIC
    // =====================================================
    
    getErrorActions(errorInfo) {
        const actions = [];

        if (errorInfo.retryable) {
            actions.push({
                label: 'Retry',
                action: () => this.retryOperation(errorInfo),
                primary: true
            });
        }

        if (errorInfo.type === 'authentication') {
            actions.push({
                label: 'Login',
                action: () => window.showAuthModal?.(),
                primary: true
            });
        }

        if (errorInfo.severity === 'critical') {
            actions.push({
                label: 'Reload Page',
                action: () => window.location.reload(),
                primary: false
            });
        }

        return actions;
    }

    renderErrorActions(actions) {
        if (actions.length === 0) return '';

        return `
            <div class="mt-2 flex gap-2">
                ${actions.map(action => `
                    <button onclick="(${action.action.toString()})()" 
                            class="text-xs font-medium ${action.primary ? 'text-blue-600 hover:text-blue-800' : 'text-gray-600 hover:text-gray-800'}">
                        ${action.label}
                    </button>
                `).join('')}
            </div>
        `;
    }

    async retryOperation(errorInfo) {
        const retryKey = `${errorInfo.context.action}_${errorInfo.context.component}`;
        const attempts = this.retryAttempts.get(retryKey) || 0;

        if (attempts >= this.maxRetries) {
            this.showUserError({
                ...errorInfo,
                message: 'Maximum retry attempts reached. Please try again later.',
                userVisible: true
            });
            return;
        }

        this.retryAttempts.set(retryKey, attempts + 1);

        try {
            // Exponential backoff
            const delay = Math.pow(2, attempts) * 1000;
            await this.sleep(delay);

            // Trigger retry event
            const retryEvent = new CustomEvent('errorRetry', {
                detail: { errorInfo, attempt: attempts + 1 }
            });
            window.dispatchEvent(retryEvent);

        } catch (error) {
            this.handleError(error, {
                ...errorInfo.context,
                retryAttempt: attempts + 1
            });
        }
    }

    // =====================================================
    // SPECIFIC ERROR HANDLERS
    // =====================================================
    
    handleSpecificError(errorInfo) {
        switch (errorInfo.type) {
            case 'authentication':
                this.handleAuthError(errorInfo);
                break;
            case 'network':
                this.handleNetworkError(errorInfo);
                break;
            case 'validation':
                this.handleValidationError(errorInfo);
                break;
            case 'permission':
                this.handlePermissionError(errorInfo);
                break;
        }
    }

    handleAuthError(errorInfo) {
        // Clear invalid session
        if (window.authService) {
            window.authService.clearSession();
        }
        
        // Redirect to login if needed
        if (errorInfo.context.requiresAuth) {
            setTimeout(() => {
                window.showAuthModal?.();
            }, 1000);
        }
    }

    handleNetworkError(errorInfo) {
        // Check if offline
        if (!navigator.onLine) {
            this.showOfflineMessage();
        }
        
        // Implement retry logic for network errors
        if (errorInfo.retryable) {
            setTimeout(() => {
                this.retryOperation(errorInfo);
            }, 2000);
        }
    }

    handleValidationError(errorInfo) {
        // Focus on the problematic field if available
        if (errorInfo.context.fieldName) {
            const field = document.querySelector(`[name="${errorInfo.context.fieldName}"]`);
            if (field) {
                field.focus();
                field.classList.add('border-red-500');
            }
        }
    }

    handlePermissionError(errorInfo) {
        // Log security event
        this.logger.warn('Permission denied', {
            userId: errorInfo.context.userId,
            action: errorInfo.context.action,
            resource: errorInfo.context.resource
        });
    }

    // =====================================================
    // GLOBAL ERROR HANDLERS
    // =====================================================
    
    handleGlobalError(errorData) {
        const error = new Error(errorData.message);
        error.name = 'GlobalError';
        error.stack = errorData.stack;
        error.filename = errorData.filename;
        error.lineno = errorData.lineno;
        error.colno = errorData.colno;

        this.handleError(error, {
            type: 'global',
            source: errorData.type
        });
    }

    handleResourceError(errorData) {
        const error = new Error(errorData.message);
        error.name = 'ResourceError';
        error.element = errorData.element;
        error.source = errorData.source;

        this.handleError(error, {
            type: 'resource',
            element: errorData.element,
            source: errorData.source
        });
    }

    // =====================================================
    // MONITORING AND ANALYTICS
    // =====================================================
    
    sendToMonitoring(errorInfo) {
        if (this.config.get('environment') === 'production') {
            this.sendToSentry(errorInfo);
            this.sendToAnalytics(errorInfo);
        }
    }

    sendToSentry(errorInfo) {
        try {
            if (window.Sentry) {
                window.Sentry.captureException(new Error(errorInfo.message), {
                    tags: {
                        type: errorInfo.type,
                        severity: errorInfo.severity
                    },
                    extra: errorInfo.context,
                    fingerprint: [errorInfo.type, errorInfo.message]
                });
            }
        } catch (error) {
            console.error('Failed to send error to Sentry:', error);
        }
    }

    sendToAnalytics(errorInfo) {
        try {
            if (window.gtag) {
                window.gtag('event', 'exception', {
                    description: errorInfo.message,
                    fatal: errorInfo.severity === 'critical',
                    error_type: errorInfo.type
                });
            }
        } catch (error) {
            console.error('Failed to send error to analytics:', error);
        }
    }

    sendErrorBatch(errors) {
        // Send batch of errors to monitoring service
        const batch = {
            timestamp: new Date().toISOString(),
            errors: errors.map(error => ({
                id: error.id,
                type: error.type,
                severity: error.severity,
                message: error.message,
                context: error.context
            }))
        };

        this.sendToMonitoring({ batch });
    }

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================
    
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showOfflineMessage() {
        this.createErrorNotification({
            id: 'offline',
            message: 'You are currently offline. Some features may not work.',
            type: 'warning',
            duration: 0 // Persistent until online
        });

        // Remove when back online
        const handleOnline = () => {
            const offlineNotification = document.getElementById('error-offline');
            if (offlineNotification) {
                offlineNotification.remove();
            }
            window.removeEventListener('online', handleOnline);
        };

        window.addEventListener('online', handleOnline);
    }

    // =====================================================
    // PUBLIC API
    // =====================================================
    
    // Convenience methods for different error types
    handleValidationError(message, fieldName = null) {
        const error = new Error(message);
        error.name = 'ValidationError';
        return this.handleError(error, { fieldName });
    }

    handleNetworkError(message, status = null) {
        const error = new Error(message);
        error.name = 'NetworkError';
        error.status = status;
        return this.handleError(error);
    }

    handleAuthError(message, code = null) {
        const error = new Error(message);
        error.name = 'AuthError';
        error.code = code;
        return this.handleError(error);
    }

    // Show success message
    showSuccess(message) {
        this.createErrorNotification({
            id: `success_${Date.now()}`,
            message,
            type: 'success',
            duration: 3000
        });
    }

    // Show info message
    showInfo(message) {
        this.createErrorNotification({
            id: `info_${Date.now()}`,
            message,
            type: 'info',
            duration: 4000
        });
    }

    // Get error statistics
    getErrorStats() {
        const stats = {
            total: this.errorQueue.length,
            byType: {},
            bySeverity: {},
            recent: this.errorQueue.slice(-10)
        };

        this.errorQueue.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        });

        return stats;
    }
}

// Create global instance
const errorHandler = new ErrorHandler();

// Export for use in other modules
window.errorHandler = errorHandler;

export default errorHandler;
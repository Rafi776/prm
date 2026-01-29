// =====================================================
// API SERVICE LAYER
// Centralized API communication with caching and retry logic
// =====================================================

import config from './config.js';
import errorHandler from './error-handler.js';

class ApiService {
    constructor() {
        this.config = config;
        this.errorHandler = errorHandler;
        this.logger = window.logger;
        this.baseURL = this.config.get('apiUrl');
        this.rateLimiter = window.rateLimiter;
        
        // Request interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // Cache for GET requests
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Request queue for retry logic
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        // Setup default interceptors
        this.setupDefaultInterceptors();
    }

    // =====================================================
    // INTERCEPTOR SYSTEM
    // =====================================================
    
    setupDefaultInterceptors() {
        // Request interceptors
        this.addRequestInterceptor(this.addAuthHeader.bind(this));
        this.addRequestInterceptor(this.addCSRFToken.bind(this));
        this.addRequestInterceptor(this.addRateLimiting.bind(this));
        this.addRequestInterceptor(this.addRequestId.bind(this));
        
        // Response interceptors
        this.addResponseInterceptor(this.handleAuthErrors.bind(this));
        this.addResponseInterceptor(this.handleRateLimitErrors.bind(this));
        this.addResponseInterceptor(this.logResponse.bind(this));
    }

    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    async processRequestInterceptors(config) {
        let processedConfig = { ...config };
        
        for (const interceptor of this.requestInterceptors) {
            try {
                processedConfig = await interceptor(processedConfig);
            } catch (error) {
                this.logger.error('Request interceptor failed:', error);
                throw error;
            }
        }
        
        return processedConfig;
    }

    async processResponseInterceptors(response, config) {
        let processedResponse = response;
        
        for (const interceptor of this.responseInterceptors) {
            try {
                processedResponse = await interceptor(processedResponse, config);
            } catch (error) {
                this.logger.error('Response interceptor failed:', error);
                throw error;
            }
        }
        
        return processedResponse;
    }

    // =====================================================
    // DEFAULT INTERCEPTORS
    // =====================================================
    
    async addAuthHeader(config) {
        if (window.authService) {
            const isAuthenticated = await window.authService.isAuthenticated();
            if (isAuthenticated) {
                const sessionInfo = await window.authService.getSessionInfo();
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${sessionInfo.sessionId}`
                };
            }
        }
        return config;
    }

    async addCSRFToken(config) {
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase())) {
            if (window.authService) {
                const csrfToken = window.authService.getCSRFToken();
                if (csrfToken) {
                    config.headers = {
                        ...config.headers,
                        'X-CSRF-Token': csrfToken
                    };
                }
            }
        }
        return config;
    }

    async addRateLimiting(config) {
        const identifier = this.getRequestIdentifier(config);
        
        if (!this.rateLimiter.isAllowed(identifier)) {
            const remaining = this.rateLimiter.getRemainingRequests(identifier);
            throw new ApiError(
                'Rate limit exceeded. Please try again later.',
                'RATE_LIMITED',
                429,
                { remaining }
            );
        }
        
        return config;
    }

    async addRequestId(config) {
        config.headers = {
            ...config.headers,
            'X-Request-ID': this.generateRequestId()
        };
        return config;
    }

    async handleAuthErrors(response, config) {
        if (response.status === 401) {
            // Clear invalid session
            if (window.authService) {
                await window.authService.logout();
            }
            
            throw new ApiError(
                'Authentication required',
                'AUTH_REQUIRED',
                401
            );
        }
        
        if (response.status === 403) {
            throw new ApiError(
                'Access forbidden',
                'ACCESS_FORBIDDEN',
                403
            );
        }
        
        return response;
    }

    async handleRateLimitErrors(response, config) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new ApiError(
                'Rate limit exceeded',
                'RATE_LIMITED',
                429,
                { retryAfter }
            );
        }
        
        return response;
    }

    async logResponse(response, config) {
        const duration = Date.now() - config.startTime;
        
        this.logger.debug('API Response:', {
            method: config.method,
            url: config.url,
            status: response.status,
            duration: `${duration}ms`,
            requestId: config.headers['X-Request-ID']
        });
        
        // Track performance
        if (window.performance) {
            window.performance.logPerformance(`api.${config.method}.${response.status}`, duration);
        }
        
        return response;
    }

    // =====================================================
    // CORE HTTP METHODS
    // =====================================================
    
    async request(config) {
        const timer = window.performance?.startTimer(`api.${config.method}.${config.url}`);
        
        try {
            // Add start time for logging
            config.startTime = Date.now();
            
            // Process request interceptors
            const processedConfig = await this.processRequestInterceptors(config);
            
            // Check cache for GET requests
            if (config.method === 'GET' && config.cache !== false) {
                const cached = this.getCachedResponse(config.url);
                if (cached) {
                    this.logger.debug('Returning cached response for:', config.url);
                    timer?.end();
                    return cached;
                }
            }
            
            // Make the request
            const response = await this.makeRequest(processedConfig);
            
            // Process response interceptors
            const processedResponse = await this.processResponseInterceptors(response, processedConfig);
            
            // Parse response
            const result = await this.parseResponse(processedResponse, processedConfig);
            
            // Cache GET responses
            if (config.method === 'GET' && config.cache !== false && processedResponse.ok) {
                this.setCachedResponse(config.url, result);
            }
            
            timer?.end();
            return result;
            
        } catch (error) {
            timer?.end();
            
            // Handle retryable errors
            if (this.isRetryable(error, config)) {
                return this.retryRequest(config, error);
            }
            
            // Handle and throw error
            const apiError = this.createApiError(error, config);
            this.errorHandler.handleError(apiError, {
                action: 'api_request',
                method: config.method,
                url: config.url
            });
            
            throw apiError;
        }
    }

    async makeRequest(config) {
        const url = this.buildUrl(config.url, config.params);
        const options = {
            method: config.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            }
        };

        if (config.data && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
            options.body = JSON.stringify(config.data);
        }

        // Add timeout
        const controller = new AbortController();
        const timeout = config.timeout || 30000; // 30 seconds default
        
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);

        options.signal = controller.signal;

        try {
            const response = await fetch(url, options);
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new ApiError('Request timeout', 'TIMEOUT', 408);
            }
            
            throw error;
        }
    }

    async parseResponse(response, config) {
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
            let errorData;
            
            try {
                if (contentType?.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    errorData = { message: await response.text() };
                }
            } catch (parseError) {
                errorData = { message: 'Failed to parse error response' };
            }
            
            throw new ApiError(
                errorData.message || `HTTP ${response.status}`,
                errorData.code || 'HTTP_ERROR',
                response.status,
                errorData
            );
        }

        // Handle different content types
        if (contentType?.includes('application/json')) {
            return await response.json();
        } else if (contentType?.includes('text/')) {
            return await response.text();
        } else if (contentType?.includes('application/octet-stream')) {
            return await response.blob();
        } else {
            return response;
        }
    }

    // =====================================================
    // HTTP METHOD SHORTCUTS
    // =====================================================
    
    async get(url, params = null, options = {}) {
        return this.request({
            method: 'GET',
            url,
            params,
            ...options
        });
    }

    async post(url, data = null, options = {}) {
        return this.request({
            method: 'POST',
            url,
            data,
            ...options
        });
    }

    async put(url, data = null, options = {}) {
        return this.request({
            method: 'PUT',
            url,
            data,
            ...options
        });
    }

    async patch(url, data = null, options = {}) {
        return this.request({
            method: 'PATCH',
            url,
            data,
            ...options
        });
    }

    async delete(url, options = {}) {
        return this.request({
            method: 'DELETE',
            url,
            ...options
        });
    }

    // =====================================================
    // CACHING SYSTEM
    // =====================================================
    
    getCachedResponse(url) {
        const cached = this.cache.get(url);
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(url);
            return null;
        }
        
        return cached.data;
    }

    setCachedResponse(url, data) {
        this.cache.set(url, {
            data,
            timestamp: Date.now()
        });
        
        // Clean old cache entries
        this.cleanCache();
    }

    cleanCache() {
        const now = Date.now();
        for (const [url, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.cacheTimeout) {
                this.cache.delete(url);
            }
        }
    }

    clearCache(pattern = null) {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const url of this.cache.keys()) {
                if (regex.test(url)) {
                    this.cache.delete(url);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    // =====================================================
    // RETRY LOGIC
    // =====================================================
    
    isRetryable(error, config) {
        // Don't retry if already retried max times
        const retryCount = config.retryCount || 0;
        const maxRetries = config.maxRetries || 3;
        
        if (retryCount >= maxRetries) return false;
        
        // Retry on network errors
        if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') return true;
        
        // Retry on timeout
        if (error.code === 'TIMEOUT') return true;
        
        // Retry on server errors (5xx)
        if (error.status >= 500) return true;
        
        // Retry on rate limit with backoff
        if (error.status === 429) return true;
        
        return false;
    }

    async retryRequest(config, originalError) {
        const retryCount = (config.retryCount || 0) + 1;
        const maxRetries = config.maxRetries || 3;
        
        if (retryCount > maxRetries) {
            throw originalError;
        }
        
        // Calculate backoff delay
        const baseDelay = config.retryDelay || 1000;
        const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
        
        this.logger.info(`Retrying request (${retryCount}/${maxRetries}) after ${delay}ms`, {
            url: config.url,
            method: config.method,
            error: originalError.message
        });
        
        // Wait before retry
        await this.sleep(delay);
        
        // Retry with incremented count
        return this.request({
            ...config,
            retryCount
        });
    }

    // =====================================================
    // BATCH REQUESTS
    // =====================================================
    
    async batch(requests) {
        const timer = window.performance?.startTimer('api.batch');
        
        try {
            const promises = requests.map(request => 
                this.request(request).catch(error => ({ error, request }))
            );
            
            const results = await Promise.all(promises);
            
            timer?.end();
            
            return {
                success: results.filter(r => !r.error),
                errors: results.filter(r => r.error)
            };
            
        } catch (error) {
            timer?.end();
            throw error;
        }
    }

    // =====================================================
    // FILE UPLOAD
    // =====================================================
    
    async uploadFile(url, file, options = {}) {
        const timer = window.performance?.startTimer('api.upload');
        
        try {
            // Validate file
            this.validateFile(file);
            
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Add additional fields
            if (options.fields) {
                Object.entries(options.fields).forEach(([key, value]) => {
                    formData.append(key, value);
                });
            }
            
            // Upload with progress tracking
            const config = {
                method: 'POST',
                url,
                data: formData,
                headers: {
                    // Don't set Content-Type, let browser set it with boundary
                },
                onUploadProgress: options.onProgress,
                timeout: options.timeout || 60000 // 1 minute for uploads
            };
            
            // Remove Content-Type header for FormData
            delete config.headers['Content-Type'];
            
            const result = await this.request(config);
            
            timer?.end();
            return result;
            
        } catch (error) {
            timer?.end();
            throw error;
        }
    }

    validateFile(file) {
        const maxSize = this.config.get('maxFileSize');
        const allowedTypes = this.config.get('allowedFileTypes');
        
        if (file.size > maxSize) {
            throw new ApiError(
                `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
                'FILE_TOO_LARGE',
                400
            );
        }
        
        if (!allowedTypes.includes(file.type)) {
            throw new ApiError(
                `File type ${file.type} is not allowed`,
                'INVALID_FILE_TYPE',
                400
            );
        }
    }

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================
    
    buildUrl(url, params) {
        if (!params) return url;
        
        const urlObj = new URL(url, this.baseURL);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                urlObj.searchParams.append(key, value);
            }
        });
        
        return urlObj.toString();
    }

    getRequestIdentifier(config) {
        return `${config.method}_${config.url}`;
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    createApiError(error, config) {
        if (error instanceof ApiError) {
            return error;
        }
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return new ApiError(
                'Network error - please check your connection',
                'NETWORK_ERROR',
                0,
                { originalError: error.message }
            );
        }
        
        return new ApiError(
            error.message || 'Unknown API error',
            error.code || 'UNKNOWN_ERROR',
            error.status || 0,
            { originalError: error }
        );
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // =====================================================
    // MONITORING AND DEBUGGING
    // =====================================================
    
    getStats() {
        return {
            cacheSize: this.cache.size,
            requestQueueSize: this.requestQueue.length,
            interceptors: {
                request: this.requestInterceptors.length,
                response: this.responseInterceptors.length
            }
        };
    }

    enableDebugMode() {
        this.debugMode = true;
        
        // Add debug interceptor
        this.addRequestInterceptor((config) => {
            console.log('🚀 API Request:', config);
            return config;
        });
        
        this.addResponseInterceptor((response, config) => {
            console.log('📥 API Response:', {
                status: response.status,
                url: config.url,
                method: config.method
            });
            return response;
        });
    }
}

// Custom API Error class
class ApiError extends Error {
    constructor(message, code, status = 0, details = {}) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

// Create global instance
const apiService = new ApiService();

// Export for use in other modules
window.apiService = apiService;

// Development helpers
if (config.get('enableDebug')) {
    window.debugApi = () => {
        console.table(apiService.getStats());
        console.log('Cache contents:', Array.from(apiService.cache.keys()));
    };
    
    window.enableApiDebug = () => apiService.enableDebugMode();
    
    console.log('🔧 API Debug mode available. Type debugApi() or enableApiDebug()');
}

export { ApiService, ApiError };
export default apiService;
// =====================================================
// ENHANCED APPLICATION CORE
// Market-standard application initialization and management
// =====================================================

import config from './config.js';
import authService from './auth-service.js';
import errorHandler from './error-handler.js';
import apiService from './api-service.js';
import componentSystem from './components.js';

class Application {
    constructor() {
        this.config = config;
        this.authService = authService;
        this.errorHandler = errorHandler;
        this.apiService = apiService;
        this.componentSystem = componentSystem;
        this.logger = window.logger;
        
        this.modules = new Map();
        this.state = {
            initialized: false,
            user: null,
            theme: 'light',
            language: 'en',
            notifications: [],
            performance: {
                loadTime: 0,
                apiCalls: 0,
                errors: 0
            }
        };
        
        this.eventBus = new EventTarget();
        
        this.init();
    }

    // =====================================================
    // APPLICATION INITIALIZATION
    // =====================================================
    
    async init() {
        const startTime = performance.now();
        
        try {
            this.logger.info('🚀 Initializing PRM Application...');
            
            // Initialize core systems
            await this.initializeCore();
            
            // Load user preferences
            await this.loadUserPreferences();
            
            // Initialize modules
            await this.initializeModules();
            
            // Setup global event listeners
            this.setupGlobalEventListeners();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Initialize UI
            await this.initializeUI();
            
            // Mark as initialized
            this.state.initialized = true;
            this.state.performance.loadTime = performance.now() - startTime;
            
            this.logger.info(`✅ Application initialized in ${this.state.performance.loadTime.toFixed(2)}ms`);
            
            // Emit initialization complete event
            this.emit('app:initialized', { loadTime: this.state.performance.loadTime });
            
            // Show welcome message in development
            if (this.config.get('enableDebug')) {
                this.showWelcomeMessage();
            }
            
        } catch (error) {
            this.logger.error('❌ Application initialization failed:', error);
            this.errorHandler.handleError(error, { 
                action: 'app_initialization',
                critical: true 
            });
            
            // Show fallback UI
            this.showFallbackUI(error);
        }
    }

    async initializeCore() {
        // Validate configuration
        if (!this.config.get('supabaseUrl') || this.config.get('supabaseUrl').includes('your-')) {
            throw new Error('Invalid Supabase configuration. Please check your environment variables.');
        }
        
        // Initialize Supabase client
        if (typeof supabase !== 'undefined') {
            window.supabaseClient = supabase.createClient(
                this.config.get('supabaseUrl'),
                this.config.get('supabaseAnonKey')
            );
            this.logger.info('✅ Supabase client initialized');
        }
        
        // Check authentication status
        const isAuthenticated = await this.authService.isAuthenticated();
        if (isAuthenticated) {
            this.state.user = await this.authService.getCurrentUser();
            this.logger.info('✅ User session restored', { userId: this.state.user?.id });
        }
        
        // Initialize feature flags
        this.initializeFeatureFlags();
    }

    initializeFeatureFlags() {
        const features = this.config.get('features');
        this.logger.info('🎛️ Feature flags loaded:', features);
        
        // Apply feature-specific initialization
        if (features.enableRealTimeUpdates) {
            this.initializeRealTimeUpdates();
        }
        
        if (features.enableAdvancedAnalytics) {
            this.initializeAnalytics();
        }
    }

    async loadUserPreferences() {
        try {
            const preferences = localStorage.getItem('prm_user_preferences');
            if (preferences) {
                const parsed = JSON.parse(preferences);
                this.state.theme = parsed.theme || 'light';
                this.state.language = parsed.language || 'en';
                
                this.logger.info('✅ User preferences loaded', parsed);
            }
        } catch (error) {
            this.logger.warn('Failed to load user preferences:', error);
        }
    }

    async initializeModules() {
        const currentPage = this.getCurrentPage();
        
        // Register core modules
        this.registerModule('navigation', new NavigationModule(this));
        this.registerModule('notifications', new NotificationModule(this));
        this.registerModule('theme', new ThemeModule(this));
        
        // Register page-specific modules
        switch (currentPage) {
            case 'dashboard':
                this.registerModule('dashboard', new DashboardModule(this));
                break;
            case 'task-tracking':
                this.registerModule('taskTracking', new TaskTrackingModule(this));
                break;
            case 'all-members':
                this.registerModule('memberDirectory', new MemberDirectoryModule(this));
                break;
            case 'submission':
                this.registerModule('submission', new SubmissionModule(this));
                break;
            case 'recruitment':
                this.registerModule('recruitment', new RecruitmentModule(this));
                break;
            case 'waiting-room':
                this.registerModule('waitingRoom', new WaitingRoomModule(this));
                break;
        }
        
        // Initialize all modules
        for (const [name, module] of this.modules) {
            try {
                await module.initialize();
                this.logger.info(`✅ Module '${name}' initialized`);
            } catch (error) {
                this.logger.error(`❌ Module '${name}' failed to initialize:`, error);
            }
        }
    }

    setupGlobalEventListeners() {
        // Authentication state changes
        this.on('authStateChange', (event) => {
            const { type, data } = event.detail;
            this.handleAuthStateChange(type, data);
        });
        
        // Error events
        this.on('error', (event) => {
            this.state.performance.errors++;
            this.handleGlobalError(event.detail);
        });
        
        // Performance events
        this.on('performance', (event) => {
            this.handlePerformanceEvent(event.detail);
        });
        
        // Network status
        window.addEventListener('online', () => {
            this.handleNetworkStatusChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkStatusChange(false);
        });
        
        // Page visibility
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Before unload
        window.addEventListener('beforeunload', (e) => {
            this.handleBeforeUnload(e);
        });
    }

    setupPerformanceMonitoring() {
        // Monitor API calls
        this.apiService.addResponseInterceptor((response, config) => {
            this.state.performance.apiCalls++;
            return response;
        });
        
        // Monitor component creation
        const originalCreateComponent = this.componentSystem.createComponent;
        this.componentSystem.createComponent = (...args) => {
            const timer = window.performance?.startTimer('component.create');
            const result = originalCreateComponent.apply(this.componentSystem, args);
            timer?.end();
            return result;
        };
        
        // Report performance metrics periodically
        setInterval(() => {
            this.reportPerformanceMetrics();
        }, 60000); // Every minute
    }

    async initializeUI() {
        // Apply theme
        this.applyTheme(this.state.theme);
        
        // Initialize global UI components
        this.initializeGlobalComponents();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Initialize accessibility features
        this.initializeAccessibility();
    }

    // =====================================================
    // MODULE MANAGEMENT
    // =====================================================
    
    registerModule(name, module) {
        this.modules.set(name, module);
        this.logger.debug(`Module '${name}' registered`);
    }

    getModule(name) {
        return this.modules.get(name);
    }

    async unloadModule(name) {
        const module = this.modules.get(name);
        if (module && module.cleanup) {
            await module.cleanup();
        }
        this.modules.delete(name);
        this.logger.debug(`Module '${name}' unloaded`);
    }

    // =====================================================
    // EVENT SYSTEM
    // =====================================================
    
    on(event, handler) {
        this.eventBus.addEventListener(event, handler);
    }

    off(event, handler) {
        this.eventBus.removeEventListener(event, handler);
    }

    emit(event, data = null) {
        const customEvent = new CustomEvent(event, { detail: data });
        this.eventBus.dispatchEvent(customEvent);
        
        // Also emit on window for backward compatibility
        window.dispatchEvent(customEvent);
    }

    // =====================================================
    // STATE MANAGEMENT
    // =====================================================
    
    getState(key = null) {
        if (key) {
            return this.getNestedValue(this.state, key);
        }
        return { ...this.state };
    }

    setState(updates) {
        const oldState = { ...this.state };
        
        if (typeof updates === 'function') {
            this.state = { ...this.state, ...updates(this.state) };
        } else {
            this.state = { ...this.state, ...updates };
        }
        
        this.emit('stateChange', { oldState, newState: this.state });
    }

    // =====================================================
    // AUTHENTICATION HANDLING
    // =====================================================
    
    handleAuthStateChange(type, data) {
        switch (type) {
            case 'login':
                this.state.user = data.user;
                this.emit('user:login', data);
                this.showNotification('Welcome back!', 'success');
                break;
                
            case 'logout':
                this.state.user = null;
                this.emit('user:logout');
                this.showNotification('You have been logged out', 'info');
                break;
                
            case 'expired':
                this.state.user = null;
                this.emit('user:sessionExpired', data);
                this.showNotification('Your session has expired. Please log in again.', 'warning');
                break;
        }
        
        // Update UI based on auth state
        this.updateAuthUI();
    }

    updateAuthUI() {
        const isAuthenticated = !!this.state.user;
        
        // Update navigation
        const navModule = this.getModule('navigation');
        if (navModule) {
            navModule.updateAuthState(isAuthenticated);
        }
        
        // Update page-specific UI
        this.modules.forEach(module => {
            if (module.updateAuthState) {
                module.updateAuthState(isAuthenticated);
            }
        });
    }

    // =====================================================
    // ERROR HANDLING
    // =====================================================
    
    handleGlobalError(error) {
        this.logger.error('Global error:', error);
        
        // Show user-friendly error message
        if (error.userVisible !== false) {
            this.showNotification(
                error.message || 'An unexpected error occurred',
                'error'
            );
        }
        
        // Handle critical errors
        if (error.severity === 'critical') {
            this.handleCriticalError(error);
        }
    }

    handleCriticalError(error) {
        this.logger.error('Critical error detected:', error);
        
        // Show recovery options
        const modal = this.componentSystem.createComponent('Modal', {
            title: 'Critical Error',
            size: 'md',
            closable: false
        });
        
        modal.setContent(`
            <div class="text-center">
                <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Application Error</h3>
                <p class="text-sm text-gray-500 mb-6">
                    A critical error has occurred. Please try one of the recovery options below.
                </p>
            </div>
        `);
        
        modal.setFooter([
            {
                text: 'Reload Page',
                variant: 'primary',
                onClick: () => window.location.reload()
            },
            {
                text: 'Clear Data & Reload',
                variant: 'secondary',
                onClick: () => {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                }
            }
        ]);
        
        modal.mount(document.body);
        modal.open();
    }

    // =====================================================
    // PERFORMANCE MONITORING
    // =====================================================
    
    handlePerformanceEvent(data) {
        // Log performance data
        this.logger.debug('Performance event:', data);
        
        // Check for performance issues
        if (data.duration > 5000) { // 5 seconds
            this.logger.warn('Slow operation detected:', data);
        }
    }

    reportPerformanceMetrics() {
        const metrics = {
            ...this.state.performance,
            memoryUsage: this.getMemoryUsage(),
            timestamp: new Date().toISOString()
        };
        
        this.logger.info('Performance metrics:', metrics);
        
        // Send to analytics in production
        if (this.config.get('environment') === 'production') {
            this.sendAnalytics('performance', metrics);
        }
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    // =====================================================
    // NETWORK HANDLING
    // =====================================================
    
    handleNetworkStatusChange(isOnline) {
        this.setState({ isOnline });
        
        if (isOnline) {
            this.showNotification('Connection restored', 'success');
            this.emit('network:online');
        } else {
            this.showNotification('You are offline', 'warning');
            this.emit('network:offline');
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.emit('app:hidden');
        } else {
            this.emit('app:visible');
            // Refresh data when app becomes visible
            this.refreshData();
        }
    }

    handleBeforeUnload(event) {
        // Save user preferences
        this.saveUserPreferences();
        
        // Cleanup modules
        this.modules.forEach(module => {
            if (module.beforeUnload) {
                module.beforeUnload();
            }
        });
        
        // Check for unsaved changes
        const hasUnsavedChanges = Array.from(this.modules.values())
            .some(module => module.hasUnsavedChanges?.());
        
        if (hasUnsavedChanges) {
            event.preventDefault();
            event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    }

    // =====================================================
    // UI MANAGEMENT
    // =====================================================
    
    initializeGlobalComponents() {
        // Create notification container
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(notificationContainer);
        
        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'fixed inset-0 z-[100] hidden bg-gray-900/50 backdrop-blur-sm flex items-center justify-center';
        loadingOverlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 shadow-xl">
                <div class="flex items-center gap-3">
                    <svg class="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-gray-700">Loading...</span>
                </div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.openSearch();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeTopModal();
            }
            
            // Alt + L for login
            if (e.altKey && e.key === 'l') {
                e.preventDefault();
                if (!this.state.user) {
                    window.showAuthModal?.();
                }
            }
        });
    }

    initializeAccessibility() {
        // Add skip link
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50';
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Add main content landmark
        const mainContent = document.querySelector('main') || document.querySelector('.main-content');
        if (mainContent && !mainContent.id) {
            mainContent.id = 'main-content';
        }
        
        // Announce page changes to screen readers
        this.on('navigation:change', (event) => {
            this.announceToScreenReader(`Navigated to ${event.detail.pageName}`);
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.state.theme = theme;
        
        // Update theme color meta tag
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.content = theme === 'dark' ? '#1f2937' : '#ffffff';
        }
    }

    // =====================================================
    // UTILITY METHODS
    // =====================================================
    
    showNotification(message, type = 'info', options = {}) {
        const notification = this.componentSystem.createComponent('Notification', {
            message,
            type,
            ...options
        });
        
        const container = document.getElementById('notification-container');
        notification.mount(container);
        
        this.state.notifications.push(notification);
        
        // Clean up old notifications
        if (this.state.notifications.length > 5) {
            const oldNotification = this.state.notifications.shift();
            oldNotification.close();
        }
    }

    showLoading(show = true) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !show);
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        if (filename.includes('task-tracking')) return 'task-tracking';
        if (filename.includes('all-members')) return 'all-members';
        if (filename.includes('submission')) return 'submission';
        if (filename.includes('recruitment')) return 'recruitment';
        if (filename.includes('waiting-room')) return 'waiting-room';
        if (filename.includes('core-team')) return 'core-team';
        if (filename.includes('join')) return 'join';
        
        return 'dashboard';
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    saveUserPreferences() {
        const preferences = {
            theme: this.state.theme,
            language: this.state.language
        };
        
        localStorage.setItem('prm_user_preferences', JSON.stringify(preferences));
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    openSearch() {
        // Implement global search functionality
        this.logger.info('Opening search...');
    }

    closeTopModal() {
        // Close the topmost modal
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        if (modals.length > 0) {
            const topModal = modals[modals.length - 1];
            const closeBtn = topModal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.click();
            }
        }
    }

    async refreshData() {
        // Refresh data for all modules
        for (const module of this.modules.values()) {
            if (module.refreshData) {
                try {
                    await module.refreshData();
                } catch (error) {
                    this.logger.error('Failed to refresh module data:', error);
                }
            }
        }
    }

    sendAnalytics(event, data) {
        if (window.gtag) {
            window.gtag('event', event, data);
        }
    }

    showWelcomeMessage() {
        console.log(`
🎉 Welcome to PRM Application v${this.config.get('app.version')}

🔧 Debug Commands:
• debugConfig() - View configuration
• debugApi() - View API statistics  
• app.getState() - View application state
• app.getModule('moduleName') - Access modules

📊 Performance:
• Load Time: ${this.state.performance.loadTime.toFixed(2)}ms
• Modules: ${this.modules.size}
• Features: ${Object.keys(this.config.get('features')).length}

🚀 Ready for development!
        `);
    }

    showFallbackUI(error) {
        document.body.innerHTML = `
            <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                        <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h1 class="text-xl font-semibold text-gray-900 mb-2">Application Failed to Load</h1>
                    <p class="text-gray-600 mb-6">${error.message}</p>
                    <button onclick="window.location.reload()" 
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                        Reload Application
                    </button>
                </div>
            </div>
        `;
    }

    // =====================================================
    // PUBLIC API
    // =====================================================
    
    // Expose useful methods for debugging and module access
    getStats() {
        return {
            state: this.state,
            modules: Array.from(this.modules.keys()),
            performance: this.state.performance,
            config: {
                environment: this.config.get('environment'),
                features: this.config.get('features')
            }
        };
    }
}

// =====================================================
// BASE MODULE CLASS
// =====================================================

class BaseModule {
    constructor(app) {
        this.app = app;
        this.logger = app.logger;
        this.initialized = false;
    }

    async initialize() {
        // Override in subclasses
        this.initialized = true;
    }

    async cleanup() {
        // Override in subclasses
        this.initialized = false;
    }

    updateAuthState(isAuthenticated) {
        // Override in subclasses
    }

    async refreshData() {
        // Override in subclasses
    }

    hasUnsavedChanges() {
        // Override in subclasses
        return false;
    }

    beforeUnload() {
        // Override in subclasses
    }
}

// =====================================================
// CORE MODULES
// =====================================================

class NavigationModule extends BaseModule {
    async initialize() {
        this.setupMobileMenu();
        this.setupActiveStates();
        super.initialize();
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const menuOverlay = document.getElementById('menuOverlay');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                if (menuOverlay) {
                    menuOverlay.classList.toggle('hidden');
                }
            });
        }

        if (menuOverlay) {
            menuOverlay.addEventListener('click', () => {
                sidebar?.classList.add('-translate-x-full');
                menuOverlay.classList.add('hidden');
            });
        }
    }

    setupActiveStates() {
        const currentPage = this.app.getCurrentPage();
        const navLinks = document.querySelectorAll('nav a');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.includes(currentPage)) {
                link.classList.add('bg-blue-600', 'text-white');
                link.classList.remove('text-gray-300', 'hover:bg-gray-800');
            }
        });
    }

    updateAuthState(isAuthenticated) {
        // Update navigation based on auth state
        const adminOnlyLinks = document.querySelectorAll('[data-admin-only]');
        adminOnlyLinks.forEach(link => {
            link.style.display = isAuthenticated ? '' : 'none';
        });
    }
}

class NotificationModule extends BaseModule {
    async initialize() {
        this.notifications = [];
        super.initialize();
    }

    show(message, type = 'info', options = {}) {
        return this.app.showNotification(message, type, options);
    }

    clear() {
        this.app.state.notifications.forEach(notification => {
            notification.close();
        });
        this.app.state.notifications = [];
    }
}

class ThemeModule extends BaseModule {
    async initialize() {
        this.setupThemeToggle();
        super.initialize();
    }

    setupThemeToggle() {
        // Add theme toggle button if it doesn't exist
        const header = document.querySelector('header');
        if (header && !document.getElementById('theme-toggle')) {
            const themeToggle = document.createElement('button');
            themeToggle.id = 'theme-toggle';
            themeToggle.className = 'p-2 text-gray-600 hover:text-gray-900 rounded-lg';
            themeToggle.innerHTML = '🌙';
            themeToggle.title = 'Toggle theme';
            
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
            
            header.appendChild(themeToggle);
        }
    }

    toggleTheme() {
        const currentTheme = this.app.state.theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        this.app.applyTheme(newTheme);
        this.app.saveUserPreferences();
        
        // Update toggle button
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
        }
    }
}

// Placeholder modules for page-specific functionality
class DashboardModule extends BaseModule {}
class TaskTrackingModule extends BaseModule {}
class MemberDirectoryModule extends BaseModule {}
class SubmissionModule extends BaseModule {}
class RecruitmentModule extends BaseModule {}
class WaitingRoomModule extends BaseModule {}

// Initialize application when DOM is ready
let app;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new Application();
        window.app = app;
    });
} else {
    app = new Application();
    window.app = app;
}

export { Application, BaseModule };
export default app;
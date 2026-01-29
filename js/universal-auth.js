// =====================================================
// UNIVERSAL AUTHENTICATION SYSTEM
// Provides consistent login/logout across all pages
// =====================================================

// Global authentication state
window.universalAuth = {
    isAuthenticated: false,
    sessionStart: null,
    sessionDuration: 6 * 60 * 60 * 1000, // 6 hours
    credentials: { username: 'admin', password: 'admin123' },
    userData: null,
    callbacks: []
};

class UniversalAuthSystem {
    constructor() {
        this.init();
    }

    init() {
        // Check for existing session on page load
        this.checkExistingSession();
        
        // Set up periodic session validation
        setInterval(() => {
            this.validateSession();
        }, 60000); // Check every minute

        // Listen for storage changes (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === 'prm_auth_session') {
                this.syncSessionFromStorage();
            }
        });

        // Set up logout on page unload (optional)
        window.addEventListener('beforeunload', () => {
            this.updateSessionStorage();
        });
    }

    // Check for existing session in localStorage
    checkExistingSession() {
        try {
            const sessionData = localStorage.getItem('prm_auth_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                const now = new Date().getTime();
                
                if (session.sessionStart && (now - session.sessionStart) < window.universalAuth.sessionDuration) {
                    // Valid session exists
                    window.universalAuth.isAuthenticated = true;
                    window.universalAuth.sessionStart = session.sessionStart;
                    window.universalAuth.userData = session.userData;
                    
                    console.log('Restored existing session for user:', session.userData?.username);
                    this.notifyAuthChange(true);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error checking existing session:', error);
        }
        
        // No valid session
        this.clearSession();
        return false;
    }

    // Sync session from localStorage (for cross-tab functionality)
    syncSessionFromStorage() {
        const wasAuthenticated = window.universalAuth.isAuthenticated;
        const hasValidSession = this.checkExistingSession();
        
        if (wasAuthenticated !== hasValidSession) {
            this.notifyAuthChange(hasValidSession);
        }
    }

    // Update session in localStorage
    updateSessionStorage() {
        if (window.universalAuth.isAuthenticated) {
            const sessionData = {
                sessionStart: window.universalAuth.sessionStart,
                userData: window.universalAuth.userData,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('prm_auth_session', JSON.stringify(sessionData));
        } else {
            localStorage.removeItem('prm_auth_session');
        }
    }

    // Validate current session
    validateSession() {
        if (!window.universalAuth.isAuthenticated || !window.universalAuth.sessionStart) {
            return false;
        }
        
        const now = new Date().getTime();
        const sessionAge = now - window.universalAuth.sessionStart;
        
        if (sessionAge > window.universalAuth.sessionDuration) {
            console.log('Session expired after', Math.round(sessionAge / (1000 * 60)), 'minutes');
            this.logout();
            this.showMessage('Session expired - please log in again', 'info');
            return false;
        }
        
        return true;
    }

    // Show authentication modal
    showAuthModal() {
        // Create modal if it doesn't exist
        if (!document.getElementById('universalAuthModal')) {
            this.createAuthModal();
        }
        
        const modal = document.getElementById('universalAuthModal');
        modal.classList.remove('hidden');
        
        const userInput = document.getElementById('universalAdminUser');
        if (userInput) {
            userInput.focus();
            userInput.value = '';
        }
        
        const passInput = document.getElementById('universalAdminPass');
        if (passInput) {
            passInput.value = '';
        }
    }

    // Close authentication modal
    closeAuthModal() {
        const modal = document.getElementById('universalAuthModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // Create authentication modal HTML
    createAuthModal() {
        const modalHTML = `
            <div id="universalAuthModal" class="fixed inset-0 z-[200] hidden flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-gray-900/80 backdrop-blur-md"></div>
                <div class="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white text-2xl font-bold">🔐</span>
                        </div>
                        <h2 class="text-xl font-bold text-gray-800">Admin Access Required</h2>
                        <p class="text-sm text-gray-600 mt-2">Enter your credentials to access admin features</p>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Username</label>
                            <input type="text" id="universalAdminUser" placeholder="Enter username" 
                                   class="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-colors">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Password</label>
                            <input type="password" id="universalAdminPass" placeholder="Enter password" 
                                   class="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition-colors">
                        </div>
                    </div>
                    <div class="mt-6 space-y-3">
                        <button onclick="universalAuthSystem.handleLogin()" 
                                class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-xl font-bold transition-all duration-200 transform hover:scale-105">
                            Login
                        </button>
                        <button onclick="universalAuthSystem.closeAuthModal()" 
                                class="w-full text-gray-400 hover:text-gray-600 text-sm transition-colors">
                            Cancel
                        </button>
                    </div>
                    <div class="mt-4 text-center">
                        <p class="text-xs text-gray-500">Demo credentials: admin / admin123</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const userInput = document.getElementById('universalAdminUser');
        const passInput = document.getElementById('universalAdminPass');
        
        if (userInput) {
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (passInput) passInput.focus();
                }
            });
        }
        
        if (passInput) {
            passInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLogin();
                }
            });
        }
    }

    // Handle login attempt
    handleLogin() {
        const userInput = document.getElementById('universalAdminUser');
        const passInput = document.getElementById('universalAdminPass');
        
        if (!userInput || !passInput) {
            this.showMessage('Login form error', 'error');
            return;
        }
        
        const username = userInput.value.trim();
        const password = passInput.value.trim();
        
        if (username === window.universalAuth.credentials.username && 
            password === window.universalAuth.credentials.password) {
            
            // Successful login
            window.universalAuth.isAuthenticated = true;
            window.universalAuth.sessionStart = new Date().getTime();
            window.universalAuth.userData = {
                username: username,
                role: 'Admin',
                loginTime: new Date().toISOString()
            };
            
            this.updateSessionStorage();
            this.closeAuthModal();
            this.notifyAuthChange(true);
            
            this.showMessage('Login successful! Admin features are now available.', 'success');
            
        } else {
            this.showMessage('Invalid credentials. Use admin/admin123', 'error');
        }
    }

    // Logout function
    logout() {
        window.universalAuth.isAuthenticated = false;
        window.universalAuth.sessionStart = null;
        window.universalAuth.userData = null;
        
        this.updateSessionStorage();
        this.notifyAuthChange(false);
        
        this.showMessage('Logged out successfully', 'info');
    }

    // Register callback for authentication changes
    onAuthChange(callback) {
        if (typeof callback === 'function') {
            window.universalAuth.callbacks.push(callback);
        }
    }

    // Notify all registered callbacks of auth change
    notifyAuthChange(isAuthenticated) {
        window.universalAuth.callbacks.forEach(callback => {
            try {
                callback(isAuthenticated, window.universalAuth.userData);
            } catch (error) {
                console.error('Error in auth callback:', error);
            }
        });
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.validateSession();
    }

    // Get current user data
    getUserData() {
        return window.universalAuth.userData;
    }

    // Show message to user
    showMessage(message, type = 'info') {
        const colors = {
            success: 'bg-green-50 text-green-700 border-green-200',
            error: 'bg-red-50 text-red-700 border-red-200',
            info: 'bg-blue-50 text-blue-700 border-blue-200',
            warning: 'bg-yellow-50 text-yellow-700 border-yellow-200'
        };
        
        // Remove existing messages
        document.querySelectorAll('.universal-auth-message').forEach(el => el.remove());
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `universal-auth-message fixed top-4 right-4 z-[250] px-4 py-3 rounded-lg border ${colors[type]} font-medium shadow-lg max-w-sm`;
        messageDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => messageDiv.remove(), 4000);
    }

    // Clear session data
    clearSession() {
        window.universalAuth.isAuthenticated = false;
        window.universalAuth.sessionStart = null;
        window.universalAuth.userData = null;
        localStorage.removeItem('prm_auth_session');
    }
}

// Initialize the universal auth system
const universalAuthSystem = new UniversalAuthSystem();

// Global functions for easy access
window.showAuthModal = () => universalAuthSystem.showAuthModal();
window.logout = () => universalAuthSystem.logout();
window.isAuthenticated = () => universalAuthSystem.isAuthenticated();
window.getUserData = () => universalAuthSystem.getUserData();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { universalAuthSystem, UniversalAuthSystem };
}
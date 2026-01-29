// =====================================================
// UNIVERSAL UI COMPONENTS
// Handles authentication UI across all pages
// =====================================================

class UniversalUI {
    constructor() {
        this.currentPage = this.detectCurrentPage();
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupUI();
            });
        } else {
            this.setupUI();
        }
    }

    setupUI() {
        this.injectAuthButtons();
        this.setupAuthCallbacks();
        
        // Initial auth state check
        const isAuthenticated = universalAuthSystem.isAuthenticated();
        console.log(`Universal UI initialized for ${this.currentPage}, authenticated: ${isAuthenticated}`);
        
        this.updateUIBasedOnAuth(isAuthenticated, universalAuthSystem.getUserData());
    }

    // Detect current page
    detectCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        if (filename.includes('all-members')) return 'all-members';
        if (filename.includes('task-tracking')) return 'task-tracking';
        if (filename.includes('recruitment')) return 'recruitment';
        if (filename.includes('waiting-room')) return 'waiting-room';
        if (filename.includes('core-team')) return 'core-team';
        if (filename.includes('join')) return 'join';
        return 'dashboard';
    }

    // Inject authentication buttons into the page header
    injectAuthButtons() {
        // Find the header or create one
        let header = document.querySelector('header');
        if (!header) {
            // Look for existing header-like elements
            header = document.querySelector('.header, #header, [class*="header"]');
        }

        if (header) {
            this.addAuthButtonsToExistingHeader(header);
        } else {
            // Create a floating auth panel if no header found
            this.createFloatingAuthPanel();
        }
    }

    // Add auth buttons to existing header
    addAuthButtonsToExistingHeader(header) {
        // Look for existing button container
        let buttonContainer = header.querySelector('.flex.items-center.gap-3, .auth-buttons, [class*="button"]');
        
        if (!buttonContainer) {
            // Create button container
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex items-center gap-3';
            header.appendChild(buttonContainer);
        }

        // Remove existing auth buttons to avoid duplicates
        buttonContainer.querySelectorAll('.universal-auth-btn').forEach(btn => btn.remove());

        // Add auth buttons
        const authButtonsHTML = `
            <button id="universalLoginBtn" onclick="showAuthModal()" 
                    class="universal-auth-btn px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg">
                🔐 Admin Login
            </button>
            <button id="universalLogoutBtn" onclick="logout()" 
                    class="universal-auth-btn hidden px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg">
                🚪 Logout
            </button>
            <div id="universalUserInfo" class="universal-auth-btn hidden flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium border border-green-200">
                <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span id="universalUserName">Admin</span>
            </div>
        `;

        buttonContainer.insertAdjacentHTML('beforeend', authButtonsHTML);
    }

    // Create floating auth panel for pages without headers
    createFloatingAuthPanel() {
        const panelHTML = `
            <div id="universalAuthPanel" class="fixed top-4 right-4 z-[150] flex items-center gap-3">
                <button id="universalLoginBtn" onclick="showAuthModal()" 
                        class="universal-auth-btn px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg">
                    🔐 Admin Login
                </button>
                <button id="universalLogoutBtn" onclick="logout()" 
                        class="universal-auth-btn hidden px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg">
                    🚪 Logout
                </button>
                <div id="universalUserInfo" class="universal-auth-btn hidden flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium border border-green-200 shadow-lg">
                    <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span id="universalUserName">Admin</span>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', panelHTML);
    }

    // Setup authentication callbacks
    setupAuthCallbacks() {
        universalAuthSystem.onAuthChange((isAuthenticated, userData) => {
            this.updateUIBasedOnAuth(isAuthenticated, userData);
            this.notifyPageOfAuthChange(isAuthenticated, userData);
        });
    }

    // Update UI based on authentication status
    updateUIBasedOnAuth(isAuthenticated = null, userData = null) {
        if (isAuthenticated === null) {
            isAuthenticated = universalAuthSystem.isAuthenticated();
            userData = universalAuthSystem.getUserData();
        }

        const loginBtn = document.getElementById('universalLoginBtn');
        const logoutBtn = document.getElementById('universalLogoutBtn');
        const userInfo = document.getElementById('universalUserInfo');
        const userName = document.getElementById('universalUserName');

        if (isAuthenticated) {
            // Show authenticated state
            if (loginBtn) loginBtn.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            if (userInfo) userInfo.classList.remove('hidden');
            if (userName && userData) {
                userName.textContent = userData.username || 'Admin';
            }

            // Update page-specific elements
            this.updatePageAuthElements(true);
            
        } else {
            // Show unauthenticated state
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (userInfo) userInfo.classList.add('hidden');

            // Update page-specific elements
            this.updatePageAuthElements(false);
        }
    }

    // Update page-specific authentication elements
    updatePageAuthElements(isAuthenticated) {
        // Update status indicators
        const statusElements = document.querySelectorAll('#authStatus, #crudStatus, .auth-status');
        statusElements.forEach(element => {
            if (isAuthenticated) {
                element.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm';
                element.innerHTML = '<span class="font-medium">✅ Admin Mode:</span> Full administrative features are active! You can create, edit, and manage all content.';
            } else {
                element.className = 'mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm';
                element.innerHTML = '<span class="font-medium">👀 View Mode:</span> You can view content. <button onclick="showAuthModal()" class="text-yellow-600 hover:text-yellow-800 underline font-medium">Login as admin</button> to enable full features.';
            }
        });

        // Show/hide admin buttons
        const adminButtons = document.querySelectorAll(
            '#createMemberBtn, #createTaskBtn, #bulkImportBtn, .admin-only, [class*="admin-"], .edit-btn, .delete-btn'
        );
        adminButtons.forEach(button => {
            if (isAuthenticated) {
                button.classList.remove('hidden');
            } else {
                button.classList.add('hidden');
            }
        });

        // Show/hide legacy login buttons
        const legacyLoginButtons = document.querySelectorAll('#adminLoginBtn, .login-btn');
        legacyLoginButtons.forEach(button => {
            button.classList.add('hidden'); // Always hide legacy buttons
        });

        // Show/hide legacy logout buttons
        const legacyLogoutButtons = document.querySelectorAll('#endSessionBtn, .logout-btn');
        legacyLogoutButtons.forEach(button => {
            if (isAuthenticated) {
                button.classList.add('hidden'); // Hide legacy logout, use universal one
            } else {
                button.classList.add('hidden');
            }
        });
    }

    // Notify page-specific code of authentication changes
    notifyPageOfAuthChange(isAuthenticated, userData) {
        // Trigger custom events for page-specific handling
        const authEvent = new CustomEvent('universalAuthChange', {
            detail: { isAuthenticated, userData }
        });
        document.dispatchEvent(authEvent);

        // Update legacy auth states for compatibility
        if (window.authState) {
            window.authState.isAuthenticated = isAuthenticated;
            window.authState.sessionStart = isAuthenticated ? Date.now() : null;
        }

        // Notify specific page handlers
        switch (this.currentPage) {
            case 'all-members':
                this.handleAllMembersAuth(isAuthenticated);
                break;
            case 'task-tracking':
                this.handleTaskTrackingAuth(isAuthenticated);
                break;
            case 'recruitment':
                this.handleRecruitmentAuth(isAuthenticated);
                break;
        }
    }

    // Handle all-members page authentication
    handleAllMembersAuth(isAuthenticated) {
        // Update legacy auth state
        if (window.authState) {
            window.authState.isAuthenticated = isAuthenticated;
            window.authState.sessionStart = isAuthenticated ? Date.now() : null;
        }

        // Re-render table if function exists
        if (typeof renderTable === 'function') {
            renderTable();
        }
    }

    // Handle task-tracking page authentication
    handleTaskTrackingAuth(isAuthenticated) {
        // Update task tracking auth state
        if (window.authState) {
            window.authState.isAuthenticated = isAuthenticated;
            window.authState.sessionStart = isAuthenticated ? Date.now() : null;
        }

        // Update task UI if it exists
        if (window.taskUI && typeof window.taskUI.updateAuthUI === 'function') {
            window.taskUI.updateAuthUI(isAuthenticated);
        }
    }

    // Handle recruitment page authentication
    handleRecruitmentAuth(isAuthenticated) {
        // Update recruitment-specific elements
        const statusSelects = document.querySelectorAll('select[onchange*="updateStatus"]');
        statusSelects.forEach(select => {
            select.disabled = !isAuthenticated;
        });
    }

    // Add authentication status to page
    addAuthStatusToPage() {
        // Look for existing status area or create one
        let statusArea = document.querySelector('#authStatus, .auth-status');
        
        if (!statusArea) {
            // Find main content area
            const mainContent = document.querySelector('main, .main-content, #main, .container');
            if (mainContent) {
                statusArea = document.createElement('div');
                statusArea.id = 'authStatus';
                statusArea.className = 'mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm';
                mainContent.insertBefore(statusArea, mainContent.firstChild);
            }
        }

        if (statusArea) {
            this.updatePageAuthElements(universalAuthSystem.isAuthenticated());
        }
    }
}

// Initialize Universal UI
const universalUI = new UniversalUI();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { universalUI, UniversalUI };
}
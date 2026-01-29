// =====================================================
// ENHANCED TASK TRACKING WITH MODERN FEATURES
// Full CRUD, Import/Export, Dynamic Teams, Status Management
// =====================================================

// Authentication state - now managed by universal auth
const authState = {
  get isAuthenticated() { return window.universalAuth?.isAuthenticated || false; },
  get sessionStart() { return window.universalAuth?.sessionStart || null; },
  sessionDuration: 6 * 60 * 60 * 1000, // 6 hours
  credentials: { username: 'admin', password: 'admin123' }
};

// Global state
let currentTaskForStatus = null;
let uploadedFile = null;
let parsedFileData = [];

class TaskTracker {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentUser = null;
        this.userRole = null;
        this.userTeam = null;
        this.userEmail = null;
        this.userId = null;
        
        this.initializeUser();
    }

    async initializeUser() {
        try {
            if (authState.isAuthenticated) {
                this.currentUser = { email: 'admin@prm.com' };
                this.userEmail = 'admin@prm.com';
                await this.loadUserContext();
                return;
            }

            const { data: { user } } = await this.supabase.auth.getUser();
            if (user) {
                this.currentUser = user;
                this.userEmail = user.email;
                await this.loadUserContext();
            } else {
                console.log('No authenticated user - using view-only mode');
                this.showAuthRequired();
            }
        } catch (error) {
            console.error('Error initializing user:', error);
            this.showAuthRequired();
        }
    }

    async loadUserContext() {
        try {
            if (authState.isAuthenticated && this.userEmail === 'admin@prm.com') {
                this.userId = 1;
                this.userRole = 'Admin';
                this.userTeam = 'Core Team';
                this.userData = {
                    id: 1, email: 'admin@prm.com', name: 'Admin User',
                    position: 'Admin', team_name: 'Core Team'
                };
                console.log('Mock admin user context loaded');
                return;
            }

            const { data, error } = await this.supabase
                .from('prm_members')
                .select('id, email, name, position, team_name, phone, scout_group, district, stage')
                .eq('email', this.userEmail)
                .single();

            if (error) {
                console.error('User context error:', error);
                this.showUserNotFound();
                return;
            }

            this.userId = data.id;
            this.userRole = data.position;
            this.userTeam = data.team_name;
            this.userData = data;
        } catch (error) {
            console.error('Error loading user context:', error);
            this.showUserNotFound();
        }
    }
    showAuthRequired() {
        const errorEl = document.getElementById('errorAlert');
        const messageEl = document.getElementById('errorMessage');
        if (errorEl && messageEl) {
            messageEl.textContent = 'Authentication required. Please log in to access task management features.';
            errorEl.classList.remove('hidden');
        }
    }

    showUserNotFound() {
        const errorEl = document.getElementById('errorAlert');
        const messageEl = document.getElementById('errorMessage');
        if (errorEl && messageEl) {
            messageEl.textContent = `User ${this.userEmail} not found in members database. Please contact admin.`;
            errorEl.classList.remove('hidden');
        }
    }

    // Enhanced create task with better validation
    async createTask(taskData) {
        try {
            if (!this.canCreateTask()) {
                throw new Error('You do not have permission to create tasks');
            }

            // Get the selected member to ensure we have correct team info
            const selectedMember = this.getMemberById(taskData.assigned_to);
            
            const task = {
                title: taskData.title.trim(),
                description: taskData.description?.trim() || null,
                assigned_by: this.userId,
                assigned_to: taskData.assigned_to,
                status: taskData.status || 'pending',
                priority: taskData.priority || 'medium',
                points: taskData.points || 1,
                deadline: taskData.deadline || null,
                team_name: selectedMember.team_name || taskData.team_name // Use member's team or fallback to selected team
            };

            // For demo, add to mock data
            const newTask = {
                id: Date.now(),
                ...task,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                completed_at: task.status === 'completed' ? new Date().toISOString() : null,
                assigned_by_member: { 
                    id: this.userId, 
                    name: this.userData?.name || 'Admin User', 
                    email: this.userData?.email || 'admin@prm.com',
                    team_name: this.userData?.team_name || 'Core Team',
                    position: this.userData?.position || 'Admin'
                },
                assigned_to_member: selectedMember
            };

            console.log('Task created successfully:', newTask);
            console.log('Selected member:', selectedMember);
            return { success: true, data: newTask };

        } catch (error) {
            console.error('Error creating task:', error);
            return { success: false, error: error.message };
        }
    }

    // Get member by ID - now uses real members data from TaskTrackingUI
    getMemberById(id) {
        // First try to get from TaskTrackingUI's loaded members
        if (window.taskUI && window.taskUI.members && window.taskUI.members.length > 0) {
            const member = window.taskUI.members.find(m => m.id === parseInt(id));
            if (member) {
                return member;
            }
        }
        
        // Fallback to mock members
        const mockMembers = this.getMockMembers();
        return mockMembers.find(m => m.id === parseInt(id)) || { 
            id, name: 'Unknown Member', email: 'unknown@prm.com', 
            team_name: 'Unknown', position: 'Member' 
        };
    }

    // Get mock members data with comprehensive team coverage
    getMockMembers() {
        return [
            // Core Team
            { id: 1, name: 'Admin User', email: 'admin@prm.com', team_name: 'Core Team', position: 'Admin' },
            { id: 10, name: 'Core Team Lead', email: 'core@prm.com', team_name: 'Core Team', position: 'Coordinator' },
            { id: 11, name: 'Core Member 1', email: 'core1@prm.com', team_name: 'Core Team', position: 'Member' },
            { id: 12, name: 'Core Member 2', email: 'core2@prm.com', team_name: 'Core Team', position: 'Member' },
            
            // Graphics Design Team
            { id: 2, name: 'John Doe', email: 'john@prm.com', team_name: 'Graphics Design', position: 'Coordinator' },
            { id: 13, name: 'Alice Johnson', email: 'alice@prm.com', team_name: 'Graphics Design', position: 'Member' },
            { id: 14, name: 'Bob Wilson', email: 'bob@prm.com', team_name: 'Graphics Design', position: 'Member' },
            
            // Content Writing Team
            { id: 3, name: 'Jane Smith', email: 'jane@prm.com', team_name: 'Content Writing', position: 'Coordinator' },
            { id: 15, name: 'Carol Davis', email: 'carol@prm.com', team_name: 'Content Writing', position: 'Member' },
            { id: 16, name: 'David Brown', email: 'david2@prm.com', team_name: 'Content Writing', position: 'Member' },
            
            // Social Media Team
            { id: 4, name: 'Mike Johnson', email: 'mike@prm.com', team_name: 'Social Media', position: 'Coordinator' },
            { id: 17, name: 'Emma Wilson', email: 'emma@prm.com', team_name: 'Social Media', position: 'Member' },
            { id: 18, name: 'Frank Miller', email: 'frank@prm.com', team_name: 'Social Media', position: 'Member' },
            
            // Video Editing Team
            { id: 5, name: 'Sarah Wilson', email: 'sarah@prm.com', team_name: 'Video Editing', position: 'Coordinator' },
            { id: 19, name: 'Grace Lee', email: 'grace@prm.com', team_name: 'Video Editing', position: 'Member' },
            { id: 20, name: 'Henry Taylor', email: 'henry@prm.com', team_name: 'Video Editing', position: 'Member' },
            
            // Photography Team
            { id: 6, name: 'David Brown', email: 'david@prm.com', team_name: 'Photography', position: 'Coordinator' },
            { id: 21, name: 'Ivy Chen', email: 'ivy@prm.com', team_name: 'Photography', position: 'Member' },
            { id: 22, name: 'Jack Anderson', email: 'jack@prm.com', team_name: 'Photography', position: 'Member' },
            
            // Research & Development Team
            { id: 7, name: 'Lisa Davis', email: 'lisa@prm.com', team_name: 'Research & Development', position: 'Coordinator' },
            { id: 23, name: 'Kevin White', email: 'kevin@prm.com', team_name: 'Research & Development', position: 'Member' },
            { id: 24, name: 'Laura Green', email: 'laura@prm.com', team_name: 'Research & Development', position: 'Member' },
            
            // Rover Paper Team
            { id: 8, name: 'Tom Wilson', email: 'tom@prm.com', team_name: 'Rover Paper', position: 'Coordinator' },
            { id: 25, name: 'Mark Thompson', email: 'mark@prm.com', team_name: 'Rover Paper', position: 'Member' },
            { id: 26, name: 'Nancy Clark', email: 'nancy@prm.com', team_name: 'Rover Paper', position: 'Member' },
            
            // Presentation Team
            { id: 9, name: 'Amy Chen', email: 'amy@prm.com', team_name: 'Presentation', position: 'Coordinator' },
            { id: 27, name: 'Oliver Martinez', email: 'oliver@prm.com', team_name: 'Presentation', position: 'Member' },
            { id: 28, name: 'Paula Rodriguez', email: 'paula@prm.com', team_name: 'Presentation', position: 'Member' }
        ];
    }

    // Enhanced get tasks with mock data
    async getTasks(filters = {}) {
        try {
            // Mock tasks data with all teams including Core Team
            const mockTasks = [
                {
                    id: 1, title: 'Design Social Media Graphics', 
                    description: 'Create graphics for upcoming campaign',
                    status: 'in_progress', priority: 'high', points: 5,
                    deadline: '2024-02-15', created_at: '2024-02-01T10:00:00Z',
                    assigned_by: 1, assigned_to: 2,
                    assigned_by_member: this.getMemberById(1),
                    assigned_to_member: this.getMemberById(2)
                },
                {
                    id: 2, title: 'Write Blog Content',
                    description: 'Create content for website blog',
                    status: 'pending', priority: 'medium', points: 3,
                    deadline: '2024-02-20', created_at: '2024-02-02T14:00:00Z',
                    assigned_by: 1, assigned_to: 3,
                    assigned_by_member: this.getMemberById(1),
                    assigned_to_member: this.getMemberById(3)
                },
                {
                    id: 3, title: 'Core Team Meeting Preparation',
                    description: 'Prepare agenda and materials for monthly core team meeting',
                    status: 'completed', priority: 'high', points: 8,
                    deadline: '2024-02-10', created_at: '2024-02-01T09:00:00Z',
                    completed_at: '2024-02-09T16:00:00Z',
                    assigned_by: 1, assigned_to: 10,
                    assigned_by_member: this.getMemberById(1),
                    assigned_to_member: this.getMemberById(10)
                }
            ];

            // Apply filters
            let filteredTasks = mockTasks;
            
            if (filters.status) {
                filteredTasks = filteredTasks.filter(task => task.status === filters.status);
            }
            if (filters.team_name) {
                filteredTasks = filteredTasks.filter(task => 
                    task.assigned_to_member.team_name === filters.team_name
                );
            }
            if (filters.assigned_to_id) {
                filteredTasks = filteredTasks.filter(task => task.assigned_to === filters.assigned_to_id);
            }
            if (filters.priority) {
                filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
            }

            return { success: true, data: filteredTasks };

        } catch (error) {
            console.error('Error fetching tasks:', error);
            return { success: false, error: error.message };
        }
    }
    // Update task with enhanced status tracking
    async updateTask(taskId, updates) {
        try {
            if (!this.canEditTask()) {
                throw new Error('You do not have permission to edit tasks');
            }

            // For demo, simulate update
            console.log('Task updated:', { taskId, updates });
            
            // If status is being changed to completed, set completed_at
            if (updates.status === 'completed') {
                updates.completed_at = new Date().toISOString();
            } else if (updates.status !== 'completed') {
                updates.completed_at = null;
            }

            return { success: true, data: { id: taskId, ...updates } };

        } catch (error) {
            console.error('Error updating task:', error);
            return { success: false, error: error.message };
        }
    }

    // Get team members with enhanced team list
    async getTeamMembers(teamName = null) {
        try {
            // First try to get real data from Supabase
            let query = this.supabase
                .from('prm_members')
                .select('id, name, email, team_name, position, phone, scout_group, district, stage');
            
            if (teamName) {
                query = query.eq('team_name', teamName);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.warn('Supabase query failed, using mock data:', error);
                // Fallback to mock data
                const mockMembers = this.getMockMembers();
                let filteredMembers = mockMembers;
                if (teamName) {
                    filteredMembers = mockMembers.filter(member => member.team_name === teamName);
                }
                return { success: true, data: filteredMembers };
            }
            
            if (data && data.length > 0) {
                console.log(`Loaded ${data.length} real members from database${teamName ? ` for team: ${teamName}` : ''}`);
                return { success: true, data: data };
            } else {
                console.log('No real data found, using mock data');
                // Fallback to mock data if no real data
                const mockMembers = this.getMockMembers();
                let filteredMembers = mockMembers;
                if (teamName) {
                    filteredMembers = mockMembers.filter(member => member.team_name === teamName);
                }
                return { success: true, data: filteredMembers };
            }

        } catch (error) {
            console.error('Error fetching team members:', error);
            // Fallback to mock data on error
            const mockMembers = this.getMockMembers();
            let filteredMembers = mockMembers;
            if (teamName) {
                filteredMembers = mockMembers.filter(member => member.team_name === teamName);
            }
            return { success: true, data: filteredMembers };
        }
    }

    // Enhanced dashboard summary
    async getDashboardSummary() {
        try {
            const tasksResult = await this.getTasks();
            const tasks = tasksResult.success ? tasksResult.data : [];
            
            const summary = {
                total_tasks: tasks.length,
                total_completed: tasks.filter(t => t.status === 'completed').length,
                total_in_progress: tasks.filter(t => t.status === 'in_progress').length,
                total_pending: tasks.filter(t => t.status === 'pending').length,
                total_overdue: tasks.filter(t => 
                    t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed'
                ).length,
                total_points_earned: tasks
                    .filter(t => t.status === 'completed')
                    .reduce((sum, t) => sum + (t.points || 0), 0),
                total_points_possible: tasks.reduce((sum, t) => sum + (t.points || 0), 0)
            };

            return { success: true, data: summary };

        } catch (error) {
            console.error('Error fetching dashboard summary:', error);
            return { success: false, error: error.message };
        }
    }

    // Permission helpers
    canCreateTask() {
        return this.checkSession() && (this.userRole === 'Admin' || this.userRole === 'Coordinator');
    }

    canEditTask() {
        return this.checkSession();
    }

    checkSession() {
        return window.isAuthenticated ? window.isAuthenticated() : false;
    }

    // Enhanced team list including Core Team
    getAvailableTeams() {
        return [
            'Core Team',
            'Graphics Design',
            'Content Writing', 
            'Social Media',
            'Video Editing',
            'Photography',
            'Research & Development',
            'Rover Paper',
            'Presentation'
        ];
    }

    // Bulk import tasks
    async bulkImportTasks(tasksData) {
        try {
            if (!this.canCreateTask()) {
                throw new Error('You do not have permission to import tasks');
            }

            const results = [];
            for (const taskData of tasksData) {
                const result = await this.createTask(taskData);
                results.push(result);
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            return { 
                success: true, 
                data: { successful, failed, total: tasksData.length, results }
            };

        } catch (error) {
            console.error('Error bulk importing tasks:', error);
            return { success: false, error: error.message };
        }
    }

    // Export tasks to CSV
    async exportTasksToCSV() {
        try {
            const result = await this.getTasks();
            if (!result.success) throw new Error(result.error);

            const tasks = result.data;
            const csvHeaders = [
                'ID', 'Title', 'Description', 'Assigned By', 'Assigned To', 'Team',
                'Status', 'Priority', 'Points', 'Deadline', 'Created At', 'Completed At'
            ];

            const csvRows = tasks.map(task => [
                task.id,
                `"${task.title}"`,
                `"${task.description || ''}"`,
                task.assigned_by_member?.name || '',
                task.assigned_to_member?.name || '',
                task.assigned_to_member?.team_name || '',
                task.status,
                task.priority,
                task.points,
                task.deadline || '',
                task.created_at,
                task.completed_at || ''
            ]);

            const csvContent = [csvHeaders, ...csvRows]
                .map(row => row.join(','))
                .join('\n');

            return { success: true, data: csvContent };

        } catch (error) {
            console.error('Error exporting tasks:', error);
            return { success: false, error: error.message };
        }
    }
}
// Enhanced UI Controller with all new features
class TaskTrackingUI {
    constructor() {
        this.taskTracker = null;
        this.currentTab = 'all';
        this.tasks = [];
        this.teams = [];
        this.members = [];
        
        this.init();
    }

    async init() {
        try {
            this.checkSession();
            this.taskTracker = new TaskTracker(supabaseClient);
            
            // Test database connection
            await this.testDatabaseConnection();
            
            this.setupEventListeners();
            await this.loadInitialData();
            await this.loadTasks();
        } catch (error) {
            console.error('Error initializing Task Tracking UI:', error);
            this.showError('Failed to initialize task tracking system');
        }
    }

    async testDatabaseConnection() {
        try {
            console.log('Testing database connection...');
            const { data, error } = await this.taskTracker.supabase
                .from('prm_members')
                .select('count')
                .limit(1);
            
            if (error) {
                console.warn('Database connection test failed:', error);
                this.showError('Database connection failed - using demo data');
            } else {
                console.log('Database connection successful');
            }
        } catch (error) {
            console.warn('Database connection test error:', error);
        }
    }

    checkSession() {
        return window.isAuthenticated ? window.isAuthenticated() : false;
    }

    updateAuthUI(isAuthenticated) {
        const authStatus = document.getElementById('authStatus');
        const createTaskBtn = document.getElementById('createTaskBtn');
        const bulkImportBtn = document.getElementById('bulkImportBtn');
        
        if (isAuthenticated) {
            if (authStatus) {
                authStatus.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm';
                authStatus.innerHTML = '<span class="font-medium">✅ Admin Mode:</span> Full task management features are active! Create, edit, import, and manage all tasks.';
            }
            
            if (createTaskBtn) createTaskBtn.classList.remove('hidden');
            if (bulkImportBtn) bulkImportBtn.classList.remove('hidden');
        } else {
            if (authStatus) {
                authStatus.className = 'mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm';
                authStatus.innerHTML = '<span class="font-medium">👀 View Mode:</span> You can view tasks and analytics. <button onclick="showAuthModal()" class="text-yellow-600 hover:text-yellow-800 underline font-medium">Login as admin</button> to enable full task management features.';
            }
            
            if (createTaskBtn) createTaskBtn.classList.add('hidden');
            if (bulkImportBtn) bulkImportBtn.classList.add('hidden');
        }
        
        const contextEl = document.getElementById('userContext');
        if (contextEl) {
            if (isAuthenticated && this.taskTracker?.userData) {
                contextEl.textContent = `${this.taskTracker.userData.position} - ${this.taskTracker.userData.team_name}`;
            } else {
                contextEl.textContent = 'View Only Mode';
            }
        }
    }

    setupEventListeners() {
        // Mobile menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('-translate-x-full');
            document.getElementById('menuOverlay').classList.remove('hidden');
        });

        document.getElementById('menuOverlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('-translate-x-full');
            document.getElementById('menuOverlay').classList.add('hidden');
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Import tab switching
        document.querySelectorAll('.import-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchImportTab(tab);
            });
        });

        // Button event listeners
        document.getElementById('createTaskBtn')?.addEventListener('click', () => {
            if (this.checkSession()) {
                this.openCreateTaskModal();
            } else {
                this.showError('Please log in to create tasks');
            }
        });

        document.getElementById('bulkImportBtn')?.addEventListener('click', () => {
            if (this.checkSession()) {
                this.openBulkImportModal();
            } else {
                this.showError('Please log in to import tasks');
            }
        });

        document.getElementById('exportTasksBtn')?.addEventListener('click', () => {
            this.exportTasks();
        });

        // Listen for universal auth changes
        document.addEventListener('universalAuthChange', (e) => {
            const { isAuthenticated } = e.detail;
            console.log('Task tracking: Universal auth change detected:', isAuthenticated);
            this.updateAuthUI(isAuthenticated);
            
            // Re-initialize user context if authenticated
            if (isAuthenticated && this.taskTracker) {
                this.taskTracker.initializeUser();
            }
        });

        // Form submissions
        document.getElementById('createTaskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });

        // Team selection for member loading
        document.getElementById('taskTeam')?.addEventListener('change', (e) => {
            console.log('Team selection changed:', e.target.value);
            this.loadTeamMembers();
        });
        document.getElementById('manualTaskTeam')?.addEventListener('change', (e) => {
            console.log('Manual team selection changed:', e.target.value);
            this.loadManualTeamMembers();
        });

        // Authentication modal event listeners
        const adminPass = document.getElementById('adminPass');
        if (adminPass) {
            adminPass.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleLogin();
                }
            });
        }

        const adminUser = document.getElementById('adminUser');
        if (adminUser) {
            adminUser.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const passInput = document.getElementById('adminPass');
                    if (passInput) {
                        passInput.focus();
                    }
                }
            });
        }

        // Auto-check session every minute
        setInterval(() => {
            if (authState.isAuthenticated && !checkSession()) {
                showMessage('Session expired', 'info');
            }
        }, 60000);

        // File drag and drop
        const fileUploadArea = document.getElementById('fileUploadArea');
        if (fileUploadArea) {
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.classList.add('border-blue-400', 'bg-blue-50');
            });

            fileUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('border-blue-400', 'bg-blue-50');
            });

            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.classList.remove('border-blue-400', 'bg-blue-50');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    document.getElementById('taskFileInput').files = files;
                    handleFileUpload({ target: { files } });
                }
            });
        }
    }
    async loadInitialData() {
        this.showLoading();
        
        try {
            // Load teams from database first, then fallback to static list
            await this.loadTeamsFromDatabase();
            this.populateTeamFilters();
            
            // Always load members (both authenticated and non-authenticated for demo)
            const membersResult = await this.taskTracker.getTeamMembers();
            if (membersResult.success) {
                this.members = membersResult.data;
                console.log('Initial members loaded:', this.members.length);
                
                // Update teams list based on actual member data
                if (this.members.length > 0) {
                    const realTeams = [...new Set(this.members.map(m => m.team_name).filter(Boolean))];
                    if (realTeams.length > 0) {
                        this.teams = realTeams.sort();
                        console.log('Updated teams from member data:', this.teams);
                        this.populateTeamFilters();
                    }
                }
            } else {
                // Fallback to mock data
                this.members = this.taskTracker.getMockMembers();
                console.log('Using mock members data:', this.members.length);
            }
            
            // Load dashboard stats
            await this.loadDashboardStats();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            // Ensure we have mock data as fallback
            this.members = this.taskTracker.getMockMembers();
            this.teams = this.taskTracker.getAvailableTeams();
            this.populateTeamFilters();
            this.showError('Failed to load initial data, using demo data');
        } finally {
            this.hideLoading();
        }
    }

    async loadTeamsFromDatabase() {
        try {
            console.log('Loading teams from database...');
            
            // First, let's see what's actually in the database
            const { data: sampleData, error: sampleError } = await this.taskTracker.supabase
                .from('prm_members')
                .select('*')
                .limit(5);
            
            if (sampleError) {
                console.warn('Cannot access prm_members table:', sampleError);
            } else {
                console.log('Sample data from prm_members:', sampleData);
            }
            
            // Try to get unique team names from the database
            const { data, error } = await this.taskTracker.supabase
                .from('prm_members')
                .select('team_name')
                .not('team_name', 'is', null);
            
            if (error) {
                console.warn('Failed to load teams from database:', error);
                this.teams = this.taskTracker.getAvailableTeams();
                return;
            }
            
            if (data && data.length > 0) {
                console.log('Raw team data from database:', data);
                const uniqueTeams = [...new Set(data.map(item => item.team_name).filter(Boolean))];
                if (uniqueTeams.length > 0) {
                    this.teams = uniqueTeams.sort();
                    console.log('Loaded teams from database:', this.teams);
                    return;
                }
            }
            
            // Fallback to static teams
            this.teams = this.taskTracker.getAvailableTeams();
            console.log('Using fallback teams:', this.teams);
            
        } catch (error) {
            console.error('Error loading teams from database:', error);
            this.teams = this.taskTracker.getAvailableTeams();
        }
    }

    async loadDashboardStats() {
        try {
            const result = await this.taskTracker.getDashboardSummary();
            if (result.success) {
                this.renderDashboardStats(result.data);
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    renderDashboardStats(stats) {
        const container = document.getElementById('dashboardStats');
        if (!container || !stats) return;

        const completionRate = stats.total_tasks > 0 ? 
            Math.round((stats.total_completed / stats.total_tasks) * 100) : 0;

        container.innerHTML = `
            <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span class="text-blue-600 text-xl">📋</span>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-900">${stats.total_tasks || 0}</p>
                        <p class="text-sm text-gray-600">Total Tasks</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <span class="text-green-600 text-xl">✅</span>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-900">${stats.total_completed || 0}</p>
                        <p class="text-sm text-gray-600">Completed</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                        <span class="text-yellow-600 text-xl">⏳</span>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-900">${stats.total_in_progress || 0}</p>
                        <p class="text-sm text-gray-600">In Progress</p>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                        <span class="text-purple-600 text-xl">🎯</span>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-900">${completionRate}%</p>
                        <p class="text-sm text-gray-600">Completion Rate</p>
                    </div>
                </div>
            </div>
        `;
    }

    populateTeamFilters() {
        const selectors = ['#teamFilter', '#taskTeam', '#manualTaskTeam'];
        
        selectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = '<option value="">Select Team</option>';
                this.teams.forEach(team => {
                    element.innerHTML += `<option value="${team}">${team}</option>`;
                });
            }
        });
    }

    async loadTeamMembers() {
        console.log('loadTeamMembers called');
        const teamSelect = document.getElementById('taskTeam');
        const memberSelect = document.getElementById('taskAssignTo');
        
        if (!teamSelect || !memberSelect) {
            console.log('Team or member select not found');
            return;
        }
        
        const selectedTeam = teamSelect.value;
        console.log('Selected team:', selectedTeam);
        
        memberSelect.innerHTML = '<option value="">Loading members...</option>';
        
        if (selectedTeam) {
            try {
                console.log('Fetching members for team:', selectedTeam);
                const result = await this.taskTracker.getTeamMembers(selectedTeam);
                
                if (result.success && result.data.length > 0) {
                    console.log('Loaded team members:', result.data.length);
                    memberSelect.innerHTML = '<option value="">Select Member</option>';
                    
                    result.data.forEach(member => {
                        const optionText = `${member.name} (${member.position || 'Member'})`;
                        memberSelect.innerHTML += `<option value="${member.id}">${optionText}</option>`;
                        console.log('Added member option:', optionText);
                    });
                    
                    console.log('Total options in dropdown:', memberSelect.options.length);
                } else {
                    console.log('No members found for team:', selectedTeam);
                    memberSelect.innerHTML = '<option value="">No members found</option>';
                }
            } catch (error) {
                console.error('Error loading team members:', error);
                memberSelect.innerHTML = '<option value="">Error loading members</option>';
            }
        } else {
            memberSelect.innerHTML = '<option value="">Select Member</option>';
        }
    }

    async loadTasks() {        
        memberSelect.innerHTML = '<option value="">Select Member</option>';
        
        if (selectedTeam) {
            // Get fresh member data for the selected team
            try {
                const result = await this.taskTracker.getTeamMembers(selectedTeam);
                if (result.success && result.data.length > 0) {
                    console.log('Loaded team members from API:', result.data.length);
                    result.data.forEach(member => {
                        memberSelect.innerHTML += `<option value="${member.id}">${member.name} (${member.position})</option>`;
                    });
                } else {
                    // Fallback to cached members if API call fails
                    const teamMembers = this.members.filter(member => member.team_name === selectedTeam);
                    console.log('Using cached team members:', teamMembers.length);
                    teamMembers.forEach(member => {
                        memberSelect.innerHTML += `<option value="${member.id}">${member.name} (${member.position})</option>`;
                    });
                }
            } catch (error) {
                console.error('Error loading team members:', error);
                // Fallback to cached members
                const teamMembers = this.members.filter(member => member.team_name === selectedTeam);
                console.log('Using cached team members (error fallback):', teamMembers.length);
                teamMembers.forEach(member => {
                    memberSelect.innerHTML += `<option value="${member.id}">${member.name} (${member.position})</option>`;
                });
            }
        }
    }

    async loadManualTeamMembers() {
        const teamSelect = document.getElementById('manualTaskTeam');
        const memberSelect = document.getElementById('manualTaskAssignTo');
        
        if (!teamSelect || !memberSelect) return;
        
        const selectedTeam = teamSelect.value;
        memberSelect.innerHTML = '<option value="">Loading members...</option>';
        
        if (selectedTeam) {
            try {
                console.log('Fetching manual team members for:', selectedTeam);
                const result = await this.taskTracker.getTeamMembers(selectedTeam);
                
                if (result.success && result.data.length > 0) {
                    memberSelect.innerHTML = '<option value="">Select Member</option>';
                    result.data.forEach(member => {
                        const optionText = `${member.name} (${member.position || 'Member'})`;
                        memberSelect.innerHTML += `<option value="${member.id}">${optionText}</option>`;
                    });
                } else {
                    memberSelect.innerHTML = '<option value="">No members found</option>';
                }
            } catch (error) {
                console.error('Error loading manual team members:', error);
                memberSelect.innerHTML = '<option value="">Error loading members</option>';
            }
        } else {
            memberSelect.innerHTML = '<option value="">Select Member</option>';
        }
    }
    async loadTasks() {
        this.showLoading();
        
        try {
            const result = await this.taskTracker.getTasks();
            if (result.success) {
                this.tasks = result.data;
                this.renderTasks();
                this.updateTaskCount();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showError('Failed to load tasks');
        } finally {
            this.hideLoading();
        }
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">📝</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">No Tasks Found</h3>
                    <p class="text-gray-600 mb-4">No tasks available to display.</p>
                    ${this.checkSession() ? 
                        '<button onclick="taskUI.openCreateTaskModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors mr-2">Create Task</button><button onclick="taskUI.openBulkImportModal()" class="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors">Import Tasks</button>' : 
                        '<button onclick="showAuthModal()" class="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors">Login to Manage Tasks</button>'
                    }
                </div>
            `;
            return;
        }

        container.innerHTML = this.tasks.map(task => this.renderTaskCard(task)).join('');
    }

    renderTaskCard(task) {
        const priorityClass = `priority-${task.priority}`;
        const statusClass = `status-${task.status}`;
        const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';
        
        return `
            <div class="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 fade-in">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <h3 class="text-lg font-bold text-gray-900">${this.escapeHtml(task.title)}</h3>
                            ${isOverdue ? '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200 animate-pulse">OVERDUE</span>' : ''}
                        </div>
                        <p class="text-gray-600 text-sm mb-3">${this.escapeHtml(task.description || 'No description')}</p>
                        <div class="flex items-center gap-4 text-sm text-gray-500">
                            <span class="flex items-center gap-1">
                                <span>👥</span>
                                <span class="font-medium">${task.assigned_to_member?.team_name || 'Unknown Team'}</span>
                            </span>
                            <span class="flex items-center gap-1">
                                <span>👤</span>
                                <span class="font-medium">${task.assigned_to_member?.name || 'Unknown'}</span>
                            </span>
                            ${task.deadline ? `<span class="flex items-center gap-1"><span>📅</span><span class="font-medium">${this.formatDate(task.deadline)}</span></span>` : ''}
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-3 py-1 text-xs font-bold rounded-full border ${priorityClass}">
                            ${task.priority.toUpperCase()}
                        </span>
                        <span class="px-3 py-1 text-xs font-bold rounded-full border ${statusClass}">
                            ${task.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <div class="flex items-center gap-1 text-sm font-bold text-purple-600">
                            <span>🎯</span>
                            <span>${task.points} pts</span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div class="flex items-center gap-2 text-sm text-gray-500">
                        <span>Created by <span class="font-medium">${task.assigned_by_member?.name || 'Unknown'}</span></span>
                        <span>•</span>
                        <span>${this.formatRelativeTime(task.created_at)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${this.checkSession() ? `
                            <button onclick="taskUI.openStatusChangeModal(${task.id})" 
                                    class="px-3 py-1 bg-purple-50 text-purple-600 text-xs font-bold rounded-lg hover:bg-purple-100 transition-colors">
                                🔄 Status
                            </button>
                        ` : ''}
                        <button onclick="taskUI.viewTaskDetails(${task.id})" 
                                class="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                            👁️ Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Enhanced task detail view
    viewTaskDetails(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const modal = document.getElementById('taskDetailModal');
        const content = document.getElementById('taskDetailContent');
        
        const statusIcon = {
            'pending': '📋',
            'in_progress': '⏳',
            'completed': '✅'
        };

        const priorityColor = {
            'low': 'text-green-600 bg-green-100',
            'medium': 'text-yellow-600 bg-yellow-100',
            'high': 'text-red-600 bg-red-100'
        };

        content.innerHTML = `
            <div class="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h2 class="text-2xl font-bold text-gray-900 mb-2">${this.escapeHtml(task.title)}</h2>
                        <p class="text-gray-600 mb-4">${this.escapeHtml(task.description || 'No description provided')}</p>
                        <div class="flex items-center gap-4">
                            <span class="flex items-center gap-2 px-3 py-1 ${priorityColor[task.priority]} rounded-full text-sm font-bold">
                                ${task.priority.toUpperCase()} PRIORITY
                            </span>
                            <span class="flex items-center gap-2 text-sm font-medium text-gray-600">
                                ${statusIcon[task.status]} ${task.status.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <button onclick="closeTaskDetailModal()" class="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
                </div>
            </div>
            
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Assignment Details</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Assigned To:</span>
                                    <span class="font-medium">${task.assigned_to_member?.name || 'Unknown'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Team:</span>
                                    <span class="font-medium">${task.assigned_to_member?.team_name || 'Unknown'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Assigned By:</span>
                                    <span class="font-medium">${task.assigned_by_member?.name || 'Unknown'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Points:</span>
                                    <span class="font-bold text-purple-600">${task.points} pts</span>
                                </div>
                            </div>
                        </div>
                        
                        ${task.deadline ? `
                        <div>
                            <h3 class="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Timeline</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Deadline:</span>
                                    <span class="font-medium">${this.formatDate(task.deadline)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Days Remaining:</span>
                                    <span class="font-medium ${new Date(task.deadline) < new Date() ? 'text-red-600' : 'text-green-600'}">
                                        ${Math.ceil((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24))} days
                                    </span>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <h3 class="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Progress Tracking</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Created:</span>
                                    <span class="font-medium">${this.formatDate(task.created_at)}</span>
                                </div>
                                ${task.completed_at ? `
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Completed:</span>
                                    <span class="font-medium text-green-600">${this.formatDate(task.completed_at)}</span>
                                </div>
                                ` : ''}
                                <div class="flex justify-between">
                                    <span class="text-gray-600">Status:</span>
                                    <span class="font-medium">${task.status.replace('_', ' ').toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${authState.isAuthenticated ? `
                        <div>
                            <h3 class="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Actions</h3>
                            <div class="space-y-2">
                                <button onclick="taskUI.openStatusChangeModal(${task.id}); closeTaskDetailModal();" 
                                        class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm transition-colors">
                                    🔄 Change Status
                                </button>
                                <button onclick="alert('Edit functionality coming soon!')" 
                                        class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors">
                                    ✏️ Edit Task
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    // Status change modal
    openStatusChangeModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        currentTaskForStatus = task;
        
        document.getElementById('statusChangeTaskTitle').textContent = task.title;
        document.getElementById('currentStatus').textContent = task.status.replace('_', ' ').toUpperCase();
        document.getElementById('newTaskStatus').value = task.status;
        document.getElementById('statusChangeNotes').value = '';
        
        document.getElementById('statusChangeModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    async confirmStatusChange() {
        if (!currentTaskForStatus) return;

        const newStatus = document.getElementById('newTaskStatus').value;
        const notes = document.getElementById('statusChangeNotes').value;

        if (newStatus === currentTaskForStatus.status) {
            this.showError('Please select a different status');
            return;
        }

        try {
            const result = await this.taskTracker.updateTask(currentTaskForStatus.id, { 
                status: newStatus,
                notes: notes 
            });
            
            if (result.success) {
                // Update local task data
                const taskIndex = this.tasks.findIndex(t => t.id === currentTaskForStatus.id);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex].status = newStatus;
                    if (newStatus === 'completed') {
                        this.tasks[taskIndex].completed_at = new Date().toISOString();
                    }
                }
                
                this.showSuccess(`Task status updated to ${newStatus.replace('_', ' ')}`);
                this.closeStatusChangeModal();
                this.renderTasks();
                this.loadDashboardStats();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Failed to update task status');
        }
    }

    closeStatusChangeModal() {
        document.getElementById('statusChangeModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        currentTaskForStatus = null;
    }

    closeTaskDetailModal() {
        document.getElementById('taskDetailModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    // Import/Export functionality
    switchImportTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.import-tab-btn').forEach(btn => {
            btn.classList.remove('import-tab-active', 'border-blue-600', 'text-blue-600');
            btn.classList.add('import-tab-inactive', 'text-gray-600');
        });
        
        document.querySelector(`[data-tab="${tab}"]`).classList.remove('import-tab-inactive', 'text-gray-600');
        document.querySelector(`[data-tab="${tab}"]`).classList.add('import-tab-active', 'border-blue-600', 'text-blue-600');
        
        // Show/hide content
        document.querySelectorAll('.import-tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        if (tab === 'manual') {
            document.getElementById('manualImportContent').classList.remove('hidden');
        } else {
            document.getElementById('fileImportContent').classList.remove('hidden');
        }
    }

    openBulkImportModal() {
        if (!this.checkSession()) {
            this.showError('Please log in to import tasks');
            return;
        }
        
        // Populate team dropdowns and load members
        this.populateTeamFilters();
        
        // Ensure members are loaded
        if (this.members.length === 0) {
            this.loadAllMembers();
        }
        
        // Clear the assign to dropdown in manual tab
        const memberSelect = document.getElementById('manualTaskAssignTo');
        if (memberSelect) {
            memberSelect.innerHTML = '<option value="">Select Member</option>';
        }
        
        document.getElementById('bulkImportModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeBulkImportModal() {
        document.getElementById('bulkImportModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        this.clearFileImport();
        this.clearManualForm();
    }

    async addManualTask() {
        const taskData = {
            title: document.getElementById('manualTaskTitle').value.trim(),
            description: document.getElementById('manualTaskDescription').value.trim(),
            team_name: document.getElementById('manualTaskTeam').value,
            assigned_to: parseInt(document.getElementById('manualTaskAssignTo').value),
            status: document.getElementById('manualTaskStatus').value,
            priority: document.getElementById('manualTaskPriority').value,
            points: parseInt(document.getElementById('manualTaskPoints').value),
            deadline: document.getElementById('manualTaskDeadline').value || null
        };
        
        if (!taskData.title || !taskData.team_name || !taskData.assigned_to) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        try {
            const result = await this.taskTracker.createTask(taskData);
            if (result.success) {
                // Add to local tasks array
                this.tasks.push(result.data);
                
                this.showSuccess('Task added successfully!');
                this.clearManualForm();
                this.renderTasks();
                this.loadDashboardStats();
                this.updateTaskCount();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error adding manual task:', error);
            this.showError('Failed to add task');
        }
    }

    clearManualForm() {
        document.getElementById('manualTaskForm').reset();
        document.getElementById('manualTaskAssignTo').innerHTML = '<option value="">Select Member</option>';
    }

    // File handling
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        uploadedFile = file;
        
        // Show file preview
        document.getElementById('fileUploadArea').classList.add('hidden');
        document.getElementById('filePreview').classList.remove('hidden');
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = this.formatFileSize(file.size);
        
        // Parse file
        this.parseFile(file);
    }

    async parseFile(file) {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                this.showError('File must contain at least a header row and one data row');
                return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const rows = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                return row;
            });
            
            parsedFileData = rows;
            this.showFilePreview(headers, rows.slice(0, 5)); // Show first 5 rows
            
            document.getElementById('importFileBtn').disabled = false;
            
        } catch (error) {
            console.error('Error parsing file:', error);
            this.showError('Failed to parse file. Please check the format.');
        }
    }

    showFilePreview(headers, rows) {
        const headersRow = document.getElementById('previewHeaders');
        const rowsContainer = document.getElementById('previewRows');
        
        headersRow.innerHTML = headers.map(h => `<th class="px-3 py-2 text-left font-bold text-gray-700">${h}</th>`).join('');
        
        rowsContainer.innerHTML = rows.map(row => 
            `<tr class="border-t">${headers.map(h => `<td class="px-3 py-2 text-sm">${row[h] || ''}</td>`).join('')}</tr>`
        ).join('');
        
        document.getElementById('filePreviewTable').classList.remove('hidden');
    }

    async importFromFile() {
        if (!parsedFileData.length) {
            this.showError('No data to import');
            return;
        }
        
        try {
            this.showLoading();
            
            // Map file data to task format
            const tasksToImport = parsedFileData.map(row => ({
                title: row.title || row.Title || '',
                description: row.description || row.Description || '',
                team_name: row.team || row.Team || row.team_name || '',
                assigned_to: this.findMemberIdByName(row.assigned_to || row['Assigned To'] || ''),
                status: (row.status || row.Status || 'pending').toLowerCase(),
                priority: (row.priority || row.Priority || 'medium').toLowerCase(),
                points: parseInt(row.points || row.Points || '1'),
                deadline: row.deadline || row.Deadline || null
            })).filter(task => task.title && task.team_name && task.assigned_to);
            
            if (tasksToImport.length === 0) {
                this.showError('No valid tasks found in file');
                return;
            }
            
            const result = await this.taskTracker.bulkImportTasks(tasksToImport);
            
            if (result.success) {
                // Add successful tasks to local array
                result.data.results.forEach(r => {
                    if (r.success) {
                        this.tasks.push(r.data);
                    }
                });
                
                this.showSuccess(`Successfully imported ${result.data.successful} tasks`);
                this.closeBulkImportModal();
                this.renderTasks();
                this.loadDashboardStats();
                this.updateTaskCount();
            } else {
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('Error importing from file:', error);
            this.showError('Failed to import tasks from file');
        } finally {
            this.hideLoading();
        }
    }

    findMemberIdByName(name) {
        const member = this.members.find(m => 
            m.name.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(m.name.toLowerCase())
        );
        return member ? member.id : null;
    }

    clearFileImport() {
        document.getElementById('taskFileInput').value = '';
        document.getElementById('fileUploadArea').classList.remove('hidden');
        document.getElementById('filePreview').classList.add('hidden');
        document.getElementById('filePreviewTable').classList.add('hidden');
        document.getElementById('importFileBtn').disabled = true;
        uploadedFile = null;
        parsedFileData = [];
    }

    downloadTemplate() {
        const csvContent = `title,description,team,assigned_to,status,priority,points,deadline
"Design Logo","Create new company logo","Graphics Design","John Doe","pending","high","5","2024-03-01"
"Write Article","Write blog article about new features","Content Writing","Jane Smith","in_progress","medium","3","2024-03-05"
"Social Media Post","Create social media campaign","Social Media","Mike Johnson","pending","low","2","2024-03-03"`;
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'task_import_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    }

    async exportTasks() {
        try {
            const result = await this.taskTracker.exportTasksToCSV();
            if (result.success) {
                const blob = new Blob([result.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('Tasks exported successfully!');
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error exporting tasks:', error);
            this.showError('Failed to export tasks');
        }
    }
    // Tab and navigation methods
    switchTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('tab-active');
            btn.classList.add('tab-inactive');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('tab-active');
        document.querySelector(`[data-tab="${tab}"]`).classList.remove('tab-inactive');
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        switch (tab) {
            case 'all':
                document.getElementById('allTasksContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.remove('hidden');
                this.loadTasks();
                break;
            case 'my-tasks':
                document.getElementById('myTasksContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.remove('hidden');
                this.loadMyTasks();
                break;
            case 'team-tasks':
                document.getElementById('teamTasksContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.remove('hidden');
                this.loadTeamTasks();
                break;
            case 'analytics':
                document.getElementById('analyticsContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.add('hidden');
                this.loadAnalytics();
                break;
            case 'leaderboard':
                document.getElementById('leaderboardContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.add('hidden');
                this.loadLeaderboard();
                break;
        }
    }

    async loadMyTasks() {
        const myTasks = this.tasks.filter(task => 
            task.assigned_to === this.taskTracker.userId
        );
        
        const container = document.getElementById('myTasksContainer');
        if (myTasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">📝</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2">No Tasks Assigned</h3>
                    <p class="text-gray-600">You don't have any tasks assigned to you yet.</p>
                </div>
            `;
        } else {
            container.innerHTML = myTasks.map(task => this.renderTaskCard(task)).join('');
        }
    }

    async loadTeamTasks() {
        const teamTasks = this.tasks.filter(task => 
            task.assigned_to_member?.team_name === this.taskTracker.userTeam
        );
        
        const container = document.getElementById('teamTasksContainer');
        container.innerHTML = teamTasks.map(task => this.renderTaskCard(task)).join('');
    }

    async loadAnalytics() {
        const teamContainer = document.getElementById('teamPerformanceChart');
        const memberContainer = document.getElementById('memberPerformanceChart');
        
        // Calculate team performance from tasks
        const teamStats = {};
        this.tasks.forEach(task => {
            const team = task.assigned_to_member?.team_name || 'Unknown';
            if (!teamStats[team]) {
                teamStats[team] = { total: 0, completed: 0, points: 0 };
            }
            teamStats[team].total++;
            if (task.status === 'completed') {
                teamStats[team].completed++;
                teamStats[team].points += task.points || 0;
            }
        });
        
        const teamPerformance = Object.entries(teamStats)
            .map(([team, stats]) => ({
                team,
                ...stats,
                percentage: Math.round((stats.completed / stats.total) * 100)
            }))
            .sort((a, b) => b.points - a.points);
        
        if (teamContainer) {
            teamContainer.innerHTML = teamPerformance.map((team, index) => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            ${index + 1}
                        </span>
                        <div>
                            <p class="font-bold text-gray-900">${team.team}</p>
                            <p class="text-sm text-gray-600">${team.completed}/${team.total} tasks</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">${team.points} pts</p>
                        <p class="text-sm text-gray-600">${team.percentage}%</p>
                    </div>
                </div>
            `).join('');
        }
        
        // Calculate member performance
        const memberStats = {};
        this.tasks.forEach(task => {
            const member = task.assigned_to_member?.name || 'Unknown';
            const team = task.assigned_to_member?.team_name || 'Unknown';
            if (!memberStats[member]) {
                memberStats[member] = { total: 0, completed: 0, points: 0, team };
            }
            memberStats[member].total++;
            if (task.status === 'completed') {
                memberStats[member].completed++;
                memberStats[member].points += task.points || 0;
            }
        });
        
        const memberPerformance = Object.entries(memberStats)
            .map(([member, stats]) => ({
                member,
                ...stats,
                percentage: Math.round((stats.completed / stats.total) * 100)
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 8);
        
        if (memberContainer) {
            memberContainer.innerHTML = memberPerformance.map((member, index) => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            ${index + 1}
                        </span>
                        <div>
                            <p class="font-bold text-gray-900">${member.member}</p>
                            <p class="text-sm text-gray-600">${member.team}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">${member.points} pts</p>
                        <p class="text-sm text-gray-600">${member.percentage}%</p>
                    </div>
                </div>
            `).join('');
        }
    }

    async loadLeaderboard() {
        const weeklyContainer = document.getElementById('weeklyLeaderboard');
        const monthlyContainer = document.getElementById('monthlyLeaderboard');
        
        // Mock leaderboard data
        const leaderboardHTML = `
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🥇</span>
                    <div>
                        <p class="font-bold text-gray-900">John Doe</p>
                        <p class="text-sm text-gray-600">Graphics Design</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-purple-600">25 pts</p>
                    <p class="text-sm text-gray-600">5 tasks</p>
                </div>
            </div>
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🥈</span>
                    <div>
                        <p class="font-bold text-gray-900">Jane Smith</p>
                        <p class="text-sm text-gray-600">Content Writing</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-purple-600">18 pts</p>
                    <p class="text-sm text-gray-600">4 tasks</p>
                </div>
            </div>
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🥉</span>
                    <div>
                        <p class="font-bold text-gray-900">Core Team Lead</p>
                        <p class="text-sm text-gray-600">Core Team</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-purple-600">15 pts</p>
                    <p class="text-sm text-gray-600">3 tasks</p>
                </div>
            </div>
        `;
        
        if (weeklyContainer) weeklyContainer.innerHTML = leaderboardHTML;
        if (monthlyContainer) monthlyContainer.innerHTML = leaderboardHTML;
    }

    // Modal management
    openCreateTaskModal() {
        if (!this.checkSession()) {
            this.showError('Please log in to create tasks');
            return;
        }
        
        // Populate team filters and load members
        this.populateTeamFilters();
        
        // Ensure members are loaded
        if (this.members.length === 0) {
            this.loadAllMembers();
        }
        
        // Clear the assign to dropdown
        const memberSelect = document.getElementById('taskAssignTo');
        if (memberSelect) {
            memberSelect.innerHTML = '<option value="">Select Member</option>';
        }
        
        document.getElementById('createTaskModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    async loadAllMembers() {
        try {
            const result = await this.taskTracker.getTeamMembers();
            if (result.success) {
                this.members = result.data;
                console.log('Members loaded:', this.members.length);
            }
        } catch (error) {
            console.error('Error loading all members:', error);
            // Use mock data as fallback
            this.members = this.taskTracker.getMockMembers();
        }
    }

    closeCreateTaskModal() {
        document.getElementById('createTaskModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('createTaskForm').reset();
    }

    async createTask() {
        if (!this.checkSession()) {
            this.showError('Please log in to create tasks');
            return;
        }

        const taskData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            team_name: document.getElementById('taskTeam').value,
            assigned_to: parseInt(document.getElementById('taskAssignTo').value),
            priority: document.getElementById('taskPriority').value,
            points: parseInt(document.getElementById('taskPoints').value),
            deadline: document.getElementById('taskDeadline').value || null
        };
        
        if (!taskData.title || !taskData.team_name || !taskData.assigned_to) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        this.showLoading();
        
        try {
            const result = await this.taskTracker.createTask(taskData);
            if (result.success) {
                // Add to local tasks array
                this.tasks.push(result.data);
                
                this.showSuccess('Task created successfully!');
                this.closeCreateTaskModal();
                this.renderTasks();
                this.loadDashboardStats();
                this.updateTaskCount();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error creating task:', error);
            this.showError('Failed to create task');
        } finally {
            this.hideLoading();
        }
    }

    updateTaskCount() {
        const countEl = document.getElementById('taskCount');
        if (countEl) {
            countEl.textContent = `${this.tasks.length} Task${this.tasks.length !== 1 ? 's' : ''}`;
        }
    }

    // Utility functions
    showLoading() {
        document.getElementById('loadingIndicator')?.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingIndicator')?.classList.add('hidden');
    }

    showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.classList.remove('hidden');
            setTimeout(() => errorAlert.classList.add('hidden'), 5000);
        }
    }

    showSuccess(message) {
        const successAlert = document.getElementById('successAlert');
        const successMessage = document.getElementById('successMessage');
        if (successAlert && successMessage) {
            successMessage.textContent = message;
            successAlert.classList.remove('hidden');
            setTimeout(() => successAlert.classList.add('hidden'), 3000);
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Global functions
function addManualTask() { window.taskUI?.addManualTask(); }
function clearManualForm() { window.taskUI?.clearManualForm(); }
function handleFileUpload(event) { window.taskUI?.handleFileUpload(event); }
function importFromFile() { window.taskUI?.importFromFile(); }
function clearFileImport() { window.taskUI?.clearFileImport(); }
function downloadTemplate() { window.taskUI?.downloadTemplate(); }
function confirmStatusChange() { window.taskUI?.confirmStatusChange(); }
function closeStatusChangeModal() { window.taskUI?.closeStatusChangeModal(); }
function closeTaskDetailModal() { window.taskUI?.closeTaskDetailModal(); }
function closeBulkImportModal() { window.taskUI?.closeBulkImportModal(); }
function closeCreateTaskModal() { window.taskUI?.closeCreateTaskModal(); }
function createTask() { window.taskUI?.createTask(); }

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskUI = new TaskTrackingUI();
});
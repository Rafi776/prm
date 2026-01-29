// =====================================================
// TASK TRACKING WITH AUTHENTICATION SYSTEM
// ID-based system with same auth as all-members page
// =====================================================

// Authentication state (same as all-members.js)
const authState = {
  isAuthenticated: false,
  sessionStart: null,
  sessionDuration: 6 * 60 * 60 * 1000, // 6 hours in milliseconds
  credentials: {
    username: 'admin',
    password: 'admin123'
  }
};

class TaskTracker {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentUser = null;
        this.userRole = null;
        this.userTeam = null;
        this.userEmail = null;
        this.userId = null;
        
        // Initialize user context
        this.initializeUser();
    }

    async initializeUser() {
        try {
            // Check if we have a mock session (for demo purposes)
            if (authState.isAuthenticated) {
                // Create a mock user for demo
                this.currentUser = { email: 'admin@prm.com' };
                this.userEmail = 'admin@prm.com';
                await this.loadUserContext();
                return;
            }

            // Try to get real Supabase user
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
            // For demo purposes, if admin is logged in, create mock user data
            if (authState.isAuthenticated && this.userEmail === 'admin@prm.com') {
                this.userId = 1;
                this.userRole = 'Admin';
                this.userTeam = 'Graphics Design';
                this.userData = {
                    id: 1,
                    email: 'admin@prm.com',
                    name: 'Admin User',
                    position: 'Admin',
                    team_name: 'Graphics Design'
                };
                
                console.log('Mock admin user context loaded');
                return;
            }

            // Try to load real user data from database
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

            console.log('User context loaded:', {
                id: this.userId,
                email: this.userEmail,
                role: this.userRole,
                team: this.userTeam,
                name: data.name
            });

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

    // Create new task
    async createTask(taskData) {
        try {
            if (!this.canCreateTask()) {
                throw new Error('You do not have permission to create tasks');
            }

            const task = {
                title: taskData.title.trim(),
                description: taskData.description?.trim() || null,
                assigned_by: this.userId,
                assigned_to: taskData.assigned_to,
                status: 'pending',
                priority: taskData.priority || 'medium',
                points: taskData.points || 1,
                deadline: taskData.deadline || null
            };

            const { data, error } = await this.supabase
                .from('tasks')
                .insert([task])
                .select(`
                    *,
                    assigned_by_member:prm_members!tasks_assigned_by_fkey(id, name, email, team_name, position),
                    assigned_to_member:prm_members!tasks_assigned_to_fkey(id, name, email, team_name, position)
                `)
                .single();

            if (error) throw error;

            console.log('Task created successfully:', data);
            return { success: true, data };

        } catch (error) {
            console.error('Error creating task:', error);
            return { success: false, error: error.message };
        }
    }

    // Get tasks with filters
    async getTasks(filters = {}) {
        try {
            let query = this.supabase
                .from('tasks')
                .select(`
                    *,
                    assigned_by_member:prm_members!tasks_assigned_by_fkey(id, name, email, team_name, position),
                    assigned_to_member:prm_members!tasks_assigned_to_fkey(id, name, email, team_name, position)
                `);

            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.team_name) {
                query = query.eq('assigned_to_member.team_name', filters.team_name);
            }
            if (filters.assigned_to_id) {
                query = query.eq('assigned_to', filters.assigned_to_id);
            }
            if (filters.priority) {
                query = query.eq('priority', filters.priority);
            }

            // Sorting
            const sortBy = filters.sort_by || 'created_at';
            const sortOrder = filters.sort_order || 'desc';
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data };

        } catch (error) {
            console.error('Error fetching tasks:', error);
            return { success: false, error: error.message };
        }
    }

    // Update task
    async updateTask(taskId, updates) {
        try {
            if (!this.canEditTask()) {
                throw new Error('You do not have permission to edit tasks');
            }

            const { data, error } = await this.supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskId)
                .select(`
                    *,
                    assigned_by_member:prm_members!tasks_assigned_by_fkey(id, name, email, team_name, position),
                    assigned_to_member:prm_members!tasks_assigned_to_fkey(id, name, email, team_name, position)
                `)
                .single();

            if (error) throw error;

            console.log('Task updated successfully:', data);
            return { success: true, data };

        } catch (error) {
            console.error('Error updating task:', error);
            return { success: false, error: error.message };
        }
    }

    // Get team members
    async getTeamMembers(teamName = null) {
        try {
            let query = this.supabase
                .from('prm_members')
                .select('id, name, position, team_name, email')
                .order('name');

            if (teamName) {
                query = query.eq('team_name', teamName);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching team members:', error);
            return { success: false, error: error.message };
        }
    }

    // Get dashboard summary
    async getDashboardSummary() {
        try {
            // For demo, return mock data if no database connection
            const mockData = {
                total_tasks: 12,
                total_completed: 8,
                total_in_progress: 3,
                total_pending: 1,
                total_overdue: 0
            };

            try {
                const { data, error } = await this.supabase
                    .from('dashboard_summary')
                    .select('*')
                    .single();

                if (error) {
                    console.log('Using mock dashboard data');
                    return { success: true, data: mockData };
                }

                return { success: true, data };
            } catch (error) {
                console.log('Using mock dashboard data');
                return { success: true, data: mockData };
            }

        } catch (error) {
            console.error('Error fetching dashboard summary:', error);
            return { success: false, error: error.message };
        }
    }

    // Permission helpers
    canCreateTask() {
        return authState.isAuthenticated && (this.userRole === 'Admin' || this.userRole === 'Coordinator');
    }

    canEditTask() {
        return authState.isAuthenticated;
    }

    // Get available teams
    getAvailableTeams() {
        return [
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
}

// UI Controller with Authentication
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
            // Check session on load
            this.checkSession();
            
            // Initialize task tracker
            this.taskTracker = new TaskTracker(supabaseClient);
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Load tasks
            await this.loadTasks();
            
        } catch (error) {
            console.error('Error initializing Task Tracking UI:', error);
            this.showError('Failed to initialize task tracking system');
        }
    }

    checkSession() {
        if (!authState.isAuthenticated || !authState.sessionStart) {
            this.updateAuthUI(false);
            return false;
        }
        
        const now = new Date().getTime();
        const sessionAge = now - authState.sessionStart;
        
        if (sessionAge > authState.sessionDuration) {
            this.terminateSession();
            return false;
        }
        
        this.updateAuthUI(true);
        return true;
    }

    updateAuthUI(isAuthenticated) {
        const authStatus = document.getElementById('authStatus');
        const adminLoginBtn = document.getElementById('adminLoginBtn');
        const createTaskBtn = document.getElementById('createTaskBtn');
        const endSessionBtn = document.getElementById('endSessionBtn');
        
        if (isAuthenticated) {
            // Show authenticated state
            if (authStatus) {
                authStatus.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm';
                authStatus.innerHTML = '<span class="font-medium">✅ Admin Mode:</span> Task management features are now active! You can create, edit, and manage tasks.';
            }
            
            if (adminLoginBtn) adminLoginBtn.classList.add('hidden');
            if (createTaskBtn) createTaskBtn.classList.remove('hidden');
            if (endSessionBtn) {
                endSessionBtn.classList.remove('hidden');
                endSessionBtn.classList.add('session-active');
            }
        } else {
            // Show view-only state
            if (authStatus) {
                authStatus.className = 'mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm';
                authStatus.innerHTML = '<span class="font-medium">👀 View Mode:</span> You can view tasks and analytics. <button onclick="showAuthModal()" class="text-yellow-600 hover:text-yellow-800 underline font-medium">Login as admin</button> to enable task creation and management features.';
            }
            
            if (adminLoginBtn) adminLoginBtn.classList.remove('hidden');
            if (createTaskBtn) createTaskBtn.classList.add('hidden');
            if (endSessionBtn) endSessionBtn.classList.add('hidden');
        }
        
        // Update user context display
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

        // Create task
        document.getElementById('createTaskBtn')?.addEventListener('click', () => {
            if (authState.isAuthenticated) {
                this.openCreateTaskModal();
            } else {
                this.showError('Please log in to create tasks');
            }
        });

        // Form submission
        document.getElementById('createTaskForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });

        // Team selection for member loading
        document.getElementById('taskTeam')?.addEventListener('change', () => this.loadTeamMembers());
    }

    async loadInitialData() {
        this.showLoading();
        
        try {
            // Load teams
            this.teams = this.taskTracker.getAvailableTeams();
            this.populateTeamFilters();
            
            // Load members if authenticated
            if (authState.isAuthenticated) {
                const membersResult = await this.taskTracker.getTeamMembers();
                if (membersResult.success) {
                    this.members = membersResult.data;
                }
            }
            
            // Load dashboard stats
            await this.loadDashboardStats();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load initial data');
        } finally {
            this.hideLoading();
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
            <div class="bg-white rounded-xl border border-gray-200 p-4">
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
            
            <div class="bg-white rounded-xl border border-gray-200 p-4">
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
            
            <div class="bg-white rounded-xl border border-gray-200 p-4">
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
            
            <div class="bg-white rounded-xl border border-gray-200 p-4">
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
        const teamFilter = document.getElementById('teamFilter');
        const taskTeamSelect = document.getElementById('taskTeam');
        
        if (teamFilter) {
            teamFilter.innerHTML = '<option value="">All Teams</option>';
            this.teams.forEach(team => {
                teamFilter.innerHTML += `<option value="${team}">${team}</option>`;
            });
        }
        
        if (taskTeamSelect) {
            taskTeamSelect.innerHTML = '<option value="">Select Team</option>';
            this.teams.forEach(team => {
                taskTeamSelect.innerHTML += `<option value="${team}">${team}</option>`;
            });
        }
    }

    async loadTeamMembers() {
        const teamSelect = document.getElementById('taskTeam');
        const memberSelect = document.getElementById('taskAssignTo');
        
        if (!teamSelect || !memberSelect) return;
        
        const selectedTeam = teamSelect.value;
        memberSelect.innerHTML = '<option value="">Select Member</option>';
        
        if (selectedTeam && this.members.length > 0) {
            const teamMembers = this.members.filter(member => member.team_name === selectedTeam);
            teamMembers.forEach(member => {
                memberSelect.innerHTML += `<option value="${member.id}">${member.name} (${member.position})</option>`;
            });
        }
    }

    async loadTasks() {
        this.showLoading();
        
        try {
            // For demo, show mock tasks if no database connection
            const mockTasks = [
                {
                    id: 1,
                    title: 'Design Social Media Graphics',
                    description: 'Create graphics for upcoming campaign',
                    status: 'in_progress',
                    priority: 'high',
                    points: 5,
                    deadline: '2024-02-15',
                    created_at: '2024-02-01T10:00:00Z',
                    assigned_by_member: { name: 'Admin User', team_name: 'Graphics Design' },
                    assigned_to_member: { name: 'John Doe', team_name: 'Graphics Design' }
                },
                {
                    id: 2,
                    title: 'Write Blog Content',
                    description: 'Create content for website blog',
                    status: 'pending',
                    priority: 'medium',
                    points: 3,
                    deadline: '2024-02-20',
                    created_at: '2024-02-02T14:00:00Z',
                    assigned_by_member: { name: 'Admin User', team_name: 'Content Writing' },
                    assigned_to_member: { name: 'Jane Smith', team_name: 'Content Writing' }
                }
            ];

            try {
                const result = await this.taskTracker.getTasks();
                if (result.success && result.data.length > 0) {
                    this.tasks = result.data;
                } else {
                    console.log('Using mock task data');
                    this.tasks = mockTasks;
                }
            } catch (error) {
                console.log('Using mock task data');
                this.tasks = mockTasks;
            }
            
            this.renderTasks();
            this.updateTaskCount();
            
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
                    ${authState.isAuthenticated ? 
                        '<button onclick="taskUI.openCreateTaskModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">Create First Task</button>' : 
                        '<button onclick="showAuthModal()" class="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors">Login to Create Tasks</button>'
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
            <div class="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow fade-in">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <h3 class="text-lg font-bold text-gray-900">${this.escapeHtml(task.title)}</h3>
                            ${isOverdue ? '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200">OVERDUE</span>' : ''}
                        </div>
                        <p class="text-gray-600 text-sm mb-3">${this.escapeHtml(task.description || 'No description')}</p>
                        <div class="flex items-center gap-4 text-sm text-gray-500">
                            <span>👥 ${task.assigned_to_member?.team_name || 'Unknown Team'}</span>
                            <span>👤 ${task.assigned_to_member?.name || 'Unknown'}</span>
                            ${task.deadline ? `<span>📅 ${this.formatDate(task.deadline)}</span>` : ''}
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
                        <span>Created by ${task.assigned_by_member?.name || 'Unknown'}</span>
                        <span>•</span>
                        <span>${this.formatRelativeTime(task.created_at)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${authState.isAuthenticated ? `
                            <button onclick="taskUI.quickStatusUpdate(${task.id}, '${task.status}')" 
                                    class="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                                Update Status
                            </button>
                        ` : ''}
                        <button onclick="taskUI.viewTaskDetails(${task.id})" 
                                class="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('tab-active');
            btn.classList.add('tab-inactive');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('tab-active');
        document.querySelector(`[data-tab="${tab}"]`).classList.remove('tab-inactive');
        
        // Show/hide content sections
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        // Load content based on tab
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
        // For demo, filter current tasks
        const myTasks = this.tasks.filter(task => 
            task.assigned_to_member?.name === 'Current User' // This would be dynamic in real implementation
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
        // For demo, show all tasks
        const container = document.getElementById('teamTasksContainer');
        container.innerHTML = this.tasks.map(task => this.renderTaskCard(task)).join('');
    }

    async loadAnalytics() {
        const teamContainer = document.getElementById('teamPerformanceChart');
        const memberContainer = document.getElementById('memberPerformanceChart');
        
        // Mock analytics data
        if (teamContainer) {
            teamContainer.innerHTML = `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                        <div>
                            <p class="font-bold text-gray-900">Graphics Design</p>
                            <p class="text-sm text-gray-600">5/6 tasks</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">25 pts</p>
                        <p class="text-sm text-gray-600">83%</p>
                    </div>
                </div>
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
                        <div>
                            <p class="font-bold text-gray-900">Content Writing</p>
                            <p class="text-sm text-gray-600">3/4 tasks</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">15 pts</p>
                        <p class="text-sm text-gray-600">75%</p>
                    </div>
                </div>
            `;
        }
        
        if (memberContainer) {
            memberContainer.innerHTML = `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
                        <div>
                            <p class="font-bold text-gray-900">John Doe</p>
                            <p class="text-sm text-gray-600">Graphics Design</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">20 pts</p>
                        <p class="text-sm text-gray-600">100%</p>
                    </div>
                </div>
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
                        <div>
                            <p class="font-bold text-gray-900">Jane Smith</p>
                            <p class="text-sm text-gray-600">Content Writing</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">15 pts</p>
                        <p class="text-sm text-gray-600">90%</p>
                    </div>
                </div>
            `;
        }
    }

    async loadLeaderboard() {
        const weeklyContainer = document.getElementById('weeklyLeaderboard');
        const monthlyContainer = document.getElementById('monthlyLeaderboard');
        
        const leaderboardHTML = `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="text-lg">🥇</span>
                    <div>
                        <p class="font-bold text-gray-900">John Doe</p>
                        <p class="text-sm text-gray-600">Graphics Design</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-purple-600">20 pts</p>
                    <p class="text-sm text-gray-600">4 tasks</p>
                </div>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="text-lg">🥈</span>
                    <div>
                        <p class="font-bold text-gray-900">Jane Smith</p>
                        <p class="text-sm text-gray-600">Content Writing</p>
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

    openCreateTaskModal() {
        if (!authState.isAuthenticated) {
            this.showError('Please log in to create tasks');
            return;
        }
        
        document.getElementById('createTaskModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeCreateTaskModal() {
        document.getElementById('createTaskModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('createTaskForm').reset();
    }

    async createTask() {
        if (!authState.isAuthenticated) {
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
        
        // Validation
        if (!taskData.title || !taskData.team_name || !taskData.assigned_to) {
            this.showError('Please fill in all required fields');
            return;
        }
        
        this.showLoading();
        
        try {
            const result = await this.taskTracker.createTask(taskData);
            if (result.success) {
                this.showSuccess('Task created successfully!');
                this.closeCreateTaskModal();
                this.loadTasks();
                this.loadDashboardStats();
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

    async quickStatusUpdate(taskId, currentStatus) {
        if (!authState.isAuthenticated) {
            this.showError('Please log in to update tasks');
            return;
        }

        const statusOptions = ['pending', 'in_progress', 'completed'];
        const currentIndex = statusOptions.indexOf(currentStatus);
        const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
        
        try {
            const result = await this.taskTracker.updateTask(taskId, { status: nextStatus });
            if (result.success) {
                this.showSuccess(`Task status updated to ${nextStatus.replace('_', ' ')}`);
                this.loadTasks();
                this.loadDashboardStats();
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Failed to update task status');
        }
    }

    viewTaskDetails(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            alert(`Task: ${task.title}\nDescription: ${task.description || 'No description'}\nStatus: ${task.status}\nPriority: ${task.priority}`);
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
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
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
}

// Authentication Functions (same as all-members.js)
function checkSession() {
    if (!authState.isAuthenticated || !authState.sessionStart) {
        return false;
    }
    
    const now = new Date().getTime();
    const sessionAge = now - authState.sessionStart;
    
    if (sessionAge > authState.sessionDuration) {
        terminateSession();
        return false;
    }
    
    return true;
}

function showAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('adminUser').focus();
}

function closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('adminUser').value = '';
    document.getElementById('adminPass').value = '';
}

function handleLogin() {
    const username = document.getElementById('adminUser').value;
    const password = document.getElementById('adminPass').value;
    
    if (username === authState.credentials.username && password === authState.credentials.password) {
        authState.isAuthenticated = true;
        authState.sessionStart = new Date().getTime();
        
        closeAuthModal();
        
        // Update UI
        if (window.taskUI) {
            window.taskUI.updateAuthUI(true);
            window.taskUI.taskTracker.initializeUser(); // Reload user context
            window.taskUI.loadInitialData(); // Reload data with auth
        }
        
        showMessage('Authentication successful - Task management features now available!', 'success');
    } else {
        showMessage('Invalid credentials', 'error');
    }
}

function terminateSession() {
    authState.isAuthenticated = false;
    authState.sessionStart = null;
    
    // Update UI
    if (window.taskUI) {
        window.taskUI.updateAuthUI(false);
    }
    
    showMessage('Session ended - Task management features disabled', 'info');
}

function showMessage(message, type = 'info') {
    const colors = {
        success: 'bg-green-50 text-green-700 border-green-200',
        error: 'bg-red-50 text-red-700 border-red-200',
        info: 'bg-blue-50 text-blue-700 border-blue-200'
    };
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 z-[110] px-4 py-2 rounded-lg border ${colors[type]} font-medium`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskUI = new TaskTrackingUI();
});

// Global functions for onclick handlers
window.closeCreateTaskModal = () => window.taskUI?.closeCreateTaskModal();
window.createTask = () => window.taskUI?.createTask();
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleLogin = handleLogin;
window.terminateSession = terminateSession;
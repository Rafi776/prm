// =====================================================
// TASK TRACKING UI - FRONTEND INTERFACE
// Handles all UI interactions and data display
// =====================================================

class TaskTrackingUI {
    constructor() {
        this.taskTracker = null;
        this.currentTab = 'all';
        this.currentFilters = {};
        this.tasks = [];
        this.teams = [];
        this.members = [];
        this.userContext = null;
        
        this.init();
    }

    async init() {
        try {
            // Initialize task tracker
            this.taskTracker = new TaskTracker(supabaseClient);
            
            // Wait for user context to load
            await this.waitForUserContext();
            
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

    async waitForUserContext() {
        let attempts = 0;
        while (!this.taskTracker.userData && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (this.taskTracker.userData) {
            this.userContext = this.taskTracker.userData;
            this.updateUserContextDisplay();
        } else {
            throw new Error('Failed to load user context');
        }
    }

    updateUserContextDisplay() {
        const contextEl = document.getElementById('userContext');
        if (contextEl && this.userContext) {
            contextEl.textContent = `${this.userContext.position} - ${this.userContext.team_name}`;
            
            // Show create button for Admin and Coordinators
            if (this.userContext.position === 'Admin' || this.userContext.position === 'Coordinator') {
                document.getElementById('createTaskBtn').classList.remove('hidden');
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

        // Filters
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('priorityFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('teamFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());

        // Create task
        document.getElementById('createTaskBtn').addEventListener('click', () => this.openCreateTaskModal());
        document.getElementById('taskTeam').addEventListener('change', () => this.loadTeamMembers());

        // Form submission
        document.getElementById('createTaskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });
    }

    async loadInitialData() {
        this.showLoading();
        
        try {
            // Load teams
            this.teams = this.taskTracker.getAvailableTeams();
            this.populateTeamFilters();
            
            // Load members
            const membersResult = await this.taskTracker.getTeamMembers();
            if (membersResult.success) {
                this.members = membersResult.data;
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
            
            // Filter teams based on user role
            let availableTeams = this.teams;
            if (this.userContext?.position === 'Coordinator') {
                availableTeams = [this.userContext.team_name];
            }
            
            availableTeams.forEach(team => {
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
        
        if (selectedTeam) {
            const teamMembers = this.members.filter(member => member.team_name === selectedTeam);
            teamMembers.forEach(member => {
                memberSelect.innerHTML += `<option value="${member.email}">${member.name} (${member.position})</option>`;
            });
        }
    }

    async loadTasks() {
        this.showLoading();
        
        try {
            const result = await this.taskTracker.getTasks(this.currentFilters);
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
                    <p class="text-gray-600 mb-4">No tasks match your current filters.</p>
                    ${this.userContext?.position !== 'Member' ? 
                        '<button onclick="taskUI.openCreateTaskModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">Create First Task</button>' : 
                        ''
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
            <div class="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow fade-in cursor-pointer" onclick="taskUI.openTaskDetail(${task.id})">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <h3 class="text-lg font-bold text-gray-900">${this.escapeHtml(task.title)}</h3>
                            ${isOverdue ? '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200">OVERDUE</span>' : ''}
                        </div>
                        <p class="text-gray-600 text-sm mb-3">${this.escapeHtml(task.description || 'No description')}</p>
                        <div class="flex items-center gap-4 text-sm text-gray-500">
                            <span>👥 ${task.team_name}</span>
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
                        ${this.canEditTask(task) ? `
                            <button onclick="event.stopPropagation(); taskUI.quickStatusUpdate(${task.id}, '${task.status}')" 
                                    class="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors">
                                Update Status
                            </button>
                        ` : ''}
                        <button onclick="event.stopPropagation(); taskUI.openTaskDetail(${task.id})" 
                                class="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    canEditTask(task) {
        if (!this.userContext) return false;
        
        // Admin can edit all tasks
        if (this.userContext.position === 'Admin') return true;
        
        // Coordinator can edit team tasks
        if (this.userContext.position === 'Coordinator' && task.team_name === this.userContext.team_name) return true;
        
        // Member can edit only assigned tasks
        if (this.userContext.position === 'Member' && task.assigned_to === this.userContext.email) return true;
        
        return false;
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
                this.currentFilters = {};
                this.loadTasks();
                break;
                
            case 'my-tasks':
                document.getElementById('myTasksContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.remove('hidden');
                this.currentFilters = { assigned_to: this.userContext.email };
                this.loadMyTasks();
                break;
                
            case 'team-tasks':
                document.getElementById('teamTasksContent').classList.remove('hidden');
                document.getElementById('filtersSection').classList.remove('hidden');
                this.currentFilters = { team_name: this.userContext.team_name };
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
        const result = await this.taskTracker.getTasks({ assigned_to: this.userContext.email });
        if (result.success) {
            this.tasks = result.data;
            const container = document.getElementById('myTasksContainer');
            container.innerHTML = this.tasks.map(task => this.renderTaskCard(task)).join('');
            this.updateTaskCount();
        }
    }

    async loadTeamTasks() {
        const result = await this.taskTracker.getTasks({ team_name: this.userContext.team_name });
        if (result.success) {
            this.tasks = result.data;
            const container = document.getElementById('teamTasksContainer');
            container.innerHTML = this.tasks.map(task => this.renderTaskCard(task)).join('');
            this.updateTaskCount();
        }
    }

    async loadAnalytics() {
        try {
            const [teamPerf, memberPerf] = await Promise.all([
                this.taskTracker.getTeamPerformance(),
                this.taskTracker.getMemberPerformance()
            ]);
            
            if (teamPerf.success) {
                this.renderTeamPerformance(teamPerf.data);
            }
            
            if (memberPerf.success) {
                this.renderMemberPerformance(memberPerf.data);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    renderTeamPerformance(teams) {
        const container = document.getElementById('teamPerformanceChart');
        if (!container) return;
        
        container.innerHTML = teams.slice(0, 8).map((team, index) => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        ${index + 1}
                    </span>
                    <div>
                        <p class="font-bold text-gray-900">${team.team_name}</p>
                        <p class="text-sm text-gray-600">${team.completed_tasks}/${team.total_tasks} tasks</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-purple-600">${team.total_points_earned} pts</p>
                    <p class="text-sm text-gray-600">${team.completion_percentage}%</p>
                </div>
            </div>
        `).join('');
    }

    renderMemberPerformance(members) {
        const container = document.getElementById('memberPerformanceChart');
        if (!container) return;
        
        container.innerHTML = members.slice(0, 8).map((member, index) => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <span class="w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        ${index + 1}
                    </span>
                    <div>
                        <p class="font-bold text-gray-900">${member.member_name}</p>
                        <p class="text-sm text-gray-600">${member.team_name}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-purple-600">${member.total_points_earned} pts</p>
                    <p class="text-sm text-gray-600">${member.completion_percentage}%</p>
                </div>
            </div>
        `).join('');
    }

    async loadLeaderboard() {
        try {
            const [weekly, monthly] = await Promise.all([
                this.taskTracker.getLeaderboard('weekly'),
                this.taskTracker.getLeaderboard('monthly')
            ]);
            
            if (weekly.success) {
                this.renderLeaderboard(weekly.data, 'weeklyLeaderboard');
            }
            
            if (monthly.success) {
                this.renderLeaderboard(monthly.data, 'monthlyLeaderboard');
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }

    renderLeaderboard(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No data available</p>';
            return;
        }
        
        container.innerHTML = data.map((item, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            return `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <span class="text-lg">${medal}</span>
                        <div>
                            <p class="font-bold text-gray-900">${item.name}</p>
                            <p class="text-sm text-gray-600">${item.team_name}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-purple-600">${item.points_earned} pts</p>
                        <p class="text-sm text-gray-600">${item.completed_tasks} tasks</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    applyFilters() {
        const status = document.getElementById('statusFilter').value;
        const priority = document.getElementById('priorityFilter').value;
        const team = document.getElementById('teamFilter').value;
        const search = document.getElementById('searchInput').value;
        
        this.currentFilters = {
            ...this.currentFilters,
            ...(status && { status }),
            ...(priority && { priority }),
            ...(team && { team_name: team })
        };
        
        // Apply search filter on frontend
        let filteredTasks = this.tasks;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredTasks = this.tasks.filter(task => 
                task.title.toLowerCase().includes(searchLower) ||
                task.description?.toLowerCase().includes(searchLower) ||
                task.assigned_to_member?.name.toLowerCase().includes(searchLower)
            );
        }
        
        // Re-render with filtered tasks
        const container = document.getElementById('tasksContainer');
        if (container) {
            container.innerHTML = filteredTasks.map(task => this.renderTaskCard(task)).join('');
        }
        
        this.loadTasks();
    }

    openCreateTaskModal() {
        document.getElementById('createTaskModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeCreateTaskModal() {
        document.getElementById('createTaskModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('createTaskForm').reset();
    }

    async createTask() {
        const form = document.getElementById('createTaskForm');
        const formData = new FormData(form);
        
        const taskData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            team_name: document.getElementById('taskTeam').value,
            assigned_to: document.getElementById('taskAssignTo').value, // This is now an email
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

    async openTaskDetail(taskId) {
        // Implementation for task detail modal
        console.log('Opening task detail for:', taskId);
        // This would show a detailed view with comments, attachments, etc.
    }

    async quickStatusUpdate(taskId, currentStatus) {
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskUI = new TaskTrackingUI();
});

// Global functions for onclick handlers
window.closeCreateTaskModal = () => window.taskUI?.closeCreateTaskModal();
window.createTask = () => window.taskUI?.createTask();
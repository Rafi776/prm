// =====================================================
// TASK TRACKING FRONTEND - ID-BASED SUPABASE CLIENT
// Production-ready JavaScript for direct database access
// Uses ID foreign keys to prm_members table
// =====================================================

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

    // =====================================================
    // 1. USER AUTHENTICATION & CONTEXT (ID-BASED)
    // =====================================================

    async initializeUser() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (user) {
                this.currentUser = user;
                this.userEmail = user.email;
                await this.loadUserContext();
            }
        } catch (error) {
            console.error('Error initializing user:', error);
        }
    }

    async loadUserContext() {
        try {
            const { data, error } = await this.supabase
                .from('prm_members')
                .select('id, email, name, position, team_name, phone, scout_group, district, stage')
                .eq('email', this.userEmail)
                .single();

            if (error) throw error;

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
        }
    }

    // =====================================================
    // 2. TASK CRUD OPERATIONS (ID-BASED)
    // =====================================================

    // Create new task
    async createTask(taskData) {
        try {
            // Validate user permissions
            if (!this.canCreateTask(taskData.team_name)) {
                throw new Error('You do not have permission to create tasks for this team');
            }

            const task = {
                title: taskData.title.trim(),
                description: taskData.description?.trim() || null,
                assigned_by: this.userId,
                assigned_to: taskData.assigned_to, // This should be a member ID
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

    // Get tasks with filters (ID-based)
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
                // Filter by team using JOIN
                query = query.eq('assigned_to_member.team_name', filters.team_name);
            }
            if (filters.assigned_to_id) {
                query = query.eq('assigned_to', filters.assigned_to_id);
            }
            if (filters.assigned_by_id) {
                query = query.eq('assigned_by', filters.assigned_by_id);
            }
            if (filters.priority) {
                query = query.eq('priority', filters.priority);
            }
            if (filters.deadline_before) {
                query = query.lte('deadline', filters.deadline_before);
            }
            if (filters.deadline_after) {
                query = query.gte('deadline', filters.deadline_after);
            }

            // Sorting
            const sortBy = filters.sort_by || 'created_at';
            const sortOrder = filters.sort_order || 'desc';
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });

            // Pagination
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            if (filters.offset) {
                query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
            }

            const { data, error } = await query;

            if (error) throw error;

            return { success: true, data };

        } catch (error) {
            console.error('Error fetching tasks:', error);
            return { success: false, error: error.message };
        }
    }

    // Update task (ID-based)
    async updateTask(taskId, updates) {
        try {
            // Check permissions
            if (!await this.canEditTask(taskId)) {
                throw new Error('You do not have permission to edit this task');
            }

            // Prepare update data
            const updateData = { ...updates };
            
            // Remove fields that shouldn't be updated by certain roles
            if (this.userRole === 'Member') {
                // Members can only update status and description
                const allowedFields = ['status', 'description'];
                Object.keys(updateData).forEach(key => {
                    if (!allowedFields.includes(key)) {
                        delete updateData[key];
                    }
                });
            }

            const { data, error } = await this.supabase
                .from('tasks')
                .update(updateData)
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

    // Delete task
    async deleteTask(taskId) {
        try {
            // Check permissions (only Admin and Coordinators can delete)
            if (this.userRole === 'Member') {
                throw new Error('Members cannot delete tasks');
            }

            const { error } = await this.supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            console.log('Task deleted successfully');
            return { success: true };

        } catch (error) {
            console.error('Error deleting task:', error);
            return { success: false, error: error.message };
        }
    }

    // =====================================================
    // 3. ANALYTICS & REPORTING (ID-BASED)
    // =====================================================

    // Get team performance
    async getTeamPerformance() {
        try {
            const { data, error } = await this.supabase
                .from('team_performance_view')
                .select('*')
                .order('team_score', { ascending: false });

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching team performance:', error);
            return { success: false, error: error.message };
        }
    }

    // Get member performance
    async getMemberPerformance(teamFilter = null) {
        try {
            let query = this.supabase
                .from('member_performance_view')
                .select('*');

            if (teamFilter) {
                query = query.eq('team_name', teamFilter);
            }

            query = query.order('member_score', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching member performance:', error);
            return { success: false, error: error.message };
        }
    }

    // Get coordinator performance
    async getCoordinatorPerformance() {
        try {
            const { data, error } = await this.supabase
                .from('coordinator_performance_view')
                .select('*')
                .order('coordinator_effectiveness_score', { ascending: false });

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching coordinator performance:', error);
            return { success: false, error: error.message };
        }
    }

    // Get dashboard summary
    async getDashboardSummary() {
        try {
            const { data, error } = await this.supabase
                .from('dashboard_summary')
                .select('*')
                .single();

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching dashboard summary:', error);
            return { success: false, error: error.message };
        }
    }

    // Get leaderboards
    async getLeaderboard(period = 'weekly') {
        try {
            const viewName = period === 'weekly' ? 'weekly_leaderboard' : 'monthly_leaderboard';
            
            const { data, error } = await this.supabase
                .from(viewName)
                .select('*');

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return { success: false, error: error.message };
        }
    }

    // =====================================================
    // 4. TASK COMMENTS (ID-BASED)
    // =====================================================

    // Add comment to task
    async addTaskComment(taskId, comment) {
        try {
            const { data, error } = await this.supabase
                .from('task_comments')
                .insert([{
                    task_id: taskId,
                    member_id: this.userId,
                    comment: comment.trim()
                }])
                .select(`
                    *,
                    member:prm_members!task_comments_member_id_fkey(id, name, email, position)
                `)
                .single();

            if (error) throw error;

            console.log('Comment added successfully:', data);
            return { success: true, data };

        } catch (error) {
            console.error('Error adding comment:', error);
            return { success: false, error: error.message };
        }
    }

    // Get task comments
    async getTaskComments(taskId) {
        try {
            const { data, error } = await this.supabase
                .from('task_comments')
                .select(`
                    *,
                    member:prm_members!task_comments_member_id_fkey(id, name, email, position)
                `)
                .eq('task_id', taskId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching comments:', error);
            return { success: false, error: error.message };
        }
    }

    // =====================================================
    // 5. TASK ATTACHMENTS (ID-BASED)
    // =====================================================

    // Add attachment to task
    async addTaskAttachment(taskId, file, fileName) {
        try {
            // Upload file to Supabase Storage
            const fileExt = fileName.split('.').pop();
            const filePath = `task-attachments/${taskId}/${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await this.supabase.storage
                .from('task-files')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from('task-files')
                .getPublicUrl(filePath);

            // Save attachment record
            const { data, error } = await this.supabase
                .from('task_attachments')
                .insert([{
                    task_id: taskId,
                    uploaded_by: this.userId,
                    file_name: fileName,
                    file_url: publicUrl,
                    file_size: file.size,
                    mime_type: file.type
                }])
                .select(`
                    *,
                    uploaded_by_member:prm_members!task_attachments_uploaded_by_fkey(id, name, email)
                `)
                .single();

            if (error) throw error;

            console.log('Attachment added successfully:', data);
            return { success: true, data };

        } catch (error) {
            console.error('Error adding attachment:', error);
            return { success: false, error: error.message };
        }
    }

    // Get task attachments
    async getTaskAttachments(taskId) {
        try {
            const { data, error } = await this.supabase
                .from('task_attachments')
                .select(`
                    *,
                    uploaded_by_member:prm_members!task_attachments_uploaded_by_fkey(id, name, email)
                `)
                .eq('task_id', taskId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };

        } catch (error) {
            console.error('Error fetching attachments:', error);
            return { success: false, error: error.message };
        }
    }

    // =====================================================
    // 6. UTILITY FUNCTIONS (ID-BASED)
    // =====================================================

    // Get team members (returns IDs for assignment)
    async getTeamMembers(teamName = null) {
        try {
            let query = this.supabase
                .from('prm_members')
                .select('id, name, position, team_name, email, phone')
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

    // =====================================================
    // 7. PERMISSION HELPERS (ID-BASED)
    // =====================================================

    canCreateTask(teamName) {
        if (this.userRole === 'Admin') return true;
        if (this.userRole === 'Coordinator' && this.userTeam === teamName) return true;
        return false;
    }

    async canEditTask(taskId) {
        try {
            const { data, error } = await this.supabase
                .rpc('can_edit_task', { task_id: taskId });

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error checking edit permission:', error);
            return false;
        }
    }

    async canViewTask(taskId) {
        try {
            const { data, error } = await this.supabase
                .rpc('can_view_task', { task_id: taskId });

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('Error checking view permission:', error);
            return false;
        }
    }

    // =====================================================
    // 8. REAL-TIME SUBSCRIPTIONS (ID-BASED)
    // =====================================================

    // Subscribe to task changes
    subscribeToTasks(callback, filters = {}) {
        let channel = this.supabase
            .channel('task-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: filters.team_name ? `assigned_to_member.team_name=eq.${filters.team_name}` : undefined
            }, callback);

        return channel.subscribe();
    }

    // Subscribe to task comments
    subscribeToTaskComments(taskId, callback) {
        let channel = this.supabase
            .channel(`task-comments-${taskId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'task_comments',
                filter: `task_id=eq.${taskId}`
            }, callback);

        return channel.subscribe();
    }

    // Unsubscribe from channel
    unsubscribe(channel) {
        return this.supabase.removeChannel(channel);
    }

    // =====================================================
    // 9. BULK OPERATIONS (ID-BASED)
    // =====================================================

    // Bulk update task status
    async bulkUpdateTaskStatus(taskIds, newStatus) {
        try {
            const { data, error } = await this.supabase
                .from('tasks')
                .update({ status: newStatus })
                .in('id', taskIds)
                .select('id, title, status');

            if (error) throw error;

            console.log('Bulk status update successful:', data);
            return { success: true, data };

        } catch (error) {
            console.error('Error in bulk status update:', error);
            return { success: false, error: error.message };
        }
    }

    // Export tasks to CSV
    async exportTasksToCSV(filters = {}) {
        try {
            const result = await this.getTasks(filters);
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
                task.assigned_by_member?.name || task.assigned_by,
                task.assigned_to_member?.name || task.assigned_to,
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

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskTracker;
}

// Global assignment for browser usage
if (typeof window !== 'undefined') {
    window.TaskTracker = TaskTracker;
}
-- =====================================================
-- TASK TRACKING ANALYTICS VIEWS
-- Production-ready SQL views for performance analytics
-- =====================================================

-- =====================================================
-- 1. TEAM PERFORMANCE VIEW
-- =====================================================

CREATE OR REPLACE VIEW team_performance_view AS
SELECT 
    t.team_name,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    
    -- Completion metrics
    ROUND(
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0) / 
        NULLIF(COUNT(*), 0), 2
    ) as completion_percentage,
    
    -- Points metrics
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) as total_points_earned,
    COALESCE(SUM(t.points), 0) as total_points_possible,
    COALESCE(AVG(CASE WHEN t.status = 'completed' THEN t.points END), 0) as avg_points_per_completed_task,
    
    -- Priority breakdown
    COUNT(CASE WHEN t.priority = 'high' AND t.status = 'completed' THEN 1 END) as high_priority_completed,
    COUNT(CASE WHEN t.priority = 'medium' AND t.status = 'completed' THEN 1 END) as medium_priority_completed,
    COUNT(CASE WHEN t.priority = 'low' AND t.status = 'completed' THEN 1 END) as low_priority_completed,
    
    -- Timing metrics
    AVG(
        CASE 
            WHEN t.status = 'completed' AND t.completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400.0 
        END
    ) as avg_completion_days,
    
    -- Overdue tasks
    COUNT(
        CASE 
            WHEN t.deadline < CURRENT_DATE AND t.status != 'completed' 
            THEN 1 
        END
    ) as overdue_tasks,
    
    -- Recent activity
    COUNT(CASE WHEN t.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as tasks_created_last_7_days,
    COUNT(CASE WHEN t.completed_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as tasks_completed_last_7_days,
    
    -- Team ranking score (weighted formula)
    (
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) * 0.6 +
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) * 0.3 +
        (COUNT(CASE WHEN t.priority = 'high' AND t.status = 'completed' THEN 1 END) * 5) * 0.1
    ) as team_score,
    
    -- Last activity
    MAX(t.updated_at) as last_activity_at
    
FROM tasks t
GROUP BY t.team_name
ORDER BY team_score DESC, total_points_earned DESC;

-- =====================================================
-- 2. MEMBER PERFORMANCE VIEW
-- =====================================================

CREATE OR REPLACE VIEW member_performance_view AS
SELECT 
    m.id as member_id,
    m.name as member_name,
    m.team_name,
    m.position,
    m.email,
    
    -- Task counts
    COUNT(t.id) as total_assigned_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    
    -- Performance metrics
    ROUND(
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0) / 
        NULLIF(COUNT(t.id), 0), 2
    ) as completion_percentage,
    
    -- Points earned
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) as total_points_earned,
    COALESCE(AVG(CASE WHEN t.status = 'completed' THEN t.points END), 0) as avg_points_per_task,
    
    -- Priority task performance
    COUNT(CASE WHEN t.priority = 'high' AND t.status = 'completed' THEN 1 END) as high_priority_completed,
    COUNT(CASE WHEN t.priority = 'medium' AND t.status = 'completed' THEN 1 END) as medium_priority_completed,
    COUNT(CASE WHEN t.priority = 'low' AND t.status = 'completed' THEN 1 END) as low_priority_completed,
    
    -- Timing performance
    AVG(
        CASE 
            WHEN t.status = 'completed' AND t.completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400.0 
        END
    ) as avg_completion_days,
    
    -- On-time delivery
    COUNT(
        CASE 
            WHEN t.status = 'completed' AND t.deadline IS NOT NULL 
            AND t.completed_at::date <= t.deadline 
            THEN 1 
        END
    ) as on_time_completions,
    
    COUNT(
        CASE 
            WHEN t.status = 'completed' AND t.deadline IS NOT NULL 
            AND t.completed_at::date > t.deadline 
            THEN 1 
        END
    ) as late_completions,
    
    -- Current overdue tasks
    COUNT(
        CASE 
            WHEN t.deadline < CURRENT_DATE AND t.status != 'completed' 
            THEN 1 
        END
    ) as current_overdue_tasks,
    
    -- Recent activity
    COUNT(CASE WHEN t.completed_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as tasks_completed_last_7_days,
    COUNT(CASE WHEN t.completed_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as tasks_completed_last_30_days,
    
    -- Member ranking score
    (
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) * 0.5 +
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0)) * 0.3 +
        (COUNT(CASE WHEN t.priority = 'high' AND t.status = 'completed' THEN 1 END) * 10) * 0.2
    ) as member_score,
    
    -- Streak calculation (consecutive days with completed tasks)
    COALESCE(
        (
            SELECT COUNT(DISTINCT DATE(completed_at))
            FROM tasks t2 
            WHERE t2.assigned_to = m.id 
            AND t2.status = 'completed'
            AND t2.completed_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0
    ) as active_days_last_30,
    
    -- Last activity
    MAX(t.updated_at) as last_activity_at
    
FROM prm_membrs m
LEFT JOIN tasks t ON m.id = t.assigned_to
GROUP BY m.id, m.name, m.team_name, m.position, m.email
ORDER BY member_score DESC, total_points_earned DESC;

-- =====================================================
-- 3. COORDINATOR PERFORMANCE VIEW
-- =====================================================

CREATE OR REPLACE VIEW coordinator_performance_view AS
SELECT 
    m.id as coordinator_id,
    m.name as coordinator_name,
    m.team_name,
    m.email,
    
    -- Tasks assigned by coordinator
    COUNT(t_assigned.id) as total_tasks_assigned,
    COUNT(CASE WHEN t_assigned.status = 'completed' THEN 1 END) as assigned_tasks_completed,
    COUNT(CASE WHEN t_assigned.status = 'in_progress' THEN 1 END) as assigned_tasks_in_progress,
    COUNT(CASE WHEN t_assigned.status = 'pending' THEN 1 END) as assigned_tasks_pending,
    
    -- Assignment success rate
    ROUND(
        (COUNT(CASE WHEN t_assigned.status = 'completed' THEN 1 END) * 100.0) / 
        NULLIF(COUNT(t_assigned.id), 0), 2
    ) as assignment_success_rate,
    
    -- Tasks assigned to coordinator
    COUNT(t_received.id) as total_tasks_received,
    COUNT(CASE WHEN t_received.status = 'completed' THEN 1 END) as received_tasks_completed,
    
    -- Personal completion rate
    ROUND(
        (COUNT(CASE WHEN t_received.status = 'completed' THEN 1 END) * 100.0) / 
        NULLIF(COUNT(t_received.id), 0), 2
    ) as personal_completion_rate,
    
    -- Points metrics for assigned tasks
    COALESCE(SUM(CASE WHEN t_assigned.status = 'completed' THEN t_assigned.points END), 0) as points_from_assigned_tasks,
    COALESCE(SUM(CASE WHEN t_received.status = 'completed' THEN t_received.points END), 0) as points_from_personal_tasks,
    
    -- Team management metrics
    COUNT(DISTINCT t_assigned.assigned_to) as unique_members_managed,
    
    -- Average task completion time for assigned tasks
    AVG(
        CASE 
            WHEN t_assigned.status = 'completed' AND t_assigned.completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (t_assigned.completed_at - t_assigned.created_at)) / 86400.0 
        END
    ) as avg_assigned_task_completion_days,
    
    -- Priority distribution of assigned tasks
    COUNT(CASE WHEN t_assigned.priority = 'high' THEN 1 END) as high_priority_assigned,
    COUNT(CASE WHEN t_assigned.priority = 'medium' THEN 1 END) as medium_priority_assigned,
    COUNT(CASE WHEN t_assigned.priority = 'low' THEN 1 END) as low_priority_assigned,
    
    -- Overdue management
    COUNT(
        CASE 
            WHEN t_assigned.deadline < CURRENT_DATE AND t_assigned.status != 'completed' 
            THEN 1 
        END
    ) as overdue_assigned_tasks,
    
    -- Recent activity
    COUNT(CASE WHEN t_assigned.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as tasks_assigned_last_7_days,
    COUNT(CASE WHEN t_assigned.completed_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as assigned_tasks_completed_last_7_days,
    
    -- Coordinator effectiveness score
    (
        -- Success rate weight (40%)
        (COUNT(CASE WHEN t_assigned.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t_assigned.id), 0)) * 0.4 +
        -- Points generated weight (30%)
        COALESCE(SUM(CASE WHEN t_assigned.status = 'completed' THEN t_assigned.points END), 0) * 0.3 +
        -- Personal performance weight (20%)
        (COUNT(CASE WHEN t_received.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t_received.id), 0)) * 0.2 +
        -- Team diversity weight (10%)
        COUNT(DISTINCT t_assigned.assigned_to) * 10 * 0.1
    ) as coordinator_effectiveness_score,
    
    -- Last activity
    GREATEST(MAX(t_assigned.updated_at), MAX(t_received.updated_at)) as last_activity_at
    
FROM prm_membrs m
LEFT JOIN tasks t_assigned ON m.id = t_assigned.assigned_by AND m.position = 'Coordinator'
LEFT JOIN tasks t_received ON m.id = t_received.assigned_to AND m.position = 'Coordinator'
WHERE m.position = 'Coordinator'
GROUP BY m.id, m.name, m.team_name, m.email
ORDER BY coordinator_effectiveness_score DESC, assignment_success_rate DESC;

-- =====================================================
-- 4. LEADERBOARD VIEWS (Weekly/Monthly)
-- =====================================================

-- Weekly leaderboard
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT 
    'member' as type,
    m.id,
    m.name,
    m.team_name,
    m.position,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) as points_earned,
    'week' as period
FROM prm_membrs m
LEFT JOIN tasks t ON m.id = t.assigned_to 
    AND t.completed_at >= DATE_TRUNC('week', CURRENT_DATE)
    AND t.completed_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
GROUP BY m.id, m.name, m.team_name, m.position
HAVING COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0
ORDER BY points_earned DESC, completed_tasks DESC
LIMIT 10;

-- Monthly leaderboard
CREATE OR REPLACE VIEW monthly_leaderboard AS
SELECT 
    'member' as type,
    m.id,
    m.name,
    m.team_name,
    m.position,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) as points_earned,
    'month' as period
FROM prm_membrs m
LEFT JOIN tasks t ON m.id = t.assigned_to 
    AND t.completed_at >= DATE_TRUNC('month', CURRENT_DATE)
    AND t.completed_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY m.id, m.name, m.team_name, m.position
HAVING COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0
ORDER BY points_earned DESC, completed_tasks DESC
LIMIT 10;

-- =====================================================
-- 5. DASHBOARD SUMMARY VIEW
-- =====================================================

CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    -- Overall statistics
    (SELECT COUNT(*) FROM tasks) as total_tasks,
    (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as total_completed,
    (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') as total_in_progress,
    (SELECT COUNT(*) FROM tasks WHERE status = 'pending') as total_pending,
    (SELECT COUNT(*) FROM tasks WHERE deadline < CURRENT_DATE AND status != 'completed') as total_overdue,
    
    -- Points statistics
    (SELECT COALESCE(SUM(points), 0) FROM tasks WHERE status = 'completed') as total_points_earned,
    (SELECT COALESCE(SUM(points), 0) FROM tasks) as total_points_possible,
    
    -- Team statistics
    (SELECT COUNT(DISTINCT team_name) FROM tasks) as active_teams,
    (SELECT COUNT(DISTINCT assigned_to) FROM tasks) as active_members,
    
    -- Recent activity
    (SELECT COUNT(*) FROM tasks WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as tasks_created_last_7_days,
    (SELECT COUNT(*) FROM tasks WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days') as tasks_completed_last_7_days,
    
    -- Best performers
    (SELECT team_name FROM team_performance_view ORDER BY team_score DESC LIMIT 1) as best_team,
    (SELECT member_name FROM member_performance_view ORDER BY member_score DESC LIMIT 1) as best_member,
    (SELECT coordinator_name FROM coordinator_performance_view ORDER BY coordinator_effectiveness_score DESC LIMIT 1) as best_coordinator;

-- =====================================================
-- 6. PERFORMANCE INDEXES FOR VIEWS
-- =====================================================

-- Indexes to optimize view performance
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at_week ON tasks(completed_at) 
    WHERE completed_at >= DATE_TRUNC('week', CURRENT_DATE);

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at_month ON tasks(completed_at) 
    WHERE completed_at >= DATE_TRUNC('month', CURRENT_DATE);

CREATE INDEX IF NOT EXISTS idx_tasks_status_points ON tasks(status, points);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_status ON tasks(priority, status);

-- =====================================================
-- VIEW PERMISSIONS
-- =====================================================

-- Grant appropriate permissions
GRANT SELECT ON team_performance_view TO authenticated;
GRANT SELECT ON member_performance_view TO authenticated;
GRANT SELECT ON coordinator_performance_view TO authenticated;
GRANT SELECT ON weekly_leaderboard TO authenticated;
GRANT SELECT ON monthly_leaderboard TO authenticated;
GRANT SELECT ON dashboard_summary TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON VIEW team_performance_view IS 'Comprehensive team performance analytics with scoring';
COMMENT ON VIEW member_performance_view IS 'Individual member performance metrics and rankings';
COMMENT ON VIEW coordinator_performance_view IS 'Coordinator effectiveness and team management metrics';
COMMENT ON VIEW weekly_leaderboard IS 'Top 10 performers for current week';
COMMENT ON VIEW monthly_leaderboard IS 'Top 10 performers for current month';
COMMENT ON VIEW dashboard_summary IS 'High-level dashboard statistics and best performers';
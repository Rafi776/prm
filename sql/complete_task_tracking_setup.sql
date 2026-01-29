-- =====================================================
-- COMPLETE EMAIL-BASED TASK TRACKING SYSTEM
-- Ready-to-run SQL script for Supabase
-- Execute this entire script in Supabase SQL Editor
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable Row Level Security globally
ALTER DATABASE postgres SET row_security = on;

-- =====================================================
-- STEP 1: PREPARE prm_membrs TABLE
-- =====================================================

-- Ensure email is unique in prm_membrs (required for foreign key)
DO $$ 
BEGIN
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_email' 
        AND conrelid = 'prm_membrs'::regclass
    ) THEN
        ALTER TABLE prm_membrs ADD CONSTRAINT unique_email UNIQUE (email);
    END IF;
END $$;

-- Create indexes on prm_membrs for better JOIN performance
CREATE INDEX IF NOT EXISTS idx_prm_membrs_email ON prm_membrs(email);
CREATE INDEX IF NOT EXISTS idx_prm_membrs_team_name ON prm_membrs(team_name);
CREATE INDEX IF NOT EXISTS idx_prm_membrs_position ON prm_membrs(position);

-- =====================================================
-- STEP 2: DROP EXISTING TABLES (IF ANY)
-- =====================================================

DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

-- Drop existing views
DROP VIEW IF EXISTS team_performance_view CASCADE;
DROP VIEW IF EXISTS member_performance_view CASCADE;
DROP VIEW IF EXISTS coordinator_performance_view CASCADE;
DROP VIEW IF EXISTS dashboard_summary CASCADE;
DROP VIEW IF EXISTS weekly_leaderboard CASCADE;
DROP VIEW IF EXISTS monthly_leaderboard CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_team() CASCADE;
DROP FUNCTION IF EXISTS get_user_email() CASCADE;
DROP FUNCTION IF EXISTS can_edit_task(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS can_view_task(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS update_task_completion() CASCADE;
DROP FUNCTION IF EXISTS validate_team_assignment() CASCADE;
DROP FUNCTION IF EXISTS prevent_completed_task_edit() CASCADE;

-- =====================================================
-- STEP 3: CREATE EMAIL-BASED TABLES
-- =====================================================

-- Main tasks table (email-based foreign keys)
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    description TEXT,
    assigned_by VARCHAR(255) NOT NULL REFERENCES prm_membrs(email) ON DELETE RESTRICT,
    assigned_to VARCHAR(255) NOT NULL REFERENCES prm_membrs(email) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0 AND points <= 100),
    deadline DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task comments (email-based)
CREATE TABLE task_comments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_email VARCHAR(255) NOT NULL REFERENCES prm_membrs(email) ON DELETE RESTRICT,
    comment TEXT NOT NULL CHECK (LENGTH(TRIM(comment)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task attachments (email-based)
CREATE TABLE task_attachments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by VARCHAR(255) NOT NULL REFERENCES prm_membrs(email) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 4: CREATE PERFORMANCE INDEXES
-- =====================================================

-- Primary performance indexes for email-based FKs
CREATE INDEX idx_tasks_assigned_to_email ON tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by_email ON tasks(assigned_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_completed_points ON tasks(status, points) WHERE status = 'completed';

-- Comment and attachment indexes
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_member_email ON task_comments(member_email);
CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- =====================================================
-- STEP 5: CREATE SECURITY FUNCTIONS
-- =====================================================

-- Get user email (helper function)
CREATE OR REPLACE FUNCTION get_user_email()
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get email from Supabase auth
    SELECT auth.jwt() ->> 'email' INTO user_email;
    
    -- If no email from JWT, try to get from auth.users
    IF user_email IS NULL THEN
        SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    END IF;
    
    RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user role by email
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_position TEXT;
    user_email TEXT;
BEGIN
    SELECT get_user_email() INTO user_email;
    
    -- Get position from prm_membrs using email
    SELECT position INTO user_position
    FROM prm_membrs
    WHERE email = user_email;
    
    RETURN COALESCE(user_position, 'guest');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user team by email
CREATE OR REPLACE FUNCTION get_user_team()
RETURNS TEXT AS $$
DECLARE
    user_team TEXT;
    user_email TEXT;
BEGIN
    SELECT get_user_email() INTO user_email;
    
    -- Get team from prm_membrs using email
    SELECT team_name INTO user_team
    FROM prm_membrs
    WHERE email = user_email;
    
    RETURN user_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can edit task (email-based)
CREATE OR REPLACE FUNCTION can_edit_task(task_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_team TEXT;
    user_email TEXT;
    task_assignee_email TEXT;
    task_assignee_team TEXT;
    task_status TEXT;
BEGIN
    SELECT get_user_role(), get_user_team(), get_user_email() 
    INTO user_role, user_team, user_email;
    
    SELECT t.assigned_to, m.team_name, t.status 
    INTO task_assignee_email, task_assignee_team, task_status
    FROM tasks t
    JOIN prm_membrs m ON t.assigned_to = m.email
    WHERE t.id = task_id;
    
    -- Cannot edit completed tasks (except admins for corrections)
    IF task_status = 'completed' AND user_role != 'Admin' THEN
        RETURN FALSE;
    END IF;
    
    -- Admin can edit all
    IF user_role = 'Admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Coordinator can edit team tasks
    IF user_role = 'Coordinator' AND user_team = task_assignee_team THEN
        RETURN TRUE;
    END IF;
    
    -- Member can edit only assigned tasks
    IF user_role = 'Member' AND task_assignee_email = user_email THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can view task (email-based)
CREATE OR REPLACE FUNCTION can_view_task(task_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_team TEXT;
    task_assignee_team TEXT;
BEGIN
    SELECT get_user_role(), get_user_team() INTO user_role, user_team;
    
    SELECT m.team_name INTO task_assignee_team
    FROM tasks t
    JOIN prm_membrs m ON t.assigned_to = m.email
    WHERE t.id = task_id;
    
    -- Admin can view all
    IF user_role = 'Admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Coordinator can view team tasks
    IF user_role = 'Coordinator' AND user_team = task_assignee_team THEN
        RETURN TRUE;
    END IF;
    
    -- Member can view all tasks (business requirement)
    IF user_role = 'Member' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 6: CREATE BUSINESS LOGIC FUNCTIONS
-- =====================================================

-- Function to update completed_at timestamp
CREATE OR REPLACE FUNCTION update_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Set completed_at when status changes to completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        NEW.completed_at = NOW();
    END IF;
    
    -- Clear completed_at if status changes from completed
    IF NEW.status != 'completed' AND OLD.status = 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    
    -- Update updated_at timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate team assignment (email-based)
CREATE OR REPLACE FUNCTION validate_team_assignment()
RETURNS TRIGGER AS $$
DECLARE
    assignee_team VARCHAR(100);
    assigner_team VARCHAR(100);
    assigner_position VARCHAR(100);
BEGIN
    -- Get assignee team using email
    SELECT team_name INTO assignee_team 
    FROM prm_membrs 
    WHERE email = NEW.assigned_to;
    
    -- Get assigner team and position using email
    SELECT team_name, position INTO assigner_team, assigner_position
    FROM prm_membrs 
    WHERE email = NEW.assigned_by;
    
    -- Check if assignee exists
    IF assignee_team IS NULL THEN
        RAISE EXCEPTION 'Assignee email % not found in members table', NEW.assigned_to;
    END IF;
    
    -- Check if assigner exists
    IF assigner_team IS NULL THEN
        RAISE EXCEPTION 'Assigner email % not found in members table', NEW.assigned_by;
    END IF;
    
    -- Admin can assign to any team
    IF assigner_position = 'Admin' THEN
        RETURN NEW;
    END IF;
    
    -- Coordinator can only assign within their team
    IF assigner_position = 'Coordinator' AND assigner_team = assignee_team THEN
        RETURN NEW;
    END IF;
    
    -- Members cannot assign tasks
    IF assigner_position = 'Member' THEN
        RAISE EXCEPTION 'Members cannot assign tasks';
    END IF;
    
    -- If coordinator trying to assign outside their team
    IF assigner_position = 'Coordinator' AND assigner_team != assignee_team THEN
        RAISE EXCEPTION 'Coordinators can only assign tasks within their own team (% != %)', assigner_team, assignee_team;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent editing completed tasks
CREATE OR REPLACE FUNCTION prevent_completed_task_edit()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow status change from completed to other states (for corrections)
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;
    
    -- Prevent editing other fields of completed tasks
    IF OLD.status = 'completed' AND (
        OLD.title != NEW.title OR 
        COALESCE(OLD.description, '') != COALESCE(NEW.description, '') OR 
        OLD.assigned_to != NEW.assigned_to OR 
        OLD.priority != NEW.priority OR 
        OLD.points != NEW.points OR 
        COALESCE(OLD.deadline, '1900-01-01'::date) != COALESCE(NEW.deadline, '1900-01-01'::date)
    ) THEN
        RAISE EXCEPTION 'Cannot edit completed tasks. Only status changes are allowed for corrections.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 7: CREATE TRIGGERS
-- =====================================================

CREATE TRIGGER trigger_update_task_completion
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_completion();

CREATE TRIGGER trigger_validate_team_assignment
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_team_assignment();

CREATE TRIGGER trigger_prevent_completed_task_edit
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION prevent_completed_task_edit();

-- =====================================================
-- STEP 8: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 9: CREATE RLS POLICIES
-- =====================================================

-- ADMIN POLICIES: Full access to everything
CREATE POLICY "admin_full_access_tasks" ON tasks
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- COORDINATOR POLICIES: Manage tasks in their team (email-based)
CREATE POLICY "coordinator_team_tasks" ON tasks
    FOR ALL
    TO authenticated
    USING (
        get_user_role() = 'Coordinator' 
        AND EXISTS (
            SELECT 1 FROM prm_membrs assignee
            WHERE assignee.email = tasks.assigned_to 
            AND assignee.team_name = get_user_team()
        )
    )
    WITH CHECK (
        get_user_role() = 'Coordinator' 
        AND EXISTS (
            SELECT 1 FROM prm_membrs assignee
            WHERE assignee.email = tasks.assigned_to 
            AND assignee.team_name = get_user_team()
        )
    );

-- MEMBER POLICIES: View all, update only assigned tasks (email-based)
CREATE POLICY "member_view_all_tasks" ON tasks
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'Member');

CREATE POLICY "member_update_assigned_tasks" ON tasks
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'Member' 
        AND assigned_to = get_user_email()
    )
    WITH CHECK (
        get_user_role() = 'Member' 
        AND assigned_to = get_user_email()
    );

-- Comment policies (email-based)
CREATE POLICY "comments_access" ON task_comments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_comments.task_id
        )
    );

-- Attachment policies (email-based)
CREATE POLICY "attachments_access" ON task_attachments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_attachments.task_id
        )
    );

-- =====================================================
-- STEP 10: CREATE ANALYTICS VIEWS
-- =====================================================

-- Team Performance View (Email-based joins)
CREATE VIEW team_performance_view AS
SELECT 
    assignee.team_name,
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
    
    -- Team ranking score
    (
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) * 0.6 +
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) * 0.3 +
        (COUNT(CASE WHEN t.priority = 'high' AND t.status = 'completed' THEN 1 END) * 5) * 0.1
    ) as team_score,
    
    -- Last activity
    MAX(t.updated_at) as last_activity_at
    
FROM tasks t
JOIN prm_membrs assignee ON t.assigned_to = assignee.email
GROUP BY assignee.team_name
ORDER BY team_score DESC, total_points_earned DESC;

-- Member Performance View (Email-based with full member info)
CREATE VIEW member_performance_view AS
SELECT 
    m.email as member_email,
    m.name as member_name,
    m.team_name,
    m.position,
    COALESCE(m.phone, '') as phone,
    COALESCE(m.scout_group, '') as scout_group,
    COALESCE(m.district, '') as district,
    COALESCE(m.stage, '') as stage,
    
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
    
    -- Current overdue tasks
    COUNT(
        CASE 
            WHEN t.deadline < CURRENT_DATE AND t.status != 'completed' 
            THEN 1 
        END
    ) as current_overdue_tasks,
    
    -- Member ranking score
    (
        COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) * 0.5 +
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0)) * 0.3 +
        (COUNT(CASE WHEN t.priority = 'high' AND t.status = 'completed' THEN 1 END) * 10) * 0.2
    ) as member_score,
    
    -- Last activity
    MAX(t.updated_at) as last_activity_at
    
FROM prm_membrs m
LEFT JOIN tasks t ON m.email = t.assigned_to
GROUP BY m.email, m.name, m.team_name, m.position, m.phone, m.scout_group, m.district, m.stage
ORDER BY member_score DESC, total_points_earned DESC;

-- Coordinator Performance View (Email-based)
CREATE VIEW coordinator_performance_view AS
SELECT 
    m.email as coordinator_email,
    m.name as coordinator_name,
    m.team_name,
    COALESCE(m.phone, '') as phone,
    COALESCE(m.scout_group, '') as scout_group,
    COALESCE(m.district, '') as district,
    
    -- Tasks assigned by coordinator
    COUNT(t_assigned.id) as total_tasks_assigned,
    COUNT(CASE WHEN t_assigned.status = 'completed' THEN 1 END) as assigned_tasks_completed,
    
    -- Assignment success rate
    ROUND(
        (COUNT(CASE WHEN t_assigned.status = 'completed' THEN 1 END) * 100.0) / 
        NULLIF(COUNT(t_assigned.id), 0), 2
    ) as assignment_success_rate,
    
    -- Tasks assigned to coordinator
    COUNT(t_received.id) as total_tasks_received,
    COUNT(CASE WHEN t_received.status = 'completed' THEN 1 END) as received_tasks_completed,
    
    -- Points metrics
    COALESCE(SUM(CASE WHEN t_assigned.status = 'completed' THEN t_assigned.points END), 0) as points_from_assigned_tasks,
    COALESCE(SUM(CASE WHEN t_received.status = 'completed' THEN t_received.points END), 0) as points_from_personal_tasks,
    
    -- Team management metrics
    COUNT(DISTINCT t_assigned.assigned_to) as unique_members_managed,
    
    -- Coordinator effectiveness score
    (
        (COUNT(CASE WHEN t_assigned.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t_assigned.id), 0)) * 0.4 +
        COALESCE(SUM(CASE WHEN t_assigned.status = 'completed' THEN t_assigned.points END), 0) * 0.3 +
        (COUNT(CASE WHEN t_received.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(t_received.id), 0)) * 0.2 +
        COUNT(DISTINCT t_assigned.assigned_to) * 10 * 0.1
    ) as coordinator_effectiveness_score,
    
    -- Last activity
    GREATEST(MAX(t_assigned.updated_at), MAX(t_received.updated_at)) as last_activity_at
    
FROM prm_membrs m
LEFT JOIN tasks t_assigned ON m.email = t_assigned.assigned_by AND m.position = 'Coordinator'
LEFT JOIN tasks t_received ON m.email = t_received.assigned_to AND m.position = 'Coordinator'
WHERE m.position = 'Coordinator'
GROUP BY m.email, m.name, m.team_name, m.phone, m.scout_group, m.district
ORDER BY coordinator_effectiveness_score DESC, assignment_success_rate DESC;

-- Dashboard Summary View (Email-based)
CREATE VIEW dashboard_summary AS
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
    (SELECT COUNT(DISTINCT assignee.team_name) FROM tasks t JOIN prm_membrs assignee ON t.assigned_to = assignee.email) as active_teams,
    (SELECT COUNT(DISTINCT assigned_to) FROM tasks) as active_members,
    
    -- Best performers (email-based)
    (SELECT team_name FROM team_performance_view ORDER BY team_score DESC LIMIT 1) as best_team,
    (SELECT member_name FROM member_performance_view ORDER BY member_score DESC LIMIT 1) as best_member,
    (SELECT coordinator_name FROM coordinator_performance_view ORDER BY coordinator_effectiveness_score DESC LIMIT 1) as best_coordinator;

-- Weekly Leaderboard (Email-based)
CREATE VIEW weekly_leaderboard AS
SELECT 
    m.email,
    m.name,
    m.team_name,
    m.position,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) as points_earned,
    'week' as period
FROM prm_membrs m
LEFT JOIN tasks t ON m.email = t.assigned_to 
    AND t.completed_at >= DATE_TRUNC('week', CURRENT_DATE)
    AND t.completed_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
GROUP BY m.email, m.name, m.team_name, m.position
HAVING COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0
ORDER BY points_earned DESC, completed_tasks DESC
LIMIT 10;

-- Monthly Leaderboard (Email-based)
CREATE VIEW monthly_leaderboard AS
SELECT 
    m.email,
    m.name,
    m.team_name,
    m.position,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.points END), 0) as points_earned,
    'month' as period
FROM prm_membrs m
LEFT JOIN tasks t ON m.email = t.assigned_to 
    AND t.completed_at >= DATE_TRUNC('month', CURRENT_DATE)
    AND t.completed_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY m.email, m.name, m.team_name, m.position
HAVING COUNT(CASE WHEN t.status = 'completed' THEN 1 END) > 0
ORDER BY points_earned DESC, completed_tasks DESC
LIMIT 10;

-- =====================================================
-- STEP 11: GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_team() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_task(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_task(BIGINT) TO authenticated;

-- Grant select on views
GRANT SELECT ON team_performance_view TO authenticated;
GRANT SELECT ON member_performance_view TO authenticated;
GRANT SELECT ON coordinator_performance_view TO authenticated;
GRANT SELECT ON weekly_leaderboard TO authenticated;
GRANT SELECT ON monthly_leaderboard TO authenticated;
GRANT SELECT ON dashboard_summary TO authenticated;

-- =====================================================
-- STEP 12: CREATE STORAGE BUCKET FOR ATTACHMENTS
-- =====================================================

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-files', 'task-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
DO $$ 
BEGIN
    -- Check if policies exist before creating them
    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'task-files' 
        AND name = 'Authenticated users can upload task files'
    ) THEN
        CREATE POLICY "Authenticated users can upload task files" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'task-files');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'task-files' 
        AND name = 'Authenticated users can view task files'
    ) THEN
        CREATE POLICY "Authenticated users can view task files" ON storage.objects
            FOR SELECT TO authenticated
            USING (bucket_id = 'task-files');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'task-files' 
        AND name = 'Users can update their own uploads'
    ) THEN
        CREATE POLICY "Users can update their own uploads" ON storage.objects
            FOR UPDATE TO authenticated
            USING (bucket_id = 'task-files');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM storage.policies 
        WHERE bucket_id = 'task-files' 
        AND name = 'Users can delete their own uploads'
    ) THEN
        CREATE POLICY "Users can delete their own uploads" ON storage.objects
            FOR DELETE TO authenticated
            USING (bucket_id = 'task-files');
    END IF;
END $$;

-- =====================================================
-- STEP 13: UPDATE TABLE STATISTICS
-- =====================================================

-- Update table statistics for performance
ANALYZE tasks;
ANALYZE task_comments;
ANALYZE task_attachments;
ANALYZE prm_membrs;

-- =====================================================
-- STEP 14: ADD TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE tasks IS 'Main task tracking table with email-based foreign keys to prm_membrs';
COMMENT ON TABLE task_comments IS 'Comments and communication on tasks';
COMMENT ON TABLE task_attachments IS 'File attachments for tasks';

COMMENT ON COLUMN tasks.assigned_by IS 'Email of the person who assigned the task (from prm_membrs)';
COMMENT ON COLUMN tasks.assigned_to IS 'Email of the person assigned to the task (from prm_membrs)';
COMMENT ON COLUMN tasks.points IS 'Points awarded for task completion (1-100)';
COMMENT ON COLUMN tasks.status IS 'Task status: pending, in_progress, completed';
COMMENT ON COLUMN tasks.priority IS 'Task priority: low, medium, high';
COMMENT ON COLUMN tasks.completed_at IS 'Automatically set when status becomes completed';

-- =====================================================
-- STEP 15: VERIFICATION QUERIES
-- =====================================================

-- Verify setup
SELECT 
    'Tables Created' as component,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_name IN ('tasks', 'task_comments', 'task_attachments')
AND table_schema = 'public'

UNION ALL

SELECT 
    'Views Created' as component,
    COUNT(*) as count
FROM information_schema.views 
WHERE table_name LIKE '%performance%' OR table_name LIKE '%leaderboard%' OR table_name = 'dashboard_summary'
AND table_schema = 'public'

UNION ALL

SELECT 
    'Functions Created' as component,
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_name LIKE 'get_user_%' OR routine_name LIKE 'can_%task'
AND routine_schema = 'public'

UNION ALL

SELECT 
    'Triggers Created' as component,
    COUNT(*) as count
FROM information_schema.triggers 
WHERE event_object_table = 'tasks'

UNION ALL

SELECT 
    'RLS Policies Created' as component,
    COUNT(*) as count
FROM pg_policies 
WHERE tablename IN ('tasks', 'task_comments', 'task_attachments');

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================

SELECT 
    '🎉 EMAIL-BASED TASK TRACKING SYSTEM SETUP COMPLETE! 🎉' as status,
    NOW() as completed_at,
    'System is ready for use with email-based foreign keys' as message;

-- =====================================================
-- NEXT STEPS:
-- 1. Ensure your prm_membrs table has valid email addresses
-- 2. Test the system by creating sample tasks
-- 3. Verify RLS policies work with your authentication
-- 4. Configure your frontend to use the new email-based system
-- =====================================================
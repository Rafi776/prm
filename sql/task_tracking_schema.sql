-- =====================================================
-- TASK TRACKING SYSTEM - DATABASE SCHEMA
-- Production-ready SQL for Supabase/PostgreSQL
-- =====================================================

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- =====================================================
-- 1. CORE TABLES
-- =====================================================

-- Tasks table with comprehensive tracking
CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(title)) > 0),
    description TEXT,
    team_name VARCHAR(100) NOT NULL CHECK (team_name IN (
        'Graphics Design', 'Content Writing', 'Social Media', 
        'Video Editing', 'Photography', 'Research & Development', 
        'Rover Paper', 'Presentation'
    )),
    assigned_by BIGINT NOT NULL REFERENCES prm_membrs(id) ON DELETE RESTRICT,
    assigned_to BIGINT NOT NULL REFERENCES prm_membrs(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0 AND points <= 100),
    deadline DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task comments for communication
CREATE TABLE IF NOT EXISTS task_comments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES prm_membrs(id) ON DELETE RESTRICT,
    comment TEXT NOT NULL CHECK (LENGTH(TRIM(comment)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task attachments/files
CREATE TABLE IF NOT EXISTS task_attachments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by BIGINT NOT NULL REFERENCES prm_membrs(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary performance indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_team_name ON tasks(team_name);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks(team_name, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_points ON tasks(status, points) WHERE status = 'completed';

-- Comment and attachment indexes
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- =====================================================
-- 3. TRIGGERS FOR BUSINESS LOGIC
-- =====================================================

-- Function to update completed_at timestamp
CREATE OR REPLACE FUNCTION update_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Set completed_at when status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
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
        OLD.description != NEW.description OR 
        OLD.team_name != NEW.team_name OR 
        OLD.assigned_to != NEW.assigned_to OR 
        OLD.priority != NEW.priority OR 
        OLD.points != NEW.points OR 
        OLD.deadline != NEW.deadline
    ) THEN
        RAISE EXCEPTION 'Cannot edit completed tasks. Only status changes are allowed for corrections.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate team assignment
CREATE OR REPLACE FUNCTION validate_team_assignment()
RETURNS TRIGGER AS $$
DECLARE
    assignee_team VARCHAR(100);
BEGIN
    -- Get the team of the person being assigned the task
    SELECT team_name INTO assignee_team 
    FROM prm_membrs 
    WHERE id = NEW.assigned_to;
    
    -- Validate that task team matches assignee team
    IF NEW.team_name != assignee_team THEN
        RAISE EXCEPTION 'Task team (%) must match assignee team (%)', NEW.team_name, assignee_team;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_update_task_completion ON tasks;
CREATE TRIGGER trigger_update_task_completion
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_completion();

DROP TRIGGER IF EXISTS trigger_prevent_completed_task_edit ON tasks;
CREATE TRIGGER trigger_prevent_completed_task_edit
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION prevent_completed_task_edit();

DROP TRIGGER IF EXISTS trigger_validate_team_assignment ON tasks;
CREATE TRIGGER trigger_validate_team_assignment
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_team_assignment();

-- =====================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything
CREATE POLICY "admin_full_access" ON tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prm_membrs 
            WHERE id = auth.uid()::bigint 
            AND position = 'Admin'
        )
    );

-- Policy: Coordinator can manage tasks in their team
CREATE POLICY "coordinator_team_access" ON tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prm_membrs 
            WHERE id = auth.uid()::bigint 
            AND position = 'Coordinator'
            AND team_name = tasks.team_name
        )
    );

-- Policy: Members can view all tasks but only update their assigned tasks
CREATE POLICY "member_view_all" ON tasks
    FOR SELECT
    USING (true);

CREATE POLICY "member_update_assigned" ON tasks
    FOR UPDATE
    USING (
        assigned_to = auth.uid()::bigint
        AND EXISTS (
            SELECT 1 FROM prm_membrs 
            WHERE id = auth.uid()::bigint 
            AND position = 'Member'
        )
    );

-- Comment policies
CREATE POLICY "comments_access" ON task_comments
    FOR ALL
    USING (
        -- Can comment on tasks they can see
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_comments.task_id
        )
    );

-- Attachment policies  
CREATE POLICY "attachments_access" ON task_attachments
    FOR ALL
    USING (
        -- Can attach to tasks they can see
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_attachments.task_id
        )
    );

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to get user role and team
CREATE OR REPLACE FUNCTION get_user_context()
RETURNS TABLE(user_id BIGINT, position VARCHAR, team_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT id, prm_membrs.position, prm_membrs.team_name
    FROM prm_membrs
    WHERE id = auth.uid()::bigint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can assign tasks to a team
CREATE OR REPLACE FUNCTION can_assign_to_team(target_team VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    user_position VARCHAR;
    user_team VARCHAR;
BEGIN
    SELECT position, team_name INTO user_position, user_team
    FROM prm_membrs
    WHERE id = auth.uid()::bigint;
    
    -- Admin can assign to any team
    IF user_position = 'Admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Coordinator can assign only to their team
    IF user_position = 'Coordinator' AND user_team = target_team THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. SAMPLE DATA (for testing)
-- =====================================================

-- Insert sample tasks (uncomment for testing)
/*
INSERT INTO tasks (title, description, team_name, assigned_by, assigned_to, priority, points, deadline) VALUES
('Design Instagram Post', 'Create engaging post for upcoming event', 'Graphics Design', 1, 2, 'high', 5, '2024-02-15'),
('Write Blog Article', 'Article about recent activities', 'Content Writing', 1, 3, 'medium', 8, '2024-02-20'),
('Social Media Campaign', 'Plan and execute campaign', 'Social Media', 1, 4, 'high', 10, '2024-02-18');
*/

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================

COMMENT ON TABLE tasks IS 'Main task tracking table with comprehensive business logic';
COMMENT ON TABLE task_comments IS 'Comments and communication on tasks';
COMMENT ON TABLE task_attachments IS 'File attachments for tasks';

COMMENT ON COLUMN tasks.points IS 'Points awarded for task completion (1-100)';
COMMENT ON COLUMN tasks.status IS 'Task status: pending, in_progress, completed';
COMMENT ON COLUMN tasks.priority IS 'Task priority: low, medium, high';
COMMENT ON COLUMN tasks.completed_at IS 'Automatically set when status becomes completed';
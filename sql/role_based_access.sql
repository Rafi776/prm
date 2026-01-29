-- =====================================================
-- ROLE-BASED ACCESS CONTROL (RLS) POLICIES
-- Production-ready security for task tracking system
-- =====================================================

-- =====================================================
-- 1. AUTHENTICATION SETUP
-- =====================================================

-- Create custom claims function for user roles
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_position TEXT;
BEGIN
    SELECT position INTO user_position
    FROM prm_membrs
    WHERE id = auth.uid()::bigint;
    
    RETURN COALESCE(user_position, 'guest');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user team
CREATE OR REPLACE FUNCTION get_user_team()
RETURNS TEXT AS $$
DECLARE
    user_team TEXT;
BEGIN
    SELECT team_name INTO user_team
    FROM prm_membrs
    WHERE id = auth.uid()::bigint;
    
    RETURN user_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. TASK TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "admin_full_access" ON tasks;
DROP POLICY IF EXISTS "coordinator_team_access" ON tasks;
DROP POLICY IF EXISTS "member_view_all" ON tasks;
DROP POLICY IF EXISTS "member_update_assigned" ON tasks;

-- ADMIN POLICIES: Full access to everything
CREATE POLICY "admin_full_access_tasks" ON tasks
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- COORDINATOR POLICIES: Manage tasks in their team
CREATE POLICY "coordinator_insert_team_tasks" ON tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_user_role() = 'Coordinator' 
        AND team_name = get_user_team()
        AND EXISTS (
            SELECT 1 FROM prm_membrs 
            WHERE id = assigned_to 
            AND team_name = get_user_team()
        )
    );

CREATE POLICY "coordinator_view_team_tasks" ON tasks
    FOR SELECT
    TO authenticated
    USING (
        get_user_role() = 'Coordinator' 
        AND team_name = get_user_team()
    );

CREATE POLICY "coordinator_update_team_tasks" ON tasks
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'Coordinator' 
        AND team_name = get_user_team()
    )
    WITH CHECK (
        get_user_role() = 'Coordinator' 
        AND team_name = get_user_team()
    );

CREATE POLICY "coordinator_delete_team_tasks" ON tasks
    FOR DELETE
    TO authenticated
    USING (
        get_user_role() = 'Coordinator' 
        AND team_name = get_user_team()
        AND status != 'completed'  -- Cannot delete completed tasks
    );

-- MEMBER POLICIES: View all, update only assigned tasks
CREATE POLICY "member_view_all_tasks" ON tasks
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'Member');

CREATE POLICY "member_update_assigned_tasks" ON tasks
    FOR UPDATE
    TO authenticated
    USING (
        get_user_role() = 'Member' 
        AND assigned_to = auth.uid()::bigint
    )
    WITH CHECK (
        get_user_role() = 'Member' 
        AND assigned_to = auth.uid()::bigint
        -- Members can only update status, not reassign or change core details
        AND (OLD.title = NEW.title)
        AND (OLD.description = NEW.description OR NEW.description IS NOT NULL)
        AND (OLD.team_name = NEW.team_name)
        AND (OLD.assigned_by = NEW.assigned_by)
        AND (OLD.assigned_to = NEW.assigned_to)
        AND (OLD.priority = NEW.priority)
        AND (OLD.points = NEW.points)
        AND (OLD.deadline = NEW.deadline)
    );

-- =====================================================
-- 3. TASK COMMENTS RLS POLICIES
-- =====================================================

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Admin can manage all comments
CREATE POLICY "admin_full_access_comments" ON task_comments
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- Users can view comments on tasks they can see
CREATE POLICY "view_task_comments" ON task_comments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_comments.task_id
            -- This will use the task RLS policies to determine access
        )
    );

-- Users can add comments to tasks they can see
CREATE POLICY "insert_task_comments" ON task_comments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        member_id = auth.uid()::bigint
        AND EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_comments.task_id
            -- This will use the task RLS policies to determine access
        )
    );

-- Users can update/delete their own comments
CREATE POLICY "manage_own_comments" ON task_comments
    FOR ALL
    TO authenticated
    USING (member_id = auth.uid()::bigint)
    WITH CHECK (member_id = auth.uid()::bigint);

-- =====================================================
-- 4. TASK ATTACHMENTS RLS POLICIES
-- =====================================================

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Admin can manage all attachments
CREATE POLICY "admin_full_access_attachments" ON task_attachments
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- Users can view attachments on tasks they can see
CREATE POLICY "view_task_attachments" ON task_attachments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_attachments.task_id
            -- This will use the task RLS policies to determine access
        )
    );

-- Users can add attachments to tasks they can see
CREATE POLICY "insert_task_attachments" ON task_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()::bigint
        AND EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_attachments.task_id
            -- This will use the task RLS policies to determine access
        )
    );

-- Users can manage their own attachments
CREATE POLICY "manage_own_attachments" ON task_attachments
    FOR ALL
    TO authenticated
    USING (uploaded_by = auth.uid()::bigint)
    WITH CHECK (uploaded_by = auth.uid()::bigint);

-- =====================================================
-- 5. MEMBER TABLE RLS POLICIES
-- =====================================================

-- Enable RLS on members table if not already enabled
ALTER TABLE prm_membrs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view member information (needed for task assignment)
CREATE POLICY "view_all_members" ON prm_membrs
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can modify member information
CREATE POLICY "admin_manage_members" ON prm_membrs
    FOR ALL
    TO authenticated
    USING (get_user_role() = 'Admin')
    WITH CHECK (get_user_role() = 'Admin');

-- Members can update their own profile
CREATE POLICY "update_own_profile" ON prm_membrs
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid()::bigint)
    WITH CHECK (
        id = auth.uid()::bigint
        -- Prevent users from changing their own role or team without admin approval
        AND (OLD.position = NEW.position OR get_user_role() = 'Admin')
        AND (OLD.team_name = NEW.team_name OR get_user_role() = 'Admin')
    );

-- =====================================================
-- 6. VALIDATION FUNCTIONS
-- =====================================================

-- Function to validate task assignment permissions
CREATE OR REPLACE FUNCTION validate_task_assignment_permission()
RETURNS TRIGGER AS $$
DECLARE
    assigner_role TEXT;
    assigner_team TEXT;
    assignee_team TEXT;
BEGIN
    -- Get assigner information
    SELECT position, team_name INTO assigner_role, assigner_team
    FROM prm_membrs
    WHERE id = NEW.assigned_by;
    
    -- Get assignee team
    SELECT team_name INTO assignee_team
    FROM prm_membrs
    WHERE id = NEW.assigned_to;
    
    -- Validate assignment rules
    IF assigner_role = 'Admin' THEN
        -- Admin can assign to anyone
        RETURN NEW;
    ELSIF assigner_role = 'Coordinator' THEN
        -- Coordinator can only assign within their team
        IF assigner_team = NEW.team_name AND assignee_team = NEW.team_name THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Coordinators can only assign tasks within their own team';
        END IF;
    ELSE
        -- Members cannot assign tasks
        RAISE EXCEPTION 'Only Admins and Coordinators can assign tasks';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation trigger
DROP TRIGGER IF EXISTS trigger_validate_assignment_permission ON tasks;
CREATE TRIGGER trigger_validate_assignment_permission
    BEFORE INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_task_assignment_permission();

-- =====================================================
-- 7. AUDIT LOGGING
-- =====================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS task_audit_log (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_by BIGINT REFERENCES prm_membrs(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO task_audit_log (task_id, action, old_values, changed_by)
        VALUES (OLD.id, 'DELETE', to_jsonb(OLD), auth.uid()::bigint);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO task_audit_log (task_id, action, old_values, new_values, changed_by)
        VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid()::bigint);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO task_audit_log (task_id, action, new_values, changed_by)
        VALUES (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid()::bigint);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger
DROP TRIGGER IF EXISTS trigger_audit_task_changes ON tasks;
CREATE TRIGGER trigger_audit_task_changes
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION audit_task_changes();

-- =====================================================
-- 8. SECURITY HELPER FUNCTIONS
-- =====================================================

-- Function to check if user can view task
CREATE OR REPLACE FUNCTION can_view_task(task_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_team TEXT;
    task_team TEXT;
    task_assigned_to BIGINT;
BEGIN
    SELECT get_user_role(), get_user_team() INTO user_role, user_team;
    
    SELECT team_name, assigned_to INTO task_team, task_assigned_to
    FROM tasks WHERE id = task_id;
    
    -- Admin can view all
    IF user_role = 'Admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Coordinator can view team tasks
    IF user_role = 'Coordinator' AND user_team = task_team THEN
        RETURN TRUE;
    END IF;
    
    -- Member can view all tasks (business requirement)
    IF user_role = 'Member' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can edit task
CREATE OR REPLACE FUNCTION can_edit_task(task_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_team TEXT;
    task_team TEXT;
    task_assigned_to BIGINT;
    task_status TEXT;
BEGIN
    SELECT get_user_role(), get_user_team() INTO user_role, user_team;
    
    SELECT team_name, assigned_to, status INTO task_team, task_assigned_to, task_status
    FROM tasks WHERE id = task_id;
    
    -- Cannot edit completed tasks (except admins for corrections)
    IF task_status = 'completed' AND user_role != 'Admin' THEN
        RETURN FALSE;
    END IF;
    
    -- Admin can edit all
    IF user_role = 'Admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Coordinator can edit team tasks
    IF user_role = 'Coordinator' AND user_team = task_team THEN
        RETURN TRUE;
    END IF;
    
    -- Member can edit only assigned tasks
    IF user_role = 'Member' AND task_assigned_to = auth.uid()::bigint THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. PERFORMANCE MONITORING
-- =====================================================

-- Create performance monitoring view
CREATE OR REPLACE VIEW rls_performance_monitor AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
AND tablename IN ('tasks', 'task_comments', 'task_attachments', 'prm_membrs')
ORDER BY tablename, attname;

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_team() TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_task(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_task(BIGINT) TO authenticated;

-- Grant select on audit log to admins only
CREATE POLICY "admin_view_audit_log" ON task_audit_log
    FOR SELECT
    TO authenticated
    USING (get_user_role() = 'Admin');

ALTER TABLE task_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION get_user_role() IS 'Returns the role (Admin/Coordinator/Member) of the current authenticated user';
COMMENT ON FUNCTION get_user_team() IS 'Returns the team name of the current authenticated user';
COMMENT ON FUNCTION can_view_task(BIGINT) IS 'Checks if current user can view the specified task';
COMMENT ON FUNCTION can_edit_task(BIGINT) IS 'Checks if current user can edit the specified task';
COMMENT ON TABLE task_audit_log IS 'Audit trail for all task changes with user tracking';

-- =====================================================
-- RLS POLICIES COMPLETE
-- =====================================================
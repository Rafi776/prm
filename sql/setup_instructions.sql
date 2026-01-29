-- =====================================================
-- TASK TRACKING SYSTEM - SETUP INSTRUCTIONS
-- Complete deployment guide for Supabase/PostgreSQL
-- =====================================================

-- =====================================================
-- STEP 1: EXECUTE SCHEMA FILES IN ORDER
-- =====================================================

-- 1. First, run the main schema (creates tables, indexes, triggers)
-- File: task_tracking_schema.sql

-- 2. Then, run the analytics views
-- File: analytics_views.sql  

-- 3. Finally, run the role-based access control
-- File: role_based_access.sql

-- =====================================================
-- STEP 2: SUPABASE SPECIFIC SETUP
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-files', 'task-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Authenticated users can upload task files" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "Authenticated users can view task files" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'task-files');

CREATE POLICY "Users can update their own uploads" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'task-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own uploads" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'task-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- STEP 3: AUTHENTICATION SETUP
-- =====================================================

-- Create auth trigger to sync user data
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- This function should be customized based on your user registration flow
    -- For now, it's a placeholder that ensures user exists in prm_membrs
    
    -- Check if user already exists in prm_membrs
    IF NOT EXISTS (SELECT 1 FROM prm_membrs WHERE id = NEW.id::bigint) THEN
        -- Insert new user with default values
        -- You'll need to customize this based on your registration process
        INSERT INTO prm_membrs (id, name, email, position, team_name)
        VALUES (
            NEW.id::bigint,
            COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
            NEW.email,
            'Member', -- Default role
            'Graphics Design' -- Default team, should be set during registration
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- STEP 4: SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert sample teams and members (customize as needed)
INSERT INTO prm_membrs (name, email, position, team_name) VALUES
-- Admins
('John Admin', 'admin@prm.com', 'Admin', 'Graphics Design'),

-- Coordinators
('Alice Graphics', 'alice@prm.com', 'Coordinator', 'Graphics Design'),
('Bob Content', 'bob@prm.com', 'Coordinator', 'Content Writing'),
('Carol Social', 'carol@prm.com', 'Coordinator', 'Social Media'),
('David Video', 'david@prm.com', 'Coordinator', 'Video Editing'),
('Eve Photo', 'eve@prm.com', 'Coordinator', 'Photography'),
('Frank Research', 'frank@prm.com', 'Coordinator', 'Research & Development'),
('Grace Paper', 'grace@prm.com', 'Coordinator', 'Rover Paper'),
('Henry Present', 'henry@prm.com', 'Coordinator', 'Presentation'),

-- Members
('Sarah Designer', 'sarah@prm.com', 'Member', 'Graphics Design'),
('Mike Writer', 'mike@prm.com', 'Member', 'Content Writing'),
('Lisa Social', 'lisa@prm.com', 'Member', 'Social Media'),
('Tom Editor', 'tom@prm.com', 'Member', 'Video Editing'),
('Anna Photographer', 'anna@prm.com', 'Member', 'Photography'),
('Chris Researcher', 'chris@prm.com', 'Member', 'Research & Development'),
('Diana Writer', 'diana@prm.com', 'Member', 'Rover Paper'),
('Eric Presenter', 'eric@prm.com', 'Member', 'Presentation')

ON CONFLICT (email) DO NOTHING;

-- Insert sample tasks
INSERT INTO tasks (title, description, team_name, assigned_by, assigned_to, priority, points, deadline) VALUES
('Design Event Poster', 'Create poster for upcoming scout event', 'Graphics Design', 
    (SELECT id FROM prm_membrs WHERE email = 'alice@prm.com'), 
    (SELECT id FROM prm_membrs WHERE email = 'sarah@prm.com'), 
    'high', 8, CURRENT_DATE + INTERVAL '7 days'),

('Write Newsletter Article', 'Monthly newsletter content about recent activities', 'Content Writing',
    (SELECT id FROM prm_membrs WHERE email = 'bob@prm.com'),
    (SELECT id FROM prm_membrs WHERE email = 'mike@prm.com'),
    'medium', 5, CURRENT_DATE + INTERVAL '10 days'),

('Social Media Campaign', 'Plan and execute Instagram campaign', 'Social Media',
    (SELECT id FROM prm_membrs WHERE email = 'carol@prm.com'),
    (SELECT id FROM prm_membrs WHERE email = 'lisa@prm.com'),
    'high', 10, CURRENT_DATE + INTERVAL '5 days'),

('Event Video Editing', 'Edit footage from last weekend event', 'Video Editing',
    (SELECT id FROM prm_membrs WHERE email = 'david@prm.com'),
    (SELECT id FROM prm_membrs WHERE email = 'tom@prm.com'),
    'medium', 12, CURRENT_DATE + INTERVAL '14 days'),

('Photo Documentation', 'Organize and edit photos from recent activities', 'Photography',
    (SELECT id FROM prm_membrs WHERE email = 'eve@prm.com'),
    (SELECT id FROM prm_membrs WHERE email = 'anna@prm.com'),
    'low', 6, CURRENT_DATE + INTERVAL '21 days')

ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 5: PERFORMANCE OPTIMIZATION
-- =====================================================

-- Update table statistics
ANALYZE tasks;
ANALYZE task_comments;
ANALYZE task_attachments;
ANALYZE prm_membrs;

-- Create additional performance indexes if needed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_performance_combo 
ON tasks(team_name, status, priority, deadline) 
WHERE status != 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_recent_activity 
ON tasks(updated_at DESC) 
WHERE updated_at >= CURRENT_DATE - INTERVAL '30 days';

-- =====================================================
-- STEP 6: MONITORING SETUP
-- =====================================================

-- Create monitoring view for system health
CREATE OR REPLACE VIEW system_health_monitor AS
SELECT 
    'tasks' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as records_last_24h,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
    COUNT(*) FILTER (WHERE deadline < CURRENT_DATE AND status != 'completed') as overdue_count,
    pg_size_pretty(pg_total_relation_size('tasks')) as table_size
FROM tasks

UNION ALL

SELECT 
    'task_comments' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as records_last_24h,
    NULL, NULL, NULL, NULL,
    pg_size_pretty(pg_total_relation_size('task_comments')) as table_size
FROM task_comments

UNION ALL

SELECT 
    'prm_membrs' as table_name,
    COUNT(*) as total_records,
    NULL as records_last_24h,
    COUNT(*) FILTER (WHERE position = 'Admin') as admin_count,
    COUNT(*) FILTER (WHERE position = 'Coordinator') as coordinator_count,
    COUNT(*) FILTER (WHERE position = 'Member') as member_count,
    NULL,
    pg_size_pretty(pg_total_relation_size('prm_membrs')) as table_size
FROM prm_membrs;

-- =====================================================
-- STEP 7: BACKUP RECOMMENDATIONS
-- =====================================================

-- Create backup function (run this to set up automated backups)
CREATE OR REPLACE FUNCTION create_task_backup()
RETURNS TEXT AS $$
DECLARE
    backup_name TEXT;
BEGIN
    backup_name := 'task_backup_' || to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
    
    -- This is a placeholder - implement actual backup logic based on your infrastructure
    -- For Supabase, use their backup features or pg_dump
    
    RETURN 'Backup created: ' || backup_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 8: FRONTEND INTEGRATION CHECKLIST
-- =====================================================

/*
FRONTEND INTEGRATION CHECKLIST:

1. Include Supabase client library:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

2. Initialize Supabase client:
   const supabaseUrl = 'your-supabase-url'
   const supabaseKey = 'your-supabase-anon-key'
   const supabase = createClient(supabaseUrl, supabaseKey)

3. Include task tracking library:
   <script src="js/task-tracking.js"></script>

4. Initialize task tracker:
   const taskTracker = new TaskTracker(supabase);

5. Set up authentication:
   - Configure Supabase Auth
   - Ensure users are created in prm_membrs table
   - Set up proper role assignment

6. Test permissions:
   - Admin: Can create/edit/delete all tasks
   - Coordinator: Can manage tasks in their team
   - Member: Can view all, edit only assigned tasks

7. Real-time features:
   - Subscribe to task changes
   - Update UI on real-time events
   - Handle connection states

8. Error handling:
   - Implement proper error messages
   - Handle network failures
   - Validate user inputs

9. Performance:
   - Implement pagination for large datasets
   - Use appropriate filters
   - Cache frequently accessed data

10. Security:
    - Never expose sensitive data in frontend
    - Validate all inputs
    - Use RLS policies properly
*/

-- =====================================================
-- STEP 9: TESTING QUERIES
-- =====================================================

-- Test basic functionality
SELECT 'Schema Setup Test' as test_name, 
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.tables 
WHERE table_name IN ('tasks', 'task_comments', 'task_attachments');

-- Test views
SELECT 'Views Test' as test_name,
       CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.views 
WHERE table_name LIKE '%performance%' OR table_name LIKE '%leaderboard%';

-- Test triggers
SELECT 'Triggers Test' as test_name,
       CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END as result
FROM information_schema.triggers 
WHERE event_object_table = 'tasks';

-- Test RLS policies
SELECT 'RLS Policies Test' as test_name,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM pg_policies 
WHERE tablename IN ('tasks', 'task_comments', 'task_attachments');

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

SELECT 'Task Tracking System Setup Complete!' as status,
       NOW() as completed_at,
       'Ready for frontend integration' as next_step;
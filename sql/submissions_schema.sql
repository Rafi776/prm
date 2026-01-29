-- =====================================================
-- SUBMISSIONS SYSTEM DATABASE SCHEMA
-- Creates table for document submissions
-- =====================================================

-- Create submissions table
CREATE TABLE IF NOT EXISTS prm_submissions (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Unit NOC', 'District NOC', 'Resignation', 'Others')),
    team_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    district VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prm_submissions_team_name ON prm_submissions(team_name);
CREATE INDEX IF NOT EXISTS idx_prm_submissions_category ON prm_submissions(category);
CREATE INDEX IF NOT EXISTS idx_prm_submissions_district ON prm_submissions(district);
CREATE INDEX IF NOT EXISTS idx_prm_submissions_submitted_at ON prm_submissions(submitted_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prm_submissions_updated_at 
    BEFORE UPDATE ON prm_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE prm_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for submissions
-- Allow anyone to insert (public form)
CREATE POLICY "Allow public insert on submissions" ON prm_submissions
    FOR INSERT WITH CHECK (true);

-- Allow anyone to read (for analytics)
CREATE POLICY "Allow public read on submissions" ON prm_submissions
    FOR SELECT USING (true);

-- Only authenticated users can update/delete (admin only)
CREATE POLICY "Allow authenticated update on submissions" ON prm_submissions
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on submissions" ON prm_submissions
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create analytics view for easy reporting
CREATE OR REPLACE VIEW prm_submissions_analytics AS
SELECT 
    team_name,
    category,
    district,
    COUNT(*) as submission_count,
    MIN(submitted_at) as first_submission,
    MAX(submitted_at) as latest_submission,
    SUM(file_size) as total_file_size,
    AVG(file_size) as avg_file_size
FROM prm_submissions
GROUP BY team_name, category, district
ORDER BY submission_count DESC;

-- Create monthly summary view
CREATE OR REPLACE VIEW prm_submissions_monthly AS
SELECT 
    DATE_TRUNC('month', submitted_at) as month,
    team_name,
    category,
    COUNT(*) as submissions,
    COUNT(DISTINCT full_name) as unique_submitters
FROM prm_submissions
GROUP BY DATE_TRUNC('month', submitted_at), team_name, category
ORDER BY month DESC, submissions DESC;

-- Insert sample data for testing
INSERT INTO prm_submissions (
    category, team_name, full_name, district, 
    file_url, file_name, file_size, file_type
) VALUES 
    ('Unit NOC', 'Graphics Design', 'John Doe', 'Dhaka', 'data:application/pdf;base64,sample', 'unit_noc.pdf', 1024000, 'application/pdf'),
    ('District NOC', 'Content Writing', 'Jane Smith', 'Chattogram', 'data:application/pdf;base64,sample', 'district_noc.pdf', 2048000, 'application/pdf'),
    ('Resignation', 'Social Media', 'Mike Johnson', 'Sylhet', 'data:application/pdf;base64,sample', 'resignation.pdf', 512000, 'application/pdf'),
    ('Others', 'Core Team', 'Sarah Wilson', 'Rajshahi', 'data:image/png;base64,sample', 'document.png', 1536000, 'image/png'),
    ('Unit NOC', 'Video Editing', 'David Brown', 'Khulna', 'data:application/pdf;base64,sample', 'noc_request.pdf', 768000, 'application/pdf')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON prm_submissions TO anon, authenticated;
GRANT INSERT ON prm_submissions TO anon, authenticated;
GRANT UPDATE, DELETE ON prm_submissions TO authenticated;
GRANT SELECT ON prm_submissions_analytics TO anon, authenticated;
GRANT SELECT ON prm_submissions_monthly TO anon, authenticated;
GRANT USAGE ON SEQUENCE prm_submissions_id_seq TO anon, authenticated;
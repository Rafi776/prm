// =====================================================
// SUPABASE CONFIGURATION TEMPLATE
// Replace with your actual Supabase credentials
// =====================================================

// Your Supabase project URL (from Supabase Dashboard > Settings > API)
const SUPABASE_URL = 'https://your-project-id.supabase.co';

// Your Supabase anon/public key (from Supabase Dashboard > Settings > API)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjc4ODg2NDAwLCJleHAiOjE5OTQ0NjI0MDB9.your-actual-key-here';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabaseClient;

// =====================================================
// HOW TO GET YOUR CREDENTIALS:
// 
// 1. Go to your Supabase Dashboard: https://supabase.com/dashboard
// 2. Select your project
// 3. Go to Settings > API
// 4. Copy the "Project URL" (replace SUPABASE_URL above)
// 5. Copy the "anon public" key (replace SUPABASE_ANON_KEY above)
// 
// The anon key should be a long JWT token starting with "eyJ..."
// =====================================================
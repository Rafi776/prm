// Supabase Client Initialization
const SUPABASE_URL = 'https://ceblhnqreywgdoipxhmw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hu2w9zqxB2y7rWH6f5_uYw_tGAm8sXB';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Export for use in app.js
window.supabaseClient = supabaseClient;

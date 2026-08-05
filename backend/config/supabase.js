const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();


const supabaseUrl = process.env.SUPABASE_URL || 'https://eesopfvqoqikmlpwmlmp.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;


const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};


// Default client (anon key) — used for auth/JWT operations
const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions);


// Admin client (service role key) — bypasses Row Level Security for backend operations
// IMPORTANT: Never expose this client or its key to the frontend.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, clientOptions);


console.log('⚡ Connected to Supabase Project:', supabaseUrl);
if (supabaseServiceRoleKey === supabaseAnonKey) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY is not set or equals the anon key. Backend DB operations may be blocked by RLS.');
}


module.exports = supabase;
module.exports.supabaseAdmin = supabaseAdmin;




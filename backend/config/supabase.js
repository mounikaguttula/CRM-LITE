const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://eesopfvqoqikmlpwmlmp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlc29wZnZxb3Fpa21scHdtbG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODg2MTAsImV4cCI6MjA5OTY2NDYxMH0.r6JJsxBM-H_lMrPbQv8et-p3uhvGjAno2Q26JukC0Ao';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log('⚡ Connected to Supabase Project:', supabaseUrl);

module.exports = supabase;

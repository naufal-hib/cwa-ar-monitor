// GANTI kedua nilai ini dengan nilai dari project Supabase Anda
// Settings → API → Project URL dan anon public key
const SUPABASE_URL = 'https://qqtvozvngsvcvbuacukk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxdHZvenZuZ3N2Y3ZidWFjdWtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzI3MTQsImV4cCI6MjA5NjQwODcxNH0.cjbx2zk9aDFXxNkDAlNIngLRrYA5qHxw1mxkVAGQHzs';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

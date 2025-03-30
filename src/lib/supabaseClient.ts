import { createClient } from '@supabase/supabase-js';

// Assuming your environment variables are correctly set up in .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be defined in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

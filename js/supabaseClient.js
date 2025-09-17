import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// The Supabase URL and Key are now retrieved from Vercel environment variables.
// Vercel exposes variables prefixed with `NEXT_PUBLIC_` to the client-side.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a single Supabase client for your application.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export the single client instance so it can be used throughout your app.
export default supabase;
/**
 * Supabase project for optional sign-in and sync. The publishable key is meant to be public:
 * it ships inside every copy of the app, and Row Level Security (supabase/schema.sql) keeps each
 * account's data private. Never put a secret or service_role key here.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://ppjnwskjhpcasncbwyqm.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_QA7nyUBzfz6_lmK62rlmQg_AzNbPeGx';
export const cloudConfigured = () => !!SUPABASE_URL && !!SUPABASE_KEY;

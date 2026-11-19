import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, cloudConfigured } from './config';
import { asSnapshot, type Snapshot } from './merge';

let client: Promise<SupabaseClient> | null = null;

/** The Supabase library loads only when someone uses sign-in, so the app stays quick for everyone else. */
export function getClient(): Promise<SupabaseClient> {
  if (!cloudConfigured()) return Promise.reject(new Error('Cloud sign-in is not set up.'));
  client ||= import('@supabase/supabase-js').then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'hc_auth_v1' },
  }));
  return client;
}

/** Where the sign-in link should send people back to: this exact app page. */
export const appUrl = () => window.location.origin + window.location.pathname;

export async function sendSignInEmail(email: string) {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl(), shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  const sb = await getClient();
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  await sb.auth.signOut({ scope: 'local' });
}

export async function pullSnapshot(userId: string): Promise<Snapshot | null> {
  const sb = await getClient();
  const { data, error } = await sb.from('user_data').select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? asSnapshot(data.data) : null;
}

export async function pushSnapshot(userId: string, s: Snapshot) {
  const sb = await getClient();
  const { error } = await sb.from('user_data').upsert({ user_id: userId, data: s, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deleteCloudData(userId: string) {
  const sb = await getClient();
  const { error } = await sb.from('user_data').delete().eq('user_id', userId);
  if (error) throw error;
}

/** Plain-language versions of the errors people are likely to hit. */
export function friendlyError(e: unknown): string {
  const m = String((e as { message?: string })?.message || e || '');
  if (/rate limit|too many|429/i.test(m)) return 'Too many sign-in emails were sent. Please wait a few minutes and try again.';
  if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/i.test(m)) return 'That code didn’t work or has expired. Ask for a new email and try again.';
  if (/not authorized|not allowed|email address.*not/i.test(m)) return 'This email can’t receive sign-in emails yet. The app owner needs to finish the email setup.';
  if (/relation .*user_data.* does not exist|user_data/i.test(m)) return 'Cloud storage isn’t set up yet. The app owner needs to run the setup script.';
  if (/fetch|network|load failed/i.test(m)) return 'Can’t reach the cloud. Check your internet connection and try again.';
  return 'Something went wrong with sign-in. Please try again.';
}

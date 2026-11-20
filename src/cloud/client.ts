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

/** Plain-language versions of the errors people are likely to hit, with the original reason kept for support. */
export function friendlyError(e: unknown): string {
  const m = String((e as { message?: string })?.message || e || '');
  const code = String((e as { code?: string })?.code || '');
  const status = (e as { status?: number })?.status;
  let say = 'Something went wrong with sign-in. Please try again.';
  const wait = m.match(/after (\d+) seconds?/i);
  if (wait) say = `Please wait ${wait[1]} seconds before asking for another email.`;
  else if (/rate.?limit|too many|429/i.test(m + code) || status === 429) say = 'Too many sign-in emails were sent. Please wait a few minutes and try again.';
  else if (/error sending|smtp|confirmation email|magic link email/i.test(m)) say = 'The sign-in email could not be sent. The app owner should check the email (SMTP) settings in Supabase.';
  else if (/expired|invalid.*(otp|token)|token.*(invalid|expired)|otp_expired/i.test(m + code)) say = 'That code didn’t work or has expired. Ask for a new email and try again.';
  else if (/signups? not allowed|not authorized|not allowed/i.test(m)) say = 'This email isn’t allowed to sign in yet.';
  else if (/invalid.*email|email.*invalid|validation/i.test(m + code)) say = 'That email address doesn’t look right. Please check it.';
  else if (/permission denied|user_data|42501|42P01/i.test(m + code)) say = 'Cloud storage isn’t set up correctly yet. The app owner needs to check the Supabase setup.';
  else if (/failed to fetch|network|load failed/i.test(m)) say = 'Can’t reach the cloud. Check your internet connection and try again.';
  return m ? `${say} (Details: ${m.slice(0, 160)})` : say;
}

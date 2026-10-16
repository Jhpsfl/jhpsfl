import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * Shared auth for server-to-server calls from nexavisiongroup.com.
 * HMAC-SHA256 over `${timestamp}.${message}` with NEXA_ORDER_SECRET (env or app_secrets),
 * sent as X-Nexa-Timestamp + X-Nexa-Signature: sha256=<hex>. 5-minute window.
 */

// Secret: Vercel env if set, otherwise the service-role-only app_secrets table
// (the live JHPS Vercel account's API token isn't available to set env vars).
let cached: { v: string; at: number } | null = null;
async function orderSecret(): Promise<string | null> {
  if (process.env.NEXA_ORDER_SECRET) return process.env.NEXA_ORDER_SECRET;
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.v;
  const { data } = await createSupabaseAdmin().from('app_secrets').select('value').eq('key', 'NEXA_ORDER_SECRET').maybeSingle();
  if (!data?.value) return null;
  cached = { v: data.value, at: Date.now() };
  return cached.v;
}

export async function verifyNexaSignature(message: string, ts: string | null, sig: string | null) {
  const secret = await orderSecret();
  if (!secret || !ts || !sig) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const want = Buffer.from('sha256=' + createHmac('sha256', secret).update(`${ts}.${message}`).digest('hex'));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

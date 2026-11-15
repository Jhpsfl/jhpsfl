// NexaBooks wiring for the JHPS admin: who can open it, and what they are inside it.
// Server-only (reads admin_users with the service role).
import { createSupabaseAdmin } from '@/lib/supabase';
import type { NexaBooksRole } from './token';

/**
 * admin_users.role -> NexaBooks role. Only owner-level admins (super_admin) get bookkeeping, as `owner`
 * (they may activate the subscription and change settings). The lower tiers, `admin` and `crew`,
 * are left out on purpose: bookkeeping shows bank and payroll-level money.
 */
export const NEXABOOKS_ROLE_MAP: Record<string, NexaBooksRole | undefined> = {
  super_admin: 'owner',
};

export type NexaBooksAccess = { allowed: false } | { allowed: true; role: NexaBooksRole; name: string | null; email: string | null };

/** Looks up the signed-in Clerk user in admin_users and returns what they may do in NexaBooks. */
export async function nexaBooksAccess(clerkUserId: string | null | undefined): Promise<NexaBooksAccess> {
  if (!clerkUserId) return { allowed: false };
  const { data } = await createSupabaseAdmin()
    .from('admin_users')
    .select('role, name, email')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  const role = data ? NEXABOOKS_ROLE_MAP[data.role as string] : undefined;
  return role ? { allowed: true, role, name: data?.name ?? null, email: data?.email ?? null } : { allowed: false };
}

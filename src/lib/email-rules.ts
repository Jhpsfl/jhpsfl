import type { SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * Mail-client rules: blocked senders, custom folders and filters (sender/subject → folder).
 * Stored as one JSON row in `admin_config` (key 'email-rules').
 *
 * Patterns: "user@domain" (exact) or "@domain" (that domain and any subdomain of it).
 * Filters run in list order; the first one that matches wins. Blocked senders always win (→ Spam).
 */
const TABLE = 'admin_config';
const KEY = 'email-rules';

export const SYSTEM_FOLDERS = new Set(['inbox', 'sent', 'drafts', 'starred', 'trash', 'spam', 'yelp']);

export type EmailFolderDef = { key: string; label: string; icon?: string; notify?: boolean };
export type EmailRule = { id: string; folder: string; from?: string[]; subject?: string; note?: string };
export type EmailRules = { blocked: string[]; folders: EmailFolderDef[]; rules: EmailRule[] };

/** Signed-in Clerk user who is in admin_users. */
export async function isEmailAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const { data } = await createSupabaseAdmin().from('admin_users').select('id').eq('clerk_user_id', userId).maybeSingle();
  return !!data;
}

export const normalizePattern = (p: unknown) => String(p || '').trim().toLowerCase();

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'folder';

export const newId = () => Math.random().toString(36).slice(2, 10);

/** "x@messaging.yelp.com" matches "@yelp.com" and "@messaging.yelp.com"; exact addresses match exactly. */
export function patternMatches(pattern: string, email: string): boolean {
  const p = normalizePattern(pattern), e = normalizePattern(email);
  if (!p || !e) return false;
  if (p.startsWith('@')) return e.endsWith(p) || e.endsWith('.' + p.slice(1));
  return e === p;
}

function subjectMatches(rule: EmailRule, subject: string): boolean {
  if (!rule.subject) return true;
  try { return new RegExp(rule.subject, 'i').test(subject || ''); }
  catch { return (subject || '').toLowerCase().includes(rule.subject.toLowerCase()); }
}

export function ruleMatches(rule: EmailRule, fromEmail: string, subject: string): boolean {
  const froms = (rule.from || []).filter(Boolean);
  if (!froms.length && !rule.subject) return false; // an empty filter never matches
  if (froms.length && !froms.some((p) => patternMatches(p, fromEmail))) return false;
  return subjectMatches(rule, subject);
}

function clean(j: Partial<EmailRules> | null | undefined): EmailRules {
  const folders = Array.isArray(j?.folders)
    ? j!.folders.filter((f) => f && f.key && f.label).map((f) => ({ key: slugify(String(f.key)), label: String(f.label).trim().slice(0, 40), ...(f.icon ? { icon: String(f.icon) } : {}), ...(f.notify ? { notify: true } : {}) }))
    : [];
  const keys = new Set(folders.map((f) => f.key));
  const rules = Array.isArray(j?.rules)
    ? j!.rules.filter((r) => r && r.folder && (keys.has(r.folder) || r.folder === 'spam' || r.folder === 'trash' || r.folder === 'yelp'))
        .map((r) => ({
          id: String(r.id || newId()),
          folder: String(r.folder),
          ...(Array.isArray(r.from) && r.from.length ? { from: r.from.map(normalizePattern).filter(Boolean) } : {}),
          ...(r.subject ? { subject: String(r.subject).slice(0, 1000) } : {}),
          ...(r.note ? { note: String(r.note).slice(0, 120) } : {}),
        }))
    : [];
  const blocked = Array.isArray(j?.blocked) ? [...new Set(j!.blocked.map(normalizePattern).filter(Boolean))] : [];
  return { blocked, folders, rules };
}

export async function getRules(): Promise<EmailRules> {
  try {
    const { data, error } = await createSupabaseAdmin().from(TABLE).select('value').eq('key', KEY).maybeSingle();
    if (error) throw new Error(error.message);
    return clean((data?.value as Partial<EmailRules>) || null);
  } catch {
    return clean(null);
  }
}

/** Saves and returns the cleaned rule set (callers answer with this object). */
export async function saveRules(rules: EmailRules): Promise<EmailRules> {
  const cleaned = clean(rules);
  const { error } = await createSupabaseAdmin().from(TABLE).upsert({ key: KEY, value: cleaned, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return cleaned;
}

export function isBlockedBy(rules: EmailRules, fromEmail: string): boolean {
  return rules.blocked.some((p) => patternMatches(p, fromEmail));
}

/** Where a message belongs by the rules: 'spam' | custom folder key | null (no rule matched). */
export function folderFor(rules: EmailRules, fromEmail: string, subject: string): string | null {
  if (isBlockedBy(rules, fromEmail)) return 'spam';
  const hit = rules.rules.find((r) => ruleMatches(r, fromEmail, subject));
  return hit ? hit.folder : null;
}

/** For the inbound webhook: the folder the rules pick (null = none matched) and whether to alert for it. */
export async function fileFolder(fromEmail: string, subject: string): Promise<{ folder: string | null; notify: boolean }> {
  const rules = await getRules();
  const folder = folderFor(rules, fromEmail, subject);
  const notify = folder === null || folder === 'inbox' || !!rules.folders.find((f) => f.key === folder)?.notify;
  return { folder, notify };
}

type Row = { id: string; from_email: string; subject: string | null; folder: string };

/**
 * Run the filters over mail already in the mailbox. Only received, non-trashed mail moves, and only INTO a
 * folder (a message no filter matches stays where it is). `onlyRule` limits the pass to one filter.
 */
export async function applyRules(
  supabase: SupabaseClient, rules: EmailRules, opts: { onlyRule?: string; account?: string } = {},
): Promise<{ moved: number; byFolder: Record<string, number> }> {
  const active = opts.onlyRule ? { ...rules, rules: rules.rules.filter((r) => r.id === opts.onlyRule), blocked: [] } : rules;
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('email_messages').select('id, from_email, subject, folder')
      .eq('direction', 'inbound').eq('is_draft', false).neq('folder', 'trash')
      .order('created_at', { ascending: false }).range(from, from + 999);
    if (opts.account) q = q.ilike('to_email', opts.account);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data || []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const byTarget = new Map<string, string[]>();
  for (const r of rows) {
    const target = folderFor(active, r.from_email, r.subject || '');
    if (!target || target === 'inbox' || target === r.folder) continue;
    if (!byTarget.has(target)) byTarget.set(target, []);
    byTarget.get(target)!.push(r.id);
  }
  const byFolder: Record<string, number> = {};
  let moved = 0;
  for (const [target, ids] of byTarget) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase.from('email_messages').update({ folder: target }).in('id', chunk);
      if (error) throw new Error(error.message);
      moved += chunk.length;
    }
    byFolder[target] = ids.length;
  }
  return { moved, byFolder };
}

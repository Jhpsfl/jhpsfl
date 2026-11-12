// Mail-client rules: blocked senders, custom folders and filters. Admins only.
//   GET → { blocked: [...], folders: [{key,label,icon,notify}], rules: [{id,folder,from,subject,note}] }
//   POST { action, ... }:
//     block { pattern } / unblock { pattern }     (block also moves that sender's existing mail to Spam)
//     folder_add { label, icon?, notify? }        → { folder }
//     folder_update { key, label?, icon?, notify? }
//     folder_delete { key }                       (its mail goes back to the Inbox; its filters are removed)
//     rule_add { folder, from?, subject?, note?, position?, apply? } → { rule, moved }
//     rule_update { id, folder?, from?, subject?, note? }
//     rule_delete { id }
//     rule_move { id, dir: 'up'|'down' }
//     apply { account? }                          → { moved, byFolder }
//   Every response carries the full, saved rule set.
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getRules, saveRules, normalizePattern, slugify, newId, applyRules, isEmailAdmin, SYSTEM_FOLDERS, type EmailRules } from '@/lib/email-rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const ok = (rules: EmailRules, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra, rules });
const toList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : String(v || '').split(/[,\s]+/)).map(normalizePattern).filter((p) => p.includes('@') && p.length >= 3);

export async function GET() {
  if (!(await isEmailAdmin())) return bad('Unauthorized', 401);
  return NextResponse.json(await getRules(), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  if (!(await isEmailAdmin())) return bad('Unauthorized', 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const rules: EmailRules = await getRules();
  const supabase = createSupabaseAdmin();

  try {
    // ── blocked senders ──
    if (action === 'block' || action === 'unblock') {
      const pattern = normalizePattern(body.pattern);
      if (!pattern.includes('@') || pattern.length < 3) return bad('Give an email address or @domain.');
      if (pattern === '@jhpsfl.com' || pattern.endsWith('@jhpsfl.com')) return bad('You cannot block your own mailbox.');
      if (action === 'unblock') return ok(await saveRules({ ...rules, blocked: rules.blocked.filter((b) => b !== pattern) }));
      const saved = await saveRules({ ...rules, blocked: [...rules.blocked, pattern] });
      // existing mail from that sender → Spam (never touch Trash or our own sent mail)
      let q = supabase.from('email_messages').update({ folder: 'spam' }).eq('direction', 'inbound').not('folder', 'in', '("trash","spam")');
      q = pattern.startsWith('@') ? q.ilike('from_email', `%${pattern}`) : q.ilike('from_email', pattern);
      const { data, error } = await q.select('id');
      if (error) return bad(error.message, 500);
      return ok(saved, { moved: data?.length || 0 });
    }

    // ── folders ──
    if (action === 'folder_add') {
      const label = String(body.label || '').trim().slice(0, 40);
      if (!label) return bad('Give the folder a name.');
      let key = slugify(label);
      if (SYSTEM_FOLDERS.has(key) || key === 'all') key = `${key}-2`;
      while (rules.folders.some((f) => f.key === key)) key = `${key}-${newId().slice(0, 3)}`;
      const folder = { key, label, ...(body.icon ? { icon: String(body.icon) } : {}), ...(body.notify ? { notify: true } : {}) };
      return ok(await saveRules({ ...rules, folders: [...rules.folders, folder] }), { folder });
    }
    if (action === 'folder_update') {
      const key = String(body.key || '');
      const f = rules.folders.find((x) => x.key === key);
      if (!f) return bad('No such folder.', 404);
      const next = { ...f };
      if (body.label !== undefined) { const l = String(body.label).trim().slice(0, 40); if (!l) return bad('Give the folder a name.'); next.label = l; }
      if (body.icon !== undefined) { if (body.icon) next.icon = String(body.icon); else delete next.icon; }
      if (body.notify !== undefined) { if (body.notify) next.notify = true; else delete next.notify; }
      return ok(await saveRules({ ...rules, folders: rules.folders.map((x) => (x.key === key ? next : x)) }), { folder: next });
    }
    if (action === 'folder_delete') {
      const key = String(body.key || '');
      if (!rules.folders.some((x) => x.key === key)) return bad('No such folder.', 404);
      const { data, error } = await supabase.from('email_messages').update({ folder: 'inbox' }).eq('folder', key).select('id');
      if (error) return bad(error.message, 500);
      const saved = await saveRules({ ...rules, folders: rules.folders.filter((x) => x.key !== key), rules: rules.rules.filter((r) => r.folder !== key) });
      return ok(saved, { moved: data?.length || 0 });
    }

    // ── filters ──
    const validTarget = (f: string) => f === 'spam' || f === 'trash' || f === 'yelp' || rules.folders.some((x) => x.key === f);
    if (action === 'rule_add') {
      const folder = String(body.folder || '');
      if (!validTarget(folder)) return bad('Pick a folder for the filter.');
      const from = toList(body.from);
      const subject = String(body.subject || '').trim().slice(0, 1000);
      if (!from.length && !subject) return bad('A filter needs a sender or a subject.');
      if (subject) { try { new RegExp(subject, 'i'); } catch { return bad('That subject pattern is not valid.'); } }
      const rule = { id: newId(), folder, ...(from.length ? { from } : {}), ...(subject ? { subject } : {}), ...(body.note ? { note: String(body.note).slice(0, 120) } : {}) };
      const list = body.position === 'top' ? [rule, ...rules.rules] : [...rules.rules, rule];
      const saved = await saveRules({ ...rules, rules: list });
      const res = body.apply === false ? { moved: 0, byFolder: {} } : await applyRules(supabase, saved, { onlyRule: rule.id });
      return ok(saved, { rule, ...res });
    }
    if (action === 'rule_update') {
      const id = String(body.id || '');
      const r = rules.rules.find((x) => x.id === id);
      if (!r) return bad('No such filter.', 404);
      const next = { ...r };
      if (body.folder !== undefined) { if (!validTarget(String(body.folder))) return bad('Pick a folder for the filter.'); next.folder = String(body.folder); }
      if (body.from !== undefined) { const l = toList(body.from); if (l.length) next.from = l; else delete next.from; }
      if (body.subject !== undefined) { const s = String(body.subject).trim().slice(0, 1000); if (s) { try { new RegExp(s, 'i'); } catch { return bad('That subject pattern is not valid.'); } next.subject = s; } else delete next.subject; }
      if (body.note !== undefined) { if (body.note) next.note = String(body.note).slice(0, 120); else delete next.note; }
      if (!next.from?.length && !next.subject) return bad('A filter needs a sender or a subject.');
      return ok(await saveRules({ ...rules, rules: rules.rules.map((x) => (x.id === id ? next : x)) }), { rule: next });
    }
    if (action === 'rule_delete') {
      const id = String(body.id || '');
      return ok(await saveRules({ ...rules, rules: rules.rules.filter((x) => x.id !== id) }));
    }
    if (action === 'rule_move') {
      const id = String(body.id || ''), dir = body.dir === 'up' ? -1 : 1;
      const i = rules.rules.findIndex((x) => x.id === id);
      if (i < 0) return bad('No such filter.', 404);
      const j = i + dir;
      if (j < 0 || j >= rules.rules.length) return ok(rules);
      const list = [...rules.rules]; const [r] = list.splice(i, 1); list.splice(j, 0, r);
      return ok(await saveRules({ ...rules, rules: list }));
    }
    if (action === 'apply') {
      const res = await applyRules(supabase, rules, { account: body.account ? String(body.account) : undefined });
      return ok(rules, res);
    }
    return bad('Unknown action.');
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Failed', 500);
  }
}

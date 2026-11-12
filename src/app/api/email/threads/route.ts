// List threads (slim), mutate (star/trash/read/move, clean-up by sender), permanent delete / empty trash.
// A single conversation is loaded by GET /api/email/threads/[threadId].
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { isEmailAdmin, SYSTEM_FOLDERS } from '@/lib/email-rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Kept fast on a phone: ONE slim query (no message bodies, paged past Supabase's 1000-row cap) builds the
// thread list AND the folder counts; plain-text previews are fetched only for the newest threads shown.
const LIST_COLS = 'id, thread_id, lead_id, subject, to_email, from_email, from_name, direction, read, starred, folder, is_draft, has_attachments, created_at';
const PREVIEW_THREADS = 200;
const MAX_THREADS = 500;

type Row = {
  id: string; thread_id: string; lead_id: string | null; subject: string; to_email: string; from_email: string; from_name: string | null;
  direction: string; read: boolean; starred: boolean; folder: string; is_draft: boolean; has_attachments: boolean; created_at: string;
};

const lc = (s: string | null | undefined) => (s || '').toLowerCase();

function inFolder(m: Row, folder: string | null) {
  if (folder === 'trash') return m.folder === 'trash';
  if (folder === 'drafts') return m.is_draft && m.folder !== 'trash';
  if (folder === 'starred') return m.starred && m.folder !== 'trash';
  if (folder === 'sent') return m.direction === 'outbound' && !m.is_draft && m.folder !== 'trash';
  if (folder === 'spam') return m.folder === 'spam';
  if (folder === 'yelp') return m.folder === 'yelp';
  // custom folder (Folders & filters): exactly the mail filed there
  if (folder && !SYSTEM_FOLDERS.has(folder)) return !m.is_draft && m.folder === folder;
  // Inbox: received mail still in the inbox + our own sent replies (so a thread shows its latest reply)
  return !m.is_draft && (m.folder === 'inbox' || m.folder === 'sent');
}

export async function GET(req: NextRequest) {
  if (!(await isEmailAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');
  const account = lc(searchParams.get('account')) || null;
  const supabase = createSupabaseAdmin();

  try {
    // 1) every message, slim columns only, newest first
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('email_messages').select(LIST_COLS).order('created_at', { ascending: false }).range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...((data || []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    // 2) folder counts (same rows, no second query)
    const folderCounts: Record<string, number> = { inbox: 0, sent: 0, starred: 0, drafts: 0, trash: 0, spam: 0, yelp: 0 };
    const mine = (m: Row) => !account || (m.direction === 'inbound' ? lc(m.to_email) === account : lc(m.from_email) === account);
    for (const m of rows) {
      if (!mine(m)) continue;
      if (m.is_draft && m.folder !== 'trash') folderCounts.drafts++;
      if (m.starred && m.folder !== 'trash') folderCounts.starred++;
      if (m.folder === 'trash') folderCounts.trash++;
      if (m.folder === 'spam') folderCounts.spam++;
      if (!m.read && m.folder === 'inbox' && !m.is_draft) folderCounts.inbox++;
      if (!m.read && !m.is_draft && (m.folder === 'yelp' || !SYSTEM_FOLDERS.has(m.folder))) folderCounts[m.folder] = (folderCounts[m.folder] || 0) + 1;
      if (m.direction === 'outbound' && !m.is_draft && m.folder !== 'trash') folderCounts.sent++;
    }

    // 3) group the shown folder into threads
    type ThreadAcc = {
      thread_id: string; subject: string; to_email: string; from_email: string; counterpart: string; account: string;
      latest_message: string; latest_message_id: string; latest_body_preview: string; latest_direction: string;
      message_count: number; unread_count: number; starred: boolean; has_attachments: boolean;
      lead_id: string | null; created_at: string; has_inbound: boolean; customer_name?: string; counterparty_name?: string;
    };
    const threadMap = new Map<string, ThreadAcc>();
    for (const msg of rows) {
      if (!inFolder(msg, folder)) continue;
      if (account) {
        const inbox = !folder || folder === 'inbox';
        const skip = inbox ? (msg.direction === 'inbound' ? lc(msg.to_email) !== account : lc(msg.from_email) !== account)
          : folder === 'sent' ? lc(msg.from_email) !== account
          : lc(msg.from_email) !== account && lc(msg.to_email) !== account;
        if (skip) continue;
      }
      if (!threadMap.has(msg.thread_id)) {
        const out = msg.direction === 'outbound';
        threadMap.set(msg.thread_id, {
          thread_id: msg.thread_id,
          subject: msg.subject,
          // to_email = the other party, from_email = our mailbox (reply logic targets thread.to_email)
          to_email: out ? msg.to_email : msg.from_email,
          from_email: out ? msg.from_email : msg.to_email,
          counterpart: out ? msg.to_email : msg.from_email,
          account: out ? msg.from_email : msg.to_email,
          latest_message: msg.created_at,
          latest_message_id: msg.id,
          latest_body_preview: '',
          latest_direction: msg.direction,
          message_count: 0, unread_count: 0,
          starred: !!msg.starred, has_attachments: !!msg.has_attachments,
          lead_id: msg.lead_id,
          created_at: msg.created_at,
          has_inbound: msg.direction === 'inbound',
        });
      }
      const t = threadMap.get(msg.thread_id)!;
      t.message_count++;
      if (!msg.read) t.unread_count++;
      if (msg.starred) t.starred = true;
      if (msg.has_attachments) t.has_attachments = true;
      if (msg.direction === 'inbound') t.has_inbound = true;
      if (!t.lead_id && msg.lead_id) t.lead_id = msg.lead_id;
      if (!t.counterparty_name && msg.direction === 'inbound' && msg.from_name) t.counterparty_name = msg.from_name;
    }
    // Inbox shows only threads with at least one received message
    if (!folder || folder === 'inbox') {
      for (const [id, t] of threadMap) if (!t.has_inbound) threadMap.delete(id);
    }

    const threads = [...threadMap.values()]
      .sort((a, b) => new Date(b.latest_message).getTime() - new Date(a.latest_message).getTime())
      .slice(0, MAX_THREADS);

    // 4) previews: plain text of the latest message, only for the threads that will be shown first
    const ids = threads.slice(0, PREVIEW_THREADS).map((t) => t.latest_message_id);
    if (ids.length) {
      const preview = new Map<string, string>();
      const { data: texts } = await supabase.from('email_messages').select('id, body_text').in('id', ids);
      const needHtml: string[] = [];
      for (const r of texts || []) {
        if (r.body_text) preview.set(r.id as string, String(r.body_text).replace(/\s+/g, ' ').slice(0, 140));
        else needHtml.push(r.id as string);
      }
      if (needHtml.length) {
        const { data: htmls } = await supabase.from('email_messages').select('id, body_html').in('id', needHtml);
        for (const r of htmls || []) {
          const plain = String(r.body_html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          preview.set(r.id as string, plain.slice(0, 140));
        }
      }
      for (const t of threads) t.latest_body_preview = preview.get(t.latest_message_id) || '';
    }

    // 5) customer names: the lead on the thread, then a lead or contact with that address
    const leadIds = [...new Set(threads.map((t) => t.lead_id).filter(Boolean))] as string[];
    if (leadIds.length) {
      const { data: leads } = await supabase.from('video_leads').select('id, name').in('id', leadIds);
      const m = new Map((leads || []).map((l) => [l.id, l.name]));
      for (const t of threads) if (t.lead_id && m.get(t.lead_id)) t.customer_name = m.get(t.lead_id) || undefined;
    }
    const noName = threads.filter((t) => !t.customer_name);
    if (noName.length) {
      const emails = [...new Set(noName.map((t) => t.to_email))];
      const [{ data: leads }, { data: contacts }] = await Promise.all([
        supabase.from('video_leads').select('name, email').in('email', emails),
        supabase.from('email_contacts').select('name, email').in('email', emails),
      ]);
      const m = new Map<string, string>();
      for (const c of contacts || []) if (c.name) m.set(lc(c.email), c.name);
      for (const l of leads || []) if (l.name) m.set(lc(l.email), l.name);
      for (const t of noName) if (m.has(lc(t.to_email))) t.customer_name = m.get(lc(t.to_email));
    }

    return NextResponse.json({ threads, folderCounts }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Could not load mail' }, { status: 500 });
  }
}

// ── PATCH: star/trash/read/move actions (+ clean-up by sender) ──
export async function PATCH(req: NextRequest) {
  if (!(await isEmailAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createSupabaseAdmin();
  const { thread_ids, action, value, account: rawAccount } = await req.json();
  const account = lc(rawAccount) || null;

  // Clean-up by sender: every received message from "user@domain" (or "@domain") → Trash / Spam
  if (action === 'trash_from' || action === 'spam_from') {
    const v = lc(String(value || '').trim());
    if (!v.includes('@')) return NextResponse.json({ error: 'Missing sender' }, { status: 400 });
    let q = supabase.from('email_messages').update({ folder: action === 'trash_from' ? 'trash' : 'spam' })
      .eq('direction', 'inbound').neq('folder', 'trash');
    q = v.startsWith('@') ? q.ilike('from_email', `%${v}`) : q.ilike('from_email', v);
    if (account) q = q.ilike('to_email', account);
    const { data, error } = await q.select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: data?.length || 0 });
  }

  if (!thread_ids?.length || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const updateMap: Record<string, Record<string, unknown>> = {
    star: { starred: true }, unstar: { starred: false },
    trash: { folder: 'trash' }, spam: { folder: 'spam' },
    mark_read: { read: true }, mark_unread: { read: false },
  };
  const update = action === 'move' && value ? { folder: String(value) } : updateMap[action];
  if (!update && action !== 'restore') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const { data: msgs } = await supabase
    .from('email_messages').select('id, from_email, to_email, direction').in('thread_id', thread_ids);
  const mine = (msgs || []).filter((m) => !account || lc(m.from_email) === account || lc(m.to_email) === account);
  if (action === 'restore') {
    // out of Trash/Spam/a folder: received mail goes back to the Inbox, our own replies back to Sent
    const inbound = mine.filter((m) => m.direction !== 'outbound').map((m) => m.id);
    const outbound = mine.filter((m) => m.direction === 'outbound').map((m) => m.id);
    if (inbound.length) await supabase.from('email_messages').update({ folder: 'inbox' }).in('id', inbound);
    if (outbound.length) await supabase.from('email_messages').update({ folder: 'sent' }).in('id', outbound);
  } else {
    // moving into a folder only files the received mail; our own replies stay in Sent
    const ids = (action === 'move' ? mine.filter((m) => m.direction !== 'outbound') : mine).map((m) => m.id);
    if (ids.length) {
      const { error } = await supabase.from('email_messages').update(update).in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ updated: thread_ids.length });
}

// ── DELETE: permanent (thread_ids) or empty the whole Trash (empty_trash) ──
export async function DELETE(req: NextRequest) {
  if (!(await isEmailAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createSupabaseAdmin();
  const { thread_ids, empty_trash, account: rawAccount } = await req.json();
  const account = lc(rawAccount) || null;

  let ids: string[] = [];
  if (empty_trash) {
    const { data } = await supabase.from('email_messages').select('id, from_email, to_email').eq('folder', 'trash');
    ids = (data || []).filter((m) => !account || lc(m.from_email) === account || lc(m.to_email) === account).map((m) => m.id);
  } else {
    if (!thread_ids?.length) return NextResponse.json({ error: 'No thread_ids' }, { status: 400 });
    const { data } = await supabase.from('email_messages').select('id, from_email, to_email').in('thread_id', thread_ids);
    ids = (data || []).filter((m) => !account || lc(m.from_email) === account || lc(m.to_email) === account).map((m) => m.id);
  }
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await supabase.from('email_attachments').delete().in('message_id', chunk);
    const { error } = await supabase.from('email_messages').delete().in('id', chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: ids.length });
}

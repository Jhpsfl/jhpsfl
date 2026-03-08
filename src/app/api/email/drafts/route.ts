import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

// POST: Save or update a draft
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { draft_id, to_email, subject, body_html, body_text, cc_emails, bcc_emails } = body;

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', userId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (draft_id) {
    // Update existing draft
    const { data, error } = await supabase
      .from('email_messages')
      .update({
        to_email: to_email || '',
        subject: subject || '',
        body_html: body_html || null,
        body_text: body_text || null,
        cc_emails: cc_emails || [],
        bcc_emails: bcc_emails || [],
      })
      .eq('id', draft_id)
      .eq('is_draft', true)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ draft: data });
  }

  // Create new draft
  const thread_id = randomUUID();
  const { data, error } = await supabase
    .from('email_messages')
    .insert({
      thread_id,
      direction: 'outbound',
      from_email: 'info@jhpsfl.com',
      to_email: to_email || '',
      subject: subject || '(no subject)',
      body_html: body_html || null,
      body_text: body_text || null,
      is_draft: true,
      folder: 'drafts',
      read: true,
      cc_emails: cc_emails || [],
      bcc_emails: bcc_emails || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}

// DELETE: Delete a draft
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const draftId = searchParams.get('draft_id');

  if (!draftId) return NextResponse.json({ error: 'Missing draft_id' }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data: admin } = await supabase.from('admin_users').select('id').eq('clerk_user_id', userId).single();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabase.from('email_messages').delete().eq('id', draftId).eq('is_draft', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}

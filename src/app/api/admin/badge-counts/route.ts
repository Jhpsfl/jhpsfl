import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

/**
 * GET /api/admin/badge-counts?clerk_user_id=xxx
 *
 * Returns badge counts for admin dashboard:
 * - unreadEmail: count of unread email messages
 * - newLeads: count of new video quote leads
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Count unread emails
    const { count: unreadEmail, error: emailError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    // Count new leads
    const { count: newLeads, error: leadsError } = await supabase
      .from('video_leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    if (emailError) {
      console.error('Failed to count emails:', emailError);
    }

    if (leadsError) {
      console.error('Failed to count leads:', leadsError);
    }

    return NextResponse.json({
      unreadEmail: unreadEmail || 0,
      newLeads: newLeads || 0,
    });
  } catch (err) {
    console.error('Badge counts error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

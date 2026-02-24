import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const clerkUserId = searchParams.get('clerk_user_id');

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();

  // Verify admin
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('email_messages')
    .update({ read: true })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

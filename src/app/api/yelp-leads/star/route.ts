import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { id, field, value } = await req.json() as { id: string; field: 'pinned' | 'starred'; value: boolean };

  if (!id || !field) return NextResponse.json({ error: 'id and field required' }, { status: 400 });
  if (field !== 'pinned' && field !== 'starred') {
    return NextResponse.json({ error: 'field must be pinned or starred' }, { status: 400 });
  }

  const { error } = await supabase
    .from('yelp_conversations')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

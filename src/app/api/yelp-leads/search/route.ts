import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  // Search by customer name, service, or message content
  const { data, error } = await supabase
    .from('yelp_conversations')
    .select('id, customer_name, services, status, messages, created_at, lead_temperature, pinned, starred')
    .or(`customer_name.ilike.%${q}%,services.cs.{${q}}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also search message content (client-side filter since Supabase can't search JSON arrays)
  const allResults = data || [];

  // If no name/service matches, try a broader search
  if (allResults.length === 0) {
    const { data: allConvs } = await supabase
      .from('yelp_conversations')
      .select('id, customer_name, services, status, messages, created_at, lead_temperature, pinned, starred')
      .order('created_at', { ascending: false })
      .limit(100);

    const lowerQ = q.toLowerCase();
    const msgMatches = (allConvs || []).filter(c =>
      c.messages?.some((m: { text?: string }) => m.text?.toLowerCase().includes(lowerQ))
    );
    return NextResponse.json(msgMatches.slice(0, 20));
  }

  return NextResponse.json(allResults);
}

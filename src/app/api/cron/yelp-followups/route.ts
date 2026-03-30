import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { sendPushToAllAdmins } from '@/lib/pushNotify';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const now = Date.now();
  let followUpsTriggered = 0;
  let markedStale = 0;

  // Get active conversations where customer has been silent
  const { data: conversations } = await supabase
    .from('yelp_conversations')
    .select('id, customer_name, last_customer_message_at, status, conversation_stage')
    .in('status', ['ai_active', 'taken_over', 'needs_attention'])
    .not('last_customer_message_at', 'is', null);

  if (conversations) {
    for (const conv of conversations) {
      const silentMs = now - new Date(conv.last_customer_message_at).getTime();
      const silentHours = silentMs / (60 * 60 * 1000);

      // Silent > 72h → auto-mark stale + cold
      if (silentHours > 72 && conv.conversation_stage !== 'stale') {
        await supabase.from('yelp_conversations').update({
          conversation_stage: 'stale',
          lead_temperature: 'cold',
          updated_at: new Date().toISOString(),
        }).eq('id', conv.id);
        markedStale++;
      }
      // Silent > 24h → push follow-up reminder
      else if (silentHours > 24 && silentHours <= 72) {
        await sendPushToAllAdmins({
          title: 'Follow Up Reminder',
          body: `${conv.customer_name} hasn't replied in ${Math.round(silentHours)}h`,
          url: `/admin?tab=yelp_leads&conversation=${conv.id}`,
          tag: `followup-${conv.id}`,
        });
        followUpsTriggered++;
      }
    }
  }

  return NextResponse.json({ ok: true, followUpsTriggered, markedStale });
}

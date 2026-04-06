import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAllAdmins } from '@/lib/pushNotify';

// POST — Agent sends admin push notification (delivery failures, rate limits, etc.)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, body, url, tag } = await req.json();
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 });
  }

  await sendPushToAllAdmins({ title, body, url: url || '/admin', tag });
  return NextResponse.json({ ok: true });
}

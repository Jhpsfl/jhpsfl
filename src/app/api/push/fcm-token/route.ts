import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { fcm_token, platform } = await request.json();
    if (!fcm_token) return NextResponse.json({ error: 'Missing fcm_token' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('fcm_tokens')
      .upsert({ fcm_token, platform: platform || 'android', updated_at: new Date().toISOString() }, { onConflict: 'fcm_token' });

    if (error) {
      console.error('FCM token save error:', error);
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

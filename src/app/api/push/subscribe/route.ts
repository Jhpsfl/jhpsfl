import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/push/subscribe
 *
 * Register a push subscription for an admin.
 * Expects body: { clerk_user_id, subscription }
 *
 * subscription is a PushSubscription object (JSON from pushManager.subscribe)
 */
export async function POST(request: NextRequest) {
  try {
    const { clerk_user_id, subscription } = await request.json();

    console.log('📤 Push subscribe request:', { clerk_user_id, endpoint: subscription?.endpoint?.substring(0, 80) });

    if (!clerk_user_id || !subscription) {
      console.error('❌ Missing clerk_user_id or subscription');
      return NextResponse.json(
        { error: 'Missing clerk_user_id or subscription' },
        { status: 400 }
      );
    }

    if (!subscription.endpoint) {
      console.error('❌ Invalid subscription object - no endpoint');
      return NextResponse.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    console.log('💾 Saving to push_subscriptions table...');

    // Upsert subscription keyed on endpoint (unique constraint)
    const { error, data } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          clerk_user_id,
          endpoint: subscription.endpoint,
          subscription,
        },
        {
          onConflict: 'endpoint',
        }
      );

    if (error) {
      console.error('❌ Failed to save push subscription:', error);
      return NextResponse.json(
        { error: 'Failed to save subscription', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Push subscription saved successfully:', { clerk_user_id, data });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('❌ Push subscribe error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

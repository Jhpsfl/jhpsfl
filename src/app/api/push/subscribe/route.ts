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

    if (!clerk_user_id || !subscription) {
      return NextResponse.json(
        { error: 'Missing clerk_user_id or subscription' },
        { status: 400 }
      );
    }

    if (!subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid subscription object' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Upsert subscription keyed on endpoint (unique constraint)
    const { error } = await supabase
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
      console.error('Failed to save push subscription:', error);
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

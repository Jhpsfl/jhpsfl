import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    console.log('📤 Push subscribe request:', { userId, endpoint: subscription?.endpoint?.substring(0, 80) });

    if (!subscription) {
      console.error('❌ Missing subscription');
      return NextResponse.json(
        { error: 'Missing subscription' },
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
          clerk_user_id: userId,
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

    console.log('✅ Push subscription saved successfully:', { userId, data });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('❌ Push subscribe error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

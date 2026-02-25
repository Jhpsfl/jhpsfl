import { NextRequest, NextResponse } from 'next/server';
import { sendPushToAllAdmins } from '@/lib/pushNotify';

/**
 * GET /api/push/test
 *
 * Send a test push notification to all admin subscriptions.
 * Useful for debugging and verifying push notification setup.
 */
export async function GET(request: NextRequest) {
  try {
    await sendPushToAllAdmins({
      title: '🧪 Test Notification',
      body: 'Push notifications are working! You can dismiss this message.',
      url: '/admin',
    });

    return NextResponse.json({
      success: true,
      message: 'Test notification sent to all admin subscriptions',
    });
  } catch (err) {
    console.error('Test push error:', err);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/push/vapid-public-key
 *
 * Returns the public VAPID key needed for client-side push subscription.
 */
export async function GET(request: NextRequest) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID_PUBLIC_KEY not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({ publicKey });
}

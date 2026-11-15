import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { nexaBooksAccess } from '@/lib/nexabooks/access';
import { nexaBooksConfig } from '@/lib/nexabooks/token';

export const dynamic = 'force-dynamic';

// Tells the admin sidebar whether to show the Bookkeeping (NexaBooks) item for the signed-in admin.
export async function GET() {
  const { userId } = await auth();
  const access = await nexaBooksAccess(userId);
  return NextResponse.json({ allowed: access.allowed && !!nexaBooksConfig() }, { headers: { 'Cache-Control': 'no-store' } });
}

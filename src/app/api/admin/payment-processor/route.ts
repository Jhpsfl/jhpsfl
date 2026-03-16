import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';

// ─── Auth helper ───
async function verifyAdmin(clerkUserId: string | null) {
  if (!clerkUserId) return false;
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .limit(1)
    .single();
  return !!data;
}

// ─── GET: Read current payment processor ───
export async function GET(req: NextRequest) {
  const clerkUserId = req.nextUrl.searchParams.get('clerk_user_id');
  if (!(await verifyAdmin(clerkUserId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Fetch all env vars, find NEXT_PUBLIC_PAYMENT_PROCESSOR
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`Vercel API ${res.status}`);

    const data = await res.json();
    const envVar = (data.envs || []).find(
      (e: { key: string }) => e.key === 'NEXT_PUBLIC_PAYMENT_PROCESSOR'
    );

    return NextResponse.json({
      processor: envVar?.value || 'stripe',
      envId: envVar?.id || null,
    });
  } catch (err) {
    console.error('PAYMENT_PROCESSOR_GET_ERROR:', err);
    return NextResponse.json({ error: 'Failed to read processor setting' }, { status: 500 });
  }
}

// ─── POST: Switch payment processor + trigger redeploy ───
export async function POST(req: NextRequest) {
  const clerkUserId = req.nextUrl.searchParams.get('clerk_user_id');
  if (!(await verifyAdmin(clerkUserId))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { processor } = await req.json();
    if (processor !== 'stripe' && processor !== 'square') {
      return NextResponse.json({ error: 'Invalid processor. Use "stripe" or "square".' }, { status: 400 });
    }

    // 1. Find the env var ID
    const listRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    if (!listRes.ok) throw new Error(`Vercel list envs: ${listRes.status}`);

    const listData = await listRes.json();
    const envVar = (listData.envs || []).find(
      (e: { key: string }) => e.key === 'NEXT_PUBLIC_PAYMENT_PROCESSOR'
    );

    if (!envVar) {
      // Create it if it doesn't exist
      const createRes = await fetch(
        `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'NEXT_PUBLIC_PAYMENT_PROCESSOR',
            value: processor,
            target: ['production'],
            type: 'plain',
          }),
        }
      );
      if (!createRes.ok) {
        const errBody = await createRes.text();
        throw new Error(`Vercel create env: ${createRes.status} ${errBody}`);
      }
    } else {
      // 2. Update the env var
      const updateRes = await fetch(
        `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${envVar.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value: processor }),
        }
      );
      if (!updateRes.ok) {
        const errBody = await updateRes.text();
        throw new Error(`Vercel update env: ${updateRes.status} ${errBody}`);
      }
    }

    // 3. Trigger a redeploy of the latest production deployment
    let deploymentUid: string | null = null;
    try {
      const deploysRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=1&target=production`,
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
      );
      if (deploysRes.ok) {
        const deploysData = await deploysRes.json();
        const latestDeploy = deploysData.deployments?.[0];
        if (latestDeploy?.uid) {
          // Create a new deployment from the same commit
          const redeployRes = await fetch(
            `https://api.vercel.com/v13/deployments`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: 'jhpsfl',
                deploymentId: latestDeploy.uid,
                target: 'production',
              }),
            }
          );
          if (redeployRes.ok) {
            const redeployData = await redeployRes.json();
            deploymentUid = redeployData.id || redeployData.uid || null;
          }
        }
      }
    } catch (deployErr) {
      console.error('REDEPLOY_ERROR:', deployErr);
      // Non-fatal — env var was still updated
    }

    return NextResponse.json({
      success: true,
      processor,
      deploymentUid,
      message: deploymentUid
        ? `Switched to ${processor}. Redeploying — live in ~2 minutes.`
        : `Switched to ${processor}. Push a commit or manually redeploy to go live.`,
    });
  } catch (err) {
    console.error('PAYMENT_PROCESSOR_POST_ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to switch processor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

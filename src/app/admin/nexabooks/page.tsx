import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { nexaBooksAccess } from '@/lib/nexabooks/access';
import { nexaBooksConfig, nexaBooksLaunchUrl } from '@/lib/nexabooks/token';

export const dynamic = 'force-dynamic';

// Opens NexaBooks (bookkeeping, run by NexaVision Group) for the signed-in admin.
// src/proxy.ts already sends anyone without a session to sign-in (this is under /admin);
// here we check the admin_users role, then hand over with a one-time link built at click time.
export default async function NexaBooksLaunch() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/admin/nexabooks');

  const config = nexaBooksConfig();
  const access = await nexaBooksAccess(userId);
  if (!config || !access.allowed) redirect('/admin');

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? access.email;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || access.name;

  redirect(nexaBooksLaunchUrl(config, { id: userId, email, name, role: access.role }));
}

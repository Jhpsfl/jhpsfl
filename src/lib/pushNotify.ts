import webpush from 'web-push';
import { createSupabaseAdmin } from './supabase';

// Configure web-push with VAPID keys
const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const subject = (process.env.VAPID_SUBJECT || 'mailto:FRLawnCareFL@gmail.com').trim();

console.log('🔑 VAPID Configuration:', {
  hasPublicKey: !!publicKey,
  hasPrivateKey: !!privateKey,
  subject,
  publicKeyLength: publicKey?.length || 0,
  privateKeyLength: privateKey?.length || 0,
});

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  console.log('✅ Web-push VAPID details configured');
} else {
  console.error('❌ Missing VAPID keys - push notifications will not work');
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;        // same tag = replace/update existing notification
  url?: string;        // where to navigate on click
  icon?: string;
  badge?: number;      // app icon badge count; if omitted, server fetches live count
}

/**
 * Send push notification to all registered admin subscriptions
 * Handles expired subscriptions (410 responses) by removing them from DB
 */
export async function sendPushToAllAdmins(payload: PushPayload) {
  try {
    const supabase = createSupabaseAdmin();

    // Fetch all active subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('id, clerk_user_id, subscription');

    if (fetchError) {
      console.error('Failed to fetch push subscriptions:', fetchError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return;
    }

    // Get current badge count (unread emails + new leads) unless caller provided one
    let badgeCount = payload.badge;
    if (badgeCount === undefined) {
      const [{ count: emailCount }, { count: leadsCount }] = await Promise.all([
        supabase.from('email_messages').select('*', { count: 'exact', head: true }).eq('read', false),
        supabase.from('video_leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      ]);
      badgeCount = (emailCount || 0) + (leadsCount || 0);
    }

    const pushData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/admin',
      tag: payload.tag,
      icon: payload.icon,
      badge: badgeCount,
    });

    // Send to each subscription, track failures
    const failures: string[] = [];
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subscription = sub.subscription as any;
          console.log(`📤 Sending push to ${sub.clerk_user_id}:`, {
            endpoint: subscription.endpoint.substring(0, 80),
            hasKeys: !!subscription.keys,
          });

          const result = await webpush.sendNotification(subscription, pushData);
          console.log(`✅ Push sent successfully to ${sub.id}:`, result);
          return { success: true, id: sub.id };
        } catch (error: any) {
          console.error(`❌ Push send FAILED for ${sub.id}:`, {
            statusCode: error.statusCode,
            message: error.message,
            body: error.body,
          });

          // 410 Gone = subscription expired, remove from DB
          if (error.statusCode === 410 || error.statusCode === 404) {
            failures.push(sub.id);
          }
          return { success: false, id: sub.id, error: error.message };
        }
      })
    );

    console.log(`📊 Push send results:`, results.map(r => r.status === 'fulfilled' ? r.value : r.reason));

    // Clean up expired subscriptions
    if (failures.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', failures);

      if (deleteError) {
        console.error('Failed to delete expired subscriptions:', deleteError);
      } else {
        console.log(`Removed ${failures.length} expired subscriptions`);
      }
    }
  } catch (err) {
    console.error('sendPushToAllAdmins error:', err);
  }
}

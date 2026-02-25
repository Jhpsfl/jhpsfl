import webpush from 'web-push';
import { createSupabaseAdmin } from './supabase';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:FRLawnCareFL@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
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
      .select('id, subscription');

    if (fetchError) {
      console.error('Failed to fetch push subscriptions:', fetchError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return;
    }

    const pushData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/admin',
    });

    // Send to each subscription, track failures
    const failures: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subscription = sub.subscription as any;
          await webpush.sendNotification(subscription, pushData);
          console.log(`Push sent to subscription ${sub.id}`);
        } catch (error: any) {
          // 410 Gone = subscription expired, remove from DB
          if (error.statusCode === 410) {
            failures.push(sub.id);
          } else {
            console.error(`Push send failed for ${sub.id}:`, error);
          }
        }
      })
    );

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

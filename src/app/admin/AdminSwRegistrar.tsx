"use client";
import { useEffect, useState } from "react";

export default function AdminSwRegistrar() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/admin" })
      .then(async (reg) => {
        console.log("SW registered");
        setRegistration(reg);

        // iOS PWA fix: Safari and the installed PWA have DIFFERENT push endpoints.
        // If the user subscribed from Safari first, the DB has the wrong endpoint.
        // On every load with permission already granted, re-sync the current
        // subscription (or create one) so the DB always has the PWA endpoint.
        if ("Notification" in window && Notification.permission === "granted") {
          setNotificationPermission("granted");
          await syncPushSubscription(reg);
        }
      })
      .catch(err => console.error("SW registration failed:", err));

    if (typeof window !== 'undefined' && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!registration) {
      console.error("Service worker not registered yet");
      return;
    }

    try {
      // Request notification permission (shows browser prompt)
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        // Subscribe to push notifications
        await subscribeToNotifications(registration);
      } else {
        console.log("Notification permission denied by user");
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
    }
  };

  // Only show button if notifications are supported and not already granted
  const shouldShowButton = typeof window !== 'undefined' && "Notification" in window && notificationPermission !== "granted";

  // Expose the handler globally so AdminDashboard can call it
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__enablePushNotifications = handleEnableNotifications;
    }
  }, [handleEnableNotifications]);

  return null;
}

/**
 * Called on every load when permission is already granted.
 * Gets the existing push subscription (or creates one) and syncs it to the
 * server — ensuring the DB has the PWA endpoint, not the Safari one.
 */
async function syncPushSubscription(registration: ServiceWorkerRegistration) {
  try {
    const clerkUserId = localStorage.getItem("jhps_admin_uid");
    if (!clerkUserId) return; // not logged in yet

    const vapidRes = await fetch("/api/push/vapid-public-key");
    if (!vapidRes.ok) return;
    const { publicKey } = await vapidRes.json();
    const convertedVapidKey = urlBase64ToUint8Array(publicKey);

    // Get existing subscription or create a fresh one for this context
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as BufferSource,
      });
      console.log("SW: created new push subscription for this context");
    }

    // Always upsert — endpoint may differ between Safari and installed PWA
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerk_user_id: clerkUserId, subscription: subscription.toJSON() }),
    });
    console.log("SW: push subscription synced to server", subscription.endpoint.substring(0, 60));
  } catch (err) {
    console.warn("SW: push subscription sync failed:", err);
  }
}

async function subscribeToNotifications(registration: ServiceWorkerRegistration) {
  try {
    // Wait for clerk_user_id to be available in localStorage (set by AdminDashboard)
    let clerkUserId = localStorage.getItem("jhps_admin_uid");
    let retries = 0;
    while (!clerkUserId && retries < 30) {
      console.log("Waiting for clerk_user_id to be set in localStorage...");
      await new Promise(resolve => setTimeout(resolve, 100));
      clerkUserId = localStorage.getItem("jhps_admin_uid");
      retries++;
    }

    if (!clerkUserId) {
      console.error("✗ clerk_user_id not found in localStorage after 3 seconds");
      return;
    }

    console.log("✓ Found clerk_user_id, proceeding with subscription");

    // Get VAPID public key from server
    const vapidRes = await fetch("/api/push/vapid-public-key");
    if (!vapidRes.ok) {
      console.error("Failed to fetch VAPID key");
      return;
    }

    const { publicKey } = await vapidRes.json();

    // Convert public key to Uint8Array
    const convertedVapidKey = urlBase64ToUint8Array(publicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as BufferSource,
    });

    console.log("✓ Browser subscription created:", subscription.endpoint.substring(0, 80));

    // Send subscription to server
    console.log("📤 Sending subscription to server...");
    const subRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: clerkUserId,
        subscription: subscription.toJSON(),
      }),
    });

    if (subRes.ok) {
      console.log("✓✓✓ SUCCESS: Push subscription registered to database!");
      console.log("Notifications are now active. You can test with /api/push/test");
    } else {
      const errorText = await subRes.text();
      console.error(`✗ Failed to register push subscription (HTTP ${subRes.status}):`, errorText);
    }
  } catch (err) {
    console.error("Push subscription error:", err);
  }
}

// Helper to convert VAPID key from base64
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (typeof window === 'undefined') {
    throw new Error("urlBase64ToUint8Array can only be called in the browser");
  }

  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

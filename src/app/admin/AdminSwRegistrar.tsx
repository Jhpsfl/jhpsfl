"use client";
import { useEffect, useState } from "react";

export default function AdminSwRegistrar() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/admin" })
        .then(reg => {
          console.log("SW registered");
          setRegistration(reg);
        })
        .catch(err => console.error("SW registration failed:", err));
    }

    // Check current notification permission
    if ("Notification" in window) {
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
  const shouldShowButton = "Notification" in window && notificationPermission !== "granted";

  // Expose the handler globally so AdminDashboard can call it
  useEffect(() => {
    (window as any).__enablePushNotifications = handleEnableNotifications;
  }, [handleEnableNotifications]);

  return null;
}

async function subscribeToNotifications(registration: ServiceWorkerRegistration) {
  try {
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

    // Get clerk_user_id from localStorage (set by AdminDashboard)
    const clerkUserId = localStorage.getItem("jhps_admin_uid");
    if (!clerkUserId) {
      console.warn("clerk_user_id not found in localStorage");
      return;
    }

    // Send subscription to server
    const subRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerk_user_id: clerkUserId,
        subscription: subscription.toJSON(),
      }),
    });

    if (subRes.ok) {
      console.log("Push subscription registered");
    } else {
      console.error("Failed to register push subscription");
    }
  } catch (err) {
    console.error("Push subscription error:", err);
  }
}

// Helper to convert VAPID key from base64
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

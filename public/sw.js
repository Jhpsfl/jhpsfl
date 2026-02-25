// JHPS Admin Service Worker
// Place this file at: /public/sw.js

const CACHE_NAME = "jhps-admin-v1";

// ─── Install ───
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ─── Activate ───
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// ─── Push Event ───
// This fires when a push arrives from the server (even if app is closed)
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "JHPS", body: event.data.text() };
  }

  const { title, body, tag, url, icon, badge: badgeCount } = payload;

  const options = {
    body: body || "You have a new notification",
    icon: icon || "/favicon-192.png",
    badge: "/favicon-32.png",
    tag: tag || "jhps-general",          // same tag = replace previous notification of same type
    renotify: true,                       // vibrate even if replacing same tag
    data: { url: url || "/admin" },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title || "JHPS Admin", options),
      // Tell open admin tabs to refresh badge counts immediately
      clients.matchAll({ type: "window" }).then(windowClients => {
        windowClients.forEach(client => client.postMessage({ type: "REFRESH_BADGES" }));
      }),
    ])
  );
});

// ─── Notification Click ───
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/admin";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If admin tab is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes("/admin") && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Background Sync (optional - for offline queuing) ───
self.addEventListener("sync", (event) => {
  if (event.tag === "check-notifications") {
    event.waitUntil(
      fetch("/api/admin/badge-counts")
        .then((res) => res.json())
        .then((data) => {
          const total = (data.unreadEmail || 0) + (data.newLeads || 0);
          if (total > 0) {
            self.registration.showNotification("JHPS — New Activity", {
              body: buildSummaryBody(data),
              icon: "/favicon-192.png",
              tag: "jhps-summary",
              data: { url: "/admin" },
            });
          }
        })
    );
  }
});

function buildSummaryBody(data) {
  const parts = [];
  if (data.unreadEmail > 0) parts.push(`${data.unreadEmail} unread email${data.unreadEmail > 1 ? "s" : ""}`);
  if (data.newLeads > 0) parts.push(`${data.newLeads} new video quote${data.newLeads > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

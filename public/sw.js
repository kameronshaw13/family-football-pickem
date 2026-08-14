self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Family Pick'em", body: event.data ? event.data.text() : "New update available." };
  }

  const title = payload.title || "Family Pick'em";
  const options = {
    body: payload.body || "New update available.",
    icon: "/apple-icon.png",
    badge: "/icon.png",
    tag: payload.tag || "family-pickem-update",
    renotify: true,
    data: { url: payload.url || "/" }
  };
  const tasks = [self.registration.showNotification(title, options)];
  if ("setAppBadge" in self.navigator) {
    tasks.push(payload.badgeCount > 0 ? self.navigator.setAppBadge(payload.badgeCount) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.postMessage({ type: "notification-click", url: targetUrl });
      if ("navigate" in existing) await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});

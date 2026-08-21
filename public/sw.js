self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function appPath(pathname) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "/friends";
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) return "/caleb-family";
  return "/";
}

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
  tasks.push(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    windows.forEach((client) => client.postMessage({ type: "notification-push", url: payload.url || "/" }));
  }));
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
    const targetApp = appPath(new URL(targetUrl).pathname);
    const existing = windows.find((client) => {
      const clientUrl = new URL(client.url);
      return clientUrl.origin === self.location.origin && appPath(clientUrl.pathname) === targetApp;
    });
    if (existing) {
      existing.postMessage({ type: "notification-click", url: targetUrl });
      if ("navigate" in existing) await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});

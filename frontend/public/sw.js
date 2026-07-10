/* Procharacters service worker — Web Push for resume-code expiry */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Procharacters",
    body: "You have a notification",
    url: "/account",
    tag: "procharacters",
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Procharacters", {
      body: data.body || "",
      tag: data.tag || "procharacters",
      data: { url: data.url || "/account" },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || "/account";
  // Resolve relative paths so navigate/openWindow always get absolute URLs
  let target = "/account";
  try {
    target = new URL(raw, self.location.origin).href;
  } catch {
    target = new URL("/account", self.location.origin).href;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          // Prefer navigate when available (Chromium); fall back to openWindow
          if (typeof client.navigate === "function") {
            return client.navigate(target).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    }),
  );
});

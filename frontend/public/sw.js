/* Procharacters service worker — Web Push + light offline shell */
/* eslint-disable no-restricted-globals */

const OFFLINE_URL = "/offline.html";
const SHELL_CACHE = "procharacters-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon.svg", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Navigation: network-first, offline shell fallback. Never cache Next.js app routes. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only handle document navigations for offline page
  const isNav = req.mode === "navigate";
  if (!isNav) return;

  event.respondWith(
    fetch(req)
      .then((res) => res)
      .catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline || new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
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

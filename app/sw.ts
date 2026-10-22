/// <reference lib="webworker" />

import { defaultCache } from "@serwist/vite/worker";
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";
import {
  clearPrivateRuntimeCaches,
  needsFreshNetwork,
} from "../src/lib/service-worker-cache";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // /__/ is Firebase's proxied sign-in handler; never cache it.
      matcher: ({ request, sameOrigin, url }) =>
        url.pathname.startsWith("/__/") ||
        needsFreshNetwork(request, sameOrigin),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  // Every address is the same app shell, which draws the page for the
  // address itself, so an address never visited before still opens offline.
  fallbacks: {
    entries: [
      {
        url: "/index.html",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
self.addEventListener("activate", (event) => {
  event.waitUntil(clearPrivateRuntimeCaches(caches));
});

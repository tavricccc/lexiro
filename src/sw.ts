/// <reference lib="webworker" />
import { defaultCache } from "@serwist/vite/worker";
import { NetworkOnly, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version waits until the app asks it to take over (Me › About).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Firebase's sign-in handler and every other origin (the Worker) always go to the network;
      // the app keeps its own cache of the Worker's answers.
      matcher: ({ url, sameOrigin }) => !sameOrigin || url.pathname.startsWith("/__/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  // Every address is the same shell, which draws the page itself, so any address opens offline.
  fallbacks: { entries: [{ url: "/index.html", matcher: ({ request }) => request.destination === "document" }] },
});

serwist.addEventListeners();
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

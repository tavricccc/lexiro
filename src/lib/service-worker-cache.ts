const publicDestinations = new Set<RequestDestination>([
  "image",
  "font",
  "style",
  "script",
  "audio",
  "video",
]);

/** Account APIs and cross-origin data belong to their own storage, not HTTP cache. */
export function needsFreshNetwork(
  request: Pick<Request, "headers" | "destination">,
  sameOrigin: boolean,
): boolean {
  return (
    request.headers.has("authorization") ||
    (!sameOrigin && !publicDestinations.has(request.destination))
  );
}

type CachedResponse = Pick<Response, "headers" | "type">;
interface CacheBucket {
  keys: () => Promise<readonly Request[]>;
  match: (request: Request) => Promise<CachedResponse | undefined>;
  delete: (request: Request) => Promise<boolean>;
}
interface RuntimeStorage {
  keys: () => Promise<readonly string[]>;
  open: (name: string) => Promise<CacheBucket>;
}

function isPublicAsset(request: Request, response: CachedResponse): boolean {
  if (publicDestinations.has(request.destination) || response.type === "opaque")
    return true;
  const mime =
    response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() ?? "";
  return (
    /^(?:image|audio|video|font)\//.test(mime) ||
    ["text/css", "text/javascript", "application/javascript"].includes(mime)
  );
}

/** Remove legacy private replies while retaining pages, images and other assets. */
export async function clearPrivateRuntimeCaches(
  storage: RuntimeStorage,
): Promise<void> {
  for (const name of await storage.keys()) {
    const bucket = await storage.open(name);
    for (const request of await bucket.keys()) {
      if (request.headers.has("authorization")) {
        await bucket.delete(request);
      } else if (name === "cross-origin") {
        const response = await bucket.match(request);
        if (response && !isPublicAsset(request, response))
          await bucket.delete(request);
      }
    }
  }
}

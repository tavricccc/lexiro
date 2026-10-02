import { describe, expect, it } from "vitest";
import {
  clearPrivateRuntimeCaches,
  needsFreshNetwork,
} from "@/src/lib/service-worker-cache";

describe("account-safe offline caching", () => {
  it("keeps account and external data on the network while allowing public assets", () => {
    expect(
      needsFreshNetwork(
        {
          headers: new Headers({ authorization: "Bearer fixture" }),
          destination: "",
        },
        true,
      ),
    ).toBe(true);
    expect(
      needsFreshNetwork({ headers: new Headers(), destination: "" }, false),
    ).toBe(true);
    expect(
      needsFreshNetwork(
        { headers: new Headers(), destination: "iframe" },
        false,
      ),
    ).toBe(true);
    expect(
      needsFreshNetwork(
        { headers: new Headers(), destination: "image" },
        false,
      ),
    ).toBe(false);
    expect(
      needsFreshNetwork(
        { headers: new Headers(), destination: "document" },
        true,
      ),
    ).toBe(false);
  });
  it("removes earlier private responses without removing cached app pages or public images", async () => {
    const account = new Request("https://worker.test/me", {
      headers: { authorization: "Bearer fixture" },
    });
    const records = new Request("https://firestore.test/listen?SID=fixture");
    const avatar = new Request("https://images.test/avatar");
    const page = new Request("https://lexiro.test/app");
    const buckets = new Map([
      [
        "cross-origin",
        new Map([
          [account, Response.json({ points: 10 })],
          [
            records,
            new Response("private records", {
              headers: { "content-type": "text/plain" },
            }),
          ],
          [
            avatar,
            new Response("image", { headers: { "content-type": "image/png" } }),
          ],
        ]),
      ],
      [
        "pages",
        new Map([
          [
            page,
            new Response("cached app", {
              headers: { "content-type": "text/html" },
            }),
          ],
        ]),
      ],
    ]);
    await clearPrivateRuntimeCaches({
      keys: async () => [...buckets.keys()],
      open: async (name) => {
        const entries = buckets.get(name)!;
        return {
          keys: async () => [...entries.keys()],
          match: async (request) => entries.get(request),
          delete: async (request) => entries.delete(request),
        };
      },
    });
    expect(buckets.get("cross-origin")!.has(account)).toBe(false);
    expect(buckets.get("cross-origin")!.has(records)).toBe(false);
    expect(buckets.get("cross-origin")!.has(avatar)).toBe(true);
    expect(buckets.get("pages")!.has(page)).toBe(true);
  });
});

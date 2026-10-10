import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudClient } from "@/src/lib/cloud-client";
import { SYNC_ORIGIN_ID, watchCloudChanges } from "@/src/lib/cloud-sync";
describe("D1 change polling", () => {
  const request = vi.fn();
  const client = { uid: "uid", blobRevision: 0, request } as CloudClient;
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers(); request.mockReset();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => { stop?.(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it("polls every 30 seconds, ignores own writes and reconciles remote model changes", async () => {
    const change = vi.fn();
    request.mockResolvedValueOnce({ revision: 1, blobRevision: 1 });
    request.mockResolvedValueOnce({ revision: 2, blobRevision: 2, changedBy: SYNC_ORIGIN_ID, blobChangedBy: SYNC_ORIGIN_ID });
    request.mockResolvedValueOnce({ revision: 2, blobRevision: 3, blobChangedBy: "other" });
    stop = watchCloudChanges(client, "uid", change);
    await vi.advanceTimersByTimeAsync(29999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30001);
    expect(change).toHaveBeenCalledExactlyOnceWith(undefined, true);
    stop(); await vi.advanceTimersByTimeAsync(30000);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("skips hidden and offline devices, then reacts to a remote library edit", async () => {
    const change = vi.fn();
    request.mockResolvedValueOnce({ revision: 1, blobRevision: 1 });
    request.mockResolvedValue({ revision: 2, blobRevision: 1, changedBy: "other" });
    stop = watchCloudChanges(client, "uid", change);
    await vi.advanceTimersByTimeAsync(0);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await vi.advanceTimersByTimeAsync(30000);
    expect(request).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(request).toHaveBeenCalledTimes(1);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(change).toHaveBeenCalledExactlyOnceWith("other", false);
  });
});

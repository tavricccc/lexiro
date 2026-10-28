import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudClient } from "@/src/lib/cloud-client";
import {
  CLOUD_STATUS_POLL_MS as POLL,
  CLOUD_STATUS_WAKE_GAP_MS,
  SYNC_ORIGIN_ID,
  watchCloudChanges,
} from "@/src/lib/cloud-sync";
describe("D1 change polling", () => {
  const request = vi.fn();
  const client = { uid: "uid", blobRevision: 0, request } as CloudClient;
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    stop?.();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("polls on a timer, ignores own writes and reconciles remote model changes", async () => {
    const change = vi.fn();
    request.mockResolvedValueOnce({ revision: 1, blobRevision: 1 });
    request.mockResolvedValueOnce({
      revision: 2,
      blobRevision: 2,
      changedBy: SYNC_ORIGIN_ID,
      blobChangedBy: SYNC_ORIGIN_ID,
    });
    request.mockResolvedValueOnce({
      revision: 2,
      blobRevision: 3,
      blobChangedBy: "other",
    });
    stop = watchCloudChanges(client, "uid", change);
    await vi.advanceTimersByTimeAsync(POLL - 1);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL + 1);
    expect(change).toHaveBeenCalledExactlyOnceWith(undefined, true);
    stop();
    await vi.advanceTimersByTimeAsync(POLL);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("skips hidden and offline devices, then reacts to a remote library edit", async () => {
    const change = vi.fn();
    request.mockResolvedValueOnce({ revision: 1, blobRevision: 1 });
    request.mockResolvedValue({
      revision: 2,
      blobRevision: 1,
      changedBy: "other",
    });
    stop = watchCloudChanges(client, "uid", change);
    await vi.advanceTimersByTimeAsync(0);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await vi.advanceTimersByTimeAsync(POLL);
    expect(request).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(POLL);
    expect(request).toHaveBeenCalledTimes(1);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(change).toHaveBeenCalledExactlyOnceWith("other", false);
  });
  it("leaves polling to the focused tab and wakes when a tab regains focus", async () => {
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    request.mockResolvedValue({ revision: 1, blobRevision: 1 });
    stop = watchCloudChanges(client, "uid", vi.fn());
    await vi.advanceTimersByTimeAsync(2 * POLL);
    expect(request).not.toHaveBeenCalled();
    hasFocus.mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not poll again when the device comes back online", async () => {
    request.mockResolvedValue({ revision: 1, blobRevision: 1 });
    stop = watchCloudChanges(client, "uid", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("answers focus and visibility arriving together with one poll", async () => {
    request.mockResolvedValue({ revision: 1, blobRevision: 1 });
    stop = watchCloudChanges(client, "uid", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CLOUD_STATUS_WAKE_GAP_MS);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

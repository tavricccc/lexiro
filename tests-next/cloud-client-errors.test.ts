import { describe, expect, it } from "vitest";
import { cloudResponseError } from "@/src/lib/cloud-client";
import { isRetryableSyncError } from "@/src/lib/cloud-sync-errors";

const refusal = (status: number, code: string) =>
  cloudResponseError(status, { error: { code } });

describe("Worker refusals in the sync client", () => {
  it.each([
    [429, "daily_write_limit", "明天會自動繼續"],
    [413, "storage_limit", "雲端空間已滿"],
    [403, "account_disabled", "已被停用"],
  ])(
    "explains %s %s and does not retry it on a timer",
    (status, code, text) => {
      const error = refusal(status, code);
      expect(error.message).toContain(text);
      expect(isRetryableSyncError(error)).toBe(false);
    },
  );

  it("retries a burst throttle", () => {
    const error = refusal(429, "rate_limited");
    expect(error.message).toContain("稍後會自動再試");
    expect(isRetryableSyncError(error)).toBe(true);
  });

  it("keeps the Worker's own message for other refusals", () => {
    const error = cloudResponseError(400, {
      error: { code: "invalid_content", message: "內容格式錯誤" },
    });
    expect(error.message).toBe("內容格式錯誤");
    expect(isRetryableSyncError(error)).toBe(false);
    expect(isRetryableSyncError(cloudResponseError(503, null))).toBe(true);
  });
});

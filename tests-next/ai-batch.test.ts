import { describe, expect, it, vi } from "vitest";

import { runAiBatches } from "@/src/lib/ai-batch";
import { AiNotConfiguredError, AiRequestError } from "@/src/lib/ai-provider";

/** Backoff is real time in production and wasted time in a test. */
const wait = async () => {};

describe("runAiBatches", () => {
  it("returns every result in batch order", async () => {
    const outcome = await runAiBatches({
      batches: [1, 2, 3, 4, 5],
      concurrency: 2,
      retries: 0,
      run: async (batch) => batch * 10,
    });

    expect(outcome.failures).toEqual([]);
    expect(outcome.results.map((entry) => entry.value)).toEqual([10, 20, 30, 40, 50]);
  });

  it("keeps partial results when one batch fails instead of throwing", async () => {
    const outcome = await runAiBatches({
      batches: ["a", "b", "c"],
      concurrency: 1,
      retries: 0,
      run: async (batch) => {
        if (batch === "b") throw new Error("429 rate limited");
        return batch.toUpperCase();
      },
    });

    expect(outcome.results.map((entry) => entry.value)).toEqual(["A", "C"]);
    expect(outcome.failures).toEqual([{ index: 1, message: "429 rate limited" }]);
  });

  it("sends a failing batch exactly once by default", async () => {
    const run = vi.fn(async (batch: string) => {
      if (batch === "b") throw new Error("connection reset");
      return batch.toUpperCase();
    });

    const outcome = await runAiBatches({ batches: ["a", "b", "c"], run, wait });

    // Ten batches with two dead ones must cost two failures, not six timeouts.
    expect(run).toHaveBeenCalledTimes(3);
    expect(outcome.results.map((entry) => entry.value)).toEqual(["A", "C"]);
    expect(outcome.failures).toEqual([
      { index: 1, message: "connection reset" },
    ]);
  });

  it("retries a failing batch up to the retry budget", async () => {
    let attempts = 0;
    const outcome = await runAiBatches({
      batches: ["only"],
      retries: 2,
      wait,
      run: async () => {
        attempts++;
        if (attempts < 3) throw new Error("flaky");
        return "recovered";
      },
    });

    expect(attempts).toBe(3);
    expect(outcome.failures).toEqual([]);
    expect(outcome.results[0].value).toBe("recovered");
  });

  it("reports progress after each finished batch", async () => {
    const onProgress = vi.fn();
    await runAiBatches({
      batches: [1, 2],
      concurrency: 1,
      onProgress,
      retries: 0,
      run: async (batch) => batch,
    });

    expect(onProgress).toHaveBeenCalledWith({
      characters: 0,
      completed: 0,
      failed: 0,
      inFlight: 0,
      retrying: 0,
      succeeded: 0,
      total: 2,
    });
    // The first request counts as in flight before any reply arrives, so the
    // panel can say something moved.
    expect(onProgress).toHaveBeenCalledWith({
      characters: 0,
      completed: 0,
      failed: 0,
      inFlight: 1,
      retrying: 0,
      succeeded: 0,
      total: 2,
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      characters: 0,
      completed: 2,
      failed: 0,
      inFlight: 0,
      retrying: 0,
      succeeded: 2,
      total: 2,
    });
  });

  it("stops starting batches once the signal aborts and says so", async () => {
    const controller = new AbortController();
    const run = vi.fn(async (batch: number) => {
      if (batch === 1) controller.abort();
      return batch;
    });

    const outcome = await runAiBatches({
      batches: [1, 2, 3],
      concurrency: 1,
      retries: 0,
      run,
      signal: controller.signal,
    });

    expect(outcome.aborted).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome.results.map((entry) => entry.value)).toEqual([1]);
  });

  it("does not spend a retry on an error that cannot get better", async () => {
    const run = vi.fn(async () => {
      throw new AiRequestError("AI 請求失敗（401）：invalid key", {
        retryable: false,
        status: 401,
      });
    });

    const outcome = await runAiBatches({
      batches: ["only"],
      retries: 3,
      run,
      wait,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome.failures[0].message).toContain("401");
  });

  it("retries an error the provider says is worth retrying", async () => {
    let attempts = 0;
    const outcome = await runAiBatches({
      batches: ["only"],
      retries: 1,
      run: async () => {
        attempts++;
        if (attempts === 1)
          throw new AiRequestError("AI 請求失敗（429）", {
            retryAfterMs: 5,
            retryable: true,
            status: 429,
          });
        return "recovered";
      },
      wait,
    });

    expect(attempts).toBe(2);
    expect(outcome.results[0].value).toBe("recovered");
  });

  it("stops the whole run when the AI is not configured", async () => {
    const run = vi.fn(async () => {
      throw new AiNotConfiguredError("尚未填入 API key");
    });

    const outcome = await runAiBatches({
      batches: [1, 2, 3, 4],
      concurrency: 1,
      retries: 2,
      run,
      wait,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome.fatal).toBe("尚未填入 API key");
    expect(outcome.failures).toEqual([{ index: 0, message: "尚未填入 API key" }]);
  });
});

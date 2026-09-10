import { describe, expect, it, vi } from "vitest";

import { runAiBatches } from "@/src/lib/ai-batch";

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

  it("retries a failing batch up to the retry budget", async () => {
    let attempts = 0;
    const outcome = await runAiBatches({
      batches: ["only"],
      retries: 2,
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
      completed: 0,
      failed: 0,
      succeeded: 0,
      total: 2,
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      completed: 2,
      failed: 0,
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
});

import { describe, expect, it, vi } from "vitest";
import { createAiSession } from "@/src/lib/ai/session";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { AiRequestError } from "@/src/lib/ai/errors";
import type { AiTaskStep, AiTurnResult } from "@/src/types/ai";
const reply = (text: string, id = text): AiTurnResult => ({
  id,
  text,
  complete: true,
  stopReason: "complete",
});
function createRun(steps?: AiTaskStep<string>[]): AiRun<string> {
  const parts =
    steps ??
    ["a", "b", "c"].map((id) => ({
      id,
      context: "all sources",
      prompt: id,
      count: 1,
      parse: (text: string) => [text],
    }));
  const task = { id: "test", kind: "words" as const, billableCount: parts.length, context: "all sources", steps: parts };
  return {
    task,
    session: createAiSession(
      "lite",
      task.context,
    ),
    pending: [...parts],
    items: [],
    completed: 0,
    total: parts.reduce((sum, p) => sum + p.count, 0),
    segments: 0,
  };
}
describe("serial task generation", () => {
  it("commits one segment before sending the next and preserves the same session", async () => {
    const run = createRun();
    let active = 0,
      peak = 0;
    const send = vi.fn(async (session, prompt) => {
      peak = Math.max(peak, ++active);
      expect(session.cursor).toBe(run.completed ? run.items.at(-1) : undefined);
      await Promise.resolve();
      active--;
      return reply(prompt);
    });
    const onUpdate = vi.fn();
    await runTask(run, {
      signal: new AbortController().signal,
      send,
      onUpdate,
    });
    expect(peak).toBe(1);
    expect(run.items).toEqual(["a", "b", "c"]);
    expect(run.session.cursor).toBe("c");
    expect(
      onUpdate.mock.calls.some(
        ([u]) => u.completed === 1 && u.items.length === 1,
      ),
    ).toBe(true);
  });
  it("stops after cancellation, retains validated items, then resumes only the remainder", async () => {
    const run = createRun(),
      controller = new AbortController();
    const send = vi.fn(async (_session, prompt) => reply(prompt));
    await expect(
      runTask(run, {
        signal: controller.signal,
        send,
        onUpdate: (u) => {
          if (u.completed === 1) controller.abort();
        },
      }),
    ).rejects.toBeDefined();
    expect(run.items).toEqual(["a"]);
    expect(run.pending.map((s) => s.id)).toEqual(["b", "c"]);
    await runTask(run, {
      signal: new AbortController().signal,
      send,
      onUpdate: () => {},
    });
    expect(send.mock.calls.map(([, prompt]) => prompt)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("never commits a late reply from an aborted request", async () => {
    const run = createRun(),
      controller = new AbortController();
    await expect(
      runTask(run, {
        signal: controller.signal,
        onUpdate: () => {},
        send: async () => {
          controller.abort();
          return reply("late");
        },
      }),
    ).rejects.toBeDefined();
    expect(run.items).toEqual([]);
    expect(run.session.cursor).toBeUndefined();
  });
  it("respects Retry-After and leaves the last committed cursor intact during retries", async () => {
    const run = createRun(),
      wait = vi.fn(async (_ms: number) => {});
    const send = vi
      .fn()
      .mockRejectedValueOnce(
        new AiRequestError("rate limit", {
          status: 429,
          retryable: true,
          retryAfterMs: 45000,
        }),
      )
      .mockImplementation(async (_session, prompt) => reply(prompt));
    await runTask(run, {
      signal: new AbortController().signal,
      send,
      wait,
      onUpdate: () => {},
    });
    expect(wait.mock.calls[0][0]).toBe(45000);
    expect(run.items).toEqual(["a", "b", "c"]);
  });
  it("pauses after one failed repair rather than retrying invalid content forever", async () => {
    const run = createRun([
      {
        id: "bad",
        context: "context",
        count: 1,
        prompt: "bad",
        parse: () => {
          throw new Error("missing source");
        },
      },
    ]);
    const send = vi.fn(async () => reply("invalid"));
    await expect(
      runTask(run, {
        signal: new AbortController().signal,
        send,
        onUpdate: () => {},
      }),
    ).rejects.toThrow("missing source");
    expect(send).toHaveBeenCalledTimes(2);
    expect(run.pending).toHaveLength(1);
    expect(run.completed).toBe(0);
  });
  it("splits only independent units after truncation", async () => {
    const children = ["a", "b"].map((id) => ({
      id,
      context: "all sources",
      prompt: id,
      count: 1,
      parse: (text: string) => [text],
    }));
    const run = createRun([
      {
        id: "ab",
        context: "all sources",
        prompt: "ab",
        count: 2,
        parse: (text) => [text],
        split: () => children,
      },
    ]);
    const send = vi
      .fn()
      .mockRejectedValueOnce(
        new AiRequestError("truncated", {
          retryable: false,
          code: "truncated",
        }),
      )
      .mockImplementation(async (_session, prompt) => reply(prompt));
    await runTask(run, {
      signal: new AbortController().signal,
      send,
      onUpdate: () => {},
    });
    expect(run.items).toEqual(["a", "b"]);
    expect(run.completed).toBe(2);
  });
});

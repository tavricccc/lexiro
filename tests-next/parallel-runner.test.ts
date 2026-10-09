import { describe, expect, it, vi } from "vitest";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { createAiSession } from "@/src/lib/ai/session";
import { AiRequestError } from "@/src/lib/ai/errors";

const makeRun = (count = 6): AiRun<string> => {
  const steps = Array.from({ length: count }, (_, index) => String(index + 1)).map((id) => ({
    id,
    context: id,
    prompt: id,
    count: 1,
    parse: (text: string) => [text],
  }));
  const task = {
    id: "synthetic",
    kind: "words" as const,
    context: "all",
    billableCount: count,
    steps,
  };
  return {
    task,
    session: createAiSession("lite", "all"),
    pending: [...steps],
    items: [],
    completed: 0,
    total: count,
    segments: 0,
  };
};
describe("productive warmup and independent parallel batches", () => {
  it("warms with the first batch, runs at most four siblings, and keeps source order", async () => {
    const run = makeRun();
    const releases = new Map(
      ["1", "2", "3", "4", "5", "6"].map((id) => [id, Promise.withResolvers<void>()]),
    );
    let active = 0,
      peak = 0;
    const inputs: string[] = [];
    const work = runTask(run, {
      signal: new AbortController().signal,
      onUpdate: () => {},
      send: async (_session, input) => {
        inputs.push(input);
        peak = Math.max(peak, ++active);
        await releases.get(input)!.promise;
        active--;
        return {
          id: `resp_${input}`,
          text: input,
          stopReason: "complete",
          complete: true,
        };
      },
    });
    await vi.waitFor(() => expect(inputs).toEqual(["1"]));
    releases.get("1")!.resolve();
    await vi.waitFor(() => expect(inputs).toEqual(["1", "2", "3", "4", "5"]));
    releases.get("2")!.resolve();
    await vi.waitFor(() => expect(inputs).toHaveLength(6));
    releases.get("6")!.resolve();
    releases.get("5")!.resolve();
    releases.get("4")!.resolve();
    releases.get("3")!.resolve();
    await work;
    expect(peak).toBe(4);
    expect(run.items).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(run.completed).toBe(6);
    expect(run.pending).toEqual([]);
  });
  it("retains a disconnected lane's operation identity while accepting its successful sibling", async () => {
    const run = makeRun(3);
    let failed = false;
    const send: Parameters<typeof runTask<string>>[1]["send"] = async (
      session,
      input,
    ) => {
      if (input === "2" && !failed) {
        failed = true;
        session.pendingTurn = {
          id: "pending-two",
          signature: "synthetic",
          started: true,
          createdAt: Date.now(),
        };
        throw new AiRequestError("Disconnected", {
          code: "resume_required",
          retryable: false,
        });
      }
      if (input === "2") expect(session.pendingTurn?.id).toBe("pending-two");
      return {
        id: `resp_${input}`,
        text: input,
        stopReason: "complete",
        complete: true,
      };
    };
    const options = {
      signal: new AbortController().signal,
      onUpdate: () => {},
      send,
    };
    await expect(runTask(run, options)).rejects.toThrow("Disconnected");
    expect(run.items).toEqual(["1", "3"]);
    await runTask(run, options);
    expect(run.items).toEqual(["1", "2", "3"]);
    expect(run.completed).toBe(3);
  });
});

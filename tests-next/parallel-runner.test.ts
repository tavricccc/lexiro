import { describe, expect, it, vi } from "vitest";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { createAiSession } from "@/src/lib/ai/session";
import { AiRequestError } from "@/src/lib/ai/errors";

const makeRun = (): AiRun<string> => {
  const steps = ["1", "2", "3", "4"].map((id) => ({
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
    billableCount: 4,
    steps,
  };
  return {
    task,
    session: createAiSession("lite", "all"),
    pending: [...steps],
    items: [],
    completed: 0,
    total: 4,
    segments: 0,
  };
};
describe("productive warmup and independent parallel batches", () => {
  it("warms with the first batch, runs at most two siblings, and keeps source order", async () => {
    const run = makeRun();
    const releases = new Map(
      ["1", "2", "3", "4"].map((id) => [id, Promise.withResolvers<void>()]),
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
    await vi.waitFor(() => expect(inputs).toEqual(["1", "2", "3"]));
    releases.get("2")!.resolve();
    await vi.waitFor(() => expect(inputs).toHaveLength(4));
    releases.get("4")!.resolve();
    releases.get("3")!.resolve();
    await work;
    expect(peak).toBe(2);
    expect(run.items).toEqual(["1", "2", "3", "4"]);
    expect(run.completed).toBe(4);
    expect(run.pending).toEqual([]);
  });
  it("retains a disconnected lane's operation identity while accepting its successful sibling", async () => {
    const run = makeRun();
    run.pending.pop();
    run.total = 3;
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

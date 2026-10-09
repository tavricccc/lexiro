import { describe, expect, it, vi } from "vitest";
import { runTask, type AiRun } from "@/src/lib/ai/runner";
import { createAiSession } from "@/src/lib/ai/session";
import { AiRequestError } from "@/src/lib/ai/errors";
import {
  checkpointRun,
  GENERATION_LIFETIME_MS,
  registerTaskSteps,
  restoreRunCheckpoint,
} from "@/src/lib/ai/run-checkpoint";
import type { AiTask, AiTaskStep, AiTurnResult } from "@/src/types/ai";

const reply = (text: string): AiTurnResult => ({
  text,
  id: text,
  complete: true,
  stopReason: "complete",
});
function createRun(task: AiTask<string>): AiRun<string> {
  registerTaskSteps(task);
  return {
    task,
    session: createAiSession("lite", task.context),
    pending: [...task.steps],
    items: [],
    completed: 0,
    total: task.steps.reduce((sum, step) => sum + step.count, 0),
    segments: 0,
  };
}
function task(): AiTask<string> {
  return {
    id: "fixture",
    kind: "words",
    context: "same sources",
    billableCount: 3,
    steps: ["a", "b", "c"].map((id) => ({
      id,
      context: id,
      prompt: id,
      count: 1,
      parse: (text: string) => [text],
    })),
  };
}
const disconnected = () =>
  new AiRequestError("Disconnected", {
    code: "resume_required",
    retryable: false,
  });

describe("persistent generation checkpoints", () => {
  it("restores parallel results and reconnects only the interrupted operation", async () => {
    const run = createRun(task());
    await expect(
      runTask(run, {
        signal: new AbortController().signal,
        onUpdate: () => {},
        send: async (session, input) => {
          if (input === "b") {
            session.pendingTurn = {
              id: "original-b",
              signature: "b",
              started: true,
              createdAt: Date.now(),
            };
            throw disconnected();
          }
          return reply(input);
        },
      }),
    ).rejects.toThrow("Disconnected");
    const checkpoint = JSON.parse(JSON.stringify(checkpointRun(run, "owner")));
    const restored = restoreRunCheckpoint(checkpoint, task(), "owner").run!;
    expect(restored.items).toEqual(["a", "c"]);
    const send = vi.fn(async (session, input) => {
      expect(session.pendingTurn?.id).toBe("original-b");
      return reply(input);
    });
    await runTask(restored, {
      signal: new AbortController().signal,
      onUpdate: () => {},
      send,
    });
    expect(send).toHaveBeenCalledOnce();
    expect(restored.items).toEqual(["a", "b", "c"]);
    expect(restored.completed).toBe(3);
  });

  it("replays accepted repair siblings into their shared draft before continuing", async () => {
    const repairTask = (): AiTask<string> => {
      const root: AiTaskStep<string> = {
        id: "pack",
        context: "pack",
        prompt: "pack",
        count: 1,
        parse: () => {
          throw new Error("broken children");
        },
        recover: () => {
          const items = ["old a", "old b"];
          return {
            items: [],
            completed: 0,
            remaining: items.map((_, index) => ({
              id: `repair-${index}`,
              context: "repair",
              get prompt() {
                return items.join("|");
              },
              count: index === 1 ? 1 : 0,
              parse: (text: string) => {
                items[index] = text;
                return index === 1 ? [items.join("|")] : [];
              },
            })),
          };
        },
      };
      return {
        id: "repair",
        kind: "reading",
        context: "pack",
        billableCount: 1,
        steps: [root],
      };
    };
    const run = createRun(repairTask());
    let requests = 0;
    await expect(
      runTask(run, {
        signal: new AbortController().signal,
        onUpdate: () => {},
        send: async (session) => {
          if (++requests === 1) return reply("broken pack");
          if (requests === 2) return reply("fixed a");
          session.pendingTurn = {
            id: "original-repair-b",
            signature: "repair-b",
            started: true,
            createdAt: Date.now(),
          };
          throw disconnected();
        },
      }),
    ).rejects.toThrow("Disconnected");
    const restored = restoreRunCheckpoint(
      JSON.parse(JSON.stringify(checkpointRun(run, "owner"))),
      repairTask(),
      "owner",
    ).run!;
    expect(restored.pending[0].prompt).toBe("fixed a|old b");
    await runTask(restored, {
      signal: new AbortController().signal,
      onUpdate: () => {},
      send: async (session) => {
        expect(session.pendingTurn?.id).toBe("original-repair-b");
        return reply("fixed b");
      },
    });
    expect(restored.items).toEqual(["fixed a|fixed b"]);
    expect(restored.completed).toBe(1);
  });

  it("keeps completed output but refuses an expired, changed, or other-account operation", () => {
    const run = createRun(task());
    run.items = ["accepted a"];
    run.completed = 1;
    run.pending.shift();
    run.session.pendingTurn = {
      id: "expired",
      signature: "b",
      started: true,
      createdAt: Date.now() - GENERATION_LIFETIME_MS - 1,
    };
    const checkpoint = checkpointRun(run, "owner");
    expect(restoreRunCheckpoint(checkpoint, task(), "owner").reason).toBe(
      "expired",
    );
    expect(checkpoint.run.items).toEqual(["accepted a"]);
    expect(restoreRunCheckpoint(checkpoint, task(), "other").reason).toBe(
      "changed",
    );
    expect(
      restoreRunCheckpoint(
        { ...checkpoint, contract: "old contract" },
        task(),
        "owner",
      ).reason,
    ).toBe("changed");
    expect(
      restoreRunCheckpoint(
        checkpoint,
        { ...task(), context: "edited source" },
        "owner",
      ).reason,
    ).toBe("changed");
  });
});

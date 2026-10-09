import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import type { AiTask, AiTurnResult } from "@/src/types/ai";
import { AiRequestError } from "@/src/lib/ai/errors";
import type { AiGenerationSnapshot } from "@/components/ai/use-ai-generation";

const mocks = vi.hoisted(() => ({ send: vi.fn(), uid: "fixture" }));
vi.mock("@/stores/cloud-store", () => ({
  useCloudStore: (
    select: (state: { ready: boolean; user: { uid: string } }) => unknown,
  ) => select({ ready: true, user: { uid: mocks.uid } }),
}));
vi.mock("@/src/lib/ai/session", async (original) => ({
  ...(await original<typeof import("@/src/lib/ai/session")>()),
  generateTurn: mocks.send,
}));
const response = (text: string): AiTurnResult => ({
  id: text,
  text,
  complete: true,
  stopReason: "complete",
});
const task = (ids = ["a", "b"]): AiTask<string> => ({
  id: "test",
  context: "all sources",
  kind: "words",
  billableCount: ids.length,
  steps: ids.map((id) => ({
    id,
    context: "sources",
    count: 1,
    prompt: id,
    parse: (text: string) => [text],
  })),
});
beforeEach(() => {
  mocks.send.mockReset();
  mocks.uid = "fixture";
});
afterEach(() => cleanup());

describe("generation lifecycle", () => {
  it("restores completed output without making another paid request", () => {
    const { result } = renderHook(() =>
      useAiGeneration<string>({
        initialSnapshot: {
          tier: "lite",
          state: {
            status: "done",
            phase: "validating",
            characters: 0,
            completed: 1,
            total: 1,
            segments: 1,
            error: "",
            items: ["saved word"],
            notices: [],
            startedAt: null,
            elapsedMs: 250,
            remaining: 0,
            usage: {},
            diagnostic: null,
          },
        },
      }),
    );
    expect(result.current.state.items).toEqual(["saved word"]);
    expect(result.current.state.status).toBe("done");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("keeps a legacy partial snapshot paused instead of claiming completion", () => {
    const { result } = renderHook(() =>
      useAiGeneration<string>({
        initialSnapshot: {
          tier: "lite",
          state: {
            status: "running",
            phase: "generating",
            characters: 20,
            completed: 1,
            total: 3,
            segments: 1,
            error: "",
            items: ["accepted"],
            notices: [],
            startedAt: null,
            elapsedMs: 250,
            remaining: 2,
            usage: {},
            diagnostic: null,
          },
        },
      }),
    );
    expect(result.current.state).toMatchObject({
      status: "cancelled",
      completed: 1,
      total: 3,
      remaining: 2,
      resumeUnavailable: "legacy",
    });
    expect(result.current.canResume).toBe(false);
    expect(result.current.canAppend).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("never turns a server-expired operation into a fresh request after reload", async () => {
    let snapshot: AiGenerationSnapshot<string> | undefined;
    const currentTask = task(["expired"]);
    mocks.send.mockRejectedValueOnce(
      new AiRequestError("expired", {
        code: "generation_expired",
        retryable: false,
      }),
    );
    const active = renderHook(() =>
      useAiGeneration<string>({
        task: currentTask,
        onSnapshotChange: (value) => {
          snapshot = value;
        },
      }),
    );
    act(() => active.result.current.start(currentTask));
    await waitFor(() =>
      expect(active.result.current.state.resumeUnavailable).toBe("expired"),
    );
    await waitFor(() =>
      expect(snapshot?.state.resumeUnavailable).toBe("expired"),
    );
    expect(active.result.current.canResume).toBe(false);
    active.unmount();
    const restored = renderHook(() =>
      useAiGeneration<string>({ initialSnapshot: snapshot, task: currentTask }),
    );
    expect(restored.result.current.canResume).toBe(false);
    act(() => restored.result.current.resume());
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("retains results on pause, resumes pending work, and appends a new round", async () => {
    let release: (r: AiTurnResult) => void = () => {};
    mocks.send.mockResolvedValueOnce(response("a")).mockImplementationOnce(
      () =>
        new Promise<AiTurnResult>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() => useAiGeneration<string>());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.start(task()));
    await waitFor(() => expect(result.current.state.completed).toBe(1));
    act(() => result.current.cancel());
    await act(async () => release(response("discard late b")));
    await waitFor(() => expect(result.current.state.status).toBe("cancelled"));
    expect(result.current.state.items).toEqual(["a"]);
    act(() => result.current.setItems(["edited a"]));
    mocks.send.mockResolvedValueOnce(response("b"));
    act(() => result.current.resume());
    await waitFor(() => expect(result.current.state.status).toBe("done"));
    expect(result.current.state.items).toEqual(["edited a", "b"]);
    mocks.send
      .mockResolvedValueOnce(response("new a"))
      .mockResolvedValueOnce(response("new b"));
    act(() => result.current.append());
    await waitFor(() => expect(result.current.state.items).toHaveLength(4));
    expect(result.current.state.total).toBe(4);
  });
  it("ignores a reset run's late response after regenerating", async () => {
    let release: (r: AiTurnResult) => void = () => {};
    mocks.send
      .mockImplementationOnce(
        () =>
          new Promise<AiTurnResult>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce(response("new"));
    const { result } = renderHook(() => useAiGeneration<string>());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.start(task(["old"])));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    act(() => result.current.reset());
    act(() => result.current.start(task(["new"])));
    await waitFor(() => expect(result.current.state.status).toBe("done"));
    await act(async () => release(response("stale")));
    expect(result.current.state.items).toEqual(["new"]);
    expect(result.current.state.status).toBe("done");
  });
  it("sends only one paid request when start is pressed twice", async () => {
    mocks.send.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useAiGeneration<string>());
    act(() => {
      result.current.start(task(["a"]));
      result.current.start(task(["a"]));
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it("aborts immediately on account change and discards the old response", async () => {
    let release!: (r: AiTurnResult) => void;
    mocks.send.mockImplementationOnce(
      () =>
        new Promise<AiTurnResult>((resolve) => {
          release = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useAiGeneration<string>());
    act(() => result.current.start(task(["old"])));
    const signal = mocks.send.mock.calls[0][2].signal as AbortSignal;
    mocks.uid = "other-account";
    rerender();
    expect(signal.aborted).toBe(true);
    await act(async () => release(response("private old output")));
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.items).toEqual([]);
    mocks.send.mockResolvedValueOnce(response("new"));
    act(() => result.current.start(task(["new"])));
    await waitFor(() => expect(result.current.state.items).toEqual(["new"]));
  });
});

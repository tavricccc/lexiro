import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiGeneration } from "@/components/ai/use-ai-generation";
import type { AiTask, AiTurnResult } from "@/src/types/ai";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/stores/cloud-store", () => ({
  useCloudStore: (select: (state: { ready: boolean; user: { uid: string } }) => unknown) => select({ ready: true, user: { uid: "fixture" } }),
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
beforeEach(() => mocks.send.mockReset());
afterEach(() => cleanup());

describe("generation lifecycle", () => {
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
  it("ignores a superseded run's late response after regenerating", async () => {
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
    act(() => result.current.start(task(["new"])));
    await waitFor(() => expect(result.current.state.status).toBe("done"));
    await act(async () => release(response("stale")));
    expect(result.current.state.items).toEqual(["new"]);
    expect(result.current.state.status).toBe("done");
  });
});

import { describe, it, expect, vi } from "vitest";
import { resumeGeneration } from "@/lib/generation-connection";
import type { AiSession } from "@/src/types/ai";
import { AiRequestError } from "@/src/lib/ai/errors";

describe("generation connection recovery", () => {
  it("reconnects to the same job and receives the result without a second POST", async () => {
    vi.useFakeTimers();
    try {
      const session: AiSession = { model: "gpt-6-luna", tier: "lite", context: "apple", sessionId: crypto.randomUUID(), usage: {}, notices: [] };
      const fetcher = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () => new Response("stream"));
      const result = { text: "finished", complete: true, stopReason: "complete" as const };
      const reader = vi.fn().mockRejectedValueOnce(new AiRequestError("Disconnected", { code: "stream_disconnected", retryable: true })).mockResolvedValueOnce(result);
      const phases = vi.fn();
      const work = resumeGeneration(session, "/generate", { method: "POST", body: "apple" }, { onPhase: phases }, fetcher, reader);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
      const id = session.pendingTurn!.id;
      await vi.runAllTimersAsync();
      expect(await work).toBe(result);
      expect(fetcher.mock.calls.map((call) => call[0])).toEqual(["/generate", `/generation/${session.sessionId}/${id}`]);
      expect(phases).toHaveBeenCalledWith("reconnecting");
      expect(session.pendingTurn).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
});

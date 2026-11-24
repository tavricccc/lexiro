import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPlayer, RoomState } from "@/domain/room";
import { api, ApiError, errorMessage } from "./api";
import { workerUrl } from "./config";

type Outgoing = { type: "start" } | { type: "end" } | { type: "answer"; index: number; choice: number };
export type Connection = "connecting" | "open" | "reconnecting" | "replaced" | "failed";

/**
 * A seat in a live room. Each connection spends a one-time ticket; a dropped
 * socket asks for a new one and comes back to wherever the room is now.
 */
export function useRoomSocket(code: string, name: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;
    const connect = async () => {
      let ticket: string;
      try {
        ({ ticket } = await api<{ ticket: string }>(`/rooms/${code}/ticket`, { method: "POST", json: { name } }));
      } catch (reason) {
        if (stopped) return;
        // A missing, full or finished room will not change by retrying.
        const transient = reason instanceof ApiError && (reason.offline || reason.status === 429 || reason.status >= 500);
        if (transient && attempts++ < 5) { retry = setTimeout(() => void connect(), 2000 * attempts); setConnection("reconnecting"); return; }
        setError(errorMessage(reason));
        setConnection("failed");
        return;
      }
      if (stopped) return;
      const ws = new WebSocket(`${workerUrl.replace(/^http/, "ws")}/rooms/${code}/ws?ticket=${encodeURIComponent(ticket)}`);
      socket.current = ws;
      ws.onopen = () => {
        attempts = 0;
        setConnection("open");
        ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 20_000);
      };
      ws.onmessage = (event) => {
        let message: { type?: string; serverNow?: number; players?: RoomPlayer[] };
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (typeof message.serverNow === "number") setOffset(message.serverNow - Date.now());
        if (message.type === "state") setState(message as RoomState);
        else if (message.type === "players" && message.players) {
          const players = message.players;
          setState((current) => (current ? { ...current, players } : current));
        }
      };
      ws.onclose = (event) => {
        clearInterval(ping);
        if (socket.current === ws) socket.current = null;
        if (stopped) return;
        if (event.code === 4409) return setConnection("replaced");
        if (event.code === 4404) { setError("這個房間已經關閉。"); return setConnection("failed"); }
        setConnection("reconnecting");
        retry = setTimeout(() => void connect(), Math.min(10_000, 1000 * 2 ** attempts++));
      };
    };
    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      socket.current?.close();
    };
  }, [code, name]);

  const send = useCallback((message: Outgoing) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }, []);
  return { state, connection, error, offset, send };
}

/** Milliseconds left on the room's clock, ticking a few times a second. */
export function useRemaining(endsAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [endsAt]);
  return endsAt === null ? null : Math.max(0, endsAt - (now + offset));
}

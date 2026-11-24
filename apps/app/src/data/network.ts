import * as Network from "expo-network";
import { useSyncExternalStore } from "react";

let online = true;
let initialized = false;
const listeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();

function evaluate(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

function update(next: boolean) {
  if (next === online) return;
  const wasOffline = !online;
  online = next;
  for (const listener of listeners) listener();
  if (wasOffline && next) {
    for (const listener of reconnectListeners) listener();
  }
}

function ensureStarted() {
  if (initialized) return;
  initialized = true;
  void Network.getNetworkStateAsync()
    .then((state) => update(evaluate(state)))
    .catch(() => {});
  Network.addNetworkStateListener((event) => {
    update(evaluate(event));
  });
}

export function isOnline(): boolean {
  ensureStarted();
  return online;
}

export function useOnline(): boolean {
  ensureStarted();
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => online,
    () => true,
  );
}

/** Subscribes to offline -> online transitions for immediate queue flushing & resync. */
export function onReconnect(listener: () => void): () => void {
  ensureStarted();
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

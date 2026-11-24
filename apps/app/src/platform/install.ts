import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

/**
 * Polyfills minimal Web Crypto globals used by the synced contract/domain code
 * (`crypto.randomUUID` and `crypto.getRandomValues`), and provides a small
 * synchronous in-memory storage mirror backed by AsyncStorage for lightweight
 * device settings (in-progress round, queued learning answers, theme, starredFirst).
 */
const g = globalThis as unknown as Record<string, unknown>;

const webCrypto = (g.crypto ??= {}) as Record<string, unknown>;
webCrypto.randomUUID ??= () => Crypto.randomUUID();
webCrypto.getRandomValues ??= <T extends ArrayBufferView>(array: T) =>
  Crypto.getRandomValues(array as unknown as Uint8Array) as unknown as T;

const PREFIX = "kv:";
const memory = new Map<string, string>();
let hydration: Promise<void> | null = null;

export function hydrateStorage(): Promise<void> {
  hydration ??= (async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    if (!keys.length) return;
    for (const [key, value] of await AsyncStorage.multiGet(keys)) {
      const bare = key.slice(PREFIX.length);
      if (value !== null && !memory.has(bare)) memory.set(bare, value);
    }
  })();
  return hydration;
}

export const syncStorage = {
  getItem(key: string): string | null {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    void AsyncStorage.setItem(PREFIX + key, value);
  },
  removeItem(key: string): void {
    memory.delete(key);
    void AsyncStorage.removeItem(PREFIX + key);
  },
};

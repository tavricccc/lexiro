import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultAiPreferences,
  mergeAiPreferences,
} from "@/src/lib/ai-preferences";
import {
  useAiPreferencesStore,
  flushAiPreferenceMutations,
} from "@/stores/ai-preferences-store";
import { setStorageNamespace } from "@/src/lib/persist";
import { loadSyncJournal, resetSyncJournalCache } from "@/src/lib/sync-journal";
import { createAiSession } from "@/src/lib/ai/session";
import {
  readCloudPreferences,
  writeCloudPreferences,
  watchCloudPreferences,
} from "@/src/lib/cloud-preferences";
import { estimatePoints, responseCost } from "@lexiro/ai-contract";
import type { Firestore } from "firebase/firestore";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { AiModelPreference } from "@/components/me/ai-model-preference";

const fixture = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  remote: null as Record<string, unknown> | null,
  callbacks: [] as Array<
    (snapshot: {
      exists: () => boolean;
      get: (key: string) => unknown;
      metadata: { hasPendingWrites: boolean };
    }) => void
  >,
  setDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => fixture.storage.get(key),
  set: async (key: string, value: string) => {
    fixture.storage.set(key, value);
  },
  del: async (key: string) => {
    fixture.storage.delete(key);
  },
}));
vi.mock("@/src/lib/cloud-sync", () => ({
  SYNC_ORIGIN_ID: "this-tab",
  cloudDocument: (_db: unknown, uid: string, collection: string, id: string) =>
    `users/${uid}/${collection}/${id}`,
  withDeadline: (operation: Promise<unknown>) => operation,
}));
vi.mock("firebase/firestore", () => ({
  getDoc: async () => ({
    exists: () => fixture.remote !== null,
    data: () => fixture.remote,
  }),
  setDoc: (...args: unknown[]) => fixture.setDoc(...args),
  onSnapshot: (_doc: unknown, callback: (typeof fixture.callbacks)[number]) => {
    fixture.callbacks.push(callback);
    return () => {};
  },
}));

const db = {} as Firestore;
afterEach(cleanup);
beforeEach(async () => {
  await flushAiPreferenceMutations();
  fixture.storage.clear();
  localStorage.clear();
  fixture.remote = null;
  fixture.callbacks = [];
  fixture.setDoc.mockClear();
  resetSyncJournalCache();
  setStorageNamespace("a");
  useAiPreferencesStore.setState({
    preferences: defaultAiPreferences(),
    loaded: false,
  });
  await useAiPreferencesStore.getState().hydrate();
});

describe("per-account AI model preference", () => {
  it("offers both model families in settings and saves the selected value", async () => {
    render(createElement(AiModelPreference));
    fireEvent.click(screen.getByRole("combobox", { name: "AI 模型" }));
    fireEvent.click(screen.getByRole("option", { name: "GPT-5.6 Luna" }));
    await vi.waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "AI 模型" }),
      ).toHaveTextContent("GPT-5.6 Luna"),
    );
    await vi.waitFor(() =>
      expect(useAiPreferencesStore.getState().preferences.model).toBe(
        "gpt-5.6-luna",
      ),
    );
    expect(screen.getByText("已儲存")).toBeInTheDocument();
  });
  it("persists selection, queues sync, and keeps an active AI session on its original model", async () => {
    await useAiPreferencesStore.getState().setModel("gpt-5.6-luna");
    const session = createAiSession("thinking", "test");
    expect((await loadSyncJournal()).blobs.preferences).toBeGreaterThan(0);
    await useAiPreferencesStore.getState().setModel("gpt-6-luna");
    expect(session.model).toBe("gpt-5.6-luna");
    expect(createAiSession("thinking", "test").model).toBe("gpt-6-luna");
    await useAiPreferencesStore.getState().reloadNamespace();
    expect(useAiPreferencesStore.getState().preferences.model).toBe(
      "gpt-6-luna",
    );
  });
  it("keeps two accounts' choices separate", async () => {
    await useAiPreferencesStore.getState().setModel("gpt-5.6-luna");
    setStorageNamespace("b");
    await useAiPreferencesStore.getState().reloadNamespace();
    expect(useAiPreferencesStore.getState().preferences.model).toBe(
      "gpt-6-luna",
    );
    setStorageNamespace("a");
    await useAiPreferencesStore.getState().reloadNamespace();
    expect(useAiPreferencesStore.getState().preferences.model).toBe(
      "gpt-5.6-luna",
    );
  });
  it("reads and applies another device's choice without re-queuing it, and writes only under its owner", async () => {
    fixture.remote = {
      schemaVersion: 1,
      model: "gpt-5.6-luna",
      updatedAt: "2026-10-02T01:00:00.000Z",
      ownerId: "a",
      changedBy: "other-tab",
    };
    const remote = await readCloudPreferences(db, "a");
    await useAiPreferencesStore.getState().applyRemote(remote!);
    expect(useAiPreferencesStore.getState().preferences.model).toBe(
      "gpt-5.6-luna",
    );
    expect((await loadSyncJournal()).blobs.preferences).toBe(0);
    await writeCloudPreferences(
      db,
      "a",
      useAiPreferencesStore.getState().preferences,
    );
    expect(fixture.setDoc).toHaveBeenCalledWith("users/a/preferences/ai", {
      ...fixture.remote,
      changedBy: "this-tab",
    });
    await expect(readCloudPreferences(db, "b")).rejects.toThrow("格式錯誤");
  });
  it("keeps a newer local edit when an older device syncs", () => {
    const local = {
      schemaVersion: 1 as const,
      model: "gpt-6-luna" as const,
      updatedAt: "2026-10-02T02:00:00.000Z",
    };
    expect(
      mergeAiPreferences(local, {
        ...local,
        model: "gpt-5.6-luna",
        updatedAt: "2026-10-02T01:00:00.000Z",
      }),
    ).toBe(local);
  });
  it("notifies an open device of a preference-only change and ignores its own writes", () => {
    const change = vi.fn();
    watchCloudPreferences(db, "a", change);
    const snapshot = (owner: string, stamp: string) => ({
      exists: () => true,
      metadata: { hasPendingWrites: false },
      get: (key: string) =>
        ({ model: "gpt-5.6-luna", updatedAt: stamp, changedBy: owner })[
          key as "model" | "updatedAt" | "changedBy"
        ],
    });
    fixture.callbacks[0](snapshot("other-tab", "before"));
    fixture.callbacks[0](snapshot("this-tab", "own"));
    fixture.callbacks[0](snapshot("other-tab", "after"));
    expect(change).toHaveBeenCalledOnce();
  });
  it("changes estimates and prices both families' long-context input and output", () => {
    expect(estimatePoints("organizeText", 1, "lite", "gpt-5.6-luna").max).toBe(
      12,
    );
    expect(estimatePoints("organizeText", 1, "lite", "gpt-6-luna").max).toBe(5);
    expect(
      responseCost({ model: "gpt-5.6-luna", input: 300_000, output: 100_000 }),
    ).toBeCloseTo(0.3);
    expect(
      responseCost({ model: "gpt-6-luna", input: 300_000, output: 100_000 }),
    ).toBeCloseTo(0.135);
  });
});

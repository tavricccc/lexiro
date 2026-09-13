import type { DocumentSnapshot, Firestore } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

let deliver: ((snapshot: DocumentSnapshot) => void) | null = null;

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    doc: () => ({}),
    onSnapshot: (
      _reference: unknown,
      next: (snapshot: DocumentSnapshot) => void,
    ) => {
      deliver = next;
      return () => {
        deliver = null;
      };
    },
  };
});

const { Timestamp } = await import("firebase/firestore");
const { SYNC_ORIGIN_ID, watchCloudChanges } = await import(
  "@/src/lib/cloud-sync"
);

interface MarkerOptions {
  seconds: number;
  changedBy?: string;
  pending?: boolean;
  exists?: boolean;
}

function marker({
  seconds,
  changedBy = "another-tab",
  pending = false,
  exists = true,
}: MarkerOptions): DocumentSnapshot {
  return {
    metadata: { hasPendingWrites: pending },
    exists: () => exists,
    get: (field: string) =>
      field === "changedAt" ? new Timestamp(seconds, 0) : changedBy,
  } as unknown as DocumentSnapshot;
}

describe("watchCloudChanges", () => {
  let onChange: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    deliver = null;
    onChange = vi.fn<() => void>();
    watchCloudChanges(null as unknown as Firestore, "uid", onChange);
  });

  it("stays quiet on the snapshot that only reports the marker it attached to", () => {
    deliver?.(marker({ seconds: 100 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("pulls once when another device moves the marker forward", () => {
    deliver?.(marker({ seconds: 100 }));
    deliver?.(marker({ seconds: 200 }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the cached and server copies of one marker both arrive", () => {
    deliver?.(marker({ seconds: 100 }));
    deliver?.(marker({ seconds: 100 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays quiet when the server confirms this tab's own push", () => {
    deliver?.(marker({ seconds: 100 }));
    deliver?.(marker({ seconds: 200, changedBy: SYNC_ORIGIN_ID, pending: true }));
    deliver?.(marker({ seconds: 200, changedBy: SYNC_ORIGIN_ID }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still pulls after its own push once another device writes", () => {
    deliver?.(marker({ seconds: 100 }));
    deliver?.(marker({ seconds: 200, changedBy: SYNC_ORIGIN_ID }));
    deliver?.(marker({ seconds: 300 }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("stays quiet before the account has a marker at all", () => {
    deliver?.(marker({ seconds: 0, exists: false }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

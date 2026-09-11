import { describe, expect, it } from "vitest";

import { CLOUD_SCHEMA_VERSION } from "@/constants";
import { resolveRemoteProgress } from "@/src/lib/cloud-sync-schema";
import { normalizeLearningProgress } from "@/src/lib/share";
import { asSenseId } from "@/src/lib/library";
import type { LearningProgress } from "@/types";

const UID = "user-1";

const local: LearningProgress = {
  cards: {
    [asSenseId("wander:v:1")]: {
      correctCount: 1,
      difficulty: 5,
      due: "2026-09-12T00:00:00.000Z",
      elapsedDays: 0,
      lapses: 0,
      learningSteps: 0,
      reps: 1,
      reviewCount: 1,
      scheduledDays: 1,
      stability: 1,
      state: 1,
    },
  },
  updatedAt: "2026-09-11T02:00:00.000Z",
};

describe("resolveRemoteProgress", () => {
  it("keeps local progress when the cloud has no progress document", () => {
    expect(resolveRemoteProgress(null, UID, local)).toBe(local);
  });

  it("never hands on a value the learning store would reject", () => {
    // The regression: a `{ cards: {}, updatedAt: "" }` stand-in for "no remote
    // copy" reached importState and failed validation as 缺少 learning.updatedAt,
    // which ended the whole sync.
    expect(() =>
      normalizeLearningProgress({ cards: {}, updatedAt: "" }),
    ).toThrow(/learning\.updatedAt/);
    expect(() =>
      normalizeLearningProgress(resolveRemoteProgress(null, UID, local)),
    ).not.toThrow();
  });

  it("reads the cloud copy when the document is there", () => {
    const resolved = resolveRemoteProgress(
      {
        cards: {},
        ownerId: UID,
        schemaVersion: CLOUD_SCHEMA_VERSION,
        updatedAt: "2026-09-11T03:00:00.000Z",
      },
      UID,
      local,
    );
    expect(resolved.updatedAt).toBe("2026-09-11T03:00:00.000Z");
    expect(resolved.cards).toEqual({});
  });
});

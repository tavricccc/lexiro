"use client";

import type {
  CardProgress,
  DashboardStats,
  LearningProgress,
  QuestionStatKey,
  QuestionStatType,
  ReviewRating,
  SenseId,
} from "@/types";
import { create } from "zustand";
import { createMutationQueue } from "@/src/lib/mutation-queue";
import { t } from "@/lib/i18n";
import { mergeBackupLearning } from "@/src/lib/learning-backup";
import { canonicalHash } from "@/src/lib/hash";

import { LEARNING_STORAGE_KEY } from "@/constants";
import { localDateKey } from "@/src/lib/date";
import { reviewCard } from "@/src/lib/fsrs";
import {
  addQuestionAttempt,
  createDefaultStats,
  emptyDailyActivity,
  emptyQuestionStats,
  questionStatRow,
  rollStatsToToday,
} from "@/src/lib/learning-defaults";
import { loadFromStorage, saveToStorage } from "@/src/lib/persist";
import { entriesOf } from "@/src/lib/record";
import {
  normalizeDashboardStats,
  normalizeLearningProgress,
} from "@/src/lib/share";
import { markBlobDirty } from "@/src/lib/sync-journal";

type LearningSnapshot = { progress: LearningProgress; stats: DashboardStats };

interface LearningStore {
  progress: LearningProgress;
  stats: DashboardStats;
  loaded: boolean;
  hydrate: () => Promise<void>;
  rateSense: (senseId: SenseId, rating: ReviewRating) => Promise<void>;
  recordQuestion: (
    senseId: SenseId,
    type: QuestionStatType,
    difficulty: 1 | 2 | 3,
    correct: boolean,
    retry?: boolean,
    rating?: ReviewRating,
  ) => Promise<void>;
  setGoals: (words: number, questions: number) => Promise<void>;
  importBackup: (
    progress: LearningProgress,
    stats: DashboardStats,
  ) => Promise<void>;
  applyRemoteState: (
    update: (current: LearningSnapshot) => LearningSnapshot | null,
  ) => Promise<LearningSnapshot | null>;
  reloadNamespace: () => Promise<void>;
  remapSenses: (
    remaps: Array<{ oldSenseId: SenseId; newSenseId: SenseId }>,
  ) => Promise<void>;
  pruneToSenseIds: (senseIds: Set<SenseId>) => Promise<void>;
}

const todayKey = () => localDateKey();
const initialProgress = (): LearningProgress => ({
  cards: {},
  updatedAt: new Date().toISOString(),
});

const statsForToday = (stats: DashboardStats) =>
  rollStatsToToday(stats, new Date());

const { serial, flush: flushLearningMutations } = createMutationQueue();
export { flushLearningMutations };

async function persist(
  progress: LearningProgress,
  stats: DashboardStats,
  markPending = true,
) {
  await saveToStorage(LEARNING_STORAGE_KEY, { version: 1, progress, stats });
  if (markPending) await markBlobDirty("progress", "stats");
}

export const useLearningStore = create<LearningStore>((set, get) => ({
  progress: initialProgress(),
  stats: createDefaultStats(),
  loaded: false,
  hydrate: async () => {
    if (get().loaded) return;
    const stored = await loadFromStorage(LEARNING_STORAGE_KEY);
    if (stored.value) {
      try {
        const value: unknown = JSON.parse(stored.value);
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          !("progress" in value) ||
          !("stats" in value) ||
          !("version" in value) ||
          value.version !== 1
        )
          throw new Error("invalid-learning-state");
        const record = value as {
          progress: unknown;
          stats: unknown;
          version: 1;
        };
        set({
          progress: normalizeLearningProgress(record.progress),
          stats: normalizeDashboardStats(record.stats),
          loaded: true,
        });
        return;
      } catch {
        throw new Error(t("common.learningDataUnreadable"));
      }
    }
    set({ loaded: true });
  },
  rateSense: serial(async (senseId, rating) => {
    const timestamp = new Date().toISOString();
    const base = statsForToday(get().stats);
    const card: CardProgress = reviewCard(
      get().progress.cards[senseId] ?? null,
      rating,
    );
    const progress = {
      cards: { ...get().progress.cards, [senseId]: card },
      updatedAt: timestamp,
    };
    const date = todayKey();
    const activity = {
      ...(base.dailyHistory[date] ?? emptyDailyActivity(date)),
    };
    if (rating === "again") activity.memoryAgain += 1;
    else activity.memoryGood += 1;
    const stats = {
      ...base,
      totalMemoryReviews: base.totalMemoryReviews + 1,
      correctMemoryReviews:
        base.correctMemoryReviews + (rating === "good" ? 1 : 0),
      todayMemoryReviews: base.todayMemoryReviews + 1,
      todayMemoryCorrectReviews:
        base.todayMemoryCorrectReviews + (rating === "good" ? 1 : 0),
      dailyHistory: { ...base.dailyHistory, [date]: activity },
      updatedAt: timestamp,
    };
    await persist(progress, stats);
    set({ progress, stats });
  }),
  recordQuestion: serial(
    async (senseId, type, difficulty, correct, retry = false, rating) => {
      const timestamp = new Date().toISOString();
      const base = statsForToday(get().stats);
      const key = `${type}:${difficulty}` as const;
      const senseStats =
        base.questionStatsBySense[senseId] ?? emptyQuestionStats();
      const date = todayKey();
      const activity = {
        ...(base.dailyHistory[date] ?? emptyDailyActivity(date)),
      };
      activity.questionTotal += 1;
      const wordAttempt = type === "meaning";
      if (wordAttempt) {
        if (correct) activity.memoryGood += 1;
        else activity.memoryAgain += 1;
      }
      const stats = {
        ...base,
        totalMemoryReviews: base.totalMemoryReviews + (wordAttempt ? 1 : 0),
        correctMemoryReviews:
          base.correctMemoryReviews + (wordAttempt && correct ? 1 : 0),
        todayMemoryReviews: base.todayMemoryReviews + (wordAttempt ? 1 : 0),
        todayMemoryCorrectReviews:
          base.todayMemoryCorrectReviews + (wordAttempt && correct ? 1 : 0),
        totalQuestionReviews: base.totalQuestionReviews + 1,
        correctQuestionReviews: base.correctQuestionReviews + (correct ? 1 : 0),
        todayQuestionReviews: base.todayQuestionReviews + 1,
        todayQuestionCorrectReviews:
          base.todayQuestionCorrectReviews + (correct ? 1 : 0),
        questionStatsBySense: {
          ...base.questionStatsBySense,
          [senseId]: addQuestionAttempt(senseStats, key, correct, retry),
        },
        dailyHistory: { ...base.dailyHistory, [date]: activity },
        updatedAt: timestamp,
      };
      const currentProgress = get().progress;
      const progress = rating
        ? {
            cards: {
              ...currentProgress.cards,
              [senseId]: reviewCard(
                currentProgress.cards[senseId] ?? null,
                rating,
              ),
            },
            updatedAt: timestamp,
          }
        : currentProgress;
      await persist(progress, stats);
      set({ progress, stats });
    },
  ),
  setGoals: serial(async (words, questions) => {
    const stats = {
      ...get().stats,
      dailyWordGoal: words,
      dailyQuestionGoal: questions,
      updatedAt: new Date().toISOString(),
    };
    await persist(get().progress, stats);
    set({ stats });
  }),
  importBackup: serial(async (incomingProgress, incomingStats) => {
    const { progress, stats } = mergeBackupLearning(
      get().progress,
      get().stats,
      incomingProgress,
      incomingStats,
    );
    await persist(progress, stats);
    set({ progress, stats, loaded: true });
  }),
  applyRemoteState: serial(async (update) => {
    const current = { progress: get().progress, stats: get().stats };
    const merged = update(current);
    if (!merged) return null;
    if (canonicalHash(merged) !== canonicalHash(current)) {
      await persist(merged.progress, merged.stats, false);
      set({ ...merged, loaded: true });
    }
    return merged;
  }),
  reloadNamespace: async () => {
    set({
      loaded: false,
      progress: initialProgress(),
      stats: createDefaultStats(),
    });
    await get().hydrate();
  },
  remapSenses: serial(async (remaps) => {
    const cards = { ...get().progress.cards };
    const bySense = { ...get().stats.questionStatsBySense };
    for (const remap of remaps) {
      const oldCard = cards[remap.oldSenseId];
      const newCard = cards[remap.newSenseId];
      if (oldCard) {
        cards[remap.newSenseId] =
          !newCard ||
          new Date(oldCard.lastReview ?? 0) >= new Date(newCard.lastReview ?? 0)
            ? oldCard
            : newCard;
        delete cards[remap.oldSenseId];
      }
      const oldStats = bySense[remap.oldSenseId];
      if (oldStats) {
        const current = bySense[remap.newSenseId];
        bySense[remap.newSenseId] = Object.fromEntries(
          (Object.keys(oldStats) as QuestionStatKey[]).map((key) => {
            const before = questionStatRow(current ?? {}, key);
            const incoming = questionStatRow(oldStats, key);
            return [
              key,
              {
                total: before.total + incoming.total,
                correct: before.correct + incoming.correct,
                retry: before.retry + incoming.retry,
              },
            ];
          }),
        );
        delete bySense[remap.oldSenseId];
      }
    }
    const progress = { cards, updatedAt: new Date().toISOString() };
    const stats = {
      ...get().stats,
      questionStatsBySense: bySense,
      updatedAt: new Date().toISOString(),
    };
    await persist(progress, stats);
    set({ progress, stats });
  }),
  pruneToSenseIds: serial(async (senseIds) => {
    const progress = {
      cards: Object.fromEntries(
        entriesOf(get().progress.cards).filter(([senseId]) =>
          senseIds.has(senseId),
        ),
      ),
      updatedAt: new Date().toISOString(),
    };
    const stats = {
      ...get().stats,
      questionStatsBySense: Object.fromEntries(
        entriesOf(get().stats.questionStatsBySense).filter(([senseId]) =>
          senseIds.has(senseId),
        ),
      ),
      updatedAt: new Date().toISOString(),
    };
    await persist(progress, stats);
    set({ progress, stats });
  }),
}));

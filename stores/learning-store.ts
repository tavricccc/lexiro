"use client";

import type { CardProgress, DashboardStats, LearningProgress, QuestionStatType, ReviewRating } from "@/types";
import { create } from "zustand";

import { LEARNING_STORAGE_KEY } from "@/constants";
import { localDateKey } from "@/src/lib/date";
import { reviewCard } from "@/src/lib/fsrs";
import { createDefaultStats, emptyDailyActivity, emptyQuestionStats } from "@/src/lib/learning-defaults";
import { loadFromStorage, saveToStorage } from "@/src/lib/persist";
import { normalizeDashboardStats, normalizeLearningProgress } from "@/src/lib/share";
import { markCloudSyncPending } from "@/src/lib/sync-pending";

interface LearningStore {
  progress: LearningProgress;
  stats: DashboardStats;
  loaded: boolean;
  hydrate: () => Promise<void>;
  rateSense: (senseId: string, rating: ReviewRating) => Promise<void>;
  scheduleSenseFromQuestion: (senseId: string, rating: ReviewRating) => Promise<void>;
  recordQuestion: (senseId: string, type: QuestionStatType, difficulty: 1 | 2 | 3, correct: boolean, retry?: boolean) => Promise<void>;
  setGoals: (words: number, questions: number) => Promise<void>;
  importState: (progress: LearningProgress, stats: DashboardStats, options?: { markPending?: boolean }) => Promise<void>;
  reloadNamespace: () => Promise<void>;
  remapSenses: (remaps: Array<{ oldSenseId: string; newSenseId: string }>) => Promise<void>;
  pruneToSenseIds: (senseIds: Set<string>) => Promise<void>;
}

const todayKey = () => localDateKey();
const initialProgress = (): LearningProgress => ({ cards: {}, updatedAt: new Date().toISOString() });

function statsForToday(stats: DashboardStats): DashboardStats {
  const today = todayKey();
  if (stats.lastStudyDate === today) return stats;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const streakDays = stats.lastStudyDate === localDateKey(yesterday) ? stats.streakDays + 1 : 1;
  return { ...stats, streakDays, longestStreak: Math.max(stats.longestStreak, streakDays), lastStudyDate: today, todayMemoryReviews: 0, todayMemoryCorrectReviews: 0, todayQuestionReviews: 0, todayQuestionCorrectReviews: 0 };
}

async function persist(progress: LearningProgress, stats: DashboardStats, markPending = true) {
  await saveToStorage(LEARNING_STORAGE_KEY, { version: 1, progress, stats });
  if (markPending) markCloudSyncPending();
}

export const useLearningStore = create<LearningStore>((set, get) => ({
  progress: initialProgress(), stats: createDefaultStats(), loaded: false,
  hydrate: async () => {
    if (get().loaded) return;
    const stored = await loadFromStorage(LEARNING_STORAGE_KEY);
    if (stored.value) {
      try {
        const value: unknown = JSON.parse(stored.value);
        if (!value || typeof value !== "object" || Array.isArray(value) || !("progress" in value) || !("stats" in value) || !("version" in value) || value.version !== 1) throw new Error("invalid-learning-state");
        const record = value as { progress: unknown; stats: unknown; version: 1 };
        set({ progress: normalizeLearningProgress(record.progress), stats: normalizeDashboardStats(record.stats), loaded: true });
        return;
      } catch { /* use defaults */ }
    }
    set({ loaded: true });
  },
  rateSense: async (senseId, rating) => {
    const timestamp = new Date().toISOString();
    const base = statsForToday(get().stats);
    const card: CardProgress = reviewCard(get().progress.cards[senseId] ?? null, rating);
    const progress = { cards: { ...get().progress.cards, [senseId]: card }, updatedAt: timestamp };
    const date = todayKey();
    const activity = { ...(base.dailyHistory[date] ?? emptyDailyActivity(date)) };
    if (rating === "again") activity.memoryAgain += 1; else activity.memoryGood += 1;
    activity.xpEarned += rating === "good" ? 5 : 2;
    const stats = { ...base, totalMemoryReviews: base.totalMemoryReviews + 1, correctMemoryReviews: base.correctMemoryReviews + (rating === "good" ? 1 : 0), todayMemoryReviews: base.todayMemoryReviews + 1, todayMemoryCorrectReviews: base.todayMemoryCorrectReviews + (rating === "good" ? 1 : 0), xp: base.xp + (rating === "good" ? 5 : 2), dailyHistory: { ...base.dailyHistory, [date]: activity }, updatedAt: timestamp };
    activity.completed = stats.todayMemoryReviews >= stats.dailyWordGoal && stats.todayQuestionReviews >= stats.dailyQuestionGoal;
    stats.level = Math.floor(stats.xp / 100) + 1;
    set({ progress, stats }); await persist(progress, stats);
  },
  scheduleSenseFromQuestion: async (senseId, rating) => {
    const progress = { cards: { ...get().progress.cards, [senseId]: reviewCard(get().progress.cards[senseId] ?? null, rating) }, updatedAt: new Date().toISOString() };
    set({ progress });
    await persist(progress, get().stats);
  },
  recordQuestion: async (senseId, type, difficulty, correct, retry = false) => {
    const timestamp = new Date().toISOString();
    const base = statsForToday(get().stats);
    const key = `${type}:${difficulty}` as const;
    const current = base.questionStats[key];
    const senseStats = base.questionStatsBySense[senseId] ?? emptyQuestionStats();
    const date = todayKey(); const activity = { ...(base.dailyHistory[date] ?? emptyDailyActivity(date)), questionStats: { ...(base.dailyHistory[date]?.questionStats ?? emptyQuestionStats()) } };
    activity.questionTotal += 1; activity.questionCorrect += correct ? 1 : 0; activity.questionRetry += retry ? 1 : 0; activity.xpEarned += correct ? 10 : 3;
    activity.questionStats[key] = { total: activity.questionStats[key].total + 1, correct: activity.questionStats[key].correct + (correct ? 1 : 0), retry: activity.questionStats[key].retry + (retry ? 1 : 0) };
    const nextRow = { total: current.total + 1, correct: current.correct + (correct ? 1 : 0), retry: current.retry + (retry ? 1 : 0) };
    const stats = { ...base, totalQuestionReviews: base.totalQuestionReviews + 1, correctQuestionReviews: base.correctQuestionReviews + (correct ? 1 : 0), todayQuestionReviews: base.todayQuestionReviews + 1, todayQuestionCorrectReviews: base.todayQuestionCorrectReviews + (correct ? 1 : 0), xp: base.xp + (correct ? 10 : 3), questionStats: { ...base.questionStats, [key]: nextRow }, questionStatsBySense: { ...base.questionStatsBySense, [senseId]: { ...senseStats, [key]: { total: (senseStats[key]?.total ?? 0) + 1, correct: (senseStats[key]?.correct ?? 0) + (correct ? 1 : 0), retry: (senseStats[key]?.retry ?? 0) + (retry ? 1 : 0) } } }, dailyHistory: { ...base.dailyHistory, [date]: activity }, updatedAt: timestamp };
    activity.completed = stats.todayMemoryReviews >= stats.dailyWordGoal && stats.todayQuestionReviews >= stats.dailyQuestionGoal;
    stats.level = Math.floor(stats.xp / 100) + 1;
    set({ stats }); await persist(get().progress, stats);
  },
  setGoals: async (words, questions) => { const stats = { ...get().stats, dailyWordGoal: words, dailyQuestionGoal: questions, updatedAt: new Date().toISOString() }; set({ stats }); await persist(get().progress, stats); },
  importState: async (progress, stats, options) => { set({ progress, stats, loaded: true }); await persist(progress, stats, options?.markPending ?? true); },
  reloadNamespace: async () => { set({ loaded: false, progress: initialProgress(), stats: createDefaultStats() }); await get().hydrate(); },
  remapSenses: async (remaps) => {
    const cards = { ...get().progress.cards }; const bySense = { ...get().stats.questionStatsBySense };
    for (const remap of remaps) {
      const oldCard = cards[remap.oldSenseId];
      const newCard = cards[remap.newSenseId];
      if (oldCard) {
        cards[remap.newSenseId] = !newCard || new Date(oldCard.lastReview ?? 0) >= new Date(newCard.lastReview ?? 0) ? oldCard : newCard;
        delete cards[remap.oldSenseId];
      }
      const oldStats = bySense[remap.oldSenseId];
      if (oldStats) {
        const current = bySense[remap.newSenseId];
        bySense[remap.newSenseId] = Object.fromEntries(Object.keys(oldStats).map((key) => {
          const typedKey = key as keyof typeof oldStats;
          const before = current?.[typedKey] ?? { total: 0, correct: 0, retry: 0 };
          const incoming = oldStats[typedKey];
          return [typedKey, { total: before.total + incoming.total, correct: before.correct + incoming.correct, retry: before.retry + incoming.retry }];
        })) as typeof oldStats;
        delete bySense[remap.oldSenseId];
      }
    }
    const progress = { cards, updatedAt: new Date().toISOString() }; const stats = { ...get().stats, questionStatsBySense: bySense, updatedAt: new Date().toISOString() }; set({ progress, stats }); await persist(progress, stats);
  },
  pruneToSenseIds: async (senseIds) => {
    const progress = { cards: Object.fromEntries(Object.entries(get().progress.cards).filter(([senseId]) => senseIds.has(senseId))), updatedAt: new Date().toISOString() };
    const stats = { ...get().stats, questionStatsBySense: Object.fromEntries(Object.entries(get().stats.questionStatsBySense).filter(([senseId]) => senseIds.has(senseId))), updatedAt: new Date().toISOString() };
    set({ progress, stats });
    await persist(progress, stats);
  },
}));

import type { PracticeItem } from "./practice";

/** What every player sees of a question; the answer stays with the host's room. */
export interface LiveQuestion {
  type: "meaning" | "reverse" | "vocabulary" | "cloze" | "wordBank" | "discourse" | "reading";
  prompt: string;
  options: string[];
  blank?: number;
  passage?: { id: string; title: string; text: string };
  sharedBank?: boolean;
}

export interface RoomQuestion {
  display: LiveQuestion;
  answerIndex: number;
  explanation?: string;
}

export const MAX_ROOM_QUESTIONS = 50;

/** A practice round flattened into one room question per step. */
export function roomQuestions(items: PracticeItem[]): RoomQuestion[] {
  return items.flatMap((item) =>
    item.steps.map((step): RoomQuestion => {
      const base = { answerIndex: step.answer, ...(step.explanation ? { explanation: step.explanation.slice(0, 4000) } : {}) };
      if (item.kind === "meaning") return { ...base, display: { type: "meaning", prompt: item.word, options: step.options } };
      if (item.kind === "reverse") return { ...base, display: { type: "reverse", prompt: item.sense.meaning, options: step.options } };
      if (!("passage" in item)) return { ...base, display: { type: "vocabulary", prompt: step.prompt, options: step.options } };
      return {
        ...base,
        display: {
          type: item.kind,
          prompt: step.prompt,
          options: step.options,
          ...(step.blank ? { blank: step.blank } : {}),
          passage: { id: item.questionId, title: item.title ?? "", text: item.passage },
          ...(item.kind === "wordBank" ? { sharedBank: true } : {}),
        },
      };
    }),
  ).slice(0, MAX_ROOM_QUESTIONS);
}

export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

/** One player's view of the room, as the server sends it. */
export interface RoomState {
  type: "state";
  serverNow: number;
  code: string;
  title: string;
  hostUid: string;
  you: string;
  phase: "lobby" | "question" | "reveal" | "ended";
  index: number;
  total: number;
  endsAt: number | null;
  duration: number | null;
  players: RoomPlayer[];
  question: LiveQuestion | null;
  yourChoice: number | null;
  revealedBlanks: Record<number, string>;
  reveal: { answerIndex: number; accepted: number[]; explanation: string | null; gained: Record<string, number>; choices: Record<string, number> } | null;
  review: { items: ReviewItem[]; passages: Record<string, { title: string; text: string }> } | null;
}
export interface RoomPlayer { uid: string; name: string; score: number; connected: boolean; answered: boolean }
export interface ReviewItem {
  index: number;
  question: Omit<LiveQuestion, "passage"> & { passageId: string | null };
  choice: number | null;
  accepted: number[];
  explanation: string | null;
}

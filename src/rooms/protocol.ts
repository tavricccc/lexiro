import { z } from "zod";

export const MAX_PLAYERS = 8;
export const MAX_QUESTIONS = 50;
export const REVEAL_MS = 5_000;
export const TICKET_TTL_MS = 60_000;
/** A finished or abandoned room is kept briefly so late reconnects see the result. */
export const ROOM_TTL_MS = 2 * 60 * 60_000;

const text = (max: number) => z.string().max(max);
const task = z.enum(["meaning", "vocabulary", "cloze", "wordBank", "discourse", "reading"]);

/** What players see. It never carries the answer. */
export const liveQuestion = z.strictObject({
  type: task,
  prompt: text(2000),
  options: z.array(text(500)).min(2).max(10),
  blank: z.number().int().positive().max(99).optional(),
  passage: z
    .strictObject({ id: text(200), title: text(300), text: text(20_000) })
    .optional(),
  sharedBank: z.boolean().optional(),
});
export type LiveQuestion = z.infer<typeof liveQuestion>;

export const createRoomInput = z.strictObject({
  name: text(40).min(1),
  title: text(120).min(1),
  questions: z
    .array(
      z.strictObject({
        display: liveQuestion,
        answerIndex: z.number().int().nonnegative(),
        /** Every option that counts as right; a meaning can match more than one. */
        accepted: z.array(z.number().int().nonnegative()).max(10).optional(),
        explanation: text(4000).optional(),
      }),
    )
    .min(1)
    .max(MAX_QUESTIONS)
    .refine(
      (items) =>
        items.every(
          (item) =>
            item.answerIndex < item.display.options.length &&
            (item.accepted ?? []).every((index) => index < item.display.options.length),
        ),
      "answer out of range",
    ),
});
export type CreateRoomInput = z.infer<typeof createRoomInput>;

export const ticketInput = z.strictObject({ name: text(40).min(1) });

export const clientMessage = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("start") }),
  z.strictObject({ type: z.literal("end") }),
  z.strictObject({ type: z.literal("ping") }),
  z.strictObject({
    type: z.literal("answer"),
    index: z.number().int().nonnegative(),
    choice: z.number().int().nonnegative(),
  }),
]);
export type ClientMessage = z.infer<typeof clientMessage>;

/** Time allowed per question. A passage needs reading before the first answer. */
export function questionDuration(question: LiveQuestion): number {
  switch (question.type) {
    case "meaning":
      return 15_000;
    case "vocabulary":
    case "cloze":
      return 20_000;
    case "wordBank":
    case "discourse":
      return 30_000;
    case "reading":
      return 60_000;
  }
}

/** Kahoot-style: a correct answer earns 500 plus up to 500 more for speed. */
export function scoreFor(correct: boolean, remainingMs: number, durationMs: number) {
  if (!correct) return 0;
  const ratio = Math.max(0, Math.min(1, remainingMs / durationMs));
  return Math.round(500 + 500 * ratio);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}
export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function isAccepted(
  question: { answerIndex: number; accepted?: number[] },
  choice: number,
) {
  return choice === question.answerIndex || Boolean(question.accepted?.includes(choice));
}

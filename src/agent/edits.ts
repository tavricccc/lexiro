import { z } from "zod";
import { mutateAgentSet, type AgentSetSnapshot } from "@lexiro/agent-contract";
import { HttpError } from "../http";

const text = z.string().trim().min(1).max(10000);
const sensePatch = z.object({
  pos: text.optional(),
  meaningZh: text.optional(),
  examples: z.array(text).max(20).optional(),
  appendExamples: z.array(text).max(20).optional(),
  supplementary: z.boolean().optional(),
});
const fineMutation = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("edit_word"),
    wordKey: text,
    patch: z.object({ word: text }),
  }),
  z.object({
    type: z.literal("edit_sense"),
    wordKey: text,
    senseId: text.optional(),
    action: z.enum(["add", "update", "delete"]).default("update"),
    patch: sensePatch.optional(),
  }),
  z.object({
    type: z.literal("edit_question"),
    questionId: text,
    childId: text.optional(),
    patch: z.record(z.string(), z.unknown()),
  }),
]);
export function mutateAgentResource(
  snapshot: AgentSetSnapshot,
  input: unknown,
  blocked: string[],
) {
  if (
    !input ||
    typeof input !== "object" ||
    !("type" in input) ||
    !["edit_word", "edit_sense", "edit_question"].includes(String(input.type))
  )
    return mutateAgentSet(snapshot, input, blocked);
  const action = fineMutation.parse(input);
  if (action.type === "edit_question") {
    const question = snapshot.questions.find(
      (question) => question.id === action.questionId,
    );
    if (!question) throw new HttpError(404, "question_not_found");
    if (
      ["id", "fingerprint", "createdAt", "updatedAt"].some(
        (key) => key in action.patch,
      )
    )
      throw new HttpError(400, "identity_fields_are_immutable");
    if (!action.childId)
      return mutateAgentSet(
        snapshot,
        {
          type: "put_questions",
          mode: "atomic",
          questions: [{ ...question, ...action.patch }],
        },
        blocked,
      );
    if (
      question.kind !== "reading" ||
      !question.questions.some((child) => child.id === action.childId)
    )
      throw new HttpError(404, "child_not_found");
    return mutateAgentSet(
      snapshot,
      {
        type: "put_questions",
        mode: "atomic",
        questions: [
          {
            ...question,
            questions: question.questions.map((child) =>
              child.id === action.childId
                ? { ...child, ...action.patch }
                : child,
            ),
          },
        ],
      },
      blocked,
    );
  }
  const word = snapshot.words.find((word) => word.wordKey === action.wordKey);
  if (!word) throw new HttpError(404, "word_not_found");
  if (action.type === "edit_word")
    return mutateAgentSet(
      snapshot,
      { type: "put_words", words: [{ ...word, word: action.patch.word }] },
      blocked,
    );
  const old = word.senses.find((sense) => sense.id === action.senseId);
  if (action.action !== "add" && !old)
    throw new HttpError(404, "sense_not_found");
  if (action.action === "delete") {
    if (word.senses.length === 1)
      throw new HttpError(400, "delete_word_to_remove_last_sense");
    return mutateAgentSet(
      snapshot,
      {
        type: "put_words",
        words: [
          { ...word, senses: word.senses.filter((sense) => sense !== old) },
        ],
      },
      blocked,
    );
  }
  const patch = action.patch ?? {};
  if (action.action === "add" && (!patch.pos || !patch.meaningZh))
    throw new HttpError(400, "new_sense_requires_pos_and_meaningZh");
  if (!Object.keys(patch).length) throw new HttpError(400, "empty_patch");
  const { appendExamples, ...changes } = patch;
  const examples = [
    ...new Set([
      ...(patch.examples ?? old?.examples ?? []),
      ...(appendExamples ?? []),
    ]),
  ];
  const next = { ...old, ...changes, examples };
  const senses =
    action.action === "add"
      ? [...word.senses, next]
      : word.senses.map((sense) => (sense === old ? next : sense));
  return mutateAgentSet(
    snapshot,
    { type: "put_words", words: [{ ...word, senses }] },
    blocked,
  );
}

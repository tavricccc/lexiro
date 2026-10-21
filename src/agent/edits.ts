import { z } from "zod";
import { mutateAgentSet, type AgentSetSnapshot } from "@lexiro/agent-contract";
import { httpError } from "../http";

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
    if (!question)
      throw httpError(
        404,
        "question_not_found",
        `questionId ${action.questionId} is not in this set; get ids from read questions`,
      );
    const immutable = ["id", "fingerprint", "createdAt", "updatedAt"].filter(
      (key) => key in action.patch,
    );
    if (immutable.length)
      throw httpError(
        400,
        "identity_fields_are_immutable",
        `patch cannot contain ${immutable.join(", ")}; the system maintains these fields`,
      );
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
      throw httpError(
        404,
        "child_not_found",
        question.kind === "reading"
          ? `childId ${action.childId} is not in question ${question.id}; available: ${question.questions.map((child) => child.id).join(", ")}`
          : `Question ${question.id} is not a passage and has no children; omit childId`,
      );
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
  if (!word)
    throw httpError(
      404,
      "word_not_found",
      `wordKey ${action.wordKey} is not in this set; get wordKey from read words`,
    );
  if (action.type === "edit_word")
    return mutateAgentSet(
      snapshot,
      { type: "put_words", words: [{ ...word, word: action.patch.word }] },
      blocked,
    );
  const old = word.senses.find((sense) => sense.id === action.senseId);
  if (action.action !== "add" && !old)
    throw httpError(
      404,
      "sense_not_found",
      action.senseId
        ? `senseId ${action.senseId} is not a sense of "${word.word}"; available: ${word.senses.map((sense) => `${sense.id} (${sense.pos} ${sense.meaningZh})`).join(", ")}`
        : `action "${action.action}" needs senseId; available: ${word.senses.map((sense) => `${sense.id} (${sense.pos} ${sense.meaningZh})`).join(", ")}`,
    );
  if (action.action === "delete") {
    if (word.senses.length === 1)
      throw httpError(
        400,
        "delete_word_to_remove_last_sense",
        `"${word.word}" has only this sense; use delete_words to remove the whole word`,
      );
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
    throw httpError(
      400,
      "new_sense_requires_pos_and_meaningZh",
      `A new sense needs ${["pos", "meaningZh"].filter((key) => !patch[key as "pos" | "meaningZh"]).join(" and ")} in patch`,
    );
  if (!Object.keys(patch).length)
    throw httpError(400, "empty_patch", "patch has no fields to change");
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

import { z } from "zod";
import { AI_MODELS } from "@lexiro/ai-contract";

const goal = z.number().int().min(1).max(100).optional();
const goals = z
  .object({ dailyWordGoal: goal, dailyQuestionGoal: goal })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
const model = z.object({ model: z.enum(AI_MODELS) }).strict();
export type GoalPatch = z.infer<typeof goals>;
export type ModelPatch = z.infer<typeof model>;

export function parseGoalPatch(value: unknown): GoalPatch | null {
  const result = goals.safeParse(value);
  return result.success ? result.data : null;
}
export function parseModelPatch(value: unknown): ModelPatch | null {
  const result = model.safeParse(value);
  return result.success ? result.data : null;
}

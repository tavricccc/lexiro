/** Types of the frozen legacy generation bundle, limited to what generation.ts uses. */
export interface LegacySense { id: string; pos: string; meaningZh: string; examples: string[]; supplementary: boolean; description?: string }
export interface LegacyWord { wordKey: string; word: string; starred?: boolean; updatedAt: string; senses: LegacySense[] }
export interface LegacySnapshot {
  set: { id: string; setName: string; folderId: string; createdAt: string; updatedAt: string };
  words: LegacyWord[];
  memberships: { wordKey: string; senseIds: string[] }[];
  questions: unknown[];
}
export interface LegacyChild { id: string; blank?: number; prompt: string; options: string[]; answerIndex: number; wordKey: string; senseId: string; explanation?: string; whyWrong?: Record<string, string> }
export type LegacyQuestion =
  | { kind: "multipleChoice"; id: string; difficulty: 1 | 2 | 3; prompt: string; options: string[]; answerIndex: number; wordKey: string; senseId: string; explanation?: string; whyWrong?: Record<string, string> }
  | { kind: "reading"; id: string; difficulty: 1 | 2 | 3; format: "reading" | "cloze" | "wordBank" | "discourse"; title: string; passage: string; questions: LegacyChild[]; optionBank?: string[]; explanation?: string };
export interface LegacyReport {
  status: "success" | "partial_success" | "rejected";
  submittedCount: number; validCount: number; savedCount: number; failedCount: number;
  errors: { itemId: string; sourceIndex: number; sourceId?: string; sourceWord?: string; code: string; field: string; message: string }[];
  warnings: { itemId: string; sourceIndex: number; code: string; field: string; message: string }[];
  usedSenseIds: string[]; unusedSenseIds: string[];
  [key: string]: unknown;
}
type Kind = "vocabulary" | "cloze" | "wordBank" | "discourse" | "reading";
export function collectAgentGeneratedQuestions(snapshot: LegacySnapshot, kind: Kind, difficulty: 1 | 2 | 3, senseIds: string[] | undefined, output: unknown, mode: "atomic" | "partial"): { questions: LegacyQuestion[]; report: LegacyReport };
export function agentGenerationBrief(snapshot: LegacySnapshot, kind: Kind, difficulty: 1 | 2 | 3, senseIds?: string[]): { kind: Kind; difficulty: number; sources: unknown[]; instructions: string; outputSchema: unknown };
export function createAgentSet(setId: string, setName: string): LegacySnapshot;

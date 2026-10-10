import type {
  LibrarySet,
  WordEntry,
  SetMembership,
  LibraryQuestion,
  GeneratedQuestionKind,
  QuestionDifficulty,
} from "../../../src/types/library";
export type {
  LibrarySet,
  WordEntry,
  SetMembership,
  LibraryQuestion,
  GeneratedQuestionKind,
  QuestionDifficulty,
} from "../../../src/types/library";
export interface AgentSetSnapshot {
  set: LibrarySet;
  words: WordEntry[];
  memberships: SetMembership[];
  questions: LibraryQuestion[];
}
export interface AgentWordInput {
  wordKey?: string;
  word: string;
  senses: {
    id?: string;
    pos: string;
    meaningZh: string;
    examples: string[];
    supplementary?: boolean;
  }[];
}
export type AgentMutation =
  | { type: "rename_set"; setName: string }
  | { type: "put_words"; words: AgentWordInput[] }
  | { type: "delete_words"; wordKeys: string[] }
  | { type: "put_questions"; questions: unknown[] }
  | { type: "delete_questions"; questionIds: string[] }
  | {
      type: "generated_questions";
      kind: GeneratedQuestionKind;
      difficulty: QuestionDifficulty;
      senseIds: string[];
      output: unknown;
    }
  | { type: "delete_set" };
export interface AgentMutationResult {
  snapshot: AgentSetSnapshot | null;
  senseRemaps: { from: string; to: string }[];
}
export declare const AGENT_CONTRACT_VERSION: 1;
export declare function createAgentSet(
  setId: string,
  setName: string,
  folderId?: string,
): AgentSetSnapshot;
export declare function validateAgentSnapshot(
  value: unknown,
  setId: string,
): AgentSetSnapshot;
export declare function mutateAgentSet(
  snapshot: AgentSetSnapshot,
  value: unknown,
): AgentMutationResult;
export declare function agentSetRevision(
  snapshot: AgentSetSnapshot | null,
): string;
export declare function agentRecordId(kind: string, id: string): string;
export declare function agentGenerationBrief(
  snapshot: AgentSetSnapshot,
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
  senseIds?: string[],
): {
  kind: GeneratedQuestionKind;
  difficulty: QuestionDifficulty;
  sources: {
    ref: string;
    word: string;
    pos: string;
    meaningZh: string;
    senseId: string;
    knownExample?: string;
  }[];
  instructions: string;
};

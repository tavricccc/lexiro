import { z } from "zod";
import {
  agentSetRevision,
  createAgentSet,
  validateAgentGeneratedQuestions,
  type GeneratedQuestionKind,
  type QuestionDifficulty,
} from "@lexiro/agent-contract";
import { HttpError } from "../http";
import { querySchema, project, type AgentQuery } from "./query";
import { mutateAgentResource } from "./edits";
import type { AgentIdentity, AgentLibraryRepository } from "./types";
export const mutationEnvelope = z.strictObject({
  expectedRevision: z.string().regex(/^[a-f0-9]{32}$/),
  operationId: z.string().uuid(),
  action: z.unknown(),
});
const mcpMutationEnvelope = mutationEnvelope.extend({
  expectedRevision: mutationEnvelope.shape.expectedRevision.optional(),
  operationId: mutationEnvelope.shape.operationId.default(() =>
    crypto.randomUUID(),
  ),
});
export function scopedSet(identity: AgentIdentity, setId: string) {
  if (identity.setId && identity.setId !== setId)
    throw new HttpError(403, "set_outside_scope");
  return setId;
}
export async function readAgentResource(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  value: unknown,
) {
  const query = querySchema.parse(value);
  if (identity.setId)
    query.setId = scopedSet(identity, query.setId ?? identity.setId);
  const result = await repo.query(identity.uid, query);
  return ["set", "prompt", "brief"].includes(query.resource) && query.fields
    ? (project(result, query.fields) as Record<string, unknown>)
    : result;
}
export const batchQuerySchema = z.object({
  requests: z.array(z.record(z.string(), z.unknown())).min(1).max(10),
  maxCharacters: z.number().int().min(2000).max(128000).default(32000),
});
function batchResponse(
  results: Record<string, unknown>[],
  maxCharacters: number,
) {
  const response = { results, characters: 0, maxCharacters };
  for (let i = 0; i < 3; i++)
    response.characters = JSON.stringify(response).length;
  return response;
}
export async function readAgentBatch(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  value: unknown,
) {
  const { requests, maxCharacters } = batchQuerySchema.parse(value),
    results: Record<string, unknown>[] = [];
  const seen = new Map<string, number>();
  let itemCount = 0;
  for (let index = 0; index < requests.length; index++) {
    try {
      const key = JSON.stringify(requests[index]);
      if (seen.has(key)) {
        results.push({ index, reference: seen.get(key) });
        continue;
      }
      const data = await readAgentResource(repo, identity, requests[index]);
      const entry = { index, resource: requests[index].resource, data },
        size = JSON.stringify(entry).length;
      const count = Array.isArray(data.items)
        ? data.items.length
        : typeof data.sourceCount === "number"
          ? data.sourceCount
          : 1;
      if (
        batchResponse([...results, entry], maxCharacters).characters +
          (requests.length - index - 1) * 200 >
          maxCharacters ||
        itemCount + count > 200
      ) {
        results.push({
          index,
          error: {
            code: "response_budget_exceeded",
            requiredCharacters: size,
            message:
              "縮小範圍、改 summary 或只指定需要的 fields；完整提示詞不會被截斷。",
          },
        });
      } else {
        results.push(entry);
        itemCount += count;
        seen.set(key, index);
      }
    } catch (reason) {
      const message =
        reason instanceof z.ZodError
          ? reason.issues[0]?.message
          : reason instanceof Error
            ? reason.message
            : "查詢失敗";
      results.push({
        index,
        error: {
          code: reason instanceof HttpError ? reason.code : "invalid_query",
          message: message?.slice(0, 80),
        },
      });
    }
  }
  return batchResponse(results, maxCharacters);
}
export async function validateGeneratedQuestions(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  setId: string,
  value: Parameters<typeof validateAgentGeneratedQuestions>[1],
) {
  const { snapshot, revision } = await readAgentSet(repo, identity, setId);
  return {
    ...validateAgentGeneratedQuestions(snapshot, value),
    revision,
    dryRun: true,
  };
}
export async function readAgentSet(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  setId: string,
) {
  const snapshot = await repo.read(identity.uid, scopedSet(identity, setId));
  if (!snapshot) throw new HttpError(404, "set_not_found");
  return { snapshot, revision: agentSetRevision(snapshot) };
}
export async function applyAgentMutation(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  setId: string,
  value: unknown,
  transport: "url" | "mcp" = "url",
) {
  const input = (
    transport === "mcp" ? mcpMutationEnvelope : mutationEnvelope
  ).parse(value);
  return repo.mutate(
    identity.uid,
    scopedSet(identity, setId),
    input.expectedRevision,
    input.operationId,
    input.action,
    (snapshot, blockedQuestionIds) => {
      try {
        return mutateAgentResource(snapshot, input.action, blockedQuestionIds);
      } catch (reason) {
        if (reason instanceof HttpError) throw reason;
        const error = new HttpError(400, "invalid_content");
        error.message =
          reason instanceof Error ? reason.message : "內容格式錯誤";
        throw error;
      }
    },
  );
}
export async function createScopedSet(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  setName: string,
  folderId?: string,
) {
  const id = identity.setId ?? crypto.randomUUID();
  const snapshot = createAgentSet(id, setName, folderId);
  await repo.create(identity.uid, snapshot);
  return {
    set: snapshot.set,
    revision: agentSetRevision(snapshot),
    wordCount: 0,
    senseCount: 0,
    questionCount: 0,
  };
}
export async function readGenerationBrief(
  repo: AgentLibraryRepository,
  identity: AgentIdentity,
  setId: string,
  kind: GeneratedQuestionKind,
  difficulty: QuestionDifficulty,
  senseIds?: string[],
  options: Partial<AgentQuery> = {},
) {
  return readAgentResource(repo, identity, {
    ...options,
    resource: "brief",
    setId,
    kind,
    difficulty,
    senseIds,
  });
}

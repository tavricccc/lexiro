import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { SUPPORTED_PARTS_OF_SPEECH } from "@lexiro/agent-contract";
import { AGENT_INSTRUCTIONS } from "./instructions";
import {
  applyAgentMutation,
  createScopedSet,
  validateGeneratedQuestions,
  readAgentBatch,
} from "./operations";
import { compactReceipt, projectReceipt, querySchema } from "./query";
import type { AgentIdentity, AgentLibraryRepository } from "./types";
import { HttpError, issueText } from "../http";
import type { AgentFolderMutation } from "@lexiro/agent-contract";
const kind = z.enum([
  "vocabulary",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
]);
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const level = z.number().int().min(1).max(3);
const writeTypes = [
  "put_words",
  "edit_word",
  "edit_sense",
  "generated_questions",
  "put_questions",
  "edit_question",
  "rename_set",
  "move_set",
  "create_folder",
  "update_folder",
] as const;
const deleteTypes = [
  "delete_words",
  "delete_questions",
  "delete_set",
  "delete_folder",
] as const;
const folderTypes = ["create_folder", "update_folder", "delete_folder"];
const writeFields = (types: readonly [string, ...string[]]) => ({
  setId: z.string().optional().describe("Required except for folder actions"),
  action: z.object({ type: z.enum(types) }).passthrough(),
  expectedRevision: z
    .string()
    .optional()
    .describe(
      "Optional. If given it must equal the set's current revision, otherwise stale_set and nothing is written",
    ),
  operationId: z
    .string()
    .optional()
    .describe("Reuse the same UUID when resending"),
  responseFields: z
    .array(z.string())
    .max(20)
    .optional()
    .describe(
      "Return only these receipt fields; operationId, revision and status are always included",
    ),
});
// MCP-facing shapes stay lean so tools/list is small; lengths and formats are
// enforced by querySchema and the contract. Strict read requests make a
// misspelled key fail with its name.
export const readRequest = z.strictObject({
  resource: querySchema.shape.resource.describe(
    "sets/folders lists; set summary; words, questions lists; word(wordKey), question(questionId,childId?) single items; prompt(kind) generation rules and outputSchema; brief(setId,kind,difficulty) generation sources; sources; operation, diagnostics(operationId)",
  ),
  setId: z.string().optional(),
  wordKey: z.string().optional(),
  questionId: z.string().optional(),
  childId: z.string().optional(),
  operationId: z.string().optional(),
  folderId: z.string().optional(),
  q: z
    .string()
    .optional()
    .describe(
      "Substring search: word spelling or Chinese meaning; question prompt (also with the answer filled in), passage, options, explanation",
    ),
  questionType: querySchema.shape.questionType,
  kind: kind.optional(),
  difficulty: level.optional(),
  wordKeys: z.array(z.string()).max(50).optional(),
  senseIds: z.array(z.string()).max(50).optional(),
  from: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based, inclusive; not with cursor"),
  to: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional().describe("Default 20"),
  cursor: z.string().optional().describe("nextCursor of the previous page"),
  view: z.enum(["summary", "detail"]).optional(),
  fields: z
    .array(z.string())
    .max(20)
    .optional()
    .describe("Stored-format fields, may be nested, e.g. senses.id"),
  includeExamples: z.boolean().optional(),
  includePassage: z.boolean().optional(),
  includePrompt: z.boolean().optional(),
  severity: z.enum(["error", "warning"]).optional(),
});
const READ = `Read data: up to 10 requests per call, each succeeds or fails on its own. Lists return 20 summaries by default in fixed ID order with nextCursor; use view:"detail" only for full content, or fields to pick what you need. Example: {requests:[{resource:"words",setId,q:"rescue",fields:["wordKey","word","senses.id"]},{resource:"prompt",kind:"vocabulary"},{resource:"brief",setId,kind:"vocabulary",difficulty:2,limit:16}]}`;
const WRITE = `Create or modify; returns a compact receipt with the new revision. action by type:
put_words{words:[{word,senses:[{pos,meaningZh,examples?}]}]} adds words; with wordKey it overwrites that word and replaces all its senses (questions on dropped senses are removed and listed in the receipt)
edit_word{wordKey,patch:{word}} changes spelling only
edit_sense{wordKey,senseId?,action:"add"|"update"|"delete",patch?:{pos?,meaningZh?,examples?,appendExamples?}}
pos must be one of: ${SUPPORTED_PARTS_OF_SPEECH.join(" ")} (write v. for vt./vi.)
generated_questions{kind,difficulty,output,senseIds?} output follows read prompt's outputSchema; bind each item with senseId (a brief ref equals its senseId)
put_questions{questions} complete stored questions (the format read returns); with id it overwrites
edit_question{questionId,childId?,patch} only the fields to change, in stored format (prompt/options/answerIndex/explanation/whyWrong)
rename_set{setName}, move_set{folderId}, create_folder{name,parentId?}, update_folder{folderId,name?,parentId?}
Question actions accept mode:"partial" (default, saves valid items)|"atomic" (saves nothing on any error); at most 200 per batch.`;
const DELETE = `Delete, irreversible; confirm with the user first. action by type: delete_words{wordKeys} (also removes questions that use those words; the receipt lists them), delete_questions{questionIds}, delete_set (whole set), delete_folder{folderId} (empty folders only).`;
const VALIDATE = `Check generated questions without writing; same receipt as write generated_questions. output follows read {resource:"prompt",kind} outputSchema, which differs from the stored format.`;
export async function handleAgentMcp(
  request: Request,
  identity: AgentIdentity,
  repo: AgentLibraryRepository,
) {
  const server = new McpServer(
    { name: "Lexiro", version: "2.0.0" },
    { instructions: AGENT_INSTRUCTIONS },
  );
  const tool = (
    name: string,
    description: string,
    inputSchema: z.ZodRawShape,
    run: (args: Record<string, unknown>) => Promise<unknown>,
    readOnly = false,
    destructive = false,
  ) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: destructive,
          openWorldHint: false,
          idempotentHint: readOnly,
        },
      },
      async (args) => {
        try {
          const raw = await run(args);
          const actionType = (args.action as { type?: string } | undefined)
            ?.type;
          let result = raw;
          if (!readOnly && raw && typeof raw === "object") {
            const record = raw as Record<string, unknown>;
            if ("savedCount" in record || "operationId" in record)
              result = args.responseFields
                ? projectReceipt(
                    record,
                    args.responseFields as string[],
                    actionType,
                  )
                : compactReceipt(record, actionType);
            else if ("folders" in record) {
              const { folders: _folders, ...small } = record;
              result = small;
            }
          }
          if (readOnly && raw && typeof raw === "object" && "savedCount" in raw)
            result = args.responseFields
              ? projectReceipt(
                  raw as Record<string, unknown>,
                  args.responseFields as string[],
                  actionType,
                )
              : compactReceipt(raw as Record<string, unknown>, actionType);
          if (
            JSON.stringify(result).length > Number(args.maxCharacters ?? 32000)
          )
            result =
              raw && typeof raw === "object" && "operationId" in raw
                ? {
                    ...compactReceipt(
                      raw as Record<string, unknown>,
                      actionType,
                    ),
                    responseLimited: true,
                  }
                : {
                    status: "rejected",
                    error: {
                      code: "response_too_large",
                      message:
                        "Narrow the range, use summary, or request only the fields you need.",
                    },
                  };
          return {
            ...(result &&
            typeof result === "object" &&
            "status" in result &&
            result.status === "rejected"
              ? { isError: true }
              : {}),
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (reason) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: {
                    code:
                      reason instanceof HttpError
                        ? reason.code
                        : reason instanceof z.ZodError
                          ? "invalid_input"
                          : "invalid_content",
                    message: issueText(reason, "操作失敗"),
                  },
                }),
              },
            ],
          };
        }
      },
    );
  };
  const fail = (status: number, code: string, message: string) => {
    const error = new HttpError(status, code);
    error.message = message;
    return error;
  };
  const mutate = (
    args: Record<string, unknown>,
    allowed: readonly string[],
  ) => {
    const act = args.action as { type: string };
    if (!allowed.includes(act?.type))
      throw fail(
        400,
        "unsupported_action",
        `action.type 可用：${allowed.join("|")}`,
      );
    if (folderTypes.includes(act.type)) {
      if (identity.setId)
        throw fail(403, "folder_outside_scope", "此授權只限單一單字集");
      return repo.mutateFolders(
        identity.uid,
        args.expectedRevision as string | undefined,
        (args.operationId as string | undefined) ?? crypto.randomUUID(),
        act as unknown as AgentFolderMutation,
      );
    }
    const setId = (args.setId as string | undefined) ?? identity.setId;
    if (!setId) throw fail(400, "set_id_required", "此操作需要 setId");
    return applyAgentMutation(
      repo,
      identity,
      setId,
      {
        expectedRevision: args.expectedRevision,
        operationId: args.operationId,
        action: act,
      },
      "mcp",
    );
  };
  tool(
    "read",
    READ,
    {
      requests: z.array(readRequest).min(1).max(10),
      maxCharacters: z
        .number()
        .int()
        .min(2000)
        .max(128000)
        .optional()
        .describe("Default 32000"),
    },
    (args) => readAgentBatch(repo, identity, args),
    true,
  );
  tool(
    "create_set",
    "Create an empty vocabulary set; returns set.id and revision. Add content with write.",
    { name: z.string(), folderId: z.string().optional() },
    (args) =>
      createScopedSet(
        repo,
        identity,
        String(args.name),
        args.folderId as string | undefined,
      ),
  );
  tool("write", WRITE, writeFields(writeTypes), (args) =>
    mutate(args, writeTypes),
  );
  tool(
    "validate",
    VALIDATE,
    {
      setId: z.string(),
      kind,
      difficulty: level.default(2),
      senseIds: z.array(z.string()).optional(),
      output: z.record(z.string(), z.unknown()),
    },
    (args) =>
      validateGeneratedQuestions(repo, identity, String(args.setId), {
        kind: kind.parse(args.kind),
        difficulty: difficulty.parse(args.difficulty),
        senseIds: args.senseIds as string[] | undefined,
        output: args.output,
        mode: "partial",
      }),
    true,
  );
  tool(
    "delete",
    DELETE,
    writeFields(deleteTypes),
    (args) => mutate(args, deleteTypes),
    false,
    true,
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 1000000,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return response;
}

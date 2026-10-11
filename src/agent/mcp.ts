import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AGENT_INSTRUCTIONS } from "./instructions";
import {
  applyAgentMutation,
  createScopedSet,
  validateGeneratedQuestions,
  readAgentBatch,
  batchQuerySchema,
} from "./operations";
import { compactReceipt, project } from "./query";
import type { AgentIdentity, AgentLibraryRepository } from "./types";
import { HttpError } from "../http";
import type { AgentFolderMutation } from "@lexiro/agent-contract";
const kind = z.enum([
  "vocabulary",
  "cloze",
  "wordBank",
  "discourse",
  "reading",
]);
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const text = z.string().min(1);
const action = z.object({ type: z.string() }).passthrough();
const writeFields = {
  setId: z.string().optional(),
  expectedRevision: z.string().optional(),
  operationId: z.string().optional(),
  responseFields: z.array(text).max(20).optional(),
};
const folderTypes = ["create_folder", "update_folder", "delete_folder"];
const writeTypes = [
  "rename_set",
  "move_set",
  "put_words",
  "edit_word",
  "edit_sense",
  "put_questions",
  "edit_question",
  "generated_questions",
  "create_folder",
  "update_folder",
];
const deleteTypes = [
  "delete_words",
  "delete_questions",
  "delete_set",
  "delete_folder",
];
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
          let result = raw;
          if (!readOnly && raw && typeof raw === "object") {
            const record = raw as Record<string, unknown>;
            if ("savedCount" in record || "operationId" in record)
              result = args.responseFields
                ? project(record, args.responseFields as string[])
                : compactReceipt(record);
            else if ("folders" in record) {
              const { folders: _folders, ...small } = record;
              result = small;
            }
          }
          if (readOnly && raw && typeof raw === "object" && "savedCount" in raw)
            result = args.responseFields
              ? project(raw, args.responseFields as string[])
              : compactReceipt(raw as Record<string, unknown>);
          if (
            JSON.stringify(result).length > Number(args.maxCharacters ?? 32000)
          )
            result =
              raw && typeof raw === "object" && "operationId" in raw
                ? {
                    ...compactReceipt(raw as Record<string, unknown>),
                    responseLimited: true,
                  }
                : {
                    status: "rejected",
                    error: {
                      code: "response_too_large",
                      message: "縮小範圍、使用 summary 或只指定需要的 fields。",
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
                        : "invalid_content",
                    message:
                      reason instanceof Error ? reason.message : "操作失敗",
                  },
                }),
              },
            ],
          };
        }
      },
    );
  };
  const mutate = (args: Record<string, unknown>, allowed: string[]) => {
    const act = action.parse(args.action);
    if (!allowed.includes(act.type))
      throw new HttpError(400, "unsupported_action");
    if (folderTypes.includes(act.type)) {
      if (identity.setId) throw new HttpError(403, "folder_outside_scope");
      return repo.mutateFolders(
        identity.uid,
        args.expectedRevision as string | undefined,
        (args.operationId as string | undefined) ?? crypto.randomUUID(),
        act as unknown as AgentFolderMutation,
      );
    }
    const setId = (args.setId as string | undefined) ?? identity.setId;
    if (!setId) throw new HttpError(400, "set_id_required");
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
    "讀取任何資料，一次最多10個 requests。",
    batchQuerySchema.shape,
    (args) => readAgentBatch(repo, identity, args),
    true,
  );
  tool(
    "create_set",
    "建立單字集。",
    { name: text, folderId: text.optional() },
    (args) =>
      createScopedSet(
        repo,
        identity,
        String(args.name),
        args.folderId as string | undefined,
      ),
  );
  tool(
    "write",
    "新增或修改；action.type 見說明。",
    { ...writeFields, action },
    (args) => mutate(args, writeTypes),
  );
  tool(
    "validate",
    "只檢查生成題，不寫入。",
    {
      setId: text,
      kind,
      difficulty: difficulty.default(2),
      senseIds: z.array(text).optional(),
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
    "刪除；action.type 見說明。",
    { ...writeFields, action },
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

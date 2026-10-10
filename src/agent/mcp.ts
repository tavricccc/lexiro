import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AGENT_INSTRUCTIONS } from "./instructions";
import {
  applyAgentMutation,
  createScopedSet,
  readAgentSet,
  readGenerationBrief,
} from "./operations";
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
const id = z.string().uuid(),
  text = z.string().min(1);
const writeFields = {
  setId: id,
  expectedRevision: z.string(),
  operationId: id,
};
export async function handleAgentMcp(
  request: Request,
  identity: AgentIdentity,
  repo: AgentLibraryRepository,
) {
  const server = new McpServer(
    { name: "Lexiro", version: "1.0.0" },
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
          idempotentHint: name !== "create_set",
        },
        _meta: {
          securitySchemes: [
            { type: "oauth2", scopes: ["sets:read", "sets:write"] },
          ],
        },
      },
      async (args) => {
        try {
          const result = await run(args);
          return {
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
  tool(
    "get_profile",
    "確認目前連結的 Lexiro 使用者及授權範圍。",
    {},
    async () => ({
      uid: identity.uid,
      email: identity.email,
      setId: identity.setId ?? null,
    }),
    true,
  );
  tool(
    "list_sets",
    "列出目前使用者授權範圍內的單字集。",
    {},
    async () => ({
      sets: identity.setId
        ? [
            {
              ...(await readAgentSet(repo, identity, identity.setId)).snapshot
                .set,
            },
          ]
        : await repo.list(identity.uid),
    }),
    true,
  );
  tool(
    "get_set",
    "讀取單字集、單字／詞義、題目及 revision；編輯前先讀。",
    { setId: id },
    (args) => readAgentSet(repo, identity, String(args.setId)),
    true,
  );
  tool(
    "list_folders", "列出目前使用者的資料夾、父層與資料夾 revision，分類前先查已有目的地。", {},
    async () => repo.folders(identity.uid), true,
  );
  const folderWrite = { expectedRevision: text, operationId: id };
  const mutateFolder = (args: Record<string, unknown>, action: AgentFolderMutation) => {
    if (identity.setId) throw new HttpError(403, "folder_outside_scope");
    return repo.mutateFolders(identity.uid, String(args.expectedRevision), String(args.operationId), action);
  };
  tool("create_folder", "建立自己的資料夾，可指定父資料夾；同一層名稱不可重複。",
    { ...folderWrite, name: text, parentId: text.optional() },
    args => mutateFolder(args, { type: "create_folder", name: String(args.name), ...(args.parentId ? { parentId: String(args.parentId) } : {}) }));
  tool("update_folder", "改名或移動自己的資料夾；parentId:null 移到根層，不能移入自己或子資料夾。",
    { ...folderWrite, folderId: text, name: text.optional(), parentId: text.nullable().optional() },
    args => mutateFolder(args, { type: "update_folder", folderId: String(args.folderId), ...(args.name !== undefined ? { name: String(args.name) } : {}), ...(args.parentId !== undefined ? { parentId: args.parentId === null ? null : String(args.parentId) } : {}) }));
  tool("delete_folder", "刪除自己的空資料夾；有內容時先依使用者意思移出或逐一刪除教材，不能刪未分類。",
    { ...folderWrite, folderId: text }, args => mutateFolder(args, { type: "delete_folder", folderId: String(args.folderId) }), false, true);
  tool(
    "create_set",
    "依使用者要求從零建立自己的單字集；先問名稱及來源，之後新增單字。",
    { setName: text, folderId: text.optional() },
    (args) => createScopedSet(repo, identity, String(args.setName), args.folderId as string | undefined),
  );
  tool(
    "get_generation_brief",
    "使用者未指定時，先問題型、難度、數量及新增或編輯，再取命題規則。由你自己生成，服務不呼叫模型。",
    { setId: id, kind, difficulty, senseIds: z.array(text).optional() },
    (args) =>
      readGenerationBrief(
        repo,
        identity,
        String(args.setId),
        kind.parse(args.kind),
        difficulty.parse(args.difficulty),
        args.senseIds as string[] | undefined,
      ),
    true,
  );
  const mutate = (args: Record<string, unknown>, action: unknown) =>
    applyAgentMutation(repo, identity, String(args.setId), {
      expectedRevision: args.expectedRevision,
      operationId: args.operationId,
      action,
    });
  tool(
    "rename_set",
    "修改本集名稱。",
    { ...writeFields, setName: text },
    (args) => mutate(args, { type: "rename_set", setName: args.setName }),
  );
  tool(
    "move_set", "把本集移至目前使用者既有資料夾；先 list_folders 取得folderId，未分類為 __uncategorized__。",
    { ...writeFields, folderId: text }, args => mutate(args, { type: "move_set", folderId: args.folderId }),
  );
  tool(
    "put_words",
    "每次新增或編輯1至200筆本集單字；更大批次按200拆批並重讀revision。修改保留 wordKey、詞義id；所列單字的 senses 是完整替換。",
    {
      ...writeFields,
      words: z
        .array(
          z.strictObject({
            wordKey: text.optional(),
            word: text,
            senses: z
              .array(
                z.strictObject({
                  id: text.optional(),
                  pos: text,
                  meaningZh: text,
                  examples: z.array(text),
                  supplementary: z.boolean().optional(),
                }),
              )
              .min(1),
          }),
        )
        .min(1).max(200),
    },
    (args) => mutate(args, { type: "put_words", words: args.words }),
  );
  tool(
    "delete_words",
    "刪除本集指定單字與其失效題目，保留其他單字集。",
    { ...writeFields, wordKeys: z.array(text).min(1).max(200) },
    (args) => mutate(args, { type: "delete_words", wordKeys: args.wordKeys }),
    false,
    true,
  );
  tool(
    "put_questions",
    "新增或編輯完整正式題目。修改保留 id；來源 wordKey／senseId 只可取自本集。",
    {
      ...writeFields,
      questions: z.array(z.record(z.string(), z.unknown())).min(1),
    },
    (args) =>
      mutate(args, { type: "put_questions", questions: args.questions }),
  );
  tool(
    "save_generated_questions",
    "提交你自己生成的 raw JSON，程式驗證、挖空及綁定来源。先取得命題規則。",
    {
      ...writeFields,
      kind,
      difficulty,
      senseIds: z.array(text).min(1),
      output: z.record(z.string(), z.unknown()),
    },
    (args) =>
      mutate(args, {
        type: "generated_questions",
        kind: args.kind,
        difficulty: args.difficulty,
        senseIds: args.senseIds,
        output: args.output,
      }),
  );
  tool(
    "delete_questions",
    "刪除本集指定題目或文章題組。",
    { ...writeFields, questionIds: z.array(text).min(1) },
    (args) =>
      mutate(args, { type: "delete_questions", questionIds: args.questionIds }),
    false,
    true,
  );
  tool(
    "delete_set",
    "刪除本集、其單字、題目及來源學習記錄，保留其他集與整體歷史。",
    writeFields,
    (args) => mutate(args, { type: "delete_set" }),
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

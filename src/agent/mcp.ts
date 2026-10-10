import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AGENT_INSTRUCTIONS } from "./instructions";
import {
  applyAgentMutation,
  createScopedSet,
  readAgentSet,
  readGenerationBrief,
  validateGeneratedQuestions,
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
  expectedRevision: z.string().optional().describe("可省略；提供時會拒絕覆蓋過期版本。可直接使用上一筆回條的 revision。"),
  operationId: id.optional().describe("可省略，由服務產生。需要斷線重送去重時，提供並沿用同一 UUID。"),
};
export async function handleAgentMcp(
  request: Request,
  identity: AgentIdentity,
  repo: AgentLibraryRepository,
) {
  const server = new McpServer(
    { name: "Lexiro", version: "1.1.0" },
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
            ...(result && typeof result === "object" && "status" in result && result.status === "rejected" ? { isError: true } : {}),
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
    "讀取單字集、單字／詞義、題目及 revision；需要目前內容或來源 ID 時使用。",
    { setId: id },
    (args) => readAgentSet(repo, identity, String(args.setId)),
    true,
  );
  tool(
    "list_folders", "需要分類目的地時，列出目前使用者的資料夾、父層與 revision。", {},
    async () => repo.folders(identity.uid), true,
  );
  const folderWrite = { expectedRevision: writeFields.expectedRevision, operationId: writeFields.operationId };
  const mutateFolder = (args: Record<string, unknown>, action: AgentFolderMutation) => {
    if (identity.setId) throw new HttpError(403, "folder_outside_scope");
    return repo.mutateFolders(identity.uid, args.expectedRevision as string | undefined, (args.operationId as string | undefined) ?? crypto.randomUUID(), action);
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
    "依使用者要求建立自己的單字集，可指定資料夾；已知道名稱及來源就直接建立。",
    { setName: text, folderId: text.optional() },
    (args) => createScopedSet(repo, identity, String(args.setName), args.folderId as string | undefined),
  );
  tool(
    "get_generation_brief",
    "取得與內建生成相同的完整命題提示，涵蓋所有五種題型，並附可用來源與寫入格式。可用 senseIds 指定要出的單字；已取得提示可沿用，使用者要求優先。",
    { setId: id, kind, difficulty: difficulty.default(2), senseIds: z.array(text).optional() },
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
    }, "mcp");
  tool(
    "rename_set",
    "修改本集名稱。",
    { ...writeFields, setName: text },
    (args) => mutate(args, { type: "rename_set", setName: args.setName }),
  );
  tool(
    "move_set", "把本集移至自己的既有資料夾；folderId 可取自 list_folders，未分類為 __uncategorized__。",
    { ...writeFields, folderId: text }, args => mutate(args, { type: "move_set", folderId: args.folderId }),
  );
  tool(
    "put_words",
    "每次新增或編輯1至200筆指定單字，其他單字保持原狀。修改保留 wordKey、詞義id；所列單字的 senses 是完整替換，examples 可省略。",
    {
      ...writeFields,
      words: z
        .array(
          z.object({
            wordKey: text.optional(),
            word: text,
            senses: z
              .array(
                z.object({
                  id: text.optional(),
                  pos: text,
                  meaningZh: text,
                  examples: z.array(text).optional(),
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
    "新增或編輯最多200個完整題目／題組。修改保留 id，來源只可取自本集；預設 partial 儲存有效題，atomic 則有錯全批不寫入。",
    {
      ...writeFields,
      questions: z.array(z.record(z.string(), z.unknown())).min(1).max(200),
      mode: z.enum(["atomic", "partial"]).default("partial"),
    },
    (args) =>
      mutate(args, { type: "put_questions", questions: args.questions, mode: args.mode }),
  );
  const generatedFields = {
    setId: id, kind, difficulty: difficulty.default(2),
    senseIds: z.array(text).min(1).optional(),
    output: z.record(z.string(), z.unknown()),
    mode: z.enum(["atomic", "partial"]).default("partial"),
  };
  tool("validate_generated_questions", "唯讀檢查自己生成的候選題；回傳穩定來源 ID、逐題錯誤與警告，不寫入、不改 revision、不呼叫模型。", generatedFields,
    args => validateGeneratedQuestions(repo, identity, String(args.setId), {
      kind: kind.parse(args.kind), difficulty: difficulty.parse(args.difficulty),
      senseIds: args.senseIds as string[] | undefined, output: args.output, mode: args.mode as "atomic" | "partial",
    }), true);
  tool(
    "save_generated_questions",
    "提交自己生成的 JSON，每題以 senseId 綁定來源，順序不限。預設 partial：儲存有效題並回傳逐題錯誤；atomic 有錯則全批不寫入。篇幅只回傳 warning，解說選填，brief 選用。",
    {
      ...writeFields,
      ...generatedFields,
    },
    (args) =>
      mutate(args, {
        type: "generated_questions",
        kind: args.kind,
        difficulty: args.difficulty,
        senseIds: args.senseIds,
        output: args.output,
        mode: args.mode,
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

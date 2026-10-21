import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
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
  setId: z.string().optional().describe("資料夾操作以外必填"),
  action: z.object({ type: z.enum(types) }).passthrough(),
  expectedRevision: z
    .string()
    .optional()
    .describe("可省略；帶上時須等於本集目前 revision，否則 stale_set 不寫入"),
  operationId: z.string().optional().describe("重送時沿用同一 UUID"),
  responseFields: z
    .array(z.string())
    .max(20)
    .optional()
    .describe("只回這些回條欄位；operationId、revision、status 一律附上"),
});
// MCP-facing shapes stay lean so tools/list is small; lengths and formats are
// enforced by querySchema and the contract. Strict read requests make a
// misspelled key fail with its name.
export const readRequest = z.strictObject({
  resource: querySchema.shape.resource.describe(
    "sets/folders 列表；set 摘要；words、questions 列表；word(wordKey)、question(questionId,childId?) 單筆；prompt(kind) 出題規則與 outputSchema；brief(setId,kind,difficulty) 出題來源；sources；operation、diagnostics(operationId)",
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
      "子字串搜尋：單字英文/中文義，題目題幹（含填回答案的完整句）/文章/選項/解說",
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
    .describe("1 起算含兩端，不可與 cursor 併用"),
  to: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional().describe("預設 20"),
  cursor: z.string().optional().describe("上一頁的 nextCursor"),
  view: z.enum(["summary", "detail"]).optional(),
  fields: z
    .array(z.string())
    .max(20)
    .optional()
    .describe("已存格式欄位，可巢狀，如 senses.id"),
  includeExamples: z.boolean().optional(),
  includePassage: z.boolean().optional(),
  includePrompt: z.boolean().optional(),
  severity: z.enum(["error", "warning"]).optional(),
});
const READ = `讀資料，一次最多10個 request，各自成功或失敗。列表預設20筆摘要、依固定ID排序，回 nextCursor；需要完整內容才 view:"detail"，或用 fields 只取需要的欄位。例：{requests:[{resource:"words",setId,q:"rescue",fields:["wordKey","word","senses.id"]},{resource:"prompt",kind:"vocabulary"},{resource:"brief",setId,kind:"vocabulary",difficulty:2,limit:16}]}`;
const WRITE = `新增或修改，回精簡回條與新 revision。action 依 type：
put_words{words:[{word,senses:[{pos,meaningZh,examples?}]}]} 新增；帶 wordKey 則覆寫該字且 senses 整組替換
edit_word{wordKey,patch:{word}} 只改拼字
edit_sense{wordKey,senseId?,action:"add"|"update"|"delete",patch?:{pos?,meaningZh?,examples?,appendExamples?}}
generated_questions{kind,difficulty,output,senseIds?} output 依 read prompt 的 outputSchema，每題用 senseId 綁來源（brief 的 ref 就是 senseId）
put_questions{questions} 已存題完整物件（read 回來的格式），帶 id 為覆寫
edit_question{questionId,childId?,patch} 只傳要改的欄位，用已存題格式（prompt/options/answerIndex/explanation/whyWrong）
rename_set{setName}、move_set{folderId}、create_folder{name,parentId?}、update_folder{folderId,name?,parentId?}
題目類可加 mode:"partial"(預設，只存有效題)|"atomic"(有錯全不存)；每批≤200筆。`;
const DELETE = `刪除，不可復原，先確認使用者意思。action 依 type：delete_words{wordKeys}、delete_questions{questionIds}、delete_set（整集）、delete_folder{folderId}（只限空資料夾）。`;
const VALIDATE = `只檢查生成題、不寫入，回條同 write generated_questions。output 依 read {resource:"prompt",kind} 的 outputSchema，與已存題格式不同。`;
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
        .describe("預設 32000"),
    },
    (args) => readAgentBatch(repo, identity, args),
    true,
  );
  tool(
    "create_set",
    "建立空白單字集，回 set.id 與 revision；之後用 write 加入內容。",
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

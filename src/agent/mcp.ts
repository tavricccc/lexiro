import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { AGENT_INSTRUCTIONS } from "./instructions";
import {
  applyAgentMutation,
  createScopedSet,
  readGenerationBrief,
  validateGeneratedQuestions,
  readAgentResource,
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
const id = z.string().uuid(),
  text = z.string().min(1);
const writeFields = {
  setId: id,
  expectedRevision: z
    .string()
    .optional()
    .describe(
      "可省略；提供時會拒絕覆蓋過期版本。可直接使用上一筆回條的 revision。",
    ),
  operationId: id
    .optional()
    .describe("可省略，由服務產生。需要斷線重送去重時，提供並沿用同一 UUID。"),
  responseFields: z
    .array(text)
    .max(20)
    .optional()
    .describe(
      "只回傳指定回條欄位，例如 revision 或 items.questionIds；預設精簡回條。",
    ),
};
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
        _meta: {
          securitySchemes: [
            { type: "oauth2", scopes: ["sets:read", "sets:write"] },
          ],
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
    "分頁列出自己的單字集，可搜尋名稱或指定資料夾；預設20筆。",
    {
      q: text.optional(),
      folderId: text.optional(),
      cursor: text.optional(),
      from: z.number().int().min(1).optional(),
      to: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      fields: z.array(text).optional(),
    },
    (args) => readAgentResource(repo, identity, { ...args, resource: "sets" }),
    true,
  );
  tool(
    "get_set",
    "只讀單字集名稱、數量與 revision，不回傳整包教材；單字／題目用分頁或指定ID讀取。",
    { setId: id, fields: z.array(text).optional() },
    (args) => readAgentResource(repo, identity, { ...args, resource: "set" }),
    true,
  );
  tool(
    "list_folders",
    "分頁搜尋資料夾名稱與父層，預設20筆；未分類另以uncategorized回傳。",
    {
      q: text.optional(),
      cursor: text.optional(),
      from: z.number().int().min(1).optional(),
      to: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      fields: z.array(text).optional(),
    },
    (args) =>
      readAgentResource(repo, identity, { ...args, resource: "folders" }),
    true,
  );
  const folderWrite = {
    expectedRevision: writeFields.expectedRevision,
    operationId: writeFields.operationId,
  };
  const mutateFolder = (
    args: Record<string, unknown>,
    action: AgentFolderMutation,
  ) => {
    if (identity.setId) throw new HttpError(403, "folder_outside_scope");
    return repo.mutateFolders(
      identity.uid,
      args.expectedRevision as string | undefined,
      (args.operationId as string | undefined) ?? crypto.randomUUID(),
      action,
    );
  };
  tool(
    "create_folder",
    "建立自己的資料夾，可指定父資料夾；同一層名稱不可重複。",
    { ...folderWrite, name: text, parentId: text.optional() },
    (args) =>
      mutateFolder(args, {
        type: "create_folder",
        name: String(args.name),
        ...(args.parentId ? { parentId: String(args.parentId) } : {}),
      }),
  );
  tool(
    "update_folder",
    "改名或移動自己的資料夾；parentId:null 移到根層，不能移入自己或子資料夾。",
    {
      ...folderWrite,
      folderId: text,
      name: text.optional(),
      parentId: text.nullable().optional(),
    },
    (args) =>
      mutateFolder(args, {
        type: "update_folder",
        folderId: String(args.folderId),
        ...(args.name !== undefined ? { name: String(args.name) } : {}),
        ...(args.parentId !== undefined
          ? { parentId: args.parentId === null ? null : String(args.parentId) }
          : {}),
      }),
  );
  tool(
    "delete_folder",
    "刪除自己的空資料夾；有內容時先依使用者意思移出或逐一刪除教材，不能刪未分類。",
    { ...folderWrite, folderId: text },
    (args) =>
      mutateFolder(args, {
        type: "delete_folder",
        folderId: String(args.folderId),
      }),
    false,
    true,
  );
  tool(
    "create_set",
    "依使用者要求建立自己的單字集，可指定資料夾；已知道名稱及來源就直接建立。",
    { setName: text, folderId: text.optional() },
    (args) =>
      createScopedSet(
        repo,
        identity,
        String(args.setName),
        args.folderId as string | undefined,
      ),
  );
  tool(
    "get_generation_brief",
    "只取目前批次的來源與命題specification，預設不重複提示詞。先get_generation_prompt一次；可指定來源ID或範圍，includePrompt:true才附完整原提示。",
    {
      setId: id,
      kind,
      difficulty: difficulty.default(2),
      senseIds: z.array(text).max(50).optional(),
      cursor: text.optional(),
      from: z.number().int().min(1).optional(),
      to: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      includePrompt: z.boolean().default(false),
      includeExamples: z.boolean().default(false),
    },
    (args) =>
      readGenerationBrief(
        repo,
        identity,
        String(args.setId),
        kind.parse(args.kind),
        difficulty.parse(args.difficulty),
        args.senseIds as string[] | undefined,
        args,
      ),
    true,
  );
  const mutate = (args: Record<string, unknown>, action: unknown) =>
    applyAgentMutation(
      repo,
      identity,
      String(args.setId),
      {
        expectedRevision: args.expectedRevision,
        operationId: args.operationId,
        action,
      },
      "mcp",
    );
  const pageFields = {
    setId: id,
    q: text.optional(),
    cursor: text.optional(),
    from: z.number().int().min(1).optional(),
    to: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    fields: z.array(text).max(20).optional(),
    view: z.enum(["summary", "detail"]).default("summary"),
  };
  tool(
    "read_batch",
    "一次讀取多種資料、搜尋或不同範圍。requests最多10項，各項resource可為set/sets/folders/words/word/questions/question/sources/brief/prompt/operation/diagnostics；可帶setId、q、from/to、limit/cursor、fields、questionType、difficulty、wordKeys、senseIds。預設總回傳上限32000字元，重複查詢只回reference。",
    batchQuerySchema.shape,
    (args) => readAgentBatch(repo, identity, args),
    true,
  );
  tool(
    "get_generation_prompt",
    "只取一種題型的完整原始提示與schema，不附教材；與內建生成相同，每型取得一次後沿用。",
    { kind, difficulty: difficulty.default(2) },
    (args) =>
      readAgentResource(repo, identity, { ...args, resource: "prompt" }),
    true,
  );
  tool(
    "list_words",
    "分頁搜尋單字或中文詞義，支援from/to與fields。預設20筆摘要，不附例句。",
    {
      ...pageFields,
      wordKeys: z.array(text).max(50).optional(),
      senseIds: z.array(text).max(50).optional(),
    },
    (args) => readAgentResource(repo, identity, { ...args, resource: "words" }),
    true,
  );
  tool(
    "get_word",
    "只取一個單字，fields可只指定某些詞義／例句欄位；不附其他教材。",
    { setId: id, wordKey: text, fields: z.array(text).max(20).optional() },
    (args) => readAgentResource(repo, identity, { ...args, resource: "word" }),
    true,
  );
  tool(
    "list_questions",
    "分頁搜尋題幹、文章或解說，篩選題型／難度／來源。預設只回ID及160字摘要；questionId可列出該文章的子題。",
    {
      ...pageFields,
      questionId: text.optional(),
      questionType: z
        .enum([
          "vocabulary",
          "grammar",
          "cloze",
          "wordBank",
          "discourse",
          "reading",
        ])
        .optional(),
      difficulty: difficulty.optional(),
      wordKeys: z.array(text).max(50).optional(),
      senseIds: z.array(text).max(50).optional(),
    },
    (args) =>
      readAgentResource(repo, identity, { ...args, resource: "questions" }),
    true,
  );
  tool(
    "get_question",
    "只取指定題目；文章預設不附全文或全部子題，childId取單一子題、includePassage:true才取正文，fields可精確選欄位。",
    {
      setId: id,
      questionId: text,
      childId: text.optional(),
      includePassage: z.boolean().default(false),
      fields: z.array(text).max(20).optional(),
    },
    (args) =>
      readAgentResource(repo, identity, { ...args, resource: "question" }),
    true,
  );
  tool(
    "edit_word",
    "只修改指定單字的拼字，其餘詞義／例句保留；版本與重送保護可選。",
    { ...writeFields, wordKey: text, patch: z.object({ word: text }) },
    (args) =>
      mutate(args, {
        type: "edit_word",
        wordKey: args.wordKey,
        patch: args.patch,
      }),
  );
  tool(
    "edit_sense",
    "只新增、修改或刪除一個詞義，其他詞義保留。patch可帶pos、meaningZh、examples（替換）、appendExamples（追加）、supplementary。update/delete需senseId；刪最後一義請delete_words。",
    {
      ...writeFields,
      wordKey: text,
      senseId: text.optional(),
      action: z.enum(["add", "update", "delete"]).default("update"),
      patch: z.record(z.string(), z.unknown()).optional(),
    },
    (args) =>
      mutate(args, {
        type: "edit_sense",
        wordKey: args.wordKey,
        senseId: args.senseId,
        action: args.action,
        patch: args.patch,
      }),
    false,
    true,
  );
  tool(
    "edit_question",
    "只更新指定題目欄位；childId可只編輯一個子題，正文及兄弟題保留。patch不需提供完整題目。",
    {
      ...writeFields,
      questionId: text,
      childId: text.optional(),
      patch: z.record(z.string(), z.unknown()),
    },
    (args) =>
      mutate(args, {
        type: "edit_question",
        questionId: args.questionId,
        childId: args.childId,
        patch: args.patch,
      }),
  );
  tool(
    "rename_set",
    "修改本集名稱。",
    { ...writeFields, setName: text },
    (args) => mutate(args, { type: "rename_set", setName: args.setName }),
  );
  tool(
    "move_set",
    "把本集移至自己的既有資料夾；folderId 可取自 list_folders，未分類為 __uncategorized__。",
    { ...writeFields, folderId: text },
    (args) => mutate(args, { type: "move_set", folderId: args.folderId }),
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
        .min(1)
        .max(200),
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
      mutate(args, {
        type: "put_questions",
        questions: args.questions,
        mode: args.mode,
      }),
  );
  const generatedFields = {
    setId: id,
    kind,
    difficulty: difficulty.default(2),
    senseIds: z.array(text).min(1).optional(),
    output: z.record(z.string(), z.unknown()),
    mode: z.enum(["atomic", "partial"]).default("partial"),
  };
  tool(
    "validate_generated_questions",
    "唯讀檢查自己生成的候選題；回傳穩定來源 ID、逐題錯誤與警告，不寫入、不改 revision、不呼叫模型。",
    { ...generatedFields, responseFields: writeFields.responseFields },
    (args) =>
      validateGeneratedQuestions(repo, identity, String(args.setId), {
        kind: kind.parse(args.kind),
        difficulty: difficulty.parse(args.difficulty),
        senseIds: args.senseIds as string[] | undefined,
        output: args.output,
        mode: args.mode as "atomic" | "partial",
      }),
    true,
  );
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

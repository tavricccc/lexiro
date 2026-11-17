import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { LENGTH_RANGES, PARTS_OF_SPEECH, QUESTION_KINDS, type Difficulty, type Question, type QuestionKind, type Word } from "../contract";
import { HttpError, httpError, issueText } from "../http";
import type { Library, SetContent } from "../library/repository";
import { questionPrompt, QUESTION_CACHE_KEY } from "../question-prompts";
import { assembleGenerated, generationBrief, outputSchema } from "./generation";

export interface AgentIdentity {
  uid: string;
  email: string;
  /** Set when the grant covers one set only. */
  setId?: string;
}

export const AGENT_INSTRUCTIONS = `Lexiro study-material assistant. You generate all content; the service only stores it and never calls a model. Materials are English by default; talk to the user and write meanings and explanations in Taiwan Traditional Chinese. If no question type is given, ask first; never re-ask what the user already said. Plan the data you need and fetch it in one read with several requests; never download a whole set when a page will do. To write questions: read prompt(kind) once per type and brief in batches for sources (both can share one read); generate, optionally validate, then write generated_questions. Confirm before deleting. Report only what real results say. If you are Opus and can start subagents: delegate generation to Sonnet subagents, at most three in parallel, each with a non-overlapping source batch; each reads prompt/brief, generates, validates and writes itself, and reports only item count, errors and saved ids, never question content.`;

const kind = z.enum(QUESTION_KINDS);
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const BRIEF_LIMITS: Record<QuestionKind, number> = { vocabulary: 16, cloze: 5, wordBank: 10, discourse: 4, reading: 5 };

const readRequest = z.strictObject({
  resource: z.enum(["sets", "folders", "set", "words", "word", "questions", "question", "prompt", "brief"]),
  setId: z.string().optional(),
  folderId: z.string().optional(),
  wordId: z.string().optional(),
  questionId: z.string().optional(),
  q: z.string().max(200).optional().describe("Substring search: words by spelling or Chinese meaning; questions by any text"),
  starred: z.boolean().optional(),
  kind: kind.optional(),
  difficulty: difficulty.optional(),
  senseIds: z.array(z.string()).max(50).optional(),
  from: z.number().int().min(0).optional().describe("0-based offset; use next from the previous page"),
  limit: z.number().int().min(1).max(50).optional().describe("Default 20"),
  view: z.enum(["summary", "detail"]).optional(),
});
type ReadRequest = z.infer<typeof readRequest>;

const READ = `Read data: up to 10 independent requests per call. resource:
sets{folderId?} folders | set{setId} | words{setId,q?,starred?,from?,limit?,view?} | word{setId,wordId} | questions{setId,kind?,q?,from?,limit?,view?} | question{setId,questionId}
prompt{kind,difficulty?} generation rules and outputSchema, once per kind | brief{setId,kind,difficulty?,senseIds?,from?,limit?} sources for one generation batch, plus setWords to draw distractors from.
Lists are pages of summaries (next gives the following offset); view:"detail" returns full items.`;
const WRITE = `Create or modify. action by type:
put_words{words:[{id?,word,starred?,senses:[{id?,pos,meaning,description?,examples?,supplementary?}]}]} adds words, or replaces a word given its id (keep sense ids to keep their questions; a sense left out is removed with its questions). A new word spelled like an existing one gains its new meanings. meaning is only the short Chinese meaning, shown as an answer option; textbook notes (usage, collocations, register, related forms) go in description, one point per line, no bullets. pos is one of: ${PARTS_OF_SPEECH.join(" ")} (write v. for vt./vi.).
mark_words{wordIds,starred}
generated_questions{kind,difficulty,output,senseIds?,mode?} output follows prompt's outputSchema; bind each item with senseId.
put_questions{questions,mode?} questions in stored format (as read returns them); with an existing id it replaces that question.
rename_set{name}, move_set{folderId|null}, create_folder{name,parentId?}, update_folder{folderId,name?,parentId?}
mode: "partial" (default) saves valid items and reports the rest; "atomic" saves nothing on any error. At most 100 questions per write.`;
const DELETE = `Delete, irreversible; confirm with the user first. action by type: delete_words{wordIds} (also removes the questions that use them), delete_questions{questionIds}, delete_set, delete_folder{folderId} (its sets move to the parent folder).`;
const VALIDATE = `Check generated questions without writing; same report as write generated_questions.`;

const wordSummary = (word: Word) => ({ id: word.id, word: word.word, ...(word.starred ? { starred: true } : {}), senses: word.senses.map((s) => ({ id: s.id, pos: s.pos, meaning: s.meaning })) });
function questionSummary(question: Question) {
  const text = "items" in question ? question.passage : question.prompt;
  return {
    id: question.id, kind: question.kind, difficulty: question.difficulty,
    ...("title" in question && question.title ? { title: question.title } : {}),
    preview: text.slice(0, 160),
    senseIds: "items" in question ? [...new Set(question.items.map((item) => item.senseId))] : [question.senseId],
  };
}
const SET_WORDS_LIMIT = 30;
/** Words of the set offered as distractors, the batch's own included: its parts of speech first, then A to Z. */
export function setWords(words: Word[], sources: { pos: string }[], limit = SET_WORDS_LIMIT) {
  const batchPos = new Set(sources.map((source) => source.pos));
  return words
    .flatMap((word) => word.senses.map((sense) => ({ word: word.word, pos: sense.pos, meaningZh: sense.meaning })))
    .sort((a, b) => Number(batchPos.has(b.pos)) - Number(batchPos.has(a.pos)) || a.word.localeCompare(b.word))
    .slice(0, limit);
}
const contains = (haystack: unknown, needle: string) => JSON.stringify(haystack).toLocaleLowerCase().includes(needle.toLocaleLowerCase());
function page<T>(items: T[], request: ReadRequest) {
  const from = request.from ?? 0, limit = request.limit ?? 20;
  const slice = items.slice(from, from + limit);
  return { total: items.length, from, items: slice, ...(from + limit < items.length ? { next: from + limit } : {}) };
}

export class AgentTools {
  constructor(readonly lib: Library, readonly identity: AgentIdentity) {}
  private get uid() { return this.identity.uid; }

  /** The set a request names, held to the grant's set when it has one. */
  private setId(value: string | undefined): string {
    const setId = value ?? this.identity.setId;
    if (!setId) throw httpError(400, "set_id_required", "This request needs setId");
    if (this.identity.setId && setId !== this.identity.setId) throw httpError(403, "set_outside_scope", "This authorization covers one other set");
    return setId;
  }
  private noScope() {
    if (this.identity.setId) throw httpError(403, "folder_outside_scope", "This authorization is limited to one set");
  }

  async read(requests: ReadRequest[]) {
    const contents = new Map<string, Promise<SetContent>>();
    const content = (setId: string) => {
      if (!contents.has(setId)) contents.set(setId, this.lib.setContent(this.uid, setId));
      return contents.get(setId)!;
    };
    const results = [];
    for (const request of requests) {
      try { results.push(await this.readOne(request, content)); }
      catch (reason) { results.push({ error: { code: reason instanceof HttpError ? reason.code : "invalid_request", message: issueText(reason) } }); }
    }
    return { results };
  }

  private async readOne(request: ReadRequest, content: (setId: string) => Promise<SetContent>) {
    const detail = request.view === "detail";
    switch (request.resource) {
      case "sets": {
        const { sets } = await this.lib.library(this.uid);
        const visible = sets.filter((set) => (!this.identity.setId || set.id === this.identity.setId) && (request.folderId === undefined || set.folderId === request.folderId));
        return page(visible.map(({ id, name, folderId, wordCount, questionCount }) => ({ id, name, folderId, wordCount, questionCount })), request);
      }
      case "folders":
        this.noScope();
        return { items: (await this.lib.library(this.uid)).folders };
      case "set": {
        const set = await this.lib.requireSet(this.uid, this.setId(request.setId));
        return set;
      }
      case "words": {
        const { words } = await content(this.setId(request.setId));
        const matching = words.filter((word) => (request.starred === undefined || word.starred === request.starred) && (!request.q || contains([word.word, word.senses.map((s) => s.meaning)], request.q)));
        return page<unknown>(detail ? matching : matching.map(wordSummary), request);
      }
      case "word": {
        const word = (await content(this.setId(request.setId))).words.find((w) => w.id === request.wordId);
        if (!word) throw httpError(404, "word_not_found", `Word ${request.wordId} is not in this set`);
        return word;
      }
      case "questions": {
        const { questions } = await content(this.setId(request.setId));
        const matching = questions.filter((question) => (!request.kind || question.kind === request.kind) && (!request.q || contains(question, request.q)));
        return page<unknown>(detail ? matching : matching.map(questionSummary), request);
      }
      case "question": {
        const question = (await content(this.setId(request.setId))).questions.find((q) => q.id === request.questionId);
        if (!question) throw httpError(404, "question_not_found", `Question ${request.questionId} is not in this set`);
        return question;
      }
      case "prompt": {
        if (!request.kind) throw httpError(400, "kind_required", "prompt needs kind");
        const level = (request.difficulty ?? 2) as Difficulty;
        const [min, max] = LENGTH_RANGES[request.kind][level];
        return {
          kind: request.kind, promptVersion: QUESTION_CACHE_KEY,
          rules: questionPrompt(request.kind, [], level).instructions,
          specification: { difficulty: level, lengthRange: { min, max } },
          outputSchema: outputSchema(request.kind, level),
          brief: { defaultLimit: BRIEF_LIMITS[request.kind], maxLimit: 50 },
        };
      }
      case "brief": {
        if (!request.kind) throw httpError(400, "kind_required", "brief needs kind");
        const level = (request.difficulty ?? 2) as Difficulty;
        const set = await content(this.setId(request.setId));
        const all = generationBrief(set, request.kind, level, request.senseIds).sources as { ref: string; word: string; pos: string; meaningZh: string; knownExample?: string }[];
        const limited = page(all, { ...request, limit: request.limit ?? BRIEF_LIMITS[request.kind] });
        return { ...limited, items: undefined, sources: limited.items, setWords: setWords(set.words, limited.items), specification: questionPrompt(request.kind, limited.items, level).input };
      }
    }
  }

  async createSet(name: string, folderId?: string) {
    this.noScope();
    const set = await this.lib.putSet(this.uid, undefined, { name, folderId: folderId ?? null });
    return { set: { id: set.id, name: set.name } };
  }

  async write(setIdValue: string | undefined, action: Record<string, unknown> & { type: string }) {
    const lib = this.lib, uid = this.uid;
    const input = <T extends z.ZodRawShape>(shape: T) => z.strictObject({ type: z.string(), ...shape }).parse(action);
    switch (action.type) {
      case "create_folder": {
        this.noScope();
        const { name, parentId } = input({ name: z.string(), parentId: z.string().nullable().optional() });
        return { folder: await lib.putFolder(uid, undefined, { name, parentId: parentId ?? null }) };
      }
      case "update_folder": {
        this.noScope();
        const { folderId, name, parentId } = input({ folderId: z.string(), name: z.string().optional(), parentId: z.string().nullable().optional() });
        const folder = (await lib.library(uid)).folders.find((f) => f.id === folderId);
        if (!folder) throw httpError(404, "folder_not_found", `Folder ${folderId} does not exist`);
        return { folder: await lib.putFolder(uid, folderId, { name: name ?? folder.name, parentId: parentId === undefined ? folder.parentId : parentId, order: folder.order }) };
      }
    }
    const setId = this.setId(setIdValue);
    switch (action.type) {
      case "put_words": {
        const { words } = input({ words: z.array(z.unknown()).min(1).max(200) });
        const result = await lib.putWords(uid, setId, words as never);
        return { saved: result.words.map(wordSummary), removedQuestionIds: result.removedQuestionIds };
      }
      case "mark_words": {
        const { wordIds, starred } = input({ wordIds: z.array(z.string()).min(1).max(500), starred: z.boolean() });
        await lib.starWords(uid, setId, wordIds, starred);
        return { marked: wordIds.length, starred };
      }
      case "generated_questions": {
        const args = input({ kind, difficulty, output: z.unknown(), senseIds: z.array(z.string()).optional(), mode: z.enum(["atomic", "partial"]).default("partial") });
        const { questions, report } = assembleGenerated(await lib.setContent(uid, setId), args);
        const saved = questions.length ? await lib.putQuestions(uid, setId, questions, args.mode) : { saved: [], failed: [], warnings: [] };
        return { ...compactReport(report), savedIds: saved.saved, ...(saved.failed.length ? { storeErrors: saved.failed } : {}) };
      }
      case "put_questions": {
        const { questions, mode } = input({ questions: z.array(z.unknown()).min(1).max(100), mode: z.enum(["atomic", "partial"]).default("partial") });
        return lib.putQuestions(uid, setId, questions, mode);
      }
      case "rename_set": {
        const { name } = input({ name: z.string() });
        const set = await lib.requireSet(uid, setId);
        return { set: await lib.putSet(uid, setId, { ...set, name }) };
      }
      case "move_set": {
        this.noScope();
        const { folderId } = input({ folderId: z.string().nullable() });
        const set = await lib.requireSet(uid, setId);
        return { set: await lib.putSet(uid, setId, { ...set, folderId }) };
      }
      default:
        throw httpError(400, "unsupported_action", `Unknown write action ${action.type}`);
    }
  }

  async remove(setIdValue: string | undefined, action: Record<string, unknown> & { type: string }) {
    const input = <T extends z.ZodRawShape>(shape: T) => z.strictObject({ type: z.string(), ...shape }).parse(action);
    if (action.type === "delete_folder") {
      this.noScope();
      const { folderId } = input({ folderId: z.string() });
      await this.lib.deleteFolder(this.uid, folderId);
      return { deleted: folderId };
    }
    const setId = this.setId(setIdValue);
    switch (action.type) {
      case "delete_words": return this.lib.deleteWords(this.uid, setId, input({ wordIds: z.array(z.string()).min(1).max(500) }).wordIds);
      case "delete_questions": return this.lib.deleteQuestions(this.uid, setId, input({ questionIds: z.array(z.string()).min(1).max(500) }).questionIds);
      case "delete_set":
        await this.lib.requireSet(this.uid, setId);
        await this.lib.deleteSet(this.uid, setId);
        return { deleted: setId };
      default:
        throw httpError(400, "unsupported_action", `Unknown delete action ${action.type}`);
    }
  }

  async validate(setId: string, args: { kind: QuestionKind; difficulty: Difficulty; output: unknown; senseIds?: string[] }) {
    return compactReport(assembleGenerated(await this.lib.setContent(this.uid, this.setId(setId)), { ...args, mode: "partial" }).report);
  }
}

/** The generation report without the bulk an Agent does not act on. */
function compactReport(report: ReturnType<typeof assembleGenerated>["report"]) {
  return {
    status: report.status, validCount: report.validCount, failedCount: report.failedCount,
    errors: report.errors.slice(0, 10), warnings: report.warnings.slice(0, 3),
    ...(report.errors.length > 10 ? { moreErrors: report.errors.length - 10 } : {}),
    unusedSenseIds: report.unusedSenseIds,
  };
}

export async function handleAgentMcp(request: Request, tools: AgentTools): Promise<Response> {
  const server = new McpServer({ name: "Lexiro", version: "3.0.0" }, { instructions: AGENT_INSTRUCTIONS });
  const register = (name: string, description: string, inputSchema: z.ZodRawShape, run: (args: any) => Promise<unknown>, hints: { readOnly?: boolean; destructive?: boolean } = {}) =>
    server.registerTool(name, {
      description, inputSchema,
      annotations: { readOnlyHint: !!hints.readOnly, destructiveHint: !!hints.destructive, openWorldHint: false, idempotentHint: !!hints.readOnly },
    }, async (args) => {
      try {
        const result = await run(args);
        const text = JSON.stringify(result);
        const rejected = !!result && typeof result === "object" && (result as { status?: string }).status === "rejected";
        return {
          ...(rejected ? { isError: true } : {}),
          content: [{ type: "text" as const, text: text.length > 128_000 ? JSON.stringify({ error: { code: "response_too_large", message: "Narrow the request: use a smaller limit or summary view." } }) : text }],
        };
      } catch (reason) {
        const code = reason instanceof HttpError ? reason.code : reason instanceof z.ZodError ? "invalid_input" : "invalid_content";
        return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message: issueText(reason, "Operation failed") } }) }] };
      }
    });
  const action = z.object({ type: z.string() }).passthrough();
  register("read", READ, { requests: z.array(readRequest).min(1).max(10) }, (args) => tools.read(args.requests), { readOnly: true });
  register("create_set", "Create an empty vocabulary set; returns set.id. Add content with write.", { name: z.string(), folderId: z.string().optional() }, (args) => tools.createSet(args.name, args.folderId));
  register("write", WRITE, { setId: z.string().optional().describe("Required except for folder actions"), action }, (args) => tools.write(args.setId, args.action));
  register("validate", VALIDATE, { setId: z.string(), kind, difficulty: difficulty.default(2), senseIds: z.array(z.string()).optional(), output: z.record(z.string(), z.unknown()) }, (args) => tools.validate(args.setId, args), { readOnly: true });
  register("delete", DELETE, { setId: z.string().optional(), action }, (args) => tools.remove(args.setId, args.action), { destructive: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 1_000_000 });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close();
  return response;
}

import { z } from "zod";
import {
  buildWordGenerationSources,
  LIMITS,
  QUESTION_KINDS,
  TIERS,
  AI_MODELS,
  generationModel,
  rate,
  type GenerationRequest,
  type Tier,
} from "@lexiro/ai-contract";
import prompts, {
  buildMistakeExplanationPrompt,
  EXPLAIN_CACHE_KEY,
  WORD_CACHE_KEY,
} from "./prompts";
import { questionPrompt } from "./question-prompts";
import { jsonSchema, questionOutput, questionItemOutput, wordOutput } from "./schemas";
import type { ChargeUnit } from "./billing";
import { fingerprint, HttpError } from "./http";
import {
  ORGANIZE_CACHE_KEY,
  organizeInstructions,
  organizeOutput,
} from "./organize";

export const REASONING: Record<Tier, "low" | "medium" | "high"> =
  {
    lite: "low",
    thinking: "medium",
    pro: "low",
  };
const inputSchema = z.strictObject({
  kind: z.enum([
    "words",
    "senses",
    "organizeText",
    "explain",
    ...QUESTION_KINDS,
  ]),
  raw: z.string().optional(),
  sources: z
    .array(
      z.strictObject({
        ref: z.string().max(80),
        word: z.string().min(1),
        pos: z.string(),
        meaningZh: z.string().min(1),
        knownExample: z.string().optional(),
      }),
    )
    .optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  limit: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  session: z.string().uuid(),
  tier: z.enum(TIERS),
  model: z.enum(AI_MODELS),
  cursor: z
    .string()
    .regex(/^resp_[A-Za-z0-9_-]{1,200}$/)
    .optional(),
  repair: z.string().max(1000).optional(),
  newVersion: z.boolean().optional(),
  itemRepair: z.strictObject({ index: z.number().int().min(0).max(9), passage: z.string().min(1).max(LIMITS.input), items: z.array(z.unknown()).max(10), extraOptions: z.array(z.string()).max(10).optional() }).optional(),
});
export interface PreparedGeneration {
  request: Omit<GenerationRequest, "model"> & { model: string };
  instructions: string;
  /** A first reusable block shared by several specialized prompts. */
  cachePrefix?: string;
  input: string;
  images?: string[];
  schema?: Record<string, unknown>;
  units: (ChargeUnit & { index: number })[];
  halfRate: number;
  cacheKey: string;
}

export async function prepareGeneration(
  value: unknown,
  uid: string,
): Promise<PreparedGeneration> {
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, "invalid_input");
  const request = parsed.data;
  if (request.itemRepair && !["cloze", "wordBank", "discourse", "reading"].includes(request.kind))
    throw new HttpError(400, "invalid_input");
  if ((request.raw?.length ?? 0) > LIMITS.input)
    throw new HttpError(413, "input_limit", "text");
  if (request.sources && request.sources.length > LIMITS.sources)
    throw new HttpError(413, "input_limit", "sources");
  let instructions: string,
    input: string,
    cacheKey: string,
    cachePrefix: string | undefined,
    schema: Record<string, unknown> | undefined,
    rawUnits: string[];
  if (request.kind === "words") {
    if (!request.raw || request.sources)
      throw new HttpError(400, "invalid_input");
    const sources = buildWordGenerationSources(request.raw);
    if (!sources.length) throw new HttpError(400, "invalid_input");
    if (sources.length > LIMITS.sources)
      throw new HttpError(413, "input_limit", "sources");
    if (sources.some((source) => source.raw.length > LIMITS.source))
      throw new HttpError(413, "input_limit", "source");
    instructions = prompts.generateWordSet;
    cacheKey = WORD_CACHE_KEY;
    input = `來源資料：${JSON.stringify(sources.map(({ sourceRef, word, posHint, hint }) => ({ ref: sourceRef, word, posHint, hint })))}\n本輪 activeRefs：${JSON.stringify(sources.map((source) => source.sourceRef))}。只輸出本輪完整 JSON。`;
    schema = jsonSchema(wordOutput({ min: 1, max: 1 }));
    rawUnits = sources.map(({ word, posHint, hint }) =>
      JSON.stringify({ word, posHint, hint }),
    );
  } else if (request.kind === "senses") {
    // Supplementing sends the word instructions byte for byte and puts what
    // makes it different in the input, so it rides the same warm prefix every
    // set creation keeps alive rather than paying cold start on its own.
    const sources = request.sources;
    if (!sources?.length || request.raw || !request.limit)
      throw new HttpError(400, "invalid_input");
    const words = supplementWords(sources);
    if (words.length > LIMITS.sources)
      throw new HttpError(413, "input_limit", "sources");
    if (
      words.some(
        (entry) =>
          `${entry.word} ${entry.existing.map((sense) => `${sense.pos} ${sense.meaningZh}`).join(" ")}`
            .length > LIMITS.source,
      )
    )
      throw new HttpError(413, "input_limit", "source");
    instructions = prompts.generateWordSet;
    cacheKey = WORD_CACHE_KEY;
    input = SUPPLEMENT_INPUT(words, request.limit);
    schema = jsonSchema(wordOutput({ min: 0, max: request.limit }));
    rawUnits = words.map(({ word }) => JSON.stringify({ word }));
  } else if (request.kind === "explain") {
    if (!request.raw || request.sources)
      throw new HttpError(400, "invalid_input");
    instructions = buildMistakeExplanationPrompt("");
    cacheKey = EXPLAIN_CACHE_KEY;
    input = request.raw;
    rawUnits = [request.raw];
  } else if (request.kind === "organizeText") {
    if (!request.raw?.trim() || request.sources)
      throw new HttpError(400, "invalid_input");
    instructions = organizeInstructions;
    cacheKey = ORGANIZE_CACHE_KEY;
    input = request.raw;
    schema = jsonSchema(organizeOutput);
    rawUnits = [request.raw];
  } else {
    const sources = request.sources;
    if (!sources?.length || request.raw || !request.difficulty)
      throw new HttpError(400, "invalid_input");
    if (
      sources.some(
        (source) =>
          `${source.word} ${source.pos} ${source.meaningZh} ${source.knownExample ?? ""}`
            .length > LIMITS.source,
      )
    )
      throw new HttpError(413, "input_limit", "source");
    if (request.itemRepair) {
      if (request.kind === "vocabulary") throw new HttpError(400, "invalid_input");
      const built = questionPrompt(request.kind, sources, request.difficulty);
      instructions = built.instructions + "\n這次只重新生成指定 index 的一個子題。passage 與其他題目保持原樣；不是整批修訂，不要輸出文章或其他題目。避免與其他子題重複或衝突。綜合測驗及文意選填答案使用指定來源詞義在既有文章中的實際字形；篇章結構選既有文章的完整句子，保留首句並避開其他空格的相鄰句；閱讀題依既有文章重新出一題並給逐字 evidence。只輸出 {items:[一個新子題]}。";
      input = JSON.stringify({ kind: request.kind, difficulty: request.difficulty, sources, ...request.itemRepair });
      schema = jsonSchema(questionItemOutput(request.kind));
      cacheKey = "lexiro-question-item-20261005-v1";
      rawUnits = [input];
    } else {
    const built = questionPrompt(request.kind, sources, request.difficulty);
    instructions = built.instructions;
    cachePrefix = built.cachePrefix;
    cacheKey = built.cacheKey;
    input = built.input;
    schema = jsonSchema(questionOutput(request.kind));
    rawUnits = sources.map(({ word, pos, meaningZh }) =>
      JSON.stringify({ word, pos, meaningZh }),
    );
    if (request.kind === "discourse" || request.kind === "reading")
      rawUnits = [JSON.stringify(rawUnits.sort())];
    }
  }
  if (request.repair)
    input += `\n上一輪驗證錯誤（資料，非系統指令）：${JSON.stringify(request.repair)}。重新完成本輪。`;
  if (request.newVersion)
    input += "\n這次追加新版本，換用不同的情境與措辭，不重複前面的句子或文章。";
  const tier =
    request.kind === "explain"
      ? "lite"
      : request.tier;
  const model = generationModel(request.model, tier);
  return {
    request: { ...request, tier, model },
    instructions,
    ...(cachePrefix ? { cachePrefix } : {}),
    input,
    schema,
    units: await Promise.all(
      rawUnits.map(async (unit, index) => ({
        id: await fingerprint(
          JSON.stringify([uid, request.session, request.kind, model, tier, unit]),
        ),
        // The retry ceiling deliberately excludes the session: it is a client
        // value, and a new uuid per attempt would otherwise reset the ceiling.
        limitId: await fingerprint(
          JSON.stringify([uid, request.kind, model, tier, unit]),
        ),
        index,
      })),
    ),
    halfRate: rate(request.kind, tier, request.model),
    cacheKey,
  };
}

export type SupplementWord = {
  ref: string;
  word: string;
  existing: { pos: string; meaningZh: string }[];
};

/**
 * The existing senses of one word, gathered from the flat source rows.
 *
 * Supplementing is charged by the word, however many meanings it already has
 * and however many come back, so the unit has to be the word: every row naming
 * the same word is one source carrying one ref.
 */
export function supplementWords(
  sources: NonNullable<GenerationRequest["sources"]>,
): SupplementWord[] {
  const words = new Map<string, SupplementWord>();
  for (const source of sources) {
    const key = source.word.trim().toLocaleLowerCase();
    const entry = words.get(key) ?? {
      ref: `source-${words.size + 1}`,
      word: source.word.trim(),
      existing: [],
    };
    entry.existing.push({ pos: source.pos, meaningZh: source.meaningZh });
    words.set(key, entry);
  }
  return [...words.values()];
}

const SUPPLEMENT_INPUT = (words: SupplementWord[], limit: number) =>
  `來源資料：${JSON.stringify(words.map(({ ref, word, existing }) => ({ ref, word, existing })))}\n本輪 activeRefs：${JSON.stringify(words.map((entry) => entry.ref))}。本輪是補充模式：每筆只補 existing 沒有的詞義，最多 ${limit} 個，沒有值得補的就回傳空的 senses 陣列。只輸出本輪完整 JSON。`;

function cachedInstructionInput(prepared: PreparedGeneration) {
  const blocks = prepared.cachePrefix
    ? [
        prepared.cachePrefix,
        prepared.instructions.slice(prepared.cachePrefix.length).trimStart(),
      ]
    : [prepared.instructions];
  return blocks.filter(Boolean).map((text) => ({
    role: "developer" as const,
    content: [
      {
        type: "input_text" as const,
        text,
        prompt_cache_breakpoint: { mode: "explicit" as const },
      },
    ],
  }));
}

export function upstreamRequest(prepared: PreparedGeneration, cursor?: string, websocket = false, streamId?: string) {
  return {
    model: prepared.request.model,
    service_tier: "default" as const,
    reasoning: { effort: REASONING[prepared.request.tier] },
    ...(websocket ? { type: "response.create", stream_id: streamId } : { stream: true }),
    store: true,
    input: [
      ...cachedInstructionInput(prepared),
      { role: "user" as const, content: prepared.input },
    ],
    ...(cursor ? { previous_response_id: cursor } : {}),
    max_output_tokens: LIMITS.outputTokens,
    prompt_cache_key: prepared.cacheKey,
    prompt_cache_options: { mode: "explicit" as const, ttl: "30m" as const },
    ...(prepared.schema
      ? {
          text: {
            format: {
              type: "json_schema",
              name: "lexiro_result",
              strict: true,
              schema: prepared.schema,
            },
          },
        }
      : {}),
  };
}

/** Encode only the small JSON envelope; base64 is validated before concatenation. */
export function upstreamBody(
  prepared: PreparedGeneration,
  cursor?: string,
  websocket = false,
  streamId?: string,
): string | ReadableStream<Uint8Array> {
  const body = upstreamRequest(prepared, cursor, websocket, streamId);
  if (!prepared.images) return JSON.stringify(body);
  const marker = "LEXIRO_IMAGE_BODY";
  const imageBody = {
    ...body,
    input: [
      ...body.input.slice(0, -1),
      {
        role: "user",
        content: [
          { type: "input_text", text: prepared.input },
          ...prepared.images.map(() => ({
            type: "input_image",
            image_url: `data:image/webp;base64,${marker}`,
            detail: "high",
          })),
        ],
      },
    ],
  };
  const envelope = JSON.stringify(imageBody).split(marker);
  const encoder = new TextEncoder();
  const chunks = prepared.images.flatMap((image, index) => [envelope[index], image]);
  chunks.push(envelope[prepared.images.length]);
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(encoder.encode(chunk));
    },
  });
}

import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import {
  agentRecordId,
  agentGenerationBrief,
  createAgentSet,
  type WordEntry,
  type LibraryQuestion,
} from "@lexiro/agent-contract";
import { questionLengthRange } from "@lexiro/ai-contract";
import { questionPrompt, QUESTION_CACHE_KEY } from "../question-prompts";
import { fingerprint, HttpError, httpError, issueText } from "../http";

const text = z.string().trim().min(1).max(300);
const ids = z.array(text).min(1).max(50).optional();
export const querySchema = z.object({
  resource: z.enum([
    "sets",
    "folders",
    "set",
    "words",
    "word",
    "questions",
    "question",
    "sources",
    "brief",
    "prompt",
    "operation",
    "diagnostics",
  ]),
  setId: z.string().uuid().optional(),
  wordKey: text.optional(),
  questionId: text.optional(),
  childId: text.optional(),
  operationId: z.string().uuid().optional(),
  q: text.optional(),
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
  kind: z
    .enum(["vocabulary", "cloze", "wordBank", "discourse", "reading"])
    .optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  wordKeys: ids,
  senseIds: ids,
  folderId: text.optional(),
  from: z.number().int().min(1).max(20000).optional(),
  to: z.number().int().min(1).max(20049).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().max(2000).optional(),
  view: z.enum(["summary", "detail"]).default("summary"),
  fields: z
    .array(
      z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*$/),
    )
    .min(1)
    .max(20)
    .optional(),
  includeExamples: z.boolean().default(false),
  includePassage: z.boolean().default(false),
  includePrompt: z.boolean().default(false),
  severity: z.enum(["error", "warning"]).default("error"),
});
export type AgentQuery = z.infer<typeof querySchema>;
const sourceLimits = {
  vocabulary: 16,
  cloze: 5,
  wordBank: 10,
  discourse: 30,
  reading: 30,
};

function missing(field: string): never {
  throw httpError(400, `missing_${field}`, `此 resource 需要 ${field}`);
}
function encode(value: unknown) {
  return btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode(value: string): unknown {
  try {
    return JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(value.replaceAll("-", "+").replaceAll("_", "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
  } catch {
    throw httpError(
      400,
      "invalid_cursor",
      "cursor 無法解析；請原樣使用上一頁回傳的 nextCursor",
    );
  }
}
export function project(value: unknown, fields?: string[]): unknown {
  if (!fields) return value;
  if (Array.isArray(value)) return value.map((item) => project(item, fields));
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>,
    groups = new Map<string, string[]>();
  for (const field of fields) {
    const [key, ...rest] = field.split(".");
    if (["constructor", "prototype", "__proto__"].includes(key))
      throw httpError(400, "unknown_field", `fields 不可包含 ${key}`);
    if (!Object.hasOwn(source, key)) continue;
    const paths = groups.get(key) ?? [];
    paths.push(rest.join("."));
    groups.set(key, paths);
  }
  return Object.fromEntries(
    [...groups].map(([key, paths]) => [
      key,
      paths.includes("") ? source[key] : project(source[key], paths),
    ]),
  );
}
/** Requested receipt fields, always with the identity of the write itself. */
export function projectReceipt(
  value: Record<string, unknown>,
  fields: string[],
  actionType?: string,
) {
  const missing = fields.filter(
    (field) => !Object.hasOwn(value, field.split(".")[0]),
  );
  const compact = compactReceipt(value, actionType);
  return {
    ...Object.fromEntries(
      [
        "operationId",
        "revision",
        "status",
        "savedCount",
        "errorCount",
        "removedQuestionCount",
        "hint",
      ]
        .filter((key) => Object.hasOwn(compact, key))
        .map((key) => [key, (compact as Record<string, unknown>)[key]]),
    ),
    ...(project(value, fields) as Record<string, unknown>),
    ...(missing.length
      ? {
          unknownResponseFields: missing,
          availableResponseFields: Object.keys(value),
        }
      : {}),
  };
}
const structureHints: Record<string, string> = {
  edit_question:
    "edit_question patches use stored-question fields (prompt/options/answerIndex/explanation/whyWrong); no need to switch tools. distractors, sentence and answer are generation fields and do not apply.",
  put_questions:
    "put_questions takes stored questions (prompt/options/answerIndex, the format read returns); use generated_questions for the generation format (sentence/answer/distractors).",
};
export function compactReceipt(
  value: Record<string, unknown>,
  actionType?: string,
) {
  const {
    items: _items,
    requestedSenseIds: _requested,
    usedSenseIds: _used,
    unusedSenseIds: _unused,
    errors,
    warnings,
    ...rest
  } = value;
  const errorList = Array.isArray(errors) ? errors : [],
    warningList = Array.isArray(warnings) ? warnings : [];
  return {
    ...rest,
    ...(errors !== undefined
      ? {
          errors: errorList
            .slice(0, 10)
            .map((error) =>
              error && typeof error === "object" && "message" in error
                ? { ...error, message: issueText(String(error.message)) }
                : error,
            ),
          errorCount: errorList.length,
          hasMoreErrors: errorList.length > 10,
        }
      : {}),
    ...(warnings !== undefined
      ? { warnings: warningList.slice(0, 3), warningCount: warningList.length }
      : {}),
    ...(errorList.some(
      (error) =>
        (error as { code?: unknown } | null)?.code ===
        "invalid_question_structure",
    )
      ? {
          hint:
            (actionType && structureHints[actionType]) ??
            'Generated output must follow the outputSchema from read {resource:"prompt",kind}; use put_questions for stored questions (prompt/options/answerIndex) and edit_question to change an existing one.',
        }
      : {}),
  };
}

async function window(uid: string, q: AgentQuery) {
  if (q.cursor && (q.from !== undefined || q.to !== undefined))
    throw httpError(
      400,
      "cursor_and_range_are_exclusive",
      "cursor 不可與 from/to 併用；接續頁面只帶 cursor（可加 limit）",
    );
  const scope = await fingerprint(
    JSON.stringify({
      uid,
      ...q,
      limit: undefined,
      from: undefined,
      to: undefined,
      cursor: undefined,
      fields: undefined,
      view: undefined,
      includeExamples: undefined,
      includePassage: undefined,
      includePrompt: undefined,
    }),
  );
  const cursor = q.cursor
    ? z
        .object({
          scope: z.string(),
          after: z.string(),
          position: z.number().int(),
        })
        .parse(decode(q.cursor))
    : undefined;
  if (cursor && cursor.scope !== scope)
    throw httpError(
      400,
      "cursor_outside_query",
      "cursor 屬於另一組查詢條件；接續頁面時 resource、setId、q、kind 等條件須與取得該 cursor 時相同，只能改 limit/fields/view",
    );
  const offset = q.from === undefined ? 0 : q.from - 1;
  const limit =
    q.to !== undefined
      ? q.to - (q.from ?? 1) + 1
      : (q.limit ??
        ((q.resource === "brief" || q.resource === "sources") && q.kind
          ? sourceLimits[q.kind]
          : 20));
  if (limit < 1 || limit > 50)
    throw httpError(
      400,
      "range_must_contain_1_to_50_items",
      `from ${q.from ?? 1} 到 to ${q.to} 共 ${limit} 筆；每次須為 1–50 筆`,
    );
  return {
    scope,
    after: cursor?.after ?? "",
    offset,
    position: cursor?.position ?? offset,
    limit,
  };
}
function page<T>(
  rows: T[],
  w: Awaited<ReturnType<typeof window>>,
  key: (row: T) => string,
) {
  const items = rows.slice(0, w.limit),
    last = items.at(-1),
    hasMore = rows.length > w.limit;
  return {
    items,
    from: items.length ? w.position + 1 : null,
    to: items.length ? w.position + items.length : null,
    hasMore,
    nextCursor:
      hasMore && last
        ? encode({
            scope: w.scope,
            after: key(last),
            position: w.position + items.length,
          })
        : null,
    order: "stable_id",
  };
}
function pattern(q: string) {
  return `%${q.toLocaleLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
function wordSummary(word: WordEntry) {
  return {
    wordKey: word.wordKey,
    word: word.word,
    senses: word.senses.map(({ id, pos, meaningZh }) => ({
      id,
      pos,
      meaningZh,
    })),
  };
}
function questionSummary(question: LibraryQuestion) {
  return question.kind === "reading"
    ? {
        id: question.id,
        kind: question.kind,
        questionType: question.format,
        title: question.title,
        difficulty: question.difficulty,
        sourceCount: question.wordKeys.length,
        childCount: question.questions.length,
      }
    : {
        id: question.id,
        kind: question.kind,
        questionType: question.questionStyle,
        difficulty: question.difficulty,
        wordKey: question.wordKey,
        senseId: question.senseId,
        preview: question.prompt.slice(0, 160),
      };
}

export async function queryLibrary(
  db: D1Database,
  uid: string,
  q: AgentQuery,
): Promise<Record<string, unknown>> {
  const result = await queryRecords(db, uid, q);
  if (!q.fields) return result;
  const value = result as Record<string, unknown>;
  const returned = Array.isArray(value.items)
    ? value.items
    : [value.word, value.question, value.child, value.operation].filter(
        (item) => item !== undefined,
      );
  if (!returned.length) return result;
  const missing = q.fields.filter(
    (field) =>
      !returned.some(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          Object.hasOwn(item, field.split(".")[0]),
      ),
  );
  return missing.length
    ? {
        ...result,
        fieldsNotFound: missing,
        fieldsHint:
          "這些 fields 在回傳的資料裡都不存在：可能拼錯，或不是已存格式欄位（單字 wordKey/word/senses.*；詞彙題 id/prompt/options/answerIndex/explanation/whyWrong；文章 title/passage/questions.*）。",
      }
    : result;
}
async function queryRecords(
  db: D1Database,
  uid: string,
  q: AgentQuery,
): Promise<Record<string, unknown>> {
  const w = await window(uid, q);
  const setId = q.setId;
  const needsSet =
    setId && q.resource !== "operation" && q.resource !== "diagnostics";
  const set = needsSet
    ? await db
        .prepare(
          "SELECT payload FROM cloud_records WHERE uid=? AND id=? AND kind='set' AND deleted=0",
        )
        .bind(uid, agentRecordId("set", setId))
        .first<{ payload: string }>()
    : undefined;
  if (needsSet && !set) throw new HttpError(404, "set_not_found");
  const requireSet = () => setId ?? missing("setId");
  if (q.resource === "prompt") {
    const kind = q.kind ?? missing("kind"),
      difficulty = q.difficulty ?? 2;
    return {
      kind,
      promptVersion: QUESTION_CACHE_KEY,
      rules: questionPrompt(kind, [], difficulty).instructions,
      specification: {
        difficulty,
        lengthRange: questionLengthRange(kind, difficulty),
      },
      outputSchema: agentGenerationBrief(
        createAgentSet(crypto.randomUUID(), "格式"),
        kind,
        difficulty,
      ).outputSchema,
      brief: {
        defaultLimit: sourceLimits[kind],
        maxLimit: 50,
        note: "Each brief returns defaultLimit sources unless you pass limit; the item count follows that brief's specification.",
      },
    };
  }
  if (q.resource === "sets" || q.resource === "folders") {
    const kind = q.resource === "sets" ? "set" : "folder",
      args: (string | number)[] = [uid, kind, w.after];
    let where = "uid=? AND kind=? AND record_key>? AND deleted=0";
    if (setId && kind === "set") {
      where += " AND record_key=?";
      args.push(setId);
    }
    if (q.folderId) {
      where += " AND json_extract(payload,'$.folderId')=?";
      args.push(q.folderId);
    }
    if (q.q) {
      where += ` AND lower(json_extract(payload,'$.${kind === "set" ? "setName" : "name"}')) LIKE ? ESCAPE '\\'`;
      args.push(pattern(q.q));
    }
    args.push(w.limit + 1, w.offset);
    const rows = (
      await db
        .prepare(
          `SELECT record_key,payload FROM cloud_records INDEXED BY cloud_records_key WHERE ${where} ORDER BY record_key LIMIT ? OFFSET ?`,
        )
        .bind(...args)
        .all<{ record_key: string; payload: string }>()
    ).results;
    const result = page(rows, w, (row) => row.record_key);
    return {
      ...result,
      items: result.items.map((row) =>
        project(JSON.parse(row.payload), q.fields),
      ),
      ...(kind === "folder"
        ? { uncategorized: { id: "__uncategorized__", name: "未分類" } }
        : {}),
    };
  }
  if (q.resource === "operation" || q.resource === "diagnostics") {
    const row = await db
      .prepare(
        "SELECT result FROM cloud_operations WHERE uid=? AND operation_id=?",
      )
      .bind(uid, q.operationId ?? missing("operationId"))
      .first<{ result: string }>();
    if (!row)
      throw httpError(
        404,
        "operation_not_found",
        `operationId ${q.operationId} 沒有回條（不存在或已超過 30 天）`,
      );
    const result = JSON.parse(row.result) as Record<string, unknown>;
    if (typeof result.setId !== "string" || (setId && result.setId !== setId))
      throw httpError(
        404,
        "operation_not_found",
        `operationId ${q.operationId} 不屬於${setId ? `單字集 ${setId}` : "可存取的單字集"}`,
      );
    if (q.resource === "operation")
      return q.fields
        ? { operation: project(result, q.fields) }
        : compactReceipt(result);
    const entries = (
      Array.isArray(result[q.severity === "error" ? "errors" : "warnings"])
        ? result[q.severity === "error" ? "errors" : "warnings"]
        : []
    ) as Record<string, unknown>[];
    const indexed = entries
      .map((data, index) => ({ data, key: String(index).padStart(8, "0") }))
      .filter((entry) => entry.key > w.after)
      .slice(w.offset, w.offset + w.limit + 1);
    const resultPage = page(indexed, w, (entry) => entry.key);
    return {
      ...resultPage,
      items: resultPage.items.map((entry) => project(entry.data, q.fields)),
      total: entries.length,
    };
  }
  const scopedId = requireSet();
  if (
    q.resource === "words" ||
    q.resource === "word" ||
    q.resource === "sources" ||
    q.resource === "brief"
  ) {
    const sources = q.resource === "sources" || q.resource === "brief",
      detail = q.resource === "word";
    const args: (string | number)[] = [uid, scopedId];
    let where =
      "m.uid=? AND m.set_id=? AND r.uid=m.uid AND r.kind='word' AND r.record_key=m.word_key AND r.deleted=0";
    if (detail) {
      where += " AND m.word_key=?";
      args.push(q.wordKey ?? missing("wordKey"));
    }
    if (q.wordKeys) {
      where += " AND m.word_key IN (SELECT value FROM json_each(?))";
      args.push(JSON.stringify(q.wordKeys));
    }
    if (q.q) {
      where +=
        " AND (lower(json_extract(r.payload,'$.word')) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.senses') sense WHERE lower(json_extract(sense.value,'$.meaningZh')) LIKE ? ESCAPE '\\'))";
      args.push(pattern(q.q), pattern(q.q));
    }
    if (sources) {
      where += " AND (m.word_key||'|'||json_extract(s.value,'$.id'))>?";
      args.push(w.after);
      if (q.senseIds) {
        where +=
          " AND json_extract(s.value,'$.id') IN (SELECT value FROM json_each(?))";
        args.push(JSON.stringify(q.senseIds));
      }
      args.push(w.limit + 1, w.offset);
      const rows = (
        await db
          .prepare(
            `SELECT m.word_key, json_extract(r.payload,'$.word') AS word,s.value AS sense FROM cloud_memberships m CROSS JOIN cloud_records r INDEXED BY cloud_records_key CROSS JOIN json_each(r.payload,'$.senses') s WHERE ${where} ORDER BY m.word_key,json_extract(s.value,'$.id') LIMIT ? OFFSET ?`,
          )
          .bind(...args)
          .all<{ word_key: string; word: string; sense: string }>()
      ).results;
      const result = page(
        rows,
        w,
        (row) =>
          `${row.word_key}|${(JSON.parse(row.sense) as { id: string }).id}`,
      );
      const items = result.items.map((row) => {
        const sense = JSON.parse(row.sense) as WordEntry["senses"][number];
        return {
          ref: sense.id,
          wordKey: row.word_key,
          word: row.word,
          senseId: sense.id,
          pos: sense.pos,
          meaningZh: sense.meaningZh,
          ...(q.includeExamples && sense.examples[0]
            ? { knownExample: sense.examples[0] }
            : {}),
        };
      });
      if (q.resource === "sources")
        return {
          ...result,
          items: items.map((item) => project(item, q.fields)),
        };
      const kind = q.kind ?? missing("kind"),
        prompt = questionPrompt(kind, items, q.difficulty ?? 2);
      return {
        from: result.from,
        to: result.to,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        sourceCount: items.length,
        promptVersion: QUESTION_CACHE_KEY,
        specification: prompt.input,
        ...(q.includePrompt
          ? {
              rules: prompt.instructions,
              outputSchema: agentGenerationBrief(
                createAgentSet(crypto.randomUUID(), "格式"),
                kind,
                q.difficulty ?? 2,
              ).outputSchema,
            }
          : {}),
      };
    }
    where += " AND m.word_key>?";
    args.push(w.after);
    if (q.senseIds) {
      where +=
        " AND EXISTS(SELECT 1 FROM json_each(r.payload,'$.senses') s WHERE json_extract(s.value,'$.id') IN (SELECT value FROM json_each(?)))";
      args.push(JSON.stringify(q.senseIds));
    }
    args.push(detail ? 1 : w.limit + 1, detail ? 0 : w.offset);
    const rows = (
      await db
        .prepare(
          `SELECT r.payload FROM cloud_memberships m CROSS JOIN cloud_records r INDEXED BY cloud_records_key WHERE ${where} ORDER BY m.word_key LIMIT ? OFFSET ?`,
        )
        .bind(...args)
        .all<{ payload: string }>()
    ).results.map((row) => JSON.parse(row.payload) as WordEntry);
    if (detail) {
      if (!rows[0])
        throw httpError(
          404,
          "word_not_found",
          `wordKey ${q.wordKey} 不在本集；用 read words 取得 wordKey`,
        );
      return { word: project(rows[0], q.fields) };
    }
    const result = page(rows, w, (word) => word.wordKey);
    return {
      ...result,
      items: result.items.map((word) =>
        project(
          q.fields || q.view === "detail" ? word : wordSummary(word),
          q.fields,
        ),
      ),
    };
  }
  if (q.resource === "questions" || q.resource === "question") {
    const args: (string | number)[] = [uid, uid, scopedId];
    let where =
      "r.uid=? AND r.kind='question' AND r.deleted=0 AND r.record_key IN (SELECT s.question_id FROM cloud_memberships m CROSS JOIN cloud_question_sources s WHERE m.uid=? AND m.set_id=? AND s.uid=m.uid AND s.word_key=m.word_key";
    if (q.wordKeys) {
      where += " AND m.word_key IN (SELECT value FROM json_each(?))";
      args.push(JSON.stringify(q.wordKeys));
    }
    where +=
      ") AND NOT EXISTS(SELECT 1 FROM cloud_question_sources s WHERE s.uid=r.uid AND s.question_id=r.record_key AND NOT EXISTS(SELECT 1 FROM cloud_memberships m WHERE m.uid=s.uid AND m.set_id=? AND m.word_key=s.word_key))";
    args.push(scopedId);
    if (q.questionId) {
      where += " AND r.record_key=?";
      args.push(q.questionId);
    }
    if (q.questionType) {
      where +=
        " AND coalesce(json_extract(r.payload,'$.format'),json_extract(r.payload,'$.questionStyle'))=?";
      args.push(q.questionType);
    }
    if (q.difficulty) {
      where += " AND json_extract(r.payload,'$.difficulty')=?";
      args.push(q.difficulty);
    }
    if (q.senseIds) {
      where +=
        " AND (json_extract(r.payload,'$.senseId') IN (SELECT value FROM json_each(?)) OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.questions') c WHERE json_extract(c.value,'$.senseId') IN (SELECT value FROM json_each(?))))";
      args.push(JSON.stringify(q.senseIds), JSON.stringify(q.senseIds));
    }
    if (q.q) {
      where +=
        " AND (lower(json_extract(r.payload,'$.prompt')) LIKE ? ESCAPE '\\' OR lower(replace(json_extract(r.payload,'$.prompt'),'_____',coalesce(json_extract(r.payload,'$.options['||json_extract(r.payload,'$.answerIndex')||']'),'_____'))) LIKE ? ESCAPE '\\' OR lower(json_extract(r.payload,'$.title')) LIKE ? ESCAPE '\\' OR lower(json_extract(r.payload,'$.passage')) LIKE ? ESCAPE '\\' OR lower(json_extract(r.payload,'$.explanation')) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.options') o WHERE lower(o.value) LIKE ? ESCAPE '\\') OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.optionBank') o WHERE lower(o.value) LIKE ? ESCAPE '\\') OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.questions') c WHERE lower(json_extract(c.value,'$.prompt')) LIKE ? ESCAPE '\\' OR lower(replace(json_extract(c.value,'$.prompt'),'_____',coalesce(json_extract(c.value,'$.options['||json_extract(c.value,'$.answerIndex')||']'),'_____'))) LIKE ? ESCAPE '\\' OR lower(json_extract(c.value,'$.explanation')) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM json_each(c.value,'$.options') o WHERE lower(o.value) LIKE ? ESCAPE '\\')))";
      args.push(...Array<string>(11).fill(pattern(q.q)));
    }
    if (q.resource === "question" || q.questionId) {
      if (!q.questionId) missing("questionId");
      const row = await db
        .prepare(
          `SELECT r.payload FROM cloud_records r INDEXED BY cloud_records_key WHERE ${where}`,
        )
        .bind(...args)
        .first<{ payload: string }>();
      if (!row)
        throw httpError(
          404,
          "question_not_found",
          `questionId ${q.questionId} 不在本集；用 read questions 取得 id`,
        );
      const question = JSON.parse(row.payload) as LibraryQuestion;
      if (q.resource === "questions" && question.kind === "reading") {
        const children = [...question.questions]
          .sort((a, b) => a.id.localeCompare(b.id))
          .filter((child) => child.id > w.after)
          .slice(w.offset, w.offset + w.limit + 1);
        const result = page(children, w, (child) => child.id);
        return {
          ...result,
          parent: questionSummary(question),
          items: result.items.map((child) =>
            project(
              q.fields || q.view === "detail"
                ? child
                : {
                    id: child.id,
                    wordKey: child.wordKey,
                    senseId: child.senseId,
                    blank: child.blank,
                    preview: child.prompt.slice(0, 160),
                  },
              q.fields,
            ),
          ),
        };
      }
      if (q.childId) {
        if (question.kind !== "reading")
          throw httpError(
            404,
            "child_not_found",
            `題目 ${question.id} 不是文章題，沒有子題；請省略 childId`,
          );
        const child = question.questions.find(
          (child) => child.id === q.childId,
        );
        if (!child)
          throw httpError(
            404,
            "child_not_found",
            `childId ${q.childId} 不在題目 ${question.id}；可用：${question.questions.map((item) => item.id).join("、")}`,
          );
        return {
          parent: questionSummary(question),
          child: project(child, q.fields),
          ...(q.includePassage ? { passage: question.passage } : {}),
        };
      }
      return {
        question: project(
          q.fields
            ? question
            : question.kind === "reading"
              ? {
                  ...questionSummary(question),
                  ...(q.includePassage ? { passage: question.passage } : {}),
                }
              : question,
          q.fields,
        ),
      };
    }
    where += " AND r.record_key>?";
    args.push(w.after, w.limit + 1, w.offset);
    const rows = (
      await db
        .prepare(
          `SELECT r.payload FROM cloud_records r INDEXED BY cloud_records_key WHERE ${where} ORDER BY r.record_key LIMIT ? OFFSET ?`,
        )
        .bind(...args)
        .all<{ payload: string }>()
    ).results.map((row) => JSON.parse(row.payload) as LibraryQuestion);
    const result = page(rows, w, (row) => row.id);
    return {
      ...result,
      items: result.items.map((row) =>
        project(
          q.fields || q.view === "detail" ? row : questionSummary(row),
          q.fields,
        ),
      ),
    };
  }
  throw new HttpError(400, "unsupported_resource");
}

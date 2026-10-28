import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vitest";
import {
  agentSetRevision,
  createAgentSet,
  mutateAgentSet,
  UNCATEGORIZED_FOLDER_ID,
  type AgentFolderMutation,
  type AgentCloudRecord,
} from "@lexiro/agent-contract";
import { D1AgentLibrary } from "../src/agent/library-repository";
import { handleCloudApi } from "../src/cloud/api";
import { DEFAULT_AI_MODEL } from "@lexiro/ai-contract";
import { snapshotRecords } from "../src/cloud/records";
import {
  CLOUD_OPERATION_RETENTION_MS,
  purgeCloudOperations,
} from "../src/cloud/repository";
import type { AgentEnv } from "../src/agent/types";
import {
  applyAgentMutation,
  readAgentResource,
  readAgentBatch,
  readGenerationBrief,
  validateGeneratedQuestions,
} from "../src/agent/operations";
import { questionPrompt } from "../src/question-prompts";
import { handleAgentMcp, readRequest } from "../src/agent/mcp";
import { querySchema } from "../src/agent/query";
import { AGENT_INSTRUCTIONS } from "../src/agent/instructions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
async function fixture() {
  const runtime = new Miniflare({
    workers: [
      {
        config: {
          name: "agent-library-d1-test",
          compatibilityDate: "2026-10-10",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default {fetch(){return new Response('synthetic')}}",
              },
            },
          },
          env: { CLOUD_DB: { type: "d1" } },
        },
      },
    ],
  });
  const db = await runtime.getD1Database("CLOUD_DB");
  for (const file of (
    await readdir(new URL("../library-migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL(`../library-migrations/${file}`, import.meta.url),
      "utf8",
    );
    await db.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s)),
    );
  }
  const repo = new D1AgentLibrary({ CLOUD_DB: db } as unknown as AgentEnv);
  await repo.create("a", createAgentSet(A, "合成 A"));
  await repo.create("b", createAgentSet(B, "合成 B"));
  return { runtime, db, repo };
}
function words(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    word: `synthetic-${String(i).padStart(3, "0")}`,
    senses: [
      {
        pos: "n.",
        meaningZh: `合成項目${i}`,
        examples: [`This synthetic item belongs to example number ${i}.`],
      },
    ],
  }));
}

const identityA = { uid: "a", email: "synthetic@example.invalid" };
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function mcpRpc(
  repo: D1AgentLibrary,
  method: string,
  params: unknown,
  uid = "a",
) {
  const response = await handleAgentMcp(
    new Request("http://local/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    { uid, email: `${uid}@example.test` },
    repo,
  );
  return (await response.json()) as {
    result: {
      tools: { name: string }[];
      isError?: boolean;
      content: { text: string }[];
    };
  };
}
async function mcpCall(
  repo: D1AgentLibrary,
  name: string,
  args: unknown,
  uid = "a",
) {
  const { result } = await mcpRpc(
    repo,
    "tools/call",
    { name, arguments: args },
    uid,
  );
  return {
    isError: result.isError ?? false,
    data: JSON.parse(result.content[0].text) as Record<string, unknown>,
  };
}
async function mcpRaw(repo: D1AgentLibrary, name: string, args: unknown) {
  const { result } = await mcpRpc(repo, "tools/call", {
    name,
    arguments: args,
  });
  return { isError: result.isError ?? false, text: result.content[0].text };
}
async function accountRevision(f: Fixture, uid = "a") {
  return f.db
    .prepare("SELECT revision FROM cloud_accounts WHERE uid=?")
    .bind(uid)
    .first();
}

describe("native D1 agent library with synthetic users", () => {
  it("returns the exact built-in prompt for every Agent question format without writing", async () => {
    const f = await fixture();
    try {
      const identity = { uid: "a", email: "synthetic@example.invalid" };
      await applyAgentMutation(
        f.repo,
        identity,
        A,
        {
          action: {
            type: "put_words",
            words: [
              { word: "rescue", senses: [{ pos: "v.", meaningZh: "救援" }] },
            ],
          },
        },
        "mcp",
      );
      const before = await f.db
        .prepare("SELECT revision FROM cloud_accounts WHERE uid=?")
        .bind("a")
        .first();
      for (const kind of [
        "vocabulary",
        "cloze",
        "wordBank",
        "discourse",
        "reading",
      ] as const) {
        const brief = await readGenerationBrief(f.repo, identity, A, kind, 2);
        const prompt = await readAgentResource(f.repo, identity, {
          resource: "prompt",
          kind,
          difficulty: 2,
        });
        expect(prompt.rules).toBe(questionPrompt(kind, [], 2).instructions);
        expect(prompt.outputSchema).toMatchObject({ type: "object" });
        expect(brief).toMatchObject({ sourceCount: 1 });
        expect(brief).not.toHaveProperty("rules");
        expect(brief).not.toHaveProperty("outputSchema");
        expect(
          (
            await readGenerationBrief(f.repo, identity, A, kind, 2, undefined, {
              includePrompt: true,
            })
          ).rules,
        ).toBe(prompt.rules);
      }
      expect(
        await f.db
          .prepare("SELECT revision FROM cloud_accounts WHERE uid=?")
          .bind("a")
          .first(),
      ).toEqual(before);
    } finally {
      await f.runtime.dispose();
    }
  });
  async function seedSearchSet(f: Fixture) {
    await applyAgentMutation(
      f.repo,
      identityA,
      A,
      { action: { type: "put_words", words: words(60) } },
      "mcp",
    );
    const snapshot = (await f.repo.read("a", A))!;
    const question = {
      id: "search-question",
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      prompt: "Students _____ the library after school.",
      options: ["visit", "ignore", "break", "delay"],
      answerIndex: 0,
      wordKey: snapshot.words[0].wordKey,
      senseId: snapshot.words[0].senses[0].id,
    };
    expect(
      await applyAgentMutation(
        f.repo,
        identityA,
        A,
        { action: { type: "put_questions", questions: [question] } },
        "mcp",
      ),
    ).toMatchObject({ savedCount: 1 });
  }
  const wordRange = (f: Fixture) =>
    readAgentResource(f.repo, identityA, {
      resource: "words",
      setId: A,
      from: 11,
      to: 15,
      fields: ["wordKey", "word", "senses.id"],
    });
  const meaningSearch = {
    resource: "words",
    setId: A,
    q: "合成項目17",
    fields: ["word", "senses.meaningZh"],
  };

  it("reads a bounded word range with projected fields", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const page = await wordRange(f);
      expect(page).toMatchObject({ from: 11, to: 15, hasMore: true });
      expect(page.items).toHaveLength(5);
      expect(page.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            senses: [expect.objectContaining({ id: expect.any(String) })],
          }),
        ]),
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("continues a word range from its cursor without unrequested fields", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const page = await wordRange(f);
      const next = await readAgentResource(f.repo, identityA, {
        resource: "words",
        setId: A,
        cursor: page.nextCursor,
        limit: 5,
      });
      expect(next).toMatchObject({ from: 16, to: 20 });
      expect(JSON.stringify(next)).not.toContain("examples");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a cursor reused with a different query", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const page = await wordRange(f);
      await expect(
        readAgentResource(f.repo, identityA, {
          resource: "words",
          setId: A,
          cursor: page.nextCursor,
          q: "another",
        }),
      ).rejects.toMatchObject({ code: "cursor_outside_query" });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("hides a set from another user", async () => {
    const f = await fixture();
    try {
      await expect(
        readAgentResource(
          f.repo,
          { ...identityA, uid: "b" },
          { resource: "words", setId: A },
        ),
      ).rejects.toMatchObject({ code: "set_not_found" });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("finds a word by its meaning in a batch read", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const batch = await readAgentBatch(f.repo, identityA, {
        requests: [meaningSearch],
      });
      expect(batch.results[0]).toMatchObject({
        data: {
          items: [
            { word: "synthetic-017", senses: [{ meaningZh: "合成項目17" }] },
          ],
        },
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("filters questions by text, type and difficulty in a batch read", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const batch = await readAgentBatch(f.repo, identityA, {
        requests: [
          {
            resource: "questions",
            setId: A,
            q: "school",
            questionType: "vocabulary",
            difficulty: 2,
          },
        ],
      });
      expect(batch.results[0]).toMatchObject({
        data: {
          items: [{ id: "search-question", questionType: "vocabulary" }],
        },
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("returns no questions for a type the set has none of", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const batch = await readAgentBatch(f.repo, identityA, {
        requests: [
          { resource: "questions", setId: A, questionType: "reading" },
        ],
      });
      expect(batch.results[0]).toMatchObject({ data: { items: [] } });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("answers a repeated batch request with a reference to the first", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const batch = await readAgentBatch(f.repo, identityA, {
        requests: [meaningSearch, meaningSearch],
      });
      expect(batch.results[1]).toMatchObject({ reference: 0 });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reports an unknown batch resource as invalid_query", async () => {
    const f = await fixture();
    try {
      const batch = await readAgentBatch(f.repo, identityA, {
        requests: [{ resource: "unknown" }],
      });
      expect(batch.results[0]).toHaveProperty("error.code", "invalid_query");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("searches question text", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      expect(
        await readAgentResource(f.repo, identityA, {
          resource: "questions",
          setId: A,
          q: "visit",
        }),
      ).toMatchObject({ items: [{ id: "search-question" }] });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("projects requested question fields", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      expect(
        await readAgentResource(f.repo, identityA, {
          resource: "questions",
          setId: A,
          fields: ["id", "explanation"],
        }),
      ).toMatchObject({ items: [{ id: "search-question" }] });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("enforces the batch character budget", async () => {
    const f = await fixture();
    try {
      await seedSearchSet(f);
      const budget = await readAgentBatch(f.repo, identityA, {
        maxCharacters: 2000,
        requests: [
          { resource: "prompt", kind: "vocabulary" },
          { resource: "words", setId: A, limit: 1, fields: ["word"] },
        ],
      });
      expect(budget.results[0]).toHaveProperty(
        "error.code",
        "response_budget_exceeded",
      );
      expect(budget.results[1]).toMatchObject({
        data: { items: [{ word: expect.any(String) }] },
      });
      expect(JSON.stringify(budget).length).toBeLessThanOrEqual(2000);
      expect(budget.characters).toBe(JSON.stringify(budget).length);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reports a batch request outside the identity set scope", async () => {
    const f = await fixture();
    try {
      await expect(
        readAgentBatch(
          f.repo,
          { ...identityA, setId: A },
          { requests: [{ resource: "set", setId: B }] },
        ),
      ).resolves.toMatchObject({
        results: [{ error: { code: "set_outside_scope" } }],
      });
    } finally {
      await f.runtime.dispose();
    }
  });
  async function seedRescue(f: Fixture) {
    await applyAgentMutation(
      f.repo,
      identityA,
      A,
      {
        action: {
          type: "put_words",
          words: [
            {
              word: "rescue",
              senses: [
                {
                  pos: "v.",
                  meaningZh: "救援",
                  examples: ["An existing example."],
                },
                {
                  pos: "n.",
                  meaningZh: "救援行動",
                  examples: ["Another example."],
                },
              ],
            },
          ],
        },
      },
      "mcp",
    );
    const word = (await f.repo.read("a", A))!.words[0];
    return { word, sense: word.senses[0] };
  }
  const editSense = (
    f: Fixture,
    seed: Awaited<ReturnType<typeof seedRescue>>,
    patch: Record<string, unknown>,
  ) =>
    applyAgentMutation(
      f.repo,
      identityA,
      A,
      {
        action: {
          type: "edit_sense",
          wordKey: seed.word.wordKey,
          senseId: seed.sense.id,
          patch,
        },
      },
      "mcp",
    );
  async function seedReadingPack(f: Fixture) {
    const { word, sense } = await seedRescue(f);
    const pack = {
      id: "reading-parent",
      kind: "reading",
      format: "reading",
      difficulty: 2,
      title: "A synthetic rescue",
      passage: "The team arrived at the mountain and rescued the lost hikers.",
      wordKeys: [word.wordKey],
      questions: Array.from({ length: 3 }, (_, i) => ({
        id: `child-${i}`,
        kind: "multipleChoice",
        prompt: `What happened in stage ${i}?`,
        options: ["Rescue", "Delay", "Departure", "Argument"],
        answerIndex: 0,
        wordKey: word.wordKey,
        senseId: sense.id,
      })),
    };
    expect(
      await applyAgentMutation(
        f.repo,
        identityA,
        A,
        { action: { type: "put_questions", questions: [pack] } },
        "mcp",
      ),
    ).toMatchObject({ savedCount: 1 });
    return { pack, parent: (await f.repo.read("a", A))!.questions[0] };
  }
  const patchReadingChild = (f: Fixture, questionId: string) =>
    applyAgentMutation(
      f.repo,
      identityA,
      A,
      {
        action: {
          type: "edit_question",
          questionId,
          childId: "child-1",
          patch: { explanation: "依原文救援行動判斷。" },
        },
      },
      "mcp",
    );
  async function seedInvalidGeneration(f: Fixture) {
    const operationId = randomUUID();
    const receipt = await applyAgentMutation(
      f.repo,
      identityA,
      A,
      {
        operationId,
        action: {
          type: "generated_questions",
          kind: "vocabulary",
          difficulty: 2,
          output: {
            items: Array.from({ length: 25 }, (_, i) => ({
              itemId: `invalid-${i}`,
              senseId: "foreign",
              sentence: "They rescue people.",
              answer: "rescue",
              distractors: ["ignore", "delay", "watch"],
            })),
          },
        },
      },
      "mcp",
    );
    return { operationId, receipt };
  }

  it("appending an example to a sense keeps its other examples and the sibling sense", async () => {
    const f = await fixture();
    try {
      const seed = await seedRescue(f);
      await editSense(f, seed, { appendExamples: ["An appended example."] });
      const updated = (await f.repo.read("a", A))!.words[0];
      expect(updated.senses[0].examples).toEqual([
        "An existing example.",
        "An appended example.",
      ]);
      expect(updated.senses[1]).toEqual(seed.word.senses[1]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("sets a sense description without changing its meaning", async () => {
    const f = await fixture();
    try {
      const seed = await seedRescue(f);
      await editSense(f, seed, { description: "常用被動 be rescued from" });
      expect((await f.repo.read("a", A))!.words[0].senses[0]).toMatchObject({
        id: seed.sense.id,
        meaningZh: "救援",
        description: "常用被動 be rescued from",
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("clears a sense description with an empty string", async () => {
    const f = await fixture();
    try {
      const seed = await seedRescue(f);
      await editSense(f, seed, { description: "常用被動 be rescued from" });
      await editSense(f, seed, { description: "" });
      expect(
        (await f.repo.read("a", A))!.words[0].senses[0],
      ).not.toHaveProperty("description");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("patching one reading child keeps the passage and sibling children", async () => {
    const f = await fixture();
    try {
      const { pack, parent } = await seedReadingPack(f);
      await patchReadingChild(f, pack.id);
      const after = (await f.repo.read("a", A))!.questions[0];
      if (parent.kind !== "reading" || after.kind !== "reading")
        throw new Error("expected a reading pack");
      expect(after.passage).toBe(parent.passage);
      expect(after.questions[0]).toEqual(parent.questions[0]);
      expect(after.questions[2]).toEqual(parent.questions[2]);
      expect(after.questions[1].explanation).toBe("依原文救援行動判斷。");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("summarizes a reading question without its passage or children", async () => {
    const f = await fixture();
    try {
      const { pack } = await seedReadingPack(f);
      const summary = await readAgentResource(f.repo, identityA, {
        resource: "question",
        setId: A,
        questionId: pack.id,
      });
      expect(summary.question).not.toHaveProperty("passage");
      expect(summary.question).not.toHaveProperty("questions");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reads one reading child by its range", async () => {
    const f = await fixture();
    try {
      const { pack } = await seedReadingPack(f);
      expect(
        await readAgentResource(f.repo, identityA, {
          resource: "questions",
          setId: A,
          questionId: pack.id,
          from: 2,
          to: 2,
        }),
      ).toMatchObject({ items: [{ id: "child-1" }] });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("projects the requested fields of a patched reading child", async () => {
    const f = await fixture();
    try {
      const { pack } = await seedReadingPack(f);
      await patchReadingChild(f, pack.id);
      expect(
        await readAgentResource(f.repo, identityA, {
          resource: "question",
          setId: A,
          questionId: pack.id,
          childId: "child-1",
          fields: ["id", "explanation"],
        }),
      ).toMatchObject({
        child: { id: "child-1", explanation: "依原文救援行動判斷。" },
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reports one error for every invalid generated item", async () => {
    const f = await fixture();
    try {
      const { receipt } = await seedInvalidGeneration(f);
      expect(receipt.errors).toHaveLength(25);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("summarizes an operation with its error count and a more-errors flag", async () => {
    const f = await fixture();
    try {
      const { operationId } = await seedInvalidGeneration(f);
      expect(
        await readAgentResource(f.repo, identityA, {
          resource: "operation",
          setId: A,
          operationId,
        }),
      ).toMatchObject({
        errorCount: 25,
        hasMoreErrors: true,
        errors: expect.any(Array),
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("pages operation diagnostics by range", async () => {
    const f = await fixture();
    try {
      const { operationId } = await seedInvalidGeneration(f);
      const diagnostics = await readAgentResource(f.repo, identityA, {
        resource: "diagnostics",
        setId: A,
        operationId,
        from: 11,
        to: 15,
      });
      expect(diagnostics).toMatchObject({
        total: 25,
        from: 11,
        to: 15,
        items: [
          { itemId: "invalid-10" },
          { itemId: "invalid-11" },
          { itemId: "invalid-12" },
          { itemId: "invalid-13" },
          { itemId: "invalid-14" },
        ],
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("hides an operation from an identity scoped to another set", async () => {
    const f = await fixture();
    try {
      const { operationId } = await seedInvalidGeneration(f);
      await expect(
        readAgentResource(
          f.repo,
          { ...identityA, setId: B },
          { resource: "operation", operationId },
        ),
      ).rejects.toMatchObject({ code: "operation_not_found" });
    } finally {
      await f.runtime.dispose();
    }
  });
  async function seedGeneration(f: Fixture) {
    const { word, sense } = await seedRescue(f);
    const before = (await f.repo.read("a", A))!;
    const items = Array.from({ length: 100 }, (_, i) => ({
      itemId: `candidate-${i}`,
      senseId: sense.id,
      sentence: `They rescue stranded hikers during emergency number ${i}.`,
      answer: "rescue",
      distractors: ["ignore", "delay", "watch"],
    }));
    items[17].senseId = "sense-foreign" as typeof sense.id;
    items[42].distractors[0] = "rescue";
    items[75].sentence = "They went home before midnight.";
    const generation = {
      kind: "vocabulary" as const,
      difficulty: 2 as const,
      output: { items },
    };
    return { word, sense, before, generation };
  }
  async function putCollidingQuestions(f: Fixture) {
    const { word, sense } = await seedRescue(f);
    const other = mutateAgentSet(createAgentSet(randomUUID(), "同帳號另一集"), {
      type: "put_words",
      words: [{ word: "rescue", senses: [{ pos: "v.", meaningZh: "救援" }] }],
    }).snapshot!;
    const foreign = {
      id: "occupied-question",
      kind: "multipleChoice",
      questionStyle: "vocabulary",
      difficulty: 2,
      prompt: "They _____ the hikers.",
      options: ["rescue", "ignore", "delay", "watch"],
      answerIndex: 0,
      wordKey: other.words[0].wordKey,
      senseId: other.words[0].senses[0].id,
    };
    await f.repo.create("a", other);
    await applyAgentMutation(
      f.repo,
      identityA,
      other.set.id,
      { action: { type: "put_questions", questions: [foreign] } },
      "mcp",
    );
    const collision = await applyAgentMutation(
      f.repo,
      identityA,
      A,
      {
        action: {
          type: "put_questions",
          questions: [
            { ...foreign, wordKey: word.wordKey, senseId: sense.id },
            {
              ...foreign,
              id: "allowed-question",
              wordKey: word.wordKey,
              senseId: sense.id,
            },
          ],
        },
      },
      "mcp",
    );
    return { other, collision };
  }

  it("dry-run validation counts valid and failed generated items", async () => {
    const f = await fixture();
    try {
      const { generation } = await seedGeneration(f);
      expect(
        await validateGeneratedQuestions(f.repo, identityA, A, generation),
      ).toMatchObject({
        dryRun: true,
        savedCount: 0,
        validCount: 97,
        failedCount: 3,
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("dry-run validation does not write", async () => {
    const f = await fixture();
    try {
      const { generation } = await seedGeneration(f);
      const head = await accountRevision(f);
      await validateGeneratedQuestions(f.repo, identityA, A, generation);
      expect(await accountRevision(f)).toEqual(head);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("atomic mode rejects the whole generation when any item fails", async () => {
    const f = await fixture();
    try {
      const { before, generation } = await seedGeneration(f);
      const atomic = await applyAgentMutation(
        f.repo,
        identityA,
        A,
        {
          action: {
            type: "generated_questions",
            ...generation,
            mode: "atomic",
          },
        },
        "mcp",
      );
      expect(atomic).toMatchObject({
        status: "rejected",
        savedCount: 0,
        revision: agentSetRevision(before),
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("saves the 97 valid items of 100 as a partial success", async () => {
    const f = await fixture();
    try {
      const { generation } = await seedGeneration(f);
      const receipt = await applyAgentMutation(
        f.repo,
        identityA,
        A,
        { action: { type: "generated_questions", ...generation } },
        "mcp",
      );
      expect(receipt).toMatchObject({
        status: "partial_success",
        submittedCount: 100,
        savedCount: 97,
        failedCount: 3,
        questionCount: 97,
      });
      expect((await f.repo.read("a", A))!.questions).toHaveLength(97);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("replays a partial generation with the same receipt and no extra questions", async () => {
    const f = await fixture();
    try {
      const { generation } = await seedGeneration(f);
      const envelope = {
        operationId: randomUUID(),
        action: { type: "generated_questions", ...generation },
      };
      const receipt = await applyAgentMutation(
        f.repo,
        identityA,
        A,
        envelope,
        "mcp",
      );
      expect(
        await applyAgentMutation(f.repo, identityA, A, envelope, "mcp"),
      ).toEqual(receipt);
      expect((await f.repo.read("a", A))!.questions).toHaveLength(97);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("saves a question and fails one whose id belongs to another set", async () => {
    const f = await fixture();
    try {
      const { collision } = await putCollidingQuestions(f);
      expect(collision).toMatchObject({
        status: "partial_success",
        savedCount: 1,
        failedCount: 1,
        questionCount: 1,
      });
      expect(collision.errors?.[0].code).toBe("question_outside_scope");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("keeps a question id in the set that already owns it", async () => {
    const f = await fixture();
    try {
      const { other } = await putCollidingQuestions(f);
      expect((await f.repo.read("a", other.set.id))!.questions[0].id).toBe(
        "occupied-question",
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("returns no set to a user who does not own it", async () => {
    const f = await fixture();
    try {
      expect(await f.repo.read("b", A)).toBeNull();
    } finally {
      await f.runtime.dispose();
    }
  });
  it("stores 200 words, rejects 201 without writing, and reuses a receipt exactly", async () => {
    const f = await fixture();
    try {
      const before = (await f.repo.read("a", A))!;
      const revision = agentSetRevision(before),
        operationId = randomUUID();
      const action = { type: "put_words", words: words(200) };
      const receipt = await f.repo.mutate(
        "a",
        A,
        revision,
        operationId,
        action,
        (s) => mutateAgentSet(s, action),
      );
      const after = (await f.repo.read("a", A))!;
      expect(receipt.wordCount).toBe(200);
      expect(after.words).toHaveLength(200);
      expect(new Set(after.words.map((w) => w.wordKey)).size).toBe(200);
      expect(after.memberships).toHaveLength(200);
      expect(after.words.flatMap((w) => w.senses)).toHaveLength(200);
      expect(receipt.revision).toBe(agentSetRevision(after));
      expect(
        await f.repo.mutate("a", A, revision, operationId, action, () => {
          throw new Error("must not execute a replay");
        }),
      ).toEqual(receipt);
      const different = { type: "rename_set", setName: "不應寫入" };
      await expect(
        f.repo.mutate("a", A, revision, operationId, different, (s) =>
          mutateAgentSet(s, different),
        ),
      ).rejects.toThrow("operation_conflict");
      const oversized = { type: "put_words", words: words(201) };
      await expect(
        f.repo.mutate("a", A, receipt.revision, randomUUID(), oversized, (s) =>
          mutateAgentSet(s, oversized),
        ),
      ).rejects.toThrow(/too_big/);
      expect(agentSetRevision((await f.repo.read("a", A))!)).toBe(
        receipt.revision,
      );
      await expect(
        f.repo.mutate("a", A, revision, randomUUID(), different, (s) =>
          mutateAgentSet(s, different),
        ),
      ).rejects.toThrow("is stale");
      expect(await f.repo.read("b", A)).toBeNull();
      expect((await f.repo.list("a")).map((s) => s.id)).toEqual([A]);
      expect((await f.repo.list("b")).map((s) => s.id)).toEqual([B]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("allows only one mutation from a shared revision under concurrency", async () => {
    const f = await fixture();
    try {
      const revision = agentSetRevision((await f.repo.read("a", A))!);
      const actions = [
        { type: "rename_set", setName: "修改一" },
        { type: "rename_set", setName: "修改二" },
      ];
      const results = await Promise.allSettled(
        actions.map((action) =>
          f.repo.mutate("a", A, revision, randomUUID(), action, (s) =>
            mutateAgentSet(s, action),
          ),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(actions.map((a) => a.setName)).toContain(
        (await f.repo.read("a", A))!.set.setName,
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("applies concurrent writes without a revision and reports the current revision when one is stale", async () => {
    const f = await fixture();
    try {
      const stale = agentSetRevision((await f.repo.read("a", A))!);
      const results = await Promise.allSettled(
        [words(1), words(2).slice(1)].map((batch) =>
          f.repo.mutate(
            "a",
            A,
            undefined,
            randomUUID(),
            { type: "put_words", words: batch },
            (s) => mutateAgentSet(s, { type: "put_words", words: batch }),
          ),
        ),
      );
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
      const current = agentSetRevision((await f.repo.read("a", A))!);
      expect((await f.repo.read("a", A))!.words).toHaveLength(2);
      const action = { type: "rename_set", setName: "過期" };
      await expect(
        f.repo.mutate("a", A, stale, randomUUID(), action, (s) =>
          mutateAgentSet(s, action),
        ),
      ).rejects.toMatchObject({
        code: "stale_set",
        message: expect.stringContaining(current),
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  const mutateFolder = async (f: Fixture, action: AgentFolderMutation) => {
    const old = await f.repo.folders("a");
    return f.repo.mutateFolders("a", old.revision, randomUUID(), action);
  };
  async function seedFolders(f: Fixture) {
    const root = await mutateFolder(f, { type: "create_folder", name: "課程" });
    const rootId = root.folder!.id;
    const child = await mutateFolder(f, {
      type: "create_folder",
      name: "子層",
      parentId: rootId,
    });
    return { rootId, childId: child.folder!.id };
  }
  const moveSet = async (
    f: Fixture,
    uid: string,
    setId: string,
    folderId: string,
  ) => {
    const snapshot = (await f.repo.read(uid, setId))!;
    const move = { type: "move_set", folderId };
    return f.repo.mutate(
      uid,
      setId,
      agentSetRevision(snapshot),
      randomUUID(),
      move,
      (s) => mutateAgentSet(s, move),
    );
  };

  it("creates a folder", async () => {
    const f = await fixture();
    try {
      const before = await f.repo.folders("a");
      const root = await f.repo.mutateFolders(
        "a",
        before.revision,
        randomUUID(),
        { type: "create_folder", name: "課程" },
      );
      expect(root.folder?.name).toBe("課程");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("replays a folder creation with the same operation id", async () => {
    const f = await fixture();
    try {
      const before = await f.repo.folders("a"),
        operationId = randomUUID();
      const create: AgentFolderMutation = {
        type: "create_folder",
        name: "課程",
      };
      const root = await f.repo.mutateFolders(
        "a",
        before.revision,
        operationId,
        create,
      );
      expect(
        await f.repo.mutateFolders("a", before.revision, operationId, create),
      ).toEqual(root);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects an operation id reused for a different folder action", async () => {
    const f = await fixture();
    try {
      const before = await f.repo.folders("a"),
        operationId = randomUUID();
      await f.repo.mutateFolders("a", before.revision, operationId, {
        type: "create_folder",
        name: "課程",
      });
      await expect(
        f.repo.mutateFolders("a", before.revision, operationId, {
          type: "create_folder",
          name: "不同操作",
        }),
      ).rejects.toThrow("operation_conflict");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a folder mutation from a stale revision", async () => {
    const f = await fixture();
    try {
      const before = await f.repo.folders("a");
      await mutateFolder(f, { type: "create_folder", name: "課程" });
      await expect(
        f.repo.mutateFolders("a", before.revision, randomUUID(), {
          type: "create_folder",
          name: "舊版本",
        }),
      ).rejects.toThrow("stale_folders");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a duplicate folder name", async () => {
    const f = await fixture();
    try {
      await seedFolders(f);
      await expect(
        mutateFolder(f, { type: "create_folder", name: "課程" }),
      ).rejects.toThrow("already exists at this level");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a folder with a missing parent", async () => {
    const f = await fixture();
    try {
      await expect(
        mutateFolder(f, {
          type: "create_folder",
          name: "子層",
          parentId: "missing",
        }),
      ).rejects.toThrow("does not exist or cannot be a parent");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects moving a folder under its own child", async () => {
    const f = await fixture();
    try {
      const { rootId, childId } = await seedFolders(f);
      await expect(
        mutateFolder(f, {
          type: "update_folder",
          folderId: rootId,
          parentId: childId,
        }),
      ).rejects.toThrow("cannot be moved into itself");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects making a folder its own parent", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      await expect(
        mutateFolder(f, {
          type: "update_folder",
          folderId: rootId,
          parentId: rootId,
        }),
      ).rejects.toThrow("cannot be moved into itself");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects deleting a folder that has a child", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      await expect(
        mutateFolder(f, { type: "delete_folder", folderId: rootId }),
      ).rejects.toThrow("Folder is not empty");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("renames a child folder and moves it to the root with a null parent", async () => {
    const f = await fixture();
    try {
      const { childId } = await seedFolders(f);
      const renamed = await mutateFolder(f, {
        type: "update_folder",
        folderId: childId,
        name: "獨立單元",
        parentId: null,
      });
      expect(renamed.folder?.name).toBe("獨立單元");
      expect(renamed.folder?.parentId).toBeUndefined();
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects renaming a root folder to an existing root name", async () => {
    const f = await fixture();
    try {
      const { childId } = await seedFolders(f);
      await mutateFolder(f, {
        type: "update_folder",
        folderId: childId,
        name: "獨立單元",
        parentId: null,
      });
      await expect(
        mutateFolder(f, {
          type: "update_folder",
          folderId: childId,
          name: "課程",
        }),
      ).rejects.toThrow("already exists at this level");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("does not list one user's folder for another user", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      const foldersB = await f.repo.folders("b");
      expect(foldersB.folders.some((folder) => folder.id === rootId)).toBe(
        false,
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects another user updating a folder", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      const foldersB = await f.repo.folders("b");
      await expect(
        f.repo.mutateFolders("b", foldersB.revision, randomUUID(), {
          type: "update_folder",
          folderId: rootId,
          name: "跨使用者",
        }),
      ).rejects.toThrow("not found or not editable");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects moving a set to a missing folder", async () => {
    const f = await fixture();
    try {
      await expect(moveSet(f, "a", A, "missing")).rejects.toThrow(
        "folder_not_found",
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("moves a set into a folder", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      await moveSet(f, "a", A, rootId);
      expect((await f.repo.read("a", A))!.set.folderId).toBe(rootId);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects deleting a folder that holds a set", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      await moveSet(f, "a", A, rootId);
      await expect(
        mutateFolder(f, { type: "delete_folder", folderId: rootId }),
      ).rejects.toThrow("Folder is not empty");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects another user moving their set into a folder they do not own", async () => {
    const f = await fixture();
    try {
      const { rootId } = await seedFolders(f);
      await expect(moveSet(f, "b", B, rootId)).rejects.toThrow(
        "folder_not_found",
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("deletes a folder once its set is moved back to uncategorized", async () => {
    const f = await fixture();
    try {
      const { rootId, childId } = await seedFolders(f);
      await moveSet(f, "a", A, rootId);
      await moveSet(f, "a", A, UNCATEGORIZED_FOLDER_ID);
      await mutateFolder(f, { type: "delete_folder", folderId: childId });
      const deleted = await mutateFolder(f, {
        type: "delete_folder",
        folderId: rootId,
      });
      expect(deleted.folder).toBeNull();
      expect(deleted.folders.some((folder) => folder.id === rootId)).toBe(
        false,
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("leaves another user's set untouched when folders are deleted", async () => {
    const f = await fixture();
    try {
      const { rootId, childId } = await seedFolders(f);
      await mutateFolder(f, { type: "delete_folder", folderId: childId });
      await mutateFolder(f, { type: "delete_folder", folderId: rootId });
      expect((await f.repo.read("b", B))!.set.setName).toBe("合成 B");
    } finally {
      await f.runtime.dispose();
    }
  });
  const seedMcpWords = (f: Fixture, count = 3) =>
    mcpCall(f.repo, "write", {
      setId: A,
      action: { type: "put_words", words: words(count) },
    });

  it("lists the five compact MCP tools in order", async () => {
    const f = await fixture();
    try {
      const list = await mcpRpc(f.repo, "tools/list", {});
      expect(list.result.tools.map((tool) => tool.name)).toEqual([
        "read",
        "create_set",
        "write",
        "validate",
        "delete",
      ]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("keeps the tool descriptions and instructions within the size budget", async () => {
    const f = await fixture();
    try {
      const list = await mcpRpc(f.repo, "tools/list", {});
      // Clients often drop server instructions, so tool schemas carry the
      // action and request vocabulary; keep the whole per-conversation cost small.
      // The text is English: about 2400 tokens at roughly 3.6 characters each.
      const listed = JSON.stringify(list.result);
      expect(listed.length + AGENT_INSTRUCTIONS.length).toBeLessThan(9000);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("carries the action and request vocabulary in the tool schemas", async () => {
    const f = await fixture();
    try {
      const listed = JSON.stringify(
        (await mcpRpc(f.repo, "tools/list", {})).result,
      );
      for (const name of [
        "put_words",
        "edit_sense",
        "delete_words",
        "resource",
        "nextCursor",
      ])
        expect(listed).toContain(name);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("keeps the read tool fields in step with the query schema", () => {
    expect(Object.keys(readRequest.shape).sort()).toEqual(
      Object.keys(querySchema.shape).sort(),
    );
  });

  it("explains a read request that names its resource with type", async () => {
    const f = await fixture();
    try {
      const misnamed = await mcpRaw(f.repo, "read", {
        requests: [{ type: "sets" }],
      });
      expect(misnamed.isError).toBe(true);
      expect(misnamed.text).toContain("resource");
      expect(misnamed.text).toContain("type");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("lists the valid resources when a read names an unknown one", async () => {
    const f = await fixture();
    try {
      const badResource = await mcpRaw(f.repo, "read", {
        requests: [{ resource: "nope" }],
      });
      expect(badResource.text).toContain('"diagnostics"');
    } finally {
      await f.runtime.dispose();
    }
  });

  it("lists the valid actions when a write names an unknown one", async () => {
    const f = await fixture();
    try {
      const badAction = await mcpRaw(f.repo, "write", {
        setId: A,
        action: { type: "addWords" },
      });
      expect(badAction.isError).toBe(true);
      expect(badAction.text).toContain("put_words");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reports the path of an invalid words payload", async () => {
    const f = await fixture();
    try {
      const badWords = await mcpCall(f.repo, "write", {
        setId: A,
        action: { type: "put_words", words: [{ word: "x" }] },
      });
      expect(badWords.isError).toBe(true);
      expect((badWords.data.error as { message: string }).message).toMatch(
        /^words\.0\.senses: /,
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("points an invalid validate output at the output schema", async () => {
    const f = await fixture();
    try {
      const savedShape = await mcpCall(f.repo, "validate", {
        setId: A,
        kind: "vocabulary",
        output: { items: [{ prompt: "x", options: ["a"], answerIndex: 0 }] },
      });
      expect(savedShape.data.hint).toContain("outputSchema");
      expect(
        (savedShape.data.errors as { message: string }[])[0].message,
      ).not.toMatch(/^\s*\[/);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("writes words through the write tool", async () => {
    const f = await fixture();
    try {
      const saved = await seedMcpWords(f);
      expect(saved.isError).toBe(false);
      expect(saved.data.wordCount).toBe(3);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reads words and the set summary in one read call", async () => {
    const f = await fixture();
    try {
      await seedMcpWords(f);
      const read = await mcpCall(f.repo, "read", {
        requests: [
          { resource: "words", setId: A, fields: ["wordKey", "word"] },
          { resource: "set", setId: A },
        ],
      });
      const results = read.data.results as {
        data: { items?: { wordKey: string }[]; wordCount?: number };
      }[];
      expect(results[0].data.items).toHaveLength(3);
      expect(results[1].data.wordCount).toBe(3);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a set-level action sent to write and leaves the words alone", async () => {
    const f = await fixture();
    try {
      await seedMcpWords(f);
      const misplaced = await mcpRaw(f.repo, "write", {
        setId: A,
        action: { type: "delete_set" },
      });
      expect(misplaced.isError).toBe(true);
      expect(misplaced.text).toContain("rename_set");
      expect((await f.repo.read("a", A))?.words).toHaveLength(3);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects a write from a user who does not own the set", async () => {
    const f = await fixture();
    try {
      const outsider = await mcpCall(
        f.repo,
        "write",
        { setId: A, action: { type: "put_words", words: words(1) } },
        "b",
      );
      expect(outsider.isError).toBe(true);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("creates a folder through the write tool", async () => {
    const f = await fixture();
    try {
      const folder = await mcpCall(f.repo, "write", {
        action: { type: "create_folder", name: "MCP" },
      });
      expect(folder.isError).toBe(false);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("deletes words through the delete tool", async () => {
    const f = await fixture();
    try {
      await seedMcpWords(f);
      const wordKey = (await f.repo.read("a", A))!.words[0].wordKey;
      const removed = await mcpCall(f.repo, "delete", {
        setId: A,
        action: { type: "delete_words", wordKeys: [wordKey] },
      });
      expect(removed.isError).toBe(false);
      expect((await f.repo.read("a", A))?.words).toHaveLength(2);
    } finally {
      await f.runtime.dispose();
    }
  });
  async function seedRefWords(f: Fixture) {
    await mcpCall(f.repo, "write", {
      setId: A,
      action: {
        type: "put_words",
        words: ["tense", "campaign", "situation", "pigment", "disclose"].map(
          (word) => ({ word, senses: [{ pos: "v.", meaningZh: word }] }),
        ),
      },
    });
  }
  async function secondPageSource(f: Fixture) {
    const first = await readAgentResource(f.repo, identityA, {
      resource: "sources",
      setId: A,
      kind: "vocabulary",
      limit: 2,
    });
    const second = await readAgentResource(f.repo, identityA, {
      resource: "sources",
      setId: A,
      kind: "vocabulary",
      limit: 2,
      cursor: first.nextCursor,
    });
    return (
      second.items as {
        ref: string;
        word: string;
        wordKey: string;
        senseId: string;
      }[]
    )[0];
  }
  async function writeRefQuestion(f: Fixture) {
    await seedRefWords(f);
    const source = await secondPageSource(f);
    const written = await mcpCall(f.repo, "write", {
      setId: A,
      action: {
        type: "generated_questions",
        kind: "vocabulary",
        difficulty: 1,
        output: {
          items: [
            {
              ref: source.ref,
              sentence: `They will ${source.word} the plan to Lily tomorrow.`,
              answer: source.word,
              distractors: ["ignore", "delay", "watch"],
            },
          ],
        },
      },
    });
    return { source, written, stored: (await f.repo.read("a", A))!.questions };
  }

  it("ignores unknown response fields and lists the available ones", async () => {
    const f = await fixture();
    try {
      const fielded = await mcpCall(f.repo, "write", {
        setId: A,
        responseFields: ["words"],
        action: {
          type: "put_words",
          words: [
            { word: "gather", senses: [{ pos: "v.", meaningZh: "聚集" }] },
          ],
        },
      });
      expect(fielded.data).toMatchObject({
        operationId: expect.any(String),
        revision: expect.any(String),
        unknownResponseFields: ["words"],
        availableResponseFields: expect.arrayContaining(["wordCount"]),
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reports requested read fields that do not exist", async () => {
    const f = await fixture();
    try {
      await seedRefWords(f);
      const unknownField = await mcpCall(f.repo, "read", {
        requests: [
          { resource: "words", setId: A, fields: ["word", "spelling"] },
        ],
      });
      expect(unknownField.data).toMatchObject({
        results: [{ data: { fieldsNotFound: ["spelling"] } }],
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("uses the sense id as the brief ref on a later sources page", async () => {
    const f = await fixture();
    try {
      await seedRefWords(f);
      const source = await secondPageSource(f);
      expect(source.ref).toBe(source.senseId);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("saves a question from a brief ref taken from a later sources page", async () => {
    const f = await fixture();
    try {
      const { source, written, stored } = await writeRefQuestion(f);
      expect(written.data).toMatchObject({ savedCount: 1 });
      expect(stored).toEqual([
        expect.objectContaining({ senseId: source.senseId }),
      ]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("points edit_question hints at its own patch format", async () => {
    const f = await fixture();
    try {
      const { stored } = await writeRefQuestion(f);
      const edited = await mcpCall(f.repo, "write", {
        setId: A,
        action: {
          type: "edit_question",
          questionId: stored[0].id,
          patch: { distractors: ["forbid", "remind", "pay"] },
        },
      });
      expect(String(edited.data.hint)).toContain("edit_question patches");
    } finally {
      await f.runtime.dispose();
    }
  });

  it("searches the sentence of a restored question", async () => {
    const f = await fixture();
    try {
      const { source, stored } = await writeRefQuestion(f);
      const found = await mcpCall(f.repo, "read", {
        requests: [
          { resource: "questions", setId: A, q: `${source.word} the plan` },
        ],
      });
      expect(found.data).toMatchObject({
        results: [{ data: { items: [{ id: stored[0].id }] } }],
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("reports the questions removed when their word is deleted", async () => {
    const f = await fixture();
    try {
      const { source, stored } = await writeRefQuestion(f);
      const cascade = await mcpCall(f.repo, "delete", {
        setId: A,
        action: { type: "delete_words", wordKeys: [source.wordKey] },
      });
      expect(cascade.data).toMatchObject({
        removedQuestionCount: 1,
        removedQuestionIds: [stored[0].id],
      });
    } finally {
      await f.runtime.dispose();
    }
  });
});

describe("cloud operation receipt retention", () => {
  it("deletes receipts older than thirty days and keeps recent ones", async () => {
    const f = await fixture();
    try {
      const now = Date.parse("2026-10-20T00:00:00.000Z");
      const stale = new Date(
        now - CLOUD_OPERATION_RETENTION_MS - 1,
      ).toISOString();
      const recent = new Date(now - 1_000).toISOString();
      const receipt = JSON.stringify({ revision: 1 });
      // The fixture's own set creation also leaves receipts behind.
      await f.db.prepare("DELETE FROM cloud_operations").run();
      await f.db.batch([
        f.db
          .prepare(
            "INSERT INTO cloud_operations(uid,operation_id,input_hash,result,created_at) VALUES(?,?,?,?,?)",
          )
          .bind("a", "stale-operation", "hash", receipt, stale),
        f.db
          .prepare(
            "INSERT INTO cloud_operations(uid,operation_id,input_hash,result,created_at) VALUES(?,?,?,?,?)",
          )
          .bind("a", "recent-operation", "hash", receipt, recent),
      ]);
      await purgeCloudOperations(f.db, now);
      const rows = await f.db
        .prepare(
          "SELECT operation_id FROM cloud_operations ORDER BY operation_id",
        )
        .all();
      expect(rows.results).toEqual([{ operation_id: "recent-operation" }]);
    } finally {
      await f.runtime.dispose();
    }
  });
});

describe("frontend synchronization API using the same native D1 records", () => {
  const syncOrigin = randomUUID();
  const syncPush = async (
    f: Fixture,
    uid: string,
    records: AgentCloudRecord[],
    operationId = randomUUID(),
  ) => {
    const response = await handleCloudApi(
      new Request("http://local.invalid/sync/records", {
        method: "POST",
        body: JSON.stringify({ origin: syncOrigin, operationId, records }),
      }),
      uid,
      f.db,
    );
    return response.json() as Promise<{ revision: number; count: number }>;
  };
  const syncPull = async (f: Fixture, uid: string, cursor = "") => {
    const response = await handleCloudApi(
      new Request(
        `http://local.invalid/sync/records?cursor=${encodeURIComponent(cursor)}`,
      ),
      uid,
      f.db,
    );
    return response.json() as Promise<{
      records: AgentCloudRecord[];
      cursor: string;
      hasMore: boolean;
    }>;
  };
  const syncSetRecords = (count: number) =>
    Array.from({ length: count }, (_, i) => {
      const snapshot = createAgentSet(randomUUID(), `同步合成 ${i}`);
      return [...snapshotRecords(snapshot).values()].find(
        (r) => r.type === "set",
      )!;
    });
  async function pushAllRecords(f: Fixture, records: AgentCloudRecord[]) {
    await syncPush(f, "a", records.slice(0, 400));
    await syncPush(f, "a", records.slice(400));
  }

  it("pushes a batch of 400 records and counts them", async () => {
    const f = await fixture();
    try {
      const first = await syncPush(f, "a", syncSetRecords(400));
      expect(first.count).toBe(400);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("replays a push with the same operation id", async () => {
    const f = await fixture();
    try {
      const records = syncSetRecords(400),
        operationId = randomUUID(),
        first = await syncPush(f, "a", records, operationId);
      expect(await syncPush(f, "a", records, operationId)).toEqual(first);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects an operation id reused for different records", async () => {
    const f = await fixture();
    try {
      const records = syncSetRecords(2),
        operationId = randomUUID();
      await syncPush(f, "a", records.slice(0, 1), operationId);
      await expect(
        syncPush(f, "a", records.slice(1), operationId),
      ).rejects.toMatchObject({ code: "operation_conflict" });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("paginates a pull over 404 unique records", async () => {
    const f = await fixture();
    try {
      await pushAllRecords(f, syncSetRecords(402));
      const page1 = await syncPull(f, "a");
      expect(page1.records).toHaveLength(400);
      expect(page1.hasMore).toBe(true);
      const page2 = await syncPull(f, "a", page1.cursor);
      expect(page2.hasMore).toBe(false);
      const all = [...page1.records, ...page2.records];
      expect(all).toHaveLength(404);
      expect(new Set(all.map((r) => `${r.type}:${r.recordKey}`)).size).toBe(
        404,
      );
    } finally {
      await f.runtime.dispose();
    }
  });

  it("returns no records when pulling from the last cursor", async () => {
    const f = await fixture();
    try {
      await pushAllRecords(f, syncSetRecords(402));
      const page1 = await syncPull(f, "a");
      const page2 = await syncPull(f, "a", page1.cursor);
      expect((await syncPull(f, "a", page2.cursor)).records).toEqual([]);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("keeps one user's pushed records out of another user's pull", async () => {
    const f = await fixture();
    try {
      await pushAllRecords(f, syncSetRecords(402));
      const other = await syncPull(f, "b");
      expect(other.records).toHaveLength(2);
      expect(other.records.some((r) => r.recordKey === A)).toBe(false);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("exposes a deleted record as a tombstone after the last cursor", async () => {
    const f = await fixture();
    try {
      const records = syncSetRecords(402);
      await pushAllRecords(f, records);
      const page1 = await syncPull(f, "a");
      const page2 = await syncPull(f, "a", page1.cursor);
      await syncPush(f, "a", [{ ...records[0], deleted: true, payload: null }]);
      const deletion = await syncPull(f, "a", page2.cursor);
      expect(deletion.records).toHaveLength(1);
      expect(deletion.records[0]).toMatchObject({
        recordKey: records[0].recordKey,
        deleted: true,
        payload: null,
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("removes a deleted set from the library list", async () => {
    const f = await fixture();
    try {
      const [record] = syncSetRecords(1);
      await syncPush(f, "a", [record]);
      expect(
        (await f.repo.list("a")).some((s) => s.id === record.recordKey),
      ).toBe(true);
      await syncPush(f, "a", [{ ...record, deleted: true, payload: null }]);
      expect(
        (await f.repo.list("a")).some((s) => s.id === record.recordKey),
      ).toBe(false);
    } finally {
      await f.runtime.dispose();
    }
  });

  it("rejects an invalid pull cursor", async () => {
    const f = await fixture();
    try {
      await expect(syncPull(f, "a", "broken")).rejects.toMatchObject({
        code: "invalid_cursor",
      });
    } finally {
      await f.runtime.dispose();
    }
  });

  it("round trips frontend and Agent writes, and applies blob revision and operation checks", async () => {
    const f = await fixture();
    try {
      const origin = randomUUID(),
        snapshot = mutateAgentSet(createAgentSet(randomUUID(), "前端建立"), {
          type: "put_words",
          words: words(2),
        }).snapshot!;
      const response = await handleCloudApi(
        new Request("http://local.invalid/sync/records", {
          method: "POST",
          body: JSON.stringify({
            origin,
            operationId: randomUUID(),
            records: [...snapshotRecords(snapshot).values()],
          }),
        }),
        "a",
        f.db,
      );
      expect(response.status).toBe(200);
      const read = (await f.repo.read("a", snapshot.set.id))!;
      expect(read.words.map((w) => w.word).sort()).toEqual(
        snapshot.words.map((w) => w.word).sort(),
      );
      const action = { type: "rename_set", setName: "Agent 改名" };
      const operationId = randomUUID();
      await f.repo.mutate(
        "a",
        snapshot.set.id,
        agentSetRevision(read),
        operationId,
        action,
        (s) => mutateAgentSet(s, action),
      );
      const pull = await handleCloudApi(
        new Request("http://local.invalid/sync/records"),
        "a",
        f.db,
      );
      const feed = (await pull.json()) as { records: AgentCloudRecord[] };
      expect(
        feed.records.find(
          (r) => r.type === "set" && r.recordKey === snapshot.set.id,
        )?.payload?.setName,
      ).toBe("Agent 改名");
      const status = await handleCloudApi(
        new Request("http://local.invalid/sync/status"),
        "a",
        f.db,
      );
      expect(((await status.json()) as { changedBy: string }).changedBy).toBe(
        `agent:${operationId}`,
      );
      const blobOperation = randomUUID();
      const envelope = {
        origin,
        operationId: blobOperation,
        expectedRevision: 0,
        blobs: [
          {
            kind: "preferences",
            data: {
              schemaVersion: 1,
              model: DEFAULT_AI_MODEL,
              updatedAt: new Date().toISOString(),
            },
          },
        ],
      };
      const post = async (value: unknown, uid = "a") => {
        const result = await handleCloudApi(
          new Request("http://local.invalid/sync/blobs", {
            method: "POST",
            body: JSON.stringify(value),
          }),
          uid,
          f.db,
        );
        return result.json();
      };
      expect(await post(envelope)).toEqual({ revision: 1 });
      expect(await post(envelope)).toEqual({ revision: 1 });
      await expect(
        post({ ...envelope, expectedRevision: 1 }),
      ).rejects.toMatchObject({ code: "operation_conflict" });
      await expect(
        post({ ...envelope, operationId: randomUUID() }),
      ).rejects.toMatchObject({ code: "cloud_conflict" });
      const blobs = await handleCloudApi(
        new Request("http://local.invalid/sync/blobs"),
        "a",
        f.db,
      );
      const persisted = (await blobs.json()) as {
        revision: number;
        blobs: { preferences: { ownerId: string; schemaVersion: number } };
      };
      expect(persisted.revision).toBe(1);
      expect(persisted.blobs.preferences).toMatchObject({
        ownerId: "a",
        schemaVersion: 1,
      });
      const other = await handleCloudApi(
        new Request("http://local.invalid/sync/blobs"),
        "b",
        f.db,
      );
      expect(await other.json()).toEqual({ blobs: {}, revision: 0 });
      await expect(
        post({
          ...envelope,
          operationId: randomUUID(),
          expectedRevision: 1,
          blobs: [
            { kind: "preferences", data: {} },
            { kind: "preferences", data: {} },
          ],
        }),
      ).rejects.toMatchObject({ code: "duplicate_blob" });
      const practiceAt = new Date().toISOString();
      expect(
        await post({
          ...envelope,
          operationId: randomUUID(),
          expectedRevision: 1,
          blobs: [
            {
              kind: "practice",
              data: { updatedAt: practiceAt, snapshot: { index: 3 } },
            },
          ],
        }),
      ).toEqual({ revision: 2 });
      const withPractice = (await (
        await handleCloudApi(
          new Request("http://local.invalid/sync/blobs"),
          "a",
          f.db,
        )
      ).json()) as { blobs: Record<string, unknown> };
      expect(withPractice.blobs.practice).toEqual({
        updatedAt: practiceAt,
        snapshot: { index: 3 },
        ownerId: "a",
        schemaVersion: 1,
      });
      await expect(
        post({
          ...envelope,
          operationId: randomUUID(),
          expectedRevision: 2,
          blobs: [{ kind: "practice", data: { snapshot: null } }],
        }),
      ).rejects.toThrow();
    } finally {
      await f.runtime.dispose();
    }
  });
});

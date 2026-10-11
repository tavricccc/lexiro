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
  it("queries bounded ranges, cursors, projected fields and mixed searches in one request", async () => {
    const f = await fixture();
    try {
      const identity = { uid: "a", email: "synthetic@example.invalid" };
      await applyAgentMutation(
        f.repo,
        identity,
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
          identity,
          A,
          { action: { type: "put_questions", questions: [question] } },
          "mcp",
        ),
      ).toMatchObject({ savedCount: 1 });
      const page = await readAgentResource(f.repo, identity, {
        resource: "words",
        setId: A,
        from: 11,
        to: 15,
        fields: ["wordKey", "word", "senses.id"],
      });
      expect(page).toMatchObject({ from: 11, to: 15, hasMore: true });
      expect(page.items).toHaveLength(5);
      expect(page.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            senses: [expect.objectContaining({ id: expect.any(String) })],
          }),
        ]),
      );
      const next = await readAgentResource(f.repo, identity, {
        resource: "words",
        setId: A,
        cursor: page.nextCursor,
        limit: 5,
      });
      expect(next).toMatchObject({ from: 16, to: 20 });
      expect(JSON.stringify(next)).not.toContain("examples");
      await expect(
        readAgentResource(f.repo, identity, {
          resource: "words",
          setId: A,
          cursor: page.nextCursor,
          q: "another",
        }),
      ).rejects.toMatchObject({ code: "cursor_outside_query" });
      await expect(
        readAgentResource(
          f.repo,
          { ...identity, uid: "b" },
          { resource: "words", setId: A },
        ),
      ).rejects.toMatchObject({ code: "set_not_found" });
      const request = {
        resource: "words",
        setId: A,
        q: "合成項目17",
        fields: ["word", "senses.meaningZh"],
      };
      const batch = await readAgentBatch(f.repo, identity, {
        requests: [
          request,
          {
            resource: "questions",
            setId: A,
            q: "school",
            questionType: "vocabulary",
            difficulty: 2,
          },
          { resource: "questions", setId: A, questionType: "reading" },
          request,
          { resource: "unknown" },
        ],
      });
      expect(batch.results[0]).toMatchObject({
        data: {
          items: [
            { word: "synthetic-017", senses: [{ meaningZh: "合成項目17" }] },
          ],
        },
      });
      expect(batch.results[1]).toMatchObject({
        data: {
          items: [{ id: "search-question", questionType: "vocabulary" }],
        },
      });
      expect(batch.results[2]).toMatchObject({ data: { items: [] } });
      expect(
        await readAgentResource(f.repo, identity, {
          resource: "questions",
          setId: A,
          q: "visit",
        }),
      ).toMatchObject({ items: [{ id: "search-question" }] });
      expect(
        await readAgentResource(f.repo, identity, {
          resource: "questions",
          setId: A,
          fields: ["id", "explanation"],
        }),
      ).toMatchObject({ items: [{ id: "search-question" }] });
      expect(batch.results[3]).toMatchObject({ reference: 0 });
      expect(batch.results[4]).toHaveProperty("error.code", "invalid_query");
      const budget = await readAgentBatch(f.repo, identity, {
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
      await expect(
        readAgentBatch(
          f.repo,
          { ...identity, setId: A },
          { requests: [{ resource: "set", setId: B }] },
        ),
      ).resolves.toMatchObject({
        results: [{ error: { code: "set_outside_scope" } }],
      });
    } finally {
      await f.runtime.dispose();
    }
  });
  it("patches a single sense or child while preserving its siblings and retrieves bounded diagnostics", async () => {
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
      const snapshot = (await f.repo.read("a", A))!,
        word = snapshot.words[0],
        sense = word.senses[0];
      await applyAgentMutation(
        f.repo,
        identity,
        A,
        {
          action: {
            type: "edit_sense",
            wordKey: word.wordKey,
            senseId: sense.id,
            patch: { appendExamples: ["An appended example."] },
          },
        },
        "mcp",
      );
      const updated = (await f.repo.read("a", A))!.words[0];
      expect(updated.senses[0].examples).toEqual([
        "An existing example.",
        "An appended example.",
      ]);
      expect(updated.senses[1]).toEqual(word.senses[1]);
      const pack = {
        id: "reading-parent",
        kind: "reading",
        format: "reading",
        difficulty: 2,
        title: "A synthetic rescue",
        passage:
          "The team arrived at the mountain and rescued the lost hikers.",
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
          identity,
          A,
          { action: { type: "put_questions", questions: [pack] } },
          "mcp",
        ),
      ).toMatchObject({ savedCount: 1 });
      const parent = (await f.repo.read("a", A))!.questions[0];
      await applyAgentMutation(
        f.repo,
        identity,
        A,
        {
          action: {
            type: "edit_question",
            questionId: pack.id,
            childId: "child-1",
            patch: { explanation: "依原文救援行動判斷。" },
          },
        },
        "mcp",
      );
      const after = (await f.repo.read("a", A))!.questions[0];
      if (parent.kind !== "reading" || after.kind !== "reading")
        throw new Error("expected a reading pack");
      expect(after.passage).toBe(parent.passage);
      expect(after.questions[0]).toEqual(parent.questions[0]);
      expect(after.questions[2]).toEqual(parent.questions[2]);
      expect(after.questions[1].explanation).toBe("依原文救援行動判斷。");
      const summary = await readAgentResource(f.repo, identity, {
        resource: "question",
        setId: A,
        questionId: pack.id,
      });
      expect(summary.question).not.toHaveProperty("passage");
      expect(summary.question).not.toHaveProperty("questions");
      expect(
        await readAgentResource(f.repo, identity, {
          resource: "questions",
          setId: A,
          questionId: pack.id,
          from: 2,
          to: 2,
        }),
      ).toMatchObject({ items: [{ id: "child-1" }] });
      expect(
        await readAgentResource(f.repo, identity, {
          resource: "question",
          setId: A,
          questionId: pack.id,
          childId: "child-1",
          fields: ["id", "explanation"],
        }),
      ).toMatchObject({
        child: { id: "child-1", explanation: "依原文救援行動判斷。" },
      });
      const operationId = randomUUID();
      const receipt = await applyAgentMutation(
        f.repo,
        identity,
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
      expect(receipt.errors).toHaveLength(25);
      expect(
        await readAgentResource(f.repo, identity, {
          resource: "operation",
          setId: A,
          operationId,
        }),
      ).toMatchObject({
        errorCount: 25,
        hasMoreErrors: true,
        errors: expect.any(Array),
      });
      const diagnostics = await readAgentResource(f.repo, identity, {
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
      await expect(
        readAgentResource(
          f.repo,
          { ...identity, setId: B },
          { resource: "operation", operationId },
        ),
      ).rejects.toMatchObject({ code: "operation_not_found" });
    } finally {
      await f.runtime.dispose();
    }
  });
  it("validates without writes, atomically rejects or partially saves 97/100, replays diagnostics and isolates question IDs", async () => {
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
      const before = (await f.repo.read("a", A))!,
        senseId = before.words[0].senses[0].id;
      const items = Array.from({ length: 100 }, (_, i) => ({
        itemId: `candidate-${i}`,
        senseId,
        sentence: `They rescue stranded hikers during emergency number ${i}.`,
        answer: "rescue",
        distractors: ["ignore", "delay", "watch"],
      }));
      items[17].senseId = "sense-foreign" as typeof senseId;
      items[42].distractors[0] = "rescue";
      items[75].sentence = "They went home before midnight.";
      const generation = {
        kind: "vocabulary" as const,
        difficulty: 2 as const,
        output: { items },
      };
      const head = await f.db
        .prepare("SELECT revision FROM cloud_accounts WHERE uid=?")
        .bind("a")
        .first();
      const checked = await validateGeneratedQuestions(
        f.repo,
        identity,
        A,
        generation,
      );
      expect(checked).toMatchObject({
        dryRun: true,
        savedCount: 0,
        validCount: 97,
        failedCount: 3,
      });
      expect(
        await f.db
          .prepare("SELECT revision FROM cloud_accounts WHERE uid=?")
          .bind("a")
          .first(),
      ).toEqual(head);
      const atomic = await applyAgentMutation(
        f.repo,
        identity,
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
      const envelope = {
        operationId: randomUUID(),
        action: { type: "generated_questions", ...generation },
      };
      const receipt = await applyAgentMutation(
        f.repo,
        identity,
        A,
        envelope,
        "mcp",
      );
      expect(receipt).toMatchObject({
        status: "partial_success",
        submittedCount: 100,
        savedCount: 97,
        failedCount: 3,
        questionCount: 97,
      });
      expect(
        await applyAgentMutation(f.repo, identity, A, envelope, "mcp"),
      ).toEqual(receipt);
      expect((await f.repo.read("a", A))!.questions).toHaveLength(97);
      const other = mutateAgentSet(
        createAgentSet(randomUUID(), "同帳號另一集"),
        {
          type: "put_words",
          words: [
            { word: "rescue", senses: [{ pos: "v.", meaningZh: "救援" }] },
          ],
        },
      ).snapshot!;
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
        identity,
        other.set.id,
        { action: { type: "put_questions", questions: [foreign] } },
        "mcp",
      );
      const collision = await applyAgentMutation(
        f.repo,
        identity,
        A,
        {
          action: {
            type: "put_questions",
            questions: [
              { ...foreign, wordKey: before.words[0].wordKey, senseId },
              {
                ...foreign,
                id: "allowed-question",
                wordKey: before.words[0].wordKey,
                senseId,
              },
            ],
          },
        },
        "mcp",
      );
      expect(collision).toMatchObject({
        status: "partial_success",
        savedCount: 1,
        failedCount: 1,
        questionCount: 98,
      });
      expect(collision.errors?.[0].code).toBe("question_outside_scope");
      expect((await f.repo.read("a", other.set.id))!.questions[0].id).toBe(
        "occupied-question",
      );
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
      ).rejects.toThrow();
      const oversized = { type: "put_words", words: words(201) };
      await expect(
        f.repo.mutate("a", A, receipt.revision, randomUUID(), oversized, (s) =>
          mutateAgentSet(s, oversized),
        ),
      ).rejects.toThrow();
      expect(agentSetRevision((await f.repo.read("a", A))!)).toBe(
        receipt.revision,
      );
      await expect(
        f.repo.mutate("a", A, revision, randomUUID(), different, (s) =>
          mutateAgentSet(s, different),
        ),
      ).rejects.toThrow();
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

  it("handles folder CRUD, cycles, duplicate names, null root, movement and uid isolation", async () => {
    const f = await fixture();
    try {
      const mutate = async (action: AgentFolderMutation) => {
        const old = await f.repo.folders("a");
        return f.repo.mutateFolders("a", old.revision, randomUUID(), action);
      };
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
      expect(root.folder?.name).toBe("課程");
      expect(
        await f.repo.mutateFolders("a", before.revision, operationId, create),
      ).toEqual(root);
      await expect(
        f.repo.mutateFolders("a", before.revision, operationId, {
          type: "create_folder",
          name: "不同操作",
        }),
      ).rejects.toThrow();
      await expect(
        f.repo.mutateFolders("a", before.revision, randomUUID(), {
          type: "create_folder",
          name: "舊版本",
        }),
      ).rejects.toThrow();
      await expect(
        mutate({ type: "create_folder", name: "課程" }),
      ).rejects.toThrow();
      await expect(
        mutate({ type: "create_folder", name: "子層", parentId: "missing" }),
      ).rejects.toThrow();
      const rootId = root.folder!.id;
      const child = await mutate({
        type: "create_folder",
        name: "子層",
        parentId: rootId,
      });
      const childId = child.folder!.id;
      await expect(
        mutate({ type: "update_folder", folderId: rootId, parentId: childId }),
      ).rejects.toThrow();
      await expect(
        mutate({ type: "update_folder", folderId: rootId, parentId: rootId }),
      ).rejects.toThrow();
      await expect(
        mutate({ type: "delete_folder", folderId: rootId }),
      ).rejects.toThrow();
      const renamed = await mutate({
        type: "update_folder",
        folderId: childId,
        name: "獨立單元",
        parentId: null,
      });
      expect(renamed.folder?.name).toBe("獨立單元");
      expect(renamed.folder?.parentId).toBeUndefined();
      await expect(
        mutate({ type: "update_folder", folderId: childId, name: "課程" }),
      ).rejects.toThrow();
      const foldersB = await f.repo.folders("b");
      expect(foldersB.folders.some((folder) => folder.id === rootId)).toBe(
        false,
      );
      await expect(
        f.repo.mutateFolders("b", foldersB.revision, randomUUID(), {
          type: "update_folder",
          folderId: rootId,
          name: "跨使用者",
        }),
      ).rejects.toThrow();
      let snapshot = (await f.repo.read("a", A))!;
      const missing = { type: "move_set", folderId: "missing" };
      await expect(
        f.repo.mutate(
          "a",
          A,
          agentSetRevision(snapshot),
          randomUUID(),
          missing,
          (s) => mutateAgentSet(s, missing),
        ),
      ).rejects.toThrow();
      const move = { type: "move_set", folderId: rootId };
      await f.repo.mutate(
        "a",
        A,
        agentSetRevision(snapshot),
        randomUUID(),
        move,
        (s) => mutateAgentSet(s, move),
      );
      expect((await f.repo.read("a", A))!.set.folderId).toBe(rootId);
      await expect(
        mutate({ type: "delete_folder", folderId: rootId }),
      ).rejects.toThrow();
      snapshot = (await f.repo.read("b", B))!;
      await expect(
        f.repo.mutate(
          "b",
          B,
          agentSetRevision(snapshot),
          randomUUID(),
          move,
          (s) => mutateAgentSet(s, move),
        ),
      ).rejects.toThrow();
      snapshot = (await f.repo.read("a", A))!;
      const toRoot = { type: "move_set", folderId: UNCATEGORIZED_FOLDER_ID };
      await f.repo.mutate(
        "a",
        A,
        agentSetRevision(snapshot),
        randomUUID(),
        toRoot,
        (s) => mutateAgentSet(s, toRoot),
      );
      const deleted = await mutate({ type: "delete_folder", folderId: rootId });
      expect(deleted.folder).toBeNull();
      expect(deleted.folders.some((folder) => folder.id === rootId)).toBe(
        false,
      );
      await mutate({ type: "delete_folder", folderId: childId });
      expect((await f.repo.read("b", B))!.set.setName).toBe("合成 B");
    } finally {
      await f.runtime.dispose();
    }
  });
  it("serves five compact MCP tools that read, write, delete and scope folders", async () => {
    const { runtime, repo } = await fixture();
    try {
      const rpc = async (method: string, params: unknown, uid = "a") => {
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
      };
      const call = async (name: string, args: unknown, uid = "a") => {
        const { result } = await rpc(
          "tools/call",
          { name, arguments: args },
          uid,
        );
        return {
          isError: result.isError ?? false,
          data: JSON.parse(result.content[0].text) as Record<string, unknown>,
        };
      };
      const list = await rpc("tools/list", {});
      expect(list.result.tools.map((tool) => tool.name)).toEqual([
        "read",
        "create_set",
        "write",
        "validate",
        "delete",
      ]);
      // Clients often drop server instructions, so tool schemas carry the
      // action and request vocabulary; keep the whole per-conversation cost small.
      const listed = JSON.stringify(list.result);
      expect(listed.length + AGENT_INSTRUCTIONS.length).toBeLessThan(7000);
      for (const name of [
        "put_words",
        "edit_sense",
        "delete_words",
        "resource",
        "nextCursor",
      ])
        expect(listed).toContain(name);

      expect(Object.keys(readRequest.shape).sort()).toEqual(
        Object.keys(querySchema.shape).sort(),
      );
      const raw = async (name: string, args: unknown) => {
        const { result } = await rpc("tools/call", { name, arguments: args });
        return {
          isError: result.isError ?? false,
          text: result.content[0].text,
        };
      };
      const misnamed = await raw("read", { requests: [{ type: "sets" }] });
      expect(misnamed.isError).toBe(true);
      expect(misnamed.text).toContain("resource");
      expect(misnamed.text).toContain("type");
      const badResource = await raw("read", {
        requests: [{ resource: "nope" }],
      });
      expect(badResource.text).toContain('"diagnostics"');
      const badAction = await raw("write", {
        setId: A,
        action: { type: "addWords" },
      });
      expect(badAction.isError).toBe(true);
      expect(badAction.text).toContain("put_words");
      const badWords = await call("write", {
        setId: A,
        action: { type: "put_words", words: [{ word: "x" }] },
      });
      expect(badWords.isError).toBe(true);
      expect((badWords.data.error as { message: string }).message).toMatch(
        /^words\.0\.senses: /,
      );
      const savedShape = await call("validate", {
        setId: A,
        kind: "vocabulary",
        output: { items: [{ prompt: "x", options: ["a"], answerIndex: 0 }] },
      });
      expect(savedShape.data.hint).toContain("outputSchema");
      expect(
        (savedShape.data.errors as { message: string }[])[0].message,
      ).not.toMatch(/^\s*\[/);

      const saved = await call("write", {
        setId: A,
        action: { type: "put_words", words: words(3) },
      });
      expect(saved.isError).toBe(false);
      expect(saved.data.wordCount).toBe(3);
      const read = await call("read", {
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

      const misplaced = await raw("write", {
        setId: A,
        action: { type: "delete_set" },
      });
      expect(misplaced.isError).toBe(true);
      expect(misplaced.text).toContain("rename_set");
      expect((await repo.read("a", A))?.words).toHaveLength(3);
      const outsider = await call(
        "write",
        { setId: A, action: { type: "put_words", words: words(1) } },
        "b",
      );
      expect(outsider.isError).toBe(true);

      const folder = await call("write", {
        action: { type: "create_folder", name: "MCP" },
      });
      expect(folder.isError).toBe(false);
      const removed = await call("delete", {
        setId: A,
        action: {
          type: "delete_words",
          wordKeys: [results[0].data.items?.[0].wordKey],
        },
      });
      expect(removed.isError).toBe(false);
      expect((await repo.read("a", A))?.words).toHaveLength(2);
    } finally {
      await runtime.dispose();
    }
  });
});

describe("frontend synchronization API using the same native D1 records", () => {
  it("pushes, paginates, replays, isolates users and exposes tombstones", async () => {
    const f = await fixture();
    try {
      const origin = randomUUID();
      const push = async (
        uid: string,
        records: AgentCloudRecord[],
        operationId = randomUUID(),
      ) => {
        const response = await handleCloudApi(
          new Request("http://local.invalid/sync/records", {
            method: "POST",
            body: JSON.stringify({ origin, operationId, records }),
          }),
          uid,
          f.db,
        );
        return response.json() as Promise<{ revision: number; count: number }>;
      };
      const records = Array.from({ length: 402 }, (_, i) => {
        const snapshot = createAgentSet(randomUUID(), `同步合成 ${i}`);
        return [...snapshotRecords(snapshot).values()].find(
          (r) => r.type === "set",
        )!;
      });
      const operationId = randomUUID(),
        first = await push("a", records.slice(0, 400), operationId);
      expect(first.count).toBe(400);
      expect(await push("a", records.slice(0, 400), operationId)).toEqual(
        first,
      );
      await expect(
        push("a", records.slice(0, 1), operationId),
      ).rejects.toMatchObject({ code: "operation_conflict" });
      await push("a", records.slice(400));
      const pull = async (uid: string, cursor = "") => {
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
      const page1 = await pull("a");
      expect(page1.records).toHaveLength(400);
      expect(page1.hasMore).toBe(true);
      const page2 = await pull("a", page1.cursor);
      expect(page2.hasMore).toBe(false);
      const all = [...page1.records, ...page2.records];
      expect(all).toHaveLength(404);
      expect(new Set(all.map((r) => `${r.type}:${r.recordKey}`)).size).toBe(
        404,
      );
      expect((await pull("a", page2.cursor)).records).toEqual([]);
      const other = await pull("b");
      expect(other.records).toHaveLength(2);
      expect(other.records.some((r) => r.recordKey === A)).toBe(false);
      await push("a", [{ ...records[0], deleted: true, payload: null }]);
      const deletion = await pull("a", page2.cursor);
      expect(deletion.records).toHaveLength(1);
      expect(deletion.records[0]).toMatchObject({
        recordKey: records[0].recordKey,
        deleted: true,
        payload: null,
      });
      expect(
        (await f.repo.list("a")).some((s) => s.id === records[0].recordKey),
      ).toBe(false);
      await expect(pull("a", "broken")).rejects.toMatchObject({
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
    } finally {
      await f.runtime.dispose();
    }
  });
});

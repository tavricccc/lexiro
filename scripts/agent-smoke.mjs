import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { UNCATEGORIZED_FOLDER_ID } from "@lexiro/agent-contract";
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";
const DEFAULT_AI_MODEL = "gpt-6-luna";
import { execFileSync } from "node:child_process";
const base = "http://127.0.0.1:8791",
  A = "11111111-1111-4111-8111-111111111111",
  B = "33333333-3333-4333-8333-333333333333";
const results = [];
async function req(path, method = "GET", body, token, expect = 200) {
  const init = {
    method,
    redirect: "manual",
    headers: {
      ...(path === "/mcp"
        ? { accept: "application/json, text/event-stream" }
        : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
  };
  if (body && method !== "GET") init.body = JSON.stringify(body);
  const r = await fetch(path.startsWith("http") ? path : base + path, init);
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  results.push({ path: new URL(r.url).pathname, method, status: r.status });
  assert.equal(r.status, expect, JSON.stringify(data));
  return { data, headers: r.headers };
}
await req("/__local/seed", "POST");
const link = (
  await req(
    "/links",
    "POST",
    { setId: A, expiresInSeconds: 7200 },
    "local-user-a",
    201,
  )
).data;
const token = new URL(link.url).searchParams.get("token"),
  path = `/access/${link.id}`;
let current = (await req(link.url)).data;
assert.match(current, /未.*題型.*先.*問/);
assert.match(current, /已說明.*不要重問/);
// JSON accept is needed because links are human-readable by default.
async function snapshot() {
  const r = await fetch(base + path, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  assert.equal(r.status, 200);
  const summary = await r.json();
  assert.equal(summary.snapshot, undefined);
  const readPages = async (resource) => {
    const items = [];
    let cursor;
    do {
      const page = (
        await req(
          `${path}/${resource}?view=detail&limit=50${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
          "GET",
          undefined,
          token,
        )
      ).data;
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  };
  // Reconstruct material only inside this local regression script.
  return {
    revision: summary.revision,
    snapshot: {
      set: summary.set,
      words: await readPages("words"),
      questions: await readPages("questions"),
    },
  };
}
async function mutate(action) {
  const s = await snapshot();
  return (
    await req(
      path,
      "PATCH",
      { expectedRevision: s.revision, operationId: randomUUID(), action },
      token,
    )
  ).data;
}
const initial = await snapshot();
if (initial.snapshot.words.length)
  await mutate({
    type: "delete_words",
    wordKeys: initial.snapshot.words.map((w) => w.wordKey),
  });
const first = await snapshot();
const envelope = {
  expectedRevision: first.revision,
  operationId: randomUUID(),
  action: {
    type: "put_words",
    words: [
      {
        word: "conserve",
        senses: [
          {
            pos: "v.",
            meaningZh: "節約；保存",
            examples: [
              "The village installed water meters to conserve its limited water supply.",
            ],
          },
        ],
      },
      {
        word: "temporary",
        senses: [
          {
            pos: "adj.",
            meaningZh: "暫時的",
            examples: [
              "The library used a temporary entrance while workers repaired the front steps.",
            ],
          },
        ],
      },
    ],
  },
};
const receipt = (await req(path, "PATCH", envelope, token)).data;
assert.deepEqual((await req(path, "PATCH", envelope, token)).data, receipt);
await req(
  path,
  "PATCH",
  { ...envelope, action: { type: "rename_set", setName: "conflict" } },
  token,
  409,
);
await req(
  path,
  "PATCH",
  { ...envelope, operationId: randomUUID() },
  token,
  409,
);
let s = await snapshot();
let brief = (
  await req(
    `${path}/brief?kind=vocabulary&difficulty=2`,
    "GET",
    undefined,
    token,
  )
).data;
assert.equal(brief.sourceCount, 2);
assert.equal(brief.rules, undefined);
assert(brief.specification);
const prompt = (
  await req(`${path}/prompt?kind=vocabulary`, "GET", undefined, token)
).data;
assert.equal(typeof prompt.rules, "string");
assert.equal(prompt.outputSchema.type, "object");
assert(prompt.outputSchema.properties.items);
const selectedSense = s.snapshot.words[0].senses[0].id;
const subset = (
  await req(
    `${path}/query`,
    "POST",
    { requests: [{ resource: "sources", senseIds: [selectedSense] }] },
    token,
  )
).data;
assert.deepEqual(
  subset.results[0].data.items.map((source) => source.senseId),
  [selectedSense],
);
const absent = await req(
  `${path}/brief?kind=vocabulary&difficulty=2&senseId=sense-outside-set`,
  "GET",
  undefined,
  token,
  200,
);
assert.equal(absent.data.sourceCount, 0);
const invalid = await req(
  path,
  "PATCH",
  {
    expectedRevision: s.revision,
    operationId: randomUUID(),
    action: {
      type: "generated_questions",
      kind: "vocabulary",
      difficulty: 2,
      senseIds: s.snapshot.words.flatMap((w) => w.senses.map((v) => v.id)),
      output: { items: [] },
    },
  },
  token,
  200,
);
assert.equal(invalid.data.status, "rejected");
assert.equal(invalid.data.savedCount, 0);
assert.equal(invalid.data.errors[0].code, "invalid_batch_size");
assert.equal((await snapshot()).revision, s.revision);
const output = {
  items: [
    {
      senseId: s.snapshot.words.find((w) => w.word === "conserve").senses[0].id,
      sentence:
        "During the severe drought, residents took much shorter showers every morning to conserve the small amount of water left in the town reservoir until the next rainy season.",
      usage: "to conserve the small amount of water",
      answer: "conserve",
      distractors: ["pollute", "consume", "release"],
      explanation: "乾旱時縮短淋浴，是為了節約水庫剩餘的水量。",
      whyWrong: [
        {
          option: "pollute",
          reason: "pollute 表示污染，縮短淋浴與污染水質無關。",
        },
        {
          option: "consume",
          reason: "consume 表示消耗，與縮短淋浴以減少用水的目的相反。",
        },
        {
          option: "release",
          reason: "release 表示釋放，居民縮短淋浴不是為了排放水庫的水。",
        },
      ],
    },
    {
      senseId: s.snapshot.words.find((w) => w.word === "temporary").senses[0]
        .id,
      sentence:
        "Because the main bridge would reopen after extensive repairs next month, the town built a temporary crossing to help pedestrians safely reach the local school.",
      usage: "a temporary crossing",
      answer: "temporary",
      distractors: ["permanent", "distant", "private"],
      explanation: "主橋下個月修好就會重新開放，因此行人便橋只是暫時使用。",
      whyWrong: [
        {
          option: "permanent",
          reason: "permanent 表示永久的，與下月主橋重新開放的時間線索衝突。",
        },
        {
          option: "distant",
          reason: "distant 表示遙遠的，不能說明修橋期間設置替代通道的用途。",
        },
        {
          option: "private",
          reason:
            "private 表示私人的，文中說明為行人設置，沒有私人所有權的線索。",
        },
      ],
    },
  ],
};
const generated = {
  type: "generated_questions",
  kind: "vocabulary",
  difficulty: 2,
  senseIds: s.snapshot.words.flatMap((w) => w.senses.map((v) => v.id)),
  output,
};
await mutate(generated);
s = await snapshot();
assert.equal(s.snapshot.questions.length, 2);
const q = {
  ...s.snapshot.questions[0],
  explanation: "嚴重乾旱時縮短淋浴，可減少用水，因此 conserve 在此表示節約。",
};
await mutate({ type: "put_questions", questions: [q] });
await mutate({ type: "delete_questions", questionIds: [q.id] });
s = await snapshot();
const w = s.snapshot.words[0];
await mutate({
  type: "put_words",
  words: [
    {
      wordKey: w.wordKey,
      word: w.word,
      senses: w.senses.map((v) => ({
        ...v,
        examples: [
          "Families conserve water by collecting rainwater for their gardens.",
        ],
      })),
    },
  ],
});
await mutate({ type: "delete_words", wordKeys: [w.wordKey] });
await req(`/access/${link.id}?token=wrong`, "GET", undefined, undefined, 401);
const otherLink = (
  await req(
    "/links",
    "POST",
    { setId: "22222222-2222-4222-8222-222222222222" },
    "local-user-a",
    201,
  )
).data;
await req(`/access/${otherLink.id}`, "GET", undefined, token, 401);
await req(
  path,
  "PATCH",
  {
    expectedRevision: (await snapshot()).revision,
    operationId: randomUUID(),
    setId: B,
    action: { type: "delete_set" },
  },
  token,
  400,
);
await req(
  "/links",
  "POST",
  { setId: B, expiresInSeconds: 7200 },
  "local-user-a",
  404,
);
await req(`/links/${link.id}`, "DELETE", undefined, "local-user-b", 404);
await req(`/links/${link.id}`, "DELETE", undefined, "local-user-a");
await req(link.url, "GET", undefined, undefined, 410);
const verifier =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~",
  challenge = createHash("sha256").update(verifier).digest("base64url");
const client = (
  await req(
    "/oauth/register",
    "POST",
    {
      client_name: "Local Smoke",
      redirect_uris: ["http://127.0.0.1:8792/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    undefined,
    201,
  )
).data;
const auth = new URL(base + "/authorize");
for (const [k, v] of Object.entries({
  client_id: client.client_id,
  redirect_uri: "http://127.0.0.1:8792/callback",
  response_type: "code",
  scope: "sets:read sets:write offline_access",
  state: "local-test",
  code_challenge: challenge,
  code_challenge_method: "S256",
  resource: base + "/mcp",
}))
  auth.searchParams.set(k, v);
const started = await req(auth.href, "GET", undefined, undefined, 302);
const id = new URL(started.headers.get("location")).searchParams.get("request");
await req("/oauth/request/" + id, "GET", undefined, "local-user-a");
const approved = (
  await req("/oauth/approve/" + id, "POST", { allow: true }, "local-user-a")
).data;
const code = new URL(approved.redirectTo).searchParams.get("code");
const tr = await fetch(base + "/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.client_id,
    redirect_uri: "http://127.0.0.1:8792/callback",
    code,
    code_verifier: verifier,
    resource: base + "/mcp",
  }),
});
const td = await tr.json();
assert.equal(tr.status, 200, JSON.stringify(td));
results.push({ path: "/oauth/token", status: tr.status });
let rpcId = 0;
async function rpc(method, params) {
  const r = await fetch(base + "/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${td.access_token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  results.push({ method, status: r.status });
  return d.result;
}
const init = await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "smoke", version: "1" },
});
assert.match(init.instructions, /已說過的不重問/);
const tools = await rpc("tools/list", {});
assert.deepEqual(
  tools.tools.map((t) => t.name),
  ["read", "create_set", "write", "validate", "delete"],
);
const readResources = {
  get_set: "set",
  list_sets: "sets",
  list_folders: "folders",
  list_words: "words",
  get_word: "word",
  list_questions: "questions",
  get_question: "question",
  get_generation_prompt: "prompt",
  get_generation_brief: "brief",
};
const mcpEnvelope = [
  "setId",
  "expectedRevision",
  "operationId",
  "responseFields",
];
// Maps each step's operation onto the five compact MCP tools.
async function tool(name, args = {}) {
  let request;
  if (readResources[name])
    request = {
      name: "read",
      arguments: { requests: [{ resource: readResources[name], ...args }] },
    };
  else if (name === "read_batch") request = { name: "read", arguments: args };
  else if (name === "create_set")
    request = {
      name,
      arguments: { name: args.setName, folderId: args.folderId },
    };
  else if (name === "validate_generated_questions")
    request = { name: "validate", arguments: args };
  else {
    const type =
      name === "save_generated_questions" ? "generated_questions" : name;
    const outer = {},
      action = { type };
    for (const [key, value] of Object.entries(args))
      (mcpEnvelope.includes(key) ? outer : action)[key] = value;
    if (type === "generated_questions") action.difficulty ??= 2;
    request = {
      name: type.startsWith("delete_") ? "delete" : "write",
      arguments: { ...outer, action },
    };
  }
  const d = await rpc("tools/call", request);
  let data = JSON.parse(d.content[0].text);
  let isError = d.isError === true;
  if (request.name === "read" && name !== "read_batch") {
    const entry = data.results[0];
    isError ||= Boolean(entry.error);
    data = entry.data ?? entry;
  }
  return { isError, data };
}
async function call(name, args = {}) {
  const r = await tool(name, args);
  assert.equal(r.isError, false, JSON.stringify(r.data));
  return r.data;
}
async function mcpSnapshot(args) {
  const summary = await call("get_set", args);
  assert.equal(summary.snapshot, undefined);
  const readPages = async (name) => {
    const items = [];
    let cursor;
    do {
      const page = await call(name, {
        setId: args.setId,
        view: "detail",
        limit: 50,
        ...(cursor ? { cursor } : {}),
      });
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  };
  return {
    revision: summary.revision,
    snapshot: {
      set: summary.set,
      words: await readPages("list_words"),
      questions: await readPages("list_questions"),
    },
  };
}
const sets = await call("list_sets");
assert(sets.items.every((v) => v.id !== B));
const folderState = await call("list_folders");
const folder = await call("create_folder", {
  expectedRevision: folderState.revision,
  operationId: randomUUID(),
  name: `HTTP 合成 ${randomUUID()}`,
});
const updatedFolder = await call("update_folder", {
  expectedRevision: folder.revision,
  operationId: randomUUID(),
  folderId: folder.folder.id,
  name: `HTTP 更名 ${randomUUID()}`,
  parentId: null,
});
assert.equal(updatedFolder.folder.parentId, undefined);
const created = await call("create_set", {
  setName: "OAuth 合成 CRUD",
  folderId: folder.folder.id,
});
assert.equal(created.set.folderId, folder.folder.id);
let cs = await mcpSnapshot({ setId: created.set.id });
const mutateMcp = async (name, args) => {
  const r = await call(name, {
    setId: cs.snapshot.set.id,
    expectedRevision: cs.revision,
    operationId: randomUUID(),
    ...args,
  });
  cs = await mcpSnapshot({ setId: r.setId });
  return r;
};
await mutateMcp("put_words", {
  words: [
    {
      word: "reliable",
      senses: [
        {
          pos: "adj.",
          meaningZh: "可靠的",
          examples: [
            "The reliable bus service helped students arrive on time.",
          ],
        },
      ],
    },
  ],
});
const reliableSense = cs.snapshot.words[0].senses[0].id;
const candidates = {
  items: [
    {
      itemId: "valid-short",
      senseId: reliableSense,
      sentence: "The reliable bus arrived on time.",
      answer: "reliable",
      distractors: ["late", "broken", "missing"],
    },
    {
      itemId: "invalid-source",
      senseId: "sense-outside-set",
      sentence: "The reliable bus arrived on time.",
      answer: "reliable",
      distractors: ["late", "broken", "missing"],
    },
  ],
};
const checked = await call("validate_generated_questions", {
  setId: cs.snapshot.set.id,
  kind: "vocabulary",
  output: candidates,
});
assert.equal(checked.validCount, 1);
assert.equal(checked.failedCount, 1);
assert.equal(checked.savedCount, 0);
assert.equal(
  (await mcpSnapshot({ setId: cs.snapshot.set.id })).revision,
  cs.revision,
);
const atomic = await tool("save_generated_questions", {
  setId: cs.snapshot.set.id,
  kind: "vocabulary",
  mode: "atomic",
  output: candidates,
});
assert.equal(atomic.isError, true);
assert.equal(atomic.data.savedCount, 0);
assert.equal(
  (await mcpSnapshot({ setId: cs.snapshot.set.id })).snapshot.questions.length,
  0,
);
const partial = await call("save_generated_questions", {
  setId: cs.snapshot.set.id,
  kind: "vocabulary",
  output: candidates,
});
assert.equal(partial.savedCount, 1);
assert.equal(partial.failedCount, 1);
assert.equal(partial.errors[0].itemId, "invalid-source");
assert.equal(partial.errors[0].sourceId, "sense-outside-set");
assert(partial.warnings.some((w) => w.code === "prose_too_short"));
cs = await mcpSnapshot({ setId: cs.snapshot.set.id });
assert.equal(cs.snapshot.questions.length, 1);
await call("save_generated_questions", {
  setId: cs.snapshot.set.id,
  kind: "vocabulary",
  senseIds: [reliableSense],
  output: { items: [candidates.items[0]] },
});
cs = await mcpSnapshot({ setId: cs.snapshot.set.id });
assert.equal(cs.snapshot.questions.length, 1);
await mutateMcp("rename_set", { setName: "OAuth 更名" });
await mutateMcp("delete_words", { wordKeys: [cs.snapshot.words[0].wordKey] });
const syntheticWords = Array.from({ length: 200 }, (_, i) => ({
  word: `synthetic-${i}`,
  senses: [
    {
      pos: "n.",
      meaningZh: `合成項目${i}`,
      examples: [`This synthetic example describes item number ${i}.`],
    },
  ],
}));
const bulkReceipt = await mutateMcp("put_words", { words: syntheticWords });
assert.equal(bulkReceipt.wordCount, 200);
assert.equal(cs.snapshot.words.length, 200);
const tooMany = await tool("put_words", {
  setId: cs.snapshot.set.id,
  expectedRevision: cs.revision,
  operationId: randomUUID(),
  words: [...syntheticWords, syntheticWords[0]],
});
assert.equal(tooMany.isError, true);
const setLink = (
  await req(
    "/links",
    "POST",
    { setId: cs.snapshot.set.id },
    "local-user-a",
    201,
  )
).data;
const setToken = new URL(setLink.url).searchParams.get("token"),
  setPath = `/access/${setLink.id}`;
const syntheticQuestions = cs.snapshot.words.map((word, i) => ({
  id: `query-synthetic-${String(i).padStart(3, "0")}`,
  kind: "multipleChoice",
  questionStyle: "vocabulary",
  difficulty: (i % 3) + 1,
  prompt: `Students discussed synthetic item ${i} at school before they chose _____.`,
  options: [word.word, "ignore", "delay", "leave"],
  answerIndex: 0,
  wordKey: word.wordKey,
  senseId: word.senses[0].id,
  explanation: `這是第${i}筆合成測試解析，僅驗證資料存取。`,
}));
assert.equal(
  (await mutateMcp("put_questions", { questions: syntheticQuestions }))
    .savedCount,
  200,
);
const queries = [
  {
    resource: "words",
    setId: cs.snapshot.set.id,
    from: 11,
    to: 15,
    fields: ["wordKey", "word", "senses.id"],
  },
  {
    resource: "questions",
    setId: cs.snapshot.set.id,
    q: "school",
    questionType: "vocabulary",
    difficulty: 2,
    limit: 3,
  },
  { resource: "prompt", kind: "vocabulary" },
  {
    resource: "brief",
    setId: cs.snapshot.set.id,
    kind: "vocabulary",
    from: 1,
    to: 4,
  },
];
const mcpBatch = await call("read_batch", { requests: queries });
const restBatch = (
  await req(setPath + "/query", "POST", { requests: queries }, setToken)
).data;
assert.deepEqual(restBatch.results, mcpBatch.results);
assert.equal(restBatch.results[0].data.items.length, 5);
assert.equal(restBatch.results[1].data.items.length, 3);
assert.equal(restBatch.results[3].data.sourceCount, 4);
assert.equal(restBatch.results[3].data.rules, undefined);
assert.equal(restBatch.characters, JSON.stringify(restBatch).length);
const fullPrompts = await call("read_batch", {
  maxCharacters: 128000,
  requests: ["vocabulary", "cloze", "wordBank", "discourse", "reading"].map(
    (kind) => ({ resource: "prompt", kind }),
  ),
});
assert(
  fullPrompts.results.every(
    (entry) =>
      typeof entry.data?.rules === "string" &&
      entry.data.outputSchema.type === "object",
  ),
);
await req(
  setPath + "/query",
  "POST",
  { requests: [{ resource: "set", setId: B }] },
  setToken,
);
const oneWord = cs.snapshot.words[0],
  oneSense = oneWord.senses[0],
  oneQuestion = cs.snapshot.questions[0];
await req(
  `${setPath}/words/${encodeURIComponent(oneWord.wordKey)}/senses/${encodeURIComponent(oneSense.id)}`,
  "PATCH",
  { patch: { appendExamples: ["Only this sense gets the new example."] } },
  setToken,
);
const changedWord = (
  await req(
    `${setPath}/words/${encodeURIComponent(oneWord.wordKey)}`,
    "GET",
    undefined,
    setToken,
  )
).data.word;
assert.equal(changedWord.senses[0].examples.length, 2);
assert.equal(
  (
    await call("edit_question", {
      setId: cs.snapshot.set.id,
      questionId: oneQuestion.id,
      patch: { explanation: "只更新這一題的解說。" },
    })
  ).savedCount,
  1,
);
assert.equal(
  (
    await req(
      `${setPath}/questions/${encodeURIComponent(oneQuestion.id)}?fields=id,explanation`,
      "GET",
      undefined,
      setToken,
    )
  ).data.question.explanation,
  "只更新這一題的解說。",
);
await req(
  `${setPath}/questions/${encodeURIComponent(oneQuestion.id)}`,
  "DELETE",
  undefined,
  setToken,
);
await req(
  `${setPath}/questions/${encodeURIComponent(oneQuestion.id)}`,
  "GET",
  undefined,
  setToken,
  404,
);
cs = await mcpSnapshot({ setId: cs.snapshot.set.id });
const summary = (await req(setPath, "GET", undefined, setToken)).data;
const compactRead = (
  await req(
    setPath + "/query",
    "POST",
    {
      requests: [
        { resource: "words", from: 11, to: 15, fields: ["wordKey", "word"] },
        {
          resource: "questions",
          questionType: "vocabulary",
          difficulty: 2,
          limit: 3,
        },
      ],
    },
    setToken,
  )
).data;
const fullText = JSON.stringify({
  snapshot: cs.snapshot,
  revision: cs.revision,
});
const responseMeasurement = {
  fixture: "200 synthetic words, 199 synthetic questions",
  tokenizer: "o200k_base estimate",
  previousWholeSnapshot: {
    characters: fullText.length,
    tokens: countTokens(fullText),
  },
  newBootstrap: { characters: summary.length, tokens: countTokens(summary) },
  selectedBatch: {
    characters: JSON.stringify(compactRead).length,
    tokens: countTokens(JSON.stringify(compactRead)),
  },
};
const scopedFolders = (
  await req(setPath + "/folders", "GET", undefined, setToken)
).data;
assert(scopedFolders.items.some((f) => f.id === folder.folder.id));
await req(
  setPath + "/folders",
  "PATCH",
  {
    expectedRevision: scopedFolders.revision,
    operationId: randomUUID(),
    action: { type: "delete_folder", folderId: folder.folder.id },
  },
  setToken,
  405,
);
await req(
  setPath,
  "PATCH",
  {
    expectedRevision: cs.revision,
    operationId: randomUUID(),
    action: { type: "move_set", folderId: UNCATEGORIZED_FOLDER_ID },
  },
  setToken,
);
cs = await mcpSnapshot({ setId: cs.snapshot.set.id });
assert.equal(cs.snapshot.set.folderId, UNCATEGORIZED_FOLDER_ID);
await mutateMcp("move_set", { folderId: folder.folder.id });
const nonempty = await tool("delete_folder", {
  expectedRevision: (await call("list_folders")).revision,
  operationId: randomUUID(),
  folderId: folder.folder.id,
});
assert.equal(nonempty.isError, true);
const nativeStatus = (
  await req("/sync/status", "GET", undefined, "local-user-a")
).data;
assert(nativeStatus.revision > 0);
const records = [];
let cursor = "",
  more = true;
while (more) {
  const page = (
    await req(
      "/sync/records" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      "GET",
      undefined,
      "local-user-a",
    )
  ).data;
  records.push(...page.records);
  cursor = page.cursor;
  more = page.hasMore;
}
assert(
  records.some(
    (r) => r.type === "word" && r.recordKey === cs.snapshot.words[0].wordKey,
  ),
);
assert(
  records.some(
    (r) =>
      r.type === "set" &&
      r.recordKey === cs.snapshot.set.id &&
      r.payload.folderId === folder.folder.id,
  ),
);
const pushed = {
  operationId: randomUUID(),
  origin: randomUUID(),
  records: [
    {
      type: "set",
      recordKey: cs.snapshot.set.id,
      deleted: false,
      updatedAt: new Date().toISOString(),
      payload: { ...cs.snapshot.set, setName: "前端 HTTP 更新" },
    },
  ],
};
const pushReceipt = (await req("/sync/records", "POST", pushed, "local-user-a"))
  .data;
assert.deepEqual(
  (await req("/sync/records", "POST", pushed, "local-user-a")).data,
  pushReceipt,
);
cs = await mcpSnapshot({ setId: cs.snapshot.set.id });
assert.equal(cs.snapshot.set.setName, "前端 HTTP 更新");
const blobStatus = (await req("/sync/status", "GET", undefined, "local-user-a"))
  .data;
const blobInput = {
  operationId: randomUUID(),
  origin: randomUUID(),
  expectedRevision: blobStatus.blobRevision,
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
const blobReceipt = (
  await req("/sync/blobs", "POST", blobInput, "local-user-a")
).data;
assert.deepEqual(
  (await req("/sync/blobs", "POST", blobInput, "local-user-a")).data,
  blobReceipt,
);
assert.equal(
  (await req("/sync/blobs", "GET", undefined, "local-user-a")).data.blobs
    .preferences.schemaVersion,
  1,
);
await req(
  "/sync/blobs",
  "POST",
  { ...blobInput, operationId: randomUUID() },
  "local-user-a",
  409,
);
await call("delete_set", {
  setId: cs.snapshot.set.id,
  expectedRevision: cs.revision,
  operationId: randomUUID(),
});
const deletionFeed = (
  await req(
    "/sync/records?cursor=" + encodeURIComponent(cursor),
    "GET",
    undefined,
    "local-user-a",
  )
).data;
assert(
  deletionFeed.records.some(
    (r) => r.type === "set" && r.recordKey === cs.snapshot.set.id && r.deleted,
  ),
);
await call("delete_folder", {
  expectedRevision: (await call("list_folders")).revision,
  operationId: randomUUID(),
  folderId: folder.folder.id,
});
const denied = await tool("get_set", { setId: B });
assert.equal(denied.isError, true);
// Expiry fixture changes only the synthetic local D1 record.
execFileSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "AGENT_DB",
    "--local",
    "--config",
    "wrangler.agent-local.toml",
    "--command",
    `UPDATE agent_links SET expires_at=0 WHERE id='${otherLink.id}'`,
  ],
  { stdio: "pipe" },
);
await req(otherLink.url, "GET", undefined, undefined, 410);
assert.equal(typeof td.refresh_token, "string");
const refreshResponse = await fetch(base + "/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: client.client_id,
    refresh_token: td.refresh_token,
    resource: base + "/mcp",
  }),
});
const refreshed = await refreshResponse.json();
assert.equal(refreshResponse.status, 200, JSON.stringify(refreshed));
assert.equal(typeof refreshed.access_token, "string");
results.push({
  path: "/oauth/token",
  grant: "refresh_token",
  status: refreshResponse.status,
});
await req(
  "/mcp",
  "POST",
  { jsonrpc: "2.0", id: 103, method: "tools/list", params: {} },
  refreshed.access_token,
);
const connections = (
  await req("/connections", "GET", undefined, "local-user-a")
).data.connections;
const connection = connections.find((c) => c.clientId === client.client_id);
assert(connection);
assert.equal(connection.clientName, "Local Smoke");
await req(
  "/connections/" + encodeURIComponent(connection.id),
  "DELETE",
  undefined,
  "local-user-a",
);
assert(
  !(
    await req("/connections", "GET", undefined, "local-user-a")
  ).data.connections.some((c) => c.id === connection.id),
);
await req(
  "/mcp",
  "POST",
  { jsonrpc: "2.0", id: 101, method: "tools/list", params: {} },
  td.access_token,
  401,
);
await req(
  "/mcp",
  "POST",
  { jsonrpc: "2.0", id: 102, method: "tools/list", params: {} },
  refreshed.access_token,
  401,
);
auth.searchParams.set("scope", "sets:read");
const scopedStart = await req(auth.href, "GET", undefined, undefined, 302);
const scopedId = new URL(scopedStart.headers.get("location")).searchParams.get(
  "request",
);
const scopedApproval = (
  await req(
    "/oauth/approve/" + scopedId,
    "POST",
    { allow: true },
    "local-user-a",
  )
).data;
const scopedTokenResponse = await fetch(base + "/oauth/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.client_id,
    redirect_uri: "http://127.0.0.1:8792/callback",
    code: new URL(scopedApproval.redirectTo).searchParams.get("code"),
    code_verifier: verifier,
    resource: base + "/mcp",
  }),
});
assert.equal(scopedTokenResponse.status, 200);
const scopedToken = await scopedTokenResponse.json();
await req(
  "/mcp",
  "POST",
  { jsonrpc: "2.0", id: 100, method: "tools/list", params: {} },
  scopedToken.access_token,
  403,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      responseMeasurement,
      requestCount: results.length,
      statusCounts: results.reduce(
        (counts, result) => ({
          ...counts,
          [result.status]: (counts[result.status] ?? 0) + 1,
        }),
        {},
      ),
      instructionAssessment:
        "未提供題型先問；已提供項目不重問。兩題按英文情境與三項繁中排除理由自行生成；未呼叫模型 API。",
    },
    null,
    2,
  ),
);

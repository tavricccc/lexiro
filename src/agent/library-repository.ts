import {
  agentRecordId,
  agentSetRevision,
  validateAgentSnapshot,
  type AgentSetSnapshot,
  type AgentMutationResult,
} from "@lexiro/agent-contract";
import type {
  AgentEnv,
  AgentLibraryRepository,
  MutationReceipt,
} from "./types";
import {
  decodeFields,
  encodeFields,
  type FirestoreDocument,
} from "./firestore-values";
import { googleAccessToken } from "./google-auth";
import { fingerprint, HttpError } from "../http";

export class FirestoreAgentLibrary implements AgentLibraryRepository {
  private token: () => Promise<string>;
  private root: string;
  constructor(
    env: AgentEnv,
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.root = `projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
    this.token = googleAccessToken(env, fetcher);
  }
  private name(uid: string, path: string) {
    return `${this.root}/users/${encodeURIComponent(uid)}/${path}`;
  }
  private async call<T>(suffix: string, body: unknown): Promise<T> {
    const response = await this.fetcher(
      `https://firestore.googleapis.com/v1/${this.root}${suffix}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw new HttpError(
        response.status === 409 ? 409 : 503,
        response.status === 409 ? "stale_set" : "firestore_unavailable",
      );
    return response.json() as Promise<T>;
  }
  private async documents(uid: string, paths: string[], transaction?: string) {
    if (!paths.length) return [];
    const result = await this.call<
      { found?: FirestoreDocument; missing?: string }[]
    >(":batchGet", {
      documents: paths.map((path) => this.name(uid, path)),
      ...(transaction ? { transaction } : {}),
    });
    return result.flatMap((item) => (item.found ? [item.found] : []));
  }
  private async query(uid: string, type: string, transaction?: string) {
    const result = await this.call<{ document?: FirestoreDocument }[]>(
      `/users/${encodeURIComponent(uid)}:runQuery`,
      {
        structuredQuery: {
          from: [{ collectionId: "records-v9" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "type" },
              op: "EQUAL",
              value: { stringValue: type },
            },
          },
        },
        ...(transaction ? { transaction } : {}),
      },
    );
    return result
      .flatMap((item) => (item.document ? [item.document] : []))
      .filter((doc) => decodeFields(doc.fields).deleted === false);
  }
  async list(uid: string) {
    return (await this.query(uid, "set")).map((doc) => {
      const data = decodeFields(doc.fields);
      const set = data.payload as { id: string; setName: string };
      return { id: set.id, setName: set.setName };
    });
  }
  private async load(
    uid: string,
    setId: string,
    transaction?: string,
  ): Promise<AgentSetSnapshot | null> {
    const records = await this.documents(
      uid,
      [
        `records-v9/${agentRecordId("set", setId)}`,
        `records-v9/${agentRecordId("membership", setId)}`,
      ],
      transaction,
    );
    const values = records.map((doc) => decodeFields(doc.fields));
    const set = values.find(
      (value) => value.type === "set" && value.deleted === false,
    )?.payload;
    if (!set) return null;
    const members = (
      values.find(
        (value) => value.type === "membership" && value.deleted === false,
      )?.payload as
        { members?: { wordKey: string; senseIds: string[] }[] } | undefined
    )?.members;
    if (!members) throw new HttpError(409, "set_sync_incomplete");
    const wordDocs = await this.documents(
      uid,
      members.map(
        (member) => `records-v9/${agentRecordId("word", member.wordKey)}`,
      ),
      transaction,
    );
    const words = members.flatMap((member) => {
      const doc = wordDocs.find((doc) =>
        doc.name.endsWith(
          `/records-v9/${agentRecordId("word", member.wordKey)}`,
        ),
      );
      if (!doc) return [];
      const data = decodeFields(doc.fields);
      return data.deleted === false ? [data.payload] : [];
    });
    const keys = new Set(members.map((member) => member.wordKey));
    const questions = (await this.query(uid, "question", transaction))
      .map((doc) => decodeFields(doc.fields).payload)
      .filter((value) => {
        const q = value as {
          kind: string;
          wordKey?: string;
          wordKeys?: string[];
        };
        return q.kind === "reading"
          ? q.wordKeys?.some((key) => keys.has(key))
          : q.wordKey && keys.has(q.wordKey);
      });
    return validateAgentSnapshot(
      { set, words, memberships: members, questions },
      setId,
    );
  }
  read(uid: string, setId: string) {
    return this.load(uid, setId);
  }
  private records(snapshot: AgentSetSnapshot | null) {
    const records = new Map<
      string,
      {
        type: string;
        recordKey: string;
        payload: Record<string, unknown>;
        updatedAt: string;
      }
    >();
    if (!snapshot) return records;
    const put = (
      type: string,
      id: string,
      payload: Record<string, unknown>,
      updatedAt: string,
    ) =>
      records.set(agentRecordId(type, id), {
        type,
        recordKey: id,
        payload,
        updatedAt,
      });
    put("set", snapshot.set.id, { ...snapshot.set }, snapshot.set.updatedAt);
    put(
      "membership",
      snapshot.set.id,
      { members: snapshot.memberships },
      snapshot.set.updatedAt,
    );
    for (const word of snapshot.words)
      put("word", word.wordKey, { ...word }, word.updatedAt);
    for (const q of snapshot.questions)
      put("question", q.id, { ...q }, q.updatedAt);
    return records;
  }
  private write(
    uid: string,
    path: string,
    data: Record<string, unknown>,
    timestampField?: string,
  ) {
    return {
      update: { name: this.name(uid, path), fields: encodeFields(data) },
      ...(timestampField
        ? {
            updateTransforms: [
              { fieldPath: timestampField, setToServerValue: "REQUEST_TIME" },
            ],
          }
        : {}),
    };
  }
  private async persist(
    uid: string,
    before: AgentSetSnapshot | null,
    after: AgentSetSnapshot | null,
    transaction: string,
    operationId?: string,
    operationHash?: string,
    remaps: AgentMutationResult["senseRemaps"] = [],
  ) {
    const old = this.records(before),
      next = this.records(after),
      now = new Date().toISOString();
    const writes: unknown[] = [];
    for (const [id, record] of next) {
      if (JSON.stringify(record) === JSON.stringify(old.get(id))) continue;
      if (record.type === "question" && !old.has(id)) {
        const collision = await this.documents(
          uid,
          [`records-v9/${id}`],
          transaction,
        );
        if (collision.some((doc) => decodeFields(doc.fields).deleted === false))
          throw new HttpError(403, "question_outside_scope");
      }
      writes.push(
        this.write(
          uid,
          `records-v9/${id}`,
          { ...record, ownerId: uid, schemaVersion: 9, deleted: false },
          "writtenAt",
        ),
      );
    }
    for (const [id, record] of old)
      if (!next.has(id))
        writes.push(
          this.write(
            uid,
            `records-v9/${id}`,
            {
              type: record.type,
              recordKey: record.recordKey,
              updatedAt: now,
              ownerId: uid,
              schemaVersion: 9,
              deleted: true,
            },
            "writtenAt",
          ),
        );
    const surviving = new Set(
      after?.words.flatMap((w) => w.senses.map((s) => s.id)) ?? [],
    );
    const removed = new Set(
      before?.words
        .flatMap((w) => w.senses.map((s) => s.id))
        .filter((id) => !surviving.has(id)) ?? [],
    );
    if (removed.size) {
      const blobs = await this.documents(
        uid,
        ["progress/global-v9", "stats/summary-v9"],
        transaction,
      );
      for (const doc of blobs) {
        const data = decodeFields(doc.fields),
          key = doc.name.endsWith("global-v9")
            ? "cards"
            : "questionStatsBySense";
        const items = { ...(data[key] as Record<string, unknown>) };
        for (const remap of remaps)
          if (items[remap.from] !== undefined && items[remap.to] === undefined)
            items[remap.to] = items[remap.from];
        for (const id of removed) delete items[id];
        writes.push(
          this.write(uid, doc.name.slice(this.name(uid, "").length), {
            ...data,
            [key]: items,
            updatedAt: now,
          }),
        );
      }
    }
    writes.push(
      this.write(
        uid,
        "meta/library-v9",
        {
          ownerId: uid,
          schemaVersion: 9,
          changedBy: `agent:${operationId ?? "create"}`,
        },
        "changedAt",
      ),
    );
    const receipt: MutationReceipt = {
      operationId: operationId ?? "create",
      setId: (after ?? before)!.set.id,
      revision: agentSetRevision(after),
      wordCount: after?.words.length ?? 0,
      questionCount: after?.questions.length ?? 0,
      deleted: !after,
    };
    if (operationId)
      writes.push(
        this.write(uid, `agent-operations/${operationId}`, {
          setId: receipt.setId,
          operationHash,
          receipt,
          createdAt: now,
        }),
      );
    await this.call(":commit", { transaction, writes });
    return receipt;
  }
  async create(uid: string, snapshot: AgentSetSnapshot) {
    const { transaction } = await this.call<{ transaction: string }>(
      ":beginTransaction",
      { options: { readWrite: {} } },
    );
    try {
      if (await this.load(uid, snapshot.set.id, transaction))
        throw new HttpError(409, "set_exists");
      await this.persist(
        uid,
        null,
        validateAgentSnapshot(snapshot, snapshot.set.id),
        transaction,
      );
    } catch (reason) {
      await this.call(":rollback", { transaction });
      throw reason;
    }
  }
  async mutate(
    uid: string,
    setId: string,
    revision: string,
    operationId: string,
    action: unknown,
    apply: (snapshot: AgentSetSnapshot) => AgentMutationResult,
  ) {
    const operationHash = await fingerprint(
      JSON.stringify({ setId, revision, action }),
    );
    const { transaction } = await this.call<{ transaction: string }>(
      ":beginTransaction",
      { options: { readWrite: {} } },
    );
    try {
      const previous = (
        await this.documents(
          uid,
          [`agent-operations/${operationId}`],
          transaction,
        )
      )[0];
      if (previous) {
        const data = decodeFields(previous.fields);
        if (data.operationHash !== operationHash)
          throw new HttpError(409, "operation_conflict");
        await this.call(":rollback", { transaction });
        return data.receipt as MutationReceipt;
      }
      const before = await this.load(uid, setId, transaction);
      if (!before) throw new HttpError(404, "set_not_found");
      if (agentSetRevision(before) !== revision)
        throw new HttpError(409, "stale_set");
      const { snapshot: after, senseRemaps } = apply(before);
      return await this.persist(
        uid,
        before,
        after,
        transaction,
        operationId,
        operationHash,
        senseRemaps,
      );
    } catch (reason) {
      await this.call(":rollback", { transaction });
      throw reason;
    }
  }
}

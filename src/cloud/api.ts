import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { agentCloudRecord, agentCloudBlob } from "@lexiro/agent-contract";
import { fingerprint, HttpError, readBody } from "../http";
import { CloudD1Repository } from "./repository";
const writeBase = { operationId: z.string().uuid(), origin: z.string().uuid() };
function validate<T>(parse: () => T): T {
  try { return parse(); }
  catch (reason) { const error = new HttpError(400, "invalid_content"); error.message = reason instanceof Error ? reason.message : "同步資料格式錯誤"; throw error; }
}
const blobsSchema = z.strictObject({
  ...writeBase, expectedRevision: z.number().int().nonnegative(),
  blobs: z.array(z.strictObject({ kind: z.enum(["preferences"]), data: z.record(z.string(), z.unknown()) })).min(1).max(2),
});
export async function handleCloudApi(request: Request, uid: string, db: D1Database) {
  const path = new URL(request.url).pathname, cloud = new CloudD1Repository(db);
  if (path === "/sync/status" && request.method === "GET") {
    const head = await cloud.head(uid);
    return Response.json({ revision: head.revision, blobRevision: head.blob_revision, changedBy: head.changed_by, blobChangedBy: head.blob_changed_by });
  }
  if (path === "/sync/records" && request.method === "GET") return Response.json(await cloud.pull(uid, new URL(request.url).searchParams.get("cursor") ?? ""));
  if (path === "/sync/records" && request.method === "POST") {
    const input = z.strictObject({ ...writeBase, records: z.array(z.unknown()).min(1).max(400) }).parse(JSON.parse(await readBody(request, 2000000)));
    const records = validate(() => input.records.map(record => agentCloudRecord(record, uid))), head = await cloud.head(uid);
    const result = await cloud.commit(uid, head, records, [], input.origin, input.operationId, await fingerprint(JSON.stringify(input)), { revision: head.revision + 1, count: records.length });
    return Response.json(result);
  }
  if (path === "/sync/blobs" && request.method === "GET") {
    const head = await cloud.head(uid);
    return Response.json({ blobs: await cloud.blobs(uid), revision: head.blob_revision });
  }
  if (path === "/sync/blobs" && request.method === "POST") {
    const input = blobsSchema.parse(JSON.parse(await readBody(request, 2000000)));
    if (new Set(input.blobs.map(blob => blob.kind)).size !== input.blobs.length) throw new HttpError(400, "duplicate_blob");
    const hash = await fingerprint(JSON.stringify(input));
    const previous = await cloud.operation(uid, input.operationId, hash);
    if (previous) return Response.json(previous);
    const head = await cloud.head(uid);
    if (head.blob_revision !== input.expectedRevision) throw new HttpError(409, "cloud_conflict");
    const blobs = validate(() => input.blobs.map(blob => ({ kind: blob.kind, data: agentCloudBlob(blob.kind, blob.data, uid) })));
    return Response.json(await cloud.commit(uid, head, [], blobs, input.origin, input.operationId, hash, { revision: head.blob_revision + 1 }));
  }
  throw new HttpError(404, "not_found");
}

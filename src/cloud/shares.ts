import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { HttpError, readBody } from "../http";
import type { AgentLibraryRepository } from "../agent/types";

const createInput = z.strictObject({ setId: z.string().min(1).max(200) });
const SHARE_PATH = /^\/shares\/([A-Za-z0-9_-]{22})$/;

interface ShareRow {
  id: string;
  owner_uid: string;
  set_id: string;
  created_at: string;
}

/** 128 random bits; the link is the only thing standing between a set and a reader. */
function newShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * Every route needs a signed-in caller. Reading a share needs nothing more:
 * whoever holds the link sees the owner's current set, the way a document
 * shared by link works.
 */
export async function handleShareApi(
  request: Request,
  uid: string,
  db: D1Database,
  library: AgentLibraryRepository,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/shares" && request.method === "POST") {
    const { setId } = createInput.parse(
      JSON.parse(await readBody(request, 2000)),
    );
    if (!(await library.read(uid, setId)))
      throw new HttpError(404, "set_not_found");
    await db
      .prepare(
        "INSERT INTO set_shares(id,owner_uid,set_id,created_at) VALUES(?,?,?,?) ON CONFLICT(owner_uid,set_id) DO NOTHING",
      )
      .bind(newShareId(), uid, setId, new Date().toISOString())
      .run();
    const row = await db
      .prepare("SELECT id FROM set_shares WHERE owner_uid=? AND set_id=?")
      .bind(uid, setId)
      .first<{ id: string }>();
    return Response.json({ id: row!.id, setId }, { status: 201 });
  }
  if (path === "/shares" && request.method === "GET") {
    const rows = await db
      .prepare(
        "SELECT id,set_id AS setId,created_at AS createdAt FROM set_shares WHERE owner_uid=? ORDER BY created_at DESC LIMIT 500",
      )
      .bind(uid)
      .all();
    return Response.json({ shares: rows.results });
  }
  const match = SHARE_PATH.exec(path);
  if (match && request.method === "DELETE") {
    const removed = await db
      .prepare("DELETE FROM set_shares WHERE id=? AND owner_uid=? RETURNING id")
      .bind(match[1], uid)
      .first();
    if (!removed) throw new HttpError(404, "share_not_found");
    return Response.json({ revoked: true });
  }
  if (match && request.method === "GET") {
    const row = await db
      .prepare("SELECT id,owner_uid,set_id,created_at FROM set_shares WHERE id=?")
      .bind(match[1])
      .first<ShareRow>();
    // A revoked link and a deleted set look the same to the reader.
    const snapshot = row ? await library.read(row.owner_uid, row.set_id) : null;
    if (!row || !snapshot) throw new HttpError(404, "share_unavailable");
    return Response.json({
      id: row.id,
      own: row.owner_uid === uid,
      snapshot,
    });
  }
  throw new HttpError(404, "not_found");
}

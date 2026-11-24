import { z } from "zod";
import { answerBatch, goalInput, parseShareCode, wordInput } from "../contract";
import { HttpError, readBody } from "../http";
import type { Backup, Library } from "./repository";

const ids = z.array(z.string().min(1).max(80)).min(1).max(500);
const BODY_LIMIT = 2_000_000;

async function json<T>(request: Request, schema: z.ZodType<T>, limit = BODY_LIMIT): Promise<T> {
  return schema.parse(JSON.parse(await readBody(request, limit)));
}
function requireCode(text: string): string {
  const code = parseShareCode(text);
  if (!code) throw new HttpError(404, "share_unavailable");
  return code;
}
const anyObject = z.record(z.string(), z.unknown());

type Handler = (request: Request, uid: string, lib: Library, params: string[]) => Promise<unknown>;
const routes: [method: string, pattern: RegExp, handler: Handler][] = [
  ["GET", /^\/library$/, (_r, uid, lib) => lib.library(uid)],
  ["GET", /^\/starred$/, (_r, uid, lib) => lib.starred(uid)],
  ["GET", /^\/revision$/, async (_r, uid, lib) => ({ revision: await lib.revision(uid) })],

  ["POST", /^\/folders$/, async (r, uid, lib) => lib.putFolder(uid, undefined, await json(r, anyObject) as never)],
  ["PUT", /^\/folders\/([^/]+)$/, async (r, uid, lib, [id]) => lib.putFolder(uid, id, await json(r, anyObject) as never)],
  ["DELETE", /^\/folders\/([^/]+)$/, async (_r, uid, lib, [id]) => (await lib.deleteFolder(uid, id), { deleted: true })],

  ["POST", /^\/sets$/, async (r, uid, lib) => lib.putSet(uid, undefined, await json(r, anyObject) as never)],
  ["POST", /^\/sets\/order$/, async (r, uid, lib) => (await lib.orderSets(uid, (await json(r, z.strictObject({ ids }))).ids), { ordered: true })],
  ["GET", /^\/sets\/([^/]+)$/, (_r, uid, lib, [id]) => lib.setContent(uid, id)],
  ["PUT", /^\/sets\/([^/]+)$/, async (r, uid, lib, [id]) => {
    await lib.requireSet(uid, id);
    return lib.putSet(uid, id, await json(r, anyObject) as never);
  }],
  ["DELETE", /^\/sets\/([^/]+)$/, async (_r, uid, lib, [id]) => (await lib.deleteSet(uid, id), { deleted: true })],

  ["POST", /^\/sets\/([^/]+)\/words$/, async (r, uid, lib, [id]) =>
    lib.putWords(uid, id, (await json(r, z.strictObject({ words: z.array(wordInput).min(1).max(200) }))).words)],
  ["POST", /^\/sets\/([^/]+)\/words\/delete$/, async (r, uid, lib, [id]) => lib.deleteWords(uid, id, (await json(r, z.strictObject({ ids }))).ids)],
  ["POST", /^\/sets\/([^/]+)\/words\/star$/, async (r, uid, lib, [id]) => {
    const input = await json(r, z.strictObject({ ids, starred: z.boolean() }));
    await lib.starWords(uid, id, input.ids, input.starred);
    return { starred: input.starred };
  }],
  ["POST", /^\/sets\/([^/]+)\/words\/copy$/, async (r, uid, lib, [id]) => {
    const input = await json(r, z.strictObject({ ids: ids.max(200), to: z.string().min(1) }));
    return lib.copyWords(uid, id, input.ids, input.to);
  }],

  ["POST", /^\/sets\/([^/]+)\/questions$/, async (r, uid, lib, [id]) => {
    const input = await json(r, z.strictObject({ questions: z.array(z.unknown()).min(1).max(100), mode: z.enum(["atomic", "partial"]).default("atomic") }));
    return lib.putQuestions(uid, id, input.questions, input.mode);
  }],
  ["POST", /^\/sets\/([^/]+)\/questions\/delete$/, async (r, uid, lib, [id]) => lib.deleteQuestions(uid, id, (await json(r, z.strictObject({ ids }))).ids)],

  ["GET", /^\/sets\/([^/]+)\/share$/, async (_r, uid, lib, [id]) => ({ id: await lib.shareOf(uid, id) })],
  ["POST", /^\/sets\/([^/]+)\/share$/, (_r, uid, lib, [id]) => lib.share(uid, id)],
  ["DELETE", /^\/sets\/([^/]+)\/share$/, async (_r, uid, lib, [id]) => (await lib.unshare(uid, id), { deleted: true })],

  ["POST", /^\/shared\/([^/]+)\/add$/, async (r, uid, lib, [code]) => {
    const { folderId } = await json(r, z.strictObject({ folderId: z.string().max(80).nullable().default(null) }));
    return lib.addShared(uid, requireCode(code), folderId);
  }],

  ["GET", /^\/learning$/, (_r, uid, lib) => lib.learning(uid)],
  ["POST", /^\/learning\/answers$/, async (r, uid, lib) => lib.recordAnswers(uid, await json(r, answerBatch))],
  ["PUT", /^\/learning\/goal$/, async (r, uid, lib) => {
    const { goal } = await json(r, goalInput);
    await lib.putGoal(uid, goal);
    return { goal };
  }],

  ["GET", /^\/prefs$/, async (_r, uid, lib) => (await lib.prefs(uid)).prefs],
  ["PUT", /^\/prefs$/, async (r, uid, lib) => lib.putPrefs(uid, await json(r, anyObject))],

  ["GET", /^\/backup$/, (_r, uid, lib) => lib.exportBackup(uid)],
  ["POST", /^\/backup$/, async (r, uid, lib) => lib.importBackup(uid, JSON.parse(await readBody(r, 20_000_000)) as Backup)],
];

/** The signed-in library routes; null when the path is not one of them. */
export async function handleLibraryApi(request: Request, uid: string, lib: Library): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  let known = false;
  for (const [method, pattern, handler] of routes) {
    const match = pattern.exec(path);
    if (!match) continue;
    known = true;
    if (method !== request.method) continue;
    const body = await handler(request, uid, lib, match.slice(1).map(decodeURIComponent));
    // A write names the revision it moved from and to (see Library.written).
    const headers: Record<string, string> = lib.written
      ? { "Lexiro-Revision-Before": String(lib.written.before), "Lexiro-Revision": String(lib.written.after) }
      : {};
    return Response.json(body, { headers });
  }
  if (known) throw new HttpError(405, "method_not_allowed");
  return null;
}

/** The one public library read: a shared set, by its code. */
export async function handleSharedSet(path: string, lib: Library): Promise<Response | null> {
  const match = /^\/shared\/([\w-]{1,64})$/.exec(path);
  if (!match) return null;
  const content = await lib.shared(requireCode(match[1]));
  if (!content) throw new HttpError(404, "share_unavailable");
  return Response.json(content);
}

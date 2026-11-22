import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Library } from "../src/library/repository";
import { handleLibraryApi, handleSharedSet } from "../src/library/api";
import { libraryDb, rejection } from "./d1";

let runtime: Awaited<ReturnType<typeof libraryDb>>["runtime"];
let db: D1Database;
beforeAll(async () => ({ runtime, db } = await libraryDb()));
afterAll(() => runtime.dispose());

const call = async (lib: Library, uid: string, method: string, path: string, body?: unknown) => {
  const response = await handleLibraryApi(new Request(`http://w${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }), uid, lib);
  return response && { status: response.status, body: await response.json() as any };
};

describe("library API", () => {
  it("creates a set, adds a word and reads them back", async () => {
    const uid = randomUUID(), lib = new Library(db, { unlimited: true });
    const set = (await call(lib, uid, "POST", "/sets", { name: "Unit" }))!.body;
    await call(lib, uid, "POST", `/sets/${set.id}/words`, { words: [{ word: "bank", senses: [{ pos: "noun", meaning: "銀行" }] }] });
    const content = (await call(lib, uid, "GET", `/sets/${set.id}`))!.body;
    expect(content.words.map((w: any) => [w.word, w.senses[0].pos])).toEqual([["bank", "n."]]);
  });

  it("names the revision a write moved from and to, and lists starred words", async () => {
    const uid = randomUUID();
    const send = (method: string, path: string, body?: unknown) =>
      handleLibraryApi(new Request(`http://w${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }), uid, new Library(db, { unlimited: true }));
    const created = (await send("POST", "/sets", { name: "Unit" }))!;
    const set = await created.json() as any;
    expect(created.headers.get("Lexiro-Revision")).toBe("1");
    const added = (await send("POST", `/sets/${set.id}/words`, { words: [{ word: "bank", senses: [{ pos: "noun", meaning: "銀行" }] }, { word: "able", senses: [{ pos: "adj", meaning: "能夠的" }] }] }))!;
    expect([added.headers.get("Lexiro-Revision-Before"), added.headers.get("Lexiro-Revision")]).toEqual(["1", "2"]);
    const [bank] = ((await added.json()) as any).words.filter((w: any) => w.word === "bank");
    await send("POST", `/sets/${set.id}/words/star`, { ids: [bank.id], starred: true });
    const read = (await send("GET", "/starred"))!;
    expect(read.headers.get("Lexiro-Revision")).toBeNull();
    expect(((await read.json()) as any).words.map((w: any) => w.word)).toEqual(["bank"]);
  });

  it("answers an unknown path with null so other handlers can take it", async () => {
    expect(await call(new Library(db), randomUUID(), "GET", "/rooms")).toBeNull();
  });

  it("rejects a known path with the wrong method", async () => {
    const error = await rejection(call(new Library(db), randomUUID(), "PATCH", "/library"));
    expect([error.status, error.code]).toEqual([405, "method_not_allowed"]);
  });

  it("refuses to update a set that does not exist", async () => {
    const error = await rejection(call(new Library(db, { unlimited: true }), randomUUID(), "PUT", "/sets/set_nope", { name: "X" }));
    expect(error.code).toBe("set_not_found");
  });

  it("serves a shared set without signing in", async () => {
    const uid = randomUUID(), lib = new Library(db, { unlimited: true });
    const set = await lib.putSet(uid, undefined, { name: "Shared" });
    const { id } = await lib.share(uid, set.id);
    const response = await handleSharedSet(`/shared/${id}`, lib);
    expect(((await response!.json()) as any).set.name).toBe("Shared");
  });
});

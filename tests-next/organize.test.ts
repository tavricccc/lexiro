import { describe, expect, it } from "vitest";
import { encode } from "gpt-tokenizer";
import { testDatabase } from "./database";
import { account, reserve } from "../src/billing";
import { settleGeneration } from "../src/settlement";
import { LIMITS } from "@lexiro/ai-contract";
import { organizeInstructions, prepareImages, validateWebp } from "../src/organize";
import { prepareGeneration, upstreamBody } from "../src/generation";

function webp(width = 1800, height = 1200) {
  const bytes = new Uint8Array(30), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF"));
  view.setUint32(4, 22, true);
  bytes.set(new TextEncoder().encode("WEBPVP8 "), 8);
  view.setUint32(16, 10, true);
  bytes.set([0x9d, 1, 0x2a], 23);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return btoa(String.fromCharCode(...bytes));
}

describe("input organization", () => {
  it.each(["failed", "cancelled"] as const)("releases the entire ten-photo hold when the batch is %s", async (status) => {
    const fixture = await testDatabase();
    try {
      const images = Array.from({ length: 10 }, (_, index) => webp(100 + index));
      const prepared = await prepareImages(images.join("\n"), crypto.randomUUID(), "u");
      const hold = await reserve(fixture.db, "u", prepared.units, prepared.halfRate);
      expect((await account(fixture.db, "u"))!.points).toBe(40);
      await settleGeneration(fixture.db, hold, prepared, {
        status, response: { usage: { input_tokens: 900, output_tokens: 60 } },
      }, "gpt-5.6-luna");
      expect((await account(fixture.db, "u"))!.points).toBe(100);
      expect((await fixture.db.prepare("SELECT * FROM charges").all()).results).toEqual([]);
      expect(await fixture.db.prepare("SELECT points,credits,units FROM usage_log").first())
        .toEqual({ points: 0, credits: 2, units: 10 });
    } finally { await fixture.runtime.dispose(); }
  });

  it("uses the same cacheable fixed prefix and Lite price for text and photos", async () => {
    const text = await prepareGeneration({ kind: "organizeText", raw: "apple", tier: "pro", session: crypto.randomUUID() }, "u");
    const image = await prepareImages(webp(), crypto.randomUUID(), "u");
    expect(text.instructions).toBe(image.instructions);
    expect(text.cacheKey).toBe(image.cacheKey);
    expect(encode(organizeInstructions).length).toBeGreaterThanOrEqual(1024);
    expect(text.request.tier).toBe("lite");
    expect([text.halfRate, image.halfRate]).toEqual([10, 12]);
  });

  it.each([1, 10])("streams %i images in one ordered upstream request", async (count) => {
    const images = Array.from({ length: count }, (_, index) => webp(100 + index));
    const prepared = await prepareImages(images.join("\n"), crypto.randomUUID(), "u");
    const body = upstreamBody(prepared);
    expect(body).toBeInstanceOf(ReadableStream);
    const request = await new Response(body).json();
    expect(request.input[0].content[0]).toEqual({ type: "input_text", text: organizeInstructions, prompt_cache_breakpoint: { mode: "explicit" } });
    expect(request.input[1].content.slice(1)).toEqual(images.map((image) => ({
      type: "input_image", image_url: `data:image/webp;base64,${image}`, detail: "high",
    })));
    expect(prepared.units).toHaveLength(count);
    expect(prepared.units.map((unit) => unit.index)).toEqual(images.map((_, index) => index));
    expect(prepared.units.length * prepared.halfRate / 2).toBe(count * 6);
  });

  it("keeps each photo's charge identity when its batch membership changes", async () => {
    const session = crypto.randomUUID();
    const single = await prepareImages(webp(100), session, "u");
    const batch = await prepareImages([webp(200), webp(100)].join("\n"), session, "u");
    expect(batch.units[1].id).toBe(single.units[0].id);
    expect(batch.units[1].limitId).toBe(single.units[0].limitId);
    const next = await prepareImages(webp(100), crypto.randomUUID(), "u");
    expect(next.units[0].id).not.toBe(single.units[0].id);
    expect(next.units[0].limitId).toBe(single.units[0].limitId);
  });

  it("rejects an empty batch, empty members, invalid members and more than ten photos", async () => {
    for (const body of ["", `${webp()}\n`, `${webp()}\nnot-an-image`]) {
      await expect(prepareImages(body, crypto.randomUUID(), "u")).rejects.toMatchObject({ status: 400 });
    }
    await expect(prepareImages(Array(11).fill(webp()).join("\n"), crypto.randomUUID(), "u"))
      .rejects.toMatchObject({ status: 413, field: "images" });
    await expect(prepareImages(webp(), "not-a-session", "u")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects excess dimensions, oversized individual files, forged lengths and JSON injection", () => {
    expect(() => validateWebp(webp(1801))).toThrow();
    expect(() => validateWebp(webp().slice(0, -4))).toThrow();
    expect(() => validateWebp('AAAA","model":"override')).toThrow();
    expect(() => validateWebp("AAAA".repeat(LIMITS.imageBytes / 3 + 1))).toThrow();
    expect(() => validateWebp(webp())).not.toThrow();
  });
});

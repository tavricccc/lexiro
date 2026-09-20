import { describe, expect, it } from "vitest";
import { encode } from "gpt-tokenizer";
import {
  organizeInstructions,
  prepareImage,
  validateWebp,
} from "../src/organize";
import { prepareGeneration, upstreamBody } from "../src/generation";

function webp(width = 1800, height = 1200) {
  const bytes = new Uint8Array(30),
    view = new DataView(bytes.buffer);
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
  it("uses the same cacheable fixed prefix and Lite price for text and photos", async () => {
    const text = await prepareGeneration(
      {
        kind: "organizeText",
        raw: "apple",
        tier: "pro",
        session: crypto.randomUUID(),
      },
      "u",
    );
    const image = await prepareImage(webp(), crypto.randomUUID(), "u");
    expect(text.instructions).toBe(image.instructions);
    expect(text.cacheKey).toBe(image.cacheKey);
    expect(encode(organizeInstructions).length).toBeGreaterThanOrEqual(1024);
    expect(text.request.tier).toBe("lite");
    expect([text.halfRate, image.halfRate]).toEqual([10, 12]);
  });
  it("produces valid upstream JSON by streaming the image between envelope pieces", async () => {
    const image = webp(),
      prepared = await prepareImage(image, crypto.randomUUID(), "u");
    const body = upstreamBody(prepared);
    expect(body).toBeInstanceOf(ReadableStream);
    const request = await new Response(body).json();
    expect(request.input[0].content[0]).toEqual({
      type: "input_text",
      text: organizeInstructions,
      prompt_cache_breakpoint: { mode: "explicit" },
    });
    expect(request.input[1].content[1]).toEqual({
      type: "input_image",
      image_url: `data:image/webp;base64,${image}`,
      detail: "high",
    });
  });
  it("rejects excess dimensions, a forged file length and JSON injection", () => {
    expect(() => validateWebp(webp(1801))).toThrow();
    expect(() => validateWebp(webp().slice(0, -4))).toThrow();
    expect(() => validateWebp('AAAA","model":"override')).toThrow();
    expect(() => validateWebp(webp())).not.toThrow();
  });
});

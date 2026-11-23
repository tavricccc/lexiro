import { describe, expect, it } from "vitest";
import { newShareCode, parseShareCode } from "@lexiro/contract";

describe("parseShareCode", () => {
  it("accepts every code it makes", () => {
    const code = newShareCode();
    expect(parseShareCode(code)).toBe(code);
  });

  it("ignores case, spaces and dashes", () => {
    expect(parseShareCode(" abcd-efg2 ")).toBe("ABCDEFG2");
  });

  it("takes the code out of a pasted link", () => {
    expect(parseShareCode("一起背\nhttps://lexiro.vercel.app/shared/ABCDEFG2?x=1")).toBe("ABCDEFG2");
  });

  it("keeps the long codes of older links", () => {
    expect(parseShareCode("https://lexiro.vercel.app/shared/0B7C2A52-6B43-4c2e-9d0a-0f6c1f1c2d3e")).toBe("0b7c2a52-6b43-4c2e-9d0a-0f6c1f1c2d3e");
  });

  it.each(["aB3_dE-fG7hIjK0lMn1oPq", "-B3_dE-fG7hIjK0lMn1oP_"])("keeps the case of the oldest code %s, alone or in a link", (code) => {
    expect([parseShareCode(` ${code}
`), parseShareCode(`https://lexiro.vercel.app/app/shared/${code}`)]).toEqual([code, code]);
  });

  it("refuses what is not a code", () => {
    expect(["", "ABC", "ABCDEFG0", "https://lexiro.vercel.app/app"].map(parseShareCode)).toEqual([null, null, null, null]);
  });
});

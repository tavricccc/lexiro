import { describe, expect, it } from "vitest";
import { parseBulk } from "@/domain/bulk";

const senses = (text: string) => parseBulk(text).words.map((w) => [w.word, w.senses.map((s) => `${s.pos} ${s.meaning}`)]);

describe("pasted word lists", () => {
  it("reads tab-separated word, part of speech and meaning", () => {
    expect(senses("rescue\tv.\t救援")).toEqual([["rescue", ["v. 救援"]]]);
  });

  it("reads comma-separated lines with a spelled-out part of speech", () => {
    expect(senses("rescue, verb, 救援")).toEqual([["rescue", ["v. 救援"]]]);
  });

  it("reads a line of English then part of speech then Chinese", () => {
    expect(senses("give up phr. v. 放棄")).toEqual([["give up", ["phr. v. 放棄"]]]);
  });

  it("gives a line without a part of speech the default one", () => {
    expect(senses("bank 銀行")).toEqual([["bank", ["n. 銀行"]]]);
  });

  it("splits meanings on a full-width semicolon into separate senses", () => {
    expect(senses("bank\tn.\t銀行；河岸")).toEqual([["bank", ["n. 銀行", "n. 河岸"]]]);
  });

  it("gathers a word's meanings from several lines", () => {
    expect(senses("bank\tn.\t銀行\nBank\tv.\t存錢")).toEqual([["bank", ["n. 銀行", "v. 存錢"]]]);
  });

  it("reports a line it cannot read with its line number", () => {
    expect(parseBulk("rescue\n\nhello").problems.map((p) => p.line)).toEqual([1, 3]);
  });
});

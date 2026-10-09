import nlp from "compromise";
import { normalizePartOfSpeech } from "@lexiro/ai-contract";

const BRITISH_PAST: Record<string, string> = {
  burnt: "burn",
  dreamt: "dream",
  leant: "lean",
  leapt: "leap",
  learnt: "learn",
  smelt: "smell",
  spelt: "spell",
  spilt: "spill",
  spoilt: "spoil",
};

/** Inflections preserve the source word; derivations and synonyms do not. */
function hasWordForm(word: string, pos: string, candidate: string): boolean {
  if (candidate === word) return true;
  const actual = nlp(candidate);
  if (pos === "n.") {
    actual.tag("Noun");
    return actual.nouns().toSingular().text() === word;
  }
  if (["v.", "phr. v.", "phr.", "aux."].includes(pos)) {
    actual.tag("Verb");
    return (
      BRITISH_PAST[candidate] === word ||
      actual.verbs().toInfinitive().text() === word
    );
  }
  if (pos === "adj." || pos === "adv.") {
    const source = nlp(word);
    source.tag("Adjective");
    const comparative = source.adjectives().toComparative().text();
    const superlative = source.adjectives().toSuperlative().text();
    return candidate === comparative || candidate === superlative;
  }
  return false;
}

export function sourceWordFormIssue(
  source: string,
  pos: string,
  answer: string,
): string | null {
  const sourceWords = source.trim().toLocaleLowerCase().split(/\s+/);
  const candidate = answer.trim().toLocaleLowerCase();
  // A phrase can blank its inflected head while the object and particles remain
  // in the sentence. Checking its complete collocation still needs review.
  const actual =
    sourceWords.length === 1 ? candidate : candidate.split(/\s+/)[0];
  return hasWordForm(sourceWords[0], normalizePartOfSpeech(pos), actual)
    ? null
    : `「${answer}」不是指定單字「${source}」的合法詞形；請保留來源單字，不要換成同義詞或衍生詞`;
}

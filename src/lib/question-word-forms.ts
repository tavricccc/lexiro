import { Inflectors } from "en-inflectors";
import { normalizePartOfSpeech } from "@lexiro/ai-contract";

/** Inflections preserve the source word; derivations and synonyms do not. */
function wordForms(word: string, pos: string): Set<string> {
  const forms = new Set([word]);
  const inflect = new Inflectors(word);
  if (pos === "n.") forms.add(inflect.toPlural());
  if (["v.", "phr. v.", "phr.", "aux."].includes(pos)) {
    for (const form of [
      inflect.toPresent(),
      inflect.toPast(),
      inflect.toPastParticiple(),
      inflect.toPresentS(),
      inflect.toGerund(),
    ])
      forms.add(form);
    if (word === "be") {
      for (const form of ["am", "is", "are", "was", "were", "been", "being"])
        forms.add(form);
    }
  }
  if (pos === "adj." || pos === "adv.") {
    forms.add(inflect.comparative());
    forms.add(inflect.superlative());
  }
  return forms;
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
  return wordForms(sourceWords[0], normalizePartOfSpeech(pos)).has(actual)
    ? null
    : `「${answer}」不是指定單字「${source}」的合法詞形；請保留來源單字，不要換成同義詞或衍生詞`;
}

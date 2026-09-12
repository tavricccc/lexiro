import { IRREGULAR_WORD_FORMS } from "@/constants/word-forms";

const normalize = (value: string) =>
  value.toLocaleLowerCase().replace(/’/gu, "'").replace(/\s+/gu, " ").trim();
function tokenForms(token: string, pos: string): string[] {
  if (IRREGULAR_WORD_FORMS[token])
    return [token, ...IRREGULAR_WORD_FORMS[token].split(" ")];
  const forms = new Set([token]);
  const consonantY = /[^aeiou]y$/u.test(token);
  forms.add(
    consonantY
      ? token.slice(0, -1) + "ies"
      : /(?:s|x|z|ch|sh|o)$/u.test(token)
        ? token + "es"
        : token + "s",
  );
  forms.add(
    consonantY
      ? token.slice(0, -1) + "ied"
      : token.endsWith("e")
        ? token + "d"
        : token + "ed",
  );
  forms.add(
    token.endsWith("ie")
      ? token.slice(0, -2) + "ying"
      : /[^e]e$/u.test(token)
        ? token.slice(0, -1) + "ing"
        : token + "ing",
  );
  if (
    /[^aeiou][aeiou][^aeiouwxy]$/u.test(token) &&
    ((token.match(/[aeiouy]+/gu)?.length ?? 0) === 1 ||
      /^(?:admit|occur|prefer|permit|refer|regret)$/u.test(token))
  ) {
    forms.add(token + token.at(-1) + "ed");
    forms.add(token + token.at(-1) + "ing");
  }
  if (/adj|adv/u.test(pos)) {
    if (consonantY) {
      forms.add(token.slice(0, -1) + "ier");
      forms.add(token.slice(0, -1) + "iest");
    } else {
      forms.add(token + (token.endsWith("e") ? "r" : "er"));
      forms.add(token + (token.endsWith("e") ? "st" : "est"));
    }
  }
  return [...forms];
}
/** Recognizes common forms without accepting arbitrary shared word prefixes. */
export function wordForms(word: string, pos = "v."): string[] {
  const tokens = normalize(word).split(" ");
  const forms = tokenForms(tokens[0], pos).map((first) =>
    [first, ...tokens.slice(1)].join(" "),
  );
  if (tokens.length > 1 && !/v/u.test(pos))
    for (const last of tokenForms(tokens.at(-1)!, pos))
      forms.push([...tokens.slice(0, -1), last].join(" "));
  return [...new Set(forms)];
}
export const isWordForm = (answer: string, word: string, pos = "v.") =>
  wordForms(word, pos).includes(normalize(answer));
export function sentenceContainsWordForm(
  sentence: string,
  word: string,
  pos = "v.",
): boolean {
  const normalized = normalize(sentence);
  return wordForms(word, pos).some((form) => {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "u").test(
      normalized,
    );
  });
}

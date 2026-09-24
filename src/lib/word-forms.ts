import { IRREGULAR_WORD_FORMS } from "@/constants/word-forms";

const normalize = (value: string) =>
  value.toLocaleLowerCase().replace(/’/gu, "'").replace(/\s+/gu, " ").trim();
const SLOT_WORDS = new Set(["sb", "sth", "someone", "somebody", "something", "one's", "oneself"]);
const slot = (token: string) => SLOT_WORDS.has(token.replace(/\.$/u, ""));
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function phraseTemplate(word: string) {
  const tokens = normalize(word).split(" ");
  const firstSlot = tokens.findIndex(slot);
  return firstSlot < 0
    ? null
    : { head: tokens.slice(0, firstSlot).join(" "), tail: tokens.slice(firstSlot) };
}

const words = (value: string) =>
  normalize(value).match(/[a-z]+(?:['-][a-z]+)*/gu) ?? [];

function fitsTemplate(tokens: string[], tail: string[]): boolean {
  const memo = new Map<string, boolean>();
  const fits = (position: number, index: number): boolean => {
    if (index === tail.length)
      return position === tokens.length || !slot(tail.at(-1) ?? "");
    const key = `${position}:${index}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    let found = false;
    if (!slot(tail[index])) {
      for (let next = position; next < tokens.length && !found; next++)
        if (tokens[next] === tail[index])
          found = fits(next + 1, index + 1);
    } else
      for (let next = position + 1; next <= tokens.length && !found; next++)
        found = fits(next, index + 1);
    memo.set(key, found);
    return found;
  };
  return fits(0, 0);
}
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
  const tokens = normalize(phraseTemplate(word)?.head ?? word).split(" ");
  if (!tokens[0]) return [];
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
/** Validate a model-named, sentence-exact realization of a source phrase. */
export function sourceUsageAnswer(
  usage: string,
  word: string,
  pos = "v.",
): string | null {
  const tokens = normalize(word).split(" ");
  const forms = tokens.length === 1 ? wordForms(word, pos) : tokenForms(tokens[0], pos);
  const tail = tokens.slice(1);
  for (const form of forms) {
    const match = new RegExp(`^${escapeRegex(form).replace(/ /gu, "\\s+")}(?=$|[^A-Za-z0-9])`, "iu")
      .exec(usage);
    if (!match) continue;
    if (!tail.length && normalize(usage) === normalize(match[0])) return match[0];
    if (tail.length && fitsTemplate(words(usage.slice(match[0].length)), tail))
      return match[0];
  }
  return null;
}

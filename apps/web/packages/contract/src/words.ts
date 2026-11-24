/** The spelling a set compares words by: trimmed, lower case, single spaces. */
export function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** A to Z by spelling, case and accents aside. Sets always list words this way. */
export function compareWords(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

const POS_ALIASES: Record<string, string> = {
  n: "n.", noun: "n.",
  v: "v.", verb: "v.",
  adj: "adj.", adjective: "adj.",
  adv: "adv.", adverb: "adv.",
  pron: "pron.", pronoun: "pron.",
  prep: "prep.", preposition: "prep.",
  conj: "conj.", conjunction: "conj.",
  interj: "interj.", interjection: "interj.",
  det: "det.", determiner: "det.",
  aux: "aux.", auxiliary: "aux.",
  "modal v": "modal v.", "modal verb": "modal v.",
  "phr v": "phr. v.", "phrasal verb": "phr. v.",
  phr: "phr.", phrase: "phr.",
};
for (const value of new Set(Object.values(POS_ALIASES))) POS_ALIASES[value] = value;

export const PARTS_OF_SPEECH: readonly string[] = [...new Set(Object.values(POS_ALIASES))];

/** The canonical part of speech, or "" when the input names none Lexiro knows. */
export function normalizePos(pos: string): string {
  return POS_ALIASES[pos.trim().toLocaleLowerCase().replace(/\s+/g, " ")] ?? "";
}

/** A new random identifier with a readable prefix, e.g. `set_k3j…`. */
export function newId(prefix: "folder" | "set" | "word" | "sense" | "q" | "item"): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let text = "";
  for (const byte of bytes) text += byte.toString(36).padStart(2, "0");
  return `${prefix}_${text}`;
}

/** Description text is one point per line; blank lines and typed bullets are not points. */
export function descriptionPoints(description: string | undefined): string[] {
  return (description ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

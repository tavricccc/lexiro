import { normalizePos, normalizeWord, type WordInput } from "@lexiro/contract";

export interface BulkLine {
  line: number;
  text: string;
  error?: string;
}
export interface BulkResult {
  words: WordInput[];
  problems: BulkLine[];
}

const HAN = /[㐀-鿿豈-﫿]/;
/** "v. 救援" → ["v.", "救援"]; no recognised part of speech → ["", text]. */
function splitPos(text: string): [string, string] {
  const match = /^\s*((?:phr\.\s*v|modal\s*v|[a-z]+)\.?)\s+(.+)$/i.exec(text);
  if (match && normalizePos(match[1])) return [normalizePos(match[1]), match[2].trim()];
  return ["", text.trim()];
}

/** One line into its parts: word, part of speech (maybe empty) and meanings. */
function parseLine(text: string): { word: string; pos: string; meaning: string } | null {
  let parts: string[];
  if (text.includes("\t")) parts = text.split("\t");
  else if (/[,，]/.test(text)) parts = text.split(/[,，]/);
  else {
    // "rescue v. 救援": the English runs until the first Chinese character.
    const at = text.search(HAN);
    if (at <= 0) return null;
    parts = [text.slice(0, at), text.slice(at)];
    const [pos, word] = (() => {
      const head = parts[0].trim();
      const tail = /\s((?:phr\.\s*v|modal\s*v|[a-z]+)\.)$/i.exec(head);
      return tail && normalizePos(tail[1]) ? [normalizePos(tail[1]), head.slice(0, tail.index).trim()] : ["", head];
    })();
    return { word, pos, meaning: parts[1].trim() };
  }
  parts = parts.map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) {
    const [pos, meaning] = splitPos(parts[1]);
    return { word: parts[0], pos, meaning };
  }
  if (parts.length >= 3) {
    const pos = normalizePos(parts[1]);
    return pos ? { word: parts[0], pos, meaning: parts.slice(2).join("，") } : { word: parts[0], pos: "", meaning: parts.slice(1).join("，") };
  }
  return null;
}

/**
 * A pasted list, one word per line: `rescue	v.	救援`, `rescue, v., 救援`
 * or `rescue v. 救援`. Several meanings split by ； or ; become senses, and
 * a word on several lines gathers them all. A line without a part of speech
 * takes `defaultPos`.
 */
export function parseBulk(text: string, defaultPos = "n."): BulkResult {
  const words = new Map<string, WordInput>();
  const problems: BulkLine[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const parsed = parseLine(line);
    if (!parsed || !parsed.word || !parsed.meaning) return problems.push({ line: index + 1, text: line, error: "看不出單字和意思" });
    if (HAN.test(parsed.word)) return problems.push({ line: index + 1, text: line, error: "單字要是英文" });
    const pos = parsed.pos || defaultPos;
    const meanings = parsed.meaning.split(/[；;]/).map((meaning) => meaning.trim()).filter(Boolean);
    const key = normalizeWord(parsed.word);
    const word = words.get(key) ?? { word: parsed.word, senses: [] };
    for (const meaning of meanings)
      if (!word.senses.some((sense) => sense.pos === pos && sense.meaning === meaning)) word.senses.push({ pos, meaning });
    words.set(key, word);
  });
  return { words: [...words.values()], problems };
}

import {
  itemOptions,
  normalizeWord,
  type Learning,
  type PassageItem,
  type PassageQuestion,
  type PracticeTask,
  type Question,
  type QuestionKind,
  type Sense,
  type SetContent,
  type VocabularyQuestion,
  type Word,
} from "@lexiro/contract";

/** One choice to make: a prompt, its options and the right one. */
export interface Step {
  /** What to ask, already filled for display. */
  prompt: string;
  options: string[];
  answer: number;
  senseId: string;
  wordId: string;
  /** For a passage: the blank this step fills (1-based), or none for reading. */
  blank?: number;
  explanation?: string;
  whyWrong?: Record<string, string>;
}

/** One card of a round: a word task, a sentence question, or a passage with several steps. */
export type PracticeItem =
  | { kind: "meaning" | "reverse"; word: string; sense: Sense; steps: [Step] }
  | { kind: "vocabulary"; questionId: string; steps: [Step] }
  | { kind: Exclude<QuestionKind, "vocabulary">; questionId: string; title?: string; passage: string; bank?: string[]; steps: Step[] };

export type Focus = "all" | "weak" | "starred";

export interface RoundOptions {
  contents: SetContent[];
  tasks: PracticeTask[];
  amount: number;
  focus: Focus;
  learning: Learning;
  random?: () => number;
}

export function shuffle<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

interface Entry { word: Word; sense: Sense }

/** Every sense the round may practise, in the order it should come up. */
function poolOf(contents: SetContent[], focus: Focus, learning: Learning, random: () => number): Entry[] {
  const entries = contents.flatMap((content) => content.words.filter((word) => focus !== "starred" || word.starred).flatMap((word) => word.senses.map((sense) => ({ word, sense }))));
  const shuffled = shuffle(entries, random);
  if (focus !== "weak") return shuffled;
  // Least familiar first; among equals, the one practised longest ago.
  const rank = (entry: Entry) => learning.senses[entry.sense.id];
  return shuffled.sort((a, b) => (rank(a)?.level ?? -1) - (rank(b)?.level ?? -1) || (rank(a)?.lastDay ?? "").localeCompare(rank(b)?.lastDay ?? ""));
}

/**
 * The options of a word task: the right one and up to three others. Others
 * never repeat it or name another meaning of the same word, and the same part
 * of speech is preferred, so the right answer is never ambiguous.
 */
function wordStep(kind: "meaning" | "reverse", entry: Entry, all: Entry[], random: () => number): Step | null {
  const { word, sense } = entry;
  const norm = normalizeWord(word.word);
  let right: string, candidates: { text: string; samePos: boolean }[];
  if (kind === "meaning") {
    right = sense.meaning;
    const own = new Set(word.senses.map((s) => s.meaning));
    candidates = all.filter((other) => normalizeWord(other.word.word) !== norm && !own.has(other.sense.meaning)).map((other) => ({ text: other.sense.meaning, samePos: other.sense.pos === sense.pos }));
  } else {
    right = word.word;
    // A word that also carries this meaning would be a second right answer.
    const sharing = new Set(all.filter((other) => other.sense.meaning === sense.meaning).map((other) => normalizeWord(other.word.word)));
    candidates = all.filter((other) => !sharing.has(normalizeWord(other.word.word))).map((other) => ({ text: other.word.word, samePos: other.sense.pos === sense.pos }));
  }
  const seen = new Set([right.toLocaleLowerCase()]);
  const pick: string[] = [];
  for (const group of [candidates.filter((c) => c.samePos), candidates.filter((c) => !c.samePos)])
    for (const candidate of shuffle(group, random)) {
      if (pick.length === 3) break;
      const key = candidate.text.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pick.push(candidate.text);
    }
  if (pick.length < 1) return null;
  const options = shuffle([right, ...pick], random);
  return {
    prompt: kind === "meaning" ? word.word : sense.meaning,
    options,
    answer: options.indexOf(right),
    senseId: sense.id,
    wordId: word.id,
    explanation: sense.description,
  };
}

const wordOf = (contents: SetContent[]) => {
  const bySense = new Map<string, string>();
  for (const content of contents) for (const word of content.words) for (const sense of word.senses) bySense.set(sense.id, word.id);
  return bySense;
};

function questionItem(question: Question, wordIds: Map<string, string>): PracticeItem | null {
  if (question.kind === "vocabulary") {
    const q = question as VocabularyQuestion;
    const wordId = wordIds.get(q.senseId);
    if (!wordId) return null;
    return { kind: "vocabulary", questionId: q.id, steps: [{ prompt: q.prompt, options: q.options, answer: q.answer, senseId: q.senseId, wordId, explanation: q.explanation, whyWrong: q.whyWrong }] };
  }
  const q = question as PassageQuestion;
  const steps = q.items.map((item: PassageItem): Step | null => {
    const wordId = wordIds.get(item.senseId);
    return wordId ? { prompt: item.prompt ?? "", options: itemOptions(q, item), answer: item.answer, senseId: item.senseId, wordId, blank: item.blank, explanation: item.explanation, whyWrong: item.whyWrong } : null;
  });
  if (steps.some((step) => !step)) return null;
  return { kind: q.kind, questionId: q.id, title: q.title, passage: q.passage, bank: q.bank, steps: steps as Step[] };
}

/** The tasks the chosen sets can offer: word tasks need four meanings, question kinds need a question. */
export function availableTasks(contents: SetContent[]): PracticeTask[] {
  const words = contents.reduce((sum, content) => sum + content.words.length, 0);
  const kinds = new Set(contents.flatMap((content) => content.questions.map((question) => question.kind)));
  return [
    ...(words >= 2 ? (["meaning", "reverse"] as const) : []),
    ...(["vocabulary", "cloze", "wordBank", "discourse", "reading"] as const).filter((kind) => kinds.has(kind)),
  ];
}

/**
 * A round: `amount` cards drawn from the chosen tasks in turn, so a mix of
 * tasks interleaves instead of coming in blocks. A passage counts as one card.
 */
export function buildRound({ contents, tasks, amount, focus, learning, random = Math.random }: RoundOptions): PracticeItem[] {
  const pool = poolOf(contents, focus, learning, random);
  const all = contents.flatMap((content) => content.words.flatMap((word) => word.senses.map((sense) => ({ word, sense }))));
  const inPool = new Set(pool.map((entry) => entry.sense.id));
  const order = new Map(pool.map((entry, index) => [entry.sense.id, index]));
  const wordIds = wordOf(contents);
  const lanes: PracticeItem[][] = tasks.map((task) => {
    if (task === "meaning" || task === "reverse")
      return pool.flatMap((entry) => {
        const step = wordStep(task, entry, all, random);
        return step ? [{ kind: task, word: entry.word.word, sense: entry.sense, steps: [step] } as PracticeItem] : [];
      });
    const questions = contents.flatMap((content) => content.questions)
      .filter((question) => question.kind === task)
      .filter((question) => ("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).some((id) => inPool.has(id)));
    // Questions follow the pool's order through their first sense, so "weak" reaches them too.
    const first = (question: Question) => Math.min(...("items" in question ? question.items.map((item) => item.senseId) : [question.senseId]).map((id) => order.get(id) ?? Infinity));
    return shuffle(questions, random).sort((a, b) => first(a) - first(b)).flatMap((question) => {
      const item = questionItem(question, wordIds);
      return item ? [item] : [];
    });
  });
  const round: PracticeItem[] = [];
  for (let at = 0; round.length < amount && lanes.some((lane) => at < lane.length); at++)
    for (const lane of lanes) if (at < lane.length && round.length < amount) round.push(lane[at]);
  return round;
}

/** Blanks of a passage as text and blank-number parts, for rendering. */
export function passageParts(passage: string): (string | number)[] {
  return passage.split(/__(\d+)__/).map((part, index) => (index % 2 ? Number(part) : part)).filter((part) => part !== "");
}

/**
 * Dev-only fake account and Worker, for looking at screens without Firebase.
 * On when `NEXT_PUBLIC_MOCK=true` in a dev build; never in production.
 */
import type { LibraryIndex, Prefs, Question, SetContent, SetSummary, Word } from "@lexiro/contract";
import type { Learning } from "@lexiro/contract";

export const mockEnabled = import.meta.env.DEV && import.meta.env.NEXT_PUBLIC_MOCK === "true";

export const mockAccount = { uid: "mock", name: "Tavric", email: "demo@lexiro.local", photo: null };

const now = new Date().toISOString();
const dayOffset = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const RAW: Record<string, { name: string; hue: SetSummary["hue"]; icon: SetSummary["icon"]; folderId: string | null; words: [string, string, string, string][] }> = {
  gsat: {
    name: "學測核心 7000・Level 5", hue: "sky", icon: "graduation-cap", folderId: "f-exam",
    words: [
      ["abundant", "adj.", "豐富的", "The region has abundant natural resources."],
      ["accelerate", "v.", "加速", "The company plans to accelerate production."],
      ["ambiguous", "adj.", "模稜兩可的", "His answer was deliberately ambiguous."],
      ["anticipate", "v.", "預期", "We anticipate a large crowd tonight."],
      ["arbitrary", "adj.", "任意的", "The rules seemed arbitrary to the students."],
      ["coherent", "adj.", "連貫的", "She gave a clear and coherent explanation."],
      ["compensate", "v.", "補償", "Nothing can compensate for the loss."],
      ["consensus", "n.", "共識", "The committee reached a consensus."],
      ["deteriorate", "v.", "惡化", "His health began to deteriorate."],
      ["elaborate", "adj.", "精心的", "They made elaborate plans for the trip."],
      ["inevitable", "adj.", "不可避免的", "Change is inevitable."],
      ["meticulous", "adj.", "一絲不苟的", "He is meticulous about his work."],
    ],
  },
  toeic: {
    name: "多益商務字彙", hue: "amber", icon: "briefcase", folderId: "f-exam",
    words: [
      ["invoice", "n.", "發票", "Please send the invoice by Friday."],
      ["negotiate", "v.", "協商", "We need to negotiate a better price."],
      ["quarterly", "adj.", "每季的", "The quarterly report is due next week."],
      ["reimburse", "v.", "核銷；償還", "The company will reimburse travel costs."],
      ["tentative", "adj.", "暫定的", "We have a tentative agreement."],
      ["warehouse", "n.", "倉庫", "The goods are stored in a warehouse."],
    ],
  },
  travel: {
    name: "旅行會話", hue: "mint", icon: "airplane-tilt", folderId: null,
    words: [
      ["itinerary", "n.", "行程", "Here is the itinerary for our trip."],
      ["layover", "n.", "轉機停留", "We had a three-hour layover in Tokyo."],
      ["souvenir", "n.", "紀念品", "I bought a souvenir for my sister."],
      ["customs", "n.", "海關", "We went through customs quickly."],
    ],
  },
  news: {
    name: "外電新聞選字", hue: "violet", icon: "newspaper", folderId: null,
    words: [
      ["sanction", "n.", "制裁", "The country faces new sanctions."],
      ["ceasefire", "n.", "停火", "Both sides agreed to a ceasefire."],
      ["inflation", "n.", "通貨膨脹", "Inflation rose to 3 percent."],
    ],
  },
};

const contents: Record<string, SetContent> = {};
for (const [setId, raw] of Object.entries(RAW)) {
  const words: Word[] = raw.words.map(([word, pos, meaning, example], i) => ({
    id: `${setId}-w${i}`, setId, word, starred: i % 4 === 1, updatedAt: now,
    senses: [{ id: `${setId}-s${i}`, pos, meaning, examples: [example], supplementary: false } as Word["senses"][number]],
  }));
  const questions: Question[] = words.slice(0, 4).map((w, i) => ({
    id: `${setId}-q${i}`, setId, kind: "vocabulary", difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    prompt: w.senses[0]!.examples[0]!.replace(new RegExp(w.word, "i"), "_____"),
    options: [w.word, ...words.filter((o) => o.id !== w.id).slice(0, 3).map((o) => o.word)],
    answer: 0, senseId: w.senses[0]!.id, explanation: undefined, createdAt: now, updatedAt: now,
  }));
  contents[setId] = {
    set: { id: setId, name: raw.name, folderId: raw.folderId, hue: raw.hue, icon: raw.icon, order: null, createdAt: now, updatedAt: now, wordCount: words.length, questionCount: questions.length },
    words: words.sort((a, b) => a.word.localeCompare(b.word)),
    questions,
  };
}

const library: LibraryIndex = {
  revision: 1,
  folders: [{ id: "f-exam", name: "考試", parentId: null, order: 0, updatedAt: now }],
  sets: Object.values(contents).map((c) => c.set),
};

const learning: Learning = { goal: 20, days: {}, senses: {}, tasks: {} };
const daily = [18, 22, 0, 25, 14, 30, 21, 9, 26, 20, 17, 0, 23, 12];
daily.forEach((answered, n) => {
  if (answered) learning.days[dayOffset(n)] = { answered, correct: Math.round(answered * 0.78) };
});
let k = 0;
for (const c of Object.values(contents)) {
  for (const w of c.words) {
    const answered = 2 + (k % 6);
    learning.senses[w.senses[0]!.id] = { wordId: w.id, answered, correct: Math.max(0, answered - (k % 3)), level: (k % 4) as 0 | 1 | 2 | 3, lastDay: dayOffset(k % 5) };
    k++;
  }
}
learning.tasks = { meaning: { answered: 120, correct: 101 }, reverse: { answered: 64, correct: 47 }, vocabulary: { answered: 48, correct: 35 }, cloze: { answered: 20, correct: 13 } };

let prefs: Prefs = { practiceSize: 20, showMeanings: true, theme: "light" };

/** Answers what the Worker would; writes are accepted and mostly ignored. */
export async function mockApi(path: string, init: { method?: string; json?: unknown }): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120));
  const method = init.method ?? "GET";
  const set = path.match(/^\/sets\/([^/]+)$/);
  if (method === "GET") {
    if (path === "/library") return library;
    if (path === "/learning") return learning;
    if (path === "/prefs") return prefs;
    if (path === "/revision") return { revision: library.revision };
    if (path === "/admin/status") return { admin: false };
    if (set && contents[decodeURIComponent(set[1]!)]) return contents[decodeURIComponent(set[1]!)];
    if (path.endsWith("/share")) return { id: null };
  }
  if (path === "/prefs" && method === "PUT") return (prefs = { ...prefs, ...(init.json as Partial<Prefs>) });
  if (path.endsWith("/questions") && method === "POST") return { saved: [], failed: [], warnings: [] };
  if (path.endsWith("/words") && method === "POST") return { words: [], removedQuestionIds: [] };
  return {};
}

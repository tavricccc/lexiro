import { blankToken } from "@/src/lib/question-formats";
import { createSetSharePayload } from "@/src/lib/set-share";
/** Imported only behind import.meta.env.DEV. Never touches a real account. */
import type { User } from "firebase/auth";
import { useLibraryStore } from "@/stores/library-store";
import { useCloudStore } from "@/stores/cloud-store";
import { useLearningStore } from "@/stores/learning-store";
import { buildSenseId, buildSetWordKey } from "@/src/lib/library";
import { createUncategorizedFolder } from "@/src/lib/folders";
import {
  emptyLibraryState,
  getLibraryRepository,
} from "@/src/lib/library-repository";
import { setStorageNamespace } from "@/src/lib/persist";
import {
  calendarDay,
  emptyLearningRecord,
  recordAnswer,
  shiftDay,
} from "@/src/lib/learning-record";
import type { LibraryQuestion, LibraryState, PassageFormat } from "@/types";
import type { RoomState } from "@/lib/room-client";

const vocabulary = [
  ["abandon", "v.", "拋棄；放棄"],
  ["ambiguous", "adj.", "模稜兩可的"],
  ["benevolent", "adj.", "仁慈的；樂善好施的"],
  ["candid", "adj.", "坦率的"],
  ["deteriorate", "v.", "惡化"],
  ["eloquent", "adj.", "口才好的；有說服力的"],
  ["feasible", "adj.", "可行的"],
  ["gratitude", "n.", "感激"],
  ["hinder", "v.", "阻礙"],
  ["inevitable", "adj.", "不可避免的"],
  ["jeopardize", "v.", "危及"],
  ["meticulous", "adj.", "一絲不苟的"],
  ["notorious", "adj.", "惡名昭彰的"],
  ["obsolete", "adj.", "過時的"],
  ["resilient", "adj.", "有韌性的；能迅速恢復的"],
  ["ubiquitous", "adj.", "無所不在的"],
];
const collectionWords: Record<string, string[][]> = {
  toeic: [
    ["acquisition", "n.", "收購"],
    ["agenda", "n.", "議程"],
    ["budget", "n.", "預算"],
    ["contract", "n.", "合約"],
    ["deadline", "n.", "截止期限"],
    ["invoice", "n.", "發票"],
    ["negotiate", "v.", "協商"],
    ["revenue", "n.", "營收"],
    ["stakeholder", "n.", "利害關係人"],
    ["warehouse", "n.", "倉庫"],
  ],
  travel: [
    ["accommodation", "n.", "住宿"],
    ["arrival", "n.", "抵達"],
    ["customs", "n.", "海關"],
    ["departure", "n.", "出發"],
    ["destination", "n.", "目的地"],
    ["itinerary", "n.", "行程"],
    ["luggage", "n.", "行李"],
    ["reservation", "n.", "預約"],
    ["souvenir", "n.", "紀念品"],
    ["wander", "v.", "漫遊"],
  ],
  news: [
    ["biodiversity", "n.", "生物多樣性"],
    ["diplomacy", "n.", "外交"],
    ["emission", "n.", "排放"],
    ["inflation", "n.", "通貨膨脹"],
    ["policy", "n.", "政策"],
    ["regulation", "n.", "法規"],
    ["renewable", "adj.", "可再生的"],
    ["sustainable", "adj.", "永續的"],
    ["transition", "n.", "轉型"],
    ["urban", "adj.", "都市的"],
  ],
};
const timestamp = "2026-11-01T08:00:00.000Z";
export function demoLibrary(): LibraryState {
  const state = emptyLibraryState();
  state.folders = [
    createUncategorizedFolder(),
    {
      id: "gsat-folder",
      name: "學測",
      order: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "toeic-folder",
      name: "多益",
      order: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  state.sets = [
    {
      id: "gsat",
      setName: "學測核心 7000",
      hue: "mint",
      icon: "graduation-cap",
      folderId: "gsat-folder",
      createdAt: "2026-03-02T08:00:00Z",
      updatedAt: timestamp,
    },
    {
      id: "toeic",
      setName: "TOEIC Business",
      hue: "sky",
      icon: "briefcase",
      folderId: "toeic-folder",
      createdAt: "2026-06-18T08:00:00Z",
      updatedAt: timestamp,
    },
    {
      id: "read",
      setName: "閱讀測驗錯題",
      hue: "rose",
      icon: "bookmark-simple",
      folderId: "gsat-folder",
      createdAt: "2026-09-27T08:00:00Z",
      updatedAt: timestamp,
    },
    {
      id: "travel",
      setName: "旅行前要記的字",
      hue: "amber",
      icon: "airplane-tilt",
      folderId: "__uncategorized__",
      createdAt: "2026-10-05T08:00:00Z",
      updatedAt: timestamp,
    },
    {
      id: "news",
      setName: "The Economist 筆記",
      hue: "violet",
      icon: "newspaper",
      folderId: "__uncategorized__",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  for (const set of state.sets) {
    state.memberships[set.id] = [];
    for (const [word, pos, meaningZh] of collectionWords[set.id] ??
      vocabulary) {
      const wordKey = buildSetWordKey(set.id, word);
      const id = buildSenseId(wordKey, pos, meaningZh);
      state.words[wordKey] = {
        wordKey,
        word,
        senses: [
          {
            id,
            pos,
            meaningZh,
            supplementary: false,
            description:
              word === "resilient"
                ? "形容人在挫折後很快站起來\n常搭配 remain、prove、be resilient to"
                : "",
            examples: [
              word === "resilient"
                ? "Children are often more resilient than adults expect."
                : `We discussed the word ${word} in class.`,
            ],
          },
        ],
        updatedAt: timestamp,
      };
      state.memberships[set.id].push({ wordKey, senseIds: [id] });
    }
  }
  const wordKey = buildSetWordKey("gsat", "ambiguous");
  const senseId = state.words[wordKey].senses[0].id;
  state.questions.push({
    id: "vocab-1",
    fingerprint: "demo-vocab-1",
    kind: "multipleChoice",
    questionStyle: "vocabulary",
    wordKey,
    senseId,
    difficulty: 2,
    prompt:
      "The new policy was so _____ that even the experts disagreed on what it meant.",
    options: ["feasible", "ambiguous", "candid", "obsolete"],
    answerIndex: 1,
    explanation: "ambiguous 表示模稜兩可，對應 experts disagreed。",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  for (const format of [
    "reading",
    "cloze",
    "wordBank",
    "discourse",
  ] as PassageFormat[]) {
    state.questions.push({
      id: `${format}-1`,
      fingerprint: `demo-${format}`,
      kind: "reading",
      format,
      title: "The quiet power of attention",
      passage:
        format === "reading"
          ? "Smartphones have become ubiquitous in modern life. Researchers found that students who kept their phones in another room performed better on memory tasks. Even a silent phone can distract us. Creating a phone-free study space may help us focus on what matters."
          : `Smartphones have become so ${blankToken(0)} that it is hard to imagine daily life without them. Yet constant notifications may ${blankToken(1)} our ability to focus. Students who kept their phones in another room performed better on memory tasks.`,
      wordKeys: [wordKey],
      difficulty: 2,
      ...(format === "wordBank" || format === "discourse"
        ? {
            optionBank:
              format === "discourse"
                ? [
                    "They are now part of daily life.",
                    "They can interrupt our concentration.",
                    "The study lasted a year.",
                    "Nobody owned a phone.",
                    "A quiet room is a useful place to begin.",
                  ]
                : [
                    "ubiquitous",
                    "hinder",
                    "feasible",
                    "obsolete",
                    "candid",
                    "resilient",
                    "ambiguous",
                    "benevolent",
                    "eloquent",
                    "meticulous",
                  ],
          }
        : {}),
      questions: [0, 1].map((i) => ({
        id: `${format}-child-${i}`,
        kind: "multipleChoice" as const,
        ...(format === "reading" ? {} : { blank: i + 1 }),
        wordKey,
        senseId,
        prompt:
          format === "reading"
            ? i === 0
              ? "What did the study find?"
              : "What is the best title for this passage?"
            : `第 ${i + 1} 格`,
        options:
          format === "reading"
            ? [
                "Phones improve memory.",
                "A phone-free space can improve focus.",
                "Silent phones never distract us.",
                "Students should avoid studying.",
              ]
            : format === "discourse"
              ? [
                  "They are now part of daily life.",
                  "They can interrupt our concentration.",
                  "The study lasted a year.",
                  "Nobody owned a phone.",
                  "A quiet room is a useful place to begin.",
                ]
              : format === "cloze"
                ? ["ubiquitous", "hinder", "feasible", "obsolete"]
                : [
                    "ubiquitous",
                    "hinder",
                    "feasible",
                    "obsolete",
                    "candid",
                    "resilient",
                    "ambiguous",
                    "benevolent",
                    "eloquent",
                    "meticulous",
                  ],
        answerIndex: format === "reading" ? 1 : i,
        explanation:
          format === "reading"
            ? "把手機放在另一個房間的學生，在記憶作業中表現較好。"
            : i === 0
              ? "ubiquitous 表示無所不在，呼應日常生活離不開手機。"
              : "hinder 表示阻礙，對應通知干擾專注力。",
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    } as LibraryQuestion);
  }
  for (const question of state.questions) {
    if (question.kind !== "reading") continue;
    question.questions.forEach((child, i) => {
      child.wordKey = buildSetWordKey(
        "gsat",
        i === 0 ? "ubiquitous" : "hinder",
      );
      child.senseId = state.words[child.wordKey].senses[0].id;
    });
    question.wordKeys = question.questions.map((child) => child.wordKey);
  }
  return state;
}
const fakeUser = {
  uid: "demo-user",
  displayName: "Tavric",
  email: "tavric@example.com",
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  providerData: [],
  getIdToken: async () => "demo-token",
} as unknown as User;
export async function initializeDemo(): Promise<boolean> {
  const query = new URLSearchParams(location.search);
  if (query.get("demo") === "0") {
    sessionStorage.removeItem("lexiro:demo");
    return false;
  }
  if (query.get("demo") === "1") sessionStorage.setItem("lexiro:demo", "1");
  if (sessionStorage.getItem("lexiro:demo") !== "1") return false;
  setStorageNamespace("lexiro-product-demo");
  const repository = getLibraryRepository();
  let state = await repository.loadState();
  if (!state.sets.length || query.get("reset") === "1") {
    state = demoLibrary();
    await repository.commit(state);
  }
  if (query.get("empty") === "1") state = emptyLibraryState();
  if (query.get("emptySet") === "1") {
    state.memberships.gsat = [];
    state.questions = [];
  }
  useLibraryStore.setState({
    state,
    status: "ready",
    error: null,
    hydrate: async () => undefined,
  });
  useCloudStore.setState({
    user: fakeUser,
    ready: true,
    configured: true,
    status: "synced",
    error: "",
    pending: 0,
    initialize: async () => undefined,
    sync: async () => undefined,
    signIn: async () => {
      useCloudStore.setState({ user: fakeUser });
    },
    signOut: async () => {
      useCloudStore.setState({ user: null });
    },
    deleteAccount: async () => {
      useLibraryStore.setState({ state: emptyLibraryState() });
      useCloudStore.setState({ user: null });
    },
  });
  useLearningStore.getState().hydrate();
  if (
    !Object.keys(useLearningStore.getState().record.days).length ||
    query.get("reset") === "1"
  ) {
    let record = emptyLearningRecord();
    const today = calendarDay(new Date());
    const words = Object.values(state.words);
    for (let d = 83; d >= 0; d--) {
      if (d > 7 && d % 5 === 0) continue;
      for (let i = 0; i < (d === 0 ? 12 : 12 + (d % 19)); i++) {
        const word = words[(i * 7 + d * 3) % words.length];
        if (!word) continue;
        record = recordAnswer(record, {
          day: shiftDay(today, -d),
          senseId: word.senses[0].id,
          wordKey: word.wordKey,
          kind: [
            "meaning",
            "vocabulary",
            "cloze",
            "wordBank",
            "discourse",
            "reading",
          ][i % 6],
          correct: (i + d) % 5 !== 0,
        });
      }
    }
    localStorage.setItem(
      "lexiro-product-demo:lexiro:learning-record:v1",
      JSON.stringify(record),
    );
    useLearningStore.getState().hydrate();
  }
  if (!localStorage.getItem("lexiro-product-demo:lexiro:room-history:v1"))
    localStorage.setItem(
      "lexiro-product-demo:lexiro:room-history:v1",
      JSON.stringify(
        ["學測核心 7000", "TOEIC Business", "閱讀測驗錯題"].map((title, i) => ({
          code: ["ABCD23", "EFGH45", "JKLM67"][i],
          title,
          rank: i === 1 ? 2 : 1,
          players: 4 - i,
          finishedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        })),
      ),
    );
  return true;
}
let connections = [
  {
    id: "chatgpt",
    clientId: "chatgpt",
    clientName: "ChatGPT",
    createdAt: Date.now() - 86400000,
  },
  {
    id: "codex",
    clientId: "codex",
    clientName: "Codex",
    createdAt: Date.now() - 3600000,
  },
];
export async function demoRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  let result: unknown = {};
  if (path === "/connections") result = { connections };
  else if (path.startsWith("/connections/") && init.method === "DELETE") {
    connections = connections.filter((c) => c.id !== path.split("/").at(-1));
  } else if (path === "/admin/status") result = { admin: true };
  else if (path.startsWith("/admin/search"))
    result = {
      accounts: [
        {
          uid: "demo-other",
          name: "佳穎",
          email: "jiaying@example.com",
          writesToday: 34,
          readsToday: 56,
          storedBytes: 320000,
          disabled: false,
        },
      ],
    };
  else if (path.startsWith("/admin"))
    result = {
      day: calendarDay(new Date()),
      accounts: 128,
      activeToday: 42,
      writesToday: 680,
      readsToday: 1924,
      storedBytes: 18000000,
      agentPaused: false,
      disabled: [],
      top: [
        {
          uid: "demo-user",
          name: "Tavric",
          email: "tavric@example.com",
          writesToday: 76,
          readsToday: 124,
          storedBytes: 560000,
          disabled: false,
        },
      ],
    };
  else if (path.startsWith("/oauth/request/"))
    result = {
      clientName: "Codex",
      redirectHost: "chatgpt.com",
      scopes: ["library:read", "library:write"],
    };
  else if (path.startsWith("/oauth/approve/"))
    result = { redirectTo: "/app/me/agents?demo=1" };
  else if (path === "/rooms") result = { code: "K7M2QX" };
  else if (path === "/shares" && !init.method)
    result = { shares: [{ id: "demo-share", setId: "gsat" }] };
  else if (path === "/shares") result = { id: "demo-share", setId: "gsat" };
  else if (path.startsWith("/shares/")) {
    const set = createSetSharePayload(useLibraryStore.getState().state, "gsat")
      .sets[0];
    result = {
      id: "demo-share",
      own: false,
      snapshot: {
        set: {
          id: set.id,
          setName: set.setName,
          folderId: set.folderId,
          createdAt: set.createdAt,
          updatedAt: set.updatedAt,
        },
        memberships: set.memberships,
        words: set.words,
        questions: set.questions,
      },
    };
  }
  return result as T;
}
export function demoRoom(code: string): RoomState {
  const state = new URLSearchParams(location.search).get("state");
  const phase =
    state === "game" ? "question" : state === "finished" ? "ended" : "lobby";
  const question = {
    type: "vocabulary" as const,
    prompt:
      "The new policy was so _____ that even the experts disagreed on what it meant.",
    options: ["feasible", "ambiguous", "candid", "obsolete"],
  };
  return {
    type: "state",
    serverNow: Date.now(),
    code,
    title: "學測核心 7000",
    hostUid: "demo-user",
    you: "demo-user",
    phase,
    index: phase === "lobby" ? 0 : 6,
    total: 15,
    endsAt: phase === "question" ? Date.now() + 20000 : null,
    duration: 20000,
    players: ["Tavric", "佳穎", "Kevin", "小安"].map((name, i) => ({
      uid: i ? `player-${i}` : "demo-user",
      name,
      score: [2840, 2610, 2280, 1930][i],
      connected: true,
      answered: i !== 2,
    })),
    question: phase === "question" ? question : null,
    yourChoice: null,
    revealedBlanks: {},
    reveal: null,
    review:
      phase === "ended"
        ? {
            passages: {},
            items: [
              {
                index: 6,
                question: { ...question, passageId: null },
                choice: 0,
                accepted: [1],
                explanation: "ambiguous 表示模稜兩可。",
              },
            ],
          }
        : null,
  };
}

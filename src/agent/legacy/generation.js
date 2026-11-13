// Frozen bundle of the legacy question-generation pipeline (lexiro packages/agent-contract,
// built from lexiro commit 0dbdf809). Do not edit; see src/agent/generation.ts.
// packages/agent-contract/src/generation.ts
import { z as z3 } from "zod";

// src/lib/source-ref.ts
function createSourceRef(index3, childIndex) {
  const sourceRef2 = `source-${index3 + 1}`;
  return childIndex === void 0 ? sourceRef2 : `${sourceRef2}-${childIndex + 1}`;
}

// src/lib/schema.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var lenientReads = 0;
function assertKnownKeys(value, allowed, field) {
  if (lenientReads) return;
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new Error(`${field} \u5305\u542B\u4E0D\u652F\u63F4\u6B04\u4F4D\uFF1A${unknown.join("\u3001")}`);
}
function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`\u7F3A\u5C11 ${field}`);
  return value.trim();
}

// packages/ai-contract/src/words.ts
var PART_OF_SPEECH_ALIASES = {
  n: "n.",
  "n.": "n.",
  noun: "n.",
  v: "v.",
  "v.": "v.",
  verb: "v.",
  adj: "adj.",
  "adj.": "adj.",
  adjective: "adj.",
  adv: "adv.",
  "adv.": "adv.",
  adverb: "adv.",
  pron: "pron.",
  "pron.": "pron.",
  pronoun: "pron.",
  prep: "prep.",
  "prep.": "prep.",
  preposition: "prep.",
  conj: "conj.",
  "conj.": "conj.",
  conjunction: "conj.",
  interj: "interj.",
  "interj.": "interj.",
  interjection: "interj.",
  det: "det.",
  "det.": "det.",
  determiner: "det.",
  aux: "aux.",
  "aux.": "aux.",
  auxiliary: "aux.",
  "modal v": "modal v.",
  "modal v.": "modal v.",
  "modal verb": "modal v.",
  "phr v": "phr. v.",
  "phr. v.": "phr. v.",
  "phrasal verb": "phr. v.",
  phr: "phr.",
  "phr.": "phr.",
  phrase: "phr."
};
var SUPPORTED_PARTS_OF_SPEECH = [
  ...new Set(Object.values(PART_OF_SPEECH_ALIASES))
];
function normalizePartOfSpeech(pos) {
  const normalized2 = pos.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return PART_OF_SPEECH_ALIASES[normalized2] ?? "";
}

// packages/ai-contract/src/formats.ts
var PASSAGE_FORMATS = {
  reading: {
    format: "reading",
    blanks: 0,
    optionCount: 4,
    sharedBank: false,
    sentenceOptions: false
  },
  cloze: {
    format: "cloze",
    blanks: 5,
    optionCount: 4,
    sharedBank: false,
    sentenceOptions: false
  },
  wordBank: {
    format: "wordBank",
    blanks: 10,
    optionCount: 10,
    sharedBank: true,
    sentenceOptions: false
  },
  discourse: {
    format: "discourse",
    blanks: 4,
    optionCount: 5,
    sharedBank: true,
    sentenceOptions: true
  }
};
var PASSAGE_KINDS = [
  "cloze",
  "wordBank",
  "discourse",
  "reading"
];
function isPassageKind(kind) {
  return PASSAGE_KINDS.includes(kind);
}
function blankToken(index3) {
  return `__${index3 + 1}__`;
}
var BLANK_TOKEN_PATTERN = /__(\d+)__/g;
function countBlankTokens(passage) {
  return [...passage.matchAll(BLANK_TOKEN_PATTERN)].length;
}
function blankTokenNumbers(passage) {
  return [...passage.matchAll(BLANK_TOKEN_PATTERN)].map(
    (match2) => Number(match2[1])
  );
}

// packages/ai-contract/src/question-quality.ts
var QUESTION_LENGTHS = {
  vocabulary: {
    1: { min: 18, max: 32 },
    2: { min: 24, max: 40 },
    3: { min: 28, max: 48 }
  },
  cloze: {
    1: { min: 180, max: 220 },
    2: { min: 200, max: 260 },
    3: { min: 230, max: 300 }
  },
  wordBank: {
    1: { min: 200, max: 260 },
    2: { min: 240, max: 320 },
    3: { min: 280, max: 360 }
  },
  discourse: {
    1: { min: 220, max: 280 },
    2: { min: 260, max: 340 },
    3: { min: 300, max: 400 }
  },
  reading: {
    1: { min: 180, max: 240 },
    2: { min: 240, max: 320 },
    3: { min: 300, max: 400 }
  }
};
function questionLengthRange(kind, difficulty) {
  return QUESTION_LENGTHS[kind][difficulty];
}
function countEnglishWords(value) {
  return (value.replace(/__\d+__|_____/g, "").match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) ?? []).length;
}

// packages/ai-contract/src/index.ts
var AI_MODELS = ["gpt-5.6-luna", "gpt-6-luna"];
var PRO_AI_MODEL = "gpt-6.1-sol";
var LONG_CONTEXT_MODELS = [...AI_MODELS, PRO_AI_MODEL];
var QUESTION_KINDS = [
  "vocabulary",
  "cloze",
  "wordBank",
  "discourse",
  "reading"
];

// src/lib/question-builders.ts
function seededOrder(length2, seed) {
  let state = 2166136261;
  for (let index3 = 0; index3 < seed.length; index3 += 1) {
    state ^= seed.charCodeAt(index3);
    state = Math.imul(state, 16777619);
  }
  const next = () => {
    state = Math.imul(state ^ state >>> 15, state | 1);
    state ^= state + Math.imul(state ^ state >>> 7, state | 61);
    return ((state ^ state >>> 14) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: length2 }, (_, index3) => index3);
  for (let index3 = order.length - 1; index3 > 0; index3 -= 1) {
    const swap2 = Math.floor(next() * (index3 + 1));
    [order[index3], order[swap2]] = [order[swap2], order[index3]];
  }
  return order;
}
function placeAnswer(answer, distractors, seed) {
  const pool = [answer, ...distractors];
  const order = seededOrder(pool.length, seed);
  const options = order.map((index3) => pool[index3]);
  return { answerIndex: order.indexOf(0), options };
}

// src/lib/validation.ts
function containsHan(value) {
  return /[\u3400-\u9FFF]/u.test(value);
}

// src/lib/question-teaching.ts
import { z } from "zod";
var agentTeaching = z.object({
  explanation: z.string().optional(),
  whyWrong: z.union([
    z.array(z.object({ option: z.string(), reason: z.string() })),
    z.record(z.string(), z.string())
  ]).optional()
});
function assembleAgentTeaching(item) {
  const parsed = agentTeaching.parse(item);
  return {
    ...parsed.explanation !== void 0 ? { explanation: parsed.explanation } : {},
    ...parsed.whyWrong !== void 0 ? {
      whyWrong: Array.isArray(parsed.whyWrong) ? Object.fromEntries(
        parsed.whyWrong.map(({ option, reason: reason2 }) => [option, reason2])
      ) : parsed.whyWrong
    } : {}
  };
}
function optionTeachingIssue(item, distractors) {
  if (typeof item.explanation !== "string" || !item.explanation.trim())
    return "\u7F3A\u5C11\u4F5C\u7B54\u89E3\u8AAA";
  if (!containsHan(item.explanation)) return "\u4F5C\u7B54\u89E3\u8AAA\u5FC5\u9808\u4EE5\u4E2D\u6587\u8AAA\u660E";
  if (!Array.isArray(item.whyWrong) || item.whyWrong.length !== distractors.length)
    return `\u5FC5\u9808\u9010\u4E00\u8AAA\u660E ${distractors.length} \u500B\u5E72\u64FE\u9078\u9805\u70BA\u4F55\u4E0D\u6210\u7ACB`;
  const expected = new Set(distractors);
  const explained = /* @__PURE__ */ new Set();
  for (const reason2 of item.whyWrong) {
    if (!isRecord(reason2) || typeof reason2.option !== "string" || typeof reason2.reason !== "string" || !reason2.reason.trim())
      return "\u932F\u9805\u89E3\u8AAA\u5FC5\u9808\u5305\u542B\u5BE6\u969B\u9078\u9805 option \u8207\u7406\u7531 reason";
    const option = reason2.option.trim();
    if (!containsHan(reason2.reason))
      return `\u932F\u9805\u300C${option}\u300D\u5FC5\u9808\u4EE5\u4E2D\u6587\u8AAA\u660E\u7406\u7531`;
    if (!expected.has(option))
      return `\u932F\u9805\u89E3\u8AAA\u5F15\u7528\u4E86\u4E0D\u5C6C\u65BC\u672C\u984C\u5E72\u64FE\u9078\u9805\u7684\u300C${option}\u300D`;
    if (explained.has(option)) return `\u932F\u9805\u300C${option}\u300D\u7684\u89E3\u8AAA\u91CD\u8907`;
    explained.add(option);
  }
  return null;
}
function assembleSharedBankTeaching(item, value, kind, answer, answers) {
  const explanation = typeof item.explanation === "string" && item.explanation.trim() ? { explanation: item.explanation.trim() } : {};
  if (kind === "wordBank") {
    if (!Array.isArray(value.optionMeanings)) return explanation;
    const meanings = value.optionMeanings.filter(isRecord).flatMap(
      (entry) => typeof entry.option === "string" && typeof entry.meaning === "string" && entry.option.trim() !== answer && entry.meaning.trim() ? [[entry.option.trim(), entry.meaning.trim()]] : []
    );
    return { ...explanation, whyWrong: Object.fromEntries(meanings) };
  }
  const unused = value.options.map((option) => option.trim()).filter((option) => !answers.includes(option));
  if (typeof value.unusedReason !== "string" || !value.unusedReason.trim() || !unused.length)
    return explanation;
  const reason2 = value.unusedReason.trim();
  return {
    ...explanation,
    whyWrong: Object.fromEntries(unused.map((option) => [option, reason2]))
  };
}
function assembleOptionTeaching(item, distractors) {
  if (!item || item.explanation === void 0 && item.whyWrong === void 0)
    return {};
  const issue = optionTeachingIssue(item, distractors);
  if (issue) throw new Error(issue);
  return {
    explanation: item.explanation.trim(),
    whyWrong: Object.fromEntries(
      item.whyWrong.map(
        ({ option, reason: reason2 }) => [option.trim(), reason2.trim()]
      )
    )
  };
}

// node_modules/compromise/src/API/world.js
var methods = {
  one: {},
  two: {},
  three: {},
  four: {}
};
var model = {
  one: {},
  two: {},
  three: {}
};
var compute = {};
var hooks = [];
var world_default = { methods, model, compute, hooks };

// node_modules/compromise/src/API/methods/compute.js
var fns = {
  /** add metadata to term objects */
  compute: function(input) {
    const { world: world2 } = this;
    const compute4 = world2.compute;
    if (typeof input === "string" && Object.hasOwn(compute4, input)) {
      compute4[input](this);
    } else if (Array.isArray(input)) {
      input.forEach((name) => {
        if (Object.hasOwn(world2.compute, name)) {
          compute4[name](this);
        } else {
          console.warn("no compute:", input);
        }
      });
    } else if (typeof input === "function") {
      input(this);
    } else {
      console.warn("no compute:", input);
    }
    return this;
  }
};
var compute_default = fns;

// node_modules/compromise/src/API/methods/loops.js
var forEach = function(cb) {
  const ptrs = this.fullPointer;
  ptrs.forEach((ptr, i3) => {
    const view = this.update([ptr]);
    cb(view, i3);
  });
  return this;
};
var map = function(cb, empty2) {
  const ptrs = this.fullPointer;
  const res = ptrs.map((ptr, i3) => {
    const view = this.update([ptr]);
    const out2 = cb(view, i3);
    if (out2 === void 0) {
      return this.none();
    }
    return out2;
  });
  if (res.length === 0) {
    return empty2 || this.update([]);
  }
  if (res[0] !== void 0) {
    if (typeof res[0] === "string") {
      return res;
    }
    if (typeof res[0] === "object" && (res[0] === null || !res[0].isView)) {
      return res;
    }
  }
  let all4 = [];
  res.forEach((ptr) => {
    all4 = all4.concat(ptr.fullPointer);
  });
  return this.toView(all4);
};
var filter = function(cb) {
  let ptrs = this.fullPointer;
  ptrs = ptrs.filter((ptr, i3) => {
    const view = this.update([ptr]);
    return cb(view, i3);
  });
  const res = this.update(ptrs);
  return res;
};
var find = function(cb) {
  const ptrs = this.fullPointer;
  const found = ptrs.find((ptr, i3) => {
    const view = this.update([ptr]);
    return cb(view, i3);
  });
  return this.update([found]);
};
var some = function(cb) {
  const ptrs = this.fullPointer;
  return ptrs.some((ptr, i3) => {
    const view = this.update([ptr]);
    return cb(view, i3);
  });
};
var random = function(n3 = 1) {
  let ptrs = this.fullPointer;
  let r2 = Math.floor(Math.random() * ptrs.length);
  if (r2 + n3 > this.length) {
    r2 = this.length - n3;
    r2 = r2 < 0 ? 0 : r2;
  }
  ptrs = ptrs.slice(r2, r2 + n3);
  return this.update(ptrs);
};
var loops_default = { forEach, map, filter, find, some, random };

// node_modules/compromise/src/API/methods/utils.js
var utils = {
  /** */
  termList: function() {
    return this.methods.one.termList(this.docs);
  },
  /** return individual terms*/
  terms: function(n3) {
    const m3 = this.match(".");
    return typeof n3 === "number" ? m3.eq(n3) : m3;
  },
  /** */
  groups: function(group) {
    if (group || group === 0) {
      return this.update(this._groups[group] || []);
    }
    const res = {};
    Object.keys(this._groups).forEach((k2) => {
      res[k2] = this.update(this._groups[k2]);
    });
    return res;
  },
  /** */
  eq: function(n3) {
    let ptr = this.pointer;
    if (!ptr) {
      ptr = this.docs.map((_doc, i3) => [i3]);
    }
    if (ptr[n3]) {
      return this.update([ptr[n3]]);
    }
    return this.none();
  },
  /** */
  first: function() {
    return this.eq(0);
  },
  /** */
  last: function() {
    const n3 = this.fullPointer.length - 1;
    return this.eq(n3);
  },
  /** grab term[0] for every match */
  firstTerms: function() {
    return this.match("^.");
  },
  /** grab the last term for every match  */
  lastTerms: function() {
    return this.match(".$");
  },
  /** */
  slice: function(min2, max3) {
    let pntrs = this.pointer || this.docs.map((_o, n3) => [n3]);
    pntrs = pntrs.slice(min2, max3);
    return this.update(pntrs);
  },
  /** return a view of the entire document */
  all: function() {
    return this.update().toView();
  },
  /**  */
  fullSentences: function() {
    const ptrs = this.fullPointer.map((a2) => [a2[0]]);
    return this.update(ptrs).toView();
  },
  /** return a view of no parts of the document */
  none: function() {
    return this.update([]);
  },
  /** are these two views looking at the same words? */
  isDoc: function(b) {
    if (!b || !b.isView) {
      return false;
    }
    const aPtr = this.fullPointer;
    const bPtr = b.fullPointer;
    if (!aPtr.length === bPtr.length) {
      return false;
    }
    return aPtr.every((ptr, i3) => {
      if (!bPtr[i3]) {
        return false;
      }
      return ptr[0] === bPtr[i3][0] && ptr[1] === bPtr[i3][1] && ptr[2] === bPtr[i3][2];
    });
  },
  /** how many seperate terms does the document have? */
  wordCount: function() {
    return this.docs.reduce((count, terms) => {
      count += terms.filter((t3) => t3.text !== "").length;
      return count;
    }, 0);
  },
  // is the pointer the full sentence?
  isFull: function() {
    const ptrs = this.pointer;
    if (!ptrs) {
      return true;
    }
    if (ptrs.length === 0 || ptrs[0][0] !== 0) {
      return false;
    }
    let wantTerms = 0;
    let haveTerms = 0;
    this.document.forEach((terms) => wantTerms += terms.length);
    this.docs.forEach((terms) => haveTerms += terms.length);
    return wantTerms === haveTerms;
  },
  // return the nth elem of a doc
  getNth: function(n3) {
    if (typeof n3 === "number") {
      return this.eq(n3);
    } else if (typeof n3 === "string") {
      return this.if(n3);
    }
    return this;
  }
};
utils.group = utils.groups;
utils.fullSentence = utils.fullSentences;
utils.sentence = utils.fullSentences;
utils.lastTerm = utils.lastTerms;
utils.firstTerm = utils.firstTerms;
var utils_default = utils;

// node_modules/compromise/src/API/methods/index.js
var methods2 = { ...utils_default, ...compute_default, ...loops_default };
methods2.get = methods2.eq;
var methods_default = methods2;

// node_modules/compromise/src/API/View.js
var View = class _View {
  constructor(document, pointer, groups2 = {}) {
    const props = [
      ["document", document],
      ["world", world_default],
      ["_groups", groups2],
      ["_cache", null],
      ["viewType", "View"]
    ];
    props.forEach((a2) => {
      Object.defineProperty(this, a2[0], {
        value: a2[1],
        writable: true
      });
    });
    this.ptrs = pointer;
  }
  /* getters:  */
  get docs() {
    let docs = this.document;
    if (this.ptrs) {
      docs = world_default.methods.one.getDoc(this.ptrs, this.document);
    }
    return docs;
  }
  get pointer() {
    return this.ptrs;
  }
  get methods() {
    return this.world.methods;
  }
  get model() {
    return this.world.model;
  }
  get hooks() {
    return this.world.hooks;
  }
  get isView() {
    return true;
  }
  // is the view not-empty?
  get found() {
    return this.docs.length > 0;
  }
  // how many matches we have
  get length() {
    return this.docs.length;
  }
  // return a more-hackable pointer
  get fullPointer() {
    const { docs, ptrs, document } = this;
    const pointers = ptrs || docs.map((_d, n3) => [n3]);
    return pointers.map((a2) => {
      let [n3, start2, end2, id, endId] = a2;
      start2 ||= 0;
      end2 ||= (document[n3] || []).length;
      if (document[n3]?.[start2]) {
        id ||= document[n3][start2].id;
        if (document[n3][end2 - 1]) {
          endId ||= document[n3][end2 - 1].id;
        }
      }
      return [n3, start2, end2, id, endId];
    });
  }
  // create a new View, from this one
  update(pointer) {
    const m3 = new _View(this.document, pointer);
    if (this._cache && pointer?.length > 0) {
      const cache2 = [];
      pointer.forEach((ptr, i3) => {
        const [n3, start2, end2] = ptr;
        if (ptr.length === 1) {
          cache2[i3] = this._cache[n3];
        } else if (start2 === 0 && this.document[n3].length === end2) {
          cache2[i3] = this._cache[n3];
        }
      });
      if (cache2.length > 0) {
        m3._cache = cache2;
      }
    }
    m3.world = this.world;
    return m3;
  }
  // create a new View, from this one
  toView(pointer) {
    return new _View(this.document, pointer || this.pointer);
  }
  fromText(input) {
    const { methods: methods19 } = this;
    const document = methods19.one.tokenize.fromString(input, this.world);
    const doc = new _View(document);
    doc.world = this.world;
    doc.compute(["normal", "freeze", "lexicon"]);
    if (this.world.compute.preTagger) {
      doc.compute("preTagger");
    }
    doc.compute("unfreeze");
    return doc;
  }
  clone() {
    let document = this.document.slice(0);
    document = document.map((terms) => {
      return terms.map((term) => {
        term = { ...term };
        term.tags = new Set(term.tags);
        return term;
      });
    });
    const m3 = this.update(this.pointer);
    m3.document = document;
    m3._cache = this._cache;
    return m3;
  }
};
Object.assign(View.prototype, methods_default);
var View_default = View;

// node_modules/compromise/src/_version.js
var version_default = "14.18.0";

// node_modules/compromise/src/API/extend.js
var isObject = function(item) {
  return item && typeof item === "object" && !Array.isArray(item);
};
var isUnsafeKey = (key) => key === "__proto__" || key === "constructor" || key === "prototype";
function mergeDeep(model5, plugin7) {
  if (isObject(plugin7)) {
    for (const key in plugin7) {
      if (isUnsafeKey(key)) {
        continue;
      }
      if (isObject(plugin7[key])) {
        if (!model5[key]) Object.assign(model5, { [key]: {} });
        mergeDeep(model5[key], plugin7[key]);
      } else {
        Object.assign(model5, { [key]: plugin7[key] });
      }
    }
  }
  return model5;
}
function mergeQuick(model5, plugin7) {
  for (const key in plugin7) {
    if (isUnsafeKey(key)) continue;
    model5[key] ||= {};
    Object.assign(model5[key], plugin7[key]);
  }
  return model5;
}
var addIrregulars = function(model5, conj) {
  const m3 = model5.two.models || {};
  Object.keys(conj).forEach((k2) => {
    if (conj[k2].pastTense) {
      if (m3.toPast) {
        m3.toPast.ex[k2] = conj[k2].pastTense;
      }
      if (m3.fromPast) {
        m3.fromPast.ex[conj[k2].pastTense] = k2;
      }
    }
    if (conj[k2].presentTense) {
      if (m3.toPresent) {
        m3.toPresent.ex[k2] = conj[k2].presentTense;
      }
      if (m3.fromPresent) {
        m3.fromPresent.ex[conj[k2].presentTense] = k2;
      }
    }
    if (conj[k2].gerund) {
      if (m3.toGerund) {
        m3.toGerund.ex[k2] = conj[k2].gerund;
      }
      if (m3.fromGerund) {
        m3.fromGerund.ex[conj[k2].gerund] = k2;
      }
    }
    if (conj[k2].comparative) {
      if (m3.toComparative) {
        m3.toComparative.ex[k2] = conj[k2].comparative;
      }
      if (m3.fromComparative) {
        m3.fromComparative.ex[conj[k2].comparative] = k2;
      }
    }
    if (conj[k2].superlative) {
      if (m3.toSuperlative) {
        m3.toSuperlative.ex[k2] = conj[k2].superlative;
      }
      if (m3.fromSuperlative) {
        m3.fromSuperlative.ex[conj[k2].superlative] = k2;
      }
    }
  });
};
var extend = function(plugin7, world2, View2, nlp2) {
  if (Array.isArray(plugin7)) {
    plugin7.forEach((p5) => extend(p5, world2, View2, nlp2));
    return;
  }
  const { methods: methods19, model: model5, compute: compute4, hooks: hooks2 } = world2;
  if (plugin7.methods) {
    mergeQuick(methods19, plugin7.methods);
  }
  if (plugin7.model) {
    mergeDeep(model5, plugin7.model);
  }
  if (plugin7.irregulars) {
    addIrregulars(model5, plugin7.irregulars);
  }
  if (plugin7.compute) {
    Object.assign(compute4, plugin7.compute);
  }
  if (hooks2) {
    world2.hooks = hooks2.concat(plugin7.hooks || []);
  }
  if (plugin7.api) {
    plugin7.api(View2);
  }
  if (plugin7.lib) {
    Object.keys(plugin7.lib).forEach((k2) => nlp2[k2] = plugin7.lib[k2]);
  }
  if (plugin7.tags) {
    nlp2.addTags(plugin7.tags);
  }
  if (plugin7.words) {
    nlp2.addWords(plugin7.words);
  }
  if (plugin7.frozen) {
    nlp2.addWords(plugin7.frozen, true);
  }
  if (plugin7.mutate) {
    plugin7.mutate(world2, nlp2);
  }
};
var extend_default = extend;

// node_modules/compromise/src/API/debug.js
var env = globalThis.process?.env ?? globalThis.env ?? {};
var debug = { tags: Boolean(env.DEBUG_TAGS) };
var debug_default = debug;

// node_modules/compromise/src/API/_lib.js
var verbose = function(set) {
  const env2 = globalThis.process?.env ?? globalThis.env ?? {};
  debug_default.tags = set === "tagger" || set === true;
  env2.DEBUG_TAGS = debug_default.tags ? true : "";
  env2.DEBUG_MATCH = set === "match" || set === true ? true : "";
  env2.DEBUG_CHUNKS = set === "chunker" || set === true ? true : "";
  return this;
};

// node_modules/compromise/src/API/inputs.js
var isObject2 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var fromJson = function(json) {
  return json.map((o2) => {
    return o2.terms.map((term) => {
      if (Array.isArray(term.tags)) {
        term.tags = new Set(term.tags);
      }
      return term;
    });
  });
};
var preTokenized = function(arr) {
  return arr.map((a2) => {
    return a2.map((str) => {
      return {
        text: str,
        normal: str,
        //cleanup
        pre: "",
        post: " ",
        tags: /* @__PURE__ */ new Set()
      };
    });
  });
};
var inputs = function(input, View2, world2) {
  const { methods: methods19 } = world2;
  const doc = new View2([]);
  doc.world = world2;
  if (typeof input === "number") {
    input = String(input);
  }
  if (!input) {
    return doc;
  }
  if (typeof input === "string") {
    const document = methods19.one.tokenize.fromString(input, world2);
    return new View2(document);
  }
  if (isObject2(input) && input.isView) {
    return new View2(input.document, input.ptrs);
  }
  if (Array.isArray(input)) {
    if (Array.isArray(input[0])) {
      const document2 = preTokenized(input);
      return new View2(document2);
    }
    const document = fromJson(input);
    return new View2(document);
  }
  return doc;
};
var inputs_default = inputs;

// node_modules/compromise/src/nlp.js
var world = { ...world_default };
var nlp = function(input, lex) {
  if (lex) {
    nlp.addWords(lex);
  }
  const doc = inputs_default(input, View_default, world);
  if (input) {
    doc.compute(world.hooks);
  }
  return doc;
};
Object.defineProperty(nlp, "_world", {
  value: world,
  writable: true
});
nlp.tokenize = function(input, lex) {
  const { compute: compute4 } = this._world;
  if (lex) {
    nlp.addWords(lex);
  }
  const doc = inputs_default(input, View_default, world);
  if (compute4.contractions) {
    doc.compute(["alias", "normal", "machine", "contractions"]);
  }
  return doc;
};
nlp.plugin = function(plugin7) {
  extend_default(plugin7, this._world, View_default, this);
  return this;
};
nlp.extend = nlp.plugin;
nlp.world = function() {
  return this._world;
};
nlp.model = function() {
  return this._world.model;
};
nlp.methods = function() {
  return this._world.methods;
};
nlp.hooks = function() {
  return this._world.hooks;
};
nlp.verbose = verbose;
nlp.version = version_default;
var nlp_default = nlp;

// node_modules/compromise/src/1-one/cache/methods/cacheDoc.js
var createCache = function(document) {
  const cache2 = document.map((terms) => {
    const items = /* @__PURE__ */ new Set();
    terms.forEach((term) => {
      if (term.normal !== "") {
        items.add(term.normal);
      }
      if (term.switch) {
        items.add(`%${term.switch}%`);
      }
      if (term.implicit) {
        items.add(term.implicit);
      }
      if (term.machine) {
        items.add(term.machine);
      }
      if (term.root) {
        items.add(term.root);
      }
      if (term.alias) {
        term.alias.forEach((str) => items.add(str));
      }
      term.tags.forEach((tag) => {
        items.add("#" + tag);
      });
    });
    return items;
  });
  return cache2;
};
var cacheDoc_default = createCache;

// node_modules/compromise/src/1-one/cache/methods/index.js
var methods_default2 = {
  one: {
    cacheDoc: cacheDoc_default
  }
};

// node_modules/compromise/src/1-one/cache/api.js
var methods3 = {
  /** */
  cache: function() {
    this._cache = this.methods.one.cacheDoc(this.document);
    return this;
  },
  /** */
  uncache: function() {
    this._cache = null;
    return this;
  }
};
var addAPI = function(View2) {
  Object.assign(View2.prototype, methods3);
};
var api_default = addAPI;

// node_modules/compromise/src/1-one/cache/compute.js
var compute_default2 = {
  cache: function(view) {
    view._cache = view.methods.one.cacheDoc(view.document);
  }
};

// node_modules/compromise/src/1-one/cache/plugin.js
var plugin_default = {
  api: api_default,
  compute: compute_default2,
  methods: methods_default2
};

// node_modules/compromise/src/1-one/change/api/case.js
var case_default = {
  /** */
  toLowerCase: function() {
    this.termList().forEach((t3) => {
      t3.text = t3.text.toLowerCase();
    });
    return this;
  },
  /** */
  toUpperCase: function() {
    this.termList().forEach((t3) => {
      t3.text = t3.text.toUpperCase();
    });
    return this;
  },
  /** */
  toTitleCase: function() {
    this.termList().forEach((t3) => {
      t3.text = t3.text.replace(/^ *[a-z\u00C0-\u00FF]/, (x) => x.toUpperCase());
    });
    return this;
  },
  /** */
  toCamelCase: function() {
    this.docs.forEach((terms) => {
      terms.forEach((t3, i3) => {
        if (i3 !== 0) {
          t3.text = t3.text.replace(/^ *[a-z\u00C0-\u00FF]/, (x) => x.toUpperCase());
        }
        if (i3 !== terms.length - 1) {
          t3.post = "";
        }
      });
    });
    return this;
  }
};

// node_modules/compromise/src/1-one/change/api/lib/insert.js
var isTitleCase = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str) || /^\p{Lu}$/u.test(str);
var toTitleCase = (str) => str.replace(/^\p{Ll}/u, (x) => x.toUpperCase());
var toLowerCase = (str) => str.replace(/^\p{Lu}/u, (x) => x.toLowerCase());
var spliceArr = (parent, index3, child) => {
  child.forEach((term) => term.dirty = true);
  if (parent) {
    parent.splice(index3, 0, ...child);
  }
  return parent;
};
var endSpace = function(terms) {
  const hasSpace2 = / $/;
  const hasDash4 = /[-–—]/;
  const lastTerm = terms.at(-1);
  if (lastTerm && !hasSpace2.test(lastTerm.post) && !hasDash4.test(lastTerm.post)) {
    lastTerm.post += " ";
  }
};
var movePunct = (source2, end2, needle) => {
  const juicy = /[-.?!,;:)–—'"]/g;
  const wasLast = source2[end2 - 1];
  if (!wasLast) {
    return;
  }
  const post = wasLast.post;
  if (juicy.test(post)) {
    const punct = post.match(juicy).join("");
    const last = needle.at(-1);
    last.post = punct + last.post;
    wasLast.post = wasLast.post.replace(juicy, "");
  }
};
var moveTitleCase = function(home, start2, needle) {
  const from = home[start2];
  if (start2 !== 0 || !isTitleCase(from.text)) {
    return;
  }
  needle[0].text = toTitleCase(needle[0].text);
  const old = home[start2];
  if (old.tags.has("ProperNoun") || old.tags.has("Acronym")) {
    return;
  }
  if (isTitleCase(old.text) && old.text.length > 1) {
    old.text = toLowerCase(old.text);
  }
};
var cleanPrepend = function(home, ptr, needle, document) {
  const [n3, start2, end2] = ptr;
  if (start2 === 0) {
    endSpace(needle);
  } else if (end2 === document[n3].length) {
    endSpace(needle);
  } else {
    endSpace(needle);
    endSpace([home[ptr[1]]]);
  }
  moveTitleCase(home, start2, needle);
  spliceArr(home, start2, needle);
};
var cleanAppend = function(home, ptr, needle, document) {
  const [n3, , end2] = ptr;
  const total = (document[n3] || []).length;
  if (end2 < total) {
    movePunct(home, end2, needle);
    endSpace(needle);
  } else if (total === end2) {
    endSpace(home);
    movePunct(home, end2, needle);
    if (document[n3 + 1]) {
      needle.at(-1).post += " ";
    }
  }
  spliceArr(home, ptr[2], needle);
  ptr[4] = needle.at(-1).id;
};

// node_modules/compromise/src/1-one/change/compute/uuid.js
var index = 0;
var pad3 = (str) => {
  str = str.length < 3 ? "0" + str : str;
  return str.length < 3 ? "0" + str : str;
};
var toId = function(term) {
  let [n3, i3] = term.index || [0, 0];
  index += 1;
  index = index > 46655 ? 0 : index;
  n3 = n3 > 46655 ? 0 : n3;
  i3 = i3 > 1294 ? 0 : i3;
  let id = pad3(index.toString(36));
  id += pad3(n3.toString(36));
  let tx = i3.toString(36);
  tx = tx.length < 2 ? "0" + tx : tx;
  id += tx;
  const r2 = parseInt(Math.random() * 36, 10);
  id += r2.toString(36);
  return term.normal + "|" + id.toUpperCase();
};
var uuid_default = toId;

// node_modules/compromise/src/1-one/change/api/insert.js
var expand = function(m3) {
  if (m3.has("@hasContraction") && typeof m3.contractions === "function") {
    const more = m3.grow("@hasContraction");
    more.contractions().expand();
  }
};
var addIds = function(terms) {
  terms = terms.map((term) => {
    term.id = uuid_default(term);
    return term;
  });
  return terms;
};
var getTerms = function(input, world2) {
  const { methods: methods19 } = world2;
  if (typeof input === "string") {
    return methods19.one.tokenize.fromString(input, world2)[0];
  }
  if (typeof input === "object" && input.isView) {
    return input.clone().docs[0] || [];
  }
  if (Array.isArray(input)) {
    return Array.isArray(input[0]) ? input[0] : input;
  }
  return [];
};
var insert = function(input, view, prepend) {
  const { document, world: world2 } = view;
  view.uncache();
  const ptrs = view.fullPointer;
  const selfPtrs = view.fullPointer;
  view.forEach((m3, i3) => {
    const ptr = m3.fullPointer[0];
    const [n3] = ptr;
    const home = document[n3];
    let terms = getTerms(input, world2);
    if (terms.length === 0) {
      return;
    }
    terms = addIds(terms);
    if (prepend) {
      expand(view.update([ptr]).firstTerm());
      cleanPrepend(home, ptr, terms, document);
    } else {
      expand(view.update([ptr]).lastTerm());
      cleanAppend(home, ptr, terms, document);
    }
    if (document[n3]?.[ptr[1]]) {
      ptr[3] = document[n3][ptr[1]].id;
    }
    selfPtrs[i3] = ptr;
    ptr[2] += terms.length;
    ptrs[i3] = ptr;
  });
  const doc = view.toView(ptrs);
  view.ptrs = selfPtrs;
  doc.compute(["id", "index", "freeze", "lexicon"]);
  if (doc.world.compute.preTagger) {
    doc.compute("preTagger");
  }
  doc.compute("unfreeze");
  return doc;
};
var fns2 = {
  insertAfter: function(input) {
    return insert(input, this, false);
  },
  insertBefore: function(input) {
    return insert(input, this, true);
  }
};
fns2.append = fns2.insertAfter;
fns2.prepend = fns2.insertBefore;
fns2.insert = fns2.insertAfter;
var insert_default = fns2;

// node_modules/compromise/src/1-one/change/api/replace.js
var dollarStub = /\$[0-9a-z]+/g;
var fns3 = {};
var isTitleCase2 = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str) || /^\p{Lu}$/u.test(str);
var toTitleCase2 = (str) => str.replace(/^\p{Ll}/u, (x) => x.toUpperCase());
var toLowerCase2 = (str) => str.replace(/^\p{Lu}/u, (x) => x.toLowerCase());
var replaceByFn = function(main, fn, keep9) {
  main.forEach((m3) => {
    const out2 = fn(m3);
    m3.replaceWith(out2, keep9);
  });
  return main;
};
var subDollarSign = function(input, main) {
  if (typeof input !== "string") {
    return input;
  }
  const groups2 = main.groups();
  input = input.replace(dollarStub, (a2) => {
    const num = a2.replace(/\$/, "");
    if (Object.hasOwn(groups2, num)) {
      return groups2[num].text();
    }
    return a2;
  });
  return input;
};
fns3.replaceWith = function(input, keep9 = {}) {
  let ptrs = this.fullPointer;
  if (keep9 === true) {
    keep9 = {
      tags: true,
      case: true,
      possessives: true
    };
  }
  const main = this;
  this.uncache();
  if (typeof input === "function") {
    return replaceByFn(main, input, keep9);
  }
  const terms = main.docs[0];
  if (!terms) return main;
  const isOriginalPossessive = keep9.possessives && terms.at(-1).tags.has("Possessive");
  const isOriginalTitleCase = keep9.case && isTitleCase2(terms[0].text);
  input = subDollarSign(input, main);
  const original = this.update(ptrs);
  ptrs = ptrs.map((ptr) => ptr.slice(0, 3));
  let oldTags = (original.docs[0] || []).map((term) => Array.from(term.tags));
  const originalPre = original.docs[0][0].pre;
  const originalPost = original.docs[0].at(-1).post;
  if (typeof input === "string") {
    input = this.fromText(input).compute("id");
  }
  main.insertAfter(input);
  if (original.has("@hasContraction") && main.contractions) {
    const more = main.grow("@hasContraction+");
    more.contractions().expand();
  }
  main.delete(original);
  if (isOriginalPossessive) {
    const tmp = main.docs[0];
    const term = tmp.at(-1);
    if (!term.tags.has("Possessive")) {
      term.text += "'s";
      term.normal += "'s";
      term.tags.add("Possessive");
    }
  }
  if (originalPre && main.docs[0]) {
    main.docs[0][0].pre = originalPre;
  }
  if (originalPost && main.docs[0]) {
    const lastOne = main.docs[0].at(-1);
    if (!lastOne.post.trim()) {
      lastOne.post = originalPost;
    }
  }
  const m3 = main.toView(ptrs).compute(["index", "freeze", "lexicon"]);
  if (m3.world.compute.preTagger) {
    m3.compute("preTagger");
  }
  m3.compute("unfreeze");
  if (keep9.tags) {
    oldTags = oldTags.slice(0, input.wordCount());
    m3.terms().forEach((term, i3) => {
      term.tagSafe(oldTags[i3]);
    });
  }
  if (!m3.docs[0] || !m3.docs[0][0]) return m3;
  if (keep9.case) {
    const transformCase = isOriginalTitleCase ? toTitleCase2 : toLowerCase2;
    m3.docs[0][0].text = transformCase(m3.docs[0][0].text);
  }
  return m3;
};
fns3.replace = function(match2, input, keep9) {
  if (match2 && !input) {
    return this.replaceWith(match2, keep9);
  }
  const m3 = this.match(match2);
  if (!m3.found) {
    return this;
  }
  this.soften();
  return m3.replaceWith(input, keep9);
};
var replace_default = fns3;

// node_modules/compromise/src/1-one/change/api/lib/remove.js
var removeRunBefore = (str, run, following) => {
  let i3 = 0;
  while (i3 < str.length) {
    if (!run.includes(str[i3])) {
      i3++;
      continue;
    }
    const start2 = i3;
    while (i3 < str.length && run.includes(str[i3])) i3++;
    if (i3 < str.length && following.includes(str[i3])) {
      return str.slice(0, start2) + str.slice(i3);
    }
  }
  return str;
};
var repairPunct = function(terms, len) {
  const last = terms.length - 1;
  const from = terms[last];
  const to = terms[last - len];
  if (to && from) {
    to.post += from.post;
    to.post = removeRunBefore(to.post, " ", ".?!,;:");
    to.post = removeRunBefore(to.post, ",;:", ".?!");
  }
};
var pluckOut = function(document, nots) {
  nots.forEach((ptr) => {
    const [n3, start2, end2] = ptr;
    const len = end2 - start2;
    if (!document[n3]) {
      return;
    }
    if (end2 === document[n3].length && end2 > 1) {
      repairPunct(document[n3], len);
    }
    document[n3].splice(start2, len);
  });
  for (let i3 = document.length - 1; i3 >= 0; i3 -= 1) {
    if (document[i3].length === 0) {
      document.splice(i3, 1);
      if (i3 === document.length && document[i3 - 1]) {
        const terms = document[i3 - 1];
        const lastTerm = terms.at(-1);
        if (lastTerm) {
          lastTerm.post = lastTerm.post.trimEnd();
        }
      }
    }
  }
  return document;
};
var remove_default = pluckOut;

// node_modules/compromise/src/1-one/change/api/remove.js
var fixPointers = function(ptrs, gonePtrs) {
  ptrs = ptrs.map((ptr) => {
    const [n3] = ptr;
    if (!gonePtrs[n3]) {
      return ptr;
    }
    gonePtrs[n3].forEach((no) => {
      const len = no[2] - no[1];
      if (ptr[1] <= no[1] && ptr[2] >= no[2]) {
        ptr[2] -= len;
      }
    });
    return ptr;
  });
  ptrs.forEach((ptr, i3) => {
    if (ptr[1] === 0 && ptr[2] == 0) {
      for (let n3 = i3 + 1; n3 < ptrs.length; n3 += 1) {
        ptrs[n3][0] -= 1;
        if (ptrs[n3][0] < 0) {
          ptrs[n3][0] = 0;
        }
      }
    }
  });
  ptrs = ptrs.filter((ptr) => ptr[2] - ptr[1] > 0);
  ptrs = ptrs.map((ptr) => {
    ptr[3] = null;
    ptr[4] = null;
    return ptr;
  });
  return ptrs;
};
var methods4 = {
  /** */
  remove: function(reg) {
    const { indexN: indexN2 } = this.methods.one.pointer;
    this.uncache();
    let self = this.all();
    let not = this;
    if (reg) {
      self = this;
      not = this.match(reg);
    }
    const isFull = !self.ptrs;
    if (not.has("@hasContraction") && not.contractions) {
      const more = not.grow("@hasContraction");
      more.contractions().expand();
    }
    let ptrs = self.fullPointer;
    const nots = not.fullPointer.reverse();
    const document = remove_default(this.document, nots);
    const gonePtrs = indexN2(nots);
    ptrs = fixPointers(ptrs, gonePtrs);
    self.ptrs = ptrs;
    self.document = document;
    self.compute("index");
    if (isFull) {
      self.ptrs = void 0;
    }
    if (!reg) {
      this.ptrs = [];
      return self.none();
    }
    const res = self.toView(ptrs);
    return res;
  }
};
methods4.delete = methods4.remove;
var remove_default2 = methods4;

// node_modules/compromise/src/1-one/change/api/whitespace.js
var methods5 = {
  /** add this punctuation or whitespace before each match: */
  pre: function(str, concat) {
    if (str === void 0 && this.found) {
      return this.docs[0][0].pre;
    }
    this.docs.forEach((terms) => {
      const term = terms[0];
      if (concat === true) {
        term.pre += str;
      } else {
        term.pre = str;
      }
    });
    return this;
  },
  /** add this punctuation or whitespace after each match: */
  post: function(str, concat) {
    if (str === void 0) {
      const last = this.docs.at(-1);
      return last.at(-1).post;
    }
    this.docs.forEach((terms) => {
      const term = terms.at(-1);
      if (concat === true) {
        term.post += str;
      } else {
        term.post = str;
      }
    });
    return this;
  },
  /** remove whitespace from start/end */
  trim: function() {
    if (!this.found) {
      return this;
    }
    const docs = this.docs;
    const start2 = docs[0][0];
    start2.pre = start2.pre.trimStart();
    const last = docs.at(-1);
    const end2 = last.at(-1);
    end2.post = end2.post.trimEnd();
    return this;
  },
  /** connect words with hyphen, and remove whitespace */
  hyphenate: function() {
    this.docs.forEach((terms) => {
      terms.forEach((t3, i3) => {
        if (i3 !== 0) {
          t3.pre = "";
        }
        if (terms[i3 + 1]) {
          t3.post = "-";
        }
      });
    });
    return this;
  },
  /** remove hyphens between words, and set whitespace */
  dehyphenate: function() {
    const hasHyphen3 = /[-–—]/;
    this.docs.forEach((terms) => {
      terms.forEach((t3) => {
        if (hasHyphen3.test(t3.post)) {
          t3.post = " ";
        }
      });
    });
    return this;
  },
  /** add quotations around these matches */
  toQuotations: function(start2, end2) {
    start2 ||= `"`;
    end2 ||= `"`;
    this.docs.forEach((terms) => {
      terms[0].pre = start2 + terms[0].pre;
      const last = terms.at(-1);
      last.post = end2 + last.post;
    });
    return this;
  },
  /** add brackets around these matches */
  toParentheses: function(start2, end2) {
    start2 ||= `(`;
    end2 ||= `)`;
    this.docs.forEach((terms) => {
      terms[0].pre = start2 + terms[0].pre;
      const last = terms.at(-1);
      last.post = end2 + last.post;
    });
    return this;
  }
};
methods5.deHyphenate = methods5.dehyphenate;
methods5.toQuotation = methods5.toQuotations;
var whitespace_default = methods5;

// node_modules/compromise/src/1-one/change/api/lib/_sort.js
var alpha = (a2, b) => {
  if (a2.normal < b.normal) {
    return -1;
  }
  if (a2.normal > b.normal) {
    return 1;
  }
  return 0;
};
var length = (a2, b) => {
  const left = a2.normal.trim().length;
  const right = b.normal.trim().length;
  if (left < right) {
    return 1;
  }
  if (left > right) {
    return -1;
  }
  return 0;
};
var wordCount = (a2, b) => {
  if (a2.words < b.words) {
    return 1;
  }
  if (a2.words > b.words) {
    return -1;
  }
  return 0;
};
var sequential = (a2, b) => {
  if (a2[0] < b[0]) {
    return 1;
  }
  if (a2[0] > b[0]) {
    return -1;
  }
  return a2[1] > b[1] ? 1 : -1;
};
var byFreq = function(arr) {
  const counts = /* @__PURE__ */ Object.create(null);
  arr.forEach((o2) => {
    counts[o2.normal] ??= 0;
    counts[o2.normal] += 1;
  });
  arr.sort((a2, b) => {
    const left = counts[a2.normal];
    const right = counts[b.normal];
    if (left < right) {
      return 1;
    }
    if (left > right) {
      return -1;
    }
    return 0;
  });
  return arr;
};
var sort_default = { alpha, length, wordCount, sequential, byFreq };

// node_modules/compromise/src/1-one/change/api/sort.js
var seqNames = /* @__PURE__ */ new Set(["index", "sequence", "seq", "sequential", "chron", "chronological"]);
var freqNames = /* @__PURE__ */ new Set(["freq", "frequency", "topk", "repeats"]);
var alphaNames = /* @__PURE__ */ new Set(["alpha", "alphabetical"]);
var customSort = function(view, fn) {
  let ptrs = view.fullPointer;
  ptrs = ptrs.sort((a2, b) => {
    a2 = view.update([a2]);
    b = view.update([b]);
    return fn(a2, b);
  });
  view.ptrs = ptrs;
  return view;
};
var sort = function(input) {
  const { docs, pointer } = this;
  this.uncache();
  if (typeof input === "function") {
    return customSort(this, input);
  }
  input ||= "alpha";
  const ptrs = pointer || docs.map((_d, n3) => [n3]);
  let arr = docs.map((terms, n3) => {
    return {
      index: n3,
      words: terms.length,
      normal: terms.map((t3) => t3.machine || t3.normal || "").join(" "),
      pointer: ptrs[n3]
    };
  });
  if (seqNames.has(input)) {
    input = "sequential";
  }
  if (alphaNames.has(input)) {
    input = "alpha";
  }
  if (freqNames.has(input)) {
    arr = sort_default.byFreq(arr);
    return this.update(arr.map((o2) => o2.pointer));
  }
  if (typeof sort_default[input] === "function") {
    arr = arr.sort(sort_default[input]);
    return this.update(arr.map((o2) => o2.pointer));
  }
  return this;
};
var reverse = function() {
  let ptrs = this.pointer || this.docs.map((_d, n3) => [n3]);
  ptrs = [].concat(ptrs);
  ptrs = ptrs.reverse();
  if (this._cache) {
    this._cache = this._cache.reverse();
  }
  return this.update(ptrs);
};
var unique = function() {
  const already = /* @__PURE__ */ new Set();
  const res = this.filter((m3) => {
    const txt = m3.text("machine");
    if (already.has(txt)) {
      return false;
    }
    already.add(txt);
    return true;
  });
  return res;
};
var sort_default2 = { unique, reverse, sort };

// node_modules/compromise/src/1-one/change/api/concat.js
var combineDocs = function(homeDocs, inputDocs) {
  if (homeDocs.length > 0) {
    const end2 = homeDocs.at(-1);
    const last = end2.at(-1);
    if (/ /.test(last.post) === false) {
      last.post += " ";
    }
  }
  homeDocs = homeDocs.concat(inputDocs);
  return homeDocs;
};
var combineViews = function(home, input) {
  if (home.document === input.document) {
    const ptrs2 = home.fullPointer.concat(input.fullPointer);
    return home.toView(ptrs2).compute("index");
  }
  const ptrs = input.fullPointer;
  ptrs.forEach((a2) => {
    a2[0] += home.document.length;
  });
  home.document = combineDocs(home.document, input.docs);
  return home.all();
};
var concat_default = {
  // add string as new match/sentence
  concat: function(input) {
    if (typeof input === "string") {
      const more = this.fromText(input);
      if (!this.found || !this.ptrs) {
        this.document = this.document.concat(more.document);
      } else {
        const ptrs = this.fullPointer;
        const at = ptrs.at(-1)[0];
        this.document.splice(at, 0, ...more.document);
      }
      return this.all().compute("index");
    }
    if (typeof input === "object" && input.isView) {
      return combineViews(this, input);
    }
    if (Array.isArray(input)) {
      const docs = combineDocs(this.document, input);
      this.document = docs;
      return this.all();
    }
    return this;
  }
};

// node_modules/compromise/src/1-one/change/api/harden.js
var harden = function() {
  this.ptrs = this.fullPointer;
  return this;
};
var soften = function() {
  let ptr = this.ptrs;
  if (!ptr || ptr.length === 0) {
    return this;
  }
  ptr = ptr.map((a2) => a2.slice(0, 3));
  this.ptrs = ptr;
  return this;
};
var harden_default = { harden, soften };

// node_modules/compromise/src/1-one/change/api/index.js
var methods6 = { ...case_default, ...insert_default, ...replace_default, ...remove_default2, ...whitespace_default, ...sort_default2, ...concat_default, ...harden_default };
var addAPI2 = function(View2) {
  Object.assign(View2.prototype, methods6);
};
var api_default2 = addAPI2;

// node_modules/compromise/src/1-one/change/compute/index.js
var compute2 = {
  id: function(view) {
    const docs = view.docs;
    for (let n3 = 0; n3 < docs.length; n3 += 1) {
      for (let i3 = 0; i3 < docs[n3].length; i3 += 1) {
        const term = docs[n3][i3];
        term.id ||= uuid_default(term);
      }
    }
  }
};
var compute_default3 = compute2;

// node_modules/compromise/src/1-one/change/plugin.js
var plugin_default2 = {
  api: api_default2,
  compute: compute_default3
};

// node_modules/compromise/src/1-one/contraction-one/model/contractions.js
var contractions_default = [
  // simple mappings
  { word: "@", out: ["at"] },
  { word: "arent", out: ["are", "not"] },
  { word: "alot", out: ["a", "lot"] },
  { word: "brb", out: ["be", "right", "back"] },
  { word: "cannot", out: ["can", "not"] },
  { word: "dun", out: ["do", "not"] },
  { word: "can't", out: ["can", "not"] },
  { word: "shan't", out: ["should", "not"] },
  { word: "won't", out: ["will", "not"] },
  { word: "that's", out: ["that", "is"] },
  { word: "what's", out: ["what", "is"] },
  { word: "let's", out: ["let", "us"] },
  // { word: "there's", out: ['there', 'is'] },
  { word: "dunno", out: ["do", "not", "know"] },
  { word: "gonna", out: ["going", "to"] },
  { word: "gotta", out: ["have", "got", "to"] },
  //hmm
  { word: "gimme", out: ["give", "me"] },
  { word: "outta", out: ["out", "of"] },
  { word: "tryna", out: ["trying", "to"] },
  { word: "gtg", out: ["got", "to", "go"] },
  { word: "im", out: ["i", "am"] },
  { word: "imma", out: ["I", "will"] },
  { word: "imo", out: ["in", "my", "opinion"] },
  { word: "irl", out: ["in", "real", "life"] },
  { word: "ive", out: ["i", "have"] },
  { word: "rn", out: ["right", "now"] },
  { word: "tbh", out: ["to", "be", "honest"] },
  { word: "wanna", out: ["want", "to"] },
  { word: `c'mere`, out: ["come", "here"] },
  { word: `c'mon`, out: ["come", "on"] },
  // shoulda, coulda
  { word: "shoulda", out: ["should", "have"] },
  { word: "coulda", out: ["coulda", "have"] },
  { word: "woulda", out: ["woulda", "have"] },
  { word: "musta", out: ["must", "have"] },
  { word: "tis", out: ["it", "is"] },
  { word: "twas", out: ["it", "was"] },
  { word: `y'know`, out: ["you", "know"] },
  { word: "ne'er", out: ["never"] },
  { word: "o'er", out: ["over"] },
  // contraction-part mappings
  { after: "ll", out: ["will"] },
  { after: "ve", out: ["have"] },
  { after: "re", out: ["are"] },
  { after: "m", out: ["am"] },
  // french contractions
  { before: "c", out: ["ce"] },
  { before: "m", out: ["me"] },
  { before: "n", out: ["ne"] },
  { before: "qu", out: ["que"] },
  { before: "s", out: ["se"] },
  { before: "t", out: ["tu"] },
  // t'aime
  // missing apostrophes
  { word: "shouldnt", out: ["should", "not"] },
  { word: "couldnt", out: ["could", "not"] },
  { word: "wouldnt", out: ["would", "not"] },
  { word: "hasnt", out: ["has", "not"] },
  { word: "wasnt", out: ["was", "not"] },
  { word: "isnt", out: ["is", "not"] },
  { word: "cant", out: ["can", "not"] },
  { word: "dont", out: ["do", "not"] },
  { word: "wont", out: ["will", "not"] },
  // apostrophe d
  { word: "howd", out: ["how", "did"] },
  { word: "whatd", out: ["what", "did"] },
  { word: "whend", out: ["when", "did"] },
  { word: "whered", out: ["where", "did"] }
];

// node_modules/compromise/src/1-one/contraction-one/model/number-suffix.js
var t = true;
var number_suffix_default = {
  "st": t,
  "nd": t,
  "rd": t,
  "th": t,
  "am": t,
  "pm": t,
  "max": t,
  "\xB0": t,
  "s": t,
  // 1990s
  "e": t,
  // 18e - french/spanish ordinal
  "er": t,
  //french 1er
  "\xE8re": t,
  //''
  "\xE8me": t
  //french 2ème
};

// node_modules/compromise/src/1-one/contraction-one/model/index.js
var model_default = {
  one: {
    contractions: contractions_default,
    numberSuffixes: number_suffix_default
  }
};

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/_splice.js
var insertContraction = function(document, point, words) {
  const [n3, w] = point;
  if (!words || words.length === 0) {
    return;
  }
  words = words.map((word, i3) => {
    word.implicit = word.text;
    word.machine = word.text;
    word.pre = "";
    word.post = "";
    word.text = "";
    word.normal = "";
    word.index = [n3, w + i3];
    return word;
  });
  if (words[0]) {
    words[0].pre = document[n3][w].pre;
    words[words.length - 1].post = document[n3][w].post;
    words[0].text = document[n3][w].text;
    words[0].normal = document[n3][w].normal;
  }
  document[n3].splice(w, 1, ...words);
};
var splice_default = insertContraction;

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/apostrophe-d.js
var hasContraction = /'/;
var alwaysDid = /* @__PURE__ */ new Set([
  "what",
  "how",
  "when",
  "where",
  "why"
]);
var useWould = /* @__PURE__ */ new Set([
  "be",
  "go",
  "start",
  "think",
  "need"
]);
var useHad = /* @__PURE__ */ new Set([
  "been",
  "gone"
]);
var _apostropheD = function(terms, i3) {
  const before2 = terms[i3].normal.split(hasContraction)[0];
  if (alwaysDid.has(before2)) {
    return [before2, "did"];
  }
  if (terms[i3 + 1]) {
    if (useHad.has(terms[i3 + 1].normal)) {
      return [before2, "had"];
    }
    if (useWould.has(terms[i3 + 1].normal)) {
      return [before2, "would"];
    }
  }
  return null;
};
var apostrophe_d_default = _apostropheD;

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/apostrophe-t.js
var apostropheT = function(terms, i3) {
  if (terms[i3].normal === "ain't" || terms[i3].normal === "aint") {
    return null;
  }
  const before2 = terms[i3].normal.replace(/n't/, "");
  return [before2, "not"];
};
var apostrophe_t_default = apostropheT;

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/french.js
var hasContraction2 = /'/;
var isFeminine = /(e|é|aison|sion|tion)$/;
var isMasculine = /(age|isme|acle|ege|oire)$/;
var preL = (terms, i3) => {
  const after2 = terms[i3].normal.split(hasContraction2)[1];
  if (after2 && after2.endsWith("e")) {
    return ["la", after2];
  }
  return ["le", after2];
};
var preD = (terms, i3) => {
  const after2 = terms[i3].normal.split(hasContraction2)[1];
  if (after2 && isFeminine.test(after2) && !isMasculine.test(after2)) {
    return ["du", after2];
  } else if (after2 && after2.endsWith("s")) {
    return ["des", after2];
  }
  return ["de", after2];
};
var preJ = (terms, i3) => {
  const after2 = terms[i3].normal.split(hasContraction2)[1];
  return ["je", after2];
};
var french_default = {
  preJ,
  preL,
  preD
};

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/number-range.js
var isRange = /^([0-9.]{1,4}[a-z]{0,2}) ?[-–—] ?([0-9]{1,4}[a-z]{0,2})$/i;
var timeRange = /^([0-9]{1,2}(:[0-9][0-9])?(am|pm)?) ?[-–—] ?([0-9]{1,2}(:[0-9][0-9])?(am|pm)?)$/i;
var phoneNum = /^[0-9]{3}-[0-9]{4}$/;
var numberRange = function(terms, i3) {
  const term = terms[i3];
  let parts = term.text.match(isRange);
  if (parts !== null) {
    if (term.tags.has("PhoneNumber") === true || phoneNum.test(term.text)) {
      return null;
    }
    return [parts[1], "to", parts[2]];
  } else {
    parts = term.text.match(timeRange);
    if (parts !== null) {
      return [parts[1], "to", parts[4]];
    }
  }
  return null;
};
var number_range_default = numberRange;

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/number-unit.js
var numUnit = /^([+-]?[0-9][.,0-9]*)([a-z°²³µ/]+)$/;
var numberUnit = function(terms, i3, world2) {
  const notUnit = world2.model.one.numberSuffixes || {};
  const term = terms[i3];
  const parts = term.text.match(numUnit);
  if (parts !== null) {
    const unit = parts[2].toLowerCase().trim();
    if (Object.hasOwn(notUnit, unit)) {
      return null;
    }
    return [parts[1], unit];
  }
  return null;
};
var number_unit_default = numberUnit;

// node_modules/compromise/src/1-one/contraction-one/compute/contractions/index.js
var byApostrophe = /'/;
var numDash = /^[0-9][^-–—]*[-–—].*?[0-9]/;
var reTag = function(terms, view, start2, len) {
  const tmp = view.update();
  tmp.document = [terms];
  let end2 = start2 + len;
  if (start2 > 0) {
    start2 -= 1;
  }
  if (terms[end2]) {
    end2 += 1;
  }
  tmp.ptrs = [[0, start2, end2]];
};
var byEnd = {
  // ain't
  t: (terms, i3) => apostrophe_t_default(terms, i3),
  // how'd
  d: (terms, i3) => apostrophe_d_default(terms, i3)
};
var byStart = {
  // j'aime
  j: (terms, i3) => french_default.preJ(terms, i3),
  // l'amour
  l: (terms, i3) => french_default.preL(terms, i3),
  // d'amerique
  d: (terms, i3) => french_default.preD(terms, i3)
};
var knownOnes = function(list4, term, before2, after2) {
  for (let i3 = 0; i3 < list4.length; i3 += 1) {
    const o2 = list4[i3];
    if (o2.word === term.normal) {
      return o2.out;
    } else if (after2 !== null && after2 === o2.after) {
      return [before2].concat(o2.out);
    } else if (before2 !== null && before2 === o2.before && after2 && after2.length > 2) {
      return o2.out.concat(after2);
    }
  }
  return null;
};
var toDocs = function(words, view) {
  const doc = view.fromText(words.join(" "));
  doc.compute(["id", "alias"]);
  return doc.docs[0];
};
var thereHas = function(terms, i3) {
  for (let k2 = i3 + 1; k2 < 5; k2 += 1) {
    if (!terms[k2]) {
      break;
    }
    if (terms[k2].normal === "been") {
      return ["there", "has"];
    }
  }
  return ["there", "is"];
};
var contractions = (view) => {
  const { world: world2, document } = view;
  const { model: model5, methods: methods19 } = world2;
  const list4 = model5.one.contractions || [];
  document.forEach((terms, n3) => {
    for (let i3 = terms.length - 1; i3 >= 0; i3 -= 1) {
      let before2 = null;
      let after2 = null;
      if (byApostrophe.test(terms[i3].normal) === true) {
        const res = terms[i3].normal.split(byApostrophe);
        before2 = res[0];
        after2 = res[1];
      }
      let words = knownOnes(list4, terms[i3], before2, after2);
      if (!words && Object.hasOwn(byEnd, after2)) {
        words = byEnd[after2](terms, i3, world2);
      }
      if (!words && Object.hasOwn(byStart, before2)) {
        words = byStart[before2](terms, i3);
      }
      if (before2 === "there" && after2 === "s") {
        words = thereHas(terms, i3);
      }
      if (words) {
        words = toDocs(words, view);
        splice_default(document, [n3, i3], words);
        reTag(document[n3], view, i3, words.length);
        continue;
      }
      if (numDash.test(terms[i3].normal)) {
        words = number_range_default(terms, i3);
        if (words) {
          words = toDocs(words, view);
          splice_default(document, [n3, i3], words);
          methods19.one.setTag(words, "NumberRange", world2);
          if (words[2] && words[2].tags.has("Time")) {
            methods19.one.setTag([words[0]], "Time", world2, null, "time-range");
          }
          reTag(document[n3], view, i3, words.length);
        }
        continue;
      }
      words = number_unit_default(terms, i3, world2);
      if (words) {
        words = toDocs(words, view);
        splice_default(document, [n3, i3], words);
        methods19.one.setTag([words[1]], "Unit", world2, null, "contraction-unit");
      }
    }
  });
};
var contractions_default2 = contractions;

// node_modules/compromise/src/1-one/contraction-one/compute/index.js
var compute_default4 = { contractions: contractions_default2 };

// node_modules/compromise/src/1-one/contraction-one/plugin.js
var plugin = {
  model: model_default,
  compute: compute_default4,
  hooks: ["contractions"]
};
var plugin_default3 = plugin;

// node_modules/compromise/src/1-one/freeze/compute.js
var freeze = function(view) {
  const world2 = view.world;
  const { model: model5, methods: methods19 } = view.world;
  const setTag2 = methods19.one.setTag;
  const { frozenLex } = model5.one;
  const multi = model5.one._multiCache || {};
  view.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const t3 = terms[i3];
      const word = t3.machine || t3.normal;
      if (multi[word] !== void 0 && terms[i3 + 1]) {
        const end2 = i3 + multi[word] - 1;
        for (let k2 = end2; k2 > i3; k2 -= 1) {
          const words = terms.slice(i3, k2 + 1);
          const str = words.map((term) => term.machine || term.normal).join(" ");
          if (Object.hasOwn(frozenLex, str) === true) {
            setTag2(words, frozenLex[str], world2, false, "1-frozen-multi-lexicon");
            words.forEach((term) => term.frozen = true);
            continue;
          }
        }
      }
      if (frozenLex[word] !== void 0 && Object.hasOwn(frozenLex, word)) {
        setTag2([t3], frozenLex[word], world2, false, "1-freeze-lexicon");
        t3.frozen = true;
        continue;
      }
    }
  });
};
var unfreeze = function(view) {
  view.docs.forEach((ts) => {
    ts.forEach((term) => {
      delete term.frozen;
    });
  });
  return view;
};
var compute_default5 = { frozen: freeze, freeze, unfreeze };

// node_modules/compromise/src/1-one/freeze/debug.js
var blue = (str) => "\x1B[34m" + str + "\x1B[0m";
var dim = (str) => "\x1B[3m\x1B[2m" + str + "\x1B[0m";
var debug2 = function(view) {
  view.docs.forEach((terms) => {
    console.log(blue("\n  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    terms.forEach((t3) => {
      let str = `  ${dim("\u2502")}  `;
      const txt = t3.implicit || t3.text || "-";
      if (t3.frozen === true) {
        str += `${blue(txt)} \u2744\uFE0F`;
      } else {
        str += dim(txt);
      }
      console.log(str);
    });
  });
};
var debug_default2 = debug2;

// node_modules/compromise/src/1-one/freeze/plugin.js
var plugin_default4 = {
  // add .compute('freeze')
  compute: compute_default5,
  mutate: (world2) => {
    const methods19 = world2.methods.one;
    methods19.termMethods.isFrozen = (term) => term.frozen === true;
    methods19.debug.freeze = debug_default2;
    methods19.debug.frozen = debug_default2;
  },
  api: function(View2) {
    View2.prototype.freeze = function() {
      this.docs.forEach((ts) => {
        ts.forEach((term) => {
          term.frozen = true;
        });
      });
      return this;
    };
    View2.prototype.unfreeze = function() {
      this.compute("unfreeze");
    };
    View2.prototype.isFrozen = function() {
      return this.match("@isFrozen+");
    };
  },
  // run it in init
  hooks: ["freeze"]
};

// node_modules/compromise/src/1-one/lexicon/compute/multi-word.js
var multiWord = function(terms, start_i, world2) {
  const { model: model5, methods: methods19 } = world2;
  const setTag2 = methods19.one.setTag;
  const multi = model5.one._multiCache || {};
  const { lexicon: lexicon4 } = model5.one || {};
  const t3 = terms[start_i];
  const word = t3.machine || t3.normal;
  if (multi[word] !== void 0 && terms[start_i + 1]) {
    const end2 = start_i + multi[word] - 1;
    for (let i3 = end2; i3 > start_i; i3 -= 1) {
      const words = terms.slice(start_i, i3 + 1);
      if (words.length <= 1) {
        return false;
      }
      const str = words.map((term) => term.machine || term.normal).join(" ");
      if (Object.hasOwn(lexicon4, str) === true) {
        const tag = lexicon4[str];
        if (tag && tag.includes("PhrasalVerb") && words[words.length - 1].post === "-") {
          continue;
        }
        setTag2(words, tag, world2, false, "1-multi-lexicon");
        if (tag && tag.length === 2 && (tag[0] === "PhrasalVerb" || tag[1] === "PhrasalVerb")) {
          setTag2([words[1]], "Particle", world2, false, "1-phrasal-particle");
        }
        return true;
      }
    }
    return false;
  }
  return null;
};
var multi_word_default = multiWord;

// node_modules/compromise/src/1-one/lexicon/compute/single-word.js
var prefix = /^(under|over|mis|re|un|dis|semi|pre|post)-?/;
var allowPrefix = /* @__PURE__ */ new Set(["Verb", "Infinitive", "PastTense", "Gerund", "PresentTense", "Adjective", "Participle"]);
var checkLexicon = function(terms, i3, world2) {
  const { model: model5, methods: methods19 } = world2;
  const setTag2 = methods19.one.setTag;
  const { lexicon: lexicon4 } = model5.one;
  const t3 = terms[i3];
  const word = t3.machine || t3.normal;
  if (lexicon4[word] !== void 0 && Object.hasOwn(lexicon4, word)) {
    setTag2([t3], lexicon4[word], world2, false, "1-lexicon");
    return true;
  }
  if (t3.alias) {
    const found = t3.alias.find((str) => Object.hasOwn(lexicon4, str));
    if (found) {
      setTag2([t3], lexicon4[found], world2, false, "1-lexicon-alias");
      return true;
    }
  }
  if (prefix.test(word) === true) {
    const stem = word.replace(prefix, "");
    if (Object.hasOwn(lexicon4, stem) && stem.length > 3) {
      if (allowPrefix.has(lexicon4[stem])) {
        setTag2([t3], lexicon4[stem], world2, false, "1-lexicon-prefix");
        return true;
      }
    }
  }
  return null;
};
var single_word_default = checkLexicon;

// node_modules/compromise/src/1-one/lexicon/compute/index.js
var lexicon = function(view) {
  const world2 = view.world;
  view.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      if (terms[i3].tags.size === 0) {
        let found = null;
        found ||= multi_word_default(terms, i3, world2);
        found ||= single_word_default(terms, i3, world2);
      }
    }
  });
};
var compute_default6 = {
  lexicon
};

// node_modules/compromise/src/1-one/lexicon/methods/expand.js
var expand2 = function(words) {
  const lex = {};
  const _multi = {};
  Object.keys(words).forEach((word) => {
    const tag = words[word];
    word = word.toLowerCase().trim();
    word = word.replace(/'s\b/, "");
    const split3 = word.split(/ /);
    if (split3.length > 1) {
      if (_multi[split3[0]] === void 0 || split3.length > _multi[split3[0]]) {
        _multi[split3[0]] = split3.length;
      }
    }
    lex[word] ||= tag;
  });
  delete lex[""];
  delete lex[null];
  delete lex[" "];
  return { lex, _multi };
};
var expand_default = expand2;

// node_modules/compromise/src/1-one/lexicon/methods/index.js
var methods_default3 = {
  one: {
    expandLexicon: expand_default
  }
};

// node_modules/compromise/src/1-one/lexicon/lib.js
var addWords = function(words, isFrozen = false) {
  const world2 = this.world();
  const { methods: methods19, model: model5 } = world2;
  if (!words) {
    return;
  }
  Object.keys(words).forEach((k2) => {
    if (typeof words[k2] === "string" && words[k2].startsWith("#")) {
      words[k2] = words[k2].replace(/^#/, "");
    }
  });
  if (isFrozen === true) {
    const { lex: lex2, _multi: _multi2 } = methods19.one.expandLexicon(words, world2);
    Object.assign(model5.one._multiCache, _multi2);
    Object.assign(model5.one.frozenLex, lex2);
    return;
  }
  if (methods19.two.expandLexicon) {
    const { lex: lex2, _multi: _multi2 } = methods19.two.expandLexicon(words, world2);
    Object.assign(model5.one.lexicon, lex2);
    Object.assign(model5.one._multiCache, _multi2);
  }
  const { lex, _multi } = methods19.one.expandLexicon(words, world2);
  Object.assign(model5.one.lexicon, lex);
  Object.assign(model5.one._multiCache, _multi);
};
var lib_default = { addWords };

// node_modules/compromise/src/1-one/lexicon/plugin.js
var model2 = {
  one: {
    lexicon: {},
    //setup blank lexicon
    _multiCache: {},
    frozenLex: {}
    //2nd lexicon
  }
};
var plugin_default5 = {
  model: model2,
  methods: methods_default3,
  compute: compute_default6,
  lib: lib_default,
  hooks: ["lexicon"]
};

// node_modules/compromise/src/1-one/lookup/api/buildTrie/index.js
var tokenize = function(phrase, world2) {
  const { methods: methods19, model: model5 } = world2;
  const terms = methods19.one.tokenize.splitTerms(phrase, model5).map((t3) => methods19.one.tokenize.splitWhitespace(t3, model5));
  return terms.map((term) => term.text.toLowerCase());
};
var buildTrie = function(phrases, world2) {
  const goNext = [{}];
  const endAs = [null];
  const failTo = [0];
  const xs = [];
  let n3 = 0;
  phrases.forEach(function(phrase) {
    let curr = 0;
    const words = tokenize(phrase, world2);
    for (let i3 = 0; i3 < words.length; i3++) {
      const word = words[i3];
      if (goNext[curr] && Object.hasOwn(goNext[curr], word)) {
        curr = goNext[curr][word];
      } else {
        n3++;
        goNext[curr][word] = n3;
        goNext[n3] = {};
        curr = n3;
        endAs[n3] = null;
      }
    }
    endAs[curr] = [words.length];
  });
  for (const word in goNext[0]) {
    n3 = goNext[0][word];
    failTo[n3] = 0;
    xs.push(n3);
  }
  while (xs.length > 0) {
    const r2 = xs.shift();
    const keys2 = Object.keys(goNext[r2]);
    for (let i3 = 0; i3 < keys2.length; i3 += 1) {
      const word = keys2[i3];
      const s3 = goNext[r2][word];
      xs.push(s3);
      n3 = failTo[r2];
      while (n3 > 0 && !Object.hasOwn(goNext[n3], word)) {
        n3 = failTo[n3];
      }
      if (Object.hasOwn(goNext, n3)) {
        const fs = goNext[n3][word];
        failTo[s3] = fs;
        if (endAs[fs]) {
          endAs[s3] ||= [];
          endAs[s3] = endAs[s3].concat(endAs[fs]);
        }
      } else {
        failTo[s3] = 0;
      }
    }
  }
  return { goNext, endAs, failTo };
};
var buildTrie_default = buildTrie;

// node_modules/compromise/src/1-one/lookup/api/scan.js
var scanWords = function(terms, trie, opts2) {
  let n3 = 0;
  const results = [];
  for (let i3 = 0; i3 < terms.length; i3++) {
    const word = terms[i3][opts2.form] || terms[i3].normal;
    while (n3 > 0 && (trie.goNext[n3] === void 0 || !Object.hasOwn(trie.goNext[n3], word))) {
      n3 = trie.failTo[n3] || 0;
    }
    if (!Object.hasOwn(trie.goNext[n3], word)) {
      continue;
    }
    n3 = trie.goNext[n3][word];
    if (trie.endAs[n3]) {
      const arr = trie.endAs[n3];
      for (let o2 = 0; o2 < arr.length; o2++) {
        const len = arr[o2];
        const term = terms[i3 - len + 1];
        const [no, start2] = term.index;
        results.push([no, start2, start2 + len, term.id]);
      }
    }
  }
  return results;
};
var cacheMiss = function(words, cache2) {
  for (let i3 = 0; i3 < words.length; i3 += 1) {
    if (cache2.has(words[i3]) === true) {
      return false;
    }
  }
  return true;
};
var scan = function(view, trie, opts2) {
  let results = [];
  opts2.form ||= "normal";
  const docs = view.docs;
  if (!trie.goNext || !trie.goNext[0]) {
    console.error("Compromise invalid lookup trie");
    return view.none();
  }
  const firstWords = Object.keys(trie.goNext[0]);
  for (let i3 = 0; i3 < docs.length; i3++) {
    if (view._cache && view._cache[i3] && cacheMiss(firstWords, view._cache[i3]) === true) {
      continue;
    }
    const terms = docs[i3];
    const found = scanWords(terms, trie, opts2);
    if (found.length > 0) {
      results = results.concat(found);
    }
  }
  return view.update(results);
};
var scan_default = scan;

// node_modules/compromise/src/1-one/lookup/api/index.js
var isObject3 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
function api_default3(View2) {
  View2.prototype.lookup = function(input, opts2 = {}) {
    if (!input) {
      return this.none();
    }
    if (typeof input === "string") {
      input = [input];
    }
    const trie = isObject3(input) ? input : buildTrie_default(input, this.world);
    let res = scan_default(this, trie, opts2);
    res = res.settle();
    return res;
  };
}

// node_modules/compromise/src/1-one/lookup/api/buildTrie/compress.js
var truncate = (list4, val) => {
  for (let i3 = list4.length - 1; i3 >= 0; i3 -= 1) {
    if (list4[i3] !== val) {
      list4 = list4.slice(0, i3 + 1);
      return list4;
    }
  }
  return list4;
};
var compress = function(trie) {
  trie.goNext = trie.goNext.map((o2) => {
    if (Object.keys(o2).length === 0) {
      return void 0;
    }
    return o2;
  });
  trie.goNext = truncate(trie.goNext, void 0);
  trie.failTo = truncate(trie.failTo, 0);
  trie.endAs = truncate(trie.endAs, null);
  return trie;
};
var compress_default = compress;

// node_modules/compromise/src/1-one/lookup/plugin.js
var lib = {
  /** turn an array or object into a compressed trie*/
  buildTrie: function(input) {
    const trie = buildTrie_default(input, this.world());
    return compress_default(trie);
  }
};
lib.compile = lib.buildTrie;
var plugin_default6 = {
  api: api_default3,
  lib
};

// node_modules/compromise/src/1-one/match/api/_lib.js
var relPointer = function(ptrs, parent) {
  if (!parent) {
    return ptrs;
  }
  ptrs.forEach((ptr) => {
    const n3 = ptr[0];
    if (parent[n3]) {
      ptr[0] = parent[n3][0];
      ptr[1] += parent[n3][1];
      ptr[2] += parent[n3][1];
    }
  });
  return ptrs;
};
var fixPointers2 = function(res, parent) {
  let { ptrs } = res;
  const { byGroup } = res;
  ptrs = relPointer(ptrs, parent);
  Object.keys(byGroup).forEach((k2) => {
    byGroup[k2] = relPointer(byGroup[k2], parent);
  });
  return { ptrs, byGroup };
};
var parseRegs = function(regs, opts2, world2) {
  const one = world2.methods.one;
  if (typeof regs === "number") {
    regs = String(regs);
  }
  if (typeof regs === "string") {
    regs = one.killUnicode(regs, world2);
    regs = one.parseMatch(regs, opts2, world2);
  }
  return regs;
};
var isObject4 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var isView = (val) => val && isObject4(val) && val.isView === true;
var isNet = (val) => val && isObject4(val) && val.isNet === true;

// node_modules/compromise/src/1-one/match/api/match.js
var match = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    return this.intersection(regs);
  }
  if (isNet(regs)) {
    return this.sweep(regs, { tagger: false }).view.settle();
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group };
  const res = one.match(this.docs, todo, this._cache);
  const { ptrs, byGroup } = fixPointers2(res, this.fullPointer);
  const view = this.toView(ptrs);
  view._groups = byGroup;
  return view;
};
var matchOne = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    return this.intersection(regs).eq(0);
  }
  if (isNet(regs)) {
    return this.sweep(regs, { tagger: false, matchOne: true }).view;
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group, justOne: true };
  const res = one.match(this.docs, todo, this._cache);
  const { ptrs, byGroup } = fixPointers2(res, this.fullPointer);
  const view = this.toView(ptrs);
  view._groups = byGroup;
  return view;
};
var has = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    const ptrs2 = this.intersection(regs).fullPointer;
    return ptrs2.length > 0;
  }
  if (isNet(regs)) {
    return this.sweep(regs, { tagger: false }).view.found;
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group, justOne: true };
  const ptrs = one.match(this.docs, todo, this._cache).ptrs;
  return ptrs.length > 0;
};
var ifFn = function(regs, group, opts2) {
  const one = this.methods.one;
  if (isView(regs)) {
    return this.filter((m3) => m3.intersection(regs).found);
  }
  if (isNet(regs)) {
    const m3 = this.sweep(regs, { tagger: false }).view.settle();
    return this.if(m3);
  }
  regs = parseRegs(regs, opts2, this.world);
  const todo = { regs, group, justOne: true };
  let ptrs = this.fullPointer;
  const cache2 = this._cache || [];
  ptrs = ptrs.filter((ptr, i3) => {
    const m3 = this.update([ptr]);
    const res = one.match(m3.docs, todo, cache2[i3]).ptrs;
    return res.length > 0;
  });
  const view = this.update(ptrs);
  if (this._cache) {
    view._cache = ptrs.map((ptr) => cache2[ptr[0]]);
  }
  return view;
};
var ifNo = function(regs, group, opts2) {
  const { methods: methods19 } = this;
  const one = methods19.one;
  if (isView(regs)) {
    return this.filter((m3) => !m3.intersection(regs).found);
  }
  if (isNet(regs)) {
    const m3 = this.sweep(regs, { tagger: false }).view.settle();
    return this.ifNo(m3);
  }
  regs = parseRegs(regs, opts2, this.world);
  const cache2 = this._cache || [];
  const view = this.filter((m3, i3) => {
    const todo = { regs, group, justOne: true };
    const ptrs = one.match(m3.docs, todo, cache2[i3]).ptrs;
    return ptrs.length === 0;
  });
  if (this._cache) {
    view._cache = view.ptrs.map((ptr) => cache2[ptr[0]]);
  }
  return view;
};
var match_default = { matchOne, match, has, if: ifFn, ifNo };

// node_modules/compromise/src/1-one/match/api/lookaround.js
var before = function(regs, group, opts2) {
  const { indexN: indexN2 } = this.methods.one.pointer;
  const pre = [];
  const byN = indexN2(this.fullPointer);
  Object.keys(byN).forEach((k2) => {
    const first = byN[k2].sort((a2, b) => a2[1] > b[1] ? 1 : -1)[0];
    if (first[1] > 0) {
      pre.push([first[0], 0, first[1]]);
    }
  });
  const preWords = this.toView(pre);
  if (!regs) {
    return preWords;
  }
  return preWords.match(regs, group, opts2);
};
var after = function(regs, group, opts2) {
  const { indexN: indexN2 } = this.methods.one.pointer;
  const post = [];
  const byN = indexN2(this.fullPointer);
  const document = this.document;
  Object.keys(byN).forEach((k2) => {
    const last = byN[k2].sort((a2, b) => a2[1] > b[1] ? -1 : 1)[0];
    const [n3, , end2] = last;
    if (end2 < document[n3].length) {
      post.push([n3, end2, document[n3].length]);
    }
  });
  const postWords = this.toView(post);
  if (!regs) {
    return postWords;
  }
  return postWords.match(regs, group, opts2);
};
var growLeft = function(regs, group, opts2) {
  if (typeof regs === "string") {
    regs = this.world.methods.one.parseMatch(regs, opts2, this.world);
  }
  regs[regs.length - 1].end = true;
  const ptrs = this.fullPointer;
  this.forEach((m3, n3) => {
    const more = m3.before(regs, group);
    if (more.found) {
      const terms = more.terms();
      ptrs[n3][1] -= terms.length;
      ptrs[n3][3] = terms.docs[0][0].id;
    }
  });
  return this.update(ptrs);
};
var growRight = function(regs, group, opts2) {
  if (typeof regs === "string") {
    regs = this.world.methods.one.parseMatch(regs, opts2, this.world);
  }
  regs[0].start = true;
  const ptrs = this.fullPointer;
  this.forEach((m3, n3) => {
    const more = m3.after(regs, group);
    if (more.found) {
      const terms = more.terms();
      ptrs[n3][2] += terms.length;
      ptrs[n3][4] = null;
    }
  });
  return this.update(ptrs);
};
var grow = function(regs, group, opts2) {
  return this.growRight(regs, group, opts2).growLeft(regs, group, opts2);
};
var lookaround_default = { before, after, growLeft, growRight, grow };

// node_modules/compromise/src/1-one/match/api/split.js
var combine = function(left, right) {
  return [left[0], left[1], right[2]];
};
var getDoc = (reg, view, group) => {
  if (typeof reg === "string" || Array.isArray(reg)) {
    return view.match(reg, group);
  }
  if (!reg) {
    return view.none();
  }
  return reg;
};
var addIds2 = function(ptr, view) {
  const [n3, start2, end2] = ptr;
  if (view.document[n3]?.[start2]) {
    ptr[3] ||= view.document[n3][start2].id;
    if (view.document[n3][end2 - 1]) {
      ptr[4] ||= view.document[n3][end2 - 1].id;
    }
  }
  return ptr;
};
var methods7 = {};
methods7.splitOn = function(m3, group) {
  const { splitAll: splitAll2 } = this.methods.one.pointer;
  const splits = getDoc(m3, this, group).fullPointer;
  const all4 = splitAll2(this.fullPointer, splits);
  let res = [];
  all4.forEach((o2) => {
    res.push(o2.passthrough);
    res.push(o2.before);
    res.push(o2.match);
    res.push(o2.after);
  });
  res = res.filter((p5) => p5);
  res = res.map((p5) => addIds2(p5, this));
  return this.update(res);
};
methods7.splitBefore = function(m3, group) {
  const { splitAll: splitAll2 } = this.methods.one.pointer;
  const splits = getDoc(m3, this, group).fullPointer;
  const all4 = splitAll2(this.fullPointer, splits);
  for (let i3 = 0; i3 < all4.length; i3 += 1) {
    if (!all4[i3].after && all4[i3 + 1]?.before) {
      if (all4[i3].match && all4[i3].match[0] === all4[i3 + 1].before[0]) {
        all4[i3].after = all4[i3 + 1].before;
        delete all4[i3 + 1].before;
      }
    }
  }
  let res = [];
  all4.forEach((o2) => {
    res.push(o2.passthrough);
    res.push(o2.before);
    if (o2.match && o2.after) {
      res.push(combine(o2.match, o2.after));
    } else {
      res.push(o2.match);
    }
  });
  res = res.filter((p5) => p5);
  res = res.map((p5) => addIds2(p5, this));
  return this.update(res);
};
methods7.splitAfter = function(m3, group) {
  const { splitAll: splitAll2 } = this.methods.one.pointer;
  const splits = getDoc(m3, this, group).fullPointer;
  const all4 = splitAll2(this.fullPointer, splits);
  let res = [];
  all4.forEach((o2) => {
    res.push(o2.passthrough);
    if (o2.before && o2.match) {
      res.push(combine(o2.before, o2.match));
    } else {
      res.push(o2.before);
      res.push(o2.match);
    }
    res.push(o2.after);
  });
  res = res.filter((p5) => p5);
  res = res.map((p5) => addIds2(p5, this));
  return this.update(res);
};
methods7.split = methods7.splitAfter;
var split_default = methods7;

// node_modules/compromise/src/1-one/match/api/join.js
var isNeighbour = function(ptrL, ptrR) {
  if (!ptrL || !ptrR) {
    return false;
  }
  if (ptrL[0] !== ptrR[0]) {
    return false;
  }
  return ptrL[2] === ptrR[1];
};
var mergeIf = function(doc, lMatch, rMatch) {
  const world2 = doc.world;
  const parseMatch = world2.methods.one.parseMatch;
  lMatch ||= ".$";
  rMatch ||= "^.";
  const leftMatch = parseMatch(lMatch, {}, world2);
  const rightMatch = parseMatch(rMatch, {}, world2);
  leftMatch[leftMatch.length - 1].end = true;
  rightMatch[0].start = true;
  const ptrs = doc.fullPointer;
  const res = [ptrs[0]];
  for (let i3 = 1; i3 < ptrs.length; i3 += 1) {
    const ptrL = res[res.length - 1];
    const ptrR = ptrs[i3];
    const left = doc.update([ptrL]);
    const right = doc.update([ptrR]);
    if (isNeighbour(ptrL, ptrR) && left.has(leftMatch) && right.has(rightMatch)) {
      res[res.length - 1] = [ptrL[0], ptrL[1], ptrR[2], ptrL[3], ptrR[4]];
    } else {
      res.push(ptrR);
    }
  }
  return doc.update(res);
};
var methods8 = {
  //  merge only if conditions are met
  joinIf: function(lMatch, rMatch) {
    return mergeIf(this, lMatch, rMatch);
  },
  // merge all neighbouring matches
  join: function() {
    return mergeIf(this);
  }
};
var join_default = methods8;

// node_modules/compromise/src/1-one/match/api/index.js
var methods9 = { ...match_default, ...lookaround_default, ...split_default, ...join_default };
methods9.lookBehind = methods9.before;
methods9.lookBefore = methods9.before;
methods9.lookAhead = methods9.after;
methods9.lookAfter = methods9.after;
methods9.notIf = methods9.ifNo;
var matchAPI = function(View2) {
  Object.assign(View2.prototype, methods9);
};
var api_default4 = matchAPI;

// node_modules/compromise/src/1-one/match/methods/parseMatch/splitGroups.js
var prefix2 = new Set("!~[^");
var suffix = new Set("?]+*$~");
var whitespace = /\s/;
var splitGroups = (str) => {
  if (!str.includes("(") || !str.includes(")")) return [str];
  const length2 = str.length;
  const afterSuffix = new Uint32Array(length2 + 1);
  const bodyEnd = new Uint32Array(length2);
  const captureEnd = new Uint32Array(length2);
  afterSuffix[length2] = length2;
  let close = -1;
  let capture = 0;
  for (let i4 = length2 - 1; i4 >= 0; i4--) {
    afterSuffix[i4] = suffix.has(str[i4]) ? afterSuffix[i4 + 1] : i4;
    if (str[i4] === ")") close = i4;
    if (str[i4] === "(" && close >= i4 + 3 && str[close - 1] !== "\\") {
      const end2 = afterSuffix[close + 1];
      if (end2 === length2 || whitespace.test(str[end2])) bodyEnd[i4] = end2;
    }
    if (str[i4] === "<") {
      captureEnd[i4] = capture;
      capture = 0;
    } else if (str[i4] === ">" && !capture && bodyEnd[i4 + 1]) {
      capture = bodyEnd[i4 + 1];
    }
  }
  const parts = [];
  let previous = 0;
  let i3 = 0;
  while (i3 < length2) {
    const start2 = i3;
    while (i3 < length2 && prefix2.has(str[i3])) i3++;
    const end2 = str[i3] === "<" ? captureEnd[i3] : bodyEnd[i3];
    if (end2) {
      parts.push(str.slice(previous, start2), str.slice(start2, end2));
      i3 = end2 < length2 ? end2 + 1 : end2;
      previous = i3;
    } else if (i3 === start2) {
      i3++;
    }
  }
  parts.push(str.slice(previous));
  return parts;
};
var splitGroups_default = splitGroups;

// node_modules/compromise/src/1-one/match/methods/parseMatch/01-parseBlocks.js
var bySlashes = /(?:^|\s)([![^]*(?:<[^<]*>)?\/.*?[^\\/]\/[?\]+*$~]*)(?:\s|$)/;
var byWord = / /g;
var isBlock = (str) => {
  return /^[![^]*(<[^<]*>)?\(/.test(str) && /\)[?\]+*$~]*$/.test(str);
};
var isReg = (str) => {
  return /^[![^]*(<[^<]*>)?\//.test(str) && /\/[?\]+*$~]*$/.test(str);
};
var cleanUp = function(arr) {
  arr = arr.map((str) => str.trim());
  arr = arr.filter((str) => str);
  return arr;
};
var parseBlocks = function(txt) {
  const arr = txt.split(bySlashes);
  let res = [];
  arr.forEach((str) => {
    if (isReg(str)) {
      res.push(str);
      return;
    }
    res = res.concat(splitGroups_default(str));
  });
  res = cleanUp(res);
  let final = [];
  res.forEach((str) => {
    if (isBlock(str)) {
      final.push(str);
    } else if (isReg(str)) {
      final.push(str);
    } else {
      final = final.concat(str.split(byWord));
    }
  });
  final = cleanUp(final);
  return final;
};
var parseBlocks_default = parseBlocks;

// node_modules/compromise/src/1-one/match/methods/parseMatch/02-parseToken.js
var hasMinMax = /\{([0-9]+)?(, *[0-9]*)?\}/;
var andSign = /&&/;
var captureName = /^<\s*([^\s>]+)\s*>/;
var titleCase = (str) => str.charAt(0).toUpperCase() + str.substring(1);
var end = (str) => str.charAt(str.length - 1);
var start = (str) => str.charAt(0);
var stripStart = (str) => str.substring(1);
var stripEnd = (str) => str.substring(0, str.length - 1);
var stripBoth = function(str) {
  str = stripStart(str);
  str = stripEnd(str);
  return str;
};
var parseToken = function(w, opts2) {
  const obj = {};
  for (let i3 = 0; i3 < 2; i3 += 1) {
    if (end(w) === "$") {
      obj.end = true;
      w = stripEnd(w);
    }
    if (start(w) === "^") {
      obj.start = true;
      w = stripStart(w);
    }
    if (end(w) === "?") {
      obj.optional = true;
      w = stripEnd(w);
    }
    if (start(w) === "[" || end(w) === "]") {
      obj.group = null;
      if (start(w) === "[") {
        obj.groupStart = true;
      }
      if (end(w) === "]") {
        obj.groupEnd = true;
      }
      w = w.replace(/^\[/, "");
      w = w.replace(/\]$/, "");
      if (start(w) === "<") {
        const res = captureName.exec(w);
        if (!res) {
          throw new SyntaxError("Invalid named capture: expected [<name> ...]");
        }
        if (res.length >= 2) {
          obj.group = res[1];
          w = w.replace(res[0], "");
        }
      }
    }
    if (end(w) === "+") {
      obj.greedy = true;
      w = stripEnd(w);
    }
    if (w !== "*" && end(w) === "*" && w !== "\\*") {
      obj.greedy = true;
      w = stripEnd(w);
    }
    if (start(w) === "!") {
      obj.negative = true;
      w = stripStart(w);
    }
    if (start(w) === "~" && end(w) === "~" && w.length > 2) {
      w = stripBoth(w);
      obj.fuzzy = true;
      obj.min = opts2.fuzzy ?? 0.85;
      if (/\(/.test(w) === false) {
        obj.word = w;
        return obj;
      }
    }
    if (start(w) === "/" && end(w) === "/") {
      w = stripBoth(w);
      if (opts2.caseSensitive) {
        obj.use = "text";
      }
      obj.regex = new RegExp(w);
      return obj;
    }
    if (hasMinMax.test(w) === true) {
      w = w.replace(hasMinMax, (_a, b, c2) => {
        if (c2 === void 0) {
          obj.min = Number(b);
          obj.max = Number(b);
        } else {
          c2 = c2.replace(/, */, "");
          if (b === void 0) {
            obj.min = 0;
            obj.max = Number(c2);
          } else {
            obj.min = Number(b);
            obj.max = Number(c2 || 999);
          }
        }
        obj.greedy = true;
        if (!obj.min) {
          obj.optional = true;
        }
        return "";
      });
    }
    if (start(w) === "(" && end(w) === ")") {
      if (andSign.test(w)) {
        obj.choices = w.split(andSign);
        obj.operator = "and";
      } else {
        obj.choices = w.split("|");
        obj.operator = "or";
      }
      obj.choices[0] = stripStart(obj.choices[0]);
      const last = obj.choices.length - 1;
      obj.choices[last] = stripEnd(obj.choices[last]);
      obj.choices = obj.choices.map((s3) => s3.trim());
      obj.choices = obj.choices.filter((s3) => s3);
      obj.choices = obj.choices.map((str) => {
        return str.split(/ /g).map((s3) => parseToken(s3, opts2));
      });
      w = "";
    }
    if (start(w) === "{" && end(w) === "}") {
      w = stripBoth(w);
      obj.root = w;
      if (/\//.test(w)) {
        const split3 = obj.root.split(/\//);
        obj.root = split3[0];
        obj.pos = split3[1];
        if (obj.pos === "adj") {
          obj.pos = "Adjective";
        }
        obj.pos = obj.pos.charAt(0).toUpperCase() + obj.pos.substr(1).toLowerCase();
        if (split3[2] !== void 0) {
          obj.sense = split3[2];
        }
      }
      return obj;
    }
    if (start(w) === "<" && end(w) === ">") {
      w = stripBoth(w);
      obj.chunk = titleCase(w);
      obj.greedy = true;
      return obj;
    }
    if (start(w) === "%" && end(w) === "%") {
      w = stripBoth(w);
      obj.switch = w;
      return obj;
    }
  }
  if (start(w) === "#") {
    obj.tag = stripStart(w);
    obj.tag = titleCase(obj.tag);
    return obj;
  }
  if (start(w) === "@") {
    obj.method = stripStart(w);
    return obj;
  }
  if (w === ".") {
    obj.anything = true;
    return obj;
  }
  if (w === "*") {
    obj.anything = true;
    obj.greedy = true;
    obj.optional = true;
    return obj;
  }
  if (w) {
    w = w.replace("\\*", "*");
    w = w.replace("\\.", ".");
    if (opts2.caseSensitive) {
      obj.use = "text";
    } else {
      w = w.toLowerCase();
    }
    obj.word = w;
  }
  return obj;
};
var parseToken_default = parseToken;

// node_modules/compromise/src/1-one/match/methods/parseMatch/03-splitHyphens.js
var hasDash = /[a-z0-9][-–—][a-z]/i;
var splitHyphens = function(regs, world2) {
  const prefixes2 = world2.model.one.prefixes;
  for (let i3 = regs.length - 1; i3 >= 0; i3 -= 1) {
    const reg = regs[i3];
    if (reg.word && hasDash.test(reg.word)) {
      let words = reg.word.split(/[-–—]/g);
      if (Object.hasOwn(prefixes2, words[0])) {
        continue;
      }
      words = words.filter((w) => w).reverse();
      regs.splice(i3, 1);
      words.forEach((w) => {
        const obj = { ...reg };
        obj.word = w;
        regs.splice(i3, 0, obj);
      });
    }
  }
  return regs;
};
var splitHyphens_default = splitHyphens;

// node_modules/compromise/src/1-one/match/methods/parseMatch/04-inflect-root.js
var addVerbs = function(token, world2) {
  const { all: all4 } = world2.methods.two.transform.verb || {};
  const str = token.root;
  if (!all4) {
    return [];
  }
  return all4(str, world2.model);
};
var addNoun = function(token, world2) {
  const { all: all4 } = world2.methods.two.transform.noun || {};
  if (!all4) {
    return [token.root];
  }
  return all4(token.root, world2.model);
};
var addAdjective = function(token, world2) {
  const { all: all4 } = world2.methods.two.transform.adjective || {};
  if (!all4) {
    return [token.root];
  }
  return all4(token.root, world2.model);
};
var inflectRoot = function(regs, world2) {
  regs = regs.map((token) => {
    if (token.root) {
      if (world2.methods.two && world2.methods.two.transform) {
        let choices2 = [];
        if (token.pos) {
          if (token.pos === "Verb") {
            choices2 = choices2.concat(addVerbs(token, world2));
          } else if (token.pos === "Noun") {
            choices2 = choices2.concat(addNoun(token, world2));
          } else if (token.pos === "Adjective") {
            choices2 = choices2.concat(addAdjective(token, world2));
          }
        } else {
          choices2 = choices2.concat(addVerbs(token, world2));
          choices2 = choices2.concat(addNoun(token, world2));
          choices2 = choices2.concat(addAdjective(token, world2));
        }
        choices2 = choices2.filter((str) => str);
        if (choices2.length > 0) {
          token.operator = "or";
          token.fastOr = new Set(choices2);
        }
      } else {
        token.machine = token.root;
        delete token.id;
        delete token.root;
      }
    }
    return token;
  });
  return regs;
};
var inflect_root_default = inflectRoot;

// node_modules/compromise/src/1-one/match/methods/parseMatch/05-postProcess.js
var nameGroups = function(regs) {
  let index3 = 0;
  let inGroup = null;
  for (let i3 = 0; i3 < regs.length; i3++) {
    const token = regs[i3];
    if (token.groupStart === true) {
      inGroup = token.group;
      if (inGroup === null) {
        inGroup = String(index3);
        index3 += 1;
      }
    }
    if (inGroup !== null) {
      token.group = inGroup;
    }
    if (token.groupEnd === true) {
      inGroup = null;
    }
  }
  return regs;
};
var doFastOrMode = function(tokens2) {
  return tokens2.map((token) => {
    if (token.choices !== void 0) {
      if (token.operator !== "or") {
        return token;
      }
      if (token.fuzzy === true) {
        return token;
      }
      const shouldPack = token.choices.every((block) => {
        if (block.length !== 1) {
          return false;
        }
        const reg = block[0];
        if (reg.fuzzy === true) {
          return false;
        }
        if (reg.start || reg.end) {
          return false;
        }
        if (reg.word !== void 0 && reg.negative !== true && reg.optional !== true && reg.method !== true) {
          return true;
        }
        return false;
      });
      if (shouldPack === true) {
        token.fastOr = /* @__PURE__ */ new Set();
        token.choices.forEach((block) => {
          token.fastOr.add(block[0].word);
        });
        delete token.choices;
      }
    }
    return token;
  });
};
var fuzzyOr = function(regs) {
  return regs.map((reg) => {
    if (reg.fuzzy && reg.choices) {
      reg.choices.forEach((r2) => {
        if (r2.length === 1 && r2[0].word) {
          r2[0].fuzzy = true;
          r2[0].min = reg.min;
        }
      });
    }
    return reg;
  });
};
var postProcess = function(regs) {
  regs = nameGroups(regs);
  regs = doFastOrMode(regs);
  regs = fuzzyOr(regs);
  return regs;
};
var postProcess_default = postProcess;

// node_modules/compromise/src/1-one/match/methods/parseMatch/index.js
var syntax = function(input, opts2, world2) {
  if (input === null || input === void 0 || input === "") {
    return [];
  }
  opts2 ||= {};
  if (typeof input === "number") {
    input = String(input);
  }
  let tokens2 = parseBlocks_default(input);
  tokens2 = tokens2.map((str) => parseToken_default(str, opts2));
  tokens2 = splitHyphens_default(tokens2, world2);
  tokens2 = inflect_root_default(tokens2, world2);
  tokens2 = postProcess_default(tokens2, opts2);
  return tokens2;
};
var parseMatch_default = syntax;

// node_modules/compromise/src/1-one/match/methods/match/01-failFast.js
var anyIntersection = function(setA, setB) {
  for (const elem of setB) {
    if (setA.has(elem)) {
      return true;
    }
  }
  return false;
};
var failFast = function(regs, cache2) {
  for (let i3 = 0; i3 < regs.length; i3 += 1) {
    const reg = regs[i3];
    if (reg.optional === true || reg.negative === true || reg.fuzzy === true) {
      continue;
    }
    if (reg.word !== void 0 && cache2.has(reg.word) === false) {
      return true;
    }
    if (reg.tag !== void 0 && cache2.has("#" + reg.tag) === false) {
      return true;
    }
    if (reg.fastOr !== void 0 && anyIntersection(reg.fastOr, cache2) === false) {
      return true;
    }
  }
  return false;
};
var failFast_default = failFast;

// node_modules/compromise/src/1-one/match/methods/match/term/_fuzzy.js
var editDistance = function(strA, strB) {
  const aLength = strA.length, bLength = strB.length;
  if (aLength === 0) {
    return bLength;
  }
  if (bLength === 0) {
    return aLength;
  }
  const limit = (bLength > aLength ? bLength : aLength) + 1;
  if (Math.abs(aLength - bLength) > (limit || 100)) {
    return limit || 100;
  }
  const matrix = [];
  for (let i3 = 0; i3 < limit; i3++) {
    matrix[i3] = [i3];
    matrix[i3].length = limit;
  }
  for (let i3 = 0; i3 < limit; i3++) {
    matrix[0][i3] = i3;
  }
  let j2, a_index, b_index, cost, min2, t3;
  for (let i3 = 1; i3 <= aLength; ++i3) {
    a_index = strA[i3 - 1];
    for (j2 = 1; j2 <= bLength; ++j2) {
      if (i3 === j2 && matrix[i3][j2] > 4) {
        return aLength;
      }
      b_index = strB[j2 - 1];
      cost = a_index === b_index ? 0 : 1;
      min2 = matrix[i3 - 1][j2] + 1;
      if ((t3 = matrix[i3][j2 - 1] + 1) < min2) min2 = t3;
      if ((t3 = matrix[i3 - 1][j2 - 1] + cost) < min2) min2 = t3;
      const shouldUpdate = i3 > 1 && j2 > 1 && a_index === strB[j2 - 2] && strA[i3 - 2] === b_index && (t3 = matrix[i3 - 2][j2 - 2] + cost) < min2;
      if (shouldUpdate) {
        matrix[i3][j2] = t3;
      } else {
        matrix[i3][j2] = min2;
      }
    }
  }
  return matrix[aLength][bLength];
};
var fuzzyMatch = function(strA, strB, minLength = 3) {
  if (strA === strB) {
    return 1;
  }
  if (strA.length < minLength || strB.length < minLength) {
    return 0;
  }
  const steps = editDistance(strA, strB);
  const length2 = Math.max(strA.length, strB.length);
  const relative2 = length2 === 0 ? 0 : steps / length2;
  const similarity = 1 - relative2;
  return similarity;
};
var fuzzy_default = fuzzyMatch;

// node_modules/compromise/src/1-one/match/methods/termMethods.js
var startQuote = /([\u0022\uFF02\u0027\u201C\u2018\u201F\u201B\u201E\u2E42\u201A\u00AB\u2039\u2035\u2036\u2037\u301D\u0060\u301F])/;
var endQuote = /([\u0022\uFF02\u0027\u201D\u2019\u00BB\u203A\u2032\u2033\u2034\u301E\u00B4])/;
var hasHyphen = /^[-–—]$/;
var hasDash2 = / [-–—]{1,3} /;
var hasPost = (term, punct) => term.post.indexOf(punct) !== -1;
var methods10 = {
  /** does it have a quotation symbol?  */
  hasQuote: (term) => startQuote.test(term.pre) || endQuote.test(term.post),
  /** does it have a comma?  */
  hasComma: (term) => hasPost(term, ","),
  /** does it end in a period? */
  hasPeriod: (term) => hasPost(term, ".") === true && hasPost(term, "...") === false,
  /** does it end in an exclamation */
  hasExclamation: (term) => hasPost(term, "!"),
  /** does it end with a question mark? */
  hasQuestionMark: (term) => hasPost(term, "?") || hasPost(term, "\xBF"),
  /** is there a ... at the end? */
  hasEllipses: (term) => hasPost(term, "..") || hasPost(term, "\u2026"),
  /** is there a semicolon after term word? */
  hasSemicolon: (term) => hasPost(term, ";"),
  /** is there a colon after term word? */
  hasColon: (term) => hasPost(term, ":"),
  /** is there a slash '/' in term word? */
  hasSlash: (term) => /\//.test(term.text),
  /** a hyphen connects two words like-term */
  hasHyphen: (term) => hasHyphen.test(term.post) || hasHyphen.test(term.pre),
  /** a dash separates words - like that */
  hasDash: (term) => hasDash2.test(term.post) || hasDash2.test(term.pre),
  /** is it multiple words combinded */
  hasContraction: (term) => Boolean(term.implicit),
  /** is it an acronym */
  isAcronym: (term) => term.tags.has("Acronym"),
  /** does it have any tags */
  isKnown: (term) => term.tags.size > 0,
  /** uppercase first letter, then a lowercase */
  isTitleCase: (term) => /^\p{Lu}[a-z'\u00C0-\u00FF]/u.test(term.text),
  /** uppercase all letters */
  isUpperCase: (term) => /^\p{Lu}+$/u.test(term.text)
};
methods10.hasQuotation = methods10.hasQuote;
var termMethods_default = methods10;

// node_modules/compromise/src/1-one/match/methods/match/term/doesMatch.js
var wrapMatch = function() {
};
var doesMatch = function(term, reg, index3, length2) {
  if (reg.anything === true) {
    return true;
  }
  if (reg.start === true && index3 !== 0) {
    return false;
  }
  if (reg.end === true && index3 !== length2 - 1) {
    return false;
  }
  if (reg.id !== void 0 && reg.id === term.id) {
    return true;
  }
  if (reg.word !== void 0) {
    if (reg.use) {
      return reg.word === term[reg.use];
    }
    if (term.machine !== null && term.machine === reg.word) {
      return true;
    }
    if (reg.fuzzy === true) {
      if (reg.word === term.root) {
        return true;
      }
      const score = fuzzy_default(reg.word, term.normal);
      if (score >= reg.min) {
        return true;
      }
    }
    if (term.alias && term.alias.some((str) => str === reg.word)) {
      return true;
    }
    return reg.word === term.text || reg.word === term.normal;
  }
  if (reg.tag !== void 0) {
    return term.tags.has(reg.tag) === true;
  }
  if (reg.method !== void 0) {
    if (typeof termMethods_default[reg.method] === "function" && termMethods_default[reg.method](term) === true) {
      return true;
    }
    return false;
  }
  if (reg.pre !== void 0) {
    return term.pre && term.pre.includes(reg.pre);
  }
  if (reg.post !== void 0) {
    return term.post && term.post.includes(reg.post);
  }
  if (reg.regex !== void 0) {
    let str = term.normal;
    if (reg.use) {
      str = term[reg.use];
    }
    if (reg.regex.global || reg.regex.sticky) {
      const lastIndex = reg.regex.lastIndex;
      try {
        reg.regex.lastIndex = 0;
        return reg.regex.test(str);
      } finally {
        reg.regex.lastIndex = lastIndex;
      }
    }
    return reg.regex.test(str);
  }
  if (reg.chunk !== void 0) {
    return term.chunk === reg.chunk;
  }
  if (reg.switch !== void 0) {
    return term.switch === reg.switch;
  }
  if (reg.machine !== void 0) {
    return term.normal === reg.machine || term.machine === reg.machine || term.root === reg.machine;
  }
  if (reg.sense !== void 0) {
    return term.sense === reg.sense;
  }
  if (reg.fastOr !== void 0) {
    if (reg.pos && !term.tags.has(reg.pos)) {
      return null;
    }
    const str = term.root || term.implicit || term.machine || term.normal;
    return reg.fastOr.has(str) || reg.fastOr.has(term.text);
  }
  if (reg.choices !== void 0) {
    if (reg.operator === "and") {
      return reg.choices.every((r2) => wrapMatch(term, r2, index3, length2));
    }
    return reg.choices.some((r2) => wrapMatch(term, r2, index3, length2));
  }
  return false;
};
wrapMatch = function(t3, reg, index3, length2) {
  const result = doesMatch(t3, reg, index3, length2);
  if (reg.negative === true) {
    return !result;
  }
  return result;
};
var doesMatch_default = wrapMatch;

// node_modules/compromise/src/1-one/match/methods/match/steps/logic/greedy.js
var getGreedy = function(state, endReg) {
  const reg = { ...state.regs[state.r], start: false, end: false };
  const start2 = state.t;
  for (; state.t < state.terms.length; state.t += 1) {
    const count = state.t - start2 + 1;
    if (endReg && doesMatch_default(state.terms[state.t], endReg, state.start_i + state.t, state.phrase_length)) {
      if (reg.min === void 0 || count >= reg.min) {
        return state.t;
      }
    }
    if (reg.max !== void 0 && count === reg.max) {
      return state.t;
    }
    if (doesMatch_default(state.terms[state.t], reg, state.start_i + state.t, state.phrase_length) === false) {
      if (reg.min !== void 0 && count < reg.min) {
        return null;
      }
      return state.t;
    }
  }
  if (reg.min !== void 0 && state.t - start2 + 1 < reg.min) {
    return null;
  }
  return state.t;
};
var greedyTo = function(state, nextReg) {
  let t3 = state.t;
  if (!nextReg) {
    return state.terms.length;
  }
  for (; t3 < state.terms.length; t3 += 1) {
    if (doesMatch_default(state.terms[t3], nextReg, state.start_i + t3, state.phrase_length) === true) {
      return t3;
    }
  }
  return null;
};
var isEndGreedy = function(reg, state) {
  if (reg.end === true && reg.greedy === true) {
    if (state.start_i + state.t < state.phrase_length - 1) {
      const tmpReg = { ...reg, end: false };
      if (doesMatch_default(state.terms[state.t], tmpReg, state.start_i + state.t, state.phrase_length) === true) {
        return true;
      }
    }
  }
  return false;
};

// node_modules/compromise/src/1-one/match/methods/match/_lib.js
var getGroup = function(state, term_index) {
  if (!state.groups) {
    state.groups = {};
  }
  if (state.groups[state.inGroup]) {
    return state.groups[state.inGroup];
  }
  state.groups[state.inGroup] = {
    start: term_index,
    length: 0
  };
  return state.groups[state.inGroup];
};

// node_modules/compromise/src/1-one/match/methods/match/steps/astrix.js
var doAstrix = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const skipto = greedyTo(state, regs[state.r + 1]);
  if (skipto === null || skipto === state.offset) {
    return null;
  }
  if (reg.min !== void 0 && skipto - state.t < reg.min) {
    return null;
  }
  if (reg.max !== void 0 && skipto - state.t > reg.max) {
    state.t = state.t + reg.max;
    return true;
  }
  if (state.hasGroup === true) {
    const g4 = getGroup(state, state.t);
    g4.length += skipto - state.t;
  }
  state.t = skipto;
  return true;
};
var astrix_default = doAstrix;

// node_modules/compromise/src/1-one/match/methods/match/steps/logic/and-or.js
var tryChoice = function(state, regs, skipN) {
  let len = 0;
  for (let w = 0; w < regs.length; w += 1) {
    const cr = regs[w];
    const t3 = state.t + skipN + len;
    if (state.terms[t3] === void 0) {
      return 0;
    }
    if (doesMatch_default(state.terms[t3], cr, state.start_i + t3, state.phrase_length) !== true) {
      return 0;
    }
    len += 1;
    if (cr.greedy === true) {
      const gr = { ...cr, start: false, end: false };
      for (let i3 = t3 + 1; i3 < state.terms.length; i3 += 1) {
        if (doesMatch_default(state.terms[i3], gr, state.start_i + i3, state.phrase_length) !== true) {
          break;
        }
        len += 1;
      }
    }
  }
  return len;
};
var tryChoices = function(state, skipN) {
  const block = state.regs[state.r];
  for (let c2 = 0; c2 < block.choices.length; c2 += 1) {
    const regs = block.choices[c2];
    if (!Array.isArray(regs)) {
      return 0;
    }
    const len = tryChoice(state, regs, skipN);
    if (len > 0) {
      return len;
    }
  }
  return 0;
};
var doOrBlock = function(state) {
  const block = state.regs[state.r];
  let skipN = tryChoices(state, 0);
  if (skipN === 0) {
    return 0;
  }
  if (block.greedy === true) {
    let more = tryChoices(state, skipN);
    while (more > 0) {
      skipN += more;
      more = tryChoices(state, skipN);
    }
  }
  return skipN;
};
var doAndBlock = function(state) {
  let longest = 0;
  const reg = state.regs[state.r];
  const allDidMatch = reg.choices.every((block) => {
    const allWords = block.every((cr, w_index) => {
      const tryTerm = state.t + w_index;
      if (state.terms[tryTerm] === void 0) {
        return false;
      }
      return doesMatch_default(state.terms[tryTerm], cr, state.start_i + tryTerm, state.phrase_length);
    });
    if (allWords === true && block.length > longest) {
      longest = block.length;
    }
    return allWords;
  });
  if (allDidMatch === true) {
    return longest;
  }
  return false;
};

// node_modules/compromise/src/1-one/match/methods/match/steps/or-block.js
var orBlock = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const skipNum = doOrBlock(state);
  if (skipNum) {
    if (reg.negative === true) {
      return null;
    }
    if (state.hasGroup === true) {
      const g4 = getGroup(state, state.t);
      g4.length += skipNum;
    }
    if (reg.end === true) {
      const end2 = state.phrase_length;
      if (state.t + state.start_i + skipNum !== end2) {
        return null;
      }
    }
    state.t += skipNum;
    return true;
  }
  if (reg.negative === true) {
    if (!reg.optional) {
      state.t += 1;
    }
    return true;
  }
  if (!reg.optional) {
    return null;
  }
  return true;
};
var or_block_default = orBlock;

// node_modules/compromise/src/1-one/match/methods/match/steps/and-block.js
var andBlock = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const skipNum = doAndBlock(state);
  if (skipNum) {
    if (reg.negative === true) {
      return null;
    }
    if (state.hasGroup === true) {
      const g4 = getGroup(state, state.t);
      g4.length += skipNum;
    }
    if (reg.end === true) {
      const end2 = state.phrase_length;
      if (state.t + state.start_i + skipNum !== end2) {
        return null;
      }
    }
    state.t += skipNum;
    return true;
  }
  if (reg.negative === true) {
    if (!reg.optional) {
      state.t += 1;
    }
    return true;
  }
  if (!reg.optional) {
    return null;
  }
  return true;
};
var and_block_default = andBlock;

// node_modules/compromise/src/1-one/match/methods/match/steps/logic/negative-greedy.js
var negGreedy = function(state, reg, nextReg) {
  let skip = 0;
  for (let t3 = state.t; t3 < state.terms.length; t3 += 1) {
    let found = doesMatch_default(state.terms[t3], reg, state.start_i + t3, state.phrase_length);
    if (found) {
      break;
    }
    if (nextReg) {
      found = doesMatch_default(state.terms[t3], nextReg, state.start_i + t3, state.phrase_length);
      if (found) {
        break;
      }
    }
    skip += 1;
    if (reg.max !== void 0 && skip === reg.max) {
      break;
    }
  }
  if (skip === 0) {
    return false;
  }
  if (reg.min && reg.min > skip) {
    return false;
  }
  state.t += skip;
  return true;
};
var negative_greedy_default = negGreedy;

// node_modules/compromise/src/1-one/match/methods/match/steps/negative.js
var doNegative = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const tmpReg = { ...reg };
  tmpReg.negative = false;
  const found = doesMatch_default(state.terms[state.t], tmpReg, state.start_i + state.t, state.phrase_length);
  if (found) {
    return false;
  }
  if (reg.optional) {
    const nextReg = regs[state.r + 1];
    if (nextReg) {
      const fNext = doesMatch_default(state.terms[state.t], nextReg, state.start_i + state.t, state.phrase_length);
      if (fNext) {
        state.r += 1;
      } else if (nextReg.optional && regs[state.r + 2]) {
        const fNext2 = doesMatch_default(state.terms[state.t], regs[state.r + 2], state.start_i + state.t, state.phrase_length);
        if (fNext2) {
          state.r += 2;
        }
      }
    }
  }
  if (reg.greedy) {
    return negative_greedy_default(state, tmpReg, regs[state.r + 1]);
  }
  state.t += 1;
  return true;
};
var negative_default = doNegative;

// node_modules/compromise/src/1-one/match/methods/match/steps/optional-match.js
var foundOptional = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const term = state.terms[state.t];
  const nextRegMatched = doesMatch_default(term, regs[state.r + 1], state.start_i + state.t, state.phrase_length);
  if (reg.negative || nextRegMatched) {
    const nextTerm = state.terms[state.t + 1];
    if (!nextTerm || !doesMatch_default(nextTerm, regs[state.r + 1], state.start_i + state.t + 1, state.phrase_length)) {
      state.r += 1;
    }
  }
};
var optional_match_default = foundOptional;

// node_modules/compromise/src/1-one/match/methods/match/steps/greedy-match.js
var greedyMatch = function(state) {
  const { regs, phrase_length } = state;
  const reg = regs[state.r];
  state.t = getGreedy(state, regs[state.r + 1]);
  if (state.t === null) {
    return null;
  }
  if (reg.end === true && state.start_i + state.t !== phrase_length) {
    return null;
  }
  return true;
};
var greedy_match_default = greedyMatch;

// node_modules/compromise/src/1-one/match/methods/match/steps/contraction-skip.js
var contractionSkip = function(state) {
  const term = state.terms[state.t];
  const reg = state.regs[state.r];
  if (term.implicit && state.terms[state.t + 1]) {
    const nextTerm = state.terms[state.t + 1];
    if (!nextTerm.implicit) {
      return;
    }
    if (reg.word === term.normal) {
      state.t += 1;
    }
    if (reg.method === "hasContraction") {
      state.t += 1;
    }
  }
};
var contraction_skip_default = contractionSkip;

// node_modules/compromise/src/1-one/match/methods/match/steps/simple-match.js
var setGroup = function(state, startAt) {
  const reg = state.regs[state.r];
  const g4 = getGroup(state, startAt);
  if (state.t - state.offset > 1 && reg.greedy) {
    g4.length += state.t - startAt;
  } else {
    g4.length++;
  }
};
var simpleMatch = function(state) {
  const { regs } = state;
  const reg = regs[state.r];
  const term = state.terms[state.t];
  const startAt = state.t;
  if (reg.optional && regs[state.r + 1] && reg.negative) {
    return true;
  }
  if (reg.optional && regs[state.r + 1]) {
    optional_match_default(state);
  }
  if (term.implicit && state.terms[state.t + 1]) {
    contraction_skip_default(state);
  }
  state.t += 1;
  if (reg.end === true && state.t !== state.terms.length && reg.greedy !== true) {
    return null;
  }
  if (reg.greedy === true) {
    const alive = greedy_match_default(state);
    if (!alive) {
      return null;
    }
  }
  if (state.hasGroup === true) {
    setGroup(state, startAt);
  }
  return true;
};
var simple_match_default = simpleMatch;

// node_modules/compromise/src/1-one/match/methods/match/02-from-here.js
var tryHere = function(terms, regs, start_i, phrase_length, offset2 = 0) {
  if (offset2 >= terms.length || regs.length === 0) {
    return null;
  }
  const origin = start_i - offset2;
  const state = {
    t: offset2,
    offset: offset2,
    terms,
    r: 0,
    regs,
    groups: null,
    start_i: origin,
    phrase_length,
    inGroup: null
  };
  for (; state.r < regs.length; state.r += 1) {
    const reg = regs[state.r];
    state.hasGroup = Boolean(reg.group);
    if (state.hasGroup === true) {
      state.inGroup = reg.group;
    } else {
      state.inGroup = null;
    }
    if (!state.terms[state.t]) {
      const alive = regs.slice(state.r).some((remain) => !remain.optional);
      if (alive === false) {
        break;
      }
      return null;
    }
    if (reg.anything === true && reg.greedy === true) {
      const alive = astrix_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.choices !== void 0 && reg.operator === "or") {
      const alive = or_block_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.choices !== void 0 && reg.operator === "and") {
      const alive = and_block_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.anything === true) {
      if (reg.negative && reg.anything) {
        return null;
      }
      const alive = simple_match_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (isEndGreedy(reg, state) === true) {
      const alive = simple_match_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.negative) {
      const alive = negative_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    const hasMatch = doesMatch_default(state.terms[state.t], reg, state.start_i + state.t, state.phrase_length);
    if (hasMatch === true) {
      const alive = simple_match_default(state);
      if (!alive) {
        return null;
      }
      continue;
    }
    if (reg.optional === true) {
      continue;
    }
    return null;
  }
  const pntr = [null, start_i, state.t + origin];
  if (pntr[1] === pntr[2]) {
    return null;
  }
  const groups2 = {};
  if (state.groups) {
    Object.keys(state.groups).forEach((k2) => {
      const o2 = state.groups[k2];
      const start2 = origin + o2.start;
      groups2[k2] = [null, start2, start2 + o2.length];
    });
  }
  return { pointer: pntr, groups: groups2 };
};
var from_here_default = tryHere;

// node_modules/compromise/src/1-one/match/methods/match/03-getGroup.js
var getGroup2 = function(res, group) {
  const ptrs = [];
  const byGroup = {};
  if (res.length === 0) {
    return { ptrs, byGroup };
  }
  if (typeof group === "number") {
    group = String(group);
  }
  if (group) {
    res.forEach((r2) => {
      if (r2.groups[group]) {
        ptrs.push(r2.groups[group]);
      }
    });
  } else {
    res.forEach((r2) => {
      ptrs.push(r2.pointer);
      Object.keys(r2.groups).forEach((k2) => {
        byGroup[k2] ||= [];
        byGroup[k2].push(r2.groups[k2]);
      });
    });
  }
  return { ptrs, byGroup };
};
var getGroup_default = getGroup2;

// node_modules/compromise/src/1-one/match/methods/match/03-notIf.js
var notIf = function(results, not, docs) {
  results = results.filter((res) => {
    const [n3, start2, end2] = res.pointer;
    const terms = docs[n3].slice(start2, end2);
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const found = from_here_default(terms, not, i3, terms.length, i3);
      if (found !== null) {
        return false;
      }
    }
    return true;
  });
  return results;
};
var notIf_default = notIf;

// node_modules/compromise/src/1-one/match/methods/match/_fixed.js
var isFixed = (regs) => regs.every((reg) => !reg.optional && !reg.greedy && !reg.negative && !reg.choices && !reg.anything && (reg.word !== void 0 || reg.tag !== void 0 || reg.switch !== void 0 || reg.fastOr !== void 0));
var fromFixed = (terms, regs, start2, length2, offset2 = 0) => {
  if (offset2 + regs.length > terms.length) {
    return null;
  }
  for (let r2 = 0; r2 < regs.length; r2 += 1) {
    const term = terms[offset2 + r2];
    if (term.implicit) {
      return from_here_default(terms, regs, start2, length2, offset2);
    }
    if (doesMatch_default(term, regs[r2], start2 + r2, length2) !== true) {
      return null;
    }
  }
  const groups2 = {};
  for (let r2 = 0; r2 < regs.length; r2 += 1) {
    const name = regs[r2].group;
    if (name) {
      if (!groups2[name]) {
        groups2[name] = [null, start2 + r2, start2 + r2];
      }
      groups2[name][2] += 1;
    }
  }
  return { pointer: [null, start2, start2 + regs.length], groups: groups2 };
};

// node_modules/compromise/src/1-one/match/methods/match/index.js
var addSentence = function(res, n3) {
  res.pointer[0] = n3;
  Object.keys(res.groups).forEach((k2) => {
    res.groups[k2][0] = n3;
  });
  return res;
};
var handleStart = function(terms, regs, n3, attempt) {
  let res = attempt(terms, regs, 0, terms.length);
  if (res) {
    res = addSentence(res, n3);
    return res;
  }
  return null;
};
var runMatch = function(docs, todo, cache2) {
  cache2 ||= [];
  const { regs, group, justOne, checkFirst } = todo;
  let results = [];
  if (!regs || regs.length === 0) {
    return { ptrs: [], byGroup: {} };
  }
  const attempt = todo.fixed ?? isFixed(regs) ? fromFixed : from_here_default;
  let minLength = todo.minLength;
  if (minLength === void 0) {
    minLength = 0;
    for (let i3 = 0; i3 < regs.length; i3 += 1) {
      const reg = regs[i3];
      if (reg.optional !== true && reg.negative !== true) {
        minLength += 1;
      }
    }
  }
  docs: for (let n3 = 0; n3 < docs.length; n3 += 1) {
    const terms = docs[n3];
    if (cache2[n3] && failFast_default(regs, cache2[n3])) {
      continue;
    }
    if (regs[0].start === true) {
      const foundStart = handleStart(terms, regs, n3, attempt);
      if (foundStart) {
        results.push(foundStart);
      }
      continue;
    }
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      if (terms.length - i3 < minLength) {
        break;
      }
      if (checkFirst && !doesMatch_default(terms[i3], regs[0], i3, terms.length)) {
        continue;
      }
      let res = attempt(terms, regs, i3, terms.length, i3);
      if (res) {
        res = addSentence(res, n3);
        results.push(res);
        if (justOne === true) {
          break docs;
        }
        const end2 = res.pointer[2];
        if (Math.abs(end2 - 1) > i3) {
          i3 = Math.abs(end2 - 1);
        }
      }
    }
  }
  if (regs[regs.length - 1].end === true) {
    results = results.filter((res) => {
      const n3 = res.pointer[0];
      return docs[n3].length === res.pointer[2];
    });
  }
  if (todo.notIf) {
    results = notIf_default(results, todo.notIf, docs);
  }
  results = getGroup_default(results, group);
  results.ptrs.forEach((ptr) => {
    const [n3, start2, end2] = ptr;
    ptr[3] = docs[n3][start2].id;
    ptr[4] = docs[n3][end2 - 1].id;
  });
  return results;
};
var match_default2 = runMatch;

// node_modules/compromise/src/1-one/match/methods/index.js
var methods11 = {
  one: {
    termMethods: termMethods_default,
    parseMatch: parseMatch_default,
    match: match_default2
  }
};
var methods_default4 = methods11;

// node_modules/compromise/src/1-one/match/lib.js
var lib_default2 = {
  /** pre-parse any match statements */
  parseMatch: function(str, opts2) {
    const world2 = this.world();
    const killUnicode2 = world2.methods.one.killUnicode;
    if (killUnicode2) {
      str = killUnicode2(str, world2);
    }
    return world2.methods.one.parseMatch(str, opts2, world2);
  }
};

// node_modules/compromise/src/1-one/match/plugin.js
var plugin_default7 = {
  api: api_default4,
  methods: methods_default4,
  lib: lib_default2
};

// node_modules/compromise/src/1-one/output/api/html.js
var isClass = /^\../;
var isId = /^#./;
var escapeXml = (str) => {
  str = str.replaceAll("&", "&amp;");
  str = str.replaceAll("<", "&lt;");
  str = str.replaceAll(">", "&gt;");
  str = str.replaceAll('"', "&quot;");
  str = str.replaceAll("'", "&apos;");
  return str;
};
var toTag = function(k2) {
  let start2 = "";
  let end2 = "</span>";
  k2 = escapeXml(k2);
  if (isClass.test(k2)) {
    start2 = `<span class="${k2.replace(/^\./, "")}"`;
  } else if (isId.test(k2)) {
    start2 = `<span id="${k2.replace(/^#/, "")}"`;
  } else {
    start2 = `<${k2}`;
    end2 = `</${k2}>`;
  }
  start2 += ">";
  return { start: start2, end: end2 };
};
var getIndex = function(doc, obj) {
  const starts = {};
  const ends = {};
  Object.keys(obj).forEach((k2) => {
    let res = obj[k2];
    const tag = toTag(k2);
    if (typeof res === "string") {
      res = doc.match(res);
    }
    res.docs.forEach((terms) => {
      if (terms.every((t3) => t3.implicit)) {
        return;
      }
      const a2 = terms[0].id;
      starts[a2] ||= [];
      starts[a2].push(tag.start);
      const b = terms.at(-1).id;
      ends[b] ||= [];
      ends[b].push(tag.end);
    });
  });
  return { starts, ends };
};
var html = function(obj) {
  const { starts, ends } = getIndex(this, obj);
  let out2 = "";
  this.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const t3 = terms[i3];
      if (Object.hasOwn(starts, t3.id)) {
        out2 += starts[t3.id].join("");
      }
      out2 += t3.pre || "";
      out2 += t3.text || "";
      if (Object.hasOwn(ends, t3.id)) {
        out2 += ends[t3.id].join("");
      }
      out2 += t3.post || "";
    }
  });
  return out2;
};
var html_default = { html };

// node_modules/compromise/src/1-one/output/api/_text.js
var endPunctuation = /[,:;)\]*.?~!\u0022\uFF02\u201D\u2019\u00BB\u203A\u2032\u2033\u2034\u301E\u00B4—-]/;
var trimEnd = (str) => {
  let end2 = str.length;
  while (end2 > 0 && endPunctuation.test(str[end2 - 1])) end2--;
  return str.slice(0, end2);
};
var trimStart = /^[(['"*~\uFF02\u201C\u2018\u201F\u201B\u201E\u2E42\u201A\u00AB\u2039\u2035\u2036\u2037\u301D\u0060\u301F]+/;
var punctToKill = /[,:;)('"\u201D\]]/;
var isHyphen = /^[-–—]$/;
var hasSpace = / /;
var textFromTerms = function(terms, opts2, keepSpace = true) {
  let txt = "";
  terms.forEach((t3) => {
    let pre = t3.pre || "";
    let post = t3.post || "";
    if (opts2.punctuation === "some") {
      pre = pre.replace(trimStart, "");
      if (isHyphen.test(post)) {
        post = " ";
      }
      post = post.replace(punctToKill, "");
      post = post.replace(/\?!+/, "?");
      post = post.replace(/!+/, "!");
      post = post.replace(/\?+/, "?");
      post = post.replace(/\.{2,}/, "");
      if (t3.tags.has("Abbreviation")) {
        post = post.replace(/\./, "");
      }
    }
    if (opts2.whitespace === "some") {
      pre = pre.replace(/\s/, "");
      post = post.replace(/\s+/, " ");
    }
    if (!opts2.keepPunct) {
      pre = pre.replace(trimStart, "");
      if (post === "-") {
        post = " ";
      } else {
        post = trimEnd(post);
      }
    }
    let word = t3[opts2.form || "text"] || t3.normal || "";
    if (opts2.form === "implicit") {
      word = t3.implicit || t3.text;
    }
    if (opts2.form === "root" && t3.implicit) {
      word = t3.root || t3.implicit || t3.normal;
    }
    if ((opts2.form === "machine" || opts2.form === "implicit" || opts2.form === "root") && t3.implicit) {
      if (!post || !hasSpace.test(post)) {
        post += " ";
      }
    }
    txt += pre + word + post;
  });
  if (keepSpace === false) {
    txt = txt.trim();
  }
  if (opts2.lowerCase === true) {
    txt = txt.toLowerCase();
  }
  return txt;
};
var textFromDoc = function(docs, opts2) {
  let text6 = "";
  if (!docs || !docs[0] || !docs[0][0]) {
    return text6;
  }
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    text6 += textFromTerms(docs[i3], opts2, true);
  }
  if (!opts2.keepSpace) {
    text6 = text6.trim();
  }
  if (opts2.keepEndPunct === false) {
    if (!docs[0][0].tags.has("Emoticon")) {
      text6 = text6.replace(trimStart, "");
    }
    const last = docs.at(-1);
    if (!last.at(-1).tags.has("Emoticon")) {
      text6 = trimEnd(text6);
    }
    if (text6.endsWith(`'`) && !text6.endsWith(`s'`)) {
      text6 = text6.replace(/'/, "");
    }
  }
  if (opts2.cleanWhitespace === true) {
    text6 = text6.trim();
  }
  return text6;
};

// node_modules/compromise/src/1-one/output/api/_fmts.js
var fmts = {
  text: {
    form: "text"
  },
  normal: {
    whitespace: "some",
    punctuation: "some",
    case: "some",
    unicode: "some",
    form: "normal"
  },
  machine: {
    keepSpace: false,
    whitespace: "some",
    punctuation: "some",
    case: "none",
    unicode: "some",
    form: "machine"
  },
  root: {
    keepSpace: false,
    whitespace: "some",
    punctuation: "some",
    case: "some",
    unicode: "some",
    form: "root"
  },
  implicit: {
    form: "implicit"
  }
};
fmts.clean = fmts.normal;
fmts.reduced = fmts.root;
var fmts_default = fmts;

// node_modules/compromise/src/1-one/output/methods/hash.js
var k = [];
var i = 0;
for (; i < 64; i++) {
  k[i] = 0 | Math.sin((i + 1) % Math.PI) * 4294967296;
}
var md5 = function(s3) {
  let b, c2, d2, j2 = decodeURI(encodeURI(s3)) + "\x80", a2 = j2.length;
  const h2 = [b = 1732584193, c2 = 4023233417, ~b, ~c2], words = [];
  s3 = --a2 / 4 + 2 | 15;
  words[--s3] = a2 * 8;
  for (; ~a2; ) {
    words[a2 >> 2] |= j2.charCodeAt(a2) << 8 * a2--;
  }
  for (i = j2 = 0; i < s3; i += 16) {
    a2 = h2;
    for (; j2 < 64; a2 = [
      d2 = a2[3],
      b + ((d2 = a2[0] + [b & c2 | ~b & d2, d2 & b | ~d2 & c2, b ^ c2 ^ d2, c2 ^ (b | ~d2)][a2 = j2 >> 4] + k[j2] + ~~words[i | [j2, 5 * j2 + 1, 3 * j2 + 5, 7 * j2][a2] & 15]) << (a2 = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * a2 + j2++ % 4]) | d2 >>> -a2),
      b,
      c2
    ]) {
      b = a2[1] | 0;
      c2 = a2[2];
    }
    for (j2 = 4; j2; ) h2[--j2] += a2[j2];
  }
  for (s3 = ""; j2 < 32; ) {
    s3 += (h2[j2 >> 3] >> (1 ^ j2++) * 4 & 15).toString(16);
  }
  return s3;
};
var hash_default = md5;

// node_modules/compromise/src/1-one/output/api/json.js
var defaults = {
  text: true,
  terms: true
};
var opts = { case: "none", unicode: "some", form: "machine", punctuation: "some" };
var merge = function(a2, b) {
  return { ...a2, ...b };
};
var fns4 = {
  text: (terms) => textFromTerms(terms, { keepPunct: true }, false),
  normal: (terms) => textFromTerms(terms, merge(fmts_default.normal, { keepPunct: true }), false),
  implicit: (terms) => textFromTerms(terms, merge(fmts_default.implicit, { keepPunct: true }), false),
  machine: (terms) => textFromTerms(terms, opts, false),
  root: (terms) => textFromTerms(terms, merge(opts, { form: "root" }), false),
  hash: (terms) => hash_default(textFromTerms(terms, { keepPunct: true }, false)),
  offset: (terms) => {
    const len = fns4.text(terms).length;
    return {
      index: terms[0].offset.index,
      start: terms[0].offset.start,
      length: len
    };
  },
  terms: (terms) => {
    return terms.map((t3) => ({ ...t3, tags: [...t3.tags] }));
  },
  confidence: (_terms, view, i3) => view.eq(i3).confidence(),
  syllables: (_terms, view, i3) => view.eq(i3).syllables(),
  sentence: (_terms, view, i3) => view.eq(i3).fullSentence().text(),
  dirty: (terms) => terms.some((t3) => t3.dirty === true)
};
fns4.sentences = fns4.sentence;
fns4.clean = fns4.normal;
fns4.reduced = fns4.root;
var toJSON = function(view, option) {
  option ||= {};
  if (typeof option === "string") {
    option = {};
  }
  option = { ...defaults, ...option };
  if (option.offset) {
    view.compute("offset");
  }
  return view.docs.map((terms, i3) => {
    const res = {};
    Object.keys(option).forEach((k2) => {
      if (option[k2] && fns4[k2]) {
        res[k2] = fns4[k2](terms, view, i3);
      }
    });
    return res;
  });
};
var methods12 = {
  /** return data */
  json: function(n3) {
    const res = toJSON(this, n3);
    if (typeof n3 === "number") {
      return res[n3];
    }
    return res;
  }
};
methods12.data = methods12.json;
var json_default = methods12;

// node_modules/compromise/src/1-one/output/api/debug.js
var isClientSide = () => typeof window !== "undefined" && window.document;
var debug3 = function(fmt2) {
  const debugMethods = this.methods.one.debug || {};
  if (fmt2 && Object.hasOwn(debugMethods, fmt2)) {
    debugMethods[fmt2](this);
    return this;
  }
  if (isClientSide()) {
    debugMethods.clientSide(this);
    return this;
  }
  debugMethods.tags(this);
  return this;
};
var debug_default3 = debug3;

// node_modules/compromise/src/1-one/output/api/wrap.js
var toText = function(term) {
  const pre = term.pre || "";
  const post = term.post || "";
  return pre + term.text + post;
};
var findStarts = function(doc, obj) {
  const starts = {};
  Object.keys(obj).forEach((reg) => {
    const m3 = doc.match(reg);
    m3.fullPointer.forEach((a2) => {
      starts[a2[3]] = { fn: obj[reg], end: a2[2] };
    });
  });
  return starts;
};
var wrap = function(doc, obj) {
  const starts = findStarts(doc, obj);
  let text6 = "";
  doc.docs.forEach((terms, n3) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const t3 = terms[i3];
      if (Object.hasOwn(starts, t3.id)) {
        const { fn, end: end2 } = starts[t3.id];
        const m3 = doc.update([[n3, i3, end2]]);
        text6 += terms[i3].pre || "";
        text6 += fn(m3);
        i3 = end2 - 1;
        text6 += terms[i3].post || "";
      } else {
        text6 += toText(t3);
      }
    }
  });
  return text6;
};
var wrap_default = wrap;

// node_modules/compromise/src/1-one/output/api/_spec.js
var attributeTags = /* @__PURE__ */ new Set(["Hyphenated", "Prefix", "SlashedTerm"]);
var rootOf = function(tag, tagSet) {
  const entry = tagSet[tag];
  if (!entry || !entry.parents || entry.parents.length === 0) {
    return tag;
  }
  for (let i3 = 0; i3 < entry.parents.length; i3 += 1) {
    const p5 = entry.parents[i3];
    if (tagSet[p5] && (!tagSet[p5].parents || tagSet[p5].parents.length === 0)) {
      return p5;
    }
  }
  return entry.parents.at(-1);
};
var slotForTerm = function(term, tagSet) {
  const tags2 = Array.from(term.tags || []);
  if (tags2.length === 0) {
    return "-";
  }
  const primary = tags2.find((t3) => !attributeTags.has(rootOf(t3, tagSet))) || tags2[0];
  return rootOf(primary, tagSet);
};
var makeAliases = function(tagSet) {
  const aliases3 = {};
  for (const tag in tagSet) {
    const entry = tagSet[tag];
    if (entry.alias) {
      aliases3[tag] = entry.alias;
    }
  }
  return aliases3;
};
var toSpec = function(doc, world2) {
  const tagSet = world2.model.one.tagSet;
  const aliases3 = makeAliases(tagSet);
  return doc.docs.map((terms) => {
    const text6 = terms.reduce((str, t3) => str + t3.pre + t3.text + t3.post, "").trim();
    const tags2 = terms.map((t3) => {
      const tag = slotForTerm(t3, tagSet);
      return aliases3[tag] || tag;
    }).join(",");
    return `${text6} {${tags2}}`;
  }).join("\n");
};
var spec_default = toSpec;

// node_modules/compromise/src/1-one/output/api/out.js
var isObject5 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var topk = function(arr) {
  const counts = /* @__PURE__ */ new Map();
  arr.forEach((word) => {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  });
  const res = Array.from(counts, ([normal, count]) => ({ normal, count }));
  return res.sort((a2, b) => b.count - a2.count);
};
var out = function(method) {
  if (isObject5(method)) {
    return wrap_default(this, method);
  }
  if (method === "text") {
    return this.text();
  }
  if (method === "normal") {
    return this.text("normal");
  }
  if (method === "root") {
    return this.text("root");
  }
  if (method === "machine" || method === "reduced") {
    return this.text("machine");
  }
  if (method === "hash" || method === "md5") {
    return hash_default(this.text());
  }
  if (method === "spec") {
    return spec_default(this, this.world);
  }
  if (method === "json") {
    return this.json();
  }
  if (method === "offset" || method === "offsets") {
    this.compute("offset");
    return this.json({ offset: true });
  }
  if (method === "array") {
    const arr = this.docs.map((terms) => {
      return terms.reduce((str, t3) => {
        return str + t3.pre + t3.text + t3.post;
      }, "").trim();
    });
    return arr.filter((str) => str);
  }
  if (method === "freq" || method === "frequency" || method === "topk") {
    return topk(this.json({ normal: true }).map((o2) => o2.normal));
  }
  if (method === "terms") {
    return this.docs.flatMap((terms) => terms.map((t3) => t3.text).filter(Boolean));
  }
  if (method === "tags") {
    return this.docs.map((terms) => {
      return terms.reduce((h2, t3) => {
        h2[t3.implicit || t3.normal] = Array.from(t3.tags);
        return h2;
      }, {});
    });
  }
  if (method === "best-tag") {
    this.compute("tagRank");
    return this.docs.map((ts) => {
      return ts.map((t3) => t3.tagRank?.[0] ? `#${t3.tagRank[0]}` : "").join(" ");
    }).join("\n");
  }
  if (method === "debug") {
    return this.debug();
  }
  return this.text();
};
var methods13 = {
  /** */
  debug: debug_default3,
  /** */
  out,
  /** */
  wrap: function(obj) {
    return wrap_default(this, obj);
  }
};
var out_default = methods13;

// node_modules/compromise/src/1-one/output/api/text.js
var isObject6 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var text_default = {
  /** */
  text: function(fmt2) {
    let opts2 = {};
    if (fmt2 && typeof fmt2 === "string" && Object.hasOwn(fmts_default, fmt2)) {
      opts2 = { ...fmts_default[fmt2] };
    } else if (fmt2 && isObject6(fmt2)) {
      opts2 = { ...fmt2 };
    }
    if (opts2.keepSpace === void 0 && !this.isFull()) {
      opts2.keepSpace = false;
    }
    if (opts2.keepEndPunct === void 0 && this.pointer) {
      const ptr = this.pointer[0];
      if (ptr?.[1]) {
        opts2.keepEndPunct = false;
      } else {
        opts2.keepEndPunct = true;
      }
    }
    if (opts2.keepPunct === void 0) {
      opts2.keepPunct = true;
    }
    if (opts2.keepSpace === void 0) {
      opts2.keepSpace = true;
    }
    return textFromDoc(this.docs, opts2);
  }
};

// node_modules/compromise/src/1-one/output/api/index.js
var methods14 = { ...out_default, ...text_default, ...json_default, ...html_default };
var addAPI3 = function(View2) {
  Object.assign(View2.prototype, methods14);
};
var api_default5 = addAPI3;

// node_modules/compromise/src/1-one/output/methods/debug/client-side.js
var logClientSide = function(view) {
  console.log("%c -=-=- ", "background-color:#6699cc;");
  view.forEach((m3) => {
    console.groupCollapsed(m3.text());
    const terms = m3.docs[0];
    const out2 = terms.map((t3) => {
      let text6 = t3.text || "-";
      if (t3.implicit) {
        text6 = "[" + t3.implicit + "]";
      }
      const tags2 = "[" + Array.from(t3.tags).join(", ") + "]";
      return { text: text6, tags: tags2 };
    });
    console.table(out2, ["text", "tags"]);
    console.groupEnd();
  });
};
var client_side_default = logClientSide;

// node_modules/compromise/src/1-one/output/methods/debug/_color.js
var reset = "\x1B[0m";
var cli = {
  green: (str) => "\x1B[32m" + str + reset,
  red: (str) => "\x1B[31m" + str + reset,
  blue: (str) => "\x1B[34m" + str + reset,
  magenta: (str) => "\x1B[35m" + str + reset,
  cyan: (str) => "\x1B[36m" + str + reset,
  yellow: (str) => "\x1B[33m" + str + reset,
  black: (str) => "\x1B[30m" + str + reset,
  dim: (str) => "\x1B[2m" + str + reset,
  i: (str) => "\x1B[3m" + str + reset
};
var color_default = cli;

// node_modules/compromise/src/1-one/output/methods/debug/tags.js
var tagString = function(tags2, model5) {
  if (model5.one.tagSet) {
    tags2 = tags2.map((tag) => {
      if (!Object.hasOwn(model5.one.tagSet, tag)) {
        return tag;
      }
      const c2 = model5.one.tagSet[tag].color || "blue";
      return color_default[c2](tag);
    });
  }
  return tags2.join(", ");
};
var showTags = function(view) {
  const { docs, model: model5 } = view;
  if (docs.length === 0) {
    console.log(color_default.blue("\n     \u2500\u2500\u2500\u2500\u2500\u2500"));
  }
  docs.forEach((terms) => {
    console.log(color_default.blue("\n  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    terms.forEach((t3) => {
      const tags2 = [...t3.tags || []];
      let text6 = t3.text || "-";
      if (t3.sense) {
        text6 = `{${t3.normal}/${t3.sense}}`;
      }
      if (t3.implicit) {
        text6 = "[" + t3.implicit + "]";
      }
      text6 = color_default.yellow(text6);
      let word = "'" + text6 + "'";
      if (t3.reference) {
        const str2 = view.update([t3.reference]).text("normal");
        word += ` - ${color_default.dim(color_default.i("[" + str2 + "]"))}`;
      }
      word = word.padEnd(18);
      const str = color_default.blue("  \u2502 ") + color_default.i(word) + "  - " + tagString(tags2, model5);
      console.log(str);
    });
  });
  console.log("\n");
};
var tags_default = showTags;

// node_modules/compromise/src/1-one/output/methods/debug/chunks.js
var showChunks = function(view) {
  const { docs } = view;
  console.log("");
  docs.forEach((terms) => {
    const out2 = [];
    terms.forEach((term) => {
      if (term.chunk === "Noun") {
        out2.push(color_default.blue(term.implicit || term.normal));
      } else if (term.chunk === "Verb") {
        out2.push(color_default.green(term.implicit || term.normal));
      } else if (term.chunk === "Adjective") {
        out2.push(color_default.yellow(term.implicit || term.normal));
      } else if (term.chunk === "Pivot") {
        out2.push(color_default.red(term.implicit || term.normal));
      } else {
        out2.push(term.implicit || term.normal);
      }
    });
    console.log(out2.join(" "), "\n");
  });
  console.log("\n");
};
var chunks_default = showChunks;

// node_modules/compromise/src/1-one/output/methods/debug/highlight.js
var split = (txt, offset2, index3) => {
  const buff = index3 * 9;
  const start2 = offset2.start + buff;
  const end2 = start2 + offset2.length;
  const pre = txt.substring(0, start2);
  const mid = txt.substring(start2, end2);
  const post = txt.substring(end2, txt.length);
  return [pre, mid, post];
};
var spliceIn = function(txt, offset2, index3) {
  const parts = split(txt, offset2, index3);
  return `${parts[0]}${color_default.blue(parts[1])}${parts[2]}`;
};
var showHighlight = function(doc) {
  if (!doc.found) {
    return;
  }
  const bySentence = {};
  doc.fullPointer.forEach((ptr) => {
    bySentence[ptr[0]] ||= [];
    bySentence[ptr[0]].push(ptr);
  });
  Object.keys(bySentence).forEach((k2) => {
    const full = doc.update([[Number(k2)]]);
    let txt = full.text();
    const matches3 = doc.update(bySentence[k2]);
    const json = matches3.json({ offset: true });
    json.forEach((obj, i3) => {
      txt = spliceIn(txt, obj.offset, i3);
    });
    console.log(txt);
  });
  console.log("\n");
};
var highlight_default = showHighlight;

// node_modules/compromise/src/1-one/output/methods/debug/index.js
var debug4 = {
  tags: tags_default,
  clientSide: client_side_default,
  chunks: chunks_default,
  highlight: highlight_default
};
var debug_default4 = debug4;

// node_modules/compromise/src/1-one/output/fromSpec.js
var lastBrace = /\{(?=[^{]*$)/;
var comment = /\}[ \t]*#.*$/;
var green = (str) => "\x1B[32m" + str + "\x1B[0m";
var red = (str) => "\x1B[31m" + str + "\x1B[0m";
var dim2 = (str) => "\x1B[2m" + str + "\x1B[0m";
var parseLine = function(line = "") {
  let [text6, tags2] = line.split(lastBrace);
  if (tags2 === void 0) {
    return { text: text6.replace(/\s#.*$/, "").trimEnd(), tags: null };
  }
  tags2 = tags2.replace(comment, "}");
  tags2 = tags2.split(",").map((tag) => tag.trim());
  const lastTag = tags2[tags2.length - 1];
  tags2[tags2.length - 1] = lastTag.replace(/\}$/, "");
  tags2 = tags2.map((tag) => tag.split("|").map((t3) => t3.trim()));
  tags2 = tags2.filter((arr) => arr.some((t3) => t3 !== ""));
  return { text: text6, tags: tags2 };
};
var toMatchString = function(tags2, aliases3) {
  return tags2.map((arr) => {
    arr = arr.map((str) => {
      return "#" + (aliases3[str] || str);
    });
    if (arr.length > 1) {
      return `(${arr.join(" && ")})`;
    }
    return arr[0];
  }).join(" ");
};
var fromSpec = function(spec) {
  const cleanText = spec.split("\n").filter((line) => line.trim() && !/^\s*#/.test(line)).map((line) => {
    return parseLine(line).text;
  }).join("\n");
  return this(cleanText);
};
var toTagList = function(tags2) {
  const list4 = tags2.map((arr) => arr.join("|"));
  return dim2(`{${list4.join(",")}}`);
};
var testSpec = function(spec, verbose2 = true, throwError = false) {
  const nlp2 = this;
  const world2 = nlp2.world();
  const aliases3 = {};
  const tagSet = world2.model.one.tagSet;
  Object.keys(tagSet).forEach((k2) => {
    if (tagSet[k2].alias) {
      aliases3[tagSet[k2].alias] = k2;
    }
  });
  const resultLines = spec.split("\n").filter((line) => line.trim() && !/^\s*#/.test(line)).map((line) => {
    const { text: text6, tags: tags2 } = parseLine(line);
    if (tags2 === null) {
      if (verbose2 !== false) {
        console.log(`${green("\u2713")} ${green(dim2(text6))}`);
      }
      return text6;
    }
    const doc = nlp2(text6);
    const matchStr = toMatchString(tags2, aliases3);
    const didMatch = doc.has(matchStr);
    if (verbose2 !== false) {
      if (didMatch === true) {
        console.log(`${green("\u2713")} ${green(dim2(text6))} ${toTagList(tags2)}`);
      } else {
        const perTerm = matchStr.split(" ");
        let failure = "";
        const wrong = doc.terms().find((term, i3) => !term.has(perTerm[i3]));
        if (wrong.found) {
          failure = `'${wrong.text("normal")}'`;
          const tag = wrong.out("best-tag");
          if (tag) {
            failure += ` = ${tag}`;
          }
        }
        console.log(`${red("\u2717")} ${text6} ${toTagList(tags2)} - ${red(failure)}`);
      }
    }
    if (didMatch === false && throwError === true) {
      throw new Error(`\u274C ${text6} ${toTagList(tags2)}`);
    }
    return didMatch ? null : text6;
  }).filter(Boolean).join("\n");
  return nlp2(resultLines);
};

// node_modules/compromise/src/1-one/output/plugin.js
var plugin_default8 = {
  lib: {
    fromSpec,
    testSpec
  },
  api: api_default5,
  methods: {
    one: {
      hash: hash_default,
      debug: debug_default4
    }
  }
};

// node_modules/compromise/src/1-one/pointers/api/lib/_lib.js
var doesOverlap = function(a2, b) {
  if (a2[0] !== b[0]) {
    return false;
  }
  const [, startA, endA] = a2;
  const [, startB, endB] = b;
  if (startA <= startB && endA > startB) {
    return true;
  }
  if (startB <= startA && endB > startA) {
    return true;
  }
  return false;
};
var getExtent = function(ptrs) {
  let min2 = ptrs[0][1];
  let max3 = ptrs[0][2];
  ptrs.forEach((ptr) => {
    if (ptr[1] < min2) {
      min2 = ptr[1];
    }
    if (ptr[2] > max3) {
      max3 = ptr[2];
    }
  });
  return [ptrs[0][0], min2, max3];
};
var indexN = function(ptrs) {
  const byN = {};
  ptrs.forEach((ref) => {
    byN[ref[0]] ||= [];
    byN[ref[0]].push(ref);
  });
  return byN;
};
var uniquePtrs = function(arr) {
  const obj = {};
  for (let i3 = 0; i3 < arr.length; i3 += 1) {
    obj[arr[i3].join(",")] = arr[i3];
  }
  return Object.values(obj);
};

// node_modules/compromise/src/1-one/pointers/api/lib/split.js
var pivotBy = function(full, m3) {
  const [n3, start2] = full;
  const mStart = m3[1];
  const mEnd = m3[2];
  const res = {};
  if (start2 < mStart) {
    const end2 = mStart < full[2] ? mStart : full[2];
    res.before = [n3, start2, end2];
  }
  res.match = m3;
  if (full[2] > mEnd) {
    res.after = [n3, mEnd, full[2]];
  }
  return res;
};
var doesMatch2 = function(full, m3) {
  return full[1] <= m3[1] && m3[2] <= full[2];
};
var splitAll = function(full, m3) {
  const byN = indexN(m3);
  const res = [];
  full.forEach((ptr) => {
    const [n3] = ptr;
    let matches3 = byN[n3] || [];
    matches3 = matches3.filter((p5) => doesMatch2(ptr, p5));
    if (matches3.length === 0) {
      res.push({ passthrough: ptr });
      return;
    }
    matches3 = matches3.sort((a2, b) => a2[1] - b[1]);
    let carry = ptr;
    matches3.forEach((p5, i3) => {
      const found = pivotBy(carry, p5);
      if (!matches3[i3 + 1]) {
        res.push(found);
      } else {
        res.push({ before: found.before, match: found.match });
        if (found.after) {
          carry = found.after;
        }
      }
    });
  });
  return res;
};
var split_default2 = splitAll;

// node_modules/compromise/src/1-one/pointers/methods/getDoc.js
var max = 20;
var blindSweep = function(id, doc, n3) {
  for (let i3 = 0; i3 < max; i3 += 1) {
    if (doc[n3 - i3]) {
      const index3 = doc[n3 - i3].findIndex((term) => term.id === id);
      if (index3 !== -1) {
        return [n3 - i3, index3];
      }
    }
    if (doc[n3 + i3]) {
      const index3 = doc[n3 + i3].findIndex((term) => term.id === id);
      if (index3 !== -1) {
        return [n3 + i3, index3];
      }
    }
  }
  return null;
};
var repairEnding = function(ptr, document) {
  const [n3, start2, , , endId] = ptr;
  const terms = document[n3];
  const newEnd = terms.findIndex((t3) => t3.id === endId);
  if (newEnd === -1) {
    ptr[2] = document[n3].length;
    ptr[4] = terms.length > 0 ? terms[terms.length - 1].id : null;
  } else {
    ptr[2] = newEnd;
  }
  return document[n3].slice(start2, ptr[2] + 1);
};
var getDoc2 = function(ptrs, document) {
  let doc = [];
  ptrs.forEach((ptr, i3) => {
    if (!ptr) {
      return;
    }
    let [n3, start2, end2, id, endId] = ptr;
    let terms = document[n3] || [];
    if (start2 === void 0) {
      start2 = 0;
    }
    if (end2 === void 0) {
      end2 = terms.length;
    }
    if (id && (!terms[start2] || terms[start2].id !== id)) {
      const wild = blindSweep(id, document, n3);
      if (wild !== null) {
        const len = end2 - start2;
        terms = document[wild[0]].slice(wild[1], wild[1] + len);
        const startId = terms[0] ? terms[0].id : null;
        ptrs[i3] = [wild[0], wild[1], wild[1] + len, startId];
      }
    } else {
      terms = terms.slice(start2, end2);
    }
    if (terms.length === 0) {
      return;
    }
    if (start2 === end2) {
      return;
    }
    if (endId && terms[terms.length - 1].id !== endId) {
      terms = repairEnding(ptr, document);
    }
    doc.push(terms);
  });
  doc = doc.filter((a2) => a2.length > 0);
  return doc;
};
var getDoc_default = getDoc2;

// node_modules/compromise/src/1-one/pointers/methods/index.js
var termList = function(docs) {
  const arr = [];
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      arr.push(docs[i3][t3]);
    }
  }
  return arr;
};
var methods_default5 = {
  one: {
    termList,
    getDoc: getDoc_default,
    pointer: {
      indexN,
      splitAll: split_default2
    }
  }
};

// node_modules/compromise/src/1-one/pointers/api/lib/union.js
var getUnion = function(a2, b) {
  const both = a2.concat(b);
  const byN = indexN(both);
  let res = [];
  both.forEach((ptr) => {
    const [n3] = ptr;
    if (byN[n3].length === 1) {
      res.push(ptr);
      return;
    }
    const hmm = byN[n3].filter((m3) => doesOverlap(ptr, m3));
    hmm.push(ptr);
    const range = getExtent(hmm);
    res.push(range);
  });
  res = uniquePtrs(res);
  return res;
};
var union_default = getUnion;

// node_modules/compromise/src/1-one/pointers/api/lib/difference.js
var subtract = function(refs, not) {
  const res = [];
  const found = split_default2(refs, not);
  found.forEach((o2) => {
    if (o2.passthrough) {
      res.push(o2.passthrough);
    }
    if (o2.before) {
      res.push(o2.before);
    }
    if (o2.after) {
      res.push(o2.after);
    }
  });
  return res;
};
var difference_default = subtract;

// node_modules/compromise/src/1-one/pointers/api/lib/intersection.js
var intersection = function(a2, b) {
  const start2 = a2[1] < b[1] ? b[1] : a2[1];
  const end2 = a2[2] > b[2] ? b[2] : a2[2];
  if (start2 < end2) {
    return [a2[0], start2, end2];
  }
  return null;
};
var getIntersection = function(a2, b) {
  const byN = indexN(b);
  const res = [];
  a2.forEach((ptr) => {
    let hmm = byN[ptr[0]] || [];
    hmm = hmm.filter((p5) => doesOverlap(ptr, p5));
    if (hmm.length === 0) {
      return;
    }
    hmm.forEach((h2) => {
      const overlap = intersection(ptr, h2);
      if (overlap) {
        res.push(overlap);
      }
    });
  });
  return res;
};
var intersection_default = getIntersection;

// node_modules/compromise/src/1-one/pointers/api/index.js
var getDoc3 = (m3, view) => {
  if (typeof m3 === "string" || Array.isArray(m3)) {
    return view.match(m3);
  }
  if (!m3) {
    return view.none();
  }
  return m3;
};
var addIds3 = function(ptrs, docs) {
  return ptrs.map((ptr) => {
    const [n3, start2] = ptr;
    if (docs[n3] && docs[n3][start2]) {
      ptr[3] = docs[n3][start2].id;
    }
    return ptr;
  });
};
var methods15 = {};
methods15.union = function(m3) {
  m3 = getDoc3(m3, this);
  let ptrs = union_default(this.fullPointer, m3.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.and = methods15.union;
methods15.intersection = function(m3) {
  m3 = getDoc3(m3, this);
  let ptrs = intersection_default(this.fullPointer, m3.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.not = function(m3) {
  m3 = getDoc3(m3, this);
  let ptrs = difference_default(this.fullPointer, m3.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.difference = methods15.not;
methods15.complement = function() {
  const doc = this.all();
  let ptrs = difference_default(doc.fullPointer, this.fullPointer);
  ptrs = addIds3(ptrs, this.document);
  return this.toView(ptrs);
};
methods15.settle = function() {
  let ptrs = this.fullPointer;
  ptrs.forEach((ptr) => {
    ptrs = union_default(ptrs, [ptr]);
  });
  ptrs = addIds3(ptrs, this.document);
  return this.update(ptrs);
};
var addAPI4 = function(View2) {
  Object.assign(View2.prototype, methods15);
};
var api_default6 = addAPI4;

// node_modules/compromise/src/1-one/pointers/plugin.js
var plugin_default9 = {
  methods: methods_default5,
  api: api_default6
};

// node_modules/compromise/src/1-one/sweep/lib.js
var lib_default3 = {
  // compile a list of matches into a match-net
  buildNet: function(matches3) {
    const methods19 = this.methods();
    const net3 = methods19.one.buildNet(matches3, this.world());
    net3.isNet = true;
    return net3;
  }
};

// node_modules/compromise/src/1-one/sweep/api.js
var api = function(View2) {
  View2.prototype.sweep = function(net3, opts2 = {}) {
    const { world: world2, docs } = this;
    const { methods: methods19 } = world2;
    let found = methods19.one.bulkMatch(docs, net3, this.methods, opts2);
    if (opts2.tagger !== false) {
      methods19.one.bulkTagger(found, docs, this.world);
    }
    found = found.map((o2) => {
      const ptr = o2.pointer;
      const term = docs[ptr[0]][ptr[1]];
      const len = ptr[2] - ptr[1];
      if (term.index) {
        o2.pointer = [
          term.index[0],
          term.index[1],
          ptr[1] + len
        ];
      }
      return o2;
    });
    const ptrs = found.map((o2) => o2.pointer);
    found = found.map((obj) => {
      obj.view = this.update([obj.pointer]);
      delete obj.regs;
      delete obj.needs;
      delete obj.pointer;
      delete obj._expanded;
      return obj;
    });
    return {
      view: this.update(ptrs),
      found
    };
  };
};
var api_default7 = api;

// node_modules/compromise/src/1-one/sweep/methods/buildNet/_lib.js
var canCheck = (reg) => Boolean(reg && !reg.optional && !reg.negative && !reg.greedy && !reg.choices && !reg.anything && !reg.regex && !reg.method);
var getBoundary = (reg, boundary) => {
  if (!canCheck(reg) || !reg[boundary]) {
    return null;
  }
  return reg;
};

// node_modules/compromise/src/1-one/sweep/methods/buildNet/01-parse.js
var getTokenNeeds = function(reg) {
  if (reg.optional === true || reg.negative === true) {
    return null;
  }
  if (reg.tag) {
    return "#" + reg.tag;
  }
  if (reg.word) {
    return reg.word;
  }
  if (reg.switch) {
    return `%${reg.switch}%`;
  }
  return null;
};
var hasRequiredHook = function(regs, hook) {
  return regs.some((reg) => {
    if (reg.optional || reg.negative) {
      return false;
    }
    if (getTokenNeeds(reg) === hook) {
      return true;
    }
    return reg.operator === "and" && reg.choices && reg.choices.some((side) => hasRequiredHook(side, hook));
  });
};
var getNeeds = function(regs) {
  const needs = [];
  regs.forEach((reg) => {
    needs.push(getTokenNeeds(reg));
    if (reg.operator === "and" && reg.choices) {
      reg.choices.forEach((oneSide) => {
        oneSide.forEach((r2) => {
          needs.push(getTokenNeeds(r2));
        });
      });
    }
  });
  return needs.filter((str) => str);
};
var getWants = function(regs) {
  const wants = [];
  let count = 0;
  regs.forEach((reg) => {
    if (reg.operator === "or" && !reg.optional && !reg.negative) {
      if (reg.fastOr) {
        Array.from(reg.fastOr).forEach((w) => {
          wants.push(w);
        });
      }
      if (reg.choices) {
        reg.choices.forEach((rs) => {
          rs.forEach((r2) => {
            const n3 = getTokenNeeds(r2);
            if (n3) {
              wants.push(n3);
            }
          });
        });
      }
      count += 1;
    }
  });
  return { wants, count };
};
var parse = function(matches3, world2) {
  const parseMatch = world2.methods.one.parseMatch;
  matches3.forEach((obj) => {
    obj.regs = parseMatch(obj.match, {}, world2);
    obj.fixed = isFixed(obj.regs);
    obj.checkFirst = canCheck(obj.regs[0]);
    obj.startTerm = getBoundary(obj.regs[0], "start");
    obj.endTerm = getBoundary(obj.regs[obj.regs.length - 1], "end");
    if (typeof obj.ifNo === "string") {
      obj.ifNo = [obj.ifNo];
    }
    if (obj.notIf) {
      obj.notIf = parseMatch(obj.notIf, {}, world2);
    }
    obj.needs = getNeeds(obj.regs);
    if (obj.hook !== void 0) {
      if (typeof obj.hook !== "string" || !obj.needs.includes(obj.hook) || !hasRequiredHook(obj.regs, obj.hook)) {
        throw new Error(`Invalid hook "${obj.hook}" for match "${obj.match}": use a required word, #Tag, or %Switch%.`);
      }
    }
    const { wants, count } = getWants(obj.regs);
    obj.wants = wants;
    obj.minWant = count;
    obj.minWords = obj.regs.filter((o2) => !o2.optional).length;
    obj.minLength = obj.regs.filter((o2) => o2.optional !== true && o2.negative !== true).length;
  });
  return matches3;
};
var parse_default = parse;

// node_modules/compromise/src/1-one/sweep/methods/buildNet/02-index.js
var buildIndex = function(matches3, hooks2, hookOrder) {
  const index3 = /* @__PURE__ */ Object.create(null);
  const seen = /* @__PURE__ */ new Set();
  const lastRank = Object.keys(hooks2).length;
  matches3.forEach((rule, order) => {
    if (seen.has(rule)) {
      return;
    }
    seen.add(rule);
    let anchor = null;
    let rank = lastRank;
    for (let i3 = 0; i3 < rule.needs.length; i3 += 1) {
      const key = rule.needs[i3];
      if (anchor === null || hooks2[key].length < hooks2[anchor].length) {
        anchor = key;
      }
      rank = Math.min(rank, hookOrder[key]);
    }
    if (rule.hook !== void 0) {
      anchor = rule.hook;
    }
    const earlier = [...new Set(rule.wants)].filter((key) => hookOrder[key] < rank).sort((a2, b) => hookOrder[a2] - hookOrder[b]);
    const keys2 = anchor === null ? [...new Set(rule.wants)] : [anchor];
    const needs = [...new Set(rule.needs)].filter((key) => key !== anchor);
    const entry = { rule, order, rank, earlier, needs, single: keys2.length === 1 };
    for (let i3 = 0; i3 < keys2.length; i3 += 1) {
      const key = keys2[i3];
      index3[key] ||= [];
      index3[key].push(entry);
    }
  });
  return index3;
};
var index_default = buildIndex;

// node_modules/compromise/src/1-one/sweep/methods/buildNet/index.js
var buildNet = function(matches3, world2) {
  matches3 = parse_default(matches3, world2);
  const hooks2 = {};
  matches3.forEach((obj) => {
    obj.needs.forEach((str) => {
      hooks2[str] = Array.isArray(hooks2[str]) ? hooks2[str] : [];
      hooks2[str].push(obj);
    });
    obj.wants.forEach((str) => {
      hooks2[str] = Array.isArray(hooks2[str]) ? hooks2[str] : [];
      hooks2[str].push(obj);
    });
  });
  const hookOrder = /* @__PURE__ */ Object.create(null);
  Object.keys(hooks2).forEach((k2, i3) => {
    hookOrder[k2] = i3;
    const already = /* @__PURE__ */ new Set();
    hooks2[k2] = hooks2[k2].filter((obj) => {
      if (already.has(obj)) {
        return false;
      }
      already.add(obj);
      return true;
    });
  });
  const always = matches3.filter((o2) => o2.needs.length === 0 && o2.wants.length === 0);
  return {
    hooks: hooks2,
    hookOrder,
    index: index_default(matches3, hooks2, hookOrder),
    always
  };
};
var buildNet_default = buildNet;

// node_modules/compromise/src/1-one/sweep/methods/sweep/_lib.js
var canMatch = (obj, haves, terms, needs = obj.needs) => {
  const termCount = terms.length;
  if (!(termCount >= obj.minWords)) {
    return false;
  }
  for (let j2 = 0; j2 < needs.length; j2 += 1) {
    if (!haves.has(needs[j2])) {
      return false;
    }
  }
  if (obj.ifNo !== void 0) {
    for (let j2 = 0; j2 < obj.ifNo.length; j2 += 1) {
      if (haves.has(obj.ifNo[j2])) {
        return false;
      }
    }
  }
  if (obj.wants.length > 0) {
    let count = 0;
    for (let j2 = 0; j2 < obj.wants.length; j2 += 1) {
      if (haves.has(obj.wants[j2])) {
        count += 1;
        if (count >= obj.minWant) {
          break;
        }
      }
    }
    if (!(count >= obj.minWant)) {
      return false;
    }
  }
  if (termCount && obj.startTerm && !doesMatch_default(terms[0], obj.startTerm, 0, termCount)) {
    return false;
  }
  if (termCount && obj.endTerm && !doesMatch_default(terms[termCount - 1], obj.endTerm, termCount - 1, termCount)) {
    return false;
  }
  return true;
};
var lib_default4 = canMatch;

// node_modules/compromise/src/1-one/sweep/methods/sweep/01-getHooks.js
var getIndexed = function(set, index3, hookOrder, terms) {
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  set.forEach((key) => {
    const bucket = index3[key];
    if (!Array.isArray(bucket)) {
      return;
    }
    for (let i3 = 0; i3 < bucket.length; i3 += 1) {
      const entry = bucket[i3];
      if (entry.single !== true) {
        if (seen.has(entry)) {
          continue;
        }
        seen.add(entry);
      }
      if (!lib_default4(entry.rule, set, terms, entry.needs)) {
        continue;
      }
      let rank = entry.rank;
      for (let j2 = 0; j2 < entry.earlier.length; j2 += 1) {
        const earlier = entry.earlier[j2];
        if (set.has(earlier)) {
          rank = hookOrder[earlier];
          break;
        }
      }
      if (rank === entry.rank) {
        found.push(entry);
      } else {
        found.push({ rule: entry.rule, rank, order: entry.order });
      }
    }
  });
  found.sort((a2, b) => a2.rank - b.rank || a2.order - b.order);
  return found.map((entry) => entry.rule);
};
var getHooks = function(docCaches, net3, document) {
  const { hooks: hooks2, index: index3, always } = net3;
  let { hookOrder } = net3;
  if (!hookOrder) {
    hookOrder = /* @__PURE__ */ Object.create(null);
    Object.keys(hooks2).forEach((k2, i3) => {
      hookOrder[k2] = i3;
    });
  }
  const lists = docCaches.map((set, n3) => {
    if (index3) {
      return getIndexed(set, index3, hookOrder, document[n3]);
    }
    const keys2 = [];
    set.forEach((k2) => {
      if (typeof hookOrder[k2] === "number") {
        keys2.push(k2);
      }
    });
    keys2.sort((a2, b) => hookOrder[a2] - hookOrder[b]);
    const maybe = [];
    const already = /* @__PURE__ */ new Set();
    for (let i3 = 0; i3 < keys2.length; i3 += 1) {
      const bucket = hooks2[keys2[i3]];
      for (let j2 = 0; j2 < bucket.length; j2 += 1) {
        const m3 = bucket[j2];
        if (!already.has(m3)) {
          already.add(m3);
          if (lib_default4(m3, set, document[n3])) {
            maybe.push(m3);
          }
        }
      }
    }
    return maybe;
  });
  lists.forEach((list4, n3) => {
    const termCount = document[n3].length;
    for (let i3 = 0; i3 < always.length; i3 += 1) {
      if (termCount >= always[i3].minWords) {
        list4.push(always[i3]);
      }
    }
  });
  return lists;
};
var getHooks_default = getHooks;

// node_modules/compromise/src/1-one/sweep/methods/sweep/04-runMatch.js
var runMatch2 = function(maybeList, document, docCache, methods19, opts2) {
  const results = [];
  for (let n3 = 0; n3 < maybeList.length; n3 += 1) {
    const sentence = [document[n3]];
    for (let i3 = 0; i3 < maybeList[n3].length; i3 += 1) {
      const m3 = maybeList[n3][i3];
      const res = methods19.one.match(sentence, m3);
      if (res.ptrs.length > 0) {
        res.ptrs.forEach((ptr) => {
          ptr[0] = n3;
          const todo = { ...m3, pointer: ptr };
          if (m3.unTag !== void 0) {
            todo.unTag = m3.unTag;
          }
          results.push(todo);
        });
        if (opts2.matchOne === true) {
          return [results[0]];
        }
      }
    }
  }
  return results;
};
var runMatch_default = runMatch2;

// node_modules/compromise/src/1-one/sweep/methods/sweep/index.js
var sweep = function(document, net3, methods19, opts2 = {}) {
  const docCache = methods19.one.cacheDoc(document);
  const maybeList = getHooks_default(docCache, net3, document);
  const results = runMatch_default(maybeList, document, docCache, methods19, opts2);
  return results;
};
var sweep_default = sweep;

// node_modules/compromise/src/1-one/tag/methods/_lib.js
var sets = /* @__PURE__ */ new WeakMap();
var empty = /* @__PURE__ */ new Set();
var getTagSet = (tags2) => {
  if (!tags2 || tags2.length === 0) {
    return empty;
  }
  let set = sets.get(tags2);
  if (!set) {
    set = new Set(tags2);
    sets.set(tags2, set);
  }
  return set;
};
var lib_default5 = getTagSet;

// node_modules/compromise/src/1-one/sweep/methods/tagger/canBe.js
var canBe = function(terms, tag, model5) {
  const tagSet = model5.one.tagSet;
  if (!Object.hasOwn(tagSet, tag)) {
    return true;
  }
  const conflicts = lib_default5(tagSet[tag].not);
  if (conflicts.size === 0) {
    return true;
  }
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    const term = terms[i3];
    for (const existing of term.tags) {
      if (conflicts.has(existing)) {
        return false;
      }
    }
  }
  return true;
};
var canBe_default = canBe;

// node_modules/compromise/src/1-one/sweep/methods/tagger/index.js
var tagger = function(list4, document, world2) {
  const { model: model5, methods: methods19 } = world2;
  const { getDoc: getDoc4, setTag: setTag2, unTag: unTag2 } = methods19.one;
  const looksPlural2 = methods19.two.looksPlural;
  if (list4.length === 0) {
    return list4;
  }
  if (debug_default.tags) {
    console.log(`

  \x1B[32m\u2192 ${list4.length} post-tagger:\x1B[0m`);
  }
  return list4.map((todo) => {
    if (!todo.tag && !todo.chunk && !todo.unTag) {
      return;
    }
    const reason2 = todo.reason || todo.match;
    const terms = getDoc4([todo.pointer], document)[0];
    let validated;
    if (todo.safe === true) {
      if (canBe_default(terms, todo.tag, model5) === false) {
        return;
      }
      if (terms[terms.length - 1].post === "-") {
        return;
      }
      if (typeof todo.tag === "string" && Object.hasOwn(model5.one.tagSet, todo.tag)) {
        validated = model5.one.tagSet[todo.tag];
      }
    }
    if (todo.tag !== void 0) {
      setTag2(terms, todo.tag, world2, todo.safe, `[post] '${reason2}'`, validated);
      if (todo.tag === "Noun" && looksPlural2) {
        const term = terms[terms.length - 1];
        if (looksPlural2(term.text)) {
          setTag2([term], "Plural", world2, todo.safe, "quick-plural");
        } else {
          setTag2([term], "Singular", world2, todo.safe, "quick-singular");
        }
      }
      if (todo.freeze === true) {
        terms.forEach((term) => term.frozen = true);
      }
    }
    if (todo.unTag !== void 0) {
      unTag2(terms, todo.unTag, world2, todo.safe, reason2);
    }
    if (todo.chunk) {
      terms.forEach((t3) => t3.chunk = todo.chunk);
    }
  });
};
var tagger_default = tagger;

// node_modules/compromise/src/1-one/sweep/methods/index.js
var methods_default6 = {
  buildNet: buildNet_default,
  bulkMatch: sweep_default,
  bulkTagger: tagger_default
};

// node_modules/compromise/src/1-one/sweep/plugin.js
var plugin_default10 = {
  lib: lib_default3,
  api: api_default7,
  methods: {
    one: methods_default6
  }
};

// node_modules/compromise/src/1-one/tag/methods/setTag.js
var isMulti = / /;
var addChunk = function(term, tag) {
  if (tag === "Noun") {
    term.chunk = tag;
  }
  if (tag === "Verb") {
    term.chunk = tag;
  }
};
var tagTerm = function(term, tag, tagSet, isSafe, validated) {
  if (term.tags.has(tag) === true) {
    return null;
  }
  if (tag === ".") {
    return null;
  }
  if (term.frozen === true) {
    isSafe = true;
  }
  const known = tagSet[tag];
  if (known) {
    if (known !== validated && known.not && known.not.length > 0) {
      const conflicts = lib_default5(known.not);
      for (const existing of term.tags) {
        if (conflicts.has(existing)) {
          if (isSafe === true) {
            return null;
          }
          term.tags.delete(existing);
        }
      }
    }
    if (known.parents && known.parents.length > 0) {
      for (let o2 = 0; o2 < known.parents.length; o2 += 1) {
        term.tags.add(known.parents[o2]);
        addChunk(term, known.parents[o2]);
      }
    }
  }
  term.tags.add(tag);
  term.dirty = true;
  addChunk(term, tag);
  return true;
};
var multiTag = function(terms, tagString2, tagSet, isSafe) {
  const tags2 = tagString2.split(isMulti);
  terms.forEach((term, i3) => {
    let tag = tags2[i3];
    if (tag) {
      tag = tag.replace(/^#/, "");
      tagTerm(term, tag, tagSet, isSafe);
    }
  });
};
var log = (terms, tag, reason2 = "") => {
  const yellow = (str) => "\x1B[33m\x1B[3m" + str + "\x1B[0m";
  const i3 = (str) => "\x1B[3m" + str + "\x1B[0m";
  const word = terms.map((t3) => {
    return t3.text || "[" + t3.implicit + "]";
  }).join(" ");
  if (typeof tag !== "string" && tag.length > 2) {
    tag = tag.slice(0, 2).join(", #") + " +";
  }
  tag = typeof tag !== "string" ? tag.join(", #") : tag;
  console.log(` ${yellow(word).padEnd(24)} \x1B[32m\u2192\x1B[0m #${tag.padEnd(22)}  ${i3(reason2)}`);
};
var setTag = function(terms, tag, world2 = {}, isSafe, reason2, validated) {
  const tagSet = world2.model.one.tagSet || {};
  if (!tag) {
    return;
  }
  if (debug_default.tags) {
    log(terms, tag, reason2);
  }
  if (Array.isArray(tag) === true) {
    tag.forEach((tg) => setTag(terms, tg, world2, isSafe));
    return;
  }
  if (typeof tag !== "string") {
    console.warn(`compromise: Invalid tag '${tag}'`);
    return;
  }
  tag = tag.trim();
  if (isMulti.test(tag)) {
    multiTag(terms, tag, tagSet, isSafe);
    return;
  }
  tag = tag.replace(/^#/, "");
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    tagTerm(terms[i3], tag, tagSet, isSafe, validated);
  }
};
var setTag_default = setTag;

// node_modules/compromise/src/1-one/tag/methods/unTag.js
var unTag = function(terms, tag, tagSet) {
  tag = tag.trim().replace(/^#/, "");
  const children = lib_default5(tagSet[tag]?.children);
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    const term = terms[i3];
    if (term.frozen === true) {
      continue;
    }
    if (tag === "*") {
      term.tags.clear();
      continue;
    }
    if (children.size > 0) {
      for (const existing of term.tags) {
        if (children.has(existing)) {
          term.tags.delete(existing);
        }
      }
    }
    term.tags.delete(tag);
  }
};
var unTag_default = unTag;

// node_modules/compromise/src/1-one/tag/methods/canBe.js
var canBe2 = function(term, tag, tagSet) {
  if (!Object.hasOwn(tagSet, tag)) {
    return true;
  }
  const conflicts = lib_default5(tagSet[tag].not);
  if (conflicts.size === 0) {
    return true;
  }
  for (const existing of term.tags) {
    if (conflicts.has(existing)) {
      return false;
    }
  }
  return true;
};
var canBe_default2 = canBe2;

// node_modules/grad-school/builds/grad-school.mjs
var t2 = function(t3) {
  return t3.children = t3.children || [], t3._cache = t3._cache || {}, t3.props = t3.props || {}, t3._cache.parents = t3._cache.parents || [], t3._cache.children = t3._cache.children || [], t3;
};
var n = /^[ \t]*(#|\/\/)/;
var e = (t3) => {
  const n3 = /* @__PURE__ */ new Map(), e2 = t3.map((t4) => [t4, false]);
  for (; e2.length > 0; ) {
    const [t4, r2] = e2.pop();
    if (r2) n3.set(t4, 2);
    else {
      if (1 === n3.get(t4)) throw new Error("[Grad] - cyclic input");
      if (!n3.has(t4)) {
        n3.set(t4, 1), e2.push([t4, true]);
        for (const n4 of t4.children || []) e2.push([n4, false]);
      }
    }
  }
  return n3.keys();
};
var r = (t3) => t3 && "object" == typeof t3 && !Array.isArray(t3);
var s = Array.isArray;
var c = (t3) => t3 instanceof Set;
var o = (t3) => (t3 = t3 || "").trim();
var i2 = (t3, n3, e2 = true) => {
  const r2 = e2 ? [] : null, s3 = [t3];
  for (; s3.length > 0; ) {
    const t4 = s3.pop();
    if (e2 && r2.push(t4), t4.children) for (let e3 = t4.children.length - 1; e3 >= 0; e3 -= 1) {
      const r3 = t4.children[e3];
      n3 && n3(t4, r3), s3.push(r3);
    }
  }
  return r2;
};
var h = "\x1B[0m";
var a = function(t3, n3) {
  let e2 = "-> ";
  n3 && (e2 = "\x1B[2m\u2192 " + h);
  let r2 = "";
  return i2(t3).forEach((t4, s3) => {
    let c2 = t4.id || "";
    if (n3 && (c2 = "\x1B[31m" + c2 + h), 0 === s3 && !t4.id) return;
    const o2 = t4._cache.parents.length;
    r2 += "    ".repeat(o2) + e2 + c2 + "\n";
  }), r2;
};
var l = function(t3) {
  let n3 = i2(t3);
  n3 = n3.map((t4, n4) => {
    const { children: e3, ...r2 } = t4, s3 = r2._cache.parents;
    return r2.parent = n4 > 0 && s3.length > 0 ? s3[s3.length - 1] : null, r2;
  });
  const e2 = n3[0];
  return e2 && !e2.id && 0 === Object.keys(e2.props).length && n3.shift(), n3;
};
var u = { text: a, txt: a, array: l, flat: l };
var d = function(t3, n3) {
  return "nested" === n3 || "json" === n3 ? t3 : "debug" === n3 ? (console.log(a(t3, true)), null) : u.hasOwnProperty(n3) ? u[n3](t3) : t3;
};
var p = (t3) => {
  i2(t3, (t4, n3) => {
    t4.id && (t4._cache.parents = t4._cache.parents || [], n3._cache.parents = t4._cache.parents.concat([t4.id]));
  }, false);
};
var f = (t3) => c(t3) ? "set" : s(t3) ? "array" : r(t3) ? "object" : "scalar";
var j = class _j {
  constructor(n3 = t2({})) {
    Object.defineProperty(this, "json", { enumerable: false, value: n3, writable: true });
  }
  get children() {
    return this.json.children;
  }
  get id() {
    return this.json.id;
  }
  get found() {
    return Boolean(this.json.id || this.json.children.length > 0);
  }
  props(t3 = {}) {
    const n3 = this.json.props || {};
    return "string" == typeof t3 && (t3 = { [t3]: true }), this.json.props = Object.assign(n3, t3), this;
  }
  get(n3) {
    n3 = o(n3);
    const e2 = ((t3, n4) => {
      const e3 = ((t4) => "string" != typeof t4 ? t4 : (t4 = t4.replace(/^\//, "")).split(/\//))(n4 = n4 || "");
      for (let n5 = 0; n5 < e3.length; n5 += 1) {
        const r2 = t3.children.find((t4) => t4.id === e3[n5]);
        if (!r2) return null;
        t3 = r2;
      }
      return t3;
    })(this.json, n3) || t2({});
    return new _j(e2);
  }
  add(n3, e2 = {}) {
    if (s(n3)) return n3.forEach((t3) => this.add(o(t3), e2)), this;
    n3 = o(n3);
    const r2 = t2({ id: n3, props: { ...e2 } });
    return this.json.children.push(r2), new _j(r2);
  }
  remove(t3) {
    return t3 = o(t3), this.json.children = this.json.children.filter((n3) => n3.id !== t3), this;
  }
  nodes() {
    return i2(this.json).map((t3) => {
      const { children: n3, ...e2 } = t3;
      return e2;
    });
  }
  cache() {
    return ((t3) => {
      const n3 = i2(t3), e2 = /* @__PURE__ */ new Map();
      n3.forEach((t4) => {
        t4._cache.parents = [], t4._cache.children = [], t4.id && e2.set(t4.id, t4);
      }), p(t3), n3.forEach((t4) => {
        t4._cache.parents.forEach((n4) => {
          e2.has(n4) && e2.get(n4)._cache.children.push(t4.id);
        });
      }), t3._cache.children = [...e2.keys()];
    })(this.json), this;
  }
  list() {
    return i2(this.json);
  }
  fillDown() {
    return t3 = this.json, i2(t3, (t4, n3) => {
      n3.props = ((t5, n4) => (Object.keys(n4).forEach((e2) => {
        if (void 0 === t5[e2] || f(t5[e2]) === f(n4[e2])) {
          if (c(n4[e2])) {
            const r2 = t5[e2] || /* @__PURE__ */ new Set();
            return void (t5[e2] = /* @__PURE__ */ new Set([...r2, ...n4[e2]]));
          }
          if (r(n4[e2])) {
            const r2 = t5[e2] || {};
            return void (t5[e2] = Object.assign({}, n4[e2], r2));
          }
          s(n4[e2]) ? t5[e2] = n4[e2].concat(t5[e2] || []) : void 0 === t5[e2] && (t5[e2] = n4[e2]);
        }
      }), t5))(n3.props, t4.props);
    }, false), this;
    var t3;
  }
  depth() {
    let t3 = this.id ? 1 : 0;
    const n3 = /* @__PURE__ */ new Map([[this.json, t3]]);
    return i2(this.json, (e2, r2) => {
      const s3 = n3.get(e2) + 1;
      n3.set(r2, s3), t3 = Math.max(t3, s3);
    }, false), t3;
  }
  out(t3) {
    return p(this.json), d(this.json, t3);
  }
  debug() {
    return p(this.json), d(this.json, "debug"), this;
  }
};
var g = function(r2) {
  const c2 = (function(r3 = []) {
    return "string" == typeof r3 ? (function(e2) {
      const r4 = e2.split(/\r?\n/), s3 = [];
      r4.forEach((e3) => {
        if (!e3.trim() || n.test(e3)) return;
        const r5 = ((t3) => {
          const n3 = /^( {2}|\t)/;
          let e4 = 0;
          for (; n3.test(t3); ) t3 = t3.replace(n3, ""), e4 += 1;
          return e4;
        })(e3), c4 = (function(n3) {
          const e4 = n3.trim().split(/->/);
          let r6 = [];
          e4.forEach((n4) => {
            r6 = r6.concat((function(n5) {
              if (!(n5 = n5.trim())) return null;
              if (/^\[/.test(n5) && /\]$/.test(n5)) {
                let e5 = (n5 = (n5 = n5.replace(/^\[/, "")).replace(/\]$/, "")).split(/,/);
                return e5 = e5.map((t3) => t3.trim()).filter(Boolean), e5 = e5.map((n6) => t2({ id: n6 })), e5;
              }
              return [t2({ id: n5 })];
            })(n4));
          }), r6 = r6.filter(Boolean);
          let s4 = r6[0];
          for (let t3 = 1; t3 < r6.length; t3 += 1) s4.children.push(r6[t3]), s4 = r6[t3];
          return r6[0];
        })(e3);
        c4 && s3.push({ indent: r5, node: c4 });
      });
      const c3 = s3.reduce((t3, n3) => Math.min(t3, n3.indent), 1 / 0);
      s3.forEach((t3) => {
        t3.indent -= c3;
      });
      let o2 = (function(t3) {
        const n3 = { children: [] };
        return t3.forEach((e3, r5) => {
          if (0 === e3.indent) n3.children = n3.children.concat(e3.node);
          else if (t3[r5 - 1]) {
            const n4 = (function(t4, n5) {
              const e4 = t4[n5].indent;
              for (; n5 >= 0; n5 -= 1) if (t4[n5].indent < e4) return t4[n5];
              return t4[0];
            })(t3, r5);
            n4.node.children.push(e3.node);
          }
        }), n3;
      })(s3);
      return o2 = t2(o2), o2;
    })(r3) : s(r3) ? (function(n3) {
      const r4 = /* @__PURE__ */ new Map();
      (n3 = n3.map((n4) => t2({ ...n4, children: [] }))).forEach((t3) => {
        r4.set(t3.id, t3);
      });
      const s3 = t2({});
      return n3.forEach((t3) => {
        if (t3.parent) if (r4.has(t3.parent)) {
          const n4 = r4.get(t3.parent);
          delete t3.parent, n4.children.push(t3);
        } else console.warn(`[Grad] - missing node '${t3.parent}'`);
        else s3.children.push(t3);
      }), e(n3), s3;
    })(r3) : ((n3) => {
      for (const r4 of e([n3])) t2(r4);
      return n3;
    })(r3);
  })(r2);
  return new j(c2);
};

// node_modules/compromise/src/1-one/tag/methods/addTags/_colors.js
var colors = {
  Noun: "blue",
  Verb: "green",
  Negative: "green",
  Date: "red",
  Value: "red",
  Adjective: "magenta",
  Connector: "cyan",
  Determiner: "cyan",
  Hyphenated: "cyan",
  Adverb: "cyan"
};
var colors_default = colors;

// node_modules/compromise/src/1-one/tag/methods/addTags/02-fmt.js
var getColor = function(node) {
  if (Object.hasOwn(colors_default, node.id)) {
    return colors_default[node.id];
  }
  if (Object.hasOwn(colors_default, node.is)) {
    return colors_default[node.is];
  }
  const found = node._cache.parents.find((c2) => colors_default[c2]);
  return colors_default[found];
};
var fmt = function(nodes) {
  const res = {};
  nodes.forEach((node) => {
    const { not, also, is, novel } = node.props;
    let parents = node._cache.parents;
    if (also) {
      parents = parents.concat(also);
    }
    res[node.id] = {
      is,
      not,
      novel,
      also,
      parents,
      children: [],
      color: getColor(node),
      alias: node.alias
    };
  });
  const resolved = /* @__PURE__ */ new Set();
  const resolving = /* @__PURE__ */ new Set();
  const resolveParents = function(tag) {
    if (resolved.has(tag)) {
      return res[tag].parents;
    }
    if (resolving.has(tag)) {
      throw new Error(`compromise: cyclic tag inheritance at '${tag}'`);
    }
    resolving.add(tag);
    const parents = /* @__PURE__ */ new Set();
    res[tag].parents.forEach((parent) => {
      if (res[parent]) {
        resolveParents(parent).forEach((ancestor) => parents.add(ancestor));
      }
      parents.add(parent);
    });
    res[tag].parents = Array.from(parents);
    resolving.delete(tag);
    resolved.add(tag);
    return res[tag].parents;
  };
  Object.keys(res).forEach((tag) => resolveParents(tag));
  Object.keys(res).forEach((tag) => {
    res[tag].parents.forEach((parent) => {
      if (res[parent]) {
        res[parent].children.push(tag);
      }
    });
  });
  const exclusions = {};
  Object.keys(res).forEach((tag) => {
    exclusions[tag] = res[tag].not;
  });
  Object.keys(res).forEach((k2) => {
    const nots = new Set(exclusions[k2]);
    res[k2].parents.forEach((parent) => {
      for (const not of exclusions[parent] || []) {
        nots.add(not);
      }
    });
    Array.from(nots).forEach((not) => {
      if (res[not]) {
        res[not].children.forEach((tag) => nots.add(tag));
      }
    });
    res[k2].not = Array.from(nots);
    lib_default5(res[k2].not);
    lib_default5(res[k2].children);
    const conflicts = [k2, ...res[k2].parents].filter((tag) => nots.has(tag));
    if (conflicts.length > 0) {
      const names = conflicts.map((tag) => `#${tag}`).join(", ");
      console.warn(`compromise: contradictory tag '#${k2}' requires and excludes: ${names}`);
    }
  });
  return res;
};
var fmt_default = fmt;

// node_modules/compromise/src/1-one/tag/methods/addTags/01-validate.js
var toArr = function(input) {
  if (!input) {
    return [];
  }
  if (typeof input === "string") {
    return [input];
  }
  return input.slice();
};
var addImplied = function(tags2) {
  Object.keys(tags2).forEach((k2) => {
    if (tags2[k2].isA) {
      tags2[k2].is = tags2[k2].isA;
    }
    if (tags2[k2].notA) {
      tags2[k2].not = tags2[k2].notA;
    }
    if (tags2[k2].is && typeof tags2[k2].is === "string") {
      if (!Object.hasOwn(tags2, tags2[k2].is)) {
        tags2[tags2[k2].is] = {};
      }
    }
    toArr(tags2[k2].also).forEach((parent) => {
      if (!Object.hasOwn(tags2, parent)) {
        tags2[parent] = {};
      }
    });
    toArr(tags2[k2].not).forEach((excluded) => {
      if (!Object.hasOwn(tags2, excluded)) {
        tags2[excluded] = {};
      }
    });
  });
  return tags2;
};
var validate = function(tags2, already) {
  tags2 = Object.fromEntries(Object.entries({ ...already, ...tags2 }).map(([tag, definition]) => [tag, { ...definition }]));
  tags2 = addImplied(tags2);
  Object.keys(tags2).forEach((k2) => {
    tags2[k2].children = toArr(tags2[k2].children);
    tags2[k2].not = toArr(tags2[k2].not);
    if (tags2[k2].also) {
      tags2[k2].also = toArr(tags2[k2].also);
    }
  });
  Object.keys(tags2).forEach((k2) => {
    const nots = tags2[k2].not || [];
    nots.forEach((no) => {
      if (tags2[no] && tags2[no].not && !tags2[no].not.includes(k2)) {
        tags2[no].not.push(k2);
      }
    });
  });
  return tags2;
};
var validate_default = validate;

// node_modules/compromise/src/1-one/tag/methods/addTags/index.js
var compute3 = function(allTags2) {
  const flatList = Object.keys(allTags2).map((k2) => {
    const o2 = allTags2[k2];
    const props = { not: new Set(o2.not), also: o2.also, is: o2.is, novel: o2.novel };
    return { id: k2, parent: o2.is, props, children: [], alias: o2.alias };
  });
  const graph = g(flatList).cache().fillDown();
  return graph.out("array");
};
var fromUser = function(tags2) {
  Object.keys(tags2).forEach((k2) => {
    tags2[k2] = { ...tags2[k2] };
    tags2[k2].novel = true;
  });
  return tags2;
};
var addTags = function(tags2, already) {
  tags2 = Object.fromEntries(Object.entries(tags2).map(([tag, definition]) => [tag, { ...definition }]));
  if (Object.keys(already).length > 0) {
    tags2 = fromUser(tags2);
  }
  tags2 = validate_default(tags2, already);
  const nodes = compute3(tags2);
  const res = fmt_default(nodes);
  return res;
};
var addTags_default = addTags;

// node_modules/compromise/src/1-one/tag/methods/index.js
var methods_default7 = {
  one: {
    setTag: setTag_default,
    unTag: unTag_default,
    addTags: addTags_default,
    canBe: canBe_default2
  }
};

// node_modules/compromise/src/1-one/tag/api/tag.js
var fns5 = {
  /** add a given tag, to all these terms */
  tag: function(input, reason2 = "", isSafe) {
    if (!this.found || !input) {
      return this;
    }
    const terms = this.termList();
    if (terms.length === 0) {
      return this;
    }
    const { methods: methods19, verbose: verbose2, world: world2 } = this;
    if (verbose2 === true) {
      console.log(" +  ", input, reason2 || "");
    }
    if (Array.isArray(input)) {
      input.forEach((tag) => methods19.one.setTag(terms, tag, world2, isSafe, reason2));
    } else {
      methods19.one.setTag(terms, input, world2, isSafe, reason2);
    }
    this.uncache();
    return this;
  },
  /** add a given tag, only if it is consistent */
  tagSafe: function(input, reason2 = "") {
    return this.tag(input, reason2, true);
  },
  /** remove a given tag from all these terms */
  unTag: function(input, reason2) {
    if (!this.found || !input) {
      return this;
    }
    const terms = this.termList();
    if (terms.length === 0) {
      return this;
    }
    const { methods: methods19, verbose: verbose2, model: model5 } = this;
    if (verbose2 === true) {
      console.log(" -  ", input, reason2 || "");
    }
    const tagSet = model5.one.tagSet;
    if (Array.isArray(input)) {
      input.forEach((tag) => methods19.one.unTag(terms, tag, tagSet));
    } else {
      methods19.one.unTag(terms, input, tagSet);
    }
    this.uncache();
    return this;
  },
  /** return only the terms that can be this tag  */
  canBe: function(tag) {
    tag = tag.replace(/^#/, "");
    const tagSet = this.model.one.tagSet;
    const canBe3 = this.methods.one.canBe;
    const nope2 = [];
    this.document.forEach((terms, n3) => {
      terms.forEach((term, i3) => {
        if (!canBe3(term, tag, tagSet)) {
          nope2.push([n3, i3, i3 + 1]);
        }
      });
    });
    const noDoc = this.update(nope2);
    return this.difference(noDoc);
  }
};
var tag_default = fns5;

// node_modules/compromise/src/1-one/tag/api/index.js
var tagAPI = function(View2) {
  Object.assign(View2.prototype, tag_default);
};
var api_default8 = tagAPI;

// node_modules/compromise/src/1-one/tag/lib.js
var addTags2 = function(tags2) {
  const { model: model5, methods: methods19 } = this.world();
  const tagSet = model5.one.tagSet;
  const fn = methods19.one.addTags;
  const res = fn(tags2, tagSet);
  model5.one.tagSet = res;
  return this;
};
var lib_default6 = { addTags: addTags2 };

// node_modules/compromise/src/1-one/tag/compute/tagRank.js
var boringTags = /* @__PURE__ */ new Set(["Auxiliary", "Possessive"]);
var sortByKids = function(tags2, tagSet) {
  tags2 = tags2.sort((a2, b) => {
    if (boringTags.has(a2) || !Object.hasOwn(tagSet, b)) {
      return 1;
    }
    if (boringTags.has(b) || !Object.hasOwn(tagSet, a2)) {
      return -1;
    }
    let kids = tagSet[a2].children || [];
    const aKids = kids.length;
    kids = tagSet[b].children || [];
    const bKids = kids.length;
    return aKids - bKids;
  });
  return tags2;
};
var tagRank = function(view) {
  const { document, world: world2 } = view;
  const tagSet = world2.model.one.tagSet;
  document.forEach((terms) => {
    terms.forEach((term) => {
      const tags2 = Array.from(term.tags);
      term.tagRank = sortByKids(tags2, tagSet);
    });
  });
};
var tagRank_default = tagRank;

// node_modules/compromise/src/1-one/tag/plugin.js
var plugin_default11 = {
  model: {
    one: { tagSet: {} }
  },
  compute: {
    tagRank: tagRank_default
  },
  methods: methods_default7,
  api: api_default8,
  lib: lib_default6
};

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/01-simple-split.js
var stops = new Set(".!?\u203D\u2E18\u203C\u2047\u2048\u2049\u0964\u0965\u061F\u06D4\u0589\u1362\u1367\u104B\u17D4\u3002");
var cjkStops = new Set("\u3002\uFF01\uFF1F\uFF61");
var openers = new Set("\u300C\u300E\uFF08\u3010\u3014\u300A\u3008\u201C");
var closers = new Set("\u300D\u300F\uFF09\u3011\u3015\u300B\u3009\u201D");
var whitespace2 = /\s/;
var splitsOnly = /^[.!?‽⸘‼\u2047-\u2049।॥؟۔։።፧။។。]+\s$/;
var splitsOnlyCjk = /^(?:[.!?‽⸘‼\u2047-\u2049।॥؟۔։።፧။។。！？｡]+\s|[。！？｡]+[」』）】〕》〉”]*)$/;
var newLine = /((?:\r?\n|\r)+)/;
var basicSplit = function(text6) {
  const all4 = [];
  const isCjk = /[。！？｡]/.test(text6);
  const activeStops = isCjk ? /* @__PURE__ */ new Set([...stops, ...cjkStops]) : stops;
  for (const line of text6.split(newLine)) {
    let start2 = 0;
    const arr = [];
    const emit = (from, end2) => {
      arr.push(line.slice(start2, from), line.slice(from, end2));
      start2 = end2;
    };
    let i3 = 0;
    while (i3 < line.length) {
      if (!activeStops.has(line[i3])) {
        i3++;
        continue;
      }
      const runStart = i3;
      while (i3 < line.length && activeStops.has(line[i3])) i3++;
      if (i3 < line.length && whitespace2.test(line[i3])) {
        emit(runStart, i3 + 1);
        i3++;
        continue;
      }
      if (!isCjk) continue;
      let j2 = runStart;
      while (j2 < i3) {
        if (!cjkStops.has(line[j2])) {
          j2++;
          continue;
        }
        const from = j2;
        while (j2 < i3 && cjkStops.has(line[j2])) j2++;
        let end2 = j2;
        while (end2 < line.length && closers.has(line[end2])) end2++;
        if (end2 === j2 || end2 === line.length || whitespace2.test(line[end2]) || openers.has(line[end2])) {
          emit(from, end2);
          if (end2 > i3) i3 = end2;
        }
      }
    }
    arr.push(line.slice(start2));
    for (let k2 = 0; k2 < arr.length; k2++) {
      const next = arr[k2 + 1];
      if (next && (isCjk ? splitsOnlyCjk : splitsOnly).test(next)) {
        arr[k2] += next;
        arr[k2 + 1] = "";
      }
      if (arr[k2]) all4.push(arr[k2]);
    }
  }
  return all4;
};
var simple_split_default = basicSplit;

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/02-simple-merge.js
var hasLetter = /[\p{L}\p{N}\p{So}]/u;
var hasSomething = /\S/;
var notEmpty = function(splits) {
  const chunks2 = [];
  for (let i3 = 0; i3 < splits.length; i3++) {
    const s3 = splits[i3];
    if (s3 === void 0 || s3 === "") {
      continue;
    }
    if (hasSomething.test(s3) === false || hasLetter.test(s3) === false) {
      if (chunks2[chunks2.length - 1]) {
        chunks2[chunks2.length - 1] += s3;
        continue;
      } else if (splits[i3 + 1]) {
        splits[i3 + 1] = s3 + splits[i3 + 1];
        continue;
      }
    }
    chunks2.push(s3);
  }
  return chunks2;
};
var simple_merge_default = notEmpty;

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/03-smart-merge.js
var hasNewline = function(c2) {
  return Boolean(/\n$/.test(c2));
};
var smartMerge = function(chunks2, world2) {
  const isSentence2 = world2.methods.one.tokenize.isSentence;
  const abbrevs = world2.model.one.abbreviations || /* @__PURE__ */ new Set();
  const sentences = [];
  for (let i3 = 0; i3 < chunks2.length; i3++) {
    const c2 = chunks2[i3];
    if (chunks2[i3 + 1] && !isSentence2(c2, abbrevs) && !hasNewline(c2)) {
      chunks2[i3 + 1] = c2 + (chunks2[i3 + 1] || "");
    } else if (c2 && c2.length > 0) {
      sentences.push(c2);
      chunks2[i3] = "";
    }
  }
  return sentences;
};
var smart_merge_default = smartMerge;

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/04-quote-merge.js
var MAX_QUOTE = 280;
var pairs = {
  '"': '"',
  // 'StraightDoubleQuotes'
  "\uFF02": "\uFF02",
  // 'StraightDoubleQuotesWide'
  // '\u0027': '\u0027', // 'StraightSingleQuotes'
  "\u201C": "\u201D",
  // 'CommaDoubleQuotes'
  // '\u2018': '\u2019', // 'CommaSingleQuotes'
  "\u201F": "\u201D",
  // 'CurlyDoubleQuotesReversed'
  // '\u201B': '\u2019', // 'CurlySingleQuotesReversed'
  "\u201E": "\u201D",
  // 'LowCurlyDoubleQuotes'
  "\u2E42": "\u201D",
  // 'LowCurlyDoubleQuotesReversed'
  "\u201A": "\u2019",
  // 'LowCurlySingleQuotes'
  "\xAB": "\xBB",
  // 'AngleDoubleQuotes'
  "\u2039": "\u203A",
  // 'AngleSingleQuotes'
  "\u2035": "\u2032",
  // 'PrimeSingleQuotes'
  "\u2036": "\u2033",
  // 'PrimeDoubleQuotes'
  "\u2037": "\u2034",
  // 'PrimeTripleQuotes'
  "\u301D": "\u301E",
  // 'PrimeDoubleQuotes'
  // '\u0060': '\u00B4', // 'PrimeSingleQuotes'
  "\u301F": "\u301E",
  // 'LowPrimeDoubleQuotesReversed'
  "\u300C": "\u300D",
  // 'CornerBrackets' 「」
  "\u300E": "\u300F"
  // 'WhiteCornerBrackets' 『』
};
var openQuote = RegExp("[" + Object.keys(pairs).join("") + "]", "g");
var closeQuote = RegExp("[" + Object.values(pairs).join("") + "]", "g");
var closesQuote = function(str) {
  if (!str) {
    return false;
  }
  const m3 = str.match(closeQuote);
  if (m3 !== null && m3.length === 1) {
    return true;
  }
  return false;
};
var quoteMerge = function(splits) {
  const arr = [];
  for (let i3 = 0; i3 < splits.length; i3 += 1) {
    const split3 = splits[i3];
    const m3 = split3.match(openQuote);
    if (m3 !== null && m3.length === 1) {
      const closed = split3.match(closeQuote);
      if (closed !== null && closed[0] !== m3[0]) {
        arr.push(split3);
        continue;
      }
      if (closesQuote(splits[i3 + 1]) && splits[i3 + 1].length < MAX_QUOTE) {
        splits[i3] += splits[i3 + 1];
        arr.push(splits[i3]);
        splits[i3 + 1] = "";
        i3 += 1;
        continue;
      }
      if (closesQuote(splits[i3 + 2])) {
        const toAdd = splits[i3 + 1] + splits[i3 + 2];
        if (toAdd.length < MAX_QUOTE) {
          splits[i3] += toAdd;
          arr.push(splits[i3]);
          splits[i3 + 1] = "";
          splits[i3 + 2] = "";
          i3 += 2;
          continue;
        }
      }
    }
    arr.push(splits[i3]);
  }
  return arr;
};
var quote_merge_default = quoteMerge;

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/05-parens-merge.js
var MAX_LEN = 250;
var hasOpen = /[(\uFF08]/g;
var hasClosed = /[)\uFF09]/g;
var mergeParens = function(splits) {
  const arr = [];
  for (let i3 = 0; i3 < splits.length; i3 += 1) {
    const split3 = splits[i3];
    const m3 = split3.match(hasOpen);
    if (m3 !== null && m3.length === 1) {
      if (splits[i3 + 1] && splits[i3 + 1].length < MAX_LEN) {
        const m22 = splits[i3 + 1].match(hasClosed);
        if (m22 !== null && m3.length === 1 && !hasOpen.test(splits[i3 + 1])) {
          splits[i3] += splits[i3 + 1];
          arr.push(splits[i3]);
          splits[i3 + 1] = "";
          i3 += 1;
          continue;
        }
      }
    }
    arr.push(splits[i3]);
  }
  return arr;
};
var parens_merge_default = mergeParens;

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/index.js
var hasSomething2 = /\S/;
var startWhitespace = /^\s+/;
var splitSentences = function(text6, world2) {
  text6 ||= "";
  text6 = String(text6);
  if (!text6 || typeof text6 !== "string" || hasSomething2.test(text6) === false) {
    return [];
  }
  const splits = simple_split_default(text6);
  let sentences = simple_merge_default(splits);
  sentences = smart_merge_default(sentences, world2);
  sentences = quote_merge_default(sentences);
  sentences = parens_merge_default(sentences);
  if (sentences.length === 0) {
    return [text6];
  }
  for (let i3 = 1; i3 < sentences.length; i3 += 1) {
    const ws = sentences[i3].match(startWhitespace);
    if (ws !== null) {
      sentences[i3 - 1] += ws[0];
      sentences[i3] = sentences[i3].replace(startWhitespace, "");
    }
  }
  return sentences;
};
var sentences_default = splitSentences;

// node_modules/compromise/src/1-one/tokenize/methods/web.js
var email = /^[\w.!#$%&'*+/=?^`{|}~-]+@(?:[\w-]+\.)+[a-z]{2,}$/i;
var explicitUrl = /^(?:https?:(?:\/\/)?|www\.)(?:[a-z0-9-]+\.)+[a-z]{2,}(?::[0-9]+)?(?:[/?#]\S*)?$/i;
var bareUrl = /^(?:[a-z0-9-]+\.)+(?:com|net|gov|org|ly|edu|info|biz|dev|ru|jp|de|in|uk|br|io|ai)(?::[0-9]+)?(?:[/?#]\S*)?$/i;
var isWebToken = function(str) {
  if (!str.includes(".")) {
    return false;
  }
  let start2 = 0;
  let end2 = str.length;
  while (start2 < end2 && /[\s("'“‘<]/.test(str[start2])) start2++;
  while (end2 > start2 && /[\s).,!?:;"'”’>]/.test(str[end2 - 1])) end2--;
  const text6 = str.slice(start2, end2);
  return email.test(text6) || explicitUrl.test(text6) || bareUrl.test(text6);
};

// node_modules/compromise/src/1-one/tokenize/methods/02-terms/01-hyphens.js
var hasHyphen2 = function(str, model5) {
  const parts = str.split(/[-–—]/);
  if (parts.length <= 1) {
    return false;
  }
  if (isWebToken(str)) {
    return false;
  }
  const { prefixes: prefixes2, suffixes: suffixes5 } = model5.one;
  if (parts[0].length === 1 && /[a-z]/i.test(parts[0])) {
    return false;
  }
  if (Object.hasOwn(prefixes2, parts[0])) {
    return false;
  }
  parts[1] = parts[1].trim().replace(/[.?!]$/, "");
  if (Object.hasOwn(suffixes5, parts[1])) {
    return false;
  }
  const reg = /^([a-z\u00C0-\u00FF`"'/]+)[-–—]([a-z0-9\u00C0-\u00FF].*)/i;
  if (reg.test(str) === true) {
    return true;
  }
  const reg2 = /^[('"]?([0-9]{1,4})[-–—]([a-z\u00C0-\u00FF`"'/-]+[)'"]?$)/i;
  if (reg2.test(str) === true) {
    return true;
  }
  return false;
};
var splitHyphens2 = function(word) {
  const arr = [];
  const hyphens = word.split(/[-–—]/);
  let whichDash = "-";
  const found = word.match(/[-–—]/);
  if (found && found[0]) {
    whichDash = found;
  }
  for (let o2 = 0; o2 < hyphens.length; o2++) {
    if (o2 === hyphens.length - 1) {
      arr.push(hyphens[o2]);
    } else {
      arr.push(hyphens[o2] + whichDash);
    }
  }
  return arr;
};

// node_modules/compromise/src/1-one/tokenize/methods/02-terms/03-ranges.js
var combineRanges = function(arr) {
  const startRange = /^[0-9]{1,4}(:[0-9][0-9])?([a-z]{1,2})? ?[-–—] ?$/;
  const endRange = /^[0-9]{1,4}([a-z]{1,2})? ?$/;
  for (let i3 = 0; i3 < arr.length - 1; i3 += 1) {
    if (arr[i3 + 1] && startRange.test(arr[i3]) && endRange.test(arr[i3 + 1])) {
      arr[i3] = arr[i3] + arr[i3 + 1];
      arr[i3 + 1] = null;
    }
  }
  return arr;
};
var ranges_default = combineRanges;

// node_modules/compromise/src/1-one/tokenize/methods/02-terms/02-slashes.js
var isSlash = /\p{L} ?\/ ?\p{L}+$/u;
var combineSlashes = function(arr) {
  for (let i3 = 1; i3 < arr.length - 1; i3++) {
    if (isSlash.test(arr[i3])) {
      arr[i3 - 1] += arr[i3] + arr[i3 + 1];
      arr[i3] = null;
      arr[i3 + 1] = null;
    }
  }
  return arr;
};
var slashes_default = combineSlashes;

// node_modules/compromise/src/1-one/tokenize/methods/02-terms/index.js
var wordlike = /\S/;
var isBoundary = /^[!?.]+$/;
var naiiveSplit = /(\S+)/;
var notWord = [
  ".",
  "?",
  "!",
  ":",
  ";",
  "-",
  "\u2013",
  "\u2014",
  "--",
  "...",
  "(",
  ")",
  "[",
  "]",
  '"',
  "'",
  "`",
  "\xAB",
  "\xBB",
  "*",
  "\u2022"
];
notWord = notWord.reduce((h2, c2) => {
  h2[c2] = true;
  return h2;
}, {});
var splitWords = function(str, model5) {
  let result = [];
  let arr = [];
  str ||= "";
  if (typeof str === "number") {
    str = String(str);
  }
  if (Array.isArray(str)) {
    return str;
  }
  const words = str.split(naiiveSplit);
  for (let i3 = 0; i3 < words.length; i3++) {
    if (hasHyphen2(words[i3], model5) === true) {
      arr = arr.concat(splitHyphens2(words[i3]));
      continue;
    }
    arr.push(words[i3]);
  }
  let carry = "";
  for (let i3 = 0; i3 < arr.length; i3++) {
    const word = arr[i3];
    if (wordlike.test(word) === true && Object.hasOwn(notWord, word) === false && isBoundary.test(word) === false) {
      if (result.length > 0) {
        result[result.length - 1] += carry;
        result.push(word);
      } else {
        result.push(carry + word);
      }
      carry = "";
    } else {
      carry += word;
    }
  }
  if (carry) {
    if (result.length === 0) {
      result[0] = "";
    }
    result[result.length - 1] += carry;
  }
  result = slashes_default(result);
  result = ranges_default(result);
  result = result.filter((s3) => s3);
  return result;
};
var terms_default = splitWords;

// node_modules/compromise/src/1-one/tokenize/methods/03-whitespace/tokenize.js
var isLetter = /\p{Letter}/u;
var isNumber = /[\p{Number}\p{Currency_Symbol}]/u;
var hasAcronym = /^[a-z]\.([a-z]\.)+/i;
var chillin = /[sn]['’]$/;
var isFullNumber = /^[(+\-]?\d+(th|st|nd|rd)?[)+\-]?$/;
var normalizePunctuation = function(str, model5) {
  const { prePunctuation: prePunctuation2, postPunctuation: postPunctuation2, emoticons: emoticons2 } = model5.one;
  const original = str;
  let pre = "";
  let post = "";
  const chars = Array.from(str);
  let start2 = 0;
  let end2 = chars.length;
  if (Object.hasOwn(emoticons2, str.trim())) {
    return { str: str.trim(), pre, post: " " };
  }
  while (start2 < end2) {
    const c2 = chars[start2];
    if (prePunctuation2[c2] === true) {
      break;
    }
    if ((c2 === "+" || c2 === "-" || c2 === "(") && isFullNumber.test(str.trim())) {
      break;
    }
    if (c2 === "'" && c2.length === 3 && isNumber.test(chars[start2 + 1])) {
      break;
    }
    if (isLetter.test(c2) || isNumber.test(c2)) {
      break;
    }
    start2++;
  }
  while (end2 > start2) {
    const c2 = chars[end2 - 1];
    if (postPunctuation2[c2] === true) {
      break;
    }
    if (isLetter.test(c2) || isNumber.test(c2)) {
      break;
    }
    if (c2 === "." && hasAcronym.test(original) === true) {
      break;
    }
    if (c2 === "'" && chillin.test(original) === true) {
      break;
    }
    if ((c2 === "+" || c2 === ")") && isFullNumber.test(str.trim())) {
      break;
    }
    end2--;
  }
  pre = chars.slice(0, start2).join("");
  post = chars.slice(end2).join("");
  str = chars.slice(start2, end2).join("");
  if (str === "") {
    let last = original.length;
    while (last > 0 && original[last - 1] === " ") last--;
    post = original.slice(last);
    str = original.slice(0, last);
    pre = "";
  }
  return { str, pre, post };
};
var tokenize_default = normalizePunctuation;

// node_modules/compromise/src/1-one/tokenize/methods/03-whitespace/index.js
var parseTerm = (txt, model5) => {
  const { str, pre, post } = tokenize_default(txt, model5);
  const parsed = {
    text: str,
    pre,
    post,
    tags: /* @__PURE__ */ new Set()
  };
  return parsed;
};
var whitespace_default2 = parseTerm;

// node_modules/compromise/src/1-one/tokenize/methods/unicode.js
var killUnicode = function(str, world2) {
  const unicode2 = world2.model.one.unicode || {};
  str ||= "";
  const chars = str.split("");
  chars.forEach((s3, i3) => {
    if (unicode2[s3]) {
      chars[i3] = unicode2[s3];
    }
  });
  return chars.join("");
};
var unicode_default = killUnicode;

// node_modules/compromise/src/1-one/tokenize/compute/normal/01-cleanup.js
var trimPunctuation = (str, punctuation) => {
  let end2 = str.length;
  while (end2 > 0 && punctuation.test(str[end2 - 1])) end2--;
  return str.slice(0, end2);
};
var clean = function(str) {
  str ||= "";
  str = str.toLowerCase();
  str = str.trim();
  const original = str;
  str = trimPunctuation(str, /[,;.!?]/);
  str = str.replaceAll("\u2026", "...");
  str = str.replaceAll("\u2013", "-");
  if (/^[:;]/.test(str) === false) {
    str = trimPunctuation(str, /[",.!:;?)]/);
    str = str.replace(/^['"(]+/g, "");
  }
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, "");
  str = str.trim();
  if (str === "") {
    str = original;
  }
  str = str.replace(/([0-9]),([0-9])/g, "$1$2");
  return str;
};
var cleanup_default = clean;

// node_modules/compromise/src/1-one/tokenize/compute/normal/02-acronyms.js
var periodAcronym = /^([A-Z]\.)+[A-Z]?,?$/;
var oneLetterAcronym = /^[A-Z]\.,?$/;
var noPeriodAcronym = /^[A-Z]{2,}('s|,)?$/;
var lowerCaseAcronym = /^([a-z]\.)+[a-z]\.?$/;
var isAcronym = function(str) {
  if (periodAcronym.test(str) === true) {
    return true;
  }
  if (lowerCaseAcronym.test(str) === true) {
    return true;
  }
  if (oneLetterAcronym.test(str) === true) {
    return true;
  }
  if (noPeriodAcronym.test(str) === true) {
    return true;
  }
  return false;
};
var doAcronym = function(str) {
  if (isAcronym(str)) {
    str = str.replace(/\./g, "");
  }
  return str;
};
var acronyms_default = doAcronym;

// node_modules/compromise/src/1-one/tokenize/compute/normal/index.js
var normalize = function(term, world2) {
  const killUnicode2 = world2.methods.one.killUnicode;
  let str = term.text || "";
  str = cleanup_default(str);
  str = killUnicode2(str, world2);
  str = acronyms_default(str);
  term.normal = str;
};
var normal_default = normalize;

// node_modules/compromise/src/1-one/tokenize/methods/parse.js
var parse2 = function(input, world2) {
  const { methods: methods19, model: model5 } = world2;
  const { splitSentences: splitSentences2, splitTerms, splitWhitespace } = methods19.one.tokenize;
  input ||= "";
  const sentences = splitSentences2(input, world2);
  input = sentences.map((txt) => {
    let terms = splitTerms(txt, model5);
    terms = terms.map((t3) => splitWhitespace(t3, model5));
    terms.forEach((t3) => {
      normal_default(t3, world2);
    });
    return terms;
  });
  return input;
};
var parse_default2 = parse2;

// node_modules/compromise/src/1-one/tokenize/methods/01-sentences/is-sentence.js
var isAcronym2 = /[ .][A-Z]\.? *$/i;
var hasEllipse = /(?:\u2026|\.{2}) *$/;
var hasLetter2 = /\p{L}/u;
var hasPeriod = /\. *$/;
var leadInit = /^[A-Z]\. $/;
var isSentence = function(str, abbrevs) {
  if (hasLetter2.test(str) === false) {
    return false;
  }
  if (isAcronym2.test(str) === true) {
    return false;
  }
  if (str.length === 3 && leadInit.test(str)) {
    return false;
  }
  if (hasEllipse.test(str) === true) {
    return false;
  }
  const txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, "");
  const words = txt.split(" ");
  const lastWord = words[words.length - 1].toLowerCase();
  if (Object.hasOwn(abbrevs, lastWord) === true && hasPeriod.test(str) === true) {
    return false;
  }
  return true;
};
var is_sentence_default = isSentence;

// node_modules/compromise/src/1-one/tokenize/methods/index.js
var methods_default8 = {
  one: {
    killUnicode: unicode_default,
    tokenize: {
      splitSentences: sentences_default,
      isSentence: is_sentence_default,
      splitTerms: terms_default,
      splitWhitespace: whitespace_default2,
      fromString: parse_default2
    }
  }
};

// node_modules/compromise/src/1-one/tokenize/model/aliases.js
var aliases = {
  "&": "and",
  "@": "at",
  "%": "percent",
  "plz": "please",
  "bein": "being"
};
var aliases_default = aliases;

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/misc.js
var misc_default = [
  "approx",
  "apt",
  "bc",
  "cyn",
  "eg",
  "esp",
  "est",
  "etc",
  "ex",
  "exp",
  "prob",
  //probably
  "pron",
  // Pronunciation
  "gal",
  //gallon
  "min",
  "pseud",
  "fig",
  //figure
  "jd",
  "lat",
  //latitude
  "lng",
  //longitude
  "vol",
  //volume
  "fm",
  //not am
  "def",
  //definition
  "misc",
  "plz",
  //please
  "ea",
  //each
  "ps",
  "sec",
  //second
  "pt",
  "pref",
  //preface
  "pl",
  //plural
  "pp",
  //pages
  "qt",
  //quarter
  "fr",
  //french
  "sq",
  "nee",
  //given name at birth
  "ss",
  //ship, or sections
  "tel",
  "temp",
  "vet",
  "ver",
  //version
  "fem",
  //feminine
  "masc",
  //masculine
  "eng",
  //engineering/english
  "adj",
  //adjective
  "vb",
  //verb
  "rb",
  //adverb
  "inf",
  //infinitive
  "situ",
  // in situ
  "vivo",
  "vitro",
  "wr"
  //world record
];

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/honorifics.js
var honorifics_default = [
  "adj",
  "adm",
  "adv",
  "asst",
  "atty",
  "bldg",
  "brig",
  "capt",
  "cmdr",
  "comdr",
  "cpl",
  "det",
  "dr",
  "esq",
  "gen",
  "gov",
  "hon",
  "jr",
  "llb",
  "lt",
  "maj",
  "messrs",
  "mlle",
  "mme",
  "mr",
  "mrs",
  "ms",
  "mstr",
  "phd",
  "prof",
  "pvt",
  "rep",
  "reps",
  "res",
  "rev",
  "sen",
  "sens",
  "sfc",
  "sgt",
  "sir",
  "sr",
  "supt",
  "surg"
  //miss
  //misses
];

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/months.js
var months_default = ["jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"];

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/nouns.js
var nouns_default = [
  "ad",
  "al",
  "arc",
  "ba",
  "bl",
  "ca",
  "cca",
  "col",
  "corp",
  "ft",
  "fy",
  "ie",
  "lit",
  "ma",
  "md",
  "pd",
  "tce"
];

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/organizations.js
var organizations_default = ["dept", "univ", "assn", "bros", "inc", "ltd", "co"];

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/places.js
var places_default = [
  "rd",
  "st",
  "dist",
  "mt",
  "ave",
  "blvd",
  "cl",
  // 'ct',
  "cres",
  "hwy",
  //states
  "ariz",
  "cal",
  "calif",
  "colo",
  "conn",
  "fla",
  "fl",
  "ga",
  "ida",
  "ia",
  "kan",
  "kans",
  "minn",
  "neb",
  "nebr",
  "okla",
  "penna",
  "penn",
  "pa",
  "dak",
  "tenn",
  "tex",
  "ut",
  "vt",
  "va",
  "wis",
  "wisc",
  "wy",
  "wyo",
  "usafa",
  "alta",
  "ont",
  "que",
  "sask"
];

// node_modules/compromise/src/1-one/tokenize/model/abbreviations/units.js
var units_default = [
  "dl",
  "ml",
  "gal",
  // 'ft', //ambiguous
  "qt",
  "pt",
  "tbl",
  "tsp",
  "tbsp",
  "km",
  "dm",
  //decimeter
  "cm",
  "mm",
  "mi",
  "td",
  "hr",
  //hour
  "hrs",
  //hour
  "kg",
  "hg",
  "dg",
  //decigram
  "cg",
  //centigram
  "mg",
  //milligram
  "\xB5g",
  //microgram
  "lb",
  //pound
  "oz",
  //ounce
  "sq ft",
  "hz",
  //hertz
  "mps",
  //meters per second
  "mph",
  "kmph",
  //kilometers per hour
  "kb",
  //kilobyte
  "mb",
  //megabyte
  // 'gb', //ambig
  "tb",
  //terabyte
  "lx",
  //lux
  "lm",
  //lumen
  // 'pa', //ambig
  "fl oz",
  //
  "yb"
];

// node_modules/compromise/src/1-one/tokenize/model/lexicon.js
var list = [
  [misc_default],
  [units_default, "Unit"],
  [nouns_default, "Noun"],
  [honorifics_default, "Honorific"],
  [months_default, "Month"],
  [organizations_default, "Organization"],
  [places_default, "Place"]
];
var abbreviations = {};
var lexicon2 = {};
list.forEach((a2) => {
  a2[0].forEach((w) => {
    abbreviations[w] = true;
    lexicon2[w] = "Abbreviation";
    if (a2[1] !== void 0) {
      lexicon2[w] = [lexicon2[w], a2[1]];
    }
  });
});

// node_modules/compromise/src/1-one/tokenize/model/prefixes.js
var prefixes_default = [
  "anti",
  "bi",
  "co",
  "contra",
  "de",
  "extra",
  "infra",
  "inter",
  "intra",
  "macro",
  "micro",
  "mis",
  "mono",
  "multi",
  "peri",
  "pre",
  "pro",
  "proto",
  "pseudo",
  "re",
  "sub",
  "supra",
  "trans",
  "tri",
  "un",
  "out",
  //out-lived
  "ex"
  //ex-wife
  // 'counter',
  // 'mid',
  // 'out',
  // 'non',
  // 'over',
  // 'post',
  // 'semi',
  // 'super', //'super-cool'
  // 'ultra', //'ulta-cool'
  // 'under',
  // 'whole',
].reduce((h2, str) => {
  h2[str] = true;
  return h2;
}, {});

// node_modules/compromise/src/1-one/tokenize/model/suffixes.js
var suffixes_default = {
  "like": true,
  "ish": true,
  "less": true,
  "able": true,
  "elect": true,
  "type": true,
  "designate": true
  // 'fold':true,
};

// node_modules/compromise/src/1-one/tokenize/model/unicode.js
var compact = {
  "!": "\xA1",
  "?": "\xBF\u0241",
  '"': '\u201C\u201D"\u275D\u275E',
  "'": "\u2018\u201B\u275B\u275C\u2019",
  "-": "\u2014\u2013",
  a: "\xAA\xC0\xC1\xC2\xC3\xC4\xC5\xE0\xE1\xE2\xE3\xE4\xE5\u0100\u0101\u0102\u0103\u0104\u0105\u01CD\u01CE\u01DE\u01DF\u01E0\u01E1\u01FA\u01FB\u0200\u0201\u0202\u0203\u0226\u0227\u023A\u0386\u0391\u0394\u039B\u03AC\u03B1\u03BB\u0410\u0430\u0466\u0467\u04D0\u04D1\u04D2\u04D3\u019B\xE6",
  b: "\xDF\xFE\u0180\u0181\u0182\u0183\u0184\u0185\u0243\u0392\u03B2\u03D0\u03E6\u0411\u0412\u042A\u042C\u0432\u044A\u044C\u0462\u0463\u048C\u048D",
  c: "\xA2\xA9\xC7\xE7\u0106\u0107\u0108\u0109\u010A\u010B\u010C\u010D\u0186\u0187\u0188\u023B\u023C\u037B\u037C\u03F2\u03F9\u03FD\u03FE\u0421\u0441\u0454\u0480\u0481\u04AA\u04AB",
  d: "\xD0\u010E\u010F\u0110\u0111\u0189\u018A\u0221\u018B\u018C",
  e: "\xC8\xC9\xCA\xCB\xE8\xE9\xEA\xEB\u0112\u0113\u0114\u0115\u0116\u0117\u0118\u0119\u011A\u011B\u0190\u0204\u0205\u0206\u0207\u0228\u0229\u0246\u0247\u0388\u0395\u039E\u03A3\u03AD\u03B5\u03BE\u03F5\u0400\u0401\u0415\u0435\u0450\u0451\u04BC\u04BD\u04BE\u04BF\u04D6\u04D7\u1EC5",
  f: "\u0191\u0192\u03DC\u03DD\u04FA\u04FB\u0492\u0493\u017F",
  g: "\u011C\u011D\u011E\u011F\u0120\u0121\u0122\u0123\u0193\u01E4\u01E5\u01E6\u01E7\u01F4\u01F5",
  h: "\u0124\u0125\u0126\u0127\u0195\u01F6\u021E\u021F\u0389\u0397\u0402\u040A\u040B\u041D\u043D\u0452\u045B\u04A2\u04A3\u04A4\u04A5\u04BA\u04BB\u04C9\u04CA",
  I: "\xCC\xCD\xCE\xCF",
  i: "\xEC\xED\xEE\xEF\u0128\u0129\u012A\u012B\u012C\u012D\u012E\u012F\u0130\u0131\u0196\u0197\u0208\u0209\u020A\u020B\u038A\u0390\u03AA\u03AF\u03B9\u03CA\u0406\u0407\u0456\u0457i\u0307",
  j: "\u0134\u0135\u01F0\u0237\u0248\u0249\u03F3\u0408\u0458",
  k: "\u0136\u0137\u0138\u0198\u0199\u01E8\u01E9\u039A\u03BA\u040C\u0416\u041A\u0436\u043A\u045C\u049A\u049B\u049C\u049D\u049E\u049F\u04A0\u04A1",
  l: "\u0139\u013A\u013B\u013C\u013D\u013E\u013F\u0140\u0141\u0142\u019A\u01AA\u01C0\u01CF\u01D0\u0234\u023D\u0399\u04C0\u04CF",
  m: "\u039C\u03FA\u03FB\u041C\u043C\u04CD\u04CE",
  n: "\xD1\xF1\u0143\u0144\u0145\u0146\u0147\u0148\u0149\u014A\u014B\u019D\u019E\u01F8\u01F9\u0220\u0235\u039D\u03A0\u03AE\u03B7\u03DE\u040D\u0418\u0419\u041B\u041F\u0438\u0439\u043B\u043F\u045D\u048A\u048B\u04C5\u04C6\u04E2\u04E3\u04E4\u04E5\u03C0",
  o: "\xD2\xD3\xD4\xD5\xD6\xD8\xF0\xF2\xF3\xF4\xF5\xF6\xF8\u014C\u014D\u014E\u014F\u0150\u0151\u019F\u01A0\u01A1\u01D1\u01D2\u01EA\u01EB\u01EC\u01ED\u01FE\u01FF\u020C\u020D\u020E\u020F\u022A\u022B\u022C\u022D\u022E\u022F\u0230\u0231\u038C\u0398\u039F\u03B8\u03BF\u03C3\u03CC\u03D5\u03D8\u03D9\u03EC\u03F4\u041E\u0424\u043E\u0472\u0473\u04E6\u04E7\u04E8\u04E9\u04EA\u04EB",
  p: "\u01A4\u03A1\u03C1\u03F7\u03F8\u03FC\u0420\u0440\u048E\u048F\xDE",
  q: "\u024A\u024B",
  r: "\u0154\u0155\u0156\u0157\u0158\u0159\u01A6\u0210\u0211\u0212\u0213\u024C\u024D\u0403\u0413\u042F\u0433\u044F\u0453\u0490\u0491",
  s: "\u015A\u015B\u015C\u015D\u015E\u015F\u0160\u0161\u01A7\u01A8\u0218\u0219\u023F\u0405\u0455",
  t: "\u0162\u0163\u0164\u0165\u0166\u0167\u01AB\u01AC\u01AD\u01AE\u021A\u021B\u0236\u023E\u0393\u03A4\u03C4\u03EE\u0422\u0442",
  u: "\xD9\xDA\xDB\xDC\xF9\xFA\xFB\xFC\u0168\u0169\u016A\u016B\u016C\u016D\u016E\u016F\u0170\u0171\u0172\u0173\u01AF\u01B0\u01B1\u01B2\u01D3\u01D4\u01D5\u01D6\u01D7\u01D8\u01D9\u01DA\u01DB\u01DC\u0214\u0215\u0216\u0217\u0244\u03B0\u03C5\u03CB\u03CD",
  v: "\u03BD\u0474\u0475\u0476\u0477",
  w: "\u0174\u0175\u019C\u03C9\u03CE\u03D6\u03E2\u03E3\u0428\u0429\u0448\u0449\u0461\u047F",
  x: "\xD7\u03A7\u03C7\u03D7\u03F0\u0425\u0445\u04B2\u04B3\u04FC\u04FD\u04FE\u04FF",
  y: "\xDD\xFD\xFF\u0176\u0177\u0178\u01B3\u01B4\u0232\u0233\u024E\u024F\u038E\u03A5\u03AB\u03B3\u03C8\u03D2\u03D3\u03D4\u040E\u0423\u0443\u0447\u045E\u0470\u0471\u04AE\u04AF\u04B0\u04B1\u04EE\u04EF\u04F0\u04F1\u04F2\u04F3",
  z: "\u0179\u017A\u017B\u017C\u017D\u017E\u01B5\u01B6\u0224\u0225\u0240\u0396"
};
var unicode = {};
Object.keys(compact).forEach(function(k2) {
  compact[k2].split("").forEach(function(s3) {
    unicode[s3] = k2;
  });
});
for (let i3 = 33; i3 <= 126; i3 += 1) {
  unicode[String.fromCharCode(i3 + 65248)] = String.fromCharCode(i3);
}
var unicode_default2 = unicode;

// node_modules/compromise/src/1-one/tokenize/model/punctuation.js
var prePunctuation = {
  "#": true,
  //#hastag
  "@": true,
  //@atmention
  "_": true,
  //underscore
  "\xB0": true,
  // '+': true,//+4
  // '\\-',//-4  (escape)
  // '.',//.4
  // zero-width chars
  "\u200B": true,
  "\u200C": true,
  "\u200D": true,
  "\uFEFF": true
};
var postPunctuation = {
  "%": true,
  //88%
  "_": true,
  //underscore
  "\xB0": true,
  //degrees, italian ordinal
  // '\'',// sometimes
  // zero-width chars
  "\u200B": true,
  "\u200C": true,
  "\u200D": true,
  "\uFEFF": true
};
var emoticons = {
  "<3": true,
  "</3": true,
  "<\\3": true,
  ":^P": true,
  ":^p": true,
  ":^O": true,
  ":^3": true
};

// node_modules/compromise/src/1-one/tokenize/model/index.js
var model_default2 = {
  one: {
    aliases: aliases_default,
    abbreviations,
    prefixes: prefixes_default,
    suffixes: suffixes_default,
    prePunctuation,
    postPunctuation,
    lexicon: lexicon2,
    //give this one forward
    unicode: unicode_default2,
    emoticons
  }
};

// node_modules/compromise/src/1-one/tokenize/compute/alias.js
var hasSlash = /\//;
var hasDomain = /[a-z]\.[a-z]/i;
var isMath = /[0-9]/;
var addAliases = function(term, world2) {
  const str = term.normal || term.text || term.machine;
  const aliases3 = world2.model.one.aliases;
  if (Object.hasOwn(aliases3, str)) {
    term.alias ||= [];
    term.alias.push(aliases3[str]);
  }
  if (hasSlash.test(str) && !hasDomain.test(str) && !isMath.test(str)) {
    const arr = str.split(hasSlash);
    if (arr.length <= 3) {
      arr.forEach((word) => {
        word = word.trim();
        if (word !== "") {
          term.alias ||= [];
          term.alias.push(word);
        }
      });
    }
  }
  return term;
};
var alias_default = addAliases;

// node_modules/compromise/src/1-one/tokenize/compute/machine.js
var hasDash3 = /^\p{Letter}+-\p{Letter}+$/u;
var doMachine = function(term) {
  let str = term.implicit || term.normal || term.text;
  str = str.replace(/['’]s$/, "");
  str = str.replace(/s['’]$/, "s");
  str = str.replace(/([aeiou][ktrp])in'$/, "$1ing");
  if (hasDash3.test(str)) {
    str = str.replace(/-/g, "");
  }
  str = str.replace(/^[#@]/, "");
  if (str !== term.normal) {
    term.machine = str;
  }
};
var machine_default = doMachine;

// node_modules/compromise/src/1-one/tokenize/compute/freq.js
var freq = function(view) {
  const docs = view.docs;
  const counts = /* @__PURE__ */ Object.create(null);
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      const term = docs[i3][t3];
      const word = term.machine || term.normal;
      counts[word] ??= 0;
      counts[word] += 1;
    }
  }
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      const term = docs[i3][t3];
      const word = term.machine || term.normal;
      term.freq = counts[word];
    }
  }
};
var freq_default = freq;

// node_modules/compromise/src/1-one/tokenize/compute/offset.js
var offset = function(view) {
  let elapsed = 0;
  let index3 = 0;
  const docs = view.document;
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      const term = docs[i3][t3];
      term.offset = {
        index: index3,
        start: elapsed + term.pre.length,
        length: term.text.length
      };
      elapsed += term.pre.length + term.text.length + term.post.length;
      index3 += 1;
    }
  }
};
var offset_default = offset;

// node_modules/compromise/src/1-one/tokenize/compute/reindex.js
var index2 = function(view) {
  const document = view.document;
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let i3 = 0; i3 < document[n3].length; i3 += 1) {
      document[n3][i3].index = [n3, i3];
    }
  }
};
var reindex_default = index2;

// node_modules/compromise/src/1-one/tokenize/compute/wordCount.js
var wordCount2 = function(view) {
  let n3 = 0;
  const docs = view.docs;
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      if (docs[i3][t3].normal === "") {
        continue;
      }
      n3 += 1;
      docs[i3][t3].wordCount = n3;
    }
  }
};
var wordCount_default = wordCount2;

// node_modules/compromise/src/1-one/tokenize/compute/index.js
var termLoop = function(view, fn) {
  const docs = view.docs;
  for (let i3 = 0; i3 < docs.length; i3 += 1) {
    for (let t3 = 0; t3 < docs[i3].length; t3 += 1) {
      fn(docs[i3][t3], view.world);
    }
  }
};
var methods16 = {
  alias: (view) => termLoop(view, alias_default),
  machine: (view) => termLoop(view, machine_default),
  normal: (view) => termLoop(view, normal_default),
  freq: freq_default,
  offset: offset_default,
  index: reindex_default,
  wordCount: wordCount_default
};
var compute_default7 = methods16;

// node_modules/compromise/src/1-one/tokenize/plugin.js
var plugin_default12 = {
  compute: compute_default7,
  methods: methods_default8,
  model: model_default2,
  hooks: ["alias", "machine", "index", "id"]
};

// node_modules/compromise/src/1-one/typeahead/compute.js
var typeahead = function(view) {
  const prefixes2 = view.model.one.typeahead;
  const docs = view.docs;
  if (docs.length === 0 || Object.keys(prefixes2).length === 0) {
    return;
  }
  const lastTerm = docs.at(-1)?.at(-1);
  if (!lastTerm || lastTerm.post) {
    return;
  }
  if (Object.hasOwn(prefixes2, lastTerm.normal)) {
    const found = prefixes2[lastTerm.normal];
    lastTerm.implicit = found;
    lastTerm.machine = found;
    lastTerm.typeahead = true;
    if (view.compute.preTagger) {
      view.last().unTag("*").compute(["lexicon", "preTagger"]);
    }
  }
};
var compute_default8 = { typeahead };

// node_modules/compromise/src/1-one/typeahead/api.js
var autoFill = function() {
  const docs = this.docs;
  if (docs.length === 0) {
    return this;
  }
  const term = docs.at(-1)?.at(-1);
  if (term?.typeahead === true && term.machine) {
    term.text = term.machine;
    term.normal = term.machine;
  }
  return this;
};
var api2 = function(View2) {
  View2.prototype.autoFill = autoFill;
};
var api_default9 = api2;

// node_modules/compromise/src/1-one/typeahead/lib/allPrefixes.js
var getPrefixes = function(arr, opts2, world2) {
  let index3 = {};
  const collisions = [];
  const existing = world2.prefixes || {};
  arr.forEach((str) => {
    str = str.toLowerCase().trim();
    let max3 = str.length;
    if (opts2.max && max3 > opts2.max) {
      max3 = opts2.max;
    }
    for (let size = opts2.min; size < max3; size += 1) {
      const prefix5 = str.substring(0, size);
      if (opts2.safe && Object.hasOwn(world2.model.one.lexicon, prefix5)) {
        continue;
      }
      if (Object.hasOwn(existing, prefix5) === true) {
        collisions.push(prefix5);
        continue;
      }
      if (Object.hasOwn(index3, prefix5) === true) {
        collisions.push(prefix5);
        continue;
      }
      index3[prefix5] = str;
    }
  });
  index3 = { ...existing, ...index3 };
  collisions.forEach((str) => {
    delete index3[str];
  });
  return index3;
};
var allPrefixes_default = getPrefixes;

// node_modules/compromise/src/1-one/typeahead/lib/index.js
var isObject7 = (val) => {
  return Object.prototype.toString.call(val) === "[object Object]";
};
var defaults2 = {
  safe: true,
  min: 3
};
var prepare = function(words = [], opts2 = {}) {
  const model5 = this.model();
  opts2 = { ...defaults2, ...opts2 };
  if (isObject7(words)) {
    Object.assign(model5.one.lexicon, words);
    words = Object.keys(words);
  }
  const prefixes2 = allPrefixes_default(words, opts2, this.world());
  Object.keys(prefixes2).forEach((str) => {
    if (Object.hasOwn(model5.one.typeahead, str)) {
      delete model5.one.typeahead[str];
      return;
    }
    model5.one.typeahead[str] = prefixes2[str];
  });
  return this;
};
var lib_default7 = {
  typeahead: prepare
};

// node_modules/compromise/src/1-one/typeahead/plugin.js
var model3 = {
  one: {
    typeahead: {}
    //set a blank key-val
  }
};
var plugin_default13 = {
  model: model3,
  api: api_default9,
  lib: lib_default7,
  compute: compute_default8,
  hooks: ["typeahead"]
};

// node_modules/compromise/src/one.js
nlp_default.extend(plugin_default2);
nlp_default.extend(plugin_default8);
nlp_default.extend(plugin_default7);
nlp_default.extend(plugin_default9);
nlp_default.extend(plugin_default11);
nlp_default.plugin(plugin_default3);
nlp_default.extend(plugin_default12);
nlp_default.extend(plugin_default4);
nlp_default.plugin(plugin_default);
nlp_default.extend(plugin_default6);
nlp_default.extend(plugin_default13);
nlp_default.extend(plugin_default5);
nlp_default.extend(plugin_default10);
var one_default = nlp_default;

// node_modules/compromise/src/2-two/preTagger/model/irregulars/plurals.js
var plurals_default = {
  // -a
  addendum: "addenda",
  corpus: "corpora",
  criterion: "criteria",
  curriculum: "curricula",
  genus: "genera",
  memorandum: "memoranda",
  opus: "opera",
  ovum: "ova",
  phenomenon: "phenomena",
  referendum: "referenda",
  // -ae
  alga: "algae",
  alumna: "alumnae",
  antenna: "antennae",
  formula: "formulae",
  larva: "larvae",
  nebula: "nebulae",
  vertebra: "vertebrae",
  // -is
  analysis: "analyses",
  axis: "axes",
  diagnosis: "diagnoses",
  parenthesis: "parentheses",
  prognosis: "prognoses",
  synopsis: "synopses",
  thesis: "theses",
  neurosis: "neuroses",
  // -x
  appendix: "appendices",
  index: "indices",
  matrix: "matrices",
  ox: "oxen",
  sex: "sexes",
  // -i
  alumnus: "alumni",
  bacillus: "bacilli",
  cactus: "cacti",
  fungus: "fungi",
  hippopotamus: "hippopotami",
  libretto: "libretti",
  modulus: "moduli",
  nucleus: "nuclei",
  octopus: "octopi",
  radius: "radii",
  stimulus: "stimuli",
  syllabus: "syllabi",
  // -ie
  cookie: "cookies",
  calorie: "calories",
  auntie: "aunties",
  movie: "movies",
  pie: "pies",
  rookie: "rookies",
  tie: "ties",
  zombie: "zombies",
  // -f
  leaf: "leaves",
  loaf: "loaves",
  thief: "thieves",
  // ee-
  foot: "feet",
  goose: "geese",
  tooth: "teeth",
  // -eaux
  beau: "beaux",
  chateau: "chateaux",
  tableau: "tableaux",
  // -ses
  bus: "buses",
  gas: "gases",
  circus: "circuses",
  crisis: "crises",
  virus: "viruses",
  database: "databases",
  excuse: "excuses",
  abuse: "abuses",
  avocado: "avocados",
  barracks: "barracks",
  child: "children",
  clothes: "clothes",
  echo: "echoes",
  embargo: "embargoes",
  epoch: "epochs",
  deer: "deer",
  halo: "halos",
  man: "men",
  woman: "women",
  mosquito: "mosquitoes",
  mouse: "mice",
  person: "people",
  quiz: "quizzes",
  rodeo: "rodeos",
  shoe: "shoes",
  sombrero: "sombreros",
  stomach: "stomachs",
  tornado: "tornados",
  tuxedo: "tuxedos",
  volcano: "volcanoes"
};

// node_modules/compromise/src/2-two/preTagger/model/lexicon/_data.js
var data_default = {
  "Comparative": "true\xA6bett1f0;arth0ew0in0;er",
  "Superlative": "true\xA6earlier",
  "PresentTense": "true\xA6bests,sounds",
  "Condition": "true\xA6lest,unless",
  "PastTense": "true\xA6:d1emac,nageb,tn0;aem,ew;ah,e1i0;as,d;gsm,il,leenk,pael",
  "Participle": "true\xA6:e02gnu00knuZmuws,n2t0;hguos,li0maerd;ps,ub;e8ials,ro7ugeb,w0;ard5e4o0;hs,l2r0s;g0htN;!tZ;b,f;rFs;!htiw;t,ws;ddiLeIkDlBs9t3v0;i1o0;rp,w;g2rd;ae4sah,t0;i1og0;!rG;b,rw0;!er;!b;ir0ohc;!a,pu;laf,o0;ts;a1o0;ps,w1;hs,sr6t1w0;!a;!reD;b,s0;!r0;eAof;br0h,r;of;rhs,s;lc,r0s;!w;no0vod;d1g0hs;!rednu;nu,re1t0;uo;vo",
  "Gerund": "true\xA6accord0be0doin,go0result0stain0;ing",
  "Expression": "true\xA6a0Yb0Uc0Sd0Oe0Mfarew0Lg0FhZjeez,lWmVnToOpLsJtIuFvEw7y0;a5e3i1u0;ck,p;kes,p0;ee,pee;a0p,s;!h;!a,h,y;a5h2o1t0;af,f;rd up,w;atsoever,e1o0;a,ops;e,w;hoo,t;ery w06oila;gh,h0;! 0h,m;huh,oh;here nPsk,ut tut;h0ic;eesh,hh,it,oo;ff,h1l0ow,sst;ease,s,z;ew,ooey;h1i,mg,o0uch,w,y;h,o,ps;! 0h;hTmy go0wT;d,sh;a7evertheless,o0;!pe;eh,mm;ah,eh,m1ol0;!s;ao,fao;aCeBi9o2u0;h,mph,rra0zzC;h,y;l1o0;r6y9;la,y0;! 0;c1moCsmok0;es;ow;!p hip hoor0;ay;ck,e,llo,y;ha1i,lleluj0;ah;!ha;ah,ee4o1r0;eat scott,r;l1od0sh; grief,bye;ly;! whiz;ell;e0h,t cetera,ureka,ww,xcuse me;k,p;'oh,a0rat,uh;m0ng;mit,n0;!it;mon,o0;ngratulations,wabunga;a2oo1r0tw,ye;avo,r;!ya;h,m; 1h0ka,las,men,rgh,ye;!a,em,h,oy;la",
  "Negative": "true\xA6n0;ever,o0;n,t",
  "QuestionWord": "true\xA6how3wh0;at,e1ich,o0y;!m,se;n,re; come,'s",
  "Reflexive": "true\xA6h4it5my5o1the0your2;ir1m1;ne3ur0;sel0;f,ves;er0im0;self",
  "Plural": "true\xA6dick0gre0ones,records;ens",
  "Unit|Noun": "true\xA6cEfDgChBinchAk9lb,m6newt5oz,p4qt,t1y0;ardEd;able1b0ea1sp;!l,sp;spo1;a,t,x;on9;!b,g,i1l,m,p0;h,s;!les;!b,elvin,g,m;!es;g,z;al,b;eet,oot,t;m,up0;!s",
  "Value": "true\xA6a few",
  "Imperative": "true\xA6bewa0come he0;re",
  "Plural|Verb": "true\xA6leaves",
  "Demonym": "true\xA6:!1:#$%&()*:na,ra,ni,ro,il,ne,or;cid#leci,d$i#ps,e0Nh0Ki0Ek0Dn2o1ssiws,t0ysagF;aCiU;al,%p(if;a1e0;ireg2mkrC;buc,c04d#03e01hgfa,i5l4m2omas,rudnoh,uga$c1xet,y0;auga$p,bM)k;in;hsi0rQ;lg),ri;ametaug,euze)v,og#;a#hg,bSdPgMlJnBpoihte,r6s3t1v0;(Btal,urep;a0iah,pyge;*c;a,enod%,in1sur,u$lKy0;al9;ut;ag3e1o0t0Hys;dauce,vi;b8g0;in,la;lub,nuh;a4em$,i3o1&f(Fs0;ob;dec0*emDtse;am;arku,tselQ;bla,d&j,m1ri,uht0;(;anN*;a1iza0ognH;rb;mos,rt02ti;ew&n,l1&0;eg;eb;a0%,obm1;di%rt,hc,n0;ac;iman,m0rR;a0olP;g,z;liJp*ue,&0wbabmiz;k,pag%s;gu,wr;c*2i0;amH%mod,r0xem; otreup,ema,fa;om;avols,eerg;aht,d3hsedalg#b,learsi,#1qari,$taq,t0;arime,iawuk;mo,tsik0;ap;%h,u0;as;c1kazak,s0;ittocs,lew;ezc,)rf,tud;deCisBn8se0;l4manteiv,n0ugut&p;a1i0;hc;bel,dus,p0wiat;aj;agen1ogn0;oc;es;ad,i0;pp(ihp,t)g0;$;sua;ws",
  "Organization": "true\xA6!1:#$%&()*+-.<=>?@[]^_`~:on,er,an,le,ar,re,da,st,il,e ,in,en,te,ca,na,al,to,li,or,de,s ;0:4Q;a3Tb3Bc2Od2He2Df27g1Zh1Ti1Pj1Nk1Ll1Gm12n0Po0Mp0Cqu0Br02sTtHuCv9w3xiaomi,y1;amaha,m?,ou1w?;gov,tube;a4e2iki1_ld trad._g%izati#;&aRpedia;ll~f(go,+1;field,<ghouse;l1rn$ bros;g)=s,l +)et jour@l,m1E;% h[O$iz#,isa,o1;*f#e,l1;kswagMvo;b4kip,n2ps,s1;a ]*y,ps;esco,i1;&v$,>d @ti#s;$,s; mobi&,aco beRd bOe9gi fri*ys,h3im h_t#s,mz,o1witt$;shiba,y1;ota,~r us;.1< ^zzy;b3c(p=3J*-y ma-,gues~w2hol^0s1w2;mash<g pumpk<s,up)m0;ho;ea1lack eyed peas,yrds;ch boys,tl0;l2n3Qs1xa~<+rum=ts;co,la m1F;ef#i?,us;a8ci=]logy,e5iem=s,mirnoff,np,o3pic.gir6qu(e0Ata1ub(u;rbuc1]-;ks;ny,undg(d1;=;a2x pi+o1;ls;g1Wrs;feway,<sburys,&sf_ce,msung;adiohead,b8e4o1y%air;m% empi),y[ 1;b1dutch she4;%k;a3d 1max,vl#;bu1c2Ahot ch-i pepp$s,lob+$;ll;d$~dige+,l madrid;c,s;%tas,iznos;a8bs,e5fiz$,h-ip4i3r1;emi$ 1ud=ti[;&agTo-;nk floyd,zza hut; m_rBs;psi2tro1ugeot;bras,ch<a,@s;!co;l%tir,n1yp[; 2as#ic,*2P;ld @vy,pec,r%g.ju^2xf1;am;us;aAb9e6fl,h5i4o1sa,vid3wa;k2t) *me,v(t1;is;ia;ke,nt=do,ss%,vZ;l,s;c,+&,tf^x,w1; 1sweek;kid~# th.block,y_k0D;a,c;ndos,s2t1;i#[ a?2Po,we+;a,c(,*q;aDcd#[Ce9i6lb,o3tv,y1;spa1;ce;b-,ns%],ody blu0t1;&y cr1_0T;ue;c2t1;as,subisO;hel<,rosoft;di?2rce`~b=z,t[^1;?;id,);ds;c~m-k,t>l,z*;a3e1g,itt& ?es(s; o)[,novo,x1;is,m(k,us; 1bour p(ty;p)sse,z boy;atv,fc,kk,lm,m1o*k;(t;iffy lube,oy divisi#,pm_g%1sa;! chase;bm,hop,k3n1tv;g,>1;l,rpol;ea;a5ew&tt pack1Vi3o1sbc,yun*i;m.`p1n*;ot;tac1zbollah;hi;l^burt#,sbro;=$[ 6hq,ithub,l5mb,o2)= *y,u1;cci,n~n ros0;ldm% sachs,o1;dye1g&;(;axo smith kl<e,=coW;e&ctric,m1;o]rs;a5bi,c b(celo4*,e`x,i2&etwood mac,o1ri] lay;rd,xcY;at,fa,n%ci[1)+oZ; tim0;@;cebook,nni.mae;bay,sa,u3xx#1; m1m1;ob-;!rosceptics;aiml$,e5isney,o4u1;nk< d#u2p#t,r% dur1;%;ts;j,w j#0;a,f &pp12ll,pech.mo`,r spiegel,+<y'~chi1;ld;aJbc,hFiDloudflaCnn,o3r1;aigs^5eed=c.c&(wat$ )viv1ossra-;[;c7<ba6l4m1_s,+co;?2p1;aq;+;dplSg1;a>;se;a c1o ch%Q;ola;);a,sco1tigroup;! sy+ems;ev2i1;ck f- a,@ *-y;r1y;#;d2pit[ o1rl~jr;ne;bury,-l1;ac;aEbc,eBf9l5mw,ni,o1p,)xi>eU;ei3mb(diI+# 1;glo1pizza;be;ng;o2u.c1;roV;ckbu+$ vi`o,om<g*1;&; g1g1;oodriL;cht2.ge0rkshi) hathaw1;ay;el;c(di,idu,n%a )publ3s1xt5y5;f,k< robbi1;ns;ic;bYcTdidS$osmith,iRlKmEnheus$ busDol,pp&Ar6s4u3v2y1;$;is,#;di,]`sk;hl%d o1socia>d E;-;b3g2m1;co;os;ys; compu1be0;>1;rs;ch;c,d,$ic%3t1;!r1;ak; ex1;p)1;ss; 5?>l2ta1;ir;! lu1;ce1;nt;jaze$a,qae1;*;g,rbnb;as;/dc,a3$,tivisi#1;! b^zz1;(d;`my of sci=c0;es;ba",
  "Possessive": "true\xA6its,my,our0thy;!s",
  "Noun|Verb": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:ts,er,ps,rt,ed,hc,hs,ra,oc,ni,rc,xe,ca,ar,lf,na,el,ne,ro,us,op,rp;0:AN;1:AB;2:8S;3:AV;4:AI;bB7ci@p,dA3e60f5Xg5Oh50iks,k4Cl3Rm3In2Zo2Yp2Er1Ks19tRwNxKy7z5;tilb,z5;aj,u7X;aFbbol,dEeCl9p8r7spoib,t6v5;[,];ip,+p;c,f,^w;-,s;f,la6p5;$,p_;r,t;k5~,vr_;!nom;em1u#;l5p,r%,#;(,p8J;a6(.,i5ob;f,m;t,w;alc,e6o5;*,l6Vns,rht,v;iv5/s;!$,ret.;a0Jbuod,c0Ce0Af07hgi05iZlYnMoKpmetta,rFs6t-yob,u5<t;b(,c;aBe9i8o7u5;ah<,b,l,r5;!ht,t;c,ob,p,rf;l,ssa,wt;gid,r5t7Iuq1v+h;!et.;c5o3Rr2X;!daorb,$of;a8e7o5u0;fm0p5s1;$,p_,<;s6Rvn0;d,),p,#4;ir,o5%,&,vip;b,l,r;aEe9i8u5;ah,h,o5;c5m;!=;ap,h,`,~;c=,i^,m6r,sn0t5;ap,.;[p5g>f,i8Am0ucod;m5p_;i,-;lp,r5;!+w;eb,_1;aw,b9d$c,f8h,l7m6p,rem,s5_;iv,`(;il,m0ov,rep;%,s;!e]b;!ih<,^;f,l5;(,hgih;>6i5;g,*,l,rd;c,d;b,g5k+m,n,p,rg1s;dub,+t;aAe6i?n0u5;dn0r#n0;f7j5lgen,%1;b5$,o3;o,_;(,fe;!pmi,&<,tn0;bm0e6m^f,o5r;c,?;b,f(,h2Qp1&,s,ws;aEs6u5;cof,ovz(n1;apBe7i6o5uf;lg,/,t;k,m;c7m,n+h,r5ug;d5go3p,#;!da;=,o3;!revo,yb;g,ib;aWeDiaCo9u5;lb,o5%;b6l0m+,n9t,va5;f,?;al,+h;bal,)Al0n6rrim,sno%,t5va?;=f1inom;oh;!),p4;dKeJfHgGhtaew,mmah,n@m,pEtAv8w5;o6s5;@;?,p;i5-;*,uq;aw,l7n6s5tam;am,ig1;ec,u-];a,e*,if;m5s55;et;gi&,@;f5s@&;o,ub;),p,#;now,r5;o5um;!b,$;b,cs,e5#,w;b,f,g,t,w2;aMeKiElDmAo5s>g;h7m,o6p,r5t2;c,d,p;p,#;!s5;!k^w;a6u5;b,d,j,l7Op;c,#;eh,ug;d,h8l7r6s5t,z;!sog;!d,g,t;c,f,s;c,s5w;!^w;e5#;ls,/;c,[,l,m,ns,r5;!t,w;d1)e;aMeKgisJiEo9r7u6w5;ay,orf;g,r;e2Lu5;b,t4;it6ri,s5;a1i`;c6is5]m,seuq,uac;@&,`;nuf,ua;a6-,p2ur,w5;!t;g6),r5#;!d,t2;!+b;!(;dr5$cs,p;ub;b,cs,lp,ol,p2;aBe#,i9lif,ooz,r6u5;s,u=v;a6o5;f4#;!f,h0Cla;a5&;!lc;$5h,j,%,r3C;d,#;aMeGiDl7o5ruc;`,r5;tn0;a9e8i6o5;p,r2Tt;k,%,r5;d,g;ms,%,t,y;beye,c4f,#;a6c]p,o5;!f;b,f,m,s,t(;b9c<,dom,e8nn7snu0u6v5;a&,[;d,f;a),ut;f,hw,k,p,r;al;e5ngis,ri%,tot;d,p5s,v1;$,pa;aeRcI$t,lGnDooCr8s5;a6i5;hw,r;!m;a7ims,ow5;!t5;en;b,m1p2;b,h,l;a6i5;!l05rd,s,#;b,r;a5im;t2w;aAe9i7o5uf;d,*,l5m,nk,r;!b,f;k,l5p,&,t2w;!c;),rw;b,h2l,p,r6s,t5;s,ta;!c,t;l,p,rb;cHguGp>gotohp,s9t5;r7u6wo5;rg;om;ow;a9e?,i7u5;p,r5;!b,c;d,f,l5.f,w;$,`;b,c,h,l5m2/,w;f,%;al,-;aCe[,nA+9t6uo5ysp;ls,t;a6$#,i5;b,d,#,ws;c,h,l,m,p2L/s,w;!es;>b,u5;al,p;e5o~pa;l,r5;!b;aCn8o6u5;h,lp;b,f,l5;!atac;a7i5;k1Mr5w2;!%,#;b,g;g,?,rd,t;e6f5oor;a#,u#;eb;b35c2Id2De2Bg1Y)a,i1Wk1Ql14m0Xn0Ro@c,p0Kr07sStGuEv7y6z5;ag,eens,is,oo;d,e;aAi8los1o7r5;es5uc;!$44;l,m;d,)5rd;+;c,*,w;c,l5ssi;av,g;a9i8o7sa6u5;bi&,mm0or,%id;p,t,w;n,v;b,%;b(,cAd9g8h,icos7mi#e,.d^0r5#;!emolgn0t]5;cn0;sa;![W;!nMpu;ilpud,ovda;aGiB]A`,pall0r9u5;a7ba,c<,f1oh5;!$5;aw;c,p;ev1oh,un;cil,s;a8cre<,)@Imo~2Ur6u5;gsid,rb;!pr5;_;p,r3A;b,e6h5;crup,p;l4/U;aFiDoCt]c,u6vueon5;am;c,gif,sa9t5;aef,c6]v,pKr5;ot;a5[;rf;em;c2*,p,#;f,h,s5t,w;(;c2d,*,l5#,uqs;f,g;a7i6o5yt;h,r;p,w2;c6*,r5;!cs;se;ac;i7o6u5;~,t;b,hp,rd,t,z;bm0l5m,p;!c5tuo;(,.;a9it,m>8-l7u5yhr;fr5s1;ep;ew;go3;g,l5n,rf;b,f;aPbKcric,dnJffu*,gHiDkAoh,p9t6u5yT;dehNr;s6t5;ab,ob;ihw;aOmas,u0;c6.r5;%,w;iDub;f7ms,p5t;!k5;coI;!o3;gurGn5;at;ah;b7mu6uo5;&;rg,#;ir5ub;cs;cs,h.;a8i6o5;j,ms,r6;b,h,lsYr5;#;c,?,m1ns,r,#5;!im;l,t;=;aGdDn9r5;a6em,u2;!s;b,)5;!sO;a6[la5ulp;);)5r;!<;e6i5od;rb;!h;!k=p,mad,r,#;p,t5;!@+ug;a6i5-;r0Zs,t,vC;*,r5;g5t;!pu;aNiIlp,n9^7u5;do3r5;%;f,v5;id;a9e5;f,i6l5ref1tnDu?K;is;rep5;<;d,l7n6v5;da;if;ab;fi/Ol8ov7~,t6uj,vr5;es;=3on;!.;`,s;!f5l0Cr;!r5;et5_;.;i5o3uc;rb,v;a01eYiXlTnJoHr7uo6wo5;/;lc;a6-5;=,$;c,g1ob9ug7w5;a,$,r5;of;!ef5;as;!eta5;ks;$;n,o5;?;aBeAi9ob,u5;f4o5;p5rg,s,w;!m0;!$;b,m,rg,w;!b,lb,&;b,h,l,m5rb,#;(,m0;-;ei7ie6o5;f,h,m;*;f,y;a,b,k,ov;e5*;co3f,n,%,rb,s,w;~;e7ol5;!nw5pu;od;h,l6r5;ht,%;!p;ap;ad,m7os,r6u5;d,lc,r,s;uc;ob",
  "Actor": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:st,er,en,on,re,ar,ess,it,nt,ri,te,ss,ti,an,in,le,ce,de,is,or,ch,at;0:7B;1:7G;2:6A;3:7F;4:7O;5:7K;a6Nb62c4Ud4Be41f3Sg3Bh30i2Uj2Qk?2Pl2Km26n1Zo1Sp0Vqu0Tr0JsQtJuHvEw8yo6;gi,ut6;h,ub0;aAe9i8o7r6;e#l0+0;m2rk0;fe,nn0t`,z)d;~h$m2ld0;ge e)n0+0nd$0r.1;et$7i6oyF;ll5Qoli55p,s3Z;>,?a2U;n6s0;c@,d$03;ao^ea`,e9h$api5iktok0o8r6ut1yco&;a6%dseLo43;d0mp,nsc.0Bvel0;ddl0u1G;a0Q`n7%6na4#0;ag0;i3Oo0D;aiXcUeRhPiMki0mu26oJpGquaFtBu7wee6;p0the)t;lt2p$7r6;f0ge&,viv1;h6i-%0I#),v^1;$o,um2;a8ep7r6;>g0eam0;bro2Nc2Ofa2Nmo2Nsi20;ff0/sm2;tt0;ec7ir+,o6;kesp59use;ia5Jt3;l7me6An,rc$e6ul;r,<;di0oi5;n7s6;sy,t0;g0n0;am2eph$d,ow6;girl,m2r2Q;c(tIni_ c+3Fr6;gea4v6;a4+1;hol),i7(%6ulpt1;wr2C;e01&;l1-;aEe9o8u6;l0nn6;$ up,?gE;gue,@ mo]l,of0;a4Zc8fugee,po32se)Qv6;$%d,olu=&6;)y;e6luYru22;p=o3T;bbi,dical,pp0;)t$6e%;back;aYeWhSiRlOoKr8sy`o7u6;nk,pil;logi5;aGeDiBo6;d9f*1g7phet,s6;pe2Kt+u/;%6ramm0;+1y;igy,uc0;e#4Nme m?i0Un[6s3E;!<;a7si6;]4;`0;ct+i39nk0P;dca0Oet,li6pula50rn#);c2I=c6;al scie6i2;-i5;a6umb0;nn0y6;$,ma/,w.ght;lg.m,&e0;a8iloso7otogra7ra6ysi1V;se;ph0;-om,rmaci5;r6<i1T;f_m0s&;i3El,nel3Yr8#1tr6wn;i6&;)Wot;%tal,iah,tn0;ccupa4ffBp8r7ut6;ca5law;ac@,g>iz0ig2Fph2;$3t6;i1Jomet6;.5;ic0sp.ng;aBe9ie[,o7u6;n,rs$3J;b6mad,vi[;@2Vody;i6mes^,phew;[,ghb1;nny,rr3t1X;aEeDiAo7u6y#ic;m8si16;d$3gul,m7n6th0;)Dk;!my;ni7s6;f+,sus,t0;&,#0;`>ic,-1r`a4;gi9k0n8rtyr,t6y1;e,.)6;`;ag0iac;ci2#ra/;a7e2Aieut%a4o6;rd,s0v0;b_0d7ndlo6<,u(a/,wy0ym2;rd;!y;!s28;e8o7u6;ggl0;gg0urna2U;#0;c&,dol,llu3Ummigra4n6; l9[l,fa4habi42nov3s7ve6;-1#ig3;pe0Nt6;a1Fig3ru0M;aw;airFeBi#oAo8u6ygie1K;m>6sb>d;!+a8;bo,#6usekN;age,*;.2;ir,r6;m7o6;!?e;+;d(<0#y2C;aLeIho#Girl26ladi3oCr>d7u6;e5ru;c9daug0Jfa8m7pa6s&;!(4;a,o6;th0;hild;al7d6lf0;!d*;ie,k6/26;eep0;!wr6;+0;^ha,n6;i6tl04;us;mbl0rd%0;aDella,iAo7r6;eela2Ni%d;e,(6#$ pa(4;be),m2r6#0;unn0;>[,gZlmm17n>ci0r6tt0;e6# lady; m)shal,figXm2;rm0th0;c&oEdD@ct.Cm8n7x6;am?0[ll%cy,i@;emy,t(pr%eur,vir&m%ta1J;c8p6;$1loye6;e,r;ee;ci2;+1;mi5;aKeBi8_k,.7u6we02;],t`*;ft0v0;ct3e=7plom~,(6va;ct1;ci2=2;aDc_3f%cC+y,nAput9s7/ctLvel6;op0;[1Ge6ign0;rt0;ee,y;iz6;%;em2;c&,l0;d8nc0(]v7ug6;ht0;il;!dy;a06e04fo,hX+iz%WlToBr9u6;r3#om$6;! (p(s%t~6;ive;e3+6;ic;lJmGnA_d9rp_al,u7w6;boy,_k0;n6.0;ciTt*;?3;fida-Ag(<Ss9t6;e0Kr6;ibut1o6;ll0;tab@,ul1O;!e;edi2m6pos0ra];a0EeQi<i6;&0;@ag8&7um6;ni5;el;ue;e6own;>0r6;ic,k;!s;a9e7i6um;ld;$@6f;ad0;ir7n[6plFract0;ll1;m2wI;@b.6o;ty;dBptAr6shi0;e7pe6;-0;r,t6;ak0;a?;et;aMeLiJlogg0oErBu6;dd0Fild0rgl9s?*6;m2p7w6;om2;$s&;);i7o6;!k0th0;cklay0],gadi0;hemi2oge8y6;!f.e6;nd;ym2;>;cyc6sR;li5;~box0?gs;by,nk0r6;b0&7/6;nd0;!*;c04dWge4nQpLrHsFtAu7y~ull6;ah;-7t6;h1oG;!ie;h8t6;e6_ney;nda4;ie5@6;/;s^00tr&6;aut,om0;`b^8i#o7=s6;>,t;crU;hop;o#9p6;)i6r%=S;=6;&;@;a9[#1im3nou8y6;bo6;dy;nc0;ly5rc6;hi5;mi8v6;%tur0^1;$;ni7r6;al;#r3;~1;_;counBquai->Arob9t6;ivi5_,(6;<;#;~;[;ta4;-",
  "Adj|Noun": "true\xA6:!1:#$%&()*+-.:re,er,ar,oi,al,ra,ni,oc,tn,ts;(linav,b%a,ci1Bd15e0Hf0Fg*0Dhs0Ck0BlVmRnMoLrHsEt2woll6xelNy0;bbF)0;n&siv,ropme-+;aA$cGhgil,lu9n5#4s0;ap,eb,i0;c%,laicJn0ror01;im0&ss$pmi,#dom,u04;ef;la,pxe;a2e0;bmucPc0dis$,itN-+,uti.n+,vlE;onOselo1;i)v,.N;da;f,uqs;ioegruFria.pu,se0tun,u&nO;cxe,lem0;oh;a$,e2iaf,&0;n0#pus;es;dle,imeKtt(,vlis;obat,rp;a3e2gie#v1&na0;pm+;os;et,kot;cilbupWidem,t;i#t7ott2u0;i0rdmuh;dem,meB;ob;a2e0lews;bQll%0von;ap;cid&#p,edi,i8n5pic*6r2t1udivid0vo;*;nMrY;e0om;bil,n0;eg;im1&ssefo0;rp;#t;c1r0-etop;es,t;iE#0;mmR;c(s,n(b,r2;%,ibbur,ul;ggan,lr0nnuc;ad;ei0lah;hc,rb;ci.Mdurc,gas,lF*ErutDt7v0;%g,i0;sne4t0;a1iguf,uce0;xe;l0n#tla,#poF-es$p0virU;$;ffo;a3$cnCi0urb;le,r0soppo;ov0uov0;af;*drob0ud%gE;us;ai*m,uf;f,)m,tuor;am5ba2i0os;b0nev5;om;irHt0;#vn0s;+;!ef;uj;ehs#taw,iu3log,n0)dna.;obagBuor0;!g0;#dnu;lf,q0;il;hp%g4m3pe,rt2ss(c,t0;c)0s(p;!-a;em;edaca,+;!om0;ed;av",
  "Adj|Past": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:er,ts,oc,rp,re,cs,ro,uo,la,ne,mi,ar,es,ed,ra,xe,ni,el,ol,us,ht,ps;0:4Q;1:3C;2:3W;3:4S;4:45;d8n6t5;=pu,f],nrub,s^,uhs;e5*w,wonk;korb,zoX;e5n+b,oo$(dnu;br4Qc4Gd45ffu4g3Th3Ii2Wk2Ml27m20n1Op1Jr0Ys0KtHvDwCxiByaAz5;a8i5;disb_,-5mo$uc,nag*,*`ua;ice~,rt.c5;!>;d,ma;c2l2;f,m;en0^ley;iec0lov1o6(s5;bo,#;l,m0&5;!/;aSb>1cMeg?t,fiKhgil2iJlem,nEoDpC*Bs8t6u5;as,m;if,o5;nk,~,r;ap,e6i5ujda;l,wt;gg_,r2Ruq0;p/,$3;ecca,oda;n,uq,v2;ahc.,emg7i6+5;)3m;ap,op,&;a5ua;rf;c@,/l,nu,v1;g,l5;pu;e5ir$0;f8j0l7p5r3to&;s5@;#,_;=,gen;fa,[,(p;cHdGeFiDlA/9[8picit9r7$,vit5;l5om;uc;b]ec,egga@,g26%2t.cn%,u1Y;)af,mulli;na;e6f1osi,u5;c-c,g0/s;!r;c5ruf1;aF#ppa,o0Q;h,p0s;!ilo04pu;i5ude;d2lpm%,xot1;aFiuE.cDoBs6u5;!cof,fn%;<?b8e5ip;co&,lb,r5;p5$3;!>,po;me;lc,p5;o&,@;il;rb;b,e5ib;l5rc1t;#,p;aOb1eFiEoDrBu5;c9j1o8s6tca5;funam,rf;a5.,sa;em;l%,vaG;!=;efe5i4;d,&;b,l%,$0vaC;~1t,uq0;dB`Ummah,t6v%5;!#,nu;-,s7t5;a5ulc;b,);ig0u5;lf;i5liweb;snZ;),ef,hs,p#p;a)e,ir4m7^ev2p5?w,yto#e4;<t,i5;r4uqe;<c,u5;p,$;eEi9n7o6ru5;b,t;dnaba,saZ;a5u4;lp,t;a6bmNfe5lpi1Cm(t2oj;d,r;r6$5;!_;!d,t;#),`gn#4k5pmad,ta#`;aew;aAlehwU/Or6u5;ssa;a6of5;>,[;!h5-;!c;e4rf,t;aIbGcyc0eEffab,iCk[rw,l8t6zz5;ad,up;nurgs3t5;=,ob;i6ortn5;%;hc,r5;g,`;a5ob;f,t2;l-?p,v5;];as3muh,+5;rt;=;aDc9iZo6?5;m,p;ms,o5$;c,h,l5;(vo;a6ip,o5;hs,l;p,r5;c,t;b,os;f9l7pucco6r5t;av,d,f,*w;!#p;-r,p5;/,pa;i6si5;tas;ceIdHlFnErDs9t5;<7r6s5;uj,ym;ec;!g;n6sa5;lc;et1;[;ev,*h;g3u;auq,pm5;is;e,om;~;cCs5;aw,i5uR;l8n5r+n;i6r5;at;f,m3;bat5op;se;*6ta5+t;r5w;);aBd9]-,g7n5?hc;<2^oT;>;a5ulp;j,n;]wonk5uj;ca;!c,gSm7n6r+5;)3;am;ad;$;aEeDiug,n8%,r6wo5;rc;a5%0;ug,wa;apFe6ilb,u5;ow;mm%0~6t5;[,@;_;en;f,hs,^;alp0n6(ip,ud5;#,o6;a7ei(p6+no5;&;@;h7l6v5;da;ab;.;#;os6u$3;id;ba",
  "Singular": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:re,oc,ra,ni,er,ts,ta,na,am,ht,ir,ro,or,ot,oh,it,ip,ed,ci,ne,od,ac;0:5T;1:52;2:5I;3:3I;4:5C;^5Id4Xe2Rf2Qg2Kh29k26l1Im1En0Zoy oy,pu 0Xr0Ks0Jt03u01vt,wZx( t,y5;aWdVgQlKmJnnIppHrAs6t5;ei%v,ic;p7s5;abme,u5;h,p;>ua,yg;a6o*5;ngis,<bal,v#3H;l8+7t5;i5_muc`,on,u1P;lim,ng1;c,rg;as,grDub~ov;op,up;arg,ub;mut,on$e;-o+,f8i7l5oponom,po+p;a,e5of,ug;b,j;maf,`;dag,(if,nogaH#tt5y-;ub;e*r),g8iffe,&.,#5;l6n5;e,ys;c,la;[,`;egart,ob;r5w; x,%;eiv3Ho5;hs vt,r;_m,r. evi5;rd;cFeEhg/ +muh,_7%) 36s5u+ep;af1Gi5;aw,eh;csAd8i7lat,r6t5ve;n$s1xe;ef0#t4;^ffe$,lc,pic0touq;ic5=,u);ca,&;!a;k%m e(f,v;e6i5;d#v,r)1;l6ps5s2B;a,=p;a1let&;e^d&,#.o,ucu3;aDe5o`;bmun,faw,i6m<f0n5yH;n1wo;calg,da_Yh3l]+2p8r6ss`,t5;!em,n=f;d,%5;b,c;!$5ucco;!>Z;c,ewr2Fl5&mes,w livic;l5pmexe;ec,[#t3o5;c,d su;gel,y5;al;aHeAi9o6rut( xat,ur5w=b hsah; em?,(;@5tn3;^d(p,isop5;(p,s1;su$,*leg;g?*p,iAk9t7v5;a5o;eh,h,r;eleks,ti5;k,m;^2opstuo;la,pas;e5ol tn]u);b,co;a6e5o=,ume.+syr2;lb=p,&m? da,)ys;et,ls d+5;rg;aAebal dr$0l8o6ufd+h,wob5;! #pus;?cs5%c s-)/2;! h1H;~ en5iW;?p;binn3cLdeKeJiHmGnErAt6u5;rcca,t/;eIi6>bus,<p,s]ep,t5;iuqca,ub0;c0p5;~,s?;de.3en7r5um;efe5$;d,r;im,uf;~,es%,/u,ruoj,u5;b/t;ic4m-;n4pus%m,r5;e*m,>ut,ub;d<,m*o,#c;m,p;],i*bbI;c6%m noi)e5;uq;iDurt pmud;cDgu=Asi6t5;a4olc;m6n%5%p,tef;g,v;elb,ri5;ks;.5ob,t;kae5;rb;iwdn5nZ;as;ge,[,&5;ddup,.8k+b,l6n5;eve,&,<m;b5iec;is;!on;eihcsEfo &ps;b/t,dis17gat11[,k$,l0Qm0Kn0Es06tFuqEv6z5;ah;i5#s tfos;ssAt5;a8ce6_c&5om;!s1;j5ps#p;bo,da;go#rp,@iAr1S;im;aHe2inumm$,<t,som;aHiCo8u5;lf,t5;a),i)5;&;d6nyek,y5;ep,$;ce5@5;+;csibe8dd7n5ps0r,s,teppa,us;!ab5>;ru;ul;lp;b0^f@rHgG[o,lDmi)(Tng-,p,r8t5;e6s5;e,oN;ca; tluaf4bet#v8dyhobr3>c6t5;in,sbH;ele,`;~;!&;$o2p6u5;sn$;!met;/f,=rA;ec;ael( sseBi6opr5;up;dar8me9r5;h6n5p#t_;us;gih;ap;rp;~,o5;em8hp7m<h,t5;r5s;]nu;daeh;os;ag o]iv,i8o5;h,s5;e(5ruof;.;l,t5;#vo;ahw,b6pma5;xe;a7i5;cuOdn5;-;ll9t5;e6nr5;ut;g5m@;ev;ys;l9n6<hs,t5;$;av6ecr5;ep;da;ov;nw5pu;`;rt;eFiEluHn8r5;a5ow;c tide5ug yt/ucM;rc;e5uo% yI;div1g7if,kc6piNtno5;rf;ab;el;id;leye,maryp,pil,rg;b7p6*&d<$5;nu;om;aAh*4#6t5;?;t6v5;/;aw;];es;dK.e,lHmGnEpoDrBt5;!c9$8si5*;#tca%2*5;);hc;%n;at;b5>ehr;af;ib,t;c[,i5ut;lc;!][e;bup0$,r5;ag;(;em",
  "Person|Noun": "true\xA6:a0Cbreh,d0Ae02ffilc,gZhtiaf,jd,kXlSmRnKoJrFsDtBxAy0;a8bur,d6ks,l4nn3oj,s2t0ug;i0tik;nirt,raM;iHtap;af,ep,os;il,lo0;d,h;d0naQolem;ap,e;j,r;am,er;a0cidenOeloiv,ra;m,n;dle8kn4rebmaBt0unev;am,tW;e0ime;k1mmus,t0;nuh,top;ab;b,derfTel,lf;a3i2n1ref,w0;ad;if;bGhc;e1itsir0v;hc;d,j;ac,ron;atsyrc,e3iag,l1op,rae0;!p;ah,i0;b,g,h;wej,zah;c9oo0;rb;n1r0;eb;aw,ik;d6g5i3n2s1v0;e,ilo;or;al,eg,ims3;loj,x0;id;ap;aj;eer,or,r0ub;aw;jed,l1m0yam;la;o0ue;iv",
  "Actor|Verb": "true\xA6:dren,eDfoog,hcaCkBloof,mooFn9pm8r3ss2t0yll6;c0iurcer,nerap,olip,pircsnBsoh,uocs;etihcra,idda;ent5ob;e0otcod,ueffu6;e2h0;ct0su;ub;nigne,tnulov;iw;am,oipm0;ahc;eeg,o0;oc;diug,gduj,mim,ta0;iliffa,uda0;rg",
  "MaleName": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:an,ri,en,on,el,er,ar,ha,in,al,ie,is,nd,st,as,or,us,es,ne,lo,to,il;0:H6;1:FZ;2:DS;3:GQ;4:CZ;5:FV;6:GM;7:FP;8:GW;9:ET;A:C2;B:GD;aF8bE1cCQdBMeASfA1g8Yh88i7Uj6Sk6Bl5Mm48n3So3Ip33qu31r26s1Et0Ru0Ov0CwTxSyHzC;aC@0;cChid,ka$a,nAT;!hDkC;!*y;!*7C)y;aJevg%BSoEuC;%,rFVsCuma,v.;if,uf;nDsef,[C;ouf,sef;aCg;s,tC;#,h0;hli,nCrosE1ss09;<,nC;!ick;avi2ho5;aPeNiDoCyatt;jc/ch,lfg#g,odrFutR;lFnC;f8TsC;lCt1;ow;bGey,frEh(m,lC;*d,iCy;am,e,s;ed8iC;d,ed;eAur;i,=(l,rn2sC;!l9t1;lDyC;l1^;lDtC;!);ace,y;aK)nDAiFladDoC;jtech,_dymyr;!iC;mir,sDB;cF+0kt@,nceDrg~,vC;a0ek;!nC;t,zo;!e4St@;lCnce,s~y;!%tC;-9J;ghur,lCm70nax,$,sm0;$Cyss];ch,k;aWeRhNiLoGrEuDyC;!l2r&e,s1;n6rki;av<,eC<t0oy,um0;ntCRv@,y;bFdAWmCny;!?DmCoh*u;?o,/,y;!z;i?,y;mCt4;!my,othy;adEeoDiago,omC;!?;!d@91;!de4;dFrC;%ce,rC;#ce,eCy;ll,nce;!dy;dgh,+,iCnn2req,tsuki;chi,ka;aYcotWeThPiM_bod0oKp%c2tEurDv%AEyCzym1;ed,lve>2;aj,]h;#FeDuC;!aA;f#17phEQvCwaA;e77/;!<laCl9;v,w;_m1rBuC;leym#e,ta;dDgmu=,lCm1yab&ga;?,vio;!dh*t+,n9;aEeC_mo;lCrm0;d1t1;hid,^,qu1Jun,wn,y^;aDba>iEDkou,lim,pp,rgCth,ymour;e1Dio;m4n;!tC;!/,y;eed,lFmEnCqib,`shi,ul;dCjay,t-o;eep,ro;!iATk(o,mC4u5;!ik,vat@e;aZeUhett,iRoGuDyC;#,ou;b99dDf4peAssC;!(EG;ol00y;#,bLcco,dJ(,geIh0lHmGnEry,sDyC;!ce;a$o,coe,s;!aCnBU;ld,n;#,eo;a7Ef;lio,r;e3Eg2n9olfo,$C;go;bBNeDH;cCl9;*do,c86h54kCo;!ey,/,y;cFece,gDid,ubByCza;#sh,n06;g/,iC;n.d,s;ep;chid,fa5hH-2j]h,lGmF=EoHp+5sDul,wi$,yC;#,m&d;+d,m4;.DSolph;iro,&;f,ph;ul;e9C-C;cy,t1;aOeLh~JiFrCyoG;aDeC;m,>1;k?h,vit;eDoC;tr;rre,tC;),ro;!ipClip;!p6U;dro,rcy,tC;*,e9JrC;!o7;b_,draig,o_,sc.,t$62ulCv8I;!/,o7;ctavio,i2lImH=rej,rGsDtCum6wB;<,`;aDc6k6m0vCw.d;.do;ma;i,vR;*,);aDeks#dr,ivC;),i2;f,v;aNeLguyBiFoCuka;aD(,j4l0ma0rC;beAm0;h,m;cF(s,g5i_,kDlC;],s;!au,h~,l?,olaC;!i,y;hCkCol?;ol?;.,d,~,ls1vC;~le;hom,tC;e,hC;#Cy;!a5i5;aYeViLoGuDyC;l],r1;+mDrad,>aC;fa,p+;ed,mG;dibo,e,+mE<],ntD$tz,sC[sa;],he;e,y;ad,ed,mC;ad,ed;cGgu5+i,kFlEnDtchC;!(l;a`,ik;ho[e,o7t1;a)e,eC3+~,olaj;ah,hDkC;!ey,y;aDeC;.,l;(,l;hDlv3rC;le,$ll,v4T;di,met;ay0c00gn4hWjd,ksim,lTmadZnSrKsXtDu$c7VxC;im~BKw(l;eHhEi?,tC[,y?;!eo,hCia7;ew,i?;eDiC;?,eu,s;[,w;j,o;cHiGkFlEqu<,s+ll,tCv3;iCy;!m,n;-,&;(,o7[;#o,o7[;!(C-,o7[;!l8o;fred,<h,ny,u5;achDcoCik;lm;ai,y;amDdi,]h,mC;oud;adCmad;ou;aulC/j;ay;aWeOiM_yd,oJuDyC;le,=1;cFdEiDkCth2uk;a7e;gi,s,z;ovic,vig,wig;!?,iC;#o,%;g0nn/,r%DuCvro,w(l;!iS;!zo;am,n4oC;n5r;a9Yevi,l#d,nHoF>2t+EvC;eCi;nte;bo;nCpold;!a82(,id;!nC;aAy;mE=1rDsz_,ur%Cwr6K;ce,t;ry,s;*,beA&t;aOeI+lHiFla4&rad,rDu5SylC;e,s;<tCzysz`f;i0oph2;)0ngsl9p,rC;~A9k,ol_s;ed,id;%0iGnDrmCv4Z;it;!dDnCt1;eth,y;$ck;r,th;cp2j4mEnata,rDsp6them,uC;$;im,l;.,~;a03eXiVoFuC;#,lC>3;%,iC;#,%,o,[;aQeOhKkub?,nIrGsDzC;ef;eDhCiah,ue;!ua;!f,ph;dCge;i,&;!aCny;h,s,th6J;#DnC;!ath6H/,n72;!nC;!];!l,sCy;ph;o,qu3;#,mC;!i,m6V;d,ffFns,rCs4;.d,emDma-e,oCry;me,nimo;iah,y;!)y,rC;ey,y;cKdBkImHrEsDvi2yC;dBs1;&,p2;ed,oDrCv<;ett,od;d,s61;.,]5W<1;a,e,oCub;b,v;ob,qu];aTbNchiMgLke53lija,nuK&ut,rIsEtCv0;ai,suC;ki;aD+0iah,maCsac;(,~;ac,iaC;h,s;a,v-Cw3;!g;k,nnguaq;nacio,@;ka;ai,rahC;im;aReLoIuCyd6;beAgGmFsC;eyDsC;a3e3;-,n;b)`;h,o;m2raDsse3wC;*d,/;c49tio;ath,ct@,iGnDrC;beAm#08;d$k,rC;iCy2N;!k,que;n0Tt@;bKlJmza,nIo,rEsDyC;a`,dB;#,s0;lEold,r2IuCv9;hi`,ki,tC;a,o;#,ey;k,s;!im;ib;a08e00iUl%ToQrMuCy@gy;iHnFsC;!taC;f,vC;!e,o;n6tC;),h2;do,lC;h)DlC;auC)Q;me;aEegCov2;!g,@C;!io,y;dy,+m;dfr9nz.o,rDttfC;$ed;#,d47;!n;acoGlEno,oC[eppe;rgiCv#ni;!o,s;be6I],lC;];mo;oFrC;aDh*d,rCt;it,y;ld,rd8;ffErgC;!e7iCy;!os;!r9;bElBrCv3;eCl#d,r4Hth,y;th;e,rC;e.,i(C;!i4;aXeSiQlO@re>,rCyod@;aHedFiC;edDtC;s,z;$ch;!d42e$11$C;ck,k;nCs2;cEkC;/,lC;-,yn;]L<C;!co,zek;etch2oC;$0yd;d5lC&n;ip;de$FliEng,rC;d-aCg4n#do;=8;pe,x;co;bCdi,hd;iE$C;ce,zC;io;#,%,o;b%ez2dZfrYit0lTmMnJo3rF>eb0th0ug%EvCymBzra;#,eCg%y;ns,rett;!e;gi,iDnCrol,v3w3;e>8/,>;cCk;!h,k;och,$Czo;co,qC;ue;aH)GiDmC;aGett;lCrh0;!iC;#o,o,s;s1y;nu5;beAd1iEliDm2t1viCwood;n,s;ot28s;!?,jah,ot,sC;+;a3%;!dGg6mFoDua2QwC;a2P-;*C;do;oZuZ;/;a04eTiOmitrNoFrag0uEwDylC;#,l0;ay^,ight;#e,dl9nc0>3;m-FnD$0ugCvydGyle;!lF;!.d,nCov0;(l,/,y;go,iDykC;?;cCk;!k;i,y;*muFetDll1mit$7^C&,rk;sh;),m6$C;ch;id;#dLepak,j0lbeAmet$4nI&,rGsEvDwCxt2;ay^,ey;%,-;+wn,moC;=;ek,$C;ck;<,nC;<,y;rt;re;#,le,mKnIrEvC;e,iC;!d;%,iEn(l,rCyl;eC-,yl;l45n;n,o,[;!iCny;(,_;iC&;#,%,&;a0Fe0Ch03i*0lRoJrFuDyrC;~,[;rtC;!<;aE<tC;iaCob.;no;ig;dy,lInErC;ey,n(iCy;s,[;nE@,rD>aC;nt3;ad;@;by,e,-,l3t1;aHeEiCyde;fCnt,ve;f@d,t1;m%Dt4;[;s,t;rFuDyC;!t1;dCs;e,io;%C;ce;aHeG$sC;!`C;phCs;!eC;!r;>2t;d,rCs;b5leC;s,y;cDdrCs6;ic;~;lHmFrC;ey,lDroCy;ll;!o7t1;)1iC;_;!eb,v3;a09eZiVj@n,laUoSrEuCyr1;ddy,rtK>2;);aKeFiEuDyC;#,ce,&;ce,no;#,ce;nDtC;!t;dDtC;!&;#,&;dFnC;dD<C;lav;%,&;!foOl9y;bby,gd0rCyd;<;-e,ke;bElDshC;.;.,lL;ek;nIrCshoi;at,nEtC;!raC;m,=;aD+C/;rd;rd8;!iDjam3nCs1;/,y;`;kaMlazs,nHrC;n9rDtC;!ho_mew;eCy;tt;ey;dCeD;*,iC;le;*1Nb1Dd16f&so,gu>3hm12i0Zj#i,l0Bm07nTputsiSrGsaFugu>EveDyCziz;a0kh0;ry;o,[;hi;aMchiKiJjun,mHnE&,tCy0;em,hC/,ur8;ur;aDoC;!ld;ud,v;aC-;#,=8;!(,ki;baCe;ld;ta;aq;aMdHg(8tCw6;hoFoC;iDnC;!i8y;^;ny;)7rCy;eDzC;ej;!?,i,j,s,w;!s;s,`lC;iCy;!y;*,iEmaCos;nu5r;(;^,r,t;aVbSdBeJfHiGl01&Fph&sEt1vC;aP-;&;e,o;so,zo;!sR;!&ZrC;ed;c,jaHksFssaHxC;!#dC;),rC;e,os,u;#dCei;*,),r;=C;ro;%;eDrecC;ht;rt8;dd3-,n,sC;taC;ir;ni;dDm6;*;#,%;ad,eC;d,t;-;so;aGi,olErDvC;ik;i#8;f8ph;!o;mCn;!a;dGeFraDuC;!bakr,lfazl;hCm;am;!l;.lF(,oulaye,ulC;!lDrahm0;#;ah,o;ah;av,&",
  "Uncountable": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:er,te,ic,en,ar,th,se,is,ne,ur,ce,or,in,re,ta,ti,na,le,us,ss,an,li;0:2F;1:34;a2Ub2Lc29d22e1Rf1Ng1Eh16i11j0Yk0Wl0Rm0Hn0Do0Cp03rZsJt7.`^,v5w2you guys;(m9h+ky,i3oo2;d,l;ld~fe,-;ap<,#[cul(,i2;-g(,ol1P?e;eChAi9o7r3un2yr`ny;a,gs$n;aff%,ea1Lo3ue n<2;);ops,u2;b]shoot2Ps#s,t;nAo)pas$,wn2;foFsfoF;me off,n;#2und#;e,mod2T;a,nn+;aEcDeChBiAki9o8p7t5u2weeps?k0;g(,n2shi;l2shi-;ight;a@07e2;am,el;a/2Jeci0;ap,cc#,me)2B;n,ttl0;lk;eep,=gl0<ts;lf,[$,ri0;&#y,+s<s;d0Vfe1l3nd,t2;+h,.n;mon,t;abi0e3%2;e,kets;c2=s,laxa10*(ch;ogni0Z>a0Z;a8e7hys6luto,o4>2ut1;amb],m+0s2$n*;&*,s0K;l2rk;i27l&,yG; ed,%s;a/,trol;nt2@0L;i0s;bs$tr%s,v#crowd1Pxyg&;a4e3owada2u$lla;ys;ptu-,ws;il po~Y@o[l *c.i1;a9e7o4u2;m2s%;ps;n2o*;ey,o2;gamy;a2cha0Dl`choly,rch`di*,?ll.gy;sl0t;chi-2g%,j1Grs,)ema1P; ](n1Bry;aught#,e5i4ogi3u2;ck,g11;c,s1L;/,ghtn17ngu+1Kt#atVv#;a)#,+U_;(a$,=d#g(tOn2;%k#s,ow]dge;e2upit#;a2llyfiFwelry;ns;/,gn<5mp4n2;f<maZt#2;-t,s?$;a@R<t2rov;`/;a6e5+t<y,o2ung#;ckey,mew<k,-3o2rs#adi7spi?~1u* (>st;ky;s1y;adqu($W>;ir,~but,ppiGs2;hi2$;sh;&e7l5o4r2um,ym[s10;a2eY;niT_;lf,>;ut2y/0E;&; 2t%s;edit0Gpo2;ol;aM%Elo.,o3.nit2;.e;od,rgive2.iZwl;-_;(Bcono0KducaA]ctr8n6quip7)%s,v#y5x2;+t3p#2;@*;&/;body,o-,)06;joy2t#?=2;m&t;%i1o2;n%s;@R;n=gs,);emi*,i5o3raugh2y[s1;ts;pe,ugh,wns?i2;rs;abet0/,s2;honY>pu2;$;aCelciBh9iv%s,l7o2.r&cy;al,ld w5mm&?4n2ral,ttH^coA;f^iGt 2;ed;ry;(;a_%s,o)0;es;aos,e2;eLwJ;^;d,rN;a7i5lood,owlG>ad4u2;ntFtt2;#;!);l~(Is2;on;g2_;ga2;ge;cJdviI#oFirEmAn5ppeal co.t,r3spi2)]K;r=;i)met2s&2;%;i5y2;o3)2;=g;-;*;&4n2;es1;ty;ds;craft;bi7d2[u6;y[2;mi5;/;id,o^2;@2;cs",
  "Infinitive": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:er,ni,ed,rep,ts,oc,uq,xe,mi,rt,la,ne,lp,ar,ra,me,il,ps,or,ae,na,ir;0:AI;1:AP;2:9K;3:9V;4:9N;5:A0;6:AR;7:9B;8:AG;9:9D;A:8E;B:AS;C:AJ;D:AB;E:AQ;bB0ciAYdA8e53f4Zg4Vh47k3Ul3Gm36n2Co2Ap23r1Gs17tYwSxRyF;aNdob@,eMfKlInHoGpucco6RrF;av,c3ub;j4=3n`;ap64%;#,pF;itlum,m96pa;eFsitas;d,*[;bo,vn2;lG.Fs,ws;eb,rop;],s;e=&,i9Y;>dhtiw,eJoF;dHl/Gm,nk,rFs,(C;g9Orob;!ws;ahs8L<;hcse,n0rBs;a63c0Ee0Cfi0Bi06l05nXoWpUrNsGuF;cr9Z^;eJiG)9uF;bm2jE.4;l4oh,sG+F;!);b6e96n8M&;f7gFlom,tta,v2V;g6$;aJeHoFuh;ba,hApF(1;%,-,rup,s2E;ssa,vF+;a,b6#,id,$;pFwht; ekat,%,-;aEec9lucs,@t,oEurFyrc17;e,rWs1;l/,ob0r;aLeHiopG^67uF;ad,omr6;$p,pa;l0mHs#GvF;e5mucric,$;!p0;gua,ref;usrup,w;aAu51;awa,bHc[os,de,efDfo.0mGo=A],sF*,+;iv0ybab;b6da,[3o;ahFih7T;$,);=u,s;ba,#g,gDmmu=,rprF;et7;aKeIiHuF;dFr1Z;ba,%;de5p3r5L;lFpA;e,f0l2;d0#,<,rFs1J;et7f0tF;ta;sGuF;cof0$m;aKeFucs1;fIrpHsF;bo,sF;a,op;-,p6;n2o5;pr6?h;_ppa,eGoliat,ucF;co,n2;bmXdSfQgOhMpKtH*n2vFwop@;es,[3)F;#,nu,s1;ac,/f,<,sGtaF;hs,lf;e*es,i$mElob;maFso5;h,p,t;pic3tF;ag,iw,ob;gaBnF;ad4[;e5fF;id,us;iIliwCnF;aGeFih,ual;g4r;*s,w;^b@,sn2;em0uF;c4n7G;aKeewJi*e,mav0oHrihc,uF;#,oF;c0rg0;hc,levF;%,<;!s;#,lr69ndik;d8gF;eDr7N;_07eWgiViP@4NoNrGuhs,wF;a],^d;aIeHoEuF;oFtr63;jEm;cs1t7vog;eGwF;!eD;!l;d`ba,isFkc0mm6s~p-;iv4simm4M;aFgCoj;=Am0.HtF;bo,nFta;iam,);<,sF;#,n2;/,s4X;dN#ac,fMhKkrJpIsHtFv[;a#ht,eews,hgieh,rohs,sF;af;row,sel;e3~,mFpah,?hs;ad;guot,tg<F;l,rB;a3fiB;a^b,dFiw;as;lg,m3;aNees,iKlIo(uc9rF;as1i3HofF;%,n5I&,sF;`.;ab@,ehwreF;d8vo;aFws;lcFm;#,o5s1+;ls,^;_QeNiJlHoFunR;rFtA;<,tap;aFi6X^4;(7;aHev8fluf,oG&-,(F;id,$;],rb@;r3ssa,truc,ve5;enk,pGuf0vF;>8#,~N;#,m2+;cn2nF(;`;_QcNeMluLnIrF;aFi,ul;bFm?e;%,@;aG~Fub3;hs;ht;ac;es;ajih,iGoF;l8(0;ffa.,-m;ns,rw;cVsGtF;_*C?e8;aS#f0iF;bruf0lOnLrJuFv>;gnGqF;$l0s;al,itF;s1+;eFuon;hc,p,vop-;av,e=0im1otGrFup;at,uf;sa;bGoFp12;ba,m3;a(e,up;el8*;aH~4<GtF;aRe;.4*;eHoGtF;%,ta;p,rc4;rp,t;eb,id,$GuF;b3=8;lFrw,(;c,f;e~b3fGlug4ooF;];iFub0;ns;c3Yd3He3Dg2Xht2Ui2Tk2Pl21m1Zn1Vr1Hs0Pt04uZvIwo,zF;aGiF;/0ng29sahp@;ma,rg;aTeiRiNloJoHrF;aBesF;bo,n2;m0rpF;!-,pa,s1;sHvF;eF$;!d,r;!ba,s1;aw,ecHgDl0rGvF;#,r6;%,ht,?,(;e3Rn2&;h9leF.0;b,r;ew,hCp,rF;c,g4;b-,gH/vr4A$Mrc9sF;<,rF;up;n>F?;ah;aMepm2iKoIuF;b~GllFtitW;op;tn2;mo5nF*;%,n2;cFdepA;!$;ciQdKeJiti7l0mFpicitS&o,u/ve,vit9;ag/ma,iGotF;ua;c3lF`;b6c9;m&,rc;iGnu7omF;m)9;cuTlG-t7*F;[;av,oF;sn2;d7xot7;a02iYnWoPpaOrKuHy/F;`,rF;ap;c9fn29ma,oFr21;pF?;se;aHeGod4ubF;-0s1;m-,]1;eh0;le;lcKnga1oJpF;atxuj,mHo5pFs1+;o,usF;!e5;i,)3;hc;eD<,s1;_lc,eF;dn2]1;>G/0?F;!mm6;dnFpJ;uf;eGrF;e,hp0;c,=s1pFt;pa;alc3eveRiLoJuF;co5d4giHjn1JsGtcurF;(0;nKsa;fn2;=Fngi;%,+;fkcab,pHt0*F;ca,#,nF;e,i;sF+;a,nF;aTi,);r,s&;evn2iGoF;dn2;d,fe1Ohs,mFpo;aAret%e5;)CuF;hAsn2;a01bWcVd$wd,fTgPiNkcMpHtF;`ms1?Bs#w,tF;>,[C;maIpGuF;)3;aF~c,ot;rg;.;at;cnFpm2ugC;)0;gGnF;>Bim;ig,uF;j,ms;fFiB;ab;ric4yc0;a06mF;eGuF;rc,t;.,sF;#,sa;hApU;aH[,ovFup;eF$,o5;!r;rb,sD;t8v;aGoF;os;b,#b;aRdPelOluNnJrF;al4eFof;mGvF;id,n2;b6e;>?,evaHipGupA;+;-;cs;d7v1;/;eFols1;lwonk9rd;g4nGru)Fsiv4;<,s1;am;lf,rHsF;eDrF;evo;c3ga;aRiMoLuF;lG.F+;$,o5;cGe,lF;a,);e5nF+;i,);c3rr2;bIcHfn2lGsFvo5;b6#;l2s;%,$2;!a;usGvF;$,rG;rFs1;ep;aTiRnLrJseHudF;#,o.7;$;i*9/2;ca;e2ofnF;e,i0;aJemm2iHuonF;eF`,o5;d,r;m,vn2;);h4$f0;ff6oj0t4;<;fJ=HpGrbF;@;tuo;#,siF;d,m;%,rus0;a01eWiUlRnLo5rGu>f3;%;aGoF;ffa;bmFcs1;ob;rp;aIeHoFuoG;csF]0;ba;~fCl,];bs1(rF;%8;eGohF;eb,pu;iw;bDova,r;rof;dnuof8eFw;cGf(_F;rb;c6+;nu;ehCol0;#;eb;l^f,mF;im;aBmucc6rF;osEuF;(1;id;da;us;(",
  "Person": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:ni,na,ar,re,el,ir,ra,or, n,ad,li,w ,no,la,lo,en,er,al,hs,am, a,ht;a27c25d1Oe10f0Xg0Whg0Ui0Sk0Pl0Mm0Ln00oSpp)t,rMsFtCuBvok*m,y1z0; yPe#,$rf;_`se&~,b8dd. ffup,e3l1r&0sk$b;b (>h,p;l0uj .$r5;@,i[,ut;l/[,n2r1s0;?<>#drQs)rom;f#<h%po,h6;m+ tt0sid t>w;im;om,s+c gn8;hlu~c,l,oleg$`y_,rh@ >l*hawE;d$rbm[,e=m,ibizx,?b #asu,$yrb ebok,*0se<ey$k,tahb;ehfeeb #atpJgob y[h0wets d+;pmuh;a5doo<&git,e1in$ig,k$b %yt,m.a y.s@dew,$Ttaek,u0;]c`1JicufnYm.%tson;demihc*,m2ta0vy;g ll0rcos;ib;aj-+b(,?h kcol&^;gIi/,n,t=hacop;a/p,e1o0*ts og#r,uka^ caput;~,lyat;cuahc,dav ~*d,hctuk-ot^a,ltih,m>p2p0;ip,p) e~ kc0;aj;!-osr5;d>6h5i?Mk~+,l/m4n2t0y @;a0tuhb rizaneb;lp,vol im9;_+ y%,icap0Go0; Fb;ac;#d>n+,<rotcod;n+,v);aDeAi6o0;(opan,ops&~i<ese[,s3t0;g#^a<lezn1l0#lc,sag;.,ih s)ap;ed;_,i0Lr0s$hoj tt(*cs,ug&f;ac,effej;as2lr5pohc0wdoT;! ci&de0;rf;suh m.das,uh;aiss1ik?t rrj,= 0rrB;okoy;em;goh kl5m1n0vy;oc; 1&0w@;d1pus;eh,n+i,&d0;ips;uh;%flXe#Kutat;e1itrZl[&f l/w,ohr0uapur;aw;ikeze,seid-A;c1e0fj;potaz (iF*bum;eb,oC;duc dik,ff%,^akat,juy,m0n$y,*h`tFss+ o#tn(2;aws,ur;og-0uabmil ^ur;av;(o,god po8iwdT#lw+ kj;fo#$mhc%,?0uoeb]`iC;o<ai#gr0<kcid;iv;cKdH(,iFk%d,lCnAop,r6ssag] /&5t1yt0;og;ih<w2n0;.,o0;rb;ons;me;aepseka2eil1iat?v,om(kc0;_;om;^;%c s(in,giv] l)va,opac0; >;a1ep,totsi0;*;b $its)Wg#thgin ecn[olf;ffe,ss]es (iMtt0;@;l1o0;ow;ih;a1=y0;eb;&bil,tsue;abnFe)fgeFiD?9n4ooh #b3rof 0;=si1yrn0;eh;rrB;+;a0omm9;l0r-ya;abm1&~us &fe0;ik;it;gi1h#0;[;tn0;as;^6m0;ah;is;iveso/m $dobols,md-0;ur;fi>hk zCgag yd],^Bma8n3ro,s0yne,zr;(a<hc1i0;%;(;ayt3$h2od%_ oge1y0;hc;id;);at;bo kc%1l i]0;.;ab;ek;iw",
  "Adjective": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:ni,re,ra,ne,et,er,no,os,ts,ps,el,or,la,ae,il,ro,on,ar,se,dn,na,lo;0:AQ;1:A1;2:9F;3:BM;4:9W;5:BJ;6:BH;7:89;8:7K;9:B3;A:AN;aBSbBQcB6d8Ee5Df58g4Sh4Li4Kk4Il3Lm3Kn32o2Yp2Tr2Gs2Ct0Dutis 1w0Cxuaf,yB;a0Ab%en,d08lYnXoc,peeWrFsDtCweOzB;oow,t#N;f]c,ippu,liug,#op,s(;a)g,_ah,(uc,kl8tBwoR;`,%;aKeHiah,oC.,rB;em,+;sEtB;a_5cCiBlus4uta7;bih1dua;afsitas,id]tn2;ivBElupm2&s;eCif,p8BtBwolf;aw,tij;hc;_GeFit$t,mEoh,rBs^cen;(?,oCtB;ib%,n2;*h,pm(;i3o-N;rd;eg/,oces;ls,rc;am,r31;d#k,(al,ht*m,iad,kJlirf,mees,nHrCthgiBur0;n,s0;aEeCobhgien,uB;oh,s;dBt%uq;le,@;ey,~hcs;amow,oegdumrB;uc;eew,%.;dum,ee.,lB`h;eiw0om;dy$ve,ko,wr9X;en _]b,oleb;>b18c13e12fih^k5hg0Zi0Wluciff9nPoom,pNrKsFuBxen;oBpak; B-,v4;dBgnur7;ekcahw,l+;aDeC?upop,#aga,omBub<;!$ttu;dom,*h,wht1W;eBfd>7;!ht1Urba;aw=7eB;#,p,voB;!c;a,eBirc^d*n,urba;da,#;aZeDiojC<f B;#,pu;n2s9;b,cT_RgOiLnI.0%pHsba,uCvB;l+1$f;lfEqBrgn2;eBole;rf62sB;b6n2;!fa;pa,sn]t;am$p,iB;mBt$p;e,mi,o3;ciffCdeB;bo,pxe;e,us fles;lud1#r7oc,rB;eBu;me,v9;epedBo.4;!#,$t1;),^B;iuqca,@uB;lf;cR_uQgOhc&NiMlLmKnJpm],rGtDvBzing2;/)B$sbo;!ri;culAluxe,r3KsB;iBn2;d,sA;biv,eCgaB[gi,$ba,tic=cA;lf,rf,v;buxe,~t;imod,+A;ada,@d;ahc*n,igiv;debo,f4;rt;av]txe,eB<%;le;ba,dA;av,ifingis53;c?Bf<p*n;li,pB;mi,xe;iBu<wr8D;ewBnr8Cr=,tpu;$5Yt6N;)31iv+,l%cs,m0;aEeC?)4#B;cc6-9;f$pmi,jba,.mucric,rB;e,id1r34;r3It1xe;ffo,pu;>sr83d%wkcab,iDpeek r8uB;gob,o$gnB;ad;$&g i6t]g;aMeFiaf0oB;iCj5#m,odB;#,tuo;nuj,rB;ef1p;bm+,d0ehs,g>GhtFmr8n1pDss/,tCvoB;!cr7M;awr7Lsi4Buo;<p0Xpu,uB;d 8Bs;egot,o;!m;/c l3M?imaf,pb6;eeEotDu B;dBt&p;ef,%h; pit,s*n;d #ks,lR;hCrtiv 1tcaf B;ed,+pi; gnBc5;ug;aPeJgiIiGoFrCwoB;d edispu,nk0rg1;eBobbu7;dom,htB-ew;@n,u+; to.,t`w;aBtu=fhgih,w #w;m,t$c;)8&b;dFesEhDko.0rrCtt<,vB;]c,e0;ab;sa;)of0nu;~g,oow;bruCi=0Gpda4sit%pBt?op<tem;!ib;!b6;a)-#5id,$t0Wuti#f# da;aRivQlOoohcs62ufB;eHitu>b,#aGpleh,tB;buod,eEhgBsiw;iCuB;oht;l4r;gr8rf;g,p;caFg&v,maE%c,su,tB;aCsaB;t,w;h,rg;hs;ep,rg;aBi7;!r6F;ic;bolg,e$hte,gOht/,iH#f,$t?,sGuEvCyB;<;an,iB;hcKr;qe,su,tB;ca;$vi0sE;cEnDtB;i1&ulf1%pB;!mi;ol2;],ifBurc;e&b,itB;%;/16uB;jn2rf;ciBo,sirb;$v5s32;bajnup,#m,@irp a;ct[ pot,guo&,siEtB;>nCoB@n,u+;mm5;eb,r5K;bb[s,fles,lBm>uqs,tuol;lBo8y7;eh;#Bums;cO_LhKk@w1DlImHogG$bmul,tFwBylr5Fziteppa; tCoB;lbd#m,nk;fBhgir;/;aisuan,ce.4G&l48od,sixee3;)8*,ys>;oceb0ussa0;>ppa0lB;appa,es-eb;ca) %f,tacs;a-CeB;c^Nnu,pmi;g*l;a&m,#v*c0;fo DooB;=,rpB;_u+,$htaC;llB%f;ew;cafd~b,d23ew,ga20h1Zid1k1Wl1Am15n0Wr0Ps0DtJuGvCzB;alba,*rb;a3JiBoba;cB=,ss)gga,tc]tta;$2uB;_2;dCqiB;nu,t`;!nu,r4U;aMeJiEuB;ca,l+C< &,tB;i-4sa;ba,);d*cAlE#fDrtCsiuqBtep,us &;xe;!n2;!ed18#;opmi;lCrB;cs9;+bo,pmG;bQc?4d ot pu,iPmiMnGrBuqeda13vi3;a.9eCi,opr2uB;cca11s&mm2;disnC&g4pBt?L;m(,s4;oc1;iE#,oiB$t=,utr8;ssapCtB;ceffa,@po3;!m2;d@Bm$ted1;bus1#;tBxo3;ig/Blu;!li;demLrp<ppa0O;/B<pA;ec;ebo,iJ=f,&Hotam2rEuB;fo3rB;-B;ba;a.,evB;da,id,rB;ep;mBt1;mi;cCwkcolcB;!$tnu2;e3n2;aGbac5coidem,eFit&,oD%zib,uB;m4tamB;e3mi;cBm [;d%h;c01m,-ua;b,wa;aIeGiDoCuB;mmiotua,yacip; * e*,d,=;lB#mP-i3;ak=,ffo,lB*,ucs5;a-yrc;csbo,rB;es;fo3muh,#,s1;as,)p6iB<hco*m;lb6tB; t0YgBir5;ib,nB;ol;aTbMgLiCoUpB;i1Mma;cIgaHhwF$7tBv;aCrBsoh;ef;~v,srB;ev;htrB-$;ow;!rf;od;#s;aBul+C;!bo3eeDtCu=vB;!#;[;rCs)8;of;ga;csCs/oB;hw;pu;aV?B;a,hsuB;rb;cuag,t?b;&C$B;d0va;(;am FiB%g t`va,un;fDsB;eb,#,tB;uo; anDanD;emB;oh;ob;>1Ye01iR~QnLoJ%B;_a-b6eh0obGug fOwB;kE@fB; tBtB;hgi]7;-;wa; Ba,*,r1U;*;hsBog;p?s;ahCiBoyYut<o;hXlb;fC$B;d0vo;fo;c eci,s0t0;aHbFcalp,dEoCprBug`l;ot;`Btamuehr,v4;%p;&l.,r+;],rB;om;lp,pCrB;fa;e3nu;c14d10g0Xh0Uirr0Wk0Sl0Lma0Kn0Hppat0r0Cs04tJudb6vHwEyolpme0zB;aCiB;ngocZ@htua0sr11;rc;ollCylwB;en;ah;l+UolB$sU;eb;aOce0AecafiMiJnGpurrF%C^BupY;rEt0;ehtBhc0;hgB;?;(Z;aCeB;dec)p0=t,mucod0;r%w0w0;eBri.,uqJvV;cn2;oc;tlB;um;ba0ci-ihp+,g?GlDrutasnuylCuqitB;`;op;eCugB;)0;b,r0;bo;>GiEoCpBu0;al;lcBppo0;sid0;cmucric0v$pB;us0;c4s9;ed;]f1cDomaCusB;#0;&;as;#;ialCoihsafBw[A; d~;pxe0;f,n0;bV/=%p0lCttes0zziB;rg;aCiB;ks;c CpB;pa;+;anBceG;! kcub;cBsi#f0;tBuot0;am0;a /ddC/ivirprG&l=B;hc0;im;aj,icD&tta0%B;tAug0;);ed0;ap -Cit[0`un;nu;af;hCr.edB;iw;a,rB;evo;aidrTiCoh B;da;fiNlJ`G$&g,tB;cad9nB;aCehtB;ua;gig,rf;id;gC.B;ih;@;bDoB;bmys,hocB;=;up;ceDrrCt&iB;cs;(,oh;.;ac;$p6;us;gFmi3rtDs$v ecCt&g5;am;iv;lu,xe;rp;em",
  "Pronoun": "true\xA6elle,h3i2me,she,th0us,we,you;e0ou;e,m,y;!l,t;e,im",
  "Preposition": "true\xA6:aZdWeTfSgnOhLlKmoJnFoDpCrAs7t1urNyb0zehc;!ereM;a4ceffe3pecxe,rap3s1uo0;!bVhI;di0gno0;ma; ni;!ht os;a0drPedisAiv a siv,nas,oporpa,sorca,usrev;! 0erehw;gnolKhcus;e0of;p,tfa;ota,u;/w,tn0;i,o;a7eewt2i1o0wod;!pu;!ht4;eb;hw ht2rf;itAlit;guor1t0;iw;ht;i1o0;la,ma;dnatshtiwton,r0;rab,ud;fo,o;cnis,kil1lohw a0tipsed; sa;nu;im1nuora,r0;awot;!a;cric,iv,uq",
  "SportsTeam": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:na,al,no,ra,er,ar,ot,ts,la,ro,et,ni, s, e,ti,c ,it, o,ap,lo,or,ne;$liv %+a,c1Se1O%i1Jomanyd 1Ir1Gs6t5xos 3y0zzaj hatu;?@0x$ag $;ek*s,ffidHre+e0sas#k g<t.ps;ciel,hc#m;d( 1A/ihw0;!]1L;aehVc^mi -(t%m;$-d cf,buc1Ic[15d11e0Kfeihc0Jg<k0Ik09l00m)=07nPoMpac/ihw revuoc#v,r7t2y0;a0obwoc0E;j>ulb7rF;e2_c=i_pGn0oirt^1A;aig 0iasV;k0Vocsic#rf0P;ggunIjXkc` 15m0Tn0; nylko`b,.h /tol&hc;aDe2o0ups]i%t#0M;ir&w /a+ ~d_g,tp)0; *%r*;bmi9c^ 8d7e#ccub6g2ht#p a<_1i-vacNk0lee+0E<&m00ppil@5v` nrubkc$b,w(02z$b li)9;$3c^ yab ~(g;&c;dod1[D#r 0&h@0D;k&p=~euq,saxH;! 0;seleg#=ol; yab ^mat;i)0PnuosS;a#id<;t d#lt.p;eb0Wugaj>lliv%skcaj;c%rb1r+a0;! 0N; revn3;a5ev)03i3o0us xi~ohp,w`b8;c-f Xil0+ip0; ?`t0;ed;hp_d0ksd(08l&m0wtS; imaS;cilep3id1?t>essenn0x/ 0F;/;<0&ug0; d#levelc;=#el.0E;a3l0;ib]-ffub,ub 0;d(0o0G; kW;g~bZn0y`E;id&@0o[anW;aAs0;iuol 0;+;c2wah0; Daes0;>lttaes;abd%maid3i1u0;b>ekuawl9;nkKrevam0;=$-d;! a0;%zi&; *~m)cCiv3; y?c=as#k;ek#yEiBkauqht&e>soj9l7rd^5t)ip4v0;)b 2_wrebm[0; atosenn0;im;at#lta; hgrubst?p;! 0;ogeid2;gae Moi.0; (om[-b; n0;as;kco6l0;lihp0zzirg=ihpmem;! G;! k0;.yD;(2ipa1&ziw0; %tg<hsaw;r]d)oI; [an<c<c;elhta2lec0;! 0;%+ob; d#lkao;ednuht y?@amoh$ko,upstoh mahn/t0;*;%+uoh;nu 2tu_v(0; d#lg~0; wen;aihpled$i0;hp;k$ t-s -(,rif0;]0;gaci0;hc;igam]d#l.,s w(c=ubmu0;_c",
  "Unit": "true\xA6a07b04cXdWexVfTgRhePinYjoule0BkMlJmDnan08oCp9quart0Bsq ft,t7volts,w6y2ze3\xB01\xB50;g,s;c,f,n;dVear1o0;ttR; 0s 0;old;att,b;erNon0;!ne02;ascals,e1i0;cXnt00;rcent,tJ;hms,unceY;/s,e4i0m\xB2,\xB2,\xB3;/h,cro2l0;e0liK;!\xB2;grLsR;gCtJ;it1u0;menQx;erPreP;b5elvins,ilo1m0notO;/h,ph,\xB2;!byGgrEmCs;ct0rtzL;aJogrC;allonJb0ig3rB;ps;a0emtEl oz,t4;hrenheit,radG;aby9;eci3m1;aratDe1m0oulombD;\xB2,\xB3;lsius,nti0;gr2lit1m0;et0;er8;am7;b1y0;te5;l,ps;c2tt0;os0;econd1;re0;!s",
  "Noun|Gerund": "true\xA6:!1:#$%&()*+-./<=>?@[:er,oc,ts,ae,us,rt,il,ni,or,re,ra,lc,ro,rd,cs,dn,ps;g+0;b3Tc3Od37f34g2Xh2Ok2El1Vm1Qn17-ez,p0Xr0Is0BtCuBv8w5xal#,y1zi0;la(iv,n0F;a2du%,evr(,fi%uj,l1r0t/p;c,=w;!lub;lp,rp,s;a>,eiv.tYo0;ns,r0;!/h;eirg,i1r0;ac,es;d,>,vr(;g/,)cu08;aQbuod,cJeHfGhgif,iFluLnBov,plu?,rAs5t0uohs;a3e2i0;nk,s0;!ybab;b,s;hc,m4;a1e0*,-f;finam,t,v/h;c0t;!da-b,e0;=f;*f,op#;ahc2evFi1u0;h,$ca;ap,rp;!ne;aw,b,m*,rw;arc,*;e0gdub,k/m;m,rg;a3e2u0;@$,)0;sn$;ll$,[4rS;!r0;et2t0;b(,ta;bZc6d,e5g4itogen,ks,luvo,+?af,o3r1tidem,von0;+;!belec,e0$X%ulli;neg,po;b,c,lb;elUivan;!h,s;inumm$,ude;&5i3nec*,o07r2s0;e0-c;c-p,lb,>;&h#,un;c.7n0t.vda;ag=;l,t;&De6i5o2utc0;afunYu0;r%#;?,l0tinom;$,p0;xe;h,w;@5e4ff3htY[ihw,tac,v0;*C$0;!s0;id;o,(;hc,+gne,tnulov;#,ow;<,ws;ee7m6o4p0rub,yt;a1i0oO;hs,t;<,r0;!w;c,lev0;ed;ac,ud;k0ls;ec&p,koob;&HeCgis,i8n6o2/0way;e0w;l,y;@aba,it1<,ri,s0z;a#,i1;is0seuq;op;a0igeb,ur;lp,t;a0gami,m;l1),t+0;am;pm$;dr3#Gpo,t0;=1s0;*;hs;ag;<,m;a#3it,miws,o1r0(sa;af;c.0oz;vo;?,d;angHbbiGcycF@EeBgguAi9l6ooh5ruc,t3u2w0;a0oh;rc;deh2r;s#w,t0;ab;?;e1i0;f,k;[,ty=%,v3wd,y;as,f;j,rZ;d1ef,v0;a);om;ah;!#;>;is;a8c6ih,lat,+5o3r0;ap,ow0;!t0;en;ms,o0;b,c;ht,>;a0ik;b,);b,tU;c4gual,s2t0;&0o<;rb;aw,i0;f,lbup;a1t0;aw,#Bib;et,o0;c,rppa;a3d2goj,n0;is,ol0;eb;ol,uj;!kc1ss0%;em;ap;fu1o-,r0;(;%;aEdew,iDlBn5o2r0;aob0$5;etaks,wons;c,lp1o0;lf;mi;a3e1if,o[0uf;#;![,te0;rp;l,rb,%0;.@u;i0oh;ub;lg,r,ug;e0);nk,r;i,n0;a1ef,ivn0;$;d,n0;if;bu1m0;i0ob;<",
  "PhrasalVerb": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:up,in,do,e ,t ,k ,ba,aw,p ,ck,l ,ar,d ,n ,for,h ,r ,ut,y ,ow ,nd,th;0:92;1:96;2:8H;3:8V;4:8A;5:83;6:85;7:98;8:90;9:8G;A:8X;B:8R;C:8U;D:8S;E:70;F:97;G:8Y;H:81;I:7H;J:79;a9Fb7Uc6Rd6Le6Jf5Ig50h4Biron0j47k40l3Em31n2Yo2Wp2Cquie(Hr1Xs0KtZuXvacuu6QwNyammerBzK;ero Di-LonK;e0k0;by,ov9#;aQeMhLiKor0Mrit19;mp0n3Fpe0r5s5;a.Aee/Di0S;aLiKn33;g@3Wrd0;>D[K;%1$,oJ;i(79k5l)Lrm 69s@Kt83v60;+3%1o7#;+3$,oC;rgeBsK;&2herE;a00eYhViRoQrMuKypP;.Er>K;%1$,oJ#;aLiKot0^30;.l7Z-F;c)HdK;&5Y;n7W-3Es5K;c)MdL&Kghte>6me0-o0Rre0;+3*4%1$,#;&I^2;by,oG;$)Lr_K;+3*4$,#;*4ov9#;aK&77ll62;m 2[5M;.Bk&Ll)K;ov9shit,u47;aK*4%1$,leave,o4D#;*4ft9p<t,w3;a0Vc0Te0Mh0Ii0Fl09m08n07o06p01qu<5GtQuOwK;e<MiK;ngLtc@K;+3*4o8K; by;cKi6Bm 2ss0;)64;aReQiPoNrKud35;aigh2Det75iK;k&7Sng K;al6Y#;-Krm2F;by,$,oG;c3Ln3L[2tc4O;-F;c3Jmp0n=LrKveA^2O;&H(2L;*4%1#;<3GeNiMlLrKurB;ead0$gBuc5;a49i(6H;c5l/o3C>2;a)Fe1Xll0;a3Bbe[2rt0un=like;a-5V_Duggl5;as@6Noke0;ee-NiK_6;cL-K;o6D#;&68;$,oK;ff,v9;de19g>4NnK(6Gz5;gKkE; al6Ale0;aMoKu5W;o(K]0w 7M;+3*4?,oC;c2WdeEk6EveA;&Pll1Nn=Orv5tK; Ktl5J;%1foL$,o7#K;!on;ot,r~;+3*4%1$,o33#;oCto;al66o]0rK;ap65ew 6J;ilAv5;aXeUiSoOuK;b 5Yle0>Kstl5;aL*4%1$Ko2I~4Nu5P;!to;c2Xr8w3;l/Mo(LpeAuK;g3I`17;a2W?,o7;<8$,o7#;ng 68-oKs5;ff,pen;aKelA$Ent0;c6H=K;o4D#;c27t0;aZeYiWlToQrOsyc35uK;l/Mn5K(K;aK*4%1$,oJto47#;p<t,w3;a3J%1$,o21to45#;attleBess KiNo-2;ah2Fon;iL-Kr4Zu1Gwe[6N;%1$,o6N#;nt0;aLuK;gEm-6;c&u20^6D;c)Kg0l&4A>6p5B;oJ#;e/5NncilE;c53i[39n0ss MtL^K;*4oG; Hc2R;+3*4$,oJ;pKw4Y;e4X(D;aLerd0oK;dAt53;i/Hrr_H;aTeQiPoLuK;ddl5l/I;c1FnkeyM-6]hAv&K;aK%1$,o4L#;l4Nw3; wi~;ss0x 2;asur5e3SlLss K;a21#;(6;k&L>6rKs2Ax0;)6ryA;%,fun,oCsure,#;a02eViQoLuK;.0s(I;aNc4Fg MoKse0;)Kse4D;aft9*4%1?w37$to,o0Zu46;$,oJ;=6;&NghtMnLsKv&00;te>F;&2)2; 2e46;<8%1$;aM(LvelK; oC;%1go,$,o7#;nEv&K;$,oK;pK];en;c5-2s@LtchBughA^K;%1o59;$to,o7;eMic)Lnoc)K;%1oC#;oC#;eL^K;$,#;/I-K;+3*4%1f04$,oJto,#;aMoLuK;ic5mpE;ke3S(H;c43zz 2;a01eWiToPuK;nLrrKs@6;^2;keL(K;<8%1;[H;lKneErse3K;=K&2;*4dKfast,o0C#;e<,o1;d&L(K;*4on,#;+3o7;aKlp0;=M/I[K(2;fKof;rom;?,$,o03uW;cPm 2nLsh0v&Kz2P;at,it,to;=Lg KkerP;%1$,o2T#;%1$,oK;],v9;)2;aZeTiv&Rloss IoMrLunK; ?;ab hold,$43_2U; Kof 2I;aMb1Mit,oLr8~1IuK;`9;ff,n,v9;bo7ft9hQw3;+3bK%1$,oJrise,#,w3;a4ir~;< 6ek0(K;aLb1F%1$,oKr8#;ff,n,],v9;cLhKl2Fr8t,w3;ead;ross;=aKng 2;bo7;a0Ee07iYlUoQrMuK;c)Ke2N;<8#;eLighte>KownB^2;+3oG;eKshe27; 2z5;g 2lMo/Kr)I;aKwi~;bo7r8;=6l_2;aLeKip0;sh0;g 6ke0mKrKtte>H;&F;gRlPnNrLsKzzle0;@F;&Km 2;+3*4#;d0isK;@2;&K/1T;+3fP$,o7;h(*4ure0;ePnLsK;s 2;cM=K;fKoG;or;&D;d04/2;cNl/Krm0t1G;aLbK%1$,o09short,~08victim;a4eh$d;p<t;&K;%1oG#;a(Kdge0n=12y5;$,o7#;aOi1HoNrK;aLess 6o-KuN;+3b03$,oC;gBwB; Ile0ubl1B;m 2;a0Ah05l02oOrLu(K;+3*4%1oC#;a.Bee-LoKy0;ss Dwd0;by,%1$,o0U#;m&NoLuntK; o2A;)6/K;%1oG;aRbQ?O$,oNtKu0O;hLoKrue;ge~9;rough;ff,],v9;~,wK;<d;a4y;paKr8w3;rt;eaLos&K;$,oC#;>6[F;aNeLiK;ll0pE;c)De[Kw F;on,#;(2;lRncel0rOsMtc@LveE; $;o1N#;@D(K;%ubt,oG;r^LvK;&08;+3oJ;/Km H;aL*4%1oJ#;ff,n,];r8w3;a0Ve0MiteAl0Fo04rQuK;bblN.l05il0Dl)6`l05rLsKtM^FzzA;(00;>0HsK;(D;&I;ov9;anWeaUiLus@K;oG#;ghQng K;aN*4%1?M$,oLuK;`9p;n,];~;bo7lKr8w3;ong;teK;>2;)K;%1$,o7#;ch0;<Tg 6iRn5oPrNssMttlLunc&Kx D;+3*4;&6; <8;&H;%1;)D(2;&2;/6;%1#;=2;aPeed0oKurt0;cMw K;+3*4%1o7#;.;)K;$,oC;.0nk0stA; oQaNef 2lt0n=K;%1ov9#;er;#;[L(K;%1$,oC#;%1o7;ff,nK;to;c)Pil0nMrgLsK;@D;a$B&D;g DkB; on;$,o7;+3%1$,oC#;ff,];ay;c(FdQir0s)MuctionA; oG;ff;<8o7;ouK;`; o7;=K;%1oK#;ff,n;wn;o7#;]",
  "ProperNoun": "true\xA6:anilatHdGeEgniDitsirClAn5o4s3weivriaf,xaja,y0;brik,el0ssim;bmew,ekr0seAtn0;eb;edecrem,in;cn3mle,rue;ediam nori,o0;sduh,t0;e1lra4nih,pm0;arf;eb,lr7;eir,l0;ewhtor,igcm;hc;dlaps,lr3;cnerolf,i0nwodsdnal;brab,suohlad;iba,oowrehs,rofsog;ac",
  "Person|Place": "true\xA6:a5ebok,n2o0rodavl6tnek,yendys;dnalro,g0;aitn4eid;adroj,i1ot0;limah,suoh;tsua,wrad;i1ram0;as;nigr1r0;dnaxela,otc0;iv",
  "LastName": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:er,an,ar,en,on,ch,in,is,ng,ri,ov,ll,as,el,na,ro,la,va,ta,al,ra,ne;0:BR;1:BF;2:B5;3:BH;4:AX;5:9Y;6:B6;7:BK;8:B0;9:AV;A:AL;B:8Q;C:8G;D:7K;E:BM;F:AH;aBDb9Zc8Wd88e81f7Kg6Wh64i60j5Lk4Vl4Dm39n2Wo2Op25qu+pe,r1Ls0Pt0Ev03wTxSyKzG;aIhGimm#m6A;aGou,u;-,o;kh%5ytsE;aKeun9BiHoGun;koyama,shida;!lG;diGmaz;.m,z;maG-;da,g52moto,sGzaC;aChi^;iao,u;aLeJiHoG.ght,u;jcik,lff,-;lGmm0nkl0sniewsC;kiB1liams33s3;bG+s,lt0;b,#,st0;age,gn0lHtG;$abe,s3;k0sh,tG;#s,(;aLeKiHoGukD;gt,lk5@by5;dH<_Gnogr3Kr1Css0]ldi;ba,obos;_,/4;l=Hs>8W;lJn dIrg=,sHzG;qu7;ilyEqu7siljE;& b6Aijk,yk;&zu>a,v#de;aPeix1VhKi2j8ka43oJrIsui,uG;om5UrG;c2n0un1;$,emb[y,yn+C;dorAMlstoy,m4rrAth;at)0i<,oG;mHrG;%e84[cius;ps3sG;&,(;hirDkah9M?ka,te,v%A;a06)01eYhUiRmOoMtIuHvGzabo;&9Jobod3N;%7bot4<iv2zuC;aIeHoG;ica,j4Ay$AB;>e,*2FpheBv&s25;l8rm0;kol5l/y5re7Tsa,to,uG;-,sa;iGyth;rn5tG;!h;l],mHnGrbu;at9c[ir,gh;moBo7M;aIeGimizu;hu,v)G;&ko,uk;[,rma;gu9*f>d,mGoh,pulveda,rr$o;jGyG;(5;evi6iltz,miH~id0@ed0uGw%z;b#t,lz;dHtG;!t,z;!t;%4Th8ito,ka4OlJnGr4saCto,und#s,v4;)7dHtGz;$a,e,os;b53#s;=,ihDm4Po0Y;aVeSiPoJuHyG;a6oo,u;bio,iz,sG;so,u;bK)a,d.gue67g#s,j=,mJosev>t,sItHux,wG;e,li6;%i,h;&b4Usi;$o,#o;#ts15i93;bei@,cHes,vGzzo;=,e9;ci,h%ds12;ag2es,iHut0yG;es,nolds;s,t0;dImHnGsmu97v6C;t$1;ir7os;ic,u;aUeOhMiJoHrGut8;=ad,ifti,o)azk27;l+hc2GpGrti72u10we<;e3A/51;cH#o,nG;=,to;=so,hl0;aGi<ips;k,m,n6I;a3Hde3Wet#s,?,rJtG;#sHr/Gt#s54;!a,ic;!&,(;eGic,kiBss3;i9`,tz,z;h86k,padopoulIrk0tHvG;ic,l4N;>,te39;os;bMc(nor,g2TlJ~i<,rHsbor~,weBzG;demir,turk;e<$a,tGwe<;ega,iz;iGof7Hs8I;vGynyk;ei9;aS.1;aPeNiJoGu~50ym2;rHvGwak;ak4Qik5otn66;odahl,r+;)olsZeHkolGls4Jx3;ic,/84;ls1miG;!n1;ils3mG;c/a,ec;gy,kaG`y2sh,v%@;jiGmu9shiG;ma;a07c04eZiWoMuHyeG;rs;lJnIrGssol*i;atGphy,`y;i,/4;oz,te58;d0l0;h2lOnNore,rHsGz%t;#,s;aKeJiIoz5r+HtG;e56(;!(;!n7K;au,i9no,tti;!lA;@e,tgom#y;*a,l0;c`cFhhail5kkeHlG;l0os64;ls1;hmeJiIjia,lHn3Krci0ssiGy#2N;!#;nyk,o;#,j0;dDti;c%tHlG;aughl8e2;hy;dQeda,gnu68i0j#us,kPmNnMrItHyG;#,r;ei,ic,su21thews;iHkDquA@qu8t*G;ez,s;$i,c,nG;!o;c*i,n;$i,mG;ad5;%5>a,*1;.g_,s1;aVeOiLoJuHyG;!n);k4nGo;d,gu;mb%Gpe3Fvr4we;di;!nGu,y$age;coln,dG;b21holm,st@m;bedEfeKhIitn0kaHn8rGw+;oy;!j;m11tG;*1(1;bvGvG;re;iGmmy,-,rs2Qu,voie,ws3;~,t1F;aZeYh2iWlU~z50oNrJuHv%2woG;k,n;c#Gm%68z~ts5;a,/a;aHem0+Gyeziu;h?,t3O;m0sniqi,us3KvG;)4O;bay57),rh0Usk16]Iw_Gzl5;czGsC;yk;cIlG;!cG&ko;huk;!ev4ic,s;e8uiveG;rt;eff0kGl4mu9nnun1;ucF;<0n~dy;hn,<Km*sC~,pIrHst`ti,to,ur,yGzl5;a,s0;j0Rls22;l2oG;or;oe;aP&Oha6im14oHuG;-,r4;e32hInHrge32u6vG;$D;es,ss3;$HnsG;&,(,t3;~sGs1R;&,s1;kiBn*gs,s1;cJkob4EnGrv0E;kDsG;&,sG;&0I(;ks3obs2A;b`himDglesi=,keda,l0Qnoue,(eIshikHto,v$oG;u,v54;awa;scu;aVeOiNj_^l8oIr+t50uG;!aGb0ghAynh;m2-;a6dz4fIjga%d,k,lHpUrGwe,xha;ak1G]t;mAt;#,fm3WmG;$n;ggiBt)cock;iJm*gway,nHrGss;n$d7re9;deG.ks1;rs3;kkiHnG;(1;[,n1;dz4g1lvoQmOns0ZqNrMsJuIwHyG;=Fes;kiB;g1-;$HhiG;moto;i,/0J;di6p0r+,t;ue;a[G;*1;rs1;aVeorgUheorghe,iSj(RoLrJuGw3;#rGnn%3Co,s^f3Cti#r7zm2;a,eG;@;ayli6e&e,g4iffithGub0;!s;lIme0UnHodGrba)E;e,m2;c_vAz_e0S;dGubE;bGs0E;#g;aj,i;bs3l,mGordaO;&7;iev3U;gnMlJmaIndFo,rGsFuthi0;cGdn0za;ia;ge;eaHlG;agh0i,o;no;e,(;aV#QiLj>dsted,lKoIrHuG;)s,&tAji^,<0;eem2iedm2;n^Grt8urni0wl0;?;emi6orA;lipIsHtzg#aG;ld;)0h0;/G;!ic;hatDn$IrG;%Gei9;a,i;deY;/4;b0rre<;dK*sJ.ksIsG]B;cob%,pGt`da;*oza,osiQ;&,s3;te8;#,+3w%G;ds;aXePiNjurhuMoKr+co<,uHvo`kG;!oT;%te,boHmitru,nn,rGt^;$d,ic;+;g2he0Om*gu7nErd1ItG;to;us;aGcki2Hmitr2Oss$ayake,x3;s,z; Jb?IlHmirGrv+Fvi,w2;!/4;gado,ic;th;bo0g@ot,jo6lHsilGv.A;];a cruz,e3uG;ca;hl,mcevsCnIt^,viG;dGes,s;/,s3;i>sGku[;!&;ki;a0Be06hRiobQl%kPoIrGunn*gham;awford,ivGuz;e<i;h1lKntJoIrGs^,x;byn,reG;a,ia;ke,p0;i,r#=;em2liB;ns;!e;$u;aOeMiu,oIr+tGu6we;eGiaG;ns1;i,-,p9uHwGy;!dH;dG-;huJ;!n,(Gu6;!g;kJnIpm2ttHudhGv7;ry;#jee,o14;!d,g;ma,`boG;rty;bJlik,-4rG;eghetHnG;a,y;ti;$,ot%i;c#Ald#3mpbeLrIstG]d*i;iG@;<o;doHl0Er,t0uG]lho;so;so,zo;<;a0Fe01hYiXlUoNrKuIyG;rLtyG;qi;)$2rG;ke,ns;$k5iem,oGy$t;oks,wG;~;gd$5nIruya,su,u)aHyKziG;c,n5;rd;d%Gik;&G;ko;/;aG(d_;nco,zG;ev4;$cFshw=;a08oGuiy2;umGwmG;ik;ckReth/1gu,ktPnNrG;gJ+InG;=coGds1;ni;ha;#,mG;$G;!n;gtGit7nP;ss3;=F;hi;#,hG;am;b4),ez,hRiley,kk0ldw8nMrIshHtAu0;es;ir;bInHtlGua;ett;es,i0;ieYosa;dGik;a9yoG;padhyG;ay;`;k,-;ic;bb=,cos^,d07g04kht%,lZnPrLsl2tJyG;aHd8;*;[;)+3kiG;ns3;aImst@6sl2;$;-;ujo,ya;dJg>HsaG;.;/G;!a;#sJ/,reG;aGjEws;ss1;&;&,(,s3;(;eksejEiyEmeiIvG;%7es;ez;da;ev;%wHuilG;%;_;ams,l0;#;^;=",
  "Ordinal": "true\xA6eBf7nin5s3t0zeroE;enDhir1we0;lfCn7;d,t3;e0ixt8;cond,vent7;et0th;e6ie7;i2o0;r0urt3;tie4;ft1rst;ight0lev1;e0h,ie1;en0;th",
  "Cardinal": "true\xA6bEeBf5mEnine7one,s4t0zero;en,h2rDw0;e0o;lve,n5;irt6ousands,ree;even2ix2;i3o0;r1ur0;!t2;ty;ft0ve;e2y;ight0lev1;!e0y;en;illions",
  "Multiple": "true\xA6:d5noilli0;b,m,r2t0;ni2p0x0;es;da0t;uq;erdnuh,nasuoht",
  "City": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:an,ra,la,en,al,ng,er,in,ha,ch,es,is,ar,ba,to,sa,sh,or,ta,ad,pe,hi;0:74;1:61;2:6G;3:6J;4:5S;a68b53c4Id48e44f3Wg3Hh39i31j2Wk2Fl23m1Mn1Co19p0Wq0Ur0Os05tRuQvLwDxiBy9z5;a7h5ibo,uri.;a5e5o)[0;)3H;greb,nzib=;#g2e5oko-ma,unfu;kat*+3Hrev0;a5n0Q;m&,n;=sBeAi6roclBu5;h0xi,zhou;c7n5;d5ni`g,t*th4;hoek,s];~^,klow;l63xf]d;aw;a8e6i5%divos?k,olgog$d;&3lnius;nice,r5;o3@ill/;l&cia,ncouv*,r3ughn;l# >?r,rumqi,tre.t;aFbil<i,eEheDiBo9r7u5;l@,n<,r5;+,ku;i5ondh62;/te,poli;kyo,msk,ron?,ulo5;n,uS;#5jua3l2Tm<oa$,$3;j+,[ui; -gue,ss(oniki;gucig(pa,hr0l aviv;briz,i6ll+n,mp*e,)5rtu,[k2R;i*,[0;#,.u1n0`i,yu0;aEeDh8kopje,owe?,t7u5;$5zhou;>ya,t;at& <55ockholm,$sbourg,uttg=t;#8e6i5;jiazhua1llo1m%,y0;f50n5;ya1zh&;g-i,?u;attle,oul,v44;c$m&?,+t ClBn5o paulo,pp]o,$jevo; 7aa,t5;a 5o domi)o;a3fe,m1M;#?nio,diego,fr#c<co,j5`dro,s(v_];o5u0;se;em,t %ke city,z25;lou<,`t*s24;a9e8i6o5;me,t59;ga,o5y_h;! de j#eiro;cife,ims,nn/,ykjavik;>t,ip4leigh,n.i,w(p+di;i)dao,u5;ez2i?;aFeEhDiCo9r7u6yo)5;ya1;eb%,ya1;a5e?ria;gue,?;rt5zn0; 5l#d,o;au pr+ce,elizabeth,@id;ls&,$eus,tts26;i%delp~a,nom p&h,o&ix;ki1^h tikva;dua,l*Ynaji,r<,t5;na,$s;ak44d/@,msk,r6s5t^wa;aka,lo;#,dos;a7ew5i)bo,ovosibirsk,yc; 5castle;del~,]le#s,^i`i;g8irobi,n5pl/,[v33v0;.6ji1t5;/,o1;a1o1;a6o5p4;ya;no,@ki;aEeCi9o6u5;m>i,ni.,scat;g_<hu,nt6s5;cow,ul;evideo,`lli*,re(;ami,l6nsk,s5;kolc,s<@uga;#,waukee;cca,d5lbourne,mph<,ndoza,ssi3;#,ell+,i3;cau,drAkass=,l9n8r5[-d;aca6ib5$k/h,se2L;];ibo,y;aus,.Fda%y,i%;mo;id;aDeAi8o6u5vSy2;#Mcknow,d~a3;n5s #gel/;d2g bea.;brev2Bege,ma5nz,sb2v*pool;!ssol; m#s,i5;c5pzig;/t*; p6g5h]e,n0Cus#ne;os;az,%^;aH-rFiC%i`Bo9$kow,u7y5;iv,o5;?;a% lump4n5;mi1[0;~ma,lka^,pavog4si5wlo2;ce;da;ev,n5rkuk;gst2s-5;@;k5?um;iv;bHdu3l%kuri.i,mpa%,n6ohsiu1$5unas,wagu.i;.i,j;d5o,p4;a-r,y;a7e6i5oh#n/V;l+,n0;ddah,rus(em;ip4k5;=^;>d0mph(,nArkutUs7^Xz5;mir,^pa%5;pa;fah0l6t#b5;ul;am2Zi2H;.e2d5;i#ap2M]e;aAe7o5yd*2W; .i mi5ms,nolulu;nh;f6ls+5$kli2;ki;ei;ifa,lifax,mCn5rb+,va3;g8nov*,oi;aFd#E&DhCiP%sgBo9$z,u5;a5j$t;d(6)5yaquil;zhou;aja$,u`;ld coast,th&5;burg;ow;&t;eva,oa;sk;lw7n5za;d~5g?k;nag=;ay;a<(29/,o8r6ukuya5;ma;#kfu5/no;rt;rt5[0; w]6(e5;za;th;d5+dhov&,l paso;+5mont2;bur5;gh;aBe8-ka,<p4o7r/d&,u5;b5/seld]f,nkirk,rb0[#be;ai,l+;-,)gu0rtmund;h$dSl6nv5troit;*;~;do)hIe6k=,l5mascus,r / @%am,ugavpiY;i0lU;gu,je2;aJebu,hAleve0Vo5$iova,uriti>;lo7n6p&-g&,r5;do>,k;akKst0V;gUm5;bo;aB&8i6o)qi1r<t.ur5;.;#g m7ca5t^go1;go;g6n5;ai;du,zho1;)5t?g$m;.8s-,zhou;gli=i,i9lga8may&Jn6` ?wn,r5t#O;acCdiff;b*$,c5;un;ry;ro;aWeNhKirmi)-m,oJr9u5;c-reTda`T&os air7r5s0tu0;g5@;as;/;a9<6usse5;ls;>6t5;ol;ne;sil8t<%7zzav5;il5;le;va;ia;goZst2;op6ub#/hw5;=;(;iCl9)8r5;g6l5n;+;&;(uru,-zi;fa6g$de,o h]izon5;te;st;ji1rut;ghd_,kFn9ot8r7s6y# n4;ur;el,$h;celo3i,r#quil%;ou;du1g6ja lu5;ka;(o6k5;ok;re;);*s5u;field;a05b02cc$,dd< a>>,g=^ZhmedXizawl,lSmPnHqa>,rEsBt7uck5;%5;nd;he7l5;#5;^;ns;h5unci2;dod,gab5;at;li5;)t2;on;a8c5kaOtw*p;ho$6o3;na;ge;h7p5;ol5;<;eim;a$vati,m0s5;t*d5;am; 7buqu*q6eppo,gi*s,ma5;ty;ue;>s$h ( q_im5mawsil ( j_id5;ah;ab5;_;%;>;$;idj0u d-5;bi;#;lbo6rh5;us;rg",
  "Region": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:na,ra,at,ah,hc,ro,ar,al,ni,re,la,sa,ac,an,ss,oc,im,si,tn,is,en,rb;0:2U;a1Abajnup,c16d#0Ye0Ign0Eh08i04k00lZmXnPoKrHsBt6u5xe?4y1zurca8;&ca$k,d#m)n,e2kcu^ek,lic_,n1r^ev@;=sut,oxas;rrZs.j0H;e,us;d> l[%,ohziug,s#g;a$jug,e3i$y>,nom2u1;citc`n@,v>K;.v;hlys,sr1;emos,od;a3d2e^ei/c<uga,i1ole)m,ttesu(a?0;*eg <-m,o-lli;eel,#ld[;cet=az,p2s#k1xet;!$;ai(,iluam%;&ib,o2up1;gnOin0;d*b+ d# d#ld0Jg#les;&#r0c3da)l@,g2hadi,i1-d$bak,or a#t-uq,$te.uq,taujaV;ho,$^o;/dP#rud;ixemXs1ubm>.p;ab%,i/j;a3eme~,_n@]w,o1;el ove1ge),k5t0I;un;cao4gi4ht<jEijuf,nuh,t1u(_,we(tak<s;=2#lek,s1;egad,ot)kh<b,$t%;uy;([;a1ikk_;)z[,s<;agneb1Ie ir0;a3ciwsnu~Klof1rJ;f1)n;us;.p,wa$s;a3ep,h&sj2iaw&,mok,ppi?i1ruo1sotop ]ul #s,xg#ij;?[;*;hg-q,t/;a5$g]tt&(,sed*p 1;a3l&ca1rW;m1nu$;ih;rhd#,yhd0;dek,tu;a3[oyw,odg1;#1;ug;hap,nep;e?`net,(epF-0r3t%s kr1uq<b;oy1; w`;aw+Bihs1;=#l,d)f9egdi~Bk6m&g-5n4pm&3.tsec1ybrA;i1uolg;el;! w`;l@-l,otpma4;kcub,tton;ciwrH)y1;! 1;ht)n;f%s,t.h,xo;ed;m=;hk6l1;ag4d3s1yr0;i 1nee7;d$wde ec-rp,edohr;nuofw`;>;*1$hj;%tu;d not2ebe1;uq;g-hs1;aw;botin0c0Id0Ge0Fh]do,iSkQlNmLn9o8r6t3uhauhi(,v2woi,y1;+&gem,n(e(;ut;o1.bJ;kad9s`n1;[;a1on9th<$h0upirt;ec,p;g,/nU;a7i2luRozi1;$;lo$c2$t= %n1;as; ht1;rHu1;os;g#l4i3r2^Dyr1;&;ap;dE]uol;et;aba1ilYoh+ko;/;a1iuhaW;cx+t,r1;ek;%>rL<1;/,~Q;bmul@ h]tiMg)eg,hKkymlJlerJnCr9?7t2vodr1;om;ayr4e2@s av1rumdu,ukay;on;hsug1?o;-;ub;aka1ek.E;hk;a2bmuc,eb1;_;kl3v3;a4igriv3)fi/c1;! aj1;ab; tsew;ms2vlysnn1;ep;%;ak;ab,<vu1;(;~;gyda,mirc;av1i)lf;`;axao,c+0_r1;@;am",
  "Place": "true\xA6:!1:#$%&()*+-./<=>?@[]^_`~:ni,ra,ir,na,al,ah,rb,ne,or,ts,er,oc,ro,la,re,el,hc,en,il,ih,eb, e;0:46;1:4U;a4Ubxd,c4Td3Me2Uffulb stt<s,g2Qh2Gi2Ek24l1Um1In0Eo0Apeew+voh,r01sQtCuBwAx8y2zyy;auq=t,b6@4>ti @tt^,r2tnu<~g&=;rHub2;dus,hg_;d#l,gn2>vTma*,sn$b,xo;(,ib;gid,sm%g,t2H;a2hp,no*K;i,l;fd,gl,-$h;b^0[cip u[0;c%.id EeCf-chsa,lc,noAo9r5s2; C/c3i,ruh2;dnyl,+varg;e#p,ll_;op3u<2;#ga,sl$e;nov2w];ed;hs?d>,ogizut;mkao,rf2;ek(,r3P;/. 2k$mw];#0;g#ppohs,>ic&#f;aBd&l9e6g#.),kae*5ll3ma,notpm)2s]?v#;~ht;af3_ 2;tesnus,yl?v`; r24;d(g?ve,g&g,%fmud,k(0Em)t,r2w@;ca2oza; n1T;hg_,si #griv,wo2;daem,l;c%ema,l;ataab&(u,e2hl,ia l`,oomt$d,yda&;+[tik,t4v2;%~c+rw( t#as,od2;!&;aw$@c,exe,s2;acn3e[2;l<,#w,-,rB;a2od;!l;c3fs,hos,les~oks$st,r2tnot;=ma1urt;f,m,o#2;=;aZcYeWiRo8r7wot2ylk1N; dlo,a5dMe4n2pu;apaj,w2;od;g14ttol$1;/ok,#1;evl0iactip,ubk0I;dI+ht$p,t2y&c snwo*;aes,cGgnChg%b,kco*,lBnAp6r3s2tud;^>,ue;e2ub^);b>,v2;e,it;m2u;a2<;h2*;!t2L;^ge,uat;am,ob;(,i2;l2n+p,s+k;l2$d;im;a,ip;eew,g#2y-c;ba,tnuh;a4e.&w[su],l2;)k2m/k &zak;as;lp oz%$c,t%b2; ta/g;d2v)riaf;!yrd;b,i;cauhitoet,dag0eco 2tt)n0;ci2&id#;ficap,t2;c$2&lta;!t2;&;a4@$h,u2;essol<,l2;ut;h2ntup;g7k6lep,+2rud,s?vac,ta1w];d4t2;le1t2;ot;!ys;cIr0;%b,#2;kcub,ll`,tton,w;a9hp,l2oopk8ta,uk;a5ew4_2;d/,g#rps,n=2x`;ht;d>c,kco.;hxuav,w2;k2nr<;c(b;ham jE%omem nl<n2;^;c6ep,gc,kb,>wd$ob,o4r3s2uu1;$yonsark,tukR;aw],oy;o*woll2.ov;iw;iw3o2;r y]mi1.doow;r3s2;ek;aw,`;iepmop,ktapuw,$vadog,t_2;at;c7gi@yar,pleug,t2;`m(,r2;ep,o2;faJ+g3wtn2;ew;diV;iw3ru[t2;_w;loTn2=n,spi;e/g;dc,kh,n2;i3ok2;em;kOppe,?kcIs&l;arsSbQc&znPdJff^cd/,gEhpmo%t~d c$,koCl9n5p-ue,=mit>b,v-g 3ztgn2;ay;@p0r2;ad7;i4o.2;di0k2;ooG;es;ba.n3in,liv?tn2s^rW;ec;ud;o*?2*mE;hs;(liv y5d%2; ]3b2;do8eca7mPxu;ip;ag;is2&rg o%; 00a5do4k2rY;oo2$p;*;ow;@;ep;m<yw,un2;ad;ok;ae.pm),lZnNoowF=3u-Ev2;oh;!f2;d`,/DfaBgnAl8r7s6t3x2;e,o;a3r2;ad,eh;r7w;@ya,mle1tobba;),etXo;i,l`pm2;ac;(;.;@7g#4k3y2;eh;ao,$p;ll3r2;ps;<;gTp0;am;(9e2h,om[4; 4br2;ev2;%;ht3.2;ae,ew;r2u8;on;g+ w4hg3?dn2si~kCwol;us;_;];eif3owhtu2;os;ek6+4sn2;am,<a2;`;!e2;rg;aw;);ida%da,um;c%fa,e7i6#[od5r3uhac%i1zti +[i1;[;bm)2f;>;#;sa;kaukomua&hap5s2; d3?tt2;ab;/;ap",
  "Country": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:an,ar,in,er,ra,na,ma,al,ri,en,st,ba,el,ti,ca,te,or,ia,ne,ng,is,d ;0:38;1:2L;2:3B;a2Xb2Ec22d1Ye1Sf1Mg1Ch1Ai14j12k0Zl0Um0Gn05om2pZqat$,rXsKtCu7v5w+4yemTz3;a25im<bwe;es,l` #~futu);a3.ezu=a,iet)m;nuatu,>c# city;gTk6ni@~4ruXs3zbeE; 2Ca,sr;$ab emi(@s,k%gdom,/a@s3;! of am2Y;!(iV;a8haCim[ le/e,o7r%ida~5u3;n`0rk3v+u;ey,me2Zs #~?ic1V;#~t3t3;o<go;go,k=au,_a;iw2ji3nz2T;ki2V;aDcotl1eCi9lov8o6pa%,- l#ka,u5w3yr0;az3edAitz&l1;il1;d2r%ame;lomon1X*l0uth 3;afr2KkMsud2;ak0.0;&( leoFn3;gap[e,t *$t3;.;^gLrb0ych=lZ;%t 3moa,n m$%o,udi $ab0;h=e),luc0m$t%;epublic of ir0Eom2Euss0w3;#da;a4eIhilipp%Uit?irn1Mo3u&to -N;l1rtugF;ki2Dl4)*,pua ^w0V(3;gu7;au,e/i3;^;aBe9i7[3;folk1Ith4w3;ay; k3&n m$i#a1D;[ea;c$agua,g&3ue;!];p3th&1Aw ze+1;+;mib0u3;ru;a7exi6icro0Bo3y#m$;ldova,n3roc5zambA;a4gol0t3;.egro,s&(t;co;cAdagasc$,l7r5u-t4yot3;@;#0ius;sh+l0Xt%3;ique;a4div3i,ta;es;wi,ys0;ao,ed02;a6e5i3uxembourg;b3echt./e%,thu1G;&0ya;b#on,sotho;os,tv0;azakh1Fe4i-<>,o3uwait,yrgyz1F;rXsovo;=%g0Knya;a3&G;*16p2;c7nd6r4s3t+y,v[y coa/;le of m2(=;a3=1;n,q;],oJ;=1;aiTon3u_$y;du(s,g ko_;aB&m#y,h#a,ib(ltAre8u3;a6&n5%ea3y#a;! b`s3;au;sey;d=oupe,m,@*la;e3)da;ce,nl1;$;bUmb0;a7i6r3;#ce,.ch 3;gui#a,poly3;^s0;ji,nl1;lkl#dUroeU;a/ >m7cu6gypt,l s+v6_l1quato-+4-tr5/3thiop0;on0; gu%3;ea;ad3;[;.m$k,jibou5om%i?4r con3;go;!n C;>;aB.t(l af-c# Ah8o5roat0u4yprRzech3; 9];<,(?o;c4lo3m[Q_o b(zzaville,okG/a r04@ de ivoiL;mb0;osE;i3-/*sG;le,);republic;m3)Upe v&de,ym#A;bod0&o3;on;aGeDhut2o9r5u3;lg$0r3;k%a faso,*,undi;azil,i>sh 3u^i;virg%3; `3;l#ds;liv0)i5sn] #~h&zegoviHtswaHuvet3; `l1;#d;re;l3n8rmuG;$3gium,ize;us;h4_ladesh,r<d3;os;am4(3;%;as;fghaGlDmBn6r4u/r3z&<ij2;+0];g.>3m.0u<;);d[(,g5t3;$ct7igua #~b$bu3;da;o3uil3;la;&3;i?;b3g&0;#0;];ni3;/2;#",
  "FirstName": "true\xA6:aRdys,eJfiel,holiIiHlGnBo9rialb,s6timus,y0;aHb4crad,dissac,e0rrSttU;r2s0;a0lQ;c,k;bua,dS;ag,leC;dOi0ok3;o0rk,xeI;cnarf,la;c0k0lrL;in;a1eirda,niuq,o0wahsal;irIv1;g1rik,v0;ed;er,rom;em,ladnC;ak,dFexe8ttDva;hs;duj,i3l2mi1n0;er,neye4;aj,x9;eirbag,hukolem;f2j,lra1m0ssej;aj,maj;hc;la;cul,e4ian3nim,r2t0yli;anih,tayn0;ek;d2ika;am;hs,rd0;na",
  "WeekDay": "true\xA6fri2mon2s1t0wednesd3;hurs1ues1;aturd1und1;!d0;ay0;!s",
  "Month": "true\xA6dec0february,july,nov0octo1sept0;em0;ber",
  "Date": "true\xA6ago,on4som4t1week0yesterd5; end,ends;mr1o0;d2morrow;!w;ed0;ay",
  "Duration": "true\xA6centurAd8h7m5q4se3w1y0;ear8r8;eek0k7;!end,s;ason,c5;tr,uarter;i0onth3;llisecond2nute2;our1r1;ay0ecade0;!s;ies,y",
  "FemaleName": "true\xA6!1:#$%&()*+-./<=>?@[]^_`~:an,el,na,in,en,ri,ie,is,le,da,et,ma,ya,ra,on,la,sa,ia,er,ne,yn,ey;0:J7;1:JB;2:IJ;3:IK;4:J1;5:IO;6:JS;7:JO;8:HB;9:JK;A:H4;B:I2;C:IT;D:JH;E:IX;F:BA;G:I4;aGTbFLcDRdD0eBMfB4gADh9Ti9Gj8Dk7Cl5Wm48n3Lo3Hp33qu32r29s15t0Eu0Cv02wVxiTyOzH;aLeI&eb,oHsof3;e3Sf3@,>;h2iKlI%,`H;ab,ep;.,<;.,h2iH>;%b;aKeJ&g,olB7uIvH;/8?DP;i0%;-0s(3;$,gmur,n,r&,s8W;aoHme0nyi;mei,y#;aM(dDZhiDGiH;d$e9lJnH;if48niHo0;e,f47;a,h$mi0lH<;a,ow;ka0nB;aNeKiHu[5;ck84kIl8o-AviH;#F(J4;ky,to)BK;.,l<,rHs0;a,nH?ica;a,ice;-H_sH9;nILrH;i1y;g9rHs6xue;su5te;aYeUhRiNoLrIuHy2;i,@;acJ3iHudy;c3%,sH;hFta;nHr0F;iF=;aJff#y,nHs6;a,gtiH;ng;!nFS>;aIeHo<si0;a,l<,o8Ares1;l3ndolw/hu;g#,o88rIssH;!a,*;eHi,)7;[,za;bOlMmKnIrHs6t]0wa0;a60`;iH=;a,ka,s6;arFe2iHm77>;!ka;a,iH;a,t6;at6it6;a0Ecar-tt,e0AhWiSkye,_za0oQ),tNuIyH;bil,lvi1;ha,<=h,niAsIzH;#3N/8*,y;#Hi7;!a,e,nH;aCe;aIeH;f#4l5Dph#6E;cI5r5;b3fiAAm0LnHphi1;d2],ja,=;^2lJm?1nIobh#,tH;a,i;dy;l&,v3;aMeIirHo0)sti,y5;a,lDM;ba,e0i5lJrH;iHr6Jyl;!d#,fa;],lDZ;hd,iMki2nJrIu0w0yH;@,<,%;i,-9?,r?,`;aI.,],nH?;a,?;!=;k6mH;!aa;lJrItayesh,vH;.,&j;e0ife;(1i0<;#vi,bLd5Ohar,iBkKlJmInd2rHs6v#%C;aCi0;#t6i2;lDO<,ome;ee0&eh,u2;&1)0;a05eZhXiUoHuthDM;bScRghQl8LnPsJwIxH;#B3*,y;#,e0;aIeH*,lD;#n7ll1<rDGtA;!lHnn1;iH`;e,nH;a,dF;.,i,%;ayyeh;h$67io;b&,^A`;a,cIkH<s,nFta,=;ki,o;h8Xki;ea,i#n?,oH;.,n1P;#0bJemFgi0iInHta,y0;a8Bee;h#eh,%;a,eH;cHkaC;a,ca;bi0chIe,i0mo0nHqu$,y0;di,];a$,$HiB;!e,-;e(4]0;aPeOhMiLoJrHute);iHud(ce;scil3L=mvaB;lHrt3;i0ly;a,paluk;ilome0oebe,ylH;+,l+;ggy,n$ope,r5t2;ige,m0VnKo5rvati,tIulH;a,/8&1;)cHt4T;a,e,];do2i07;ctav3dIfD3+6k[0lHphD3umou,yunbi-g;a,ga,iv3;eHval;l3t8;aWeUiMoIurHy5;!ay,ul;a,eJor,rIuH;f,r;aCeE<;ll1mi;aNcLha)ka,kK@J%,sHta,vi;#Hha;ur;!y;a,iDZki;hoGk9YolH;a,e4P;!mh;hir,lH%,)s[,sreE;!a,+a,lBV;asuMdLh3i<,l5nKomi7rges,tH;aHhal4;lHs6;i1=;cy,/8;e9iF0=;nnguaq;a0Ack(z4e02iMoJ)g%y#i,u)$,yH;a,rH;a,iOlN%,tG;bi0i2llBJnH;a,iH;ca,ka,que;a,cUdo),kaTlOmi,nMrItzi,yH;ar;aJiIlH;#de;am;!l,nB;dy,eHh,n4;nhGrva;aKdJe0ica,lH;iHy;c(t,e;red;!gros;!e5;ae5hH;ae5$3Z;ag#,gNi,lKrH;edith,iIjem,?,yH;em,l;em,s[;#4iHl+a;nHsCJ;a,.;!#,h#;b09cASd07e,g05ha,i04ja,l02n00rLsoumeh,tKuIv+,xBKyHz4;b$l,>,soun;d7rH;a,eE;h8Gild1t4;a,cUgQiKjor4l7Un4s6tJwa,yH;!aHb/h,ja9lou;m,nBL;a,ha,&1;!aJb$,eIja,lD%,sHtza;!a,ol,[;!l1D;!h,mInH;!a,e,n1;!awit,i;arJeI*,oHr48ue)8;!t;!ry;/46i3B;$4Xi7Cy;dH?,ue5;akr#Ay;ak,(,iHlory;a,ka,nB;a,re,s4te;.Hg4;!l3E;alDd4$Hge,+?,?0;ei9&1`;$,-;a0Ne0CiXoQuLyH;d3@,nH;!a,dIe2OnHs~;!a,e2N;a,s~;#n,cJ$0P+1lI%,pHz;e,iA;a,u,wa;iHy;a0Se,ja,l2NnB;+,l1UrItt1LuHv$4;$5+1;aKeIi7%,rH;aADi7;lHn1tA;ei;!&1;aTbb9HdSepa,lNnKsJvIzH;!a,b/h,/8z4;!];a,/8;!a,dH;a,sHy;ay,~,i,y;a,iJja,lH;iHy;aA8e;!aH;!nF;],=;!nH;!a,_;aP.,e0iNjY@,nMoKsJtHx93y5;iHt4;c3t3;edi,lCO;@,nH>;a,*,o2;a,or1;a,gh,@H;!ni;!h,nH;a,d2e,n5V;cOd?9DiNkes6mija,%,rMtJurIvHxmi,y5;^n1&3;a,e5A*,`;as6iIoH;n=,=;fa,s6;a,+A9;a,@;~,*,y;a04eZhXiO-a,oNrJyH;lH>;a,ee,*;+tHy6I;a,(,iIyH;!%;!e,n5F;nul,),urt_y;aO^N-y,mJrHzzy;a,stH;(,&;!b^lIm^nH;aq;eHi,y;e,y;a,stE;!%,>;aHei2?gordzol;dij1w5;$7UiKjsi,lJnIrH;a,i,);d2%,za;~,i,lBLs4y;>,s6;biAc~,d]tou,ede,iSlQmPn=ku<),rNss6NtKviAyH;!e,lH;a,eH;e,igh;!a6HeIhHi4TlD)0y;ar8H^8H*,-ErBAy;!l`8O)0;a,(,iHl5Xoli0`;!<,nFs[;a5il1;eigh,i,lH;e,*;a,tl6O;a0AeZiWoOuH;#MdLlHst88;es,iH;a8NeHs[;!n9tH;!a,te;e5Mith,y;a,iA;!#Nc$DdM$Gh#7V-Lni,sIva0yH;a,ce;eH*;fHlDph7Y;a,&1;(,n1;i7y;!a,e,n45;lHng;!i#,lH;!i#;#N-0nKrJsH;ica,sH;!e,ica;i,);!a,$Gif^,nH;a,/8iHy;!e,f^;a,eJiInH;a,eIiH;e,n1;!t8;cM.,mi,nIque4Ysm&Fv*2y9zH;m&7;a7eIiH;ce,e,n1s;!lHs[,t0F;e,-;&Ik6HlDqu$H;&1`;.,ta;.,lRmPnOo0rNsIvaHwo0zaro;!a0lu,%;aJiI@Hob$;!nde;do2;b$Hdo2;!a,e,l3B;ati,(1i0<;di2es,g)d,ji;a9$BogH;(1;a,e9iHo0se;a0%;aSeOiJoHus[,=c&th;.,ll4rt(se,snH;a,i=;lI<H;);aIdH@I;a,egard;ry;ath^,iJlIn)/Armi9sH;[,t^;(2Uga,mi;di;biba,i-y,lNnMrJsItHwa,y-y;ice,t4;%a,ti;iHm?y,)53;/H;!te;aC%C;a,~,l4;a02eWiRlPoNrKunJwH;(H`/h;!dolD;ay,$;ac*I/H+$B;a,chE;!@;ld1CogooH;sh;adys,(Hor3`+;a,.,%;aKgi,lI%,ov8Es$Hta;a,e,-;.,liH;#;!n0;mLnJorgIrH;ald5Si,m3Etrud7;/8i4X;a,eH%;s+,v*ve;<;bI-,mHrn/,yG;a@t,i5;iI)$H;a,l1;!ja;aTeQiPlorOoz3rH;#JeIiH;.,eB;.,ja;!cH;esIiHo+e;n1sca;!ca;a,(c3;(,o0;lIn0rnH;#B;ec3ic3;jr,nArKtHy7;emIiH<,ou<A;ha,<,n;eh;ah,iB>h,za0;cr&,d0Revi,i0Pk0Ol07mXnid,rUsOtNuMvHwa;aK$IiH;!e,ta;&F`;!a;!ng$4V;g(i1nice;h$,i(9ta;mLp^#KtH;eIhHr$5;^;l31r7;za;a,e>lB;iH<,_4L`;cHka,n;a,ka;aPeNiKmH;aHe21*,y;!li9nuH;$G;lHn1;e7iHy;a,e,ja;lH>ld;.,y;!nue5;aWeUiNlM<,no2oKsJvH;a,iH;%,>;a,*;iHuiH;se;a,(,*,y;a0c3.,e,f,nMsJzaH;!b/HveA;e,h;aHe,ka;!beH;th;!a,or;#or,nH;!a,i;!&1%;ate1Rta;-Es6;vi;eIiH%,wi0;e,th;l,n;aYeMh3iLj(eKoH;lores,m&ique,n3FrHtt4;a,eE+,@,othHthy;ea,y;ba;#09%C?9=;#QbPde,eOiMlJm/r3nHsiree;a,iH;ce,se;a,iI@,orHphi9;es,+;a,@h;dHrdH;re;!dee,%;!b2Fo>C>C;a,d2nH;!a,e;hl3i0@l,mNnLphn1rIvi1WyH;-,%;a,by,cI],lH;a,(1;~,*;a,/8iH;!ca,$1Aka,z;arH];+;a0Re0Nh04i02lUoJ)stI`H;di,th3;al,i0;lPnMrIurH;tn1D;aJd2OiHn2O)9;!nH;a,e,n1;!l4;cepci?,n4sH;t#Hu$o;ce,za;eH-E;(,t8;aJeoIotH;ilde;!pat2;ir7rJudH;/8iH;a,_;a,e,iH;ce,sZ;a2^2ndH;i,y;aReNloe,rH;+JyH;stH;al;sy,tH;a1S(,iHy;#1e,n1;deJlseIrH;!i7yl;a,y;li9;nMrH;+KlImH;ai9;a,eHot8;n1t8;![;d2$GtH;al,$G;cIlH;es8i47;$3ilH;e,],y;itlYlXmilWndVrMsKtHy5;aIeIhH)0;^1I-ErDy;)0;a38sH;a37*;a,iOlLmeJolIrH;*,ol;!e,&1`;lHn;!a,@;a,eI*,otHy;a,ta;_,y;%,s[;ace,ice;a,e,l1;+Al4;&,`;a0Ke02iZlXoUrH;#di7eRiJoIyH;#0nn;nwDoke;#3HdgMgiLtH;_y,tH;!aInH;~,i,y;ny;d,t8;/H;!t7;#0e,nH;.,%;bbi7g@rIlo07nH;iAn4;ka;#cHythe;a,he;#ca,lja0nHs<h;iAtH;ou;aWcVl&UniArPssOtJu@CvH;!^lH;~,y;hJsy,tH;e,iHy7;e,%;!#H;*,y;!*;nItHyl;ha,*;adIiH;ce;/8i9;ay,.;ca,ky;!t)H;ce,z;rbJ=H;rmH;aa;a2o2>;a2Ub2Od25g21i1Sj5l18m0Zn0Boi,r06sWtVuPvOwa,yIzH;>,u0;aKes6gJlIn,seH;!l;&;un;!nH;a,%;a,i2K;drLguJrIsteH;ja;$3;stH;&1;a,~,i,y;aahua,he0;hIi=,ja,miAsil,trH;id;aMlI>qHt?;at;eIi7yH;!n;e,iHy;gh;!nH;ti;iJ-Io6piA;ta;(,n1t8;aH$G;!n1J;a01dje5eZgViTjRnKohito,toH=;&/8nH;$5];te;!aKeIiHmJ;e,ka;!mHtt7;ar4;!b$IliHmU;[;!l1;a,$iH;ca;ka,sHta;a,[;$H*;a,iH;a,ca,n1qH;ue;!tH;a,te;!bImHstasiM=;ar3;$;aLb^K$iJiHy;e,l3%H;!ta;a,ja;!ly;hGiIl3nB;.;a,>;-;aWba,ePiMlKthJyH;a,c3sH;a,?,[;ea;iHys?;e,s?;a,cIn1sHza;a,e,ha,?,[;e,],ja;c3+6jaKk[K%,sJxH;aH];!nd2;],[H;nd2;>;];i0nIyH;ah,%;a,+,%Coud;@;c6.,-EmNnLsH;haClH;&HyY;g,n;!h;a,o,slH;~;ee;(;at6g4nIusH;ti0;es;*;aWdiT$MrH;eJiH;#M(H;a,e,_;#0;%;!aLeKiIyH;nn;a,n1;a,e;!_;!iH;de;e,lDsH;?;`;!lH;i9`;_;aKbIiHrL;!e,gaK;~,i7y;!e;gaH;il;dKliyJ>dhIs6;ha;=;ah;a,=",
  "Honorific": "true\xA6director1field marsh2lieutenant1rear0sergeant major,vice0; admir1; gener0;al",
  "Adj|Gerund": "true\xA6:!1:#$%&()*+-./<=>?@[:er,ts,ra,uo,ir,ar,it,xe,la,ps,ed,re,lf,ht,us,im,ob;0:3B;1:32;2:3F;3:3J;gni4;b3Ic3Ed2Og2Gh2Ak24l1Rm1Kn1Cogt&,p1Ar0Ws0MtSuRvLwoKxIy9z4;ama,e#f,i4n5;g<2-5n4<msem;oga;rom0t4;iv#,nat;aBf6l5nap0Donna,r4zz3;av,t;l),t&;i4s*as;r5t4;)g,sym;r4tcele;et,oh;c0p;at,e4;lp<p,v;!=,rg;a8i7lov#,o6r4;a$,e4;nnu,s0;l,m;ec0l,r>;r,sefil;g(tXniCs2;aKcIeHfiGhgil0iFlEnDpmet,roCs6t4ub(B;es4if,uc;ffo,pu;a7#6i5u4;ah+,gs3rt;wt,+;!etQ%;l,r4;tn1;fm1pp?;ess3ioppas3uad;em,?L;c+,vK;lpu,rd;kcoryks,pm1v(;a4i=n1;r2F+;cixotFdCg*@,iBlumi$,nAoZr7t5v*4;om,pac;i4sav0;lib0rri;alih+,e5g,o4$urf;givAprocA;le8.a+;evuj#,@ulli;l@uh,ruf7;@*6om4;mo4;cca;ni;a#cCiAo8s5u4;fn1ma;)%bme,#4@;p4$3;!/;lc,p4;mi,po;-tiv#,morp4rpr?,urb;!m1;/,ni;aFe9i6[,ri$,u4;d2l-,ssaKt4;am,run;.4t;a,n4;i,oc;d7gga$,tta6wo4;=,p4;me,r16;=;li0Cna4;em;c,d,/2lg,o4;r,s;eews,ols,p4;alr0Z(g;aeAe6gi#,i4nuW<cn1;am#,f/4hs,lc0;!#;dda6t4vil2;a#Jhgi4%ehs3;rf;m,s;l,m0;a8l7o5%4;hc,-,s3wt%eh;c4[;eb,>07;ac,ehwr0M;e4=;lg,$;aeFbCeuLfBgg[,iAk%.,l5pp(c,t4w).,zzZ;%Gsub,tesnu;)>2e7i5or4;!tn1;fluf,hc,r4w;>;pm1t,uFws;av#p,ms,[;fab,i6;a2m4&5;),e4um;rt;h,ppa,vP;a6c5(4ovorp;$;al,ohs;#bdn&5os,t>ae4;rb;rg;c6s4toos;ad,#fHin4ur;otLup;a,e#cs,(2%rXt4&t;ef,i4;web;a8gal,n6r4;e4?;me;a4el-4ulp;hc;g2m5r4;!&c2;ad;aRdQeN(rMlKn7o5%w4;#;be4lpF;rof;aBe9i7o.#r1&4;f,rr5t4;sa;?;b4lb;!lleF;f4m,p;fo;m6p5$t4;&;+;/,m1;oc;eiy,of4;nu;evo;ce5e4;.;rp;ub;el,f,rg0;/;*2n4<ip;etnes,u4;[;ne;m7r4;osba,u4;$3;id;un",
  "Comparable": "true\xA6:!1:#$%&()*+-./<=>?@[]:rg,ae,ar,ir,ol,ra,os,ee,il,er,ts,us,oo,ah,as,iw,lb,uo;0:3Q;b3Wcitnamor,d3Ce25f22g1Zh1Uk1Pl1Am18n12p0Zr0Usso#,t0Hw0Dy1;a0Bc09d02e01f=g,hs,kcul,lKmInEpp>,rBs8t3v2xes,z1;oc,t&,zid;$h,=#,v?;aMf4l3nacs,r1sriht;$h,i1;d,lf;?,uaf;eh,(;$,e0Sion,o2u1;b,(;n,r;a2dwat,+l,gn1@,ruf,w;a,uh;cs,ew,w;az,i2n1ohp,up;iks,uf;%,h1t;s,w;aof,-s,=1;lg,r;bbin,dGeDgu,htr$,iCkciBl8nev$h,r6s4t1w(;hg&ps,ni?,s1;>g,o1;c,hg;!a1i#;em;$,u1;b,c;ems,i1oj;h1s;!c;rp,s;o,w;k-,m2n(,ta0v1;-,(;it,oh;$d,duc,ne&f,)woc;c&p,gac,#;a5dig,+#,it,n4=3r2u1wab;ag,oS;>,en,u0;[,m;.t,@;e1hs;h,r,/;i1n]b;!ps,uj;g,#;%,en,(1;!l1;aYe1;m,y;aBc&0e8f7hgi6n2oh,)Xs1;av,iom;a1egell0Uia7;drev,i2ng.p,s$lp,tis1;eh;g,ll&b;%0ls,rb,t;i3*;e2i1;uq;ws;e1lf;n,#;a4e1=p;dne2ppad,ttib,ve1;lc;ls;e1Zf,gluv;a2+1m-,)EsiI;d,/;ehc;e4ia3mel*,o2re/1uf;!$;mmoc,*;lp,v;dd<,e1;k,#;i1odn%;ls,#;a8eu7i5l1;a3i1uf;!r1;hs;ms,t;aHl,uqna1ve;rt;rc;.6i2mro1yY;f,n;c2tn1;a/b<,esse;e1ifrep<,nanif,*;ps;!r<;$w,c3+2n1)0;ip,urd;ls,m;a[,i1;ht,s,uq;g3s1;%b,e1rZ;rf;ih,]1;r,t;ib,n1;o1]y;l,r0;a2f1;i0ub;ed;c03d02f?,gZ&+,lRmLnIpHrDs9t3u2v1;%b,ian;gav,[,rt;a4i2om.,u1;c,m;hw,l1;op;idemr1l,mit8;et7;@,ne3o2)1;oc;(;d,t;%,ev3id,*,u1;ces1p;ni;es;&;adnum,i1;unBv1;id;a5.txe,*1;dn3e1;u1wa;#;>;l,t;a0b6p5t1;b3n2t1;-;eg;<;mis,rup;+f,m1on;in,uh;n%1)l,uh;o,/;?;@,ur;in,r1;a2e1;if;cs;aIdo,eGiCl9n5r3]2w1;el;l,rp;>,i1<ba;ew;a3ik,o2]fo1;rp;f,[;[,#;ab,i2o1;!b,c;m,w;l3muh,p1;%,u0;/;*;gg1kc@,r;%;b,ed,lg,m,o1s;rb;-g,mu1;d,n",
  "Adverb": "true\xA6:!1:#$%&()*: t,ni,na,lle,la,ra,ht;a0Nd0IeYfo Vg$Thcus,iroiretsopSk%lb#$op,&w,mRnOoMport ed,rGsEt8wo7y0;aw5daer(,l0rev;et3l1mod%r,no0tcerid,wen;!#R;a0uf;er,tot;amitlu,i$fY;a,yZ;h7nD;ah3hgirtuo,ib y$t,olJ)pa,s1u0;b3oba#suj;ae00eb#a,om0row#a,uj;#a,(;t0w2; l(;emit0%em on6pahMu*,yawZ;emG;af4e0;gnol C*2v0;e0oerom;!rof;ar,egotTrM; yb;ot,s0t A;!(;e1iaga0oos sa;! I;*,t9;aesuan da,odles; a;d%ts*iw#0kcD;on;sd)w1tr0;os;pu;byam,cGdisEg)ClAr3s0tiuq; 1iwekil,ruoc 0sam ne;fo;rep;om2u0;j 0sF;ed;! 2re*r1y0;%;uf;ecno;ihw0pmaxe9;a,%em;l 0;ta;a,gno0;(;iwt,n0;e0o;h,&cxe )p;a2eed3oog0)wkcab; r0;of;ets0orba;$;d$k,&h",
  "Conjunction": "true\xA6:dna,eSfiOgnisoppus,hLlit,neHoEr9s5t3wo2y1z0;oc,uc;bePlnoI;h,n;aht 0ey,on ro,sliSub;dedivorp,rBwS;a 0oc,ulp;hcum sa1noos0raf0tsuj; sa;! L;e1o0;!n;ht1ttam Lve0;neJoJreJwoh;eIie;ht,t0;! r0;edro D;h0ve;t1w 0;fi,wD; fi;cumsa8guoht0;! 0la;n2sa;! 0;e1n0sa;eve;re4;cnis w4li3mit eht yb,rofe2s0;ac 0iwrehto,uaceb;ni;b,reht;hw;on",
  "Currency": "true\xA6$,aud,bQcOdJeurIfHgbp,hkd,iGjpy,kElDp8r7s3usd,x2y1z0\xA2,\xA3,\xA5,\u0434\u0435\u043D,\u043B\u0432,\u0440\u0443\u0431,\u0E3F,\u20A1,\u20A8,\u20AC,\u20AD,\uFDFC;lotyQ\u0142;en,uanP;af,of;h0t5;e0il5;k0q0;elK;oubleJp,upeeJ;e2ound st0;er0;lingG;n0soF;ceEnies;empi7i7;n,r0wanzaCyatC;!onaBw;ls,nr;ori7ranc9;!os;en3i2kk,o0;b0ll2;ra5;me4n0rham4;ar3;e0ny;nt1;aht,itcoin0;!s",
  "Determiner": "true\xA6aBboth,d9e6few,le5mu8neiDplenty,s4th2various,wh0;at0ich0;evC;a0e4is,ose;!t;everal,ome;!ast,s;a1l0very;!se;ch;e0u;!s;!n0;!o0y;th0;er",
  "Adj|Present": "true\xA6:eQgnPhtooms,kcOlNmLnIpmad,rGsserpFt4wo2y0;a0cnaf,rd,tpme;l,rts;l0rran;loh,s;ce8ew,hg6i5n4p1rohs,sa0;f,l;m1ur0;knab,rP;e6oW;eseViXulb;ciJefretnuM;i0uD;la,r;frep,lKpsus,r0;id,rI;xe;aeKe0uos;dnet,ttu,wol;ae0epo,iht,wo;l0m;!c;lac,r0;aw,if;lud,o9uof;auq,ils;orw;eHgniHkGlFmiErBs8t0vil;a0elpm5;cilper,d5gujn4lucitra,m3r0;ap4e1oba0;le;biled,dom;ixorppa,musn0;oc;es;o1uf0;ed,fid;lc;aps,u0;c0s,tam;es,sbo;rp;ap,buod,di;af;rf",
  "Person|Adj": "true\xA6b3du2earnest,frank,mi2r0san1woo1;an0ich,u1;dy;sty;ella,rown",
  "Modal": "true\xA6:a5dluo4ll2nac,ot 5stel,t0;hg0na2sum;im,uo;a0iw;hs;c,hs,w;thguo",
  "Verb": "true\xA6born,cannot,gonna,has,keep tabs,msg",
  "Person|Verb": "true\xA6b8ch7dr6foster,gra5ja9lan4ma2ni9ollie,p1rob,s0wade;kip,pike,t5ue;at,eg,ier2;ck,r0;k,shal;ce;ce,nt;ew;ase,u1;iff,l1ob,u0;ck;aze,ossom",
  "Person|Date": "true\xA6a2j0sep;an0une;!uary;p0ugust,v0;ril"
};

// node_modules/efrt/src/encoding.js
var BASE = 36;
var seq = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var cache = seq.split("").reduce(function(h2, c2, i3) {
  h2[c2] = i3;
  return h2;
}, {});
var toAlphaCode = function(n3) {
  if (seq[n3] !== void 0) {
    return seq[n3];
  }
  let places2 = 1;
  let range = BASE;
  let s3 = "";
  for (; n3 >= range; n3 -= range, places2++, range *= BASE) {
  }
  for (; places2 > 0; places2--) {
    const d2 = n3 % BASE;
    s3 = String.fromCharCode((d2 < 10 ? 48 : 55) + d2) + s3;
    n3 = (n3 - d2) / BASE;
  }
  return s3;
};
var fromAlphaCode = function(s3) {
  if (cache[s3] !== void 0) {
    return cache[s3];
  }
  let n3 = 0;
  let places2 = 1;
  let range = BASE;
  let pow = 1;
  for (; places2 < s3.length; n3 += range, places2++, range *= BASE) {
  }
  for (let i3 = s3.length - 1; i3 >= 0; i3--, pow *= BASE) {
    let d2 = s3.charCodeAt(i3) - 48;
    if (d2 > 10) {
      d2 -= 7;
    }
    n3 += d2 * pow;
  }
  return n3;
};
var encoding_default = {
  toAlphaCode,
  fromAlphaCode
};

// node_modules/efrt/src/unpack/symbols.js
var symbols = function(t3) {
  const reSymbol = /^([0-9A-Z]+):([0-9A-Z]+)$/;
  for (let i3 = 0; i3 < t3.nodes.length; i3++) {
    if (!t3.nodes[i3].includes(":")) {
      break;
    }
    const m3 = reSymbol.exec(t3.nodes[i3]);
    if (!m3 || m3[0].length !== t3.nodes[i3].length || encoding_default.fromAlphaCode(m3[1]) !== i3) {
      throw new SyntaxError("Invalid efrt packed data: symbol definition");
    }
    t3.syms.push(encoding_default.fromAlphaCode(m3[2]));
  }
  t3.symCount = t3.syms.length;
  t3.nodes = t3.nodes.slice(t3.symCount);
  if (t3.nodes.length === 0 || t3.syms.some((index3) => !Number.isSafeInteger(index3) || index3 >= t3.nodes.length)) {
    throw new SyntaxError("Invalid efrt packed data: symbol target");
  }
};
var symbols_default = symbols;

// node_modules/efrt/src/unpack/escape.js
var unescapeLabel = function(text6) {
  return text6.replace(/\\([\s\S]|$)/g, (match2, char) => {
    if (char === "\\") {
      return "\\";
    }
    if (char >= "a" && char <= "j") {
      return String(char.charCodeAt(0) - 97);
    }
    throw new SyntaxError("Invalid efrt packed data: label escape");
  });
};
var escape_default = unescapeLabel;

// node_modules/efrt/src/unpack/dictionary.js
var dictionary = function(trie) {
  if (!trie.nodes[0].startsWith("!1:")) {
    return;
  }
  const header = trie.nodes.shift().split(":");
  const tokens2 = Array.from(header[1]);
  const fragments = (header[2] || "").split(",");
  if (header.length !== 3 || tokens2.length === 0 || tokens2.length !== fragments.length || new Set(tokens2).size !== tokens2.length || trie.nodes.length === 0 || tokens2.some((token) => token.length !== 1 || token.charCodeAt(0) < 33 || token.charCodeAt(0) > 126 || /[A-Za-z0-9,;!:|]/.test(token) || trie.versioned && token === "\\") || fragments.some((text6) => !text6 || /[A-Z0-9,;!:|¦]/.test(text6))) {
    throw new SyntaxError("Invalid efrt packed data: fragment dictionary");
  }
  trie.dictionary = /* @__PURE__ */ Object.create(null);
  for (let i3 = 0; i3 < tokens2.length; i3++) {
    trie.dictionary[tokens2[i3]] = trie.versioned ? escape_default(fragments[i3]) : fragments[i3];
  }
};
var dictionary_default = dictionary;

// node_modules/efrt/src/unpack/traverse.js
var indexFromRef = function(trie, ref, index3) {
  const dnode = encoding_default.fromAlphaCode(ref);
  const target = dnode < trie.symCount ? trie.syms[dnode] : index3 + dnode + 1 - trie.symCount;
  if (!Number.isSafeInteger(target) || target <= index3 || target >= trie.nodes.length) {
    throw new SyntaxError("Invalid efrt packed data: node reference");
  }
  return target;
};
var parseNodes = function(trie) {
  return trie.nodes.map((node, index3) => {
    if (node === "" && trie.nodes.length !== 1) {
      throw new SyntaxError("Invalid efrt packed data: empty node");
    }
    const terminal = node[0] === "!";
    const body = terminal ? node.slice(1) : node;
    const edges = [];
    const token = /([^A-Z0-9,;!:|¦]+)([A-Z0-9]+|,|$)/y;
    for (let offset2 = 0; offset2 < body.length; offset2 = token.lastIndex) {
      const match2 = token.exec(body);
      if (!match2 || match2.index !== offset2 || match2[2] === "," && token.lastIndex === body.length) {
        throw new SyntaxError("Invalid efrt packed data: node syntax");
      }
      const ref = match2[2];
      const label = trie.versioned ? escape_default(match2[1]) : match2[1];
      const text6 = trie.dictionary ? Array.from(
        label,
        (char) => trie.dictionary[char] || char
      ).join("") : label;
      edges.push({
        text: text6,
        target: ref === "" || ref === "," ? -1 : indexFromRef(trie, ref, index3)
      });
    }
    return { terminal, edges };
  });
};
var toArray = function(trie) {
  const nodes = parseNodes(trie);
  const all4 = [];
  const stack = [{ index: 0, pref: "", edge: -1 }];
  for (; stack.length > 0; ) {
    const frame = stack[stack.length - 1];
    const node = nodes[frame.index];
    if (frame.edge === -1) {
      if (node.terminal) {
        all4.push(frame.pref);
      }
      frame.edge = 0;
    }
    if (frame.edge === node.edges.length) {
      stack.pop();
      continue;
    }
    const edge = node.edges[frame.edge++];
    const word = frame.pref + edge.text;
    if (edge.target === -1) {
      all4.push(word);
    } else {
      stack.push({ index: edge.target, pref: word, edge: -1 });
    }
  }
  return all4;
};
var unpack = function(str, versioned = false) {
  const trie = {
    nodes: str.split(";"),
    syms: [],
    symCount: 0,
    versioned
  };
  dictionary_default(trie);
  if (str.match(":")) {
    symbols_default(trie);
  }
  return toArray(trie);
};
var traverse_default = unpack;

// node_modules/efrt/src/unpack/index.js
var unpack2 = function(str) {
  if (str === "" || str === null || str === void 0) {
    return {};
  }
  if (typeof str !== "string") {
    throw new TypeError("efrt unpack expects a string");
  }
  const obj = str.split("|").reduce((h2, s3) => {
    const arr = s3.split("\xA6");
    if (arr.length !== 2 || Object.prototype.hasOwnProperty.call(h2, arr[0])) {
      throw new SyntaxError("Invalid efrt packed data: category separator or duplicate category");
    }
    h2[arr[0]] = arr[1];
    return h2;
  }, /* @__PURE__ */ Object.create(null));
  const all4 = {};
  Object.keys(obj).forEach(function(cat) {
    let data = obj[cat];
    const versioned = data.startsWith("!2;");
    if (versioned) {
      data = data.slice(3);
      if (!data || data === ":") {
        throw new SyntaxError("Invalid efrt packed data: missing versioned trie");
      }
    }
    const reversed = data[0] === ":";
    const arr = traverse_default(reversed ? data.slice(1) : data, versioned);
    if (cat === "true") {
      cat = true;
    }
    for (let i3 = 0; i3 < arr.length; i3++) {
      const k2 = reversed ? Array.from(arr[i3]).reverse().join("") : arr[i3];
      if (Object.prototype.hasOwnProperty.call(all4, k2)) {
        if (Array.isArray(all4[k2]) === false) {
          if (all4[k2] !== cat) {
            all4[k2] = [all4[k2], cat];
          }
        } else if (!all4[k2].includes(cat)) {
          all4[k2].push(cat);
        }
      } else {
        Object.defineProperty(all4, k2, {
          value: cat,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
  });
  return all4;
};
var unpack_default = unpack2;

// node_modules/compromise/src/2-two/preTagger/tagSet/_lib.js
var NN = "Noun";
var NNs = "Singular";
var NNS = "Plural";
var NNP = "ProperNoun";
var PRP = "Pronoun";
var Poss = "Possessive";
var JJ = "Adjective";
var JJR = "Comparative";
var JJS = "Superlative";
var RB = "Adverb";
var Det = "Determiner";
var V = "Verb";
var VB = "Infinitive";
var VBD = "PastTense";
var VBG = "Gerund";
var VBN = "Participle";
var Pres = "PresentTense";
var Fut = "FutureTense";
var Cop = "Copula";
var MD = "Modal";
var PhrasalVerb = "PhrasalVerb";
var Conj = "Conjunction";
var IN = "Preposition";
var Expression = "Expression";
var QuestionWord = "QuestionWord";
var Person = "Person";
var Place = "Place";
var Organization = "Organization";
var FirstName = "FirstName";
var LastName = "LastName";
var MaleName = "MaleName";
var FemaleName = "FemaleName";
var Actor = "Actor";
var Uncountable = "Uncountable";
var SportsTeam = "SportsTeam";
var Country = "Country";
var City = "City";
var Region = "Region";
var Unit = "Unit";
var Value = "Value";
var Cardinal = "Cardinal";
var Ordinal = "Ordinal";
var TextValue = "TextValue";
var NumericValue = "NumericValue";
var RomanNumeral = "RomanNumeral";
var Fraction = "Fraction";
var Date2 = "Date";
var WeekDay = "WeekDay";
var Year = "Year";
var FinancialQuarter = "FinancialQuarter";
var Season = "Season";
var Time = "Time";
var Timezone = "Timezone";
var Connector = "Connector";
var Abbreviation = "Abbreviation";
var Acronym = "Acronym";
var HashTag = "HashTag";
var AtMention = "AtMention";
var Emoji = "Emoji";
var Emoticon = "Emoticon";
var SlashedTerm = "SlashedTerm";
var Email = "Email";
var PhoneNumber = "PhoneNumber";
var Url = "Url";

// node_modules/compromise/src/2-two/preTagger/model/lexicon/misc.js
var prp = [Poss, PRP];
var misc = {
  // numbers
  "20th century fox": Organization,
  "7 eleven": Organization,
  "motel 6": Organization,
  "23andme": Organization,
  "4chan": Organization,
  "yahoo!": Organization,
  u2: Organization,
  g8: Organization,
  vh1: Organization,
  "76ers": SportsTeam,
  "49ers": SportsTeam,
  q1: Date2,
  q2: Date2,
  q3: Date2,
  q4: Date2,
  km2: Unit,
  m2: Unit,
  dm2: Unit,
  cm2: Unit,
  mm2: Unit,
  mile2: Unit,
  in2: Unit,
  yd2: Unit,
  ft2: Unit,
  m3: Unit,
  dm3: Unit,
  cm3: Unit,
  in3: Unit,
  ft3: Unit,
  yd3: Unit,
  // ampersands
  "at&t": Organization,
  "black & decker": Organization,
  "h & m": Organization,
  "johnson & johnson": Organization,
  "procter & gamble": Organization,
  "ben & jerry's": Organization,
  "&": Conj,
  // copulas
  was: [Cop, VBD],
  is: [Cop, Pres],
  are: [Cop, Pres],
  am: [Cop, Pres],
  were: [Cop, VBD],
  // possessive pronouns
  her: prp,
  his: prp,
  hers: prp,
  their: prp,
  theirs: prp,
  your: prp,
  // misc
  vs: [Conj, Abbreviation],
  closer: JJR,
  closest: JJS,
  may: MD,
  // irregular conjugations with two forms
  babysat: VBD,
  blew: VBD,
  drank: VBD,
  drove: VBD,
  forgave: VBD,
  skiied: VBD,
  stung: VBD,
  swam: VBD,
  swung: VBD,
  guaranteed: VBD,
  // support 'near', 'nears', 'nearing'
  nears: Pres,
  nearing: VBG,
  neared: VBD
};
var misc_default2 = misc;

// node_modules/compromise/src/2-two/preTagger/model/lexicon/frozenLex.js
var shared = {
  "excuse me": Expression,
  "financial times": Organization,
  "guns n roses": Organization,
  "la z boy": Organization,
  "labour party": Organization,
  "new kids on the block": Organization,
  "new york times": Organization,
  "the guess who": Organization,
  "thin lizzy": Organization,
  "prime minister": Actor,
  "free market": NNs,
  "lay up": NNs,
  "spin off": NNs,
  "appeal court": Uncountable,
  "cold war": Uncountable,
  "gene pool": Uncountable,
  "machine learning": Uncountable,
  "nail polish": Uncountable,
  "time off": Uncountable,
  "take part": VB,
  "bill gates": Person,
  "doctor who": Person,
  "he man": Person,
  "iron man": Person,
  "kid cudi": Person,
  "run dmc": Person,
  "rush limbaugh": Person,
  "snow white": Person,
  "tiger woods": Person,
  "brand new": JJ,
  "en route": JJ,
  "left wing": JJ,
  "off guard": JJ,
  "on board": JJ,
  "part time": JJ,
  "right wing": JJ,
  "so called": JJ,
  "spot on": JJ,
  "straight forward": JJ,
  "super duper": JJ,
  "tip top": JJ,
  "top notch": JJ,
  "up to date": JJ,
  "win win": JJ,
  "brooklyn nets": SportsTeam,
  "chicago bears": SportsTeam,
  "houston astros": SportsTeam,
  "houston dynamo": SportsTeam,
  "houston rockets": SportsTeam,
  "houston texans": SportsTeam,
  "minnesota twins": SportsTeam,
  "orlando magic": SportsTeam,
  "san antonio spurs": SportsTeam,
  "san diego chargers": SportsTeam,
  "san diego padres": SportsTeam,
  "iron maiden": NNP,
  "isle of man": Country,
  "united states": Country,
  "united states of america": Country,
  "prince edward island": Region,
  "cedar breaks": Place,
  "cedar falls": Place,
  "point blank": RB,
  "tiny bit": RB,
  "by the time": Conj,
  "no matter": Conj
};
var frozenLex_default = {
  ...shared,
  "20th century fox": Organization,
  "7 eleven": Organization,
  "motel 6": Organization,
  "living room": NNs,
  "living rooms": NNS,
  "dr who": Person,
  "civil wars": NNS,
  "credit cards": NNS,
  "default rates": NNS,
  "free markets": NNS,
  "head starts": NNS,
  "home runs": NNS,
  "lay ups": NNS,
  "phone calls": NNS,
  "press releases": NNS,
  "record labels": NNS,
  "soft serves": NNS,
  "student loans": NNS,
  "tax returns": NNS,
  "tv shows": NNS,
  "video games": NNS,
  "took part": VBD,
  "takes part": Pres,
  "taking part": VBG,
  "taken part": VBN,
  "light bulb": NN,
  "rush hour": NN,
  "fluid ounce": Unit,
  "the rolling stones": Organization
};

// node_modules/compromise/src/2-two/preTagger/model/lexicon/emoticons.js
var emoticons_default = [
  ":(",
  ":)",
  ":P",
  ":p",
  ":O",
  ";(",
  ";)",
  ";P",
  ";p",
  ";O",
  ":3",
  ":|",
  ":/",
  ":\\",
  ":$",
  ":*",
  ":@",
  ":-(",
  ":-)",
  ":-P",
  ":-p",
  ":-O",
  ":-3",
  ":-|",
  ":-/",
  ":-\\",
  ":-$",
  ":-*",
  ":-@",
  ":^(",
  ":^)",
  ":^P",
  ":^p",
  ":^O",
  ":^3",
  ":^|",
  ":^/",
  ":^\\",
  ":^$",
  ":^*",
  ":^@",
  "):",
  "(:",
  "$:",
  "*:",
  ")-:",
  "(-:",
  "$-:",
  "*-:",
  ")^:",
  "(^:",
  "$^:",
  "*^:",
  "<3",
  "</3",
  "<\\3",
  "=("
];

// node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toPlural/_rules.js
var suffixes = {
  a: [
    [/(antenn|formul|nebul|vertebr|vit)a$/i, "$1ae"],
    [/ia$/i, "ia"]
  ],
  e: [
    [/(kn|l|w)ife$/i, "$1ives"],
    [/(hive)$/i, "$1s"],
    [/([ml])ouse$/i, "$1ice"],
    [/^([ml])ice$/i, "$1ice"]
  ],
  f: [
    [/^(dwar|handkerchie|hoo|scar|whar)f$/i, "$1ves"],
    [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)f$/i, "$1ves"]
  ],
  i: [[/(octop|vir)i$/i, "$1i"]],
  m: [[/([ti])um$/i, "$1a"]],
  n: [[/^(oxen)$/i, "$1"]],
  o: [[/(al|ad|at|er|et|ed)o$/i, "$1oes"]],
  s: [
    [/(ax|test)is$/i, "$1es"],
    [/(alias|status)$/i, "$1es"],
    [/sis$/i, "ses"],
    [/(bu)s$/i, "$1ses"],
    [/(sis)$/i, "ses"],
    [/^(?!talis|.*hu)(.*)man$/i, "$1men"],
    [/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, "$1i"]
  ],
  x: [
    [/(matr|vert|ind|cort)(ix|ex)$/i, "$1ices"],
    [/^(ox)$/i, "$1en"]
  ],
  y: [[/([^aeiouy]|qu)y$/i, "$1ies"]],
  z: [[/(quiz)$/i, "$1zes"]]
};
var rules_default = suffixes;

// node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toPlural/index.js
var addE = /([xsz]|ch|sh)$/;
var trySuffix = function(str) {
  const c2 = str[str.length - 1];
  if (Object.hasOwn(rules_default, c2) === true) {
    for (let i3 = 0; i3 < rules_default[c2].length; i3 += 1) {
      const reg = rules_default[c2][i3][0];
      if (reg.test(str) === true) {
        return str.replace(reg, rules_default[c2][i3][1]);
      }
    }
  }
  return null;
};
var pluralize = function(str = "", model5) {
  const { irregularPlurals, uncountable: uncountable2 } = model5.two;
  if (Object.hasOwn(uncountable2, str)) {
    return str;
  }
  if (Object.hasOwn(irregularPlurals, str)) {
    return irregularPlurals[str];
  }
  const plural2 = trySuffix(str);
  if (plural2 !== null) {
    return plural2;
  }
  if (addE.test(str)) {
    return str + "es";
  }
  return str + "s";
};
var toPlural_default = pluralize;

// node_modules/compromise/src/2-two/preTagger/model/lexicon/index.js
var hasSwitch = /\|/;
var lexicon3 = { ...misc_default2 };
var switches = {};
var tmpModel = { two: { irregularPlurals: plurals_default, uncountable: {} } };
Object.keys(data_default).forEach((tag) => {
  const wordsObj = unpack_default(data_default[tag]);
  if (!hasSwitch.test(tag)) {
    Object.keys(wordsObj).forEach((w) => {
      lexicon3[w] = tag;
    });
    return;
  }
  Object.keys(wordsObj).forEach((w) => {
    switches[w] = tag;
    if (tag === "Noun|Verb") {
      const plural2 = toPlural_default(w, tmpModel);
      if (plural2 !== w || plurals_default[w] === w) {
        switches[plural2] = "Plural|Verb";
      }
    }
  });
});
lexicon3.if = ["Conjunction", "Condition"];
emoticons_default.forEach((str) => lexicon3[str] = "Emoticon");
delete lexicon3[""];
delete lexicon3[null];
delete lexicon3[" "];

// node_modules/compromise/src/2-two/preTagger/model/clues/_noun.js
var n2 = "Singular";
var noun_default = {
  beforeTags: {
    Determiner: n2,
    //the date
    Possessive: n2,
    //his date
    Acronym: n2,
    //u.s. state
    // ProperNoun:n,
    Noun: n2,
    //nasa funding
    Adjective: n2,
    //whole bottles
    // Verb:true, //save storm victims
    PresentTense: n2,
    //loves hiking
    Gerund: n2,
    //uplifting victims
    PastTense: n2,
    //saved storm victims
    Infinitive: n2,
    //profess love
    Date: n2,
    //9pm show
    Ordinal: n2,
    //first date
    Demonym: n2
    //dutch map
  },
  afterTags: {
    Value: n2,
    //date nine  -?
    Modal: n2,
    //date would
    Copula: n2,
    //fear is
    PresentTense: n2,
    //babysitting sucks
    PastTense: n2,
    //babysitting sucked
    // Noun:n, //talking therapy, planning process
    Demonym: n2,
    //american touch
    Actor: n2
    //dance therapist
  },
  // ownTags: { ProperNoun: n },
  beforeWords: {
    the: n2,
    //the brands
    with: n2,
    //with cakes
    without: n2,
    //
    // was:n, //was time  -- was working
    // is:n, //
    of: n2,
    //of power
    for: n2,
    //for rats
    any: n2,
    //any rats
    all: n2,
    //all tips
    on: n2,
    //on time
    // thing-ish verbs
    cut: n2,
    //cut spending
    cuts: n2,
    //cut spending
    increase: n2,
    // increase funding
    decrease: n2,
    //
    raise: n2,
    //
    drop: n2,
    //
    // give: n,//give parents
    save: n2,
    //
    saved: n2,
    //
    saves: n2,
    //
    make: n2,
    //
    makes: n2,
    //
    made: n2,
    //
    minus: n2,
    //minus laughing
    plus: n2,
    //
    than: n2,
    //more than age
    another: n2,
    //
    versus: n2,
    //
    neither: n2,
    //
    about: n2,
    //about claims
    // strong adjectives
    favorite: n2,
    //
    best: n2,
    //
    daily: n2,
    //
    weekly: n2,
    //
    linear: n2,
    //
    binary: n2,
    //
    mobile: n2,
    //
    lexical: n2,
    //
    technical: n2,
    //
    computer: n2,
    //
    scientific: n2,
    //
    security: n2,
    //
    government: n2,
    //
    popular: n2,
    //
    formal: n2,
    no: n2,
    //no worries
    more: n2,
    //more details
    one: n2,
    //one flood
    let: n2,
    //let fear
    her: n2,
    //her boots
    his: n2,
    //
    their: n2,
    //
    our: n2,
    //
    // us: n, //served us drinks
    sheer: n2,
    monthly: n2,
    yearly: n2,
    current: n2,
    previous: n2,
    upcoming: n2,
    last: n2,
    next: n2,
    main: n2,
    initial: n2,
    final: n2,
    beginning: n2,
    end: n2,
    top: n2,
    bottom: n2,
    future: n2,
    past: n2,
    major: n2,
    minor: n2,
    side: n2,
    central: n2,
    peripheral: n2,
    public: n2,
    private: n2
  },
  afterWords: {
    of: n2,
    //date of birth (preposition)
    system: n2,
    aid: n2,
    method: n2,
    utility: n2,
    tool: n2,
    reform: n2,
    therapy: n2,
    philosophy: n2,
    room: n2,
    authority: n2,
    says: n2,
    said: n2,
    wants: n2,
    wanted: n2,
    is: n2,
    did: n2,
    do: n2,
    can: n2,
    //parents can
    wise: n2
    //service-wise
    // they: n,//snakes they
  }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/_verb.js
var v = "Infinitive";
var verb_default = {
  beforeTags: {
    Modal: v,
    //would date
    Adverb: v,
    //quickly date
    Negative: v,
    //not date
    Plural: v
    //characters drink
    // ProperNoun: vb,//google thought
  },
  afterTags: {
    Determiner: v,
    //flash the
    Adverb: v,
    //date quickly
    Possessive: v,
    //date his
    Reflexive: v,
    //resolve yourself
    // Noun:true, //date spencer
    Preposition: v,
    //date around, dump onto, grumble about
    // Conjunction: v, // dip to, dip through
    Cardinal: v,
    //cut 3 squares
    Comparative: v,
    //feel greater
    Superlative: v
    //feel greatest
  },
  beforeWords: {
    i: v,
    //i date
    we: v,
    //we date
    you: v,
    //you date
    they: v,
    //they date
    to: v,
    //to date
    please: v,
    //please check
    will: v,
    //will check
    have: v,
    had: v,
    would: v,
    could: v,
    come: v,
    should: v,
    do: v,
    did: v,
    does: v,
    can: v,
    must: v,
    us: v,
    me: v,
    let: v,
    even: v,
    when: v,
    help: v,
    //help combat
    // them: v,
    he: v,
    she: v,
    it: v,
    being: v,
    // prefixes
    bi: v,
    co: v,
    contra: v,
    de: v,
    inter: v,
    intra: v,
    mis: v,
    pre: v,
    out: v,
    counter: v,
    nobody: v,
    somebody: v,
    anybody: v,
    everybody: v,
    // un: v,
    // over: v,
    // under: v,
    now: v,
    //now dance
    go: v,
    //go dance
    said: v,
    //he said run
    says: v,
    //simon says run
    say: v,
    //they say run
    who: v,
    //who runs faster
    what: v
    //what runs faster
    // most: v, //most run faster
    // some: v, //some run faster
  },
  afterWords: {
    the: v,
    //echo the
    me: v,
    //date me
    you: v,
    //date you
    him: v,
    //loves him
    us: v,
    //cost us
    her: v,
    //
    his: v,
    //
    them: v,
    //
    they: v,
    //
    it: v,
    //hope it
    himself: v,
    herself: v,
    itself: v,
    myself: v,
    ourselves: v,
    themselves: v,
    something: v,
    anything: v,
    a: v,
    //covers a
    an: v,
    //covers an
    // from: v, //ranges from
    up: v,
    //serves up
    down: v,
    //serves up
    by: v,
    // in: v, //bob in
    out: v,
    // on: v,
    off: v,
    under: v,
    what: v,
    //look what
    // when: v,//starts when
    // for:true, //settled for
    all: v,
    //shiver all night
    // conjunctions
    to: v,
    //dip to
    because: v,
    //
    although: v,
    //
    // after: v,
    // before: v,//
    how: v,
    //
    otherwise: v,
    //
    together: v,
    //fit together
    though: v,
    //
    into: v,
    //
    yet: v,
    //
    more: v,
    //kill more
    here: v,
    // look here
    there: v,
    //
    away: v,
    //float away
    now: v
    //dance now
  }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/actor-verb.js
var clue = {
  beforeTags: {
    ...verb_default.beforeTags,
    ...noun_default.beforeTags
  },
  afterTags: { ...verb_default.afterTags, ...noun_default.afterTags },
  beforeWords: { ...verb_default.beforeWords, ...noun_default.beforeWords },
  afterWords: { ...verb_default.afterWords, ...noun_default.afterWords }
};
var actor_verb_default = clue;

// node_modules/compromise/src/2-two/preTagger/model/clues/_adj.js
var jj = "Adjective";
var adj_default = {
  beforeTags: {
    Determiner: jj,
    //the detailed
    // Copula: jj, //is detailed
    Possessive: jj,
    //spencer's detailed
    Hyphenated: jj
    //rapidly-changing
  },
  afterTags: {
    // Noun: jj, //detailed plan, overwhelming evidence
    Adjective: jj
    //intoxicated little
  },
  beforeWords: {
    seem: jj,
    //seem prepared
    seemed: jj,
    seems: jj,
    feel: jj,
    //feel prepared
    feels: jj,
    felt: jj,
    stay: jj,
    appear: jj,
    appears: jj,
    appeared: jj,
    also: jj,
    over: jj,
    //over cooked
    under: jj,
    too: jj,
    //too insulting
    it: jj,
    //find it insulting
    but: jj,
    //nothing but frustrating
    still: jj,
    //still scared
    // adverbs that are adjective-ish
    really: jj,
    //really damaged
    quite: jj,
    well: jj,
    very: jj,
    truly: jj,
    how: jj,
    //how slow
    deeply: jj,
    hella: jj,
    // always: jj,
    // never: jj,
    profoundly: jj,
    extremely: jj,
    so: jj,
    badly: jj,
    mostly: jj,
    totally: jj,
    awfully: jj,
    rather: jj,
    nothing: jj,
    //nothing secret,
    something: jj,
    //something wrong
    anything: jj,
    not: jj,
    //not swell
    me: jj,
    //called me swell
    is: jj,
    face: jj,
    //faces shocking revelations
    faces: jj,
    faced: jj,
    look: jj,
    looks: jj,
    looked: jj,
    reveal: jj,
    reveals: jj,
    revealed: jj,
    sound: jj,
    sounded: jj,
    sounds: jj,
    remains: jj,
    remained: jj,
    prove: jj,
    //would prove shocking
    proves: jj,
    proved: jj,
    becomes: jj,
    stays: jj,
    tastes: jj,
    taste: jj,
    smells: jj,
    smell: jj,
    gets: jj,
    //gets shocking snowfall
    grows: jj,
    as: jj,
    rings: jj,
    radiates: jj,
    conveys: jj,
    convey: jj,
    conveyed: jj,
    of: jj
    // 'smacks of': jj,
    // 'reeks of': jj,
  },
  afterWords: {
    too: jj,
    //insulting too
    also: jj,
    //insulting too
    or: jj,
    //insulting or
    enough: jj,
    //cool enough
    as: jj
    //as shocking as
    //about: jj, //cool about
  }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/_gerund.js
var g2 = "Gerund";
var gerund_default = {
  beforeTags: {
    // Verb: g, // loves shocking
    Adverb: g2,
    //quickly shocking
    Connector: g2
    //by insulting, if swimming
  },
  afterTags: {
    Adverb: g2,
    //shocking quickly
    Possessive: g2,
    //shocking spencer's
    Person: g2,
    //telling spencer
    Pronoun: g2,
    //shocking him
    Determiner: g2,
    //shocking the
    Copula: g2,
    //shocking is
    Connector: g2,
    //swimming in, swimming and running
    Comparative: g2
    //growing shorter
  },
  beforeWords: {
    been: g2,
    keep: g2,
    //keep going
    continue: g2,
    //
    stop: g2,
    //
    am: g2,
    //am watching
    be: g2,
    //be timing
    me: g2,
    //got me thinking
    // action-words
    began: g2,
    start: g2,
    starts: g2,
    started: g2,
    stops: g2,
    stopped: g2,
    help: g2,
    helps: g2,
    avoid: g2,
    avoids: g2,
    love: g2,
    //love painting
    loves: g2,
    loved: g2,
    hate: g2,
    hates: g2,
    hated: g2
    // was:g,//was working
    // is:g,
    // be:g,
  },
  afterWords: {
    you: g2,
    //telling you
    me: g2,
    //
    her: g2,
    //
    him: g2,
    //
    his: g2,
    //
    them: g2,
    //
    their: g2,
    // fighting their
    it: g2,
    //dumping it
    this: g2,
    //running this
    there: g2,
    // swimming there
    on: g2,
    // landing on
    about: g2,
    // talking about
    for: g2,
    // paying for
    up: g2,
    //speeding up
    down: g2
    //
  }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/adj-gerund.js
var g3 = "Gerund";
var jj2 = "Adjective";
var clue2 = {
  beforeTags: {
    ...adj_default.beforeTags,
    ...gerund_default.beforeTags,
    // Copula: jj,
    Imperative: g3,
    //recommend living in
    Infinitive: jj2,
    //say charming things
    // PresentTense: g,
    Plural: g3
    //kids cutting
  },
  afterTags: {
    ...adj_default.afterTags,
    ...gerund_default.afterTags,
    Noun: jj2
    //shocking ignorance
    // Plural: jj, //shocking lies
  },
  beforeWords: {
    ...adj_default.beforeWords,
    ...gerund_default.beforeWords,
    is: jj2,
    are: g3,
    //is overflowing: JJ, are overflowing : VB ??
    was: jj2,
    of: jj2,
    //of varying
    suggest: g3,
    suggests: g3,
    suggested: g3,
    recommend: g3,
    recommends: g3,
    recommended: g3,
    imagine: g3,
    imagines: g3,
    imagined: g3,
    consider: g3,
    considered: g3,
    considering: g3,
    resist: g3,
    resists: g3,
    resisted: g3,
    avoid: g3,
    avoided: g3,
    avoiding: g3,
    except: jj2,
    accept: jj2,
    assess: g3,
    explore: g3,
    fear: g3,
    fears: g3,
    appreciate: g3,
    question: g3,
    help: g3,
    embrace: g3,
    with: jj2
    //filled with daring
  },
  afterWords: {
    ...adj_default.afterWords,
    ...gerund_default.afterWords,
    to: g3,
    not: g3,
    //trying not to car
    the: g3
    //sweeping the country
  }
};
var adj_gerund_default = clue2;

// node_modules/compromise/src/2-two/preTagger/model/clues/adj-noun.js
var misc2 = {
  beforeTags: {
    Determiner: void 0,
    //the premier university
    Cardinal: "Noun",
    //1950 convertable
    PhrasalVerb: "Adjective"
    //starts out fine
  },
  afterTags: {
    // Pronoun: 'Noun'//as an adult i
  }
};
var clue3 = {
  beforeTags: { ...adj_default.beforeTags, ...noun_default.beforeTags, ...misc2.beforeTags },
  afterTags: { ...adj_default.afterTags, ...noun_default.afterTags, ...misc2.afterTags },
  beforeWords: {
    ...adj_default.beforeWords,
    ...noun_default.beforeWords,
    // are representative
    are: "Adjective",
    is: "Adjective",
    was: "Adjective",
    be: "Adjective",
    // phrasals
    off: "Adjective",
    //start off fine
    out: "Adjective"
    //comes out fine
  },
  afterWords: { ...adj_default.afterWords, ...noun_default.afterWords }
};
var adj_noun_default = clue3;

// node_modules/compromise/src/2-two/preTagger/model/clues/adj-past.js
var past = "PastTense";
var jj3 = "Adjective";
var adjPast = {
  beforeTags: {
    Adverb: past,
    //quickly detailed
    Pronoun: past,
    //he detailed
    ProperNoun: past,
    //toronto closed
    Auxiliary: past,
    Noun: past
    //eye closed  -- i guess.
  },
  afterTags: {
    Possessive: past,
    //hooked him
    Pronoun: past,
    //hooked me
    Determiner: past,
    //hooked the
    Adverb: past,
    //cooked perfectly
    Comparative: past,
    //closed higher
    Date: past,
    // alleged thursday
    Gerund: past
    //left dancing
  },
  beforeWords: {
    be: past,
    //be hooked vs be embarrassed
    who: past,
    //who lost
    get: jj3,
    //get charged
    had: past,
    has: past,
    have: past,
    been: past,
    being: past,
    //being watched
    it: past,
    //it intoxicated him
    as: past,
    //as requested
    for: jj3,
    //for discounted items
    more: jj3,
    //more broken promises
    always: jj3
  },
  afterWords: {
    by: past,
    //damaged by
    back: past,
    //charged back
    out: past,
    //charged out
    in: past,
    //crowded in
    up: past,
    //heated up
    down: past,
    //hammered down
    before: past,
    //
    after: past,
    //
    for: past,
    //settled for
    the: past,
    //settled the
    with: past,
    //obsessed with
    as: past,
    //known as
    on: past,
    //focused on
    at: past,
    //recorded at
    between: past,
    //settled between
    to: past,
    //dedicated to
    into: past,
    //pumped into
    us: past,
    //charged us
    them: past,
    //charged us
    his: past,
    //shared his
    her: past,
    //
    their: past,
    //
    our: past,
    //
    me: past,
    //
    about: jj3
  }
};
var adj_past_default = {
  beforeTags: { ...adj_default.beforeTags, ...adjPast.beforeTags },
  afterTags: { ...adj_default.afterTags, ...adjPast.afterTags },
  beforeWords: { ...adj_default.beforeWords, ...adjPast.beforeWords },
  afterWords: { ...adj_default.afterWords, ...adjPast.afterWords }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/adj-present.js
var misc3 = {
  afterTags: {
    Noun: "Adjective",
    //ruling party
    Conjunction: void 0
    //clean and excellent
  }
};
var clue4 = {
  beforeTags: {
    ...adj_default.beforeTags,
    ...verb_default.beforeTags,
    // always clean
    Adverb: void 0,
    Negative: void 0
  },
  afterTags: { ...adj_default.afterTags, ...verb_default.afterTags, ...misc3.afterTags },
  beforeWords: {
    ...adj_default.beforeWords,
    ...verb_default.beforeWords,
    // have seperate contracts
    have: void 0,
    had: void 0,
    not: void 0,
    //went wrong, got wrong
    went: "Adjective",
    goes: "Adjective",
    got: "Adjective",
    // be sure
    be: "Adjective"
  },
  afterWords: {
    ...adj_default.afterWords,
    ...verb_default.afterWords,
    to: void 0,
    //slick to the touch
    as: "Adjective"
    //pale as
  }
};
var adj_present_default = clue4;

// node_modules/compromise/src/2-two/preTagger/model/clues/noun-gerund.js
var misc4 = {
  beforeTags: {
    Copula: "Gerund",
    PastTense: "Gerund",
    PresentTense: "Gerund",
    Infinitive: "Gerund"
  },
  afterTags: {
    Value: "Gerund"
    //maintaining 500
  },
  beforeWords: {
    are: "Gerund",
    were: "Gerund",
    be: "Gerund",
    no: "Gerund",
    without: "Gerund",
    //are you playing
    you: "Gerund",
    we: "Gerund",
    they: "Gerund",
    he: "Gerund",
    she: "Gerund",
    //stop us playing
    us: "Gerund",
    them: "Gerund"
  },
  afterWords: {
    // offering the
    the: "Gerund",
    this: "Gerund",
    that: "Gerund",
    //got me thinking
    me: "Gerund",
    us: "Gerund",
    them: "Gerund"
  }
};
var clue5 = {
  beforeTags: { ...gerund_default.beforeTags, ...noun_default.beforeTags, ...misc4.beforeTags },
  afterTags: { ...gerund_default.afterTags, ...noun_default.afterTags, ...misc4.afterTags },
  beforeWords: { ...gerund_default.beforeWords, ...noun_default.beforeWords, ...misc4.beforeWords },
  afterWords: { ...gerund_default.afterWords, ...noun_default.afterWords, ...misc4.afterWords }
};
var noun_gerund_default = clue5;

// node_modules/compromise/src/2-two/preTagger/model/clues/noun-verb.js
var nn = "Singular";
var vb = "Infinitive";
var clue6 = {
  beforeTags: {
    ...verb_default.beforeTags,
    ...noun_default.beforeTags,
    // Noun: undefined
    Adjective: nn,
    //great name
    Particle: nn
    //brought under control
  },
  afterTags: {
    ...verb_default.afterTags,
    ...noun_default.afterTags,
    ProperNoun: vb,
    Gerund: vb,
    Adjective: vb,
    Copula: nn
  },
  beforeWords: {
    ...verb_default.beforeWords,
    ...noun_default.beforeWords,
    // is time
    is: nn,
    was: nn,
    //balance of power
    of: nn,
    have: null
    //have cash
  },
  afterWords: {
    ...verb_default.afterWords,
    ...noun_default.afterWords,
    // for: vb,//work for
    instead: vb,
    // that: nn,//subject that was
    // for: vb,//work for
    about: vb,
    //talk about
    his: vb,
    //shot his
    her: vb,
    //
    to: null,
    by: null,
    in: null
  }
};
var noun_verb_default = clue6;

// node_modules/compromise/src/2-two/preTagger/model/clues/_person.js
var p2 = "Person";
var person_default = {
  beforeTags: {
    Honorific: p2,
    Person: p2
    // Preposition: p, //with sue
  },
  afterTags: {
    Person: p2,
    ProperNoun: p2,
    Verb: p2
    //bob could
    // Modal:true, //bob could
    // Copula:true, //bob is
    // PresentTense:true, //bob seems
  },
  ownTags: {
    ProperNoun: p2
    //capital letter
  },
  beforeWords: {
    hi: p2,
    hey: p2,
    yo: p2,
    dear: p2,
    hello: p2
  },
  afterWords: {
    // person-usually verbs
    said: p2,
    says: p2,
    told: p2,
    tells: p2,
    feels: p2,
    felt: p2,
    seems: p2,
    thinks: p2,
    thought: p2,
    spends: p2,
    spendt: p2,
    plays: p2,
    played: p2,
    sing: p2,
    sang: p2,
    learn: p2,
    learned: p2,
    wants: p2,
    wanted: p2
    // and:true, //sue and jeff
  }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/person-date.js
var m = "Month";
var p3 = "Person";
var month = {
  beforeTags: {
    Date: m,
    Value: m
  },
  afterTags: {
    Date: m,
    Value: m
  },
  beforeWords: {
    by: m,
    in: m,
    on: m,
    during: m,
    after: m,
    before: m,
    between: m,
    until: m,
    til: m,
    sometime: m,
    of: m,
    //5th of april
    this: m,
    //this april
    next: m,
    last: m,
    previous: m,
    following: m,
    with: p3
    // for: p,
  },
  afterWords: {
    sometime: m,
    in: m,
    of: m,
    until: m,
    the: m
    //june the 4th
  }
};
var person_date_default = {
  beforeTags: { ...person_default.beforeTags, ...month.beforeTags },
  afterTags: { ...person_default.afterTags, ...month.afterTags },
  beforeWords: { ...person_default.beforeWords, ...month.beforeWords },
  afterWords: { ...person_default.afterWords, ...month.afterWords }
};

// node_modules/compromise/src/2-two/preTagger/model/clues/person-noun.js
var clue7 = {
  beforeTags: { ...noun_default.beforeTags, ...person_default.beforeTags },
  afterTags: { ...noun_default.afterTags, ...person_default.afterTags },
  beforeWords: { ...noun_default.beforeWords, ...person_default.beforeWords, i: "Infinitive", we: "Infinitive" },
  afterWords: { ...noun_default.afterWords, ...person_default.afterWords }
};
var person_noun_default = clue7;

// node_modules/compromise/src/2-two/preTagger/model/clues/person-verb.js
var clues = {
  beforeTags: { ...noun_default.beforeTags, ...person_default.beforeTags, ...verb_default.beforeTags },
  afterTags: { ...noun_default.afterTags, ...person_default.afterTags, ...verb_default.afterTags },
  beforeWords: { ...noun_default.beforeWords, ...person_default.beforeWords, ...verb_default.beforeWords },
  afterWords: { ...noun_default.afterWords, ...person_default.afterWords, ...verb_default.afterWords }
};
var person_verb_default = clues;

// node_modules/compromise/src/2-two/preTagger/model/clues/person-place.js
var p4 = "Place";
var place = {
  beforeTags: {
    Place: p4
  },
  afterTags: {
    Place: p4,
    Abbreviation: p4
  },
  beforeWords: {
    in: p4,
    by: p4,
    near: p4,
    from: p4,
    to: p4
  },
  afterWords: {
    in: p4,
    by: p4,
    near: p4,
    from: p4,
    to: p4,
    government: p4,
    council: p4,
    region: p4,
    city: p4
  }
};
var clue8 = {
  beforeTags: { ...place.beforeTags, ...person_default.beforeTags },
  afterTags: { ...place.afterTags, ...person_default.afterTags },
  beforeWords: { ...place.beforeWords, ...person_default.beforeWords },
  afterWords: { ...place.afterWords, ...person_default.afterWords }
};
var person_place_default = clue8;

// node_modules/compromise/src/2-two/preTagger/model/clues/person-adj.js
var clues2 = {
  beforeTags: { ...person_default.beforeTags, ...adj_default.beforeTags },
  afterTags: { ...person_default.afterTags, ...adj_default.afterTags },
  beforeWords: { ...person_default.beforeWords, ...adj_default.beforeWords },
  afterWords: { ...person_default.afterWords, ...adj_default.afterWords }
};
var person_adj_default = clues2;

// node_modules/compromise/src/2-two/preTagger/model/clues/unit-noun.js
var un = "Unit";
var clues3 = {
  beforeTags: { Value: un },
  afterTags: {},
  beforeWords: {
    per: un,
    every: un,
    each: un,
    square: un,
    //square km
    cubic: un,
    sq: un,
    metric: un
    //metric ton
  },
  afterWords: {
    per: un,
    squared: un,
    cubed: un,
    long: un
    //foot long
  }
};
var unit_noun_default = clues3;

// node_modules/compromise/src/2-two/preTagger/model/clues/index.js
var clues4 = {
  "Actor|Verb": actor_verb_default,
  "Adj|Gerund": adj_gerund_default,
  "Adj|Noun": adj_noun_default,
  "Adj|Past": adj_past_default,
  "Adj|Present": adj_present_default,
  "Noun|Verb": noun_verb_default,
  "Noun|Gerund": noun_gerund_default,
  "Person|Noun": person_noun_default,
  "Person|Date": person_date_default,
  "Person|Verb": person_verb_default,
  "Person|Place": person_place_default,
  "Person|Adj": person_adj_default,
  "Unit|Noun": unit_noun_default
};
var copy = (obj, more) => {
  const res = Object.keys(obj).reduce((h2, k2) => {
    h2[k2] = obj[k2] === "Infinitive" ? "PresentTense" : "Plural";
    return h2;
  }, {});
  return Object.assign(res, more);
};
clues4["Plural|Verb"] = {
  beforeWords: copy(clues4["Noun|Verb"].beforeWords, {
    had: "Plural",
    //had tears
    have: "Plural"
  }),
  afterWords: copy(clues4["Noun|Verb"].afterWords, {
    his: "PresentTense",
    her: "PresentTense",
    its: "PresentTense",
    in: null,
    to: null,
    is: "PresentTense",
    //the way it works is
    by: "PresentTense"
    //it works by
  }),
  beforeTags: copy(clues4["Noun|Verb"].beforeTags, {
    Conjunction: "PresentTense",
    //and changes
    Noun: void 0,
    //the century demands
    ProperNoun: "PresentTense"
    //john plays
  }),
  afterTags: copy(clues4["Noun|Verb"].afterTags, {
    Gerund: "Plural",
    //ice caps disappearing
    Noun: "PresentTense",
    //changes gears
    Value: "PresentTense"
    //changes seven gears
  })
};
var clues_default = clues4;

// node_modules/compromise/src/2-two/preTagger/model/patterns/suffixes.js
var Adj = "Adjective";
var Inf = "Infinitive";
var Pres2 = "PresentTense";
var Sing = "Singular";
var Past = "PastTense";
var Avb = "Adverb";
var Plrl = "Plural";
var Actor2 = "Actor";
var Vb = "Verb";
var Noun = "Noun";
var Prop = "ProperNoun";
var Last = "LastName";
var Modal = "Modal";
var Place2 = "Place";
var Prt = "Participle";
var suffixes_default2 = [
  null,
  null,
  {
    //2-letter
    ea: Sing,
    ia: Noun,
    ic: Adj,
    ly: Avb,
    "'n": Vb,
    "'t": Vb
  },
  {
    //3-letter
    oed: Past,
    ued: Past,
    xed: Past,
    " so": Avb,
    "'ll": Modal,
    "'re": "Copula",
    azy: Adj,
    eer: Noun,
    end: Vb,
    ped: Past,
    ffy: Adj,
    ify: Inf,
    ing: "Gerund",
    ize: Inf,
    ibe: Inf,
    lar: Adj,
    mum: Adj,
    nes: Pres2,
    nny: Adj,
    // oid: Adj,
    ous: Adj,
    que: Adj,
    ger: Noun,
    ber: Noun,
    rol: Sing,
    sis: Sing,
    ogy: Sing,
    oid: Sing,
    ian: Sing,
    zes: Pres2,
    eld: Past,
    ken: Prt,
    //awoken
    ven: Prt,
    //woven
    ten: Prt,
    //brighten
    ect: Inf,
    ict: Inf,
    // ide: Inf,
    ign: Inf,
    oze: Inf,
    ful: Adj,
    bal: Adj,
    ton: Noun,
    pur: Place2
  },
  {
    //4-letter
    amed: Past,
    aped: Past,
    ched: Past,
    lked: Past,
    rked: Past,
    reed: Past,
    nded: Past,
    mned: Adj,
    cted: Past,
    dged: Past,
    ield: Sing,
    akis: Last,
    cede: Inf,
    chuk: Last,
    czyk: Last,
    ects: Pres2,
    iend: Sing,
    ends: Vb,
    enko: Last,
    ette: Sing,
    iary: Sing,
    wner: Sing,
    //owner
    fies: Pres2,
    fore: Avb,
    gate: Inf,
    gone: Adj,
    ices: Plrl,
    ints: Plrl,
    ruct: Inf,
    ines: Plrl,
    ions: Plrl,
    ners: Plrl,
    pers: Plrl,
    lers: Plrl,
    less: Adj,
    llen: Adj,
    made: Adj,
    nsen: Last,
    oses: Pres2,
    ould: Modal,
    some: Adj,
    sson: Last,
    ians: Plrl,
    // tage: Inf,
    tion: Sing,
    tage: Noun,
    ique: Sing,
    tive: Adj,
    tors: Noun,
    vice: Sing,
    lier: Sing,
    fier: Sing,
    wned: Past,
    gent: Sing,
    tist: Actor2,
    pist: Actor2,
    rist: Actor2,
    mist: Actor2,
    yist: Actor2,
    vist: Actor2,
    ists: Actor2,
    lite: Sing,
    site: Sing,
    rite: Sing,
    mite: Sing,
    bite: Sing,
    mate: Sing,
    date: Sing,
    ndal: Sing,
    vent: Sing,
    uist: Actor2,
    gist: Actor2,
    note: Sing,
    cide: Sing,
    //homicide
    ence: Sing,
    //absence
    wide: Adj,
    //nationwide
    // side: Adj,//alongside
    vide: Inf,
    //provide
    ract: Inf,
    duce: Inf,
    pose: Inf,
    eive: Inf,
    lyze: Inf,
    lyse: Inf,
    iant: Adj,
    nary: Adj,
    ghty: Adj,
    uent: Adj,
    erer: Actor2,
    //caterer
    bury: Place2,
    dorf: Noun,
    esty: Noun,
    wych: Place2,
    dale: Place2,
    folk: Place2,
    vale: Place2,
    abad: Place2,
    sham: Place2,
    wick: Place2,
    view: Place2
  },
  {
    //5-letter
    elist: Actor2,
    holic: Sing,
    phite: Sing,
    tized: Past,
    urned: Past,
    eased: Past,
    ances: Plrl,
    bound: Adj,
    ettes: Plrl,
    fully: Avb,
    ishes: Pres2,
    ities: Plrl,
    marek: Last,
    nssen: Last,
    ology: Noun,
    osome: Sing,
    tment: Sing,
    ports: Plrl,
    rough: Adj,
    tches: Pres2,
    tieth: "Ordinal",
    tures: Plrl,
    wards: Avb,
    where: Avb,
    archy: Noun,
    pathy: Noun,
    opoly: Noun,
    embly: Noun,
    phate: Noun,
    ndent: Sing,
    scent: Sing,
    onist: Actor2,
    anist: Actor2,
    alist: Actor2,
    olist: Actor2,
    icist: Actor2,
    ounce: Inf,
    iable: Adj,
    borne: Adj,
    gnant: Adj,
    inant: Adj,
    igent: Adj,
    atory: Adj,
    // ctory: Adj,
    rient: Sing,
    dient: Sing,
    maker: Actor2,
    burgh: Place2,
    mouth: Place2,
    ceter: Place2,
    ville: Place2,
    hurst: Place2,
    stead: Place2,
    endon: Place2,
    brook: Place2,
    shire: Place2,
    worth: Noun,
    field: Prop,
    ridge: Place2
  },
  {
    //6-letter
    auskas: Last,
    parent: Sing,
    cedent: Sing,
    ionary: Sing,
    cklist: Sing,
    brooke: Place2,
    keeper: Actor2,
    logist: Actor2,
    teenth: "Value",
    worker: Actor2,
    master: Actor2,
    writer: Actor2,
    brough: Place2,
    cester: Place2,
    ington: Place2,
    cliffe: Place2,
    ingham: Place2
  },
  {
    //7-letter
    chester: Place2,
    logists: Actor2,
    opoulos: Last,
    borough: Place2,
    sdottir: Last
    //swedish female
  }
];

// node_modules/compromise/src/2-two/preTagger/model/patterns/prefixes.js
var Adj2 = "Adjective";
var Noun2 = "Noun";
var Verb = "Verb";
var prefixes_default2 = [
  null,
  null,
  {
    // 2-letter
  },
  {
    // 3-letter
    neo: Noun2,
    bio: Noun2,
    // pre: Noun,
    "de-": Verb,
    "re-": Verb,
    "un-": Verb,
    "ex-": Noun2
  },
  {
    // 4-letter
    anti: Noun2,
    auto: Noun2,
    faux: Adj2,
    hexa: Noun2,
    kilo: Noun2,
    mono: Noun2,
    nano: Noun2,
    octa: Noun2,
    poly: Noun2,
    semi: Adj2,
    tele: Noun2,
    "pro-": Adj2,
    "mis-": Verb,
    "dis-": Verb,
    "pre-": Adj2
    //hmm
  },
  {
    // 5-letter
    anglo: Noun2,
    centi: Noun2,
    ethno: Noun2,
    ferro: Noun2,
    grand: Noun2,
    hepta: Noun2,
    hydro: Noun2,
    intro: Noun2,
    macro: Noun2,
    micro: Noun2,
    milli: Noun2,
    nitro: Noun2,
    penta: Noun2,
    quasi: Adj2,
    radio: Noun2,
    tetra: Noun2,
    "omni-": Adj2,
    "post-": Adj2
  },
  {
    // 6-letter
    pseudo: Adj2,
    "extra-": Adj2,
    "hyper-": Adj2,
    "inter-": Adj2,
    "intra-": Adj2,
    "deca-": Adj2
    // 'trans-': Noun,
  },
  {
    // 7-letter
    electro: Noun2
  }
];

// node_modules/compromise/src/2-two/preTagger/model/patterns/endsWith.js
var Adj3 = "Adjective";
var Inf2 = "Infinitive";
var Pres3 = "PresentTense";
var Sing2 = "Singular";
var Past2 = "PastTense";
var Adverb = "Adverb";
var Exp = "Expression";
var Actor3 = "Actor";
var Verb2 = "Verb";
var Noun3 = "Noun";
var Last2 = "LastName";
var endsWith_default = {
  a: [
    [/.[aeiou]na$/, Noun3, "tuna"],
    [/.[oau][wvl]ska$/, Last2],
    [/.[^aeiou]ica$/, Sing2, "harmonica"],
    [/^([hyj]a+)+$/, Exp, "haha"]
    //hahah
  ],
  c: [[/.[^aeiou]ic$/, Adj3]],
  d: [
    //==-ed==
    //double-consonant
    [/[aeiou](pp|ll|ss|ff|gg|tt|rr|bb|nn|mm)ed$/, Past2, "popped"],
    //double-vowel
    [/.[aeo]{2}[bdgmnprvz]ed$/, Past2, "rammed"],
    //-hed
    [/.[aeiou][sg]hed$/, Past2, "gushed"],
    //-rd
    [/.[aeiou]red$/, Past2, "hired"],
    [/.[aeiou]r?ried$/, Past2, "hurried"],
    // ard
    [/[^aeiou]ard$/, Sing2, "steward"],
    // id
    [/[aeiou][^aeiou]id$/, Adj3, ""],
    [/.[vrl]id$/, Adj3, "livid"],
    // ===== -ed ======
    //-led
    [/..led$/, Past2, "hurled"],
    //-sed
    [/.[iao]sed$/, Past2, ""],
    [/[aeiou]n?[cs]ed$/, Past2, ""],
    //-med
    [/[aeiou][rl]?[mnf]ed$/, Past2, ""],
    //-ked
    [/[aeiou][ns]?c?ked$/, Past2, "bunked"],
    //-gned
    [/[aeiou]gned$/, Past2],
    //-ged
    [/[aeiou][nl]?ged$/, Past2],
    //-ted
    [/.[tdbwxyz]ed$/, Past2],
    [/[^aeiou][aeiou][tvx]ed$/, Past2],
    //-ied
    [/.[cdflmnprstv]ied$/, Past2, "emptied"]
  ],
  e: [
    [/.[lnr]ize$/, Inf2, "antagonize"],
    [/.[^aeiou]ise$/, Inf2, "antagonise"],
    [/.[aeiou]te$/, Inf2, "bite"],
    [/.[^aeiou][ai]ble$/, Adj3, "fixable"],
    [/.[^aeiou]eable$/, Adj3, "maleable"],
    [/.[ts]ive$/, Adj3, "festive"],
    [/[a-z]-like$/, Adj3, "woman-like"]
  ],
  h: [
    [/.[^aeiouf]ish$/, Adj3, "cornish"],
    [/.v[iy]ch$/, Last2, "..ovich"],
    [/^ug?h+$/, Exp, "ughh"],
    [/^uh[ -]?oh$/, Exp, "uhoh"],
    [/[a-z]-ish$/, Adj3, "cartoon-ish"]
  ],
  i: [[/.[oau][wvl]ski$/, Last2, "polish-male"]],
  k: [
    [/^(k){2}$/, Exp, "kkkk"]
    //kkkk
  ],
  l: [
    [/.[gl]ial$/, Adj3, "familial"],
    [/.[^aeiou]ful$/, Adj3, "fitful"],
    [/.[nrtumcd]al$/, Adj3, "natal"],
    [/.[^aeiou][ei]al$/, Adj3, "familial"]
  ],
  m: [
    [/.[^aeiou]ium$/, Sing2, "magnesium"],
    [/[^aeiou]ism$/, Sing2, "schism"],
    [/^[hu]m+$/, Exp, "hmm"],
    [/^\d+ ?[ap]m$/, "Date", "3am"]
  ],
  n: [
    [/.[lsrnpb]ian$/, Adj3, "republican"],
    [/[^aeiou]ician$/, Actor3, "musician"],
    [/[aeiou][ktrp]in'$/, "Gerund", "cookin'"]
    // 'cookin', 'hootin'
  ],
  o: [
    [/^no+$/, Exp, "noooo"],
    [/^(yo)+$/, Exp, "yoo"],
    [/^wo{2,}[pt]?$/, Exp, "woop"]
    //woo
  ],
  r: [
    [/.[bdfklmst]ler$/, "Noun"],
    [/[aeiou][pns]er$/, Sing2],
    [/[^i]fer$/, Inf2],
    [/.[^aeiou][ao]pher$/, Actor3],
    [/.[lk]er$/, "Noun"],
    [/.ier$/, "Comparative"]
  ],
  t: [
    [/.[di]est$/, "Superlative"],
    [/.[icldtgrv]ent$/, Adj3],
    [/[aeiou][^aeiou\r\n\u2028\u2029]*ist$/, Adj3],
    [/^[a-z]et$/, Verb2]
  ],
  s: [
    [/.[^aeiou]ises$/, Pres3],
    [/.[rln]ates$/, Pres3],
    [/.[^z]ens$/, Verb2],
    [/.[lstrn]us$/, Sing2],
    [/.[aeiou]sks$/, Pres3],
    [/.[aeiou]kes$/, Pres3],
    [/[aeiou][^aeiou]is$/, Sing2],
    [/[a-z]'s$/, Noun3],
    [/^yes+$/, Exp]
    //yessss
  ],
  v: [
    [/.[^aeiou][ai][kln]ov$/, Last2]
    //east-europe
  ],
  y: [
    [/.[cts]hy$/, Adj3],
    [/.[st]ty$/, Adj3],
    [/.[tnl]ary$/, Adj3],
    [/.[oe]ry$/, Sing2],
    [/[rdntkbhs]ly$/, Adverb],
    [/.(gg|bb|zz)ly$/, Adj3],
    [/...lly$/, Adverb],
    [/.[gk]y$/, Adj3],
    [/[bszmp]{2}y$/, Adj3],
    [/.[ai]my$/, Adj3],
    [/[ea]{2}zy$/, Adj3],
    [/.[^aeiou]ity$/, Sing2]
  ]
};

// node_modules/compromise/src/2-two/preTagger/model/patterns/neighbours.js
var vb2 = "Verb";
var nn2 = "Noun";
var neighbours_default = {
  // looking at the previous word's tags:
  leftTags: [
    ["Adjective", nn2],
    ["Possessive", nn2],
    ["Determiner", nn2],
    ["Adverb", vb2],
    ["Pronoun", vb2],
    ["Value", nn2],
    ["Ordinal", nn2],
    ["Modal", vb2],
    ["Superlative", nn2],
    ["Demonym", nn2],
    ["Honorific", "Person"]
    //dr. Smith
  ],
  // looking at the previous word:
  leftWords: [
    ["i", vb2],
    ["first", nn2],
    ["it", vb2],
    ["there", vb2],
    ["not", vb2],
    ["because", nn2],
    ["if", nn2],
    ["but", nn2],
    ["who", vb2],
    ["this", nn2],
    ["his", nn2],
    ["when", nn2],
    ["you", vb2],
    ["very", "Adjective"],
    ["old", nn2],
    ["never", vb2],
    ["before", nn2],
    ["a", nn2],
    ["the", nn2],
    ["been", vb2]
  ],
  // looking at the next word's tags:
  rightTags: [
    ["Copula", nn2],
    ["PastTense", nn2],
    ["Conjunction", nn2],
    ["Modal", nn2]
  ],
  // looking at the next word:
  rightWords: [
    ["there", vb2],
    ["me", vb2],
    ["man", "Adjective"],
    // ['only', vb],
    ["him", vb2],
    ["it", vb2],
    //relaunch it
    ["were", nn2],
    ["took", nn2],
    ["himself", vb2],
    ["went", nn2],
    ["who", nn2],
    ["jr", "Person"]
  ]
};

// node_modules/compromise/src/2-two/preTagger/model/models/_data.js
var data_default2 = {
  "Comparative": "0er:shy,ray,oad,ead|0r:e|0:er~0er:,eat,ver|1ier:y|0der:ad|0ger:ig|2urther:far|0ter:at,wet,ot|4better:good|0mer:im|0ner:hin|0ber:ib|3worse:bad~1:er{eri,wid,rud,g,fak,u,uch,v,t{u,a,o,i},saf,som,am,ip,in,r,s,l{b,pa,ta,t,p},c,e}|0:emier,esser|2:er{ng,ain,ear,air,oor,ss}~",
  "Gerund": "3:ing{s{ocu,ucu,ia,s},k{ea,oa,ya,oo},nap,sip,lot,icit,iven,iphon,ing,ong,og,isc,l{l{,e{s,t,w,f,m,y},fa,ca,sta},ia,ai,ei,oi,e,o,au,ou,r,w},au,gram,zz,tz}|4:ing{kk,pp,tt,nn,nsell}|3e:ing{t{a,crea,nea,le,ompe,cre,as{t,w,p},o,u,erou,i{wr,v,ped,c,n}},r{rfe,rseve,dhe,o{st,pl,c,gn,sh,d}},th{rea,nba,wa,i,e}}|4ie:rlying~3:ing{,elop,oop,eap,d{r,ea,oa,ee,l,n,oi,ai,w,oo,ou,au},t{lle,ou,ea,mba,oa,oo,ivo},in{a,rg,o,e,u},al{e,n,u,v},aim,eam,oam,r{e,o,ou,eu,ea,oa,ga,ai},mb,rb}|3e:ing{d,s,ak,ik,ok,v,r,g{,in{fr,p,h}},c,n{i,u,ve,o{l,p,b,h,z},la,wa},u,m{co,u,a,i},z,l,b,p{a,o,y,i}}|5is:being|4:ing{gass,dd,ll{a,e,isti,ci,ntro,atro,xto},mm,rr,gg,bb,ick{m,f},izz}~1ing:te,we,he|0ing:inge,ssip,dnap,dd,t{e{e,arg,dg,k,pr,m,c,i,mp},imi,nefi,ofi,ilo},an{e,h,g,o},l{dia,e{nrav,d,e,rc,l,k}},m{r,ee,l,o},fer{f,m},ng,alog,gg|2ying:ie|0king:rek|0ping:p{o,te,i,a}|0ting:t{e,i{ys,m,qu,f,h,l,n,p},u,a,o}|0ning:in,an,un|0ring:fer,deter~3e:ing{ow,bor,bit,ach}|3:ing{add,hang,egg,spell,cue,program}|4:ing{itt{s,b},donn,penn}|4ie:ying{d,t,l,v}",
  "Participle": "0:|3e:den|2:ne|1:d~1:n,mt|3ose:osen|4ake:woken|2:en{be,t,l},ned|3e:tten|4eave:woven|4eeze:ozen|3ine:hone|5et:otten|2in:un|0:run|4eak:oken|3ink:unk|5eek:ought|1d:t|3:bidden|3ing:ung|2im:um|1l:pilt|4eal:olen|2y:in|3y:flown|3ear:orn~0:me|0d:dive|1den:de|0ne:o~",
  "PastTense": "0:,eat|1e:lost|2it:at|1d:nt,lt|1:ant,alt,apt,d{e{n{o{b,l,h,p,t,z},i,u,ve,ca,wa},t{a{,cre,ne,me},as{b,t,w},u,ompe,le,cre,o},ath,d{a,e,i,lu,ru,o},g,v,b,s,nti,m{co,i,u,a,ram,y},r{,dhe,eve,rfe,o{sh,b,pl,c,st,gn,p}},c,e,dy,z,l{,a{b,p,h,c}},u,k{a,i,o,u},p{o,a,i,y}},r}|4tch:ught|2et:ot|2ave:ft|1ve:had|2:ed{iven,t{cot,ici,ebu,lo},wing,ocus,ss,ias,ki,tz,zz,l{l,strol,a,ai,oi,ei,o,r,e,ou,au,w},eak,oak,ook}|3:ed{nn,tt,dd,all,pp}|0e:id|2y:aid|3old:eld|3and:ood|2ose:se|3eat:ate|3eak:oke,uck|3ear:ore|4are:were|3ive:ove,ave|2ke:de|3id:bade|3ide:ode|3ine:one|3eal:ole|2in:an,un,on|2ow:ew|2ay:slew|2ee:aw|3ing:ang|2ig:ug|3ink:ank,unk|3ake:ook|2im:am|2ie:ay~2:ed{,t{lle,ou,oo,io,ea,oa},d{ea,oa,ai,oi,ee,oo},in{a,o,e,u},rb,mb,aim,eam,oam,r{e,ai,o,ea,oa,eu,ou,mu},ll{a{c,r,st,w},e{w,qu,h,sm,y}},bang,ong,sg,p{ea,velo,oo,si}}|1et:met|1ot:hot|5ight:fought|1ad:sled|0:bid|4ind:ound|1ed:bred|2un:ran|3ite:ote|0e:bit|1:ited{c,ped,n,v,p}|3eave:wove|3ise:rose|3eeze:oze|3ome:ame|3ake:woke|3ike:ruck|5each:taught|3:ed{bb,gass,mm,rr,ll{nu,lfi,e,tro,xto},gg,ick{m,n,f}}|3is:was|3y:ied|2y:flew|5uy:ought|2aw:drew|3all:ell|3ell:old|2el:elt|3ick:tuck|5ink:hought|5eek:sought|3ang:hung|3ing:ung|5ing:rought|2ep:pt|2o:did|4go:went~0:t{se,be,le,s{ca,hru,co,r},u,hi,li,hur,bea},read,hed|2ot:get|0ed:t{arge,pre,debu,imi,ilo},d{rea{b,h},min,cin},ean,oan,oy,ay,ey,m{o,r,ee,l},ffer,rr,rrow,l{pel,e{an,pe,re,ab,ev,l}},gg,seep|0ted:t{re,ne,bu,i{qu,m,ref,n},o,a}|2at:ysit,pit|0ded:d{a,i,e,o}|2ade:orbid|1t:bend,send,ild|3ood:tand|2d:eed{l,f,p}|3eld:hold|0ned:in,an,un|2an:gin|2un:spin|0t:mean,deal,leap|0d:e{,prid,ris{p,o},ueez,lcom}|1:ide{sl,h}|3ode:ride|3ove:ive{dr,tr,d}|3ave:give|3ft:eave|3se:oose|1d:lee|2aw:see|3one:shine|3ook:ake{s,t,h}|2de:make|2ay:rlie|3ught:catch|1id:pay|2am:wim|0red:deter,fer|3ore:ear{b,w,t}|2ew:ow{bl,r,n}|3ole:teal|0led:al{iti,h,v}|3ank:ink{r,s}|3unk:tink|3oke:eak{br,sp}|3uck:neak|3ang:ing{pr,s}|3ung:wring|2ug:dig|0ped:p{a,o,te,i}~1:d{e{ach,i{d,l,p,t,v},ey,ow,rout,stak,wak},hear},pent|2:ed{add,egg,wing,err,sever,model,spell}|3eat:ate|1ed:ed{bl,f,sp}|3:ed{donn,pitt,vett,upp}|0:fit,quit,shed|1e:fled,lost|1ve:had|2y:aid{l,s}|1ad:led|1d:ent{l,r,sp}|1ght:lit|3ing:rang|2it:sat|4are:were|2in:won",
  "PresentTense": "1ve:as|1:es{beli,rli,th}|2:hes~1:s|3is:are|2:es{ocus,ss,ias,o,x,zz}|3:gasses|3y:ies~0s:io,oo,y{a,o,u,e}|0es:sh,ch~1ve:has|1:ies{l,d,t,v}",
  "Superlative": "4best:good|0:est|0st:e|1t:orse|0est:shy,gay,ey|2iest:cey~0est:,reat|0gest:ig|2urthest:far|0test:t{o,we,i,a}|1iest:y|0lest:ful|0nest:hin|0:east|3worst:bad|0most:ner,uter~2:est{g,ang,t{a,u,o,i},r{ra,ua,so,di,u,seve,ce},eri,wid,rud,s,l{p,b,t,pa},fin,fak,ip,af,som,am,c,u,v}|3:est{ng,ss}|0:hwest|4ey:riciest~4best:good|0est:full",
  "AdjToNoun": "0ness:,ant{s,p},ied,red,e{tiv{rac,ta,isi},nabl},adic,msical,oy,ay|0ion:ect|1ce:nt|1cy:nt{a{vagr,br,li,n,h},icie,ete}|2tion:vant,reet|5tiquity:cient|3or:ent{rd,v}|0y:est|1s:ost|1m:fist|2eat:ot|0itude:pt|2n:ious{bit,ut,ic}|3ty:acious{d,n,v}|2sity:ous{curi,ner,umin}|4y:rious{fu,xu,te,t},etic,tiful|4ur:lamorous|3:ous{umor,gor,e,al,d,y},nate,ortive,ing{st,w,k},atic,ful{orce,ace,se,wer,ight,ct,oy,l,s}|4:ltuous,able{rt,ect,e}|3sy:teous|3ity:ous{ne,ol,il,m}|3inousness:umous|1ment:ed|2ment:hed|2ion:ted{a,o}|2:nted,cused,ical{g,us},tty|2ation:ized,mined|1:ed{is,lin,c}|0ity:id,tund,tic,al,ar|0edness:and|2cy:ate|1ion:erate,lute|2nce:mperate|3e:unate,pensive,ing{ar,ov}|2on:ive{t{c,a,i,rcep},gress,sess,as}|1ity:e{tiv{ac,ea,si},il,r,n,im}|4ce:fensive|0ty:aive,yal,ain|0ry:ave|2ility:ble|3lity:pitable|3tion:irable|4e:uable|3ility:mble|1icity:imple|0ties:btle|1dom:wise|0dom:ee|6fulness:begone|3ement:ing{s,g,t}|3edom:ring|3ance:uring|3ation:iring|4sion:nding|0:anding|3eness:ving|1ess:ning|3ength:ong|2th:ung|2y:ic,estic|3m:stic|5:tistic|3y:tastic|2ry:antic|3ce:mantic|1on:omatic|1sm:ic{gmat,m,o}|0ism:otic,conic,ional|2ism:stical|1iness:y|0th:rm|0liness:an|2pth:ep|3arity:ear|2verty:or~~~"
};

// node_modules/suffix-thumb/src/compress/_lib.js
var sections = ["fwd", "both", "rev", "ex"];
var reserved = /[~|:,{}0-9]/;
var decodeVal = function(key, str) {
  const m3 = str.match(/^[0-9]+/);
  const n3 = m3 ? Number(m3[0]) : 0;
  const tail = m3 ? str.slice(m3[0].length) : str;
  return key.slice(0, key.length - n3) + tail;
};

// node_modules/suffix-thumb/src/convert/index.js
var convert = function(str = "", model5 = {}) {
  const { ex = {}, fwd = {}, both = {} } = model5;
  if (Object.hasOwn(ex, str)) {
    return ex[str];
  }
  for (let len = str.length; len >= 0; len -= 1) {
    const suff = str.slice(str.length - len);
    const stem = str.slice(0, str.length - len);
    if (Object.hasOwn(fwd, suff)) {
      return stem + fwd[suff];
    }
    if (Object.hasOwn(both, suff)) {
      return stem + both[suff];
    }
  }
  return str;
};
var convert_default = convert;

// node_modules/suffix-thumb/src/reverse/index.js
var flipObj = function(obj = {}) {
  return Object.fromEntries(Object.entries(obj).map(([key, val]) => [val, key]));
};
var reverse2 = function(model5 = {}) {
  return {
    reversed: true,
    // these two work both ways
    both: flipObj(model5.both),
    ex: flipObj(model5.ex),
    // and the one-way rules trade places
    fwd: model5.rev || {},
    rev: model5.fwd || {}
  };
};
var reverse_default = reverse2;

// node_modules/suffix-thumb/src/compress/unpack.js
var invalid = function() {
  throw new Error("suffix-thumb: invalid packed model");
};
var unpackKeys = function(str, suff = "", out2 = []) {
  let i3 = 0;
  do {
    let chain = "";
    while (i3 < str.length && str[i3] !== "," && str[i3] !== "{") {
      chain += str[i3];
      i3 += 1;
    }
    if (reserved.test(chain)) {
      invalid();
    }
    if (str[i3] === "{") {
      let depth = 1;
      let j2 = i3 + 1;
      while (depth > 0 && j2 < str.length) {
        if (str[j2] === "{") {
          depth += 1;
        } else if (str[j2] === "}") {
          depth -= 1;
        }
        j2 += 1;
      }
      if (depth !== 0 || j2 < str.length && str[j2] !== ",") {
        invalid();
      }
      unpackKeys(str.slice(i3 + 1, j2 - 1), chain + suff, out2);
      i3 = j2;
    } else {
      out2.push(chain + suff);
    }
    i3 += 1;
  } while (i3 <= str.length);
  return out2;
};
var unpackSection = function(str = "") {
  const obj = /* @__PURE__ */ Object.create(null);
  if (!str) {
    return { ...obj };
  }
  str.split("|").forEach((group) => {
    const i3 = group.indexOf(":");
    const val = group.slice(0, i3);
    const count = val.match(/^[0-9]+/);
    if (i3 < 0 || !count || reserved.test(val.slice(count[0].length))) {
      invalid();
    }
    unpackKeys(group.slice(i3 + 1)).forEach((k2) => {
      if (Number(count[0]) > k2.length) {
        invalid();
      }
      obj[k2] = decodeVal(k2, val);
    });
  });
  return { ...obj };
};
var uncompress = function(str = "") {
  if (typeof str !== "string" || str[0] === "{") {
    throw new Error("suffix-thumb: uncompress expects a packed string. Models made before v6 must be learned again.");
  }
  const parts = str.split("~");
  if (str !== "" && parts.length !== sections.length) {
    invalid();
  }
  const model5 = {};
  sections.forEach((s3, i3) => {
    model5[s3] = unpackSection(parts[i3]);
  });
  return model5;
};
var unpack_default2 = uncompress;

// node_modules/compromise/src/2-two/preTagger/model/models/index.js
var fromPast = unpack_default2(data_default2.PastTense);
var fromPresent = unpack_default2(data_default2.PresentTense);
var fromGerund = unpack_default2(data_default2.Gerund);
var fromParticiple = unpack_default2(data_default2.Participle);
var toPast = reverse_default(fromPast);
var toPresent = reverse_default(fromPresent);
var toGerund = reverse_default(fromGerund);
var toParticiple = reverse_default(fromParticiple);
var toComparative = unpack_default2(data_default2.Comparative);
var toSuperlative = unpack_default2(data_default2.Superlative);
var fromComparative = reverse_default(toComparative);
var fromSuperlative = reverse_default(toSuperlative);
var adjToNoun = unpack_default2(data_default2.AdjToNoun);
var models_default = {
  fromPast,
  fromPresent,
  fromGerund,
  fromParticiple,
  toPast,
  toPresent,
  toGerund,
  toParticiple,
  // adjectives
  toComparative,
  toSuperlative,
  fromComparative,
  fromSuperlative,
  adjToNoun
};

// node_modules/compromise/src/2-two/preTagger/model/regex/regex-normal.js
var regex_normal_default = [
  [email, "Email"],
  [explicitUrl, "Url", "http.."],
  [bareUrl, "Url", ".com"],
  // timezones
  [/^[PMCE]ST$/i, "Timezone", "EST"],
  //names
  [/^ma?c'[a-z]{3}/, "LastName", "mc'neil"],
  [/^o'[a-z]{3}/, "LastName", "o'connor"],
  [/^ma?cd[aeiou][a-z]{3}/, "LastName", "mcdonald"],
  //slang things
  [/^(lol)+[sz]$/, "Expression", "lol"],
  [/^wo{2,}a*h?$/, "Expression", "wooah"],
  [/^(hee?){2,}h?$/, "Expression", "hehe"],
  [/^(un|de|re)-[a-z\u00C0-\u00FF]{2}/, "Verb", "un-vite"],
  // m/h
  [/^(m|k|cm|km)\/(s|h|hr)$/, "Unit", "5 k/m"],
  // μg/g
  [/^(ug|ng|mg)\/(l|m3|ft3)$/, "Unit", "ug/L"],
  // love/hate
  [/[^:/]\/\p{Letter}/u, "SlashedTerm", "love/hate"]
];

// node_modules/compromise/src/2-two/preTagger/model/regex/regex-text.js
var regex_text_default = [
  // #coolguy
  [/^#[\p{Number}_]*\p{Letter}/u, "HashTag"],
  // can't be all numbers
  // @spencermountain
  [/^@\w{2,}$/, "AtMention"],
  // period-ones acronyms - f.b.i.
  [/^([A-Z]\.){2}[A-Z]?/i, ["Acronym", "Noun"], "F.B.I"],
  //ascii-only
  // ending-apostrophes
  [/.{3}[lkmnp]in['‘’‛‵′`´]$/, "Gerund", "chillin'"],
  [/.{4}s['‘’‛‵′`´]$/, "Possessive", "flanders'"],
  //from https://www.regextester.com/106421
  // [/^([\u00a9\u00ae\u2319-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/, 'Emoji', 'emoji-range']
  // unicode character range
  [/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u, "Emoji", "emoji-class"]
];

// node_modules/compromise/src/2-two/preTagger/model/regex/regex-numbers.js
var regex_numbers_default = [
  [/^@1?[0-9](am|pm)$/i, "Time", "3pm"],
  [/^@1?[0-9]:[0-9]{2}(am|pm)?$/i, "Time", "3:30pm"],
  [/^'[0-9]{2}$/, "Year"],
  // times
  [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])$/, "Time", "3:12:31"],
  [/^[012]?[0-9](:[0-5][0-9])?(:[0-5][0-9])? ?(am|pm)$/i, "Time", "1:12pm"],
  [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])? ?(am|pm)?$/i, "Time", "1:12:31pm"],
  //can remove?
  // iso-dates
  [/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/i, "Date", "iso-date"],
  [/^[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,4}$/, "Date", "iso-dash"],
  [/^[0-9]{1,4}\/[0-9]{1,2}\/([0-9]{4}|[0-9]{2})$/, "Date", "iso-slash"],
  [/^[0-9]{1,4}\.[0-9]{1,2}\.[0-9]{1,4}$/, "Date", "iso-dot"],
  [/^[0-9]{1,4}-[a-z]{2,9}-[0-9]{1,4}$/i, "Date", "12-dec-2019"],
  // timezones
  [/^utc ?[+-]?[0-9]+$/, "Timezone", "utc-9"],
  [/^(gmt|utc)[+-][0-9]{1,2}$/i, "Timezone", "gmt-3"],
  //phone numbers
  [/^[0-9]{3}-[0-9]{4}$/, "PhoneNumber", "421-0029"],
  [/^(\+?[0-9][ -])?[0-9]{3}[ -]?[0-9]{3}-[0-9]{4}$/, "PhoneNumber", "1-800-"],
  //money
  //like $5.30
  [/^[-+]?\p{Currency_Symbol}[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?([kmb]|bn)?\+?$/u, ["Money", "Value"], "$5.30"],
  //like 5.30$
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\p{Currency_Symbol}\+?$/u, ["Money", "Value"], "5.30\xA3"],
  //like
  [/^[-+]?[$£]?[0-9]([0-9,.])+(usd|eur|jpy|gbp|cad|aud|chf|cny|hkd|nzd|kr|rub)$/i, ["Money", "Value"], "$400usd"],
  //numbers
  // 50 | -50 | 3.23  | 5,999.0  | 10+
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\+?$/, ["Cardinal", "NumericValue"], "5,999"],
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?(st|nd|rd|r?th)$/, ["Ordinal", "NumericValue"], "53rd"],
  // .73th
  [/^\.[0-9]+\+?$/, ["Cardinal", "NumericValue"], ".73th"],
  //percent
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?%\+?$/, ["Percent", "Cardinal", "NumericValue"], "-4%"],
  [/^\.[0-9]+%$/, ["Percent", "Cardinal", "NumericValue"], ".3%"],
  //fraction
  [/^[0-9]{1,4}\/[0-9]{1,4}(st|nd|rd|th)?s?$/, ["Fraction", "NumericValue"], "2/3rds"],
  //range
  [/^[0-9.]{1,3}[a-z]{0,2}[-–—][0-9]{1,3}[a-z]{0,2}$/, ["Value", "NumberRange"], "3-4"],
  //time-range
  [/^[0-9]{1,2}(:[0-9][0-9])?(am|pm)? ?[-–—] ?[0-9]{1,2}(:[0-9][0-9])?(am|pm)$/, ["Time", "NumberRange"], "3-4pm"],
  //number with unit
  [/^[0-9.]+([a-z°]{1,4})$/, "NumericValue", "9km"]
];

// node_modules/compromise/src/2-two/preTagger/model/orgWords.js
var orgWords_default = [
  "academy",
  "administration",
  "agence",
  "agences",
  "agencies",
  "agency",
  "airlines",
  "airways",
  "army",
  "assoc",
  "associates",
  "association",
  "assurance",
  "authority",
  "autorite",
  "aviation",
  "bank",
  "banque",
  "board",
  "boys",
  "brands",
  "brewery",
  "brotherhood",
  "brothers",
  "bureau",
  "cafe",
  "co",
  "caisse",
  "capital",
  "care",
  "cathedral",
  "center",
  "centre",
  "chemicals",
  "choir",
  "chronicle",
  "church",
  "circus",
  "clinic",
  "clinique",
  "club",
  "co",
  "coalition",
  "coffee",
  "collective",
  "college",
  "commission",
  "committee",
  "communications",
  "community",
  "company",
  "comprehensive",
  "computers",
  "confederation",
  "conference",
  "conseil",
  "consulting",
  "containers",
  "corporation",
  "corps",
  "corp",
  "council",
  "crew",
  "data",
  "departement",
  "department",
  "departments",
  "design",
  "development",
  "directorate",
  "division",
  "drilling",
  "education",
  "eglise",
  "electric",
  "electricity",
  "energy",
  "ensemble",
  "enterprise",
  "enterprises",
  "entertainment",
  "estate",
  "etat",
  "faculty",
  "faction",
  "federation",
  "financial",
  "fm",
  "foundation",
  "fund",
  "gas",
  "gazette",
  "girls",
  "government",
  "group",
  "guild",
  "herald",
  "holdings",
  "hospital",
  "hotel",
  "hotels",
  "inc",
  "industries",
  "institut",
  "institute",
  "institutes",
  "insurance",
  "international",
  "interstate",
  "investment",
  "investments",
  "investors",
  "journal",
  "laboratory",
  "labs",
  "llc",
  "ltd",
  "limited",
  "machines",
  "magazine",
  "management",
  "marine",
  "marketing",
  "markets",
  "media",
  "memorial",
  "ministere",
  "ministry",
  "military",
  "mobile",
  "motor",
  "motors",
  "musee",
  "museum",
  "news",
  "observatory",
  "office",
  "oil",
  "optical",
  "orchestra",
  "organization",
  "partners",
  "partnership",
  "petrol",
  "petroleum",
  "pharmacare",
  "pharmaceutical",
  "pharmaceuticals",
  "pizza",
  "plc",
  "police",
  "politburo",
  "polytechnic",
  "post",
  "power",
  "press",
  "productions",
  "quartet",
  "radio",
  "reserve",
  "resources",
  "restaurant",
  "restaurants",
  "savings",
  "school",
  "securities",
  "service",
  "services",
  "societe",
  "subsidiary",
  "society",
  "sons",
  // 'standard',
  "subcommittee",
  "syndicat",
  "systems",
  "telecommunications",
  "telegraph",
  "television",
  "times",
  "tribunal",
  "tv",
  "union",
  "university",
  "utilities",
  "workers"
].reduce((h2, str) => {
  h2[str] = true;
  return h2;
}, {});

// node_modules/compromise/src/2-two/preTagger/model/placeWords.js
var placeWords_default = [
  // geology
  "atoll",
  "basin",
  "bay",
  "beach",
  "bluff",
  "bog",
  "camp",
  "canyon",
  "canyons",
  "cape",
  "cave",
  "caves",
  // 'cliff',
  "cliffs",
  "coast",
  "cove",
  "coves",
  "crater",
  "crossing",
  "creek",
  "desert",
  "dune",
  "dunes",
  "downs",
  "estates",
  "escarpment",
  "estuary",
  "falls",
  "fjord",
  "fjords",
  "forest",
  "forests",
  "glacier",
  "gorge",
  "gorges",
  "grove",
  "gulf",
  "gully",
  "highland",
  "heights",
  "hollow",
  "hill",
  "hills",
  "inlet",
  "island",
  "islands",
  "isthmus",
  "junction",
  "knoll",
  "lagoon",
  "lake",
  "lakeshore",
  "marsh",
  "marshes",
  "mount",
  "mountain",
  "mountains",
  "narrows",
  "peninsula",
  "plains",
  "plateau",
  "pond",
  "rapids",
  "ravine",
  "reef",
  "reefs",
  "ridge",
  // 'river delta',
  "river",
  "rivers",
  "sandhill",
  "shoal",
  "shore",
  "shoreline",
  "shores",
  "strait",
  "straits",
  "springs",
  "stream",
  "swamp",
  "tombolo",
  "trail",
  "trails",
  "trench",
  "valley",
  "vallies",
  "village",
  "volcano",
  "waterfall",
  "watershed",
  "wetland",
  "woods",
  "acres",
  // districts
  "burough",
  "county",
  "district",
  "municipality",
  "prefecture",
  "province",
  "region",
  "reservation",
  "state",
  "territory",
  "borough",
  "metropolis",
  "downtown",
  "uptown",
  "midtown",
  "city",
  "town",
  "township",
  "hamlet",
  "country",
  "kingdom",
  "enclave",
  "neighbourhood",
  "neighborhood",
  "kingdom",
  "ward",
  "zone",
  // 'range',
  //building/ complex
  "airport",
  "amphitheater",
  "arch",
  "arena",
  "auditorium",
  "bar",
  "barn",
  "basilica",
  "battlefield",
  "bridge",
  "building",
  "castle",
  "centre",
  "coliseum",
  "cineplex",
  "complex",
  "dam",
  "farm",
  "field",
  "fort",
  "garden",
  "gardens",
  // 'grounds',
  "gymnasium",
  "hall",
  "house",
  "levee",
  "library",
  "manor",
  "memorial",
  "monument",
  "museum",
  "gallery",
  "palace",
  "pillar",
  "pits",
  // 'pit',
  // 'place',
  // 'point',
  // 'room',
  "plantation",
  "playhouse",
  "quarry",
  // 'ruins',
  "sportsfield",
  "sportsplex",
  "stadium",
  // 'statue',
  "terrace",
  "terraces",
  "theater",
  "tower",
  "park",
  "parks",
  "site",
  "ranch",
  "raceway",
  "sportsplex",
  // 'sports centre',
  // 'sports field',
  // 'soccer complex',
  // 'soccer centre',
  // 'sports complex',
  // 'civic centre',
  // roads
  "ave",
  "st",
  "street",
  "rd",
  "road",
  "lane",
  "landing",
  "crescent",
  "cr",
  "way",
  "tr",
  "terrace",
  "avenue"
].reduce((h2, str) => {
  h2[str] = true;
  return h2;
}, {});

// node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toSingular/_rules.js
var rules_default2 = [
  [/([^v])ies$/i, "$1y"],
  [/(ise)s$/i, "$1"],
  //promises
  [/(kn|[^o]l|w)ives$/i, "$1ife"],
  [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)ves$/i, "$1f"],
  [/^(dwar|handkerchie|hoo|scar|whar)ves$/i, "$1f"],
  [/(antenn|formul|nebul|vertebr|vit)ae$/i, "$1a"],
  [/(octop|vir|radi|nucle|fung|cact|stimul)(i)$/i, "$1us"],
  [/(buffal|tomat|tornad)(oes)$/i, "$1o"],
  [/(ause)s$/i, "$1"],
  //causes
  [/(ease)s$/i, "$1"],
  //diseases
  [/(ious)es$/i, "$1"],
  //geniouses
  [/(ouse)s$/i, "$1"],
  //houses
  [/(ose)s$/i, "$1"],
  //roses
  [/(..ase)s$/i, "$1"],
  [/(..[aeiu]s)es$/i, "$1"],
  [/(vert|ind|cort)(ices)$/i, "$1ex"],
  [/(matr|append)(ices)$/i, "$1ix"],
  [/([xo]|ch|ss|sh)es$/i, "$1"],
  [/men$/i, "man"],
  [/(n)ews$/i, "$1ews"],
  [/([ti])a$/i, "$1um"],
  [/([^aeiouy]|qu)ies$/i, "$1y"],
  [/(s)eries$/i, "$1eries"],
  [/(m)ovies$/i, "$1ovie"],
  [/(cris|ax|test)es$/i, "$1is"],
  [/(alias|status)es$/i, "$1"],
  [/(ss)$/i, "$1"],
  [/(ic)s$/i, "$1"],
  [/s$/i, ""]
];

// node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/toSingular/index.js
var invertObj = function(obj) {
  return Object.keys(obj).reduce((h2, k2) => {
    h2[obj[k2]] = k2;
    return h2;
  }, {});
};
var toSingular = function(str, model5) {
  const { irregularPlurals } = model5.two;
  const invert = invertObj(irregularPlurals);
  if (Object.hasOwn(invert, str)) {
    return invert[str];
  }
  for (let i3 = 0; i3 < rules_default2.length; i3++) {
    if (rules_default2[i3][0].test(str) === true) {
      str = str.replace(rules_default2[i3][0], rules_default2[i3][1]);
      return str;
    }
  }
  return str;
};
var toSingular_default = toSingular;

// node_modules/compromise/src/2-two/preTagger/methods/transform/nouns/index.js
var all = function(str, model5) {
  const arr = [str];
  const p5 = toPlural_default(str, model5);
  if (p5 !== str) {
    arr.push(p5);
  }
  const s3 = toSingular_default(str, model5);
  if (s3 !== str) {
    arr.push(s3);
  }
  return arr;
};
var nouns_default2 = { toPlural: toPlural_default, toSingular: toSingular_default, all };

// node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/getTense/_guess.js
var guessVerb = {
  Gerund: ["ing"],
  Actor: ["erer"],
  Infinitive: [
    "ate",
    "ize",
    "tion",
    "rify",
    "then",
    "ress",
    "ify",
    "age",
    "nce",
    "ect",
    "ise",
    "ine",
    "ish",
    "ace",
    "ash",
    "ure",
    "tch",
    "end",
    "ack",
    "and",
    "ute",
    "ade",
    "ock",
    "ite",
    "ase",
    "ose",
    "use",
    "ive",
    "int",
    "nge",
    "lay",
    "est",
    "ain",
    "ant",
    "ent",
    "eed",
    "er",
    "le",
    "unk",
    "ung",
    "upt",
    "en"
  ],
  PastTense: ["ept", "ed", "lt", "nt", "ew", "ld"],
  PresentTense: [
    "rks",
    "cks",
    "nks",
    "ngs",
    "mps",
    "tes",
    "zes",
    "ers",
    "les",
    "acks",
    "ends",
    "ands",
    "ocks",
    "lays",
    "eads",
    "lls",
    "els",
    "ils",
    "ows",
    "nds",
    "ays",
    "ams",
    "ars",
    "ops",
    "ffs",
    "als",
    "urs",
    "lds",
    "ews",
    "ips",
    "es",
    "ts",
    "ns"
  ],
  Participle: ["ken", "wn"]
};
guessVerb = Object.keys(guessVerb).reduce((h2, k2) => {
  guessVerb[k2].forEach((a2) => h2[a2] = k2);
  return h2;
}, {});
var guess_default = guessVerb;

// node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/getTense/index.js
var getTense = function(str) {
  const three = str.substring(str.length - 3);
  if (Object.hasOwn(guess_default, three) === true) {
    return guess_default[three];
  }
  const two = str.substring(str.length - 2);
  if (Object.hasOwn(guess_default, two) === true) {
    return guess_default[two];
  }
  const one = str.substring(str.length - 1);
  if (one === "s") {
    return "PresentTense";
  }
  return null;
};
var getTense_default = getTense;

// node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/toInfinitive/index.js
var toParts = function(str, model5) {
  let prefix5 = "";
  let prefixes2 = {};
  if (model5.one && model5.one.prefixes) {
    prefixes2 = model5.one.prefixes;
  }
  let [verb, particle] = str.split(/ /);
  if (particle && prefixes2[verb] === true) {
    prefix5 = verb;
    verb = particle;
    particle = "";
  }
  return {
    prefix: prefix5,
    verb,
    particle
  };
};
var copulaMap = {
  are: "be",
  were: "be",
  been: "be",
  is: "be",
  am: "be",
  was: "be",
  be: "be",
  being: "be"
};
var toInfinitive = function(str, model5, tense) {
  const { fromPast: fromPast2, fromPresent: fromPresent2, fromGerund: fromGerund2, fromParticiple: fromParticiple2 } = model5.two.models;
  const { prefix: prefix5, verb, particle } = toParts(str, model5);
  let inf = "";
  if (!tense) {
    tense = getTense_default(str);
  }
  if (Object.hasOwn(copulaMap, str)) {
    inf = copulaMap[str];
  } else if (tense === "Participle") {
    inf = convert_default(verb, fromParticiple2);
  } else if (tense === "PastTense") {
    inf = convert_default(verb, fromPast2);
  } else if (tense === "PresentTense") {
    inf = convert_default(verb, fromPresent2);
  } else if (tense === "Gerund") {
    inf = convert_default(verb, fromGerund2);
  } else {
    return str;
  }
  if (particle) {
    inf += " " + particle;
  }
  if (prefix5) {
    inf = prefix5 + " " + inf;
  }
  return inf;
};
var toInfinitive_default = toInfinitive;

// node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/conjugate/index.js
var parse3 = (inf) => {
  if (/ /.test(inf)) {
    return inf.split(/ /);
  }
  return [inf, ""];
};
var conjugate = function(inf, model5) {
  const { toPast: toPast4, toPresent: toPresent4, toGerund: toGerund4, toParticiple: toParticiple3 } = model5.two.models;
  if (inf === "be") {
    return {
      Infinitive: inf,
      Gerund: "being",
      PastTense: "was",
      Participle: "been",
      PresentTense: "is"
    };
  }
  const [str, particle] = parse3(inf);
  const found = {
    Infinitive: str,
    PastTense: convert_default(str, toPast4),
    PresentTense: convert_default(str, toPresent4),
    Gerund: convert_default(str, toGerund4),
    FutureTense: "will " + str
  };
  let pastPrt = convert_default(str, toParticiple3);
  if (pastPrt !== inf && pastPrt !== found.PastTense) {
    const lex = model5.one.lexicon || {};
    if (lex[pastPrt] === "Participle" || lex[pastPrt] === "Adjective") {
      if (inf === "play") {
        pastPrt = "played";
      }
      found.Participle = pastPrt;
    }
  }
  if (particle) {
    Object.keys(found).forEach((k2) => {
      found[k2] += " " + particle;
    });
  }
  return found;
};
var conjugate_default = conjugate;

// node_modules/compromise/src/2-two/preTagger/methods/transform/verbs/index.js
var all2 = function(str, model5) {
  const res = conjugate_default(str, model5);
  delete res.FutureTense;
  return Object.values(res).filter((s3) => s3);
};
var verbs_default = {
  toInfinitive: toInfinitive_default,
  conjugate: conjugate_default,
  all: all2
};

// node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/inflect.js
var toSuperlative2 = function(adj, model5) {
  const mod = model5.two.models.toSuperlative;
  return convert_default(adj, mod);
};
var toComparative2 = function(adj, model5) {
  const mod = model5.two.models.toComparative;
  return convert_default(adj, mod);
};
var fromComparative2 = function(adj, model5) {
  const mod = model5.two.models.fromComparative;
  return convert_default(adj, mod);
};
var fromSuperlative2 = function(adj, model5) {
  const mod = model5.two.models.fromSuperlative;
  return convert_default(adj, mod);
};
var toNoun = function(adj, model5) {
  const mod = model5.two.models.adjToNoun;
  return convert_default(adj, mod);
};

// node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/conjugate/lib.js
var suffixLoop = function(str = "", suffixes5 = []) {
  const len = str.length;
  const max3 = len <= 6 ? len - 1 : 6;
  for (let i3 = max3; i3 >= 1; i3 -= 1) {
    const suffix2 = str.substring(len - i3, str.length);
    if (Object.hasOwn(suffixes5[suffix2.length], suffix2) === true) {
      const pre = str.slice(0, len - i3);
      const post = suffixes5[suffix2.length][suffix2];
      return pre + post;
    }
  }
  return null;
};
var lib_default8 = suffixLoop;

// node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/conjugate/fromAdverb.js
var s2 = "ically";
var ical = /* @__PURE__ */ new Set([
  "analyt" + s2,
  //analytical
  "chem" + s2,
  // chemical
  "class" + s2,
  //classical
  "clin" + s2,
  // clinical
  "crit" + s2,
  // critical
  "ecolog" + s2,
  // ecological
  "electr" + s2,
  // electrical
  "empir" + s2,
  // empirical
  "frant" + s2,
  // frantical
  "grammat" + s2,
  // grammatical
  "ident" + s2,
  // identical
  "ideolog" + s2,
  // ideological
  "log" + s2,
  // logical
  "mag" + s2,
  //magical
  "mathemat" + s2,
  // mathematical
  "mechan" + s2,
  // mechanical
  "med" + s2,
  // medical
  "method" + s2,
  // methodical
  "method" + s2,
  // methodical
  "mus" + s2,
  // musical
  "phys" + s2,
  // physical
  "phys" + s2,
  // physical
  "polit" + s2,
  // political
  "pract" + s2,
  // practical
  "rad" + s2,
  //radical
  "satir" + s2,
  // satirical
  "statist" + s2,
  // statistical
  "techn" + s2,
  // technical
  "technolog" + s2,
  // technological
  "theoret" + s2,
  // theoretical
  "typ" + s2,
  // typical
  "vert" + s2,
  // vertical
  "whims" + s2
  // whimsical
]);
var suffixes2 = [
  null,
  {},
  { "ly": "" },
  {
    "ily": "y",
    "bly": "ble",
    "ply": "ple"
  },
  {
    "ally": "al",
    "rply": "rp"
  },
  {
    "ually": "ual",
    "ially": "ial",
    "cally": "cal",
    "eally": "eal",
    "rally": "ral",
    "nally": "nal",
    "mally": "mal",
    "eeply": "eep",
    "eaply": "eap"
  },
  {
    ically: "ic"
  }
];
var noAdj = /* @__PURE__ */ new Set([
  "early",
  "only",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "mostly",
  "duly",
  "unduly",
  "especially",
  "undoubtedly",
  "conversely",
  "namely",
  "exceedingly",
  "presumably",
  "accordingly",
  "overly",
  "best",
  "latter",
  "little",
  "long",
  "low"
]);
var exceptions = {
  wholly: "whole",
  fully: "full",
  truly: "true",
  gently: "gentle",
  singly: "single",
  customarily: "customary",
  idly: "idle",
  publically: "public",
  quickly: "quick",
  superbly: "superb",
  cynically: "cynical",
  well: "good"
  // -?
};
var toAdjective = function(str) {
  if (!str.endsWith("ly")) {
    return null;
  }
  if (ical.has(str)) {
    return str.replace(/ically/, "ical");
  }
  if (noAdj.has(str)) {
    return null;
  }
  if (Object.hasOwn(exceptions, str)) {
    return exceptions[str];
  }
  return lib_default8(str, suffixes2) || str;
};
var fromAdverb_default = toAdjective;

// node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/conjugate/toAdverb.js
var suffixes3 = [
  null,
  {
    y: "ily"
  },
  {
    ly: "ly",
    //unchanged
    ic: "ically"
  },
  {
    ial: "ially",
    ual: "ually",
    tle: "tly",
    ble: "bly",
    ple: "ply",
    ary: "arily"
  },
  {},
  {},
  {}
];
var exceptions2 = {
  cool: "cooly",
  whole: "wholly",
  full: "fully",
  good: "well",
  idle: "idly",
  public: "publicly",
  single: "singly",
  special: "especially"
};
var toAdverb = function(str) {
  if (Object.hasOwn(exceptions2, str)) {
    return exceptions2[str];
  }
  let adv = lib_default8(str, suffixes3);
  if (!adv) {
    adv = str + "ly";
  }
  return adv;
};
var toAdverb_default = toAdverb;

// node_modules/compromise/src/2-two/preTagger/methods/transform/adjectives/index.js
var all3 = function(str, model5) {
  let arr = [str];
  arr.push(toSuperlative2(str, model5));
  arr.push(toComparative2(str, model5));
  arr.push(toAdverb_default(str));
  arr = arr.filter((s3) => s3);
  arr = new Set(arr);
  return Array.from(arr);
};
var adjectives_default = {
  toSuperlative: toSuperlative2,
  toComparative: toComparative2,
  toAdverb: toAdverb_default,
  toNoun,
  fromAdverb: fromAdverb_default,
  fromSuperlative: fromSuperlative2,
  fromComparative: fromComparative2,
  all: all3
};

// node_modules/compromise/src/2-two/preTagger/methods/transform/index.js
var transform_default = {
  noun: nouns_default2,
  verb: verbs_default,
  adjective: adjectives_default
};

// node_modules/compromise/src/2-two/preTagger/methods/expand/byTag.js
var byTag_default = {
  // add plural forms of singular nouns
  Singular: (word, lex, methods19, model5) => {
    const already = model5.one.lexicon;
    const plural2 = methods19.two.transform.noun.toPlural(word, model5);
    if (!already[plural2]) {
      lex[plural2] ||= "Plural";
    }
  },
  // 'lawyer', 'manager' plural forms
  Actor: (word, lex, methods19, model5) => {
    const already = model5.one.lexicon;
    const plural2 = methods19.two.transform.noun.toPlural(word, model5);
    if (!already[plural2]) {
      lex[plural2] ||= ["Plural", "Actor"];
    }
  },
  // superlative/ comparative forms for adjectives
  Comparable: (word, lex, methods19, model5) => {
    const already = model5.one.lexicon;
    const { toSuperlative: toSuperlative3, toComparative: toComparative3 } = methods19.two.transform.adjective;
    const sup = toSuperlative3(word, model5);
    if (!already[sup]) {
      lex[sup] ||= "Superlative";
    }
    const comp = toComparative3(word, model5);
    if (!already[comp]) {
      lex[comp] ||= "Comparative";
    }
    lex[word] = "Adjective";
  },
  // 'german' -> 'germans'
  Demonym: (word, lex, methods19, model5) => {
    const plural2 = methods19.two.transform.noun.toPlural(word, model5);
    lex[plural2] ||= ["Demonym", "Plural"];
  },
  // conjugate all forms of these verbs
  Infinitive: (word, lex, methods19, model5) => {
    const already = model5.one.lexicon;
    const all4 = methods19.two.transform.verb.conjugate(word, model5);
    Object.entries(all4).forEach((a2) => {
      if (!already[a2[1]] && !lex[a2[1]] && a2[0] !== "FutureTense") {
        lex[a2[1]] = a2[0];
      }
    });
  },
  // 'walk up' should conjugate, too
  PhrasalVerb: (word, lex, methods19, model5) => {
    const already = model5.one.lexicon;
    lex[word] = ["PhrasalVerb", "Infinitive"];
    const _multi = model5.one._multiCache;
    const [inf, rest] = word.split(" ");
    if (!already[inf]) {
      lex[inf] ||= "Infinitive";
    }
    const all4 = methods19.two.transform.verb.conjugate(inf, model5);
    delete all4.FutureTense;
    Object.entries(all4).forEach((a2) => {
      if (a2[0] === "Actor" || a2[1] === "") {
        return;
      }
      if (!lex[a2[1]] && !already[a2[1]]) {
        lex[a2[1]] = a2[0];
      }
      _multi[a2[1]] = 2;
      const str = a2[1] + " " + rest;
      lex[str] ||= [a2[0], "PhrasalVerb"];
    });
  },
  // expand 'million'
  Multiple: (word, lex) => {
    lex[word] = ["Multiple", "Cardinal"];
    lex[word + "th"] = ["Multiple", "Ordinal"];
    lex[word + "ths"] = ["Multiple", "Fraction"];
  },
  // expand number-words
  Cardinal: (word, lex) => {
    lex[word] = ["TextValue", "Cardinal"];
  },
  // 'millionth'
  Ordinal: (word, lex) => {
    lex[word] = ["TextValue", "Ordinal"];
    lex[word + "s"] = ["TextValue", "Fraction"];
  },
  // 'thames'
  Place: (word, lex) => {
    lex[word] = ["Place", "ProperNoun"];
  },
  // 'ontario'
  Region: (word, lex) => {
    lex[word] = ["Region", "ProperNoun"];
  }
};

// node_modules/compromise/src/2-two/preTagger/methods/expand/index.js
var expand3 = function(words, world2) {
  const { methods: methods19, model: model5 } = world2;
  const lex = {};
  const _multi = {};
  Object.keys(words).forEach((word) => {
    const tag = words[word];
    word = word.toLowerCase().trim();
    word = word.replace(/'s\b/, "");
    const split3 = word.split(/ /);
    if (split3.length > 1) {
      if (_multi[split3[0]] === void 0 || split3.length > _multi[split3[0]]) {
        _multi[split3[0]] = split3.length;
      }
    }
    if (Object.hasOwn(byTag_default, tag) === true) {
      byTag_default[tag](word, lex, methods19, model5);
    }
    lex[word] ||= tag;
  });
  delete lex[""];
  delete lex[null];
  delete lex[" "];
  return { lex, _multi };
};
var expand_default2 = expand3;

// node_modules/compromise/src/2-two/preTagger/methods/quickSplit.js
var splitOn = function(terms, i3) {
  const isNum = /^[0-9]+$/;
  const term = terms[i3];
  if (!term) {
    return false;
  }
  const maybeDate = /* @__PURE__ */ new Set(["may", "april", "august", "jan"]);
  if (term.normal === "like" || maybeDate.has(term.normal)) {
    return false;
  }
  if (term.tags.has("Place") || term.tags.has("Date")) {
    return false;
  }
  if (terms[i3 - 1]) {
    const lastTerm = terms[i3 - 1];
    if (lastTerm.tags.has("Date") || maybeDate.has(lastTerm.normal)) {
      return false;
    }
    if (lastTerm.tags.has("Adjective") || term.tags.has("Adjective")) {
      return false;
    }
  }
  const str = term.normal;
  if (str.length === 1 || str.length === 2 || str.length === 4) {
    if (isNum.test(str)) {
      return false;
    }
  }
  return true;
};
var quickSplit = function(document) {
  const splitHere = /[,:;]/;
  const arr = [];
  document.forEach((terms) => {
    let start2 = 0;
    terms.forEach((term, i3) => {
      if (splitHere.test(term.post) && splitOn(terms, i3 + 1)) {
        arr.push(terms.slice(start2, i3 + 1));
        start2 = i3 + 1;
      }
    });
    if (start2 < terms.length) {
      arr.push(terms.slice(start2, terms.length));
    }
  });
  return arr;
};
var quickSplit_default = quickSplit;

// node_modules/compromise/src/2-two/preTagger/methods/looksPlural.js
var isPlural = {
  e: ["mice", "louse", "antennae", "formulae", "nebulae", "vertebrae", "vitae"],
  i: ["tia", "octopi", "viri", "radii", "nuclei", "fungi", "cacti", "stimuli"],
  n: ["men"],
  t: ["feet"]
};
var exceptions3 = /* @__PURE__ */ new Set([
  // 'formulas',
  // 'umbrellas',
  // 'gorillas',
  // 'koalas',
  "israelis",
  "menus",
  "logos"
]);
var notPlural = [
  "bus",
  "mas",
  //christmas
  "was",
  // 'las',
  "ias",
  //alias
  "xas",
  "vas",
  "cis",
  //probocis
  "lis",
  "nis",
  //tennis
  "ois",
  "ris",
  "sis",
  //thesis
  "tis",
  //mantis, testis
  "xis",
  "aus",
  "cus",
  "eus",
  //nucleus
  "fus",
  //doofus
  "gus",
  //fungus
  "ius",
  //radius
  "lus",
  //stimulus
  "nus",
  "das",
  "ous",
  "pus",
  //octopus
  "rus",
  //virus
  "sus",
  //census
  "tus",
  //status,cactus
  "xus",
  "aos",
  //chaos
  "igos",
  "ados",
  //barbados
  "ogos",
  "'s",
  "ss"
];
var looksPlural = function(str) {
  if (!str || str.length <= 3) {
    return false;
  }
  if (exceptions3.has(str)) {
    return true;
  }
  const end2 = str[str.length - 1];
  if (Object.hasOwn(isPlural, end2)) {
    return isPlural[end2].find((suff) => str.endsWith(suff));
  }
  if (end2 !== "s") {
    return false;
  }
  if (notPlural.find((suff) => str.endsWith(suff))) {
    return false;
  }
  return true;
};
var looksPlural_default = looksPlural;

// node_modules/compromise/src/2-two/preTagger/methods/index.js
var methods_default9 = {
  two: {
    quickSplit: quickSplit_default,
    expandLexicon: expand_default2,
    transform: transform_default,
    looksPlural: looksPlural_default
  }
};

// node_modules/compromise/src/2-two/preTagger/model/_expand/irregulars.js
var expandIrregulars = function(model5) {
  const { irregularPlurals } = model5.two;
  const { lexicon: lexicon4 } = model5.one;
  Object.entries(irregularPlurals).forEach((a2) => {
    lexicon4[a2[0]] ||= "Singular";
    lexicon4[a2[1]] ||= "Plural";
  });
  return model5;
};
var irregulars_default = expandIrregulars;

// node_modules/compromise/src/2-two/preTagger/model/_expand/index.js
var tmpModel2 = {
  one: { lexicon: {} },
  two: { models: models_default }
};
var switchDefaults = {
  // 'pilot'
  "Actor|Verb": "Actor",
  //
  // 'amusing'
  "Adj|Gerund": "Adjective",
  //+conjugations
  // 'standard'
  "Adj|Noun": "Adjective",
  // 'boiled'
  "Adj|Past": "Adjective",
  //+conjugations
  // 'smooth'
  "Adj|Present": "Adjective",
  //+conjugations
  // 'box'
  "Noun|Verb": "Singular",
  //+conjugations (no-present)
  //'singing'
  "Noun|Gerund": "Gerund",
  //+conjugations
  // 'hope'
  "Person|Noun": "Noun",
  // 'April'
  "Person|Date": "Month",
  // 'rob'
  "Person|Verb": "FirstName",
  //+conjugations
  // 'victoria'
  "Person|Place": "Person",
  // 'rusty'
  "Person|Adj": "Comparable",
  // 'boxes'
  "Plural|Verb": "Plural",
  //(these are already derivative)
  // 'miles'
  "Unit|Noun": "Noun"
};
var expandLexicon = function(words, model5) {
  const world2 = { model: model5, methods: methods_default9 };
  const { lex, _multi } = methods_default9.two.expandLexicon(words, world2);
  Object.assign(model5.one.lexicon, lex);
  Object.assign(model5.one._multiCache, _multi);
  return model5;
};
var addUncountables = function(words, model5) {
  Object.keys(words).forEach((k2) => {
    if (words[k2] === "Uncountable") {
      model5.two.uncountable[k2] = true;
      words[k2] = "Uncountable";
    }
  });
  return model5;
};
var expandVerb = function(str, words, doPresent) {
  const obj = conjugate_default(str, tmpModel2);
  words[obj.PastTense] ||= "PastTense";
  words[obj.Gerund] ||= "Gerund";
  if (doPresent === true) {
    words[obj.PresentTense] ||= "PresentTense";
  }
};
var expandAdjective = function(str, words, model5) {
  const sup = toSuperlative2(str, model5);
  words[sup] ||= "Superlative";
  const comp = toComparative2(str, model5);
  words[comp] ||= "Comparative";
};
var expandNoun = function(str, words, model5) {
  const plur = toPlural_default(str, model5);
  words[plur] ||= "Plural";
};
var expandVariable = function(switchWords, model5) {
  const words = {};
  const lex = model5.one.lexicon;
  Object.keys(switchWords).forEach((w) => {
    const name = switchWords[w];
    words[w] = switchDefaults[name];
    if (name === "Noun|Verb" || name === "Person|Verb" || name === "Actor|Verb") {
      expandVerb(w, lex, false);
    }
    if (name === "Adj|Present") {
      expandVerb(w, lex, true);
      expandAdjective(w, lex, model5);
    }
    if (name === "Person|Adj") {
      expandAdjective(w, lex, model5);
    }
    if (name === "Adj|Gerund" || name === "Noun|Gerund") {
      const inf = toInfinitive_default(w, tmpModel2, "Gerund");
      if (!lex[inf]) {
        words[inf] = "Infinitive";
      }
    }
    if (name === "Noun|Gerund" || name === "Adj|Noun" || name === "Person|Noun") {
      expandNoun(w, lex, model5);
    }
    if (name === "Adj|Past") {
      const inf = toInfinitive_default(w, tmpModel2, "PastTense");
      if (inf !== w && !lex[inf]) {
        words[inf] = "Infinitive";
      }
    }
  });
  model5 = expandLexicon(words, model5);
  return model5;
};
var expand4 = function(model5) {
  model5 = expandLexicon(model5.one.lexicon, model5);
  model5 = addUncountables(model5.one.lexicon, model5);
  model5 = expandVariable(model5.two.switches, model5);
  model5 = irregulars_default(model5);
  return model5;
};
var expand_default3 = expand4;

// node_modules/compromise/src/2-two/preTagger/model/index.js
var model4 = {
  one: {
    _multiCache: {},
    lexicon: lexicon3,
    frozenLex: frozenLex_default
  },
  two: {
    irregularPlurals: plurals_default,
    models: models_default,
    suffixPatterns: suffixes_default2,
    prefixPatterns: prefixes_default2,
    endsWith: endsWith_default,
    neighbours: neighbours_default,
    regexNormal: regex_normal_default,
    regexText: regex_text_default,
    regexNumbers: regex_numbers_default,
    switches,
    clues: clues_default,
    uncountable: {},
    orgWords: orgWords_default,
    placeWords: placeWords_default
  }
};
model4 = expand_default3(model4);
var model_default3 = model4;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/1st-pass/01-colons.js
var byPunctuation = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  if (i3 === 0 && terms.length >= 3) {
    const hasColon = /:/;
    const post = terms[0].post;
    if (hasColon.test(post)) {
      const nextTerm = terms[1];
      if (nextTerm.tags.has("Value") || nextTerm.tags.has("Email") || nextTerm.tags.has("PhoneNumber")) {
        return;
      }
      setTag2([terms[0]], "Expression", world2, null, `2-punct-colon''`);
    }
  }
};
var colons_default = byPunctuation;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/1st-pass/02-hyphens.js
var byHyphen = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  if (terms[i3].post === "-" && terms[i3 + 1]) {
    setTag2([terms[i3], terms[i3 + 1]], "Hyphenated", world2, null, `1-punct-hyphen''`);
  }
};
var hyphens_default = byHyphen;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/00-tagSwitch.js
var prefix3 = /^(under|over|mis|re|un|dis|semi)-?/;
var tagSwitch = function(terms, i3, model5) {
  const switches2 = model5.two.switches;
  const term = terms[i3];
  if (Object.hasOwn(switches2, term.normal)) {
    term.switch = switches2[term.normal];
    return;
  }
  if (prefix3.test(term.normal)) {
    const stem = term.normal.replace(prefix3, "");
    if (stem.length > 3 && Object.hasOwn(switches2, stem)) {
      term.switch = switches2[stem];
    }
  }
};
var tagSwitch_default = tagSwitch;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/_fastTag.js
var log2 = (term, tag, reason2 = "") => {
  const yellow = (str) => "\x1B[33m\x1B[3m" + str + "\x1B[0m";
  const i3 = (str) => "\x1B[3m" + str + "\x1B[0m";
  const word = term.text || "[" + term.implicit + "]";
  if (typeof tag !== "string" && tag.length > 2) {
    tag = tag.slice(0, 2).join(", #") + " +";
  }
  tag = typeof tag !== "string" ? tag.join(", #") : tag;
  console.log(` ${yellow(word).padEnd(24)} \x1B[32m\u2192\x1B[0m #${tag.padEnd(22)}  ${i3(reason2)}`);
};
var fastTag = function(term, tag, reason2) {
  if (!tag || tag.length === 0) {
    return;
  }
  if (term.frozen === true) {
    return;
  }
  if (debug_default.tags) {
    log2(term, tag, reason2);
  }
  term.tags ||= /* @__PURE__ */ new Set();
  if (typeof tag === "string") {
    term.tags.add(tag);
  } else {
    tag.forEach((tg) => term.tags.add(tg));
  }
};
var fastTag_default = fastTag;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/_fillTags.js
var uncountable = [
  "Acronym",
  "Abbreviation",
  "ProperNoun",
  "Uncountable",
  "Possessive",
  "Pronoun",
  "Activity",
  "Honorific",
  "Month"
];
var setPluralSingular = function(term) {
  if (!term.tags.has("Noun") || term.tags.has("Plural") || term.tags.has("Singular")) {
    return;
  }
  if (uncountable.find((tag) => term.tags.has(tag))) {
    return;
  }
  if (looksPlural_default(term.normal)) {
    fastTag_default(term, "Plural", "3-plural-guess");
  } else {
    fastTag_default(term, "Singular", "3-singular-guess");
  }
};
var setTense = function(term) {
  const tags2 = term.tags;
  if (tags2.has("Verb") && tags2.size === 1) {
    const guess = getTense_default(term.normal);
    if (guess) {
      fastTag_default(term, guess, "3-verb-tense-guess");
      if (guess === "Infinitive" || guess === "Gerund") {
        fastTag_default(term, "PresentTense", "3-verb-tense-guess");
      }
    }
  }
};
var fillTags = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.frozen === true) {
    return;
  }
  let remaining = term.tags.size;
  for (const tag of term.tags) {
    if (remaining === 0) {
      break;
    }
    remaining -= 1;
    const parents = model5.one.tagSet[tag]?.parents;
    if (parents) {
      if (debug_default.tags) {
        fastTag_default(term, parents, ` -inferred by #${tag}`);
      } else {
        for (let k2 = 0; k2 < parents.length; k2 += 1) {
          if (!term.tags.has(parents[k2])) {
            term.tags.add(parents[k2]);
          }
        }
      }
    }
  }
  setPluralSingular(term);
  setTense(term, model5);
};
var fillTags_default = fillTags;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/01-case.js
var titleCase2 = /^\p{Lu}[\p{Ll}'’]/u;
var hasNumber = /[0-9]/;
var notProper = ["Date", "Month", "WeekDay", "Unit", "Expression"];
var hasIVX = /[IVX]/;
var romanNumeral = /^[IVXLCDM]{2,}$/;
var romanNumValid = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
var nope = {
  li: true,
  dc: true,
  md: true,
  dm: true,
  ml: true
};
var checkCase = function(terms, i3, model5) {
  const term = terms[i3];
  term.index ||= [0, 0];
  const index3 = term.index[1];
  const str = term.text || "";
  if (index3 !== 0 && titleCase2.test(str) === true && hasNumber.test(str) === false) {
    if (notProper.find((tag) => term.tags.has(tag))) {
      return null;
    }
    if (i3 === 0 && term.tags.has("Gerund") && terms[i3 + 1]?.tags.has("Determiner")) {
      return null;
    }
    if (/["']$/.test(term.pre)) {
      return null;
    }
    if (term.normal === "the") {
      return null;
    }
    fillTags_default(terms, i3, model5);
    if (!term.tags.has("Noun") && !term.frozen) {
      term.tags.clear();
    }
    fastTag_default(term, "ProperNoun", "2-titlecase");
    return true;
  }
  if (str.length >= 2 && romanNumeral.test(str) && hasIVX.test(str) && romanNumValid.test(str) && !nope[term.normal]) {
    fastTag_default(term, "RomanNumeral", "2-xvii");
    return true;
  }
  return null;
};
var case_default2 = checkCase;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/02-suffix.js
var suffixLoop2 = function(str = "", suffixes5 = []) {
  const len = str.length;
  let max3 = 7;
  if (len <= max3) {
    max3 = len - 1;
  }
  for (let i3 = max3; i3 > 1; i3 -= 1) {
    const suffix2 = str.substring(len - i3, len);
    if (Object.hasOwn(suffixes5[suffix2.length], suffix2) === true) {
      const tag = suffixes5[suffix2.length][suffix2];
      return tag;
    }
  }
  return null;
};
var tagBySuffix = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.tags.size === 0) {
    let tag = suffixLoop2(term.normal, model5.two.suffixPatterns);
    if (tag !== null) {
      fastTag_default(term, tag, "2-suffix");
      term.confidence = 0.7;
      return true;
    }
    if (term.implicit) {
      tag = suffixLoop2(term.implicit, model5.two.suffixPatterns);
      if (tag !== null) {
        fastTag_default(term, tag, "2-implicit-suffix");
        term.confidence = 0.7;
        return true;
      }
    }
  }
  return null;
};
var suffix_default = tagBySuffix;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/03-regex.js
var hasApostrophe = /['‘’‛‵′`´]/;
var doRegs = function(str, regs) {
  for (let i3 = 0; i3 < regs.length; i3 += 1) {
    if (regs[i3][0].test(str) === true) {
      return regs[i3];
    }
  }
  return null;
};
var doEndsWith = function(str = "", byEnd3) {
  const char = str[str.length - 1];
  if (Object.hasOwn(byEnd3, char) === true) {
    const regs = byEnd3[char] || [];
    for (let r2 = 0; r2 < regs.length; r2 += 1) {
      if (regs[r2][0].test(str) === true) {
        return regs[r2];
      }
    }
  }
  return null;
};
var checkRegex = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  const { regexText, regexNormal, regexNumbers, endsWith } = model5.two;
  const term = terms[i3];
  const normal = term.machine || term.normal;
  let text6 = term.implicit || term.text;
  if (hasApostrophe.test(term.post) && !hasApostrophe.test(term.pre)) {
    text6 += term.post.trim();
  }
  let arr = doRegs(text6, regexText) || doRegs(normal, regexNormal);
  if (!arr && term.tags.size === 0 && normal !== term.normal) {
    arr = doRegs(term.normal, regexNormal);
  }
  if (!arr && /[0-9]/.test(normal)) {
    arr = doRegs(normal, regexNumbers);
  }
  if (!arr && term.tags.size === 0) {
    arr = doEndsWith(normal, endsWith);
  }
  if (arr) {
    setTag2([term], arr[1], world2, null, `2-regex-'${arr[2] || arr[0]}'`);
    term.confidence = 0.6;
    return true;
  }
  return null;
};
var regex_default = checkRegex;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/04-prefix.js
var prefixLoop = function(str = "", prefixes2 = []) {
  const len = str.length;
  let max3 = 7;
  if (max3 > len - 3) {
    max3 = len - 3;
  }
  for (let i3 = max3; i3 > 2; i3 -= 1) {
    const prefix5 = str.substring(0, i3);
    if (Object.hasOwn(prefixes2[prefix5.length], prefix5) === true) {
      const tag = prefixes2[prefix5.length][prefix5];
      return tag;
    }
  }
  return null;
};
var checkPrefix = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.tags.size === 0) {
    const tag = prefixLoop(term.normal, model5.two.prefixPatterns);
    if (tag !== null) {
      fastTag_default(term, tag, "2-prefix");
      term.confidence = 0.5;
      return true;
    }
  }
  return null;
};
var prefix_default = checkPrefix;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/2nd-pass/05-year.js
var min = 1400;
var max2 = 2100;
var dateWords = /* @__PURE__ */ new Set([
  "in",
  "on",
  "by",
  "until",
  "for",
  "to",
  "during",
  "throughout",
  "through",
  "within",
  "before",
  "after",
  "of",
  "this",
  "next",
  "last",
  "circa",
  "around",
  "post",
  "pre",
  "budget",
  "classic",
  "plan",
  "may"
]);
var seemsGood = function(term) {
  if (!term) {
    return false;
  }
  const str = term.normal || term.implicit;
  if (dateWords.has(str)) {
    return true;
  }
  if (term.tags.has("Date") || term.tags.has("Month") || term.tags.has("WeekDay") || term.tags.has("Year")) {
    return true;
  }
  if (term.tags.has("ProperNoun")) {
    return true;
  }
  return false;
};
var seemsOkay = function(term) {
  if (!term) {
    return false;
  }
  if (term.tags.has("Ordinal")) {
    return true;
  }
  if (term.tags.has("Cardinal") && term.normal.length < 3) {
    return true;
  }
  if (term.normal === "is" || term.normal === "was") {
    return true;
  }
  return false;
};
var seemsFine = function(term) {
  return term && (term.tags.has("Date") || term.tags.has("Month") || term.tags.has("WeekDay") || term.tags.has("Year"));
};
var tagYear = function(terms, i3) {
  const term = terms[i3];
  if (term.tags.has("NumericValue") && term.tags.has("Cardinal") && term.normal.length === 4) {
    const num = Number(term.normal);
    if (num && !isNaN(num)) {
      if (num > min && num < max2) {
        const lastTerm = terms[i3 - 1];
        const nextTerm = terms[i3 + 1];
        if (seemsGood(lastTerm) || seemsGood(nextTerm)) {
          return fastTag_default(term, "Year", "2-tagYear");
        }
        if (num >= 1920 && num < 2025) {
          if (seemsOkay(lastTerm) || seemsOkay(nextTerm)) {
            return fastTag_default(term, "Year", "2-tagYear-close");
          }
          if (seemsFine(terms[i3 - 2]) || seemsFine(terms[i3 + 2])) {
            return fastTag_default(term, "Year", "2-tagYear-far");
          }
          if (lastTerm && (lastTerm.tags.has("Determiner") || lastTerm.tags.has("Possessive"))) {
            if (nextTerm && nextTerm.tags.has("Noun") && !nextTerm.tags.has("Plural")) {
              return fastTag_default(term, "Year", "2-tagYear-noun");
            }
          }
        }
      }
    }
  }
  return null;
};
var year_default = tagYear;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/07-verb-type.js
var verbType = function(terms, i3, model5, world2) {
  const setTag2 = world2.methods.one.setTag;
  const term = terms[i3];
  const types = ["PastTense", "PresentTense", "Auxiliary", "Modal", "Particle"];
  if (term.tags.has("Verb")) {
    const type = types.find((typ) => term.tags.has(typ));
    if (!type) {
      setTag2([term], "Infinitive", world2, null, `2-verb-type''`);
    }
  }
};
var verb_type_default = verbType;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/01-acronym.js
var oneLetterAcronym2 = /^[A-Z]('s|,)?$/;
var isUpperCase = /^[A-Z-]+$/;
var upperThenS = /^[A-Z]+s$/;
var periodAcronym2 = /^([A-Z]\.)+[A-Z]?,?$/;
var noPeriodAcronym2 = /^[A-Z]{2,}('s|,)?$/;
var lowerCaseAcronym2 = /^([a-z]\.)+[a-z]\.?$/;
var oneLetterWord = {
  I: true,
  A: true
};
var places = {
  la: true,
  ny: true,
  us: true,
  dc: true,
  gb: true,
  uk: true
};
var isNoPeriodAcronym = function(term, model5) {
  let str = term.text;
  if (isUpperCase.test(str) === false) {
    if (str.length > 3 && upperThenS.test(str) === true) {
      str = str.replace(/s$/, "");
    } else {
      return false;
    }
  } else if (Object.hasOwn(places, term.normal) === true) {
    return true;
  }
  if (str.length > 5) {
    return false;
  }
  if (Object.hasOwn(oneLetterWord, str)) {
    return false;
  }
  if (Object.hasOwn(model5.one.lexicon, term.normal)) {
    return false;
  }
  if (periodAcronym2.test(str) === true) {
    return true;
  }
  if (lowerCaseAcronym2.test(str) === true) {
    return true;
  }
  if (oneLetterAcronym2.test(str) === true) {
    return true;
  }
  if (noPeriodAcronym2.test(str) === true) {
    return true;
  }
  return false;
};
var isAcronym3 = function(terms, i3, model5) {
  const term = terms[i3];
  if (term.tags.has("RomanNumeral") || term.tags.has("Acronym") || term.frozen) {
    return null;
  }
  if (isNoPeriodAcronym(term, model5)) {
    term.tags.clear();
    fastTag_default(term, ["Acronym", "Noun"], "3-no-period-acronym");
    if (places[term.normal] === true) {
      fastTag_default(term, "Place", "3-place-acronym");
    }
    if (upperThenS.test(term.text) === true) {
      fastTag_default(term, "Plural", "3-plural-acronym");
    }
    return true;
  }
  if (!Object.hasOwn(oneLetterWord, term.text) && oneLetterAcronym2.test(term.text)) {
    term.tags.clear();
    fastTag_default(term, ["Acronym", "Noun"], "3-one-letter-acronym");
    return true;
  }
  if (term.tags.has("Organization") && term.text.length <= 3) {
    fastTag_default(term, "Acronym", "3-org-acronym");
    return true;
  }
  if (term.tags.has("Organization") && isUpperCase.test(term.text) && term.text.length <= 6) {
    fastTag_default(term, "Acronym", "3-titlecase-acronym");
    return true;
  }
  return null;
};
var acronym_default = isAcronym3;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/02-neighbours.js
var lookAtWord = function(term, words) {
  if (!term) {
    return null;
  }
  const found = words.find((a2) => term.normal === a2[0]);
  if (found) {
    return found[1];
  }
  return null;
};
var lookAtTag = function(term, tags2) {
  if (!term) {
    return null;
  }
  const found = tags2.find((a2) => term.tags.has(a2[0]));
  if (found) {
    return found[1];
  }
  return null;
};
var neighbours = function(terms, i3, model5) {
  const { leftTags, leftWords, rightWords, rightTags } = model5.two.neighbours;
  const term = terms[i3];
  if (term.tags.size === 0) {
    let tag = null;
    tag ||= lookAtWord(terms[i3 - 1], leftWords);
    tag ||= lookAtWord(terms[i3 + 1], rightWords);
    tag ||= lookAtTag(terms[i3 - 1], leftTags);
    tag ||= lookAtTag(terms[i3 + 1], rightTags);
    if (tag) {
      fastTag_default(term, tag, "3-[neighbour]");
      fillTags_default(terms, i3, model5);
      terms[i3].confidence = 0.2;
      return true;
    }
  }
  return null;
};
var neighbours_default2 = neighbours;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/03-orgWords.js
var isTitleCase3 = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str);
var isOrg = function(term, i3, yelling) {
  if (!term) {
    return false;
  }
  if (term.tags.has("FirstName") || term.tags.has("Place")) {
    return false;
  }
  if (term.tags.has("ProperNoun") || term.tags.has("Organization") || term.tags.has("Acronym")) {
    return true;
  }
  if (!yelling && isTitleCase3(term.text)) {
    if (i3 === 0) {
      return term.tags.has("Singular");
    }
    return true;
  }
  return false;
};
var tagOrgs = function(terms, i3, world2, yelling) {
  const orgWords = world2.model.two.orgWords;
  const setTag2 = world2.methods.one.setTag;
  const term = terms[i3];
  const str = term.machine || term.normal;
  if (orgWords[str] === true && isOrg(terms[i3 - 1], i3 - 1, yelling)) {
    setTag2([terms[i3]], "Organization", world2, null, "3-[org-word]");
    for (let t3 = i3; t3 >= 0; t3 -= 1) {
      if (isOrg(terms[t3], t3, yelling)) {
        setTag2([terms[t3]], "Organization", world2, null, "3-[org-word]");
      } else {
        break;
      }
    }
  }
  return null;
};
var orgWords_default2 = tagOrgs;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/04-placeWords.js
var isTitleCase4 = (str) => /^\p{Lu}[\p{Ll}'’]/u.test(str);
var isPossessive = /'s$/;
var placeCont = /* @__PURE__ */ new Set([
  "athletic",
  "city",
  "community",
  "eastern",
  "federal",
  "financial",
  "great",
  "historic",
  "historical",
  "local",
  "memorial",
  "municipal",
  "national",
  "northern",
  "provincial",
  "southern",
  "state",
  "western",
  "spring",
  "pine",
  "sunset",
  "view",
  "oak",
  "maple",
  "spruce",
  "cedar",
  "willow"
]);
var noBefore = /* @__PURE__ */ new Set(["center", "centre", "way", "range", "bar", "bridge", "field", "pit"]);
var isPlace = function(term, i3, yelling) {
  if (!term) {
    return false;
  }
  const tags2 = term.tags;
  if (tags2.has("Organization") || tags2.has("Possessive") || isPossessive.test(term.normal)) {
    return false;
  }
  if (tags2.has("ProperNoun") || tags2.has("Place")) {
    return true;
  }
  if (!yelling && isTitleCase4(term.text)) {
    if (i3 === 0) {
      return tags2.has("Singular");
    }
    return true;
  }
  return false;
};
var tagOrgs2 = function(terms, i3, world2, yelling) {
  const placeWords = world2.model.two.placeWords;
  const setTag2 = world2.methods.one.setTag;
  const term = terms[i3];
  const str = term.machine || term.normal;
  if (placeWords[str] === true) {
    for (let n3 = i3 - 1; n3 >= 0; n3 -= 1) {
      if (placeCont.has(terms[n3].normal)) {
        continue;
      }
      if (isPlace(terms[n3], n3, yelling)) {
        setTag2(terms.slice(n3, i3 + 1), "Place", world2, null, "3-[place-of-foo]");
        continue;
      }
      break;
    }
    if (noBefore.has(str)) {
      return false;
    }
    for (let n3 = i3 + 1; n3 < terms.length; n3 += 1) {
      if (isPlace(terms[n3], n3, yelling)) {
        setTag2(terms.slice(i3, n3 + 1), "Place", world2, null, "3-[foo-place]");
        return true;
      }
      if (terms[n3].normal === "of" || placeCont.has(terms[n3].normal)) {
        continue;
      }
      break;
    }
  }
  return null;
};
var placeWords_default2 = tagOrgs2;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/05-fallback.js
var nounFallback = function(terms, i3, model5) {
  let isEmpty = false;
  const tags2 = terms[i3].tags;
  if (tags2.size === 0) {
    isEmpty = true;
  } else if (tags2.size === 1) {
    if (tags2.has("Hyphenated") || tags2.has("HashTag") || tags2.has("Prefix") || tags2.has("SlashedTerm")) {
      isEmpty = true;
    }
  }
  if (isEmpty) {
    fastTag_default(terms[i3], "Noun", "3-[fallback]");
    fillTags_default(terms, i3, model5);
    terms[i3].confidence = 0.1;
  }
};
var fallback_default = nounFallback;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/_adhoc.js
var isTitleCase5 = /^[A-Z][a-z]/;
var isCapital = (terms, i3) => {
  if (terms[i3].tags.has("ProperNoun") && isTitleCase5.test(terms[i3].text)) {
    return "Noun";
  }
  return null;
};
var isAlone = (terms, i3, tag) => {
  if (i3 === 0 && !terms[1]) {
    return tag;
  }
  return null;
};
var isEndNoun = function(terms, i3) {
  if (!terms[i3 + 1] && terms[i3 - 1] && terms[i3 - 1].tags.has("Determiner")) {
    return "Noun";
  }
  return null;
};
var isStart = function(terms, i3, tag) {
  if (i3 === 0 && terms.length > 3) {
    return tag;
  }
  return null;
};
var adhoc = {
  "Adj|Gerund": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Adj|Noun": (terms, i3) => {
    return isCapital(terms, i3) || isEndNoun(terms, i3);
  },
  "Actor|Verb": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Adj|Past": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Adj|Present": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Noun|Gerund": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Noun|Verb": (terms, i3) => {
    return i3 > 0 && isCapital(terms, i3) || isAlone(terms, i3, "Infinitive");
  },
  "Plural|Verb": (terms, i3) => {
    return isCapital(terms, i3) || isAlone(terms, i3, "PresentTense") || isStart(terms, i3, "Plural");
  },
  "Person|Noun": (terms, i3) => {
    return isCapital(terms, i3);
  },
  "Person|Verb": (terms, i3) => {
    if (i3 !== 0) {
      return isCapital(terms, i3);
    }
    return null;
  },
  "Person|Adj": (terms, i3) => {
    if (i3 === 0 && terms.length > 1) {
      return "Person";
    }
    return isCapital(terms, i3) ? "Person" : null;
  }
};
var adhoc_default = adhoc;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/06-switches.js
var prefix4 = /^(under|over|mis|re|un|dis|semi)-?/;
var checkWord = (term, obj) => {
  if (!term || !obj) {
    return null;
  }
  const str = term.normal || term.implicit;
  let found = null;
  if (Object.hasOwn(obj, str)) {
    found = obj[str];
  }
  if (found && debug_default.tags) {
    console.log(`
  \x1B[2m\x1B[3m     \u2193 - '${str}' \x1B[0m`);
  }
  return found;
};
var checkTag = (term, obj = {}, tagSet) => {
  if (!term || !obj) {
    return null;
  }
  let found;
  let best = -1;
  for (const tag of term.tags) {
    if (obj[tag]) {
      const rank = tagSet[tag] ? tagSet[tag].parents.length : 0;
      if (rank > best) {
        found = tag;
        best = rank;
      }
    }
  }
  if (found && debug_default.tags) {
    console.log(`  \x1B[2m\x1B[3m      \u2193 - '${term.normal || term.implicit}' (#${found})  \x1B[0m`);
  }
  found = obj[found];
  return found;
};
var pickTag = function(terms, i3, clues5, model5) {
  if (!clues5) {
    return null;
  }
  let beforeIndex = i3 - 1;
  const previousTerm = terms[beforeIndex];
  if (previousTerm && previousTerm.text === "also") {
    beforeIndex = Math.max(0, i3 - 2);
  }
  const tagSet = model5.one.tagSet;
  let tag = checkWord(terms[i3 + 1], clues5.afterWords);
  tag ||= checkWord(terms[beforeIndex], clues5.beforeWords);
  tag ||= checkTag(terms[beforeIndex], clues5.beforeTags, tagSet);
  tag ||= checkTag(terms[i3 + 1], clues5.afterTags, tagSet);
  return tag;
};
var doSwitches = function(terms, i3, world2) {
  const term = terms[i3];
  if (!term.switch) {
    return;
  }
  const model5 = world2.model;
  const setTag2 = world2.methods.one.setTag;
  const { switches: switches2, clues: clues5 } = model5.two;
  let str = term.normal || term.implicit || "";
  if (prefix4.test(str) && !switches2[str]) {
    str = str.replace(prefix4, "");
  }
  const form = term.switch;
  if (term.tags.has("Acronym") || term.tags.has("PhrasalVerb")) {
    return;
  }
  let tag = pickTag(terms, i3, clues5[form], model5);
  if (adhoc_default[form]) {
    tag = adhoc_default[form](terms, i3) || tag;
  }
  if (form === "Person|Noun" && tag === "Singular" && looksPlural_default(str)) {
    tag = "Plural";
  }
  if (tag) {
    setTag2([term], tag, world2, null, `3-[switch] (${form})`);
    fillTags_default(terms, i3, model5);
  } else if (debug_default.tags) {
    console.log(`
 -> X  - '${str}'  : (${form})  `);
  }
};
var switches_default = doSwitches;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/08-imperative.js
var beside = {
  there: true,
  //go there
  this: true,
  //try this
  it: true,
  //do it
  him: true,
  her: true,
  us: true
  //tell us
};
var imperative = function(terms, world2) {
  const setTag2 = world2.methods.one.setTag;
  const t3 = terms[0];
  const next = terms[1];
  const goTo = t3.normal === "go" && next?.normal === "to" && terms.length >= 3;
  const keepIt = t3.normal === "keep" && next?.normal === "it" && terms[2]?.tags.has("Adjective");
  if (goTo || keepIt) {
    setTag2([t3], "Imperative", world2, null, "3-[imperative]");
    return;
  }
  const multiWords = world2.model.one._multiCache || {};
  const isRight = t3.switch === "Noun|Verb" || t3.tags.has("Infinitive");
  if (isRight && terms.length >= 2) {
    if (terms.length < 4 && !beside[terms[1].normal]) {
      return;
    }
    if (!t3.tags.has("PhrasalVerb") && Object.hasOwn(multiWords, t3.normal)) {
      return;
    }
    const nextNoun = terms[1].tags.has("Noun") || terms[1].tags.has("Determiner");
    if (nextNoun) {
      const soonVerb = terms.slice(1, 3).some((term) => term.tags.has("Verb"));
      if (!soonVerb || t3.tags.has("#PhrasalVerb")) {
        setTag2([t3], "Imperative", world2, null, "3-[imperative]");
      }
    }
  }
};
var imperative_default = imperative;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/3rd-pass/09-first-word.js
var reason = "3-[first-word]";
var expressions = {
  beforeAdj: /* @__PURE__ */ new Set(["well", "so", "okay", "now"]),
  withComma: /* @__PURE__ */ new Set(["shoot", "say", "like"])
};
var firstWord = function(terms, world2) {
  const setTag2 = world2.methods.one.setTag;
  const str = terms[0].normal;
  if (expressions.beforeAdj.has(str)) {
    if (terms[1] && !terms[1].tags.has("Adjective")) {
      setTag2([terms[0]], "Expression", world2, null, reason);
    }
    if (terms.length === 1) {
      setTag2([terms[0]], "Expression", world2, null, reason);
    }
  }
  if (expressions.withComma.has(str)) {
    if (/,/.test(terms[0].post)) {
      setTag2([terms[0]], "Expression", world2, null, reason);
    }
  }
};
var first_word_default = firstWord;

// node_modules/compromise/src/2-two/preTagger/compute/tagger/index.js
var ignoreCase = function(terms) {
  if (terms.filter((t3) => !t3.tags.has("ProperNoun")).length <= 3) {
    return false;
  }
  const lowerCase = /^[a-z]/;
  return terms.every((t3) => !lowerCase.test(t3.text));
};
var firstPass = function(docs, model5, world2) {
  docs.forEach((terms) => {
    colons_default(terms, 0, model5, world2);
  });
};
var secondPass = function(terms, model5, world2, isYelling) {
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    if (terms[i3].frozen === true) {
      continue;
    }
    tagSwitch_default(terms, i3, model5);
    if (isYelling === false) {
      case_default2(terms, i3, model5);
    }
    suffix_default(terms, i3, model5);
    regex_default(terms, i3, model5, world2);
    prefix_default(terms, i3, model5);
    year_default(terms, i3, model5);
  }
};
var thirdPass = function(terms, model5, world2, isYelling) {
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    let found = acronym_default(terms, i3, model5);
    fillTags_default(terms, i3, model5);
    found ||= neighbours_default2(terms, i3, model5);
    found ||= fallback_default(terms, i3, model5);
  }
  for (let i3 = 0; i3 < terms.length; i3 += 1) {
    if (terms[i3].frozen === true) {
      continue;
    }
    orgWords_default2(terms, i3, world2, isYelling);
    placeWords_default2(terms, i3, world2, isYelling);
    switches_default(terms, i3, world2);
    verb_type_default(terms, i3, model5, world2);
    hyphens_default(terms, i3, model5, world2);
  }
  imperative_default(terms, world2);
  first_word_default(terms, world2);
};
var preTagger = function(view) {
  const { methods: methods19, model: model5, world: world2 } = view;
  const docs = view.docs;
  firstPass(docs, model5, world2);
  const document = methods19.two.quickSplit(docs);
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    const terms = document[n3];
    const isYelling = ignoreCase(terms);
    secondPass(terms, model5, world2, isYelling);
    thirdPass(terms, model5, world2, isYelling);
  }
  return document;
};
var tagger_default2 = preTagger;

// node_modules/compromise/src/2-two/preTagger/compute/root.js
var toRoot = {
  // 'spencer's' -> 'spencer'
  "Possessive": (term) => {
    let str = term.machine || term.normal || term.text;
    str = str.replace(/'s$/, "");
    return str;
  },
  // 'drinks' -> 'drink'
  "Plural": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.noun.toSingular(str, world2.model);
  },
  // ''
  "Copula": () => {
    return "is";
  },
  // 'walked' -> 'walk'
  "PastTense": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.verb.toInfinitive(str, world2.model, "PastTense");
  },
  // 'walking' -> 'walk'
  "Gerund": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.verb.toInfinitive(str, world2.model, "Gerund");
  },
  // 'walks' -> 'walk'
  "PresentTense": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    if (term.tags.has("Infinitive")) {
      return str;
    }
    return world2.methods.two.transform.verb.toInfinitive(str, world2.model, "PresentTense");
  },
  // 'quieter' -> 'quiet'
  "Comparative": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.adjective.fromComparative(str, world2.model);
  },
  // 'quietest' -> 'quiet'
  "Superlative": (term, world2) => {
    const str = term.machine || term.normal || term.text;
    return world2.methods.two.transform.adjective.fromSuperlative(str, world2.model);
  },
  // 'suddenly' -> 'sudden'
  "Adverb": (term, world2) => {
    const { fromAdverb } = world2.methods.two.transform.adjective;
    const str = term.machine || term.normal || term.text;
    return fromAdverb(str);
  }
};
var getRoot = function(view) {
  const world2 = view.world;
  const keys2 = Object.keys(toRoot);
  view.docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      for (let k2 = 0; k2 < keys2.length; k2 += 1) {
        if (term.tags.has(keys2[k2])) {
          const fn = toRoot[keys2[k2]];
          const root = fn(term, world2);
          if (term.normal !== root) {
            term.root = root;
          }
          break;
        }
      }
    }
  });
};
var root_default = getRoot;

// node_modules/compromise/src/2-two/preTagger/compute/penn.js
var mapping = {
  // adverbs
  // 'Comparative': 'RBR',
  // 'Superlative': 'RBS',
  Adverb: "RB",
  // adjectives
  Comparative: "JJR",
  Superlative: "JJS",
  Adjective: "JJ",
  TO: "Conjunction",
  // verbs
  Modal: "MD",
  Auxiliary: "MD",
  Gerund: "VBG",
  //throwing
  PastTense: "VBD",
  //threw
  Participle: "VBN",
  //thrown
  PresentTense: "VBZ",
  //throws
  Infinitive: "VB",
  //throw
  Particle: "RP",
  //phrasal particle
  Verb: "VB",
  // throw
  // pronouns
  Pronoun: "PRP",
  // misc
  Cardinal: "CD",
  Conjunction: "CC",
  Determiner: "DT",
  Preposition: "IN",
  // 'Determiner': 'WDT',
  // 'Expression': 'FW',
  QuestionWord: "WP",
  Expression: "UH",
  //nouns
  Possessive: "POS",
  ProperNoun: "NNP",
  Person: "NNP",
  Place: "NNP",
  Organization: "NNP",
  Singular: "NN",
  Plural: "NNS",
  Noun: "NN",
  There: "EX"
  //'there'
  // 'Adverb':'WRB',
  // 'Noun':'PDT', //predeterminer
  // 'Noun':'NFP', //
  //  WDT 	Wh-determiner
  // 	WP 	Wh-pronoun
  // 	WP$ 	Possessive wh-pronoun
  // 	WRB 	Wh-adverb
};
var toPenn = function(term) {
  if (/^[*/+=<>|~^×÷±≠≤≥]+$/.test(term.text)) {
    return "SYM";
  }
  if (term.text === "$") {
    return "$";
  }
  if (term.text === "\xA3" || term.text === "#") {
    return "#";
  }
  if (term.tags.has("ProperNoun") && term.tags.has("Plural")) {
    return "NNPS";
  }
  if (term.tags.has("Possessive") && term.tags.has("Pronoun")) {
    return "PRP$";
  }
  if (term.normal === "there") {
    return "EX";
  }
  if (term.normal === "to") {
    return "TO";
  }
  const arr = term.tagRank || [];
  for (let i3 = 0; i3 < arr.length; i3 += 1) {
    if (Object.hasOwn(mapping, arr[i3])) {
      return mapping[arr[i3]];
    }
  }
  return null;
};
var pennTag = function(view) {
  view.compute("tagRank");
  view.docs.forEach((terms) => {
    terms.forEach((term) => {
      term.penn = toPenn(term);
    });
  });
};
var penn_default = pennTag;

// node_modules/compromise/src/2-two/preTagger/compute/index.js
var compute_default9 = { preTagger: tagger_default2, root: root_default, penn: penn_default };

// node_modules/compromise/src/2-two/preTagger/tagSet/nouns.js
var entity = [Person, Place, Organization];
var nouns_default3 = {
  Noun: {
    not: [V, JJ, RB, Value, Det]
  },
  Singular: {
    is: NN,
    not: [NNS, Uncountable]
  },
  // 'Canada'
  ProperNoun: {
    is: NN,
    alias: "Prop"
  },
  Person: {
    is: NNs,
    also: [NNP],
    not: [Place, Organization, Date2]
  },
  FirstName: {
    is: Person
  },
  MaleName: {
    is: FirstName,
    not: [FemaleName, LastName]
  },
  FemaleName: {
    is: FirstName,
    not: [MaleName, LastName]
  },
  LastName: {
    is: Person,
    not: [FirstName]
  },
  // 'dr.'
  Honorific: {
    is: Person,
    not: [FirstName, LastName, Value],
    alias: "Hon"
  },
  Place: {
    is: NNs,
    not: [Person, Organization]
  },
  Country: {
    is: Place,
    also: [NNP],
    not: [City]
  },
  City: {
    is: Place,
    also: [NNP],
    not: [Country]
  },
  // 'california'
  Region: {
    is: Place,
    also: [NNP]
  },
  Address: {
    // is: 'Place',
    alias: "Addr"
  },
  Organization: {
    is: NNP,
    not: [Person, Place],
    alias: "Org"
  },
  SportsTeam: {
    is: Organization
  },
  School: {
    is: Organization
  },
  Company: {
    is: Organization
  },
  Plural: {
    is: NN,
    not: [NNs, Uncountable]
  },
  // 'gravity'
  Uncountable: {
    is: NN
  },
  // 'it'
  Pronoun: {
    is: NN,
    not: entity
  },
  // 'swimmer'
  Actor: {
    is: NN,
    not: [Place, Organization]
  },
  // walking
  Activity: {
    is: NN,
    not: [Person, Place]
  },
  // kilometres
  Unit: {
    is: NN,
    not: entity
  },
  // canadian
  Demonym: {
    is: NN,
    also: [NNP],
    not: entity
  },
  // [spencer's] hat
  Possessive: {
    is: NN,
    alias: "Poss"
  },
  // 'yourself'
  Reflexive: {
    is: PRP
  }
};

// node_modules/compromise/src/2-two/preTagger/tagSet/verbs.js
var verbs_default2 = {
  Verb: {
    not: [NN, JJ, RB, Value, Expression],
    alias: "Vb"
  },
  // 'he [walks]'
  PresentTense: {
    is: V,
    not: [VBD, Fut],
    alias: "Pres"
  },
  // 'will [walk]'
  Infinitive: {
    is: Pres,
    not: [VBG],
    alias: "Inf"
  },
  // '[walk] now!'
  Imperative: {
    is: V,
    not: [VBD, VBG, Cop],
    alias: "Imp"
  },
  // walking
  Gerund: {
    is: Pres,
    not: [Cop],
    alias: "Ger"
  },
  // walked
  PastTense: {
    is: V,
    not: [Pres, VBG, Fut],
    alias: "Past"
  },
  // will walk
  FutureTense: {
    is: V,
    not: [Pres, VBD],
    alias: "Fut"
  },
  // is/was
  Copula: {
    is: V
  },
  // '[could] walk'
  Modal: {
    is: V,
    not: [VB]
  },
  // 'awaken'
  Participle: {
    is: VBD
  },
  // '[will have had] walked'
  Auxiliary: {
    is: V,
    not: [VBD, Pres, VBG, Conj],
    alias: "Aux"
  },
  // 'walk out'
  PhrasalVerb: {
    is: V,
    alias: "Phrasal"
  },
  // 'walk [out]'
  Particle: {
    is: PhrasalVerb,
    not: [VBD, Pres, Cop, VBG]
  },
  // 'walked by'
  Passive: {
    is: V
  }
};

// node_modules/compromise/src/2-two/preTagger/tagSet/values.js
var values_default = {
  Value: {
    not: [V, JJ, RB],
    alias: "Val"
  },
  Ordinal: {
    is: Value,
    not: [Cardinal]
  },
  Cardinal: {
    is: Value,
    not: [Ordinal]
  },
  Fraction: {
    is: Value,
    not: [NN]
  },
  Multiple: {
    is: TextValue
  },
  RomanNumeral: {
    is: Cardinal
  },
  TextValue: {
    is: Value,
    not: [NumericValue, RomanNumeral]
  },
  NumericValue: {
    is: Value,
    not: [RomanNumeral],
    alias: "Numeric"
  },
  Money: {
    is: Cardinal
  },
  Percent: {
    is: Value
  }
};

// node_modules/compromise/src/2-two/preTagger/tagSet/dates.js
var dates_default = {
  Date: {
    not: [V, RB, JJ]
  },
  Month: {
    is: Date2,
    also: [NN],
    not: [WeekDay, Year, FinancialQuarter, Season, Time, Timezone]
  },
  WeekDay: {
    is: Date2,
    also: [NN],
    not: [Year, FinancialQuarter, Season, Time, Timezone]
  },
  Year: {
    is: Date2,
    not: [RomanNumeral, FinancialQuarter, Season, Time, Timezone]
  },
  FinancialQuarter: {
    is: Date2,
    not: [Fraction, Season, Time, Timezone]
  },
  // 'easter'
  Holiday: {
    is: Date2,
    also: [NN]
  },
  // 'summer'
  Season: {
    is: Date2,
    not: [Time, Timezone]
  },
  Timezone: {
    is: Date2,
    also: [NN],
    not: [NNP]
  },
  Time: {
    is: Date2,
    not: [AtMention, Timezone]
  },
  // 'months'
  Duration: {
    is: Date2,
    also: [NN]
  }
};

// node_modules/compromise/src/2-two/preTagger/tagSet/misc.js
var anything = [NN, V, JJ, RB, Value, QuestionWord];
var misc_default3 = {
  Adjective: {
    not: [NN, V, RB, Value],
    alias: "Adj"
  },
  Comparable: {
    is: JJ
  },
  Comparative: {
    is: JJ
  },
  Superlative: {
    is: JJ,
    not: [JJR]
  },
  NumberRange: {},
  Adverb: {
    not: [NN, V, JJ, Value],
    alias: "Adv"
  },
  Determiner: {
    not: [NN, V, JJ, RB, QuestionWord, Conj],
    //allow 'a' to be a Determiner/Value
    alias: "Det"
  },
  Connector: {
    not: [NN, V, JJ, RB, QuestionWord, Det]
  },
  Conjunction: {
    is: Connector,
    not: anything.concat([IN]),
    alias: "Conj"
  },
  Preposition: {
    is: Connector,
    not: [NN, V, JJ, RB, QuestionWord, Det, Conj],
    alias: "Prep"
  },
  QuestionWord: {
    not: [Det]
  },
  Currency: {
    is: NN
  },
  Expression: {
    not: [NN, JJ, V, RB],
    alias: "Expr"
  },
  Abbreviation: {
    alias: "Abbr"
  },
  Url: {
    not: [HashTag, V, JJ, Value, SlashedTerm, Email, PhoneNumber, AtMention, Emoji, Emoticon]
  },
  PhoneNumber: {
    not: [HashTag, V, JJ, Value, AtMention, Emoji, Emoticon]
  },
  HashTag: {},
  AtMention: {
    is: NN,
    not: [HashTag, Emoji, Emoticon]
  },
  Emoji: {
    not: [HashTag, V, JJ, Value, Emoticon]
  },
  Emoticon: {
    not: [HashTag, V, JJ, Value, SlashedTerm]
  },
  SlashedTerm: {
    not: [Emoticon, Url, Value]
  },
  Email: {
    not: [HashTag, V, JJ, Value, PhoneNumber, AtMention, Emoji, Emoticon]
  },
  Acronym: {
    not: [RomanNumeral, PRP, Date2]
  },
  Negative: {
    not: [NN, JJ, Value, Expression]
  },
  Condition: {
    is: Connector,
    not: [V, JJ, NN, Value]
  },
  // existential 'there'
  There: {
    not: [V, JJ, NN, Value, Conj, IN]
  },
  // 'co-wrote'
  Prefix: {
    not: [Abbreviation, Acronym, NNP]
  },
  // hard-nosed, bone-headed
  Hyphenated: {}
};

// node_modules/compromise/src/2-two/preTagger/tagSet/index.js
var allTags = { ...nouns_default3, ...verbs_default2, ...values_default, ...dates_default, ...misc_default3 };
var tagSet_default = allTags;

// node_modules/compromise/src/2-two/preTagger/plugin.js
var plugin_default14 = {
  compute: compute_default9,
  methods: methods_default9,
  model: model_default3,
  tags: tagSet_default,
  hooks: ["preTagger"]
};

// node_modules/compromise/src/2-two/contraction-two/api/contract.js
var postPunct = /[,)"';:\-–—.…]/;
var setContraction = function(m3, suffix2) {
  if (!m3.found) {
    return;
  }
  const terms = m3.termList();
  for (let i3 = 0; i3 < terms.length - 1; i3++) {
    const t3 = terms[i3];
    if (postPunct.test(t3.post)) {
      return;
    }
  }
  terms[0].implicit = terms[0].normal;
  terms[0].text += suffix2;
  terms[0].normal += suffix2;
  terms.slice(1).forEach((t3) => {
    t3.implicit = t3.normal;
    t3.text = "";
    t3.normal = "";
  });
  for (let i3 = 0; i3 < terms.length - 1; i3++) {
    terms[i3].post = terms[i3].post.replace(/ /, "");
  }
};
var contract = function() {
  const doc = this.not("@hasContraction");
  let m3 = doc.match("(we|they|you) are");
  setContraction(m3, `'re`);
  m3 = doc.match("(he|she|they|it|we|you) will");
  setContraction(m3, `'ll`);
  m3 = doc.match("(he|she|they|it|we) is");
  setContraction(m3, `'s`);
  m3 = doc.match("#Person is");
  setContraction(m3, `'s`);
  m3 = doc.match("#Person would");
  setContraction(m3, `'d`);
  m3 = doc.match("(is|was|had|would|should|could|do|does|have|has|can) not");
  setContraction(m3, `n't`);
  m3 = doc.match("(i|we|they) have");
  setContraction(m3, `'ve`);
  m3 = doc.match("(would|should|could) have");
  setContraction(m3, `'ve`);
  m3 = doc.match("i am");
  setContraction(m3, `'m`);
  m3 = doc.match("going to");
  return this;
};
var contract_default = contract;

// node_modules/compromise/src/2-two/contraction-two/api/index.js
var titleCase3 = /^\p{Lu}[\p{Ll}'’]/u;
var toTitleCase3 = function(str = "") {
  str = str.replace(/^ *[a-z\u00C0-\u00FF]/, (x) => x.toUpperCase());
  return str;
};
var api3 = function(View2) {
  class Contractions extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Contraction";
    }
    /** i've -> 'i have' */
    expand() {
      this.docs.forEach((terms) => {
        const isTitleCase6 = titleCase3.test(terms[0].text);
        terms.forEach((t3, i3) => {
          t3.text = t3.implicit || "";
          delete t3.implicit;
          if (i3 < terms.length - 1 && t3.post === "") {
            t3.post += " ";
          }
          t3.dirty = true;
        });
        if (isTitleCase6) {
          terms[0].text = toTitleCase3(terms[0].text);
        }
      });
      this.compute("normal");
      return this;
    }
  }
  View2.prototype.contractions = function() {
    const m3 = this.match("@hasContraction+");
    return new Contractions(this.document, m3.pointer);
  };
  View2.prototype.contract = contract_default;
};
var api_default10 = api3;

// node_modules/compromise/src/2-two/contraction-two/compute/_splice.js
var insertContraction2 = function(document, point, words) {
  const [n3, w] = point;
  if (!words || words.length === 0) {
    return;
  }
  words = words.map((word, i3) => {
    word.implicit = word.text;
    word.machine = word.text;
    word.pre = "";
    word.post = "";
    word.text = "";
    word.normal = "";
    word.index = [n3, w + i3];
    return word;
  });
  if (words[0]) {
    words[0].pre = document[n3][w].pre;
    words[words.length - 1].post = document[n3][w].post;
    words[0].text = document[n3][w].text;
    words[0].normal = document[n3][w].normal;
  }
  document[n3].splice(w, 1, ...words);
};
var splice_default2 = insertContraction2;

// node_modules/compromise/src/2-two/contraction-two/compute/apostrophe-s.js
var hasContraction3 = /'/;
var hasWords = /* @__PURE__ */ new Set([
  "been",
  //the meeting's been ..
  "become"
  //my son's become
]);
var isWords = /* @__PURE__ */ new Set([
  "what",
  //it's what
  "how",
  //it's how
  "when",
  "if",
  //it's if
  "too"
]);
var adjLike = /* @__PURE__ */ new Set(["too", "also", "enough"]);
var isOrHas = (terms, i3) => {
  for (let o2 = i3 + 1; o2 < terms.length; o2 += 1) {
    const t3 = terms[o2];
    if (hasWords.has(t3.normal)) {
      return "has";
    }
    if (isWords.has(t3.normal)) {
      return "is";
    }
    if (t3.tags.has("Gerund")) {
      return "is";
    }
    if (t3.tags.has("Determiner")) {
      return "is";
    }
    if (t3.tags.has("Adjective")) {
      return "is";
    }
    if (t3.switch === "Adj|Past") {
      if (terms[o2 + 1]) {
        if (adjLike.has(terms[o2 + 1].normal)) {
          return "is";
        }
        if (terms[o2 + 1].tags.has("Preposition")) {
          return "is";
        }
      }
    }
    if (t3.tags.has("PastTense")) {
      if (terms[o2 + 1] && terms[o2 + 1].normal === "for") {
        return "is";
      }
      return "has";
    }
  }
  return "is";
};
var apostropheS = function(terms, i3) {
  const before2 = terms[i3].normal.split(hasContraction3)[0];
  if (before2 === "let") {
    return [before2, "us"];
  }
  if (before2 === "there") {
    const t3 = terms[i3 + 1];
    if (t3 && t3.tags.has("Plural")) {
      return [before2, "are"];
    }
  }
  if (isOrHas(terms, i3) === "has") {
    return [before2, "has"];
  }
  return [before2, "is"];
};
var apostrophe_s_default = apostropheS;

// node_modules/compromise/src/2-two/contraction-two/compute/apostrophe-d.js
var hasContraction4 = /'/;
var hadWords = /* @__PURE__ */ new Set([
  "better",
  //had better
  "done",
  //had done
  "before",
  // he'd _ before
  "it",
  // he'd _ it
  "had"
  //she'd had -> she would have..
]);
var wouldWords = /* @__PURE__ */ new Set([
  "have",
  // 'i'd have' -> i would have..
  "be"
  //' she'd be'
]);
var hadOrWould = (terms, i3) => {
  for (let o2 = i3 + 1; o2 < terms.length; o2 += 1) {
    const t3 = terms[o2];
    if (hadWords.has(t3.normal)) {
      return "had";
    }
    if (wouldWords.has(t3.normal)) {
      return "would";
    }
    if (t3.tags.has("PastTense") || t3.switch === "Adj|Past") {
      return "had";
    }
    if (t3.tags.has("PresentTense") || t3.tags.has("Infinitive")) {
      return "would";
    }
    if (t3.tags.has("#Determiner")) {
      return "had";
    }
    if (t3.tags.has("Adjective")) {
      return "would";
    }
  }
  return false;
};
var _apostropheD2 = function(terms, i3) {
  const before2 = terms[i3].normal.split(hasContraction4)[0];
  if (before2 === "how" || before2 === "what") {
    return [before2, "did"];
  }
  if (hadOrWould(terms, i3) === "had") {
    return [before2, "had"];
  }
  return [before2, "would"];
};
var apostrophe_d_default2 = _apostropheD2;

// node_modules/compromise/src/2-two/contraction-two/compute/apostrophe-t.js
var lastNoun = function(terms, i3) {
  for (let n3 = i3 - 1; n3 >= 0; n3 -= 1) {
    if (terms[n3].tags.has("Noun") || terms[n3].tags.has("Pronoun") || terms[n3].tags.has("Plural") || terms[n3].tags.has("Singular")) {
      return terms[n3];
    }
  }
  return null;
};
var apostropheT2 = function(terms, i3) {
  if (terms[i3].normal === "ain't" || terms[i3].normal === "aint") {
    if (terms[i3 + 1] && terms[i3 + 1].normal === "never") {
      return ["have"];
    }
    const noun3 = lastNoun(terms, i3);
    if (noun3) {
      if (noun3.normal === "we" || noun3.normal === "they") {
        return ["are", "not"];
      }
      if (noun3.normal === "i") {
        return ["am", "not"];
      }
      if (noun3.tags && noun3.tags.has("Plural")) {
        return ["are", "not"];
      }
    }
    return ["is", "not"];
  }
  const before2 = terms[i3].normal.replace(/n't/, "");
  return [before2, "not"];
};
var apostrophe_t_default2 = apostropheT2;

// node_modules/compromise/src/2-two/contraction-two/compute/isPossessive.js
var banList = {
  that: true,
  there: true,
  let: true,
  here: true,
  everywhere: true
};
var beforePossessive = {
  in: true,
  //in sunday's
  by: true,
  //by sunday's
  for: true
  //for sunday's
};
var adjLike2 = /* @__PURE__ */ new Set(["too", "also", "enough", "about"]);
var nounLike = /* @__PURE__ */ new Set(["is", "are", "did", "were", "could", "should", "must", "had", "have"]);
var copulas = /* @__PURE__ */ new Set(["is", "are", "was", "were", "am"]);
var isPossessive2 = (terms, i3) => {
  const term = terms[i3];
  if (Object.hasOwn(banList, term.machine || term.normal)) {
    return false;
  }
  if (term.tags.has("Possessive")) {
    return true;
  }
  if (term.tags.has("QuestionWord")) {
    return false;
  }
  if (term.normal === `he's` || term.normal === `she's`) {
    return false;
  }
  const nextTerm = terms[i3 + 1];
  if (!nextTerm) {
    return true;
  }
  if (term.normal === `it's`) {
    if (nextTerm.tags.has("#Noun")) {
      return true;
    }
    return false;
  }
  if (nextTerm.switch == "Noun|Gerund") {
    const next2 = terms[i3 + 2];
    if (!next2) {
      if (term.tags.has("Actor") || term.tags.has("ProperNoun")) {
        return true;
      }
      return false;
    }
    if (next2.tags.has("Copula")) {
      return true;
    }
    if (next2.normal === "on" || next2.normal === "in") {
      return false;
    }
    return false;
  }
  if (nextTerm.tags.has("Verb")) {
    if (copulas.has(nextTerm.normal)) {
      return true;
    }
    if (nextTerm.tags.has("Infinitive")) {
      return true;
    }
    if (nextTerm.tags.has("Gerund")) {
      return false;
    }
    if (nextTerm.tags.has("PresentTense")) {
      return true;
    }
    return false;
  }
  if (nextTerm.switch === "Adj|Noun") {
    const twoTerm = terms[i3 + 2];
    if (!twoTerm) {
      return false;
    }
    if (nounLike.has(twoTerm.normal)) {
      return true;
    }
    if (adjLike2.has(twoTerm.normal)) {
      return false;
    }
  }
  if (nextTerm.tags.has("Noun")) {
    const nextStr = nextTerm.machine || nextTerm.normal;
    if (nextStr === "here" || nextStr === "there" || nextStr === "everywhere") {
      return false;
    }
    if (nextTerm.tags.has("Possessive")) {
      return false;
    }
    if (nextTerm.tags.has("ProperNoun") && !term.tags.has("ProperNoun")) {
      return false;
    }
    return true;
  }
  if (terms[i3 - 1] && beforePossessive[terms[i3 - 1].normal] === true) {
    return true;
  }
  if (nextTerm.tags.has("Adjective")) {
    const twoTerm = terms[i3 + 2];
    if (!twoTerm) {
      return false;
    }
    if (twoTerm.tags.has("Noun") && !twoTerm.tags.has("Pronoun")) {
      const str = nextTerm.normal;
      if (str === "above" || str === "below" || str === "behind") {
        return false;
      }
      return true;
    }
    if (twoTerm.switch === "Noun|Verb") {
      return true;
    }
    return false;
  }
  if (nextTerm.tags.has("Value")) {
    return true;
  }
  return false;
};
var isPossessive_default = isPossessive2;

// node_modules/compromise/src/2-two/contraction-two/compute/index.js
var byApostrophe2 = /'/;
var reIndex = function(terms) {
  terms.forEach((t3, i3) => {
    if (t3.index) {
      t3.index[1] = i3;
    }
  });
};
var reTag2 = function(terms, view, start2, len) {
  const tmp = view.update();
  tmp.document = [terms];
  let end2 = start2 + len;
  if (start2 > 0) {
    start2 -= 1;
  }
  if (terms[end2]) {
    end2 += 1;
  }
  tmp.ptrs = [[0, start2, end2]];
  tmp.compute(["freeze", "lexicon", "preTagger", "unfreeze"]);
  reIndex(terms);
};
var byEnd2 = {
  // how'd
  d: (terms, i3) => apostrophe_d_default2(terms, i3),
  // we ain't
  t: (terms, i3) => apostrophe_t_default2(terms, i3),
  // bob's
  s: (terms, i3, world2) => {
    if (isPossessive_default(terms, i3)) {
      return world2.methods.one.setTag([terms[i3]], "Possessive", world2, null, "2-contraction");
    }
    return apostrophe_s_default(terms, i3);
  }
};
var toDocs2 = function(words, view) {
  const doc = view.fromText(words.join(" "));
  doc.compute("id");
  return doc.docs[0];
};
var contractionTwo = (view) => {
  const { world: world2, document } = view;
  document.forEach((terms, n3) => {
    for (let i3 = terms.length - 1; i3 >= 0; i3 -= 1) {
      if (terms[i3].implicit) {
        continue;
      }
      let after2 = null;
      if (byApostrophe2.test(terms[i3].normal) === true) {
        after2 = terms[i3].normal.split(byApostrophe2)[1];
      }
      let words = null;
      if (Object.hasOwn(byEnd2, after2)) {
        words = byEnd2[after2](terms, i3, world2);
      }
      if (words) {
        words = toDocs2(words, view);
        splice_default2(document, [n3, i3], words);
        reTag2(document[n3], view, i3, words.length);
        continue;
      }
    }
  });
};
var compute_default10 = { contractionTwo };

// node_modules/compromise/src/2-two/contraction-two/plugin.js
var plugin_default15 = {
  compute: compute_default10,
  api: api_default10,
  hooks: ["contractionTwo"]
};

// node_modules/compromise/src/2-two/postTagger/model/_lib.js
var tags = {
  NN: "Noun",
  Sing: "Singular",
  Plur: "Plural",
  Prop: "ProperNoun",
  Pron: "Pronoun",
  Poss: "Possessive",
  Det: "Determiner",
  Adj: "Adjective",
  Comp: "Comparative",
  Sup: "Superlative",
  Adv: "Adverb",
  V: "Verb",
  Inf: "Infinitive",
  Pres: "PresentTense",
  Past: "PastTense",
  Fut: "FutureTense",
  Ger: "Gerund",
  Part: "Participle",
  Cop: "Copula",
  Aux: "Auxiliary",
  Mod: "Modal",
  Pass: "Passive",
  Imp: "Imperative",
  Neg: "Negative",
  PhrV: "PhrasalVerb",
  Prt: "Particle",
  Prep: "Preposition",
  Conj: "Conjunction",
  QW: "QuestionWord",
  Refl: "Reflexive",
  Pers: "Person",
  First: "FirstName",
  Last: "LastName",
  Org: "Organization",
  Dem: "Demonym",
  Hon: "Honorific",
  Expr: "Expression",
  Card: "Cardinal",
  Ord: "Ordinal",
  Num: "NumericValue",
  TxtNum: "TextValue",
  NumRange: "NumberRange",
  Frac: "Fraction"
};
var expandTags = (value, bare = false) => {
  if (Array.isArray(value)) {
    return value.map((tag) => expandTags(tag, bare));
  }
  if (typeof value !== "string") {
    return value;
  }
  const pattern = bare ? /#?[a-z][a-z0-9]*/gi : /#[a-z][a-z0-9]*/gi;
  return value.replace(pattern, (token) => {
    const prefix5 = token.startsWith("#") ? "#" : "";
    const name = token.slice(prefix5.length);
    return prefix5 + (Object.hasOwn(tags, name) ? tags[name] : name);
  });
};
var lib_default9 = expandTags;

// node_modules/compromise/src/2-two/postTagger/model/expand-rules.js
var keys = { m: "match", g: "group", t: "tag", r: "reason", n: "notIf", u: "unTag" };
var expandRules = (rules7) => {
  rules7.forEach((rule) => {
    Object.keys(rule).forEach((key) => {
      rule[key] = lib_default9(rule[key], key === "t" || key === "u");
      const name = keys[key];
      if (name) {
        rule[name] = rule[key];
        delete rule[key];
      }
    });
  });
  return rules7;
};
var expand_rules_default = expandRules;

// node_modules/compromise/src/2-two/postTagger/model/index.js
var adverbAdj = `(dark|bright|flat|light|soft|pale|dead|dim|faux|little|wee|sheer|most|near|good|extra|all)`;
var noLy = "(hard|fast|late|early|high|right|deep|close|direct)";
var infNouns = "(feel|sense|process|rush|side|bomb|bully|challenge|cover|crush|dump|exchange|flow|function|issue|lecture|limit|march|process)";
var notIf2 = "(i|we|they)";
var companySuffix = "(inc|ltd|llc|co|corp|corporation|company|limited)";
var noun = "(#NN && !#Poss && !@hasComma)";
var modifiers = "(#Det|#Poss)? #Adv+? #Adj+?";
var subject = `${modifiers} ${noun}+`;
var predicate = "#Adv+? not? (#V && !#Ger && !#Prt)";
var rules = [
  // === verbs/passive.js ===
  // got walked
  { m: "got (#Past|#Part)", t: "Pass", r: "got-pass" },
  // Share the pattern while keeping cheap word-specific hooks.
  ...["were", "was", "is", "are", "am"].map((word) => ({
    m: `${word} (#Past|#Part)`,
    t: "Pass",
    r: `${word}-pass`
  })),
  // was being walked
  { m: "(was|were|is|are|am) being (#Past|#Part)", t: "Pass", r: "being-pass" },
  // had been walked
  { m: "(had|have|has) been (#Past|#Part)", t: "Pass", r: "been-pass" },
  // will be cleaned
  { m: "will be being? (#Past|#Part)", t: "Pass", r: "will-be-pass" },
  // dog was [walked] by the man
  {
    m: "#NN (am|is|are|was|were) #Adv? [(#Past|#Part)] by (the|a) #NN",
    g: 0,
    t: "Pass",
    r: "suffered-by"
  },
  // === adjective/adjective.js ===
  // off-white
  { m: "(off && #Hyphenated) white", t: "Adj", r: "off-white" },
  // Restore the copula when the colour is written without a hyphen.
  // [is] off white
  {
    m: "[(is|are|am|was|were)] off white$",
    g: 0,
    u: "PhrV",
    t: "Cop",
    r: "off-white-cop"
  },
  // is [off white]
  { m: "(is|are|am|was|were) [off white]$", g: 0, t: "Adj", r: "off-white-pred" },
  // [all] the dogs
  { m: "[(all|both)] #Det #NN", g: 0, t: "NN", r: "all-noun" },
  // the door is [closed]
  { m: "#Sing is #Adv? [%Adj|Past%]$", g: 0, t: "Adj", r: "is-filled" },
  // [forgotten] art is rediscovered
  { m: "[#Past] #Sing is", g: 0, t: "Adj", r: "smoked-poutine" },
  // [forgotten] stories are lost
  { m: "[#Past] #Plur are", g: 0, t: "Adj", r: "baked-onions" },
  // is [fucked up]
  { m: "#Cop [fucked up?]", g: 0, t: "Adj", r: "swears-adj" },
  // the door seems [opened]
  { m: "#Sing (seems|appears) #Adv? [#Past$]", g: 0, t: "Adj", r: "seems-filled" },
  // jury is out - preposition ➔ adjective
  // jury is [out]
  { m: "#Cop #Adj? [(out|in|through)]$", g: 0, t: "Adj", r: "still-out" },
  // [quiet] the room
  {
    m: "^[(#Adj && !near && !inside && !outside && !opposite)] (the|your) #NN",
    g: 0,
    n: "(all|even)",
    t: "Inf",
    r: "shut-the"
  },
  // blue-[tinted]
  {
    m: "(#Adj && #Hyphenated) [(#Hyphenated && #Past)]$",
    g: 0,
    t: "Adj",
    r: "red-shouldered"
  },
  // [blue-tinted] glasses
  {
    m: "[#Hyphenated (#Hyphenated && #Past)] (#NN|#Conj)",
    g: 0,
    t: "Adj",
    n: "#Adv",
    r: "faith-based"
  },
  // [non-breaking] spaces
  {
    m: "[#Hyphenated (#Hyphenated && #Ger)] (#NN|#Conj)",
    g: 0,
    t: "Adj",
    n: "#Adv",
    r: "self-driving"
  },
  // [dammed-up] river
  {
    m: "[#Past (#Hyphenated && #PhrV)] (#NN|#Conj)",
    g: 0,
    t: "Adj",
    r: "dammed-up"
  },
  // two-fold
  { m: "(#Hyphenated && #Value) fold", t: "Adj", r: "two-fold" },
  // must-win
  { m: "must (#Hyphenated && #Inf)", t: "Adj", r: "must-win" },
  // vacuum-sealed
  {
    m: `(#Hyphenated && #Inf) #Hyphenated`,
    t: "Adj",
    n: "#PhrV",
    r: "vacuum-sealed"
  },
  // too much
  { m: "too much", t: "Adv Adj", r: "too-much" },
  // a bit much
  { m: "a bit much", t: "Det Adv Adj", r: "a-bit-much" },
  // === adjective/adj-adverb.js ===
  // [dark] green
  { m: `[${adverbAdj}] #Adj`, g: 0, t: "Adv", r: "dark-green" },
  // is [far too] cold
  { m: `#Cop [far too] #Adj`, g: 0, t: "Adv", r: "far-too" },
  // shops [direct]
  {
    m: `#V [${noLy}] !#NN?`,
    g: 0,
    n: "(#Cop|be|been|being|get|got|getting|become|became|becoming|feel|feels|feeling|#Det|#Prep)",
    t: "Adv",
    r: "shops-direct"
  },
  // Bare 'be' may still be Infinitive rather than Copula in commands.
  // be [late]
  { m: "(be|been|being) (#Adv|not)+? [late]", g: 0, t: "Adj", r: "be-late" },
  // be [early]
  { m: "(be|been|being) (#Adv|not)+? [early]", g: 0, t: "Adj", r: "be-early" },
  // [moons] a lot
  { m: `[#Plur] a lot !like?`, g: 0, t: "Pres", r: "studies-a-lot" },
  // === adjective/adj-gerund.js ===
  // Gerund-Adjectives - 'amusing, annoying'
  // found it [interesting]
  { m: "found it #Adv? [%Adj|Gerund%]", g: 0, t: "Adj", r: "found-it-ger" },
  // found it [isolating], but found it isolating cells
  { m: "found it #Adv? [isolating]$", g: 0, t: "Adj", r: "it-isolating" },
  // a little [fuming]
  { m: "a (little|bit|wee) bit? [#Ger]", g: 0, t: "Adj", r: "a-bit-ger" },
  // repairing [crumbling] roads
  {
    m: "#Ger [#Ger] #NN",
    g: 0,
    t: "Adj",
    n: "(impersonating|practicing|considering|assuming|enjoying|avoiding|stopping|starting|finishing)",
    r: "look-annoying"
  },
  // looked [amazing]
  {
    m: "(looked|look|looks) #Adv? [%Adj|Gerund%]",
    g: 0,
    t: "Adj",
    n: "(impersonating|practicing|considering|assuming)",
    r: "looked-amazing"
  },
  // [boring] the audience
  { m: "[%Adj|Gerund%] #Det", g: 0, t: "Ger", r: "developing-a" },
  // meaning alluring
  { m: "%Noun|Gerund% %Adj|Gerund%", t: "Ger #Adj", r: "alluring" },
  // === adjective/adj-noun.js ===
  // his [fine]
  { m: "(his|its) [%Adj|Noun%] !#NN?", g: 0, t: "NN", n: "#Hyphenated", r: "his-fine" },
  // is [all]
  { m: "#Cop #Adv? [all]", g: 0, t: "NN", r: "is-all" },
  // have [fun] with it
  { m: `(have|had) [#Adj] #Prep .`, g: 0, t: "NN", r: "have-fun" },
  // brewing giant
  { m: `#Ger (giant|capital|center|zone|application)`, t: "NN", r: "brewing-giant" },
  // in a [perfect]
  { m: `#Prep (a|an) [#Adj]$`, g: 0, t: "NN", r: "an-instant" },
  // [brand] new
  { m: `[brand #Ger?] new`, g: 0, t: "Adv", r: "brand-new" },
  // some [kind] of teacher
  { m: `(#Det|#Comp|new|different) [kind] of`, g: 0, t: "NN", r: "some-kind" },
  // her [favourite] sport
  { m: `#Poss [%Adj|Noun%] #NN`, g: 0, t: "Adj", r: "her-favourite" },
  // must-win
  { m: `(must && #Hyphenated) .`, t: "Adj", r: "must-hyphen" },
  // the [present]
  {
    m: `#Det [#Adj]$`,
    g: 0,
    t: "NN",
    n: "(this|that|#Comp|#Sup)",
    r: "det-adj"
  },
  //are that crazy.
  // company-wide
  {
    m: `(#NN && #Hyphenated) (#Adj && #Hyphenated)`,
    t: "Adj",
    n: "(this|that|#Comp|#Sup)",
    r: "company-wide"
  },
  // the [poor] were
  // {
  //   m: `#Det [#Adj] (#Cop|#Det)`,
  //   n: '(#Comp|#Sup)',
  //   g: 0,
  //   t: 'NN',
  //   r: 'poor',
  // },
  // [professional] bodybuilder
  {
    m: `[%Adj|Noun%] #NN`,
    n: "(#Pron|#Prop)",
    g: 0,
    t: "Adj",
    r: "stable"
  },
  // === adverb.js ===
  // const adverbAdj = '(dark|bright|flat|light|soft|pale|dead|dim|faux|little|wee|sheer|most|near|good|extra|all)'
  // [way] too hot
  { m: "[way] #Adv #Adj", g: 0, t: "Adv", r: "way-too-adj" },
  // sing [like] an angel
  { m: "#V  [like]", g: 0, n: "(#Mod|#PhrV)", t: "Adv", r: "verb-like" },
  // barely even walk
  { m: "(barely|hardly) even", t: "Adv", r: "barely-even" },
  // even left
  { m: "even left", t: "#Adv #V", r: "even-left" },
  // cheering [hard]
  {
    m: "#Pres [(hard|quick|bright|slow|fast|backwards|forwards)]",
    n: "(#Cop|feel|feels|look|looks|seem|seems|appear|appears|sound|sounds|smell|smells|taste|tastes|become|becomes|grow|grows|get|gets|stay|stays|remain|remains)",
    g: 0,
    t: "Adv",
    r: "lazy-ly"
  },
  // is [well]
  { m: "#Cop [#Adv]$", g: 0, t: "Adj", r: "is-well" },
  // a [bit] cold
  { m: "a [(little|bit|wee) bit?] #Adj", g: 0, t: "Adv", r: "a-bit-cold" },
  // become overly [weakened]
  { m: "(become|fall|grow) #Adv? [#Past]", g: 0, t: "Adj", r: "weakened" },
  // a completely [beaten] man
  { m: "(a|an) #Adv [#Part] #NN", g: 0, t: "Adj", r: "beaten" },
  // a [close] friend
  // { m: '#Det #Adv? [close] #NN', g: 0, t: 'Adj', r: 'a-close' },
  // does [better]
  { m: "(do|does|did) #Adv? [(better|worse)]", g: 0, t: "Adv", r: "do-better" },
  // walking [close]
  {
    m: "#Ger #Adv? [close]",
    g: 0,
    t: "Adv",
    n: "(getting|becoming|feeling)",
    r: "being-close"
  },
  // charged [back]
  {
    m: "(#Pres|#Past) [back]",
    g: 0,
    t: "Adv",
    n: "(#PhrV|#Cop)",
    r: "charge-back"
  },
  // the [well]
  { m: "#Det [well] !#Past?", g: 0, t: "NN", r: "well" },
  // sees [well]
  { m: "(#Pres && !#Cop) [well]", g: 0, t: "Adv", r: "sees-well" },
  // === dates/date.js ===
  // ==== WeekDay ====
  // [sun] the 5th
  { m: "[sun] the #Ord", g: 0, t: "WeekDay", r: "sun-the-5th" },
  // 1pm next [sun]
  { m: "#Date (on|this|next|last|during)? [sun]", g: 0, t: "WeekDay", r: "1pm-sun" },
  // on [sat]
  { m: `(in|by|before|during|on|until|after|of|within|all) [sat]`, g: 0, t: "WeekDay", r: "sat" },
  // ==== Month ====
  // in [march]
  { m: `#Prep [(march|may)]`, g: 0, t: "Month", r: "in-month" },
  // this march
  { m: "(this|next|last) march !#Inf?", t: "#Date #Month", r: "this-march" },
  // this may
  { m: "(this|next|last) may !#Inf?", t: "#Date #Month", r: "this-may" },
  // march 5th
  { m: `(march|may) the? #Value`, t: "#Month #Date #Date", r: "march-5th" },
  // 5th of march
  { m: `#Value of? (march|may)`, t: "#Date #Date #Month", r: "5th-of-march" },
  // [march] and feb
  { m: `[(march|may)] .? #Date`, g: 0, t: "Month", r: "march-and-feb" },
  // feb to [march]
  { m: `#Date .? [(march|may)]`, g: 0, t: "Month", r: "feb-and-march" },
  // quickly [march]
  { m: `#Adv [(march|may)]`, g: 0, t: "V", n: "(early|late)", r: "quickly-march" },
  // 12 am
  { m: `#Value (am|pm)`, t: "Time", r: "2-am" },
  // === dates/date-phrase.js ===
  // 5th of June
  { m: "#Value of #Month", t: "Date", r: "value-of-month" },
  // 5 June
  // { m: '#Card #Month', t: 'Date', r: 'cardinal-month' },
  // June 5 to 7
  { m: "#Month #Value to #Value", t: "Date", r: "value-to-value" },
  // June the 12th
  { m: "#Month the #Value", t: "Date", r: "month-value" },
  // june 7
  { m: "(#WeekDay|#Month) #Value", t: "Date", r: "date-value" },
  // 7 june
  { m: "#Value (#WeekDay|#Month)", t: "Date", r: "value-date" },
  // aug 20-21
  { m: `#Month #NumRange`, t: "Date", r: "aug-20-21" },
  // Wednesday June 5th
  { m: `#WeekDay #Month #Ord`, t: "Date", r: "weekday-date" },
  // aug 5th 2021
  { m: `#Month #Ord #Card`, t: "Date", r: "month-day-year" },
  // === timezones ===
  // china standard time
  { m: `(#Place|#Dem) (standard|daylight|central|mountain)? time`, t: "Timezone", r: "standard-time" },
  // eastern time
  {
    m: `(eastern|mountain|pacific|central|atlantic) (standard|daylight|summer)? time`,
    t: "Timezone",
    r: "eastern-time"
  },
  // central european time
  { m: `(central|western|eastern) european time`, t: "Timezone", r: "central-time" },
  // === nouns/nouns.js ===
  //'more' is not always an adverb
  // [rights] of man
  { m: "[(right|rights)] of .", g: 0, t: "NN", r: "right-of" },
  // we [all]
  { m: "(we|us) [all]", g: 0, t: "NN", r: "we-all" },
  // due to [weather]
  { m: "due to [#V]", g: 0, t: "NN", r: "due-to" },
  // my first [thought]
  { m: "#Poss #Ord [#Past]", g: 0, t: "NN", r: "first-thought" },
  // the nice [walk]
  {
    m: "(the|this|those|these) #Adj [%Noun|Verb%]",
    g: 0,
    t: "NN",
    n: "#Cop",
    r: "adj-verb"
  },
  // the truly nice [swim]
  { m: "(the|this|those|these) #Adv #Adj [#V]", g: 0, t: "NN", r: "det-adv-verb" },
  // the [message] from Danny
  { m: "the [#V] #Prep .", g: 0, t: "NN", r: "det-verb-prep" },
  // a type of [shout]
  { m: "#Det #NN of [#V]", g: 0, t: "NN", n: "#Ger", r: "noun-of-noun" },
  // waited until [release]
  {
    m: "#Past #Prep [#Pres]",
    g: 0,
    n: "#Ger",
    t: "NN",
    r: "ended-in-ruins"
  },
  // water-flows
  { m: "(#Sing && @hasHyphen) #Pres", t: "NN", r: "hyphen-verb" },
  // is no [going] back
  { m: "is no [#V]", g: 0, t: "NN", r: "is-no-verb" },
  // what the [hell]
  { m: "#Det [(shit|damn|hell)]", g: 0, t: "NN", r: "swears-noun" },
  // go to [shit]
  { m: "to [(shit|hell)]", g: 0, t: "NN", r: "to-swears" },
  // and check this out! a [walk-in] microwave.
  {
    m: "(the|those|these|a|an) #Adj? [(#Pres && !#Ger && !#Cop && !seem && !appear && !include) #Prt?]",
    g: 0,
    t: "NN",
    n: "the (poor|rich|young|old|elderly|unemployed|homeless|disabled)",
    r: "det-inf"
  },
  // ==== Actor ====
  // Aircraft designer
  { m: "#NN #Actor", t: "Actor", n: "(#Pers|#Pron)", r: "thing-doer" },
  // lighting designer
  { m: "#Ger #Actor", t: "Actor", r: "ger-doer" },
  // captain sanders
  // { match: '[#Actor+] #ProperNoun', group: 0, tag: 'Honorific', reason: 'sgt-kelly' },
  // co founder
  { m: `co #Sing`, t: "Actor", r: "co-noun" },
  // [aircraft] designer
  {
    m: `[#NN+] #Actor`,
    g: 0,
    t: "Actor",
    n: "(#Hon|#Pron|#Poss)",
    r: "air-traffic"
  },
  // fine-artist
  {
    m: `(urban|cardiac|cardiovascular|respiratory|medical|clinical|visual|graphic|creative|dental|exotic|fine|certified|registered|technical|virtual|professional|amateur|junior|senior|special|pharmaceutical|theoretical)+ #NN? #Actor`,
    t: "Actor",
    r: "fine-artist"
  },
  // dance coach
  {
    m: `#NN+ (coach|chef|king|engineer|fellow|personality|boy|girl|man|woman|master)`,
    t: "Actor",
    r: "dance-coach"
  },
  // chief design officer
  { m: `chief . officer`, t: "Actor", r: "chief-officer" },
  // chief of police
  { m: `chief of #NN+`, t: "Actor", r: "chief-police" },
  // president of marketing
  { m: `senior? vice? president of #NN+`, t: "Actor", r: "president-of" },
  // ==== Singular ====
  // did a [900], paid a [20]
  { m: "#V (a|an) [#Value]$", g: 0, t: "Sing", r: "did-a-value" },
  // the [can]
  { m: "the [(can|will|may)]", g: 0, t: "Sing", r: "can" },
  // ==== Possessive ====
  // John Smith's
  { m: "#First #Acronym? (#Poss && #Last)", t: "Poss", r: "name-poss" },
  // Microsoft Research's office
  { m: "#Org+ #Poss", t: "Poss", r: "org-poss" },
  // Los Angeles's fundraiser
  { m: "#Place+ #Poss", t: "Poss", r: "place-poss" },
  // my butt smells
  { m: "#Poss #Pres #Prt?", n: "(#Ger|her)", t: "NN", r: "poss-verb" },
  // anna's eating vs anna's eating lunch
  // my [teachers] dog
  { m: "(my|our|their|her|his|its) [(#Plur && #Actor)] #NN", g: 0, t: "Poss", r: "my-dads" },
  // 10th of a [second]
  { m: "#Value of a [second]", g: 0, u: "Value", t: "Sing", r: "10th-second" },
  // the euro [sense]
  {
    m: `#Det #NN [${infNouns}] !(#Prep|to|#Adv)?`,
    g: 0,
    t: "NN",
    r: "noun-sense"
  },
  // [thanks] for the gift are overdue
  { m: "[#Pres] (of|by|for) (a|an|the) #NN #Cop", g: 0, t: "Plur", r: "photographs-of" },
  // You eat and [sleep]
  { m: "#Inf and [%Noun|Verb%]", g: 0, t: "Inf", r: "fight-and-win" },
  // dogs and [running] and cats
  { m: "#NN and [#V] and #NN", g: 0, t: "NN", r: "and-flowers" },
  // the 1992 [classic]
  { m: "the #Card [%Adj|Noun%]", g: 0, t: "NN", r: "1992-classic" },
  // This is the [premier] university in Virginia
  { m: "#Cop the [%Adj|Noun%] #NN", g: 0, t: "Adj", r: "premier-uni" },
  // i ate [me] sandwich (scottish slang)
  // { m: 'i #V [me] #NN', g: 0, t: 'Poss', r: 'scottish-me' },
  // He bowed his [head] in prayer
  { m: "#Past #Poss [#V]", g: 0, t: "NN", n: "(saw|made)", r: "left-her-boots" },
  // 35 [signs]
  { m: "#Value [%Plural|Verb%]", g: 0, t: "Plur", n: "(one|1|a|an)", r: "35-signs" },
  // had [time]
  { m: "had [%Noun|Verb%]", g: 0, t: "NN", n: "(#Ger|come|become)", r: "had-time" },
  // instant access
  { m: "%Adj|Noun% %Noun|Verb%", t: "#Adj #NN", n: "#Prop #NN", r: "instant-access" },
  // near death experiences, ambitious sales [targets]
  {
    m: "#Adj #NN [%Plural|Verb%]$",
    g: 0,
    t: "Plur",
    n: "#Pron",
    r: "near-death"
  },
  // your guild [colors]
  { m: "#Poss #NN [(colors|colours)]$", g: 0, t: "Plur", r: "guild-colors" },
  // === verbs/noun-gerund.js ===
  // the [upcoming thank]-you
  { m: "(this|that|the|a|an) [#Ger #Inf]", g: 0, t: "Sing", r: "planning" },
  // the [upcoming thank]-you
  { m: "(that|the) [#Ger #Pres]", g: 0, ifNo: "#Cop", t: "Plur", r: "paving-stones" },
  // lexical [tagging]
  { m: "#Adj [#Ger]", g: 0, t: "NN", n: "(still|even|just)", r: "early-warning" },
  // [walking] is cool
  { m: "[#Ger] #Adv? not? #Cop", g: 0, t: "Activity", r: "ger-cop" },
  // are [doing] is
  { m: "#Cop [(#Ger|#Activity)] #Cop", g: 0, t: "Ger", r: "are-doing-is" },
  // responsibility for [setting]
  { m: "#Sing for [%Noun|Gerund%]", g: 0, t: "Ger", r: "noun-for-ger" },
  // better for [training]
  { m: "#Comp (for|at) [%Noun|Gerund%]", g: 0, t: "Ger", r: "better-for-ger" },
  // apologized for [shouting]
  {
    m: "(#Past|#Pres) for [%Noun|Gerund%]",
    g: 0,
    t: "Ger",
    r: "for-shouting"
  },
  // he reads the [upcoming]
  { m: "#Pres the [#Ger]", g: 0, t: "NN", r: "touching" },
  // === verbs/verb-noun.js ===
  // A final button label is an object, not a second verb.
  ...["click", "clicks", "selects", "pick", "picks"].map((word) => ({
    m: `(#Pron|#Sing|#Plur) [${word} (submit|save|cancel)]$`,
    g: 0,
    t: "Pres NN",
    r: "click-button"
  })),
  // Common intransitive predicates after a singular subject. Keep arbitrary
  // plural/verb switches conservative: 'the dog treats' is a noun phrase.
  // the dog [runs]
  ...["runs", "walks", "barks", "swims", "sleeps"].map((word) => ({
    m: `^(#Det|#Poss) #Adj+? #Sing #Adv+? [${word}] #Adv+?$`,
    g: 0,
    t: "Pres",
    r: "sing-subj-verb"
  })),
  // with heads and [arms] rolling around
  // { m: '#Prep #Plur and [%Plural|Verb%] #Ger', g: 0, t: 'Plur', r: 'coord-pl' },
  // he can solve the [puzzle]
  { m: "#Inf (this|that|the) [#Inf]", g: 0, t: "NN", r: "do-this-dance" },
  // keeping the [matter] a secret
  { m: "#Ger #Det [#Inf]", g: 0, t: "NN", r: "running-a-show" },
  // the-only-[reason]
  {
    m: "#Det (only|further|just|more|backward) [#Inf]",
    g: 0,
    t: "NN",
    r: "only-reason"
  },
  // the [slide] makes noise
  { m: "(the|this|a|an) [#Inf] #Adv? #V", g: 0, t: "NN", r: "det-verb-subj" },
  // Use a pointed [stick] (a pencil) or a similar tool
  {
    m: "#Det #Adj #Adj? [#Inf]",
    g: 0,
    t: "NN",
    n: "the (poor|rich|young|old|elderly|unemployed|homeless|disabled)",
    r: "a-nice-inf"
  },
  // the American [thank]-you letter
  { m: "#Det #Dem [#Pres]", g: 0, t: "NN", r: "mexican-train" },
  // the next career [read] is brief
  { m: "#Adj #NN+ [#Inf] #Cop", g: 0, t: "NN", r: "career-move" },
  // at some [thank]-you party
  { m: "at some [#Inf]", g: 0, t: "NN", r: "at-some-inf" },
  // goes [to sleep]
  { m: "(go|goes|went) [to (sleep|work)]", g: 0, t: "Prep NN", r: "goes-to-verb" },
  // a dog [retrieve] in the field
  ...["a", "an"].map((word) => ({
    m: `${word} #Adj? #NN [#Inf] (#Prep|#NN)`,
    g: 0,
    n: "from",
    t: "NN",
    r: "a-noun-inf"
  })),
  // a software [reinstall]
  { m: "(a|an) #NN [#Inf]$", g: 0, t: "NN", r: "noun-inf-end" },
  // working for [thank]-you letters
  { m: "#Ger #Adj? for [#Inf]", g: 0, t: "NN", r: "running-for" },
  // artists on [thank]-you cards
  { m: "#Plur on [#Inf]", g: 0, t: "NN", r: "on-stage" },
  // number of [thank]-yous
  { m: "number of [#Pres]", g: 0, t: "NN", r: "number-of-x" },
  // make [sense]
  {
    m: "(try|use|attempt|build|make) [%Noun|Verb% #Prt?]",
    n: "(#Cop|#NN|sure|fun|up)",
    g: 0,
    t: "NN",
    r: "do-verb"
  },
  //make sure of
  // [append] is cloned
  { m: "^[#Inf] (is|was)", g: 0, t: "NN", r: "checkmate-is" },
  // get much [thank]-you mail
  // { m: '#Inf much [#Inf]', g: 0, t: 'NN', r: 'get-much' },
  // [cause] i gotta
  { m: "[cause] #Pron #V", g: 0, t: "Conj", r: "cause-cuz" },
  // the US [air] force
  // {
  //   m: 'the #Sing [#Inf] (#NN && !#Poss)',
  //   g: 0,
  //   t: 'NN',
  //   n: '#Pron',
  //   r: 'cardio-dance',
  // },
  // this [rocks]
  { m: "this [#Plur]", g: 0, t: "Pres", n: "(#Prep|#Date)", r: "this-verbs" },
  // the thing [that runs]
  {
    m: "#NN [that %Plural|Verb%]",
    g: 0,
    t: "Conj Pres",
    n: "(#Prep|#Pron|way)",
    r: "that-rocks"
  },
  // that [leads] to
  // { m: 'that [#Plur] to', g: 0, t: 'Pres', n: '#Prep', r: 'that-leads-to' },
  // let him [father] a child
  ...["let", "make", "made"].map((word) => ({
    m: `${word} (him|her|it|#Pers|#Place|#Org)+ [#Sing] (a|an|the|it)`,
    g: 0,
    t: "Inf",
    r: "let-him-glue"
  })),
  // assign all [tasks]
  {
    m: "#V (all|every|each|most|some|no) [#Pres]",
    n: "#Mod",
    g: 0,
    t: "NN",
    r: "quant-verb-noun"
  },
  // PresentTense/Noun ambiguities
  // Possession and copulas; other past verbs use wide-support below.
  {
    m: "(had|have|was|were) #Adj [#Pres]",
    g: 0,
    t: "NN",
    n: "better",
    r: "adj-verb-noun"
  },
  // one big [thank]-you
  { m: "#Value #Adj [#Pres]", g: 0, t: "NN", n: "#Cop", r: "one-big-reason" },
  // found all [upcoming] words
  {
    m: "#Past #Adj+ [#Pres]",
    g: 0,
    t: "NN",
    n: "(#Cop|better)",
    r: "wide-support"
  },
  // many [thanks]
  { m: "(many|few|several|couple) [#Pres]", g: 0, t: "NN", n: "#Cop", r: "many-poses" },
  // a very big [dream]
  {
    m: "#Det #Adv #Adj [%Noun|Verb%]",
    g: 0,
    t: "NN",
    n: "#Cop",
    r: "very-big-dream"
  },
  // from start to [finish]
  { m: "from #NN to [%Noun|Verb%]", g: 0, t: "NN", r: "start-finish" },
  // for comparison or [contrast]
  {
    m: "(for|with|of) #NN (and|or|not) [%Noun|Verb%]",
    g: 0,
    t: "NN",
    n: "#Pron",
    r: "food-and-gas"
  },
  // cute little [thank]-you bags
  { m: "#Adj #Adj [#Pres]", g: 0, t: "NN", n: "#Cop", r: "little-store" },
  // writing bigger [thank]-you notes
  {
    m: "#Ger #Adv? #Comp [#Pres]",
    g: 0,
    t: "NN",
    n: "#Cop",
    r: "higher-costs"
  },
  // to write people [thanks] for helping
  { m: `to #Pres #NN [#Pres] #Prep`, g: 0, t: "NN", r: "gas-exchange" },
  // waited until [release]
  // {
  //   m: `#Past (until|as|through|without) [(#Pres && !#Ger && !#Cop)]`,
  //   g: 0,
  //   t: 'NN',
  //   r: 'until-release',
  // },
  // selling like hot [thank]-you cards
  { m: `#Ger like #Adj? [#Pres]`, g: 0, t: "Plur", r: "like-hot-cakes" },
  // some nice [thank]-you notes
  { m: `some #Adj [#Pres]`, g: 0, t: "NN", r: "some-reason" },
  // for some [thank]-you letters
  { m: `for some [#Pres]`, g: 0, t: "NN", r: "for-some" },
  // same kind of [shouts]
  { m: `(same|some|the|that|a) kind of [#Pres]`, g: 0, t: "NN", r: "some-kind-of" },
  // a type of [shout]
  { m: `(same|some|the|that|a) type of [#Pres]`, g: 0, t: "NN", r: "some-type-of" },
  // looking good in [thank]-you photos
  { m: `#Ger #Adj #Prep [#Pres]`, g: 0, t: "NN", r: "better-for" },
  // get better [thank]-you notes
  { m: `(get|got|have) #Comp [#Pres]`, g: 0, t: "NN", r: "got-better-aim" },
  // give up on [thank]-you letters
  { m: `#PhrV #Prt #Prep [#Pres]`, g: 0, t: "NN", r: "given-up-on-x" },
  // there are [thank]-you notes
  { m: "there (are|were) #Adj? [#Pres]", g: 0, t: "Plur", r: "there-are" },
  // a thousand [thanks] of gratitude
  {
    m: "#Value [#Pres] of",
    g: 0,
    n: "(one|1|#Cop|#Inf)",
    t: "Plur",
    r: "2-trains"
  },
  // [thanks] are appreciated
  { m: "[#Pres] (are|were) #Adj", g: 0, t: "Plur", r: "compromises" },
  // [hope] i helped
  { m: "^[(hope|guess|thought|think)] #Pron #V", g: 0, t: "Inf", r: "suppose-i" },
  // its proper [functioning]
  { m: "#Poss #Adj [#V]", g: 0, t: "NN", n: "#Cop", r: "full-support" },
  // [tastes] good
  { m: "[(tastes|smells)] #Adv? #Adj", g: 0, t: "Pres", r: "tastes-good" },
  // Being introduces a predicate rather than a direct object.
  // she is writing [thank]-you letters
  {
    m: "#Cop (#Ger && !being) [(#Pres && !#Ger)] !by?",
    g: 0,
    t: "NN",
    n: "going",
    r: "ignoring"
  },
  // the [shed]
  { m: "#Det #Adj? [(shed|thought|rose|bid|saw|spelt)]", g: 0, t: "NN", r: "noun-past" },
  // how to [watch]
  { m: "how to [%Noun|Verb%]", g: 0, t: "Inf", r: "how-to-noun" },
  // ready to [stream]
  {
    m: "(ready|available|difficult|hard|easy|made|attempt|try) to [%Noun|Verb%]",
    g: 0,
    t: "Inf",
    r: "ready-to-noun"
  },
  // bring [to market]
  {
    m: "(bring|went|go|drive|run|bike) [to (market|work|court|school|bed|church|prison)]",
    g: 0,
    t: "Prep NN",
    r: "bring-to-noun"
  },
  // can i [sleep], would you [look]
  { m: "#Mod #NN [%Noun|Verb%]", g: 0, t: "Inf", r: "would-you-look" },
  // is just [spam]
  { m: "#Cop just [#Inf]", g: 0, t: "NN", r: "is-just-spam" },
  // request copies
  { m: "^%Noun|Verb% %Plural|Verb%", t: "Imp #Plur", r: "req-copies" },
  // homemade pickles and [drinks]
  { m: "#Adj #Plur and [%Plural|Verb%]", g: 0, t: "#Plur", r: "and-drinks" },
  // the 1968 [stand]-off
  { m: "#Det #Year [#V]", g: 0, t: "NN", r: "1968-film" },
  // the [break up]
  { m: "#Det [#PhrV #Prt]", g: 0, t: "NN", r: "break-up" },
  // the [individual] goals
  {
    m: "#Det [%Adj|Noun%] #NN",
    g: 0,
    t: "Adj",
    n: "(#Pron|#Poss|#Prop)",
    r: "individual"
  },
  // [work] or prepare
  { m: "^[%Noun|Verb%] or #Inf", g: 0, t: "Inf", r: "work-or" },
  // to give [thanks]
  {
    m: "to #Inf [#Pres]",
    g: 0,
    t: "NN",
    n: "(#Ger|#Cop|help)",
    r: "to-give-thanks"
  },
  // [Google] me
  { m: "[(#NN && !#Pron)] me", g: 0, t: "V", r: "kills-me" },
  // removes wrinkles
  { m: "%Plural|Verb% %Plural|Verb%", t: "#Pres #Plur", r: "removes" },
  // i [Google] the answer
  { m: "i [#NN] the #NN", g: 0, t: "Inf", r: "i-water" },
  // did the engine [stop]
  {
    m: "(did|does|will) the #NN [%Noun|Verb%]",
    g: 0,
    t: "Inf",
    r: "q-noun-verb"
  },
  // 40 gallons of [water]
  {
    m: "#Value #NN of [%Noun|Verb%]",
    g: 0,
    t: "NN",
    r: "qty-of-noun"
  },
  // When the rain [stops], we will leave. Whenever the bell [rings], the dog barks.
  // when the dog [looks]
  ...["stops", "looks", "rings"].map((word) => ({
    m: `(when|whenever|before|after|until|since|as|while|than) (#Det|#Poss) #Adj+? #NN [(%Plural|Verb% && ${word})]$`,
    g: 0,
    t: "Pres",
    r: `${word}-clause-verb`
  })),
  // The sun [rose]. The river [rose] quickly.
  {
    m: "(sun|moon|river|water|tide|temperature|prices|he|she|we|they|i) [rose] #Adv+?$",
    g: 0,
    t: "Past",
    r: "sun-rose"
  },
  // The cat [woke]. Before the dog and the cat [woke], she left.
  { m: "(#NN && !#Poss) [woke] #Adv+?$", g: 0, t: "Past", r: "cat-woke" },
  // === numbers/money.js ===
  // $5 and $6
  { m: "#Money and #Money #Currency?", t: "Money", r: "money-and" },
  // 6 dollars [and] 5 cents
  { m: "#Value #Currency [and] #Value (cents|ore|centavos|sens)", g: 0, t: "Money", r: "and-5-cents" },
  // 5 rand
  { m: "#Value (mark|rand|won|rub|ore)", t: "#Money #Currency", r: "4-mark" },
  // a pound
  { m: "a pound", t: "#Money #Unit", r: "a-pound" },
  // 3 pounds
  { m: "#Value (pound|pounds)", t: "#Money #Unit", r: "4-pounds" },
  // === numbers/fractions.js ===
  // [half] a penny
  { m: "[half] of? (a|an)", g: 0, t: "Frac", r: "half-a" },
  // [quarter] of a dollar
  { m: "[quarter] of? (a|an)", g: 0, t: "Frac", r: "quarter-a" },
  // two and a half
  { m: "#Card and a half", t: "Frac", r: "and-a-half" },
  // two-halves
  { m: "#Value (halves|halfs|quarters)", t: "Frac", r: "two-halves" },
  // [seven] fifths
  { m: "[#Card+] (#Frac && /s$/)", g: 0, t: "Frac", r: "seven-fifths" },
  // [one third] of it
  { m: "[#Card+ #Ord] of .", g: 0, t: "Frac", r: "ord-of" },
  // [100th] of it
  { m: "[(#Num && #Ord)] of .", g: 0, t: "Frac", r: "num-ord-of" },
  // [a twenty fifth] of it
  { m: "[(a|one) #Card?+ #Ord] of", g: 0, t: "Frac", r: "a-ord" },
  // a sixteenth, one twenty fifth (without a following noun)
  {
    m: "[(a|one) #Card+? (#Ord && !first && !second)]$",
    g: 0,
    t: "Frac",
    r: "solo-fraction"
  },
  // 3 out of 5
  { m: "#Card+ out? of every? #Card", t: "Frac", r: "out-of" },
  // === numbers/numbers.js ===
  // ==== Ambiguous numbers ====
  // with [a] hundred jobs
  {
    m: "!once? [(a|an)] hundred",
    g: 0,
    t: "Value",
    r: "a-hundred"
  },
  // with [a] thousand jobs
  {
    m: "!once? [(a|an)] thousand",
    g: 0,
    t: "Value",
    r: "a-thousand"
  },
  // with [a] million jobs
  {
    m: "!once? [(a|an)] million",
    g: 0,
    t: "Value",
    r: "a-million"
  },
  // with [a] billion jobs
  {
    m: "!once? [(a|an)] billion",
    g: 0,
    t: "Value",
    r: "a-billion"
  },
  // with [a] trillion jobs
  {
    m: "!once? [(a|an)] trillion",
    g: 0,
    t: "Value",
    r: "a-trillion"
  },
  // ==== PhoneNumber ====
  // 1 800 555-1234
  { m: "(1|+1) #Value #PhoneNumber", t: "PhoneNumber", r: "country-code" },
  // (454) 232-9873
  { m: "#Num #PhoneNumber", t: "PhoneNumber", r: "area-code" },
  // ==== Currency ====
  // chinese yuan
  { m: "#Dem #Currency", t: "Currency", r: "demonym-curr" },
  // ==== Money ====
  // [5] dollars
  { m: "[#Value+] #Currency", g: 0, t: "Money", r: "value-curr" },
  // ==== Ordinal ====
  // ==== Units ====
  // 5 [dollars]
  { m: "#Value+ [#Currency]", g: 0, t: "Unit", r: "curr-unit" },
  // 5 [feet]
  { m: "#Value [(foot|feet)]", g: 0, t: "Unit", r: "foot-unit" },
  // kilometers an hour
  { m: "#Unit an hour", t: "Unit", r: "unit-an-hour" },
  // ==== Magnitudes ====
  // minus 7
  { m: "(minus|negative) #Value", t: "Value", r: "minus-value" },
  // seven point five
  { m: "#Value (point|decimal) #Value", t: "Value", r: "decimal-point" },
  // thousand and two
  { m: `#Multiple+ and #Value`, t: "Value", r: "mag-and-value" },
  // 5 miles [per hour]
  { m: "#Value #Unit [(per|an) (hr|hour|sec|second|min|minute)]", g: 0, t: "Unit", r: "unit-per-dur" },
  // twelve percent
  { m: "#Card percent", t: "#Percent #Unit", r: "value-percent" },
  // === person/person-phrase.js ===
  // ==== FirstNames ====
  // is [foo] Smith
  {
    m: "#Cop [(#NN|#Pres)] #Last",
    g: 0,
    t: "First",
    n: "#Ger",
    r: "cop-noun-last"
  },
  // pope francis
  {
    m: "(sister|pope|brother|father|aunt|uncle|grandpa|grandfather|grandma) #Prop",
    t: "Pers",
    r: "lady-title",
    safe: true
  },
  // ==== Nickname ====
  // Dwayne '[the rock]' Johnson
  { m: "#First [#Det #NN] #Last", g: 0, t: "Pers", r: "first-noun-last" },
  // John b Smith
  {
    m: "#Prop (b|c|d|e|f|g|h|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z) #Prop",
    t: "Pers",
    r: "name-init-name",
    safe: true
  },
  // J. Smith
  { m: "#Acronym #Last", t: "Pers", r: "acro-last", safe: true },
  // John jr
  { m: "#Pers (jr|sr|md)", t: "Pers", r: "person-hon" },
  // Dr. J.
  { m: "#Hon #Acronym", t: "Pers", r: "hon-init" },
  // John Smith III
  { m: "#Pers #Pers the? #RomanNumeral", t: "Pers", r: "roman-numeral" },
  // John [b]
  { m: "#First [/^[bdefghjlmnopqstvwxyz]$/]", g: 0, t: ["Acronym", "Pers"], r: "john-e" },
  // Ludwig van Beethoven
  { m: "#NN van der? #NN", t: "Pers", r: "van-der-noun", safe: true },
  // king of spain
  { m: "(king|queen|prince|saint|lady) of #NN", t: "Pers", r: "king-of-noun", safe: true },
  // prince Paris
  { m: "(prince|lady) #Place", t: "Pers", r: "lady-place" },
  // saint Foo
  { m: "(king|queen|prince|saint) #Prop", t: "Pers", n: "#Place", r: "saint-foo" },
  // al Smith
  { m: "al (#Pers|#Prop)", t: "Pers", r: "al-borlen", safe: true },
  // ferdinand de almar
  { m: "#First de #NN", t: "Pers", r: "bill-de-noun" },
  // Osama bin Laden
  { m: "#First (bin|al) #NN", t: "Pers", r: "bill-al-noun" },
  // John L. Foo
  { m: "#First #Acronym #Prop", t: "Pers", r: "bill-acro-title" },
  // Mr Foo
  { m: "#Hon #First? #Prop", t: "Pers", r: "dr-john-title" },
  // peter the great
  { m: "#First the #Adj", t: "Pers", r: "name-the-great" },
  // John van Smith
  { m: "#Prop (van|al|bin) #Prop", t: "Pers", r: "title-van-title", safe: true },
  // jose de Sucre
  { m: "#Prop (de|du) la? #Prop", t: "Pers", n: "#Place", r: "title-de-title" },
  // Jani K. Smith
  { m: "#Sing #Acronym #Last", t: "#First #Pers .", r: "title-acro-noun", safe: true },
  // [Toronto] John
  { m: "[#Prop] #Pers", g: 0, t: "Pers", r: "proper-person", safe: true },
  // john [keith jones]
  {
    m: "#Pers [#Prop #Prop]",
    g: 0,
    t: "Pers",
    n: "#Poss",
    r: "three-names",
    safe: true
  },
  // John [Foo]
  {
    m: "#First #Acronym? [#Prop]",
    g: 0,
    t: "Last",
    n: "#Poss",
    r: "first-title"
  },
  // Joe K. Sombrero
  { m: "#First #Acronym #NN", t: "Pers", r: "n-acro-noun", safe: true },
  // Anthony [de] Marco
  { m: "#First [(de|di|du|van|von)] #Pers", g: 0, t: "Last", r: "de-first" },
  // baker jenna smith
  // { match: '[#Actor+] #Person', group: 0, tag: 'Person', reason: 'baker-sam' },
  // [sergeant] major Harold
  {
    m: "[(lieutenant|corporal|sergeant|captain|qeen|king|admiral|major|colonel|marshal|president|queen|king)+] #Prop",
    g: 0,
    t: "Hon",
    r: "sergeant-john"
  },
  // ==== Honorics ====
  // [general] John
  {
    m: "[(private|general|major|rear|prime|field|count)] #Hon? #Pers",
    g: 0,
    t: ["Hon", "Pers"],
    r: "ambg-hon"
  },
  // [Miss] John
  { m: "[(miss && @isTitleCase)] #Pers", g: 0, t: ["Hon", "Pers"], r: "miss-hon" },
  // dr john [foobar]
  {
    m: "#Hon #First [#Sing]",
    g: 0,
    t: "Last",
    n: "#Poss",
    r: "dr-john-foo",
    safe: true
  },
  // [his excellency] John
  {
    m: "[(his|her) (majesty|honour|worship|excellency|honorable)] #Pers",
    g: 0,
    t: "Hon",
    r: "his-excellency"
  },
  // Dr teacher
  { m: "#Hon #Actor", t: "Hon", r: "lt-colonel" },
  // [first lady] michelle obama
  { m: "[first lady] #Pers", g: 0, t: "Hon", r: "first-lady" },
  // first lady, second admiral
  { m: "(first|second|third|1st|2nd|3rd) lieutenant", t: "Hon", r: "ord-lt" },
  // Louis IV
  { m: "#Pers #RomanNumeral", t: "Pers", r: "louis-iv" },
  // === person/ambig-name.js ===
  // const personAdj = '(misty|rusty|dusty|rich|randy|sandy|young|earnest|frank|brown)'
  // ebenezer scrooge
  {
    m: "#First #NN$",
    t: ". #Last",
    n: "(#Poss|#Org|#Place|#Pron|@hasTitleCase)",
    r: "first-noun"
  },
  // June Smith
  { m: "%Person|Date% #Acronym? #Prop", t: "Pers", r: "jan-thierson" },
  // ===person-noun===
  // Cliff Clavin
  { m: "%Person|Noun% #Acronym? #Prop", t: "Pers", r: "switch-person", safe: true },
  // Rose Microsoft
  { m: "%Person|Noun% #Org", t: "Org", r: "olive-garden" },
  // ===person-verb===
  // Ollie Faroo
  { m: "(%Person|Verb% && #Pers) #Acronym? #Prop", t: "Pers", r: "verb-proper", ifNo: "#Actor" },
  // ===person-verb===
  // really [wade]
  { m: `#Adv [(%Person|Verb% && !@isTitleCase)]`, g: 0, t: "V", r: "really-mark" },
  // [drew] closer
  { m: `[%Person|Verb%] (#Adv|#Comp)`, g: 0, t: "V", r: "drew-closer" },
  // wade smith
  { m: `(%Person|Verb% && #Pers) #Pers`, t: "Pers", r: "rob-smith" },
  // Wade G. Slapgoop
  { m: `%Person|Verb% #Acronym #Prop`, t: "Pers", r: "rob-a-smith" },
  // Will Smith
  { m: "(will && @isTitleCase) #Prop", t: "Pers", r: "will-name" },
  // jack [layton] won
  {
    m: "(#First && !#Poss) [#Sing] #V",
    g: 0,
    safe: true,
    t: "Last",
    r: "jack-layton"
  },
  // [captain] John walks
  { m: "^[#Sing] #Pers #V", g: 0, safe: true, t: "Pers", r: "sherwood" },
  // === verbs/verbs.js ===
  // is [pretty] good
  {
    m: "#Cop [(pretty|dead|full|well|sure)] #Adj",
    g: 0,
    t: "Adv",
    r: "sometimes-adv"
  },
  // i [better] go
  { m: "(#Pron|#Pers) (had|#Adv)? [better] #Pres", g: 0, t: "Mod", r: "i-better" },
  // adj -> gerund
  // i [like]
  { m: "(#Mod|i|they|we|do) not? [like]", g: 0, t: "Pres", r: "modal-like" },
  // ==== Tense ====
  // he [left]
  { m: "(#NN && !#Poss) #Adv? [left]", g: 0, t: "Past", r: "left-verb" },
  // she [bit] her tongue
  { m: "#NN #Adv? [(bit && #Inf)]", g: 0, t: "Past", r: "bit-past" },
  // will [be] running
  { m: "will #Adv? not? #Adv? [be] #Ger", g: 0, t: "Cop", r: "will-be-cop" },
  // will [be] nice
  { m: "will #Adv? not? #Adv? [be] #Adj", g: 0, t: "Cop", r: "be-cop" },
  // [march] up
  { m: "[march] (up|down|back|toward)", n: "#Date", g: 0, t: "Inf", r: "march-to" },
  // birds [home] to their nest
  { m: "(#Pron|#Plur|#Mod) #Adv+? [home] to", g: 0, t: "Inf", r: "birds-home-to" },
  // is [home] to birds
  { m: "(#Cop|be|been|being) #Adv+? [home] to", g: 0, t: "NN", r: "is-home-to" },
  // is [subject] to change
  {
    m: "(#Cop|be|been|being|remain|remains|remained) #Adv+? [subject] to",
    g: 0,
    t: "Adj",
    r: "is-subj-to"
  },
  // is subject [to]
  {
    m: "(#Cop|be|been|being|remain|remains|remained) #Adv+? subject [to]",
    g: 0,
    u: "Conj",
    t: "Prep",
    r: "pred-to"
  },
  // is subject to [change]
  {
    m: "(#Cop|be|been|being|remain|remains|remained) #Adv+? subject to [%Noun|Verb%]",
    g: 0,
    t: "NN",
    r: "pred-to-noun"
  },
  // is home [to] dogs
  {
    m: "(#Cop|be|been|being) #Adv+? home [to] #Adj+? #NN",
    g: 0,
    u: "Conj",
    t: "Prep",
    r: "home-to-noun"
  },
  // === misc==
  // were being [run]
  { m: `(were|was) being [#Pres]`, g: 0, t: "Past", r: "was-being" },
  // had [been broken]
  {
    m: `(had|has|have) [been (#Past && /en$/)]`,
    g: 0,
    t: "Aux Part",
    r: "been-broken"
  },
  // had [been smoked]
  { m: `(had|has|have) [been (#Past && /ed$/)]`, g: 0, t: "Aux Past", r: "been-smoked" },
  // had [been] eaten
  { m: `(had|has) #Adv? [been] #Adv? #Past`, g: 0, t: "Aux", r: "had-been-adj" },
  // had to [Google] the answer
  ...["had", "has"].map((word) => ({
    m: `${word} to [#NN] (#Det|#Poss)`,
    g: 0,
    t: "Inf",
    r: "had-to-noun"
  })),
  // does that [work]
  {
    m: `(do|does|did|#Mod) (this|that|these|those) [work]`,
    g: 0,
    t: "Inf",
    r: "does-that-work"
  },
  // have read
  { m: `(has|have|had) read`, t: "Aux Part", r: "read-read" },
  // jobs that fit
  { m: "#Plur that %Noun|Verb%", t: ". #Prep #Inf", r: "jobs-that-work" },
  // [works] for me
  { m: "[works] for me", g: 0, t: "Pres", r: "works-for-me" },
  // as we [please]
  { m: "as #Pron [please]", g: 0, t: "Inf", r: "as-we-please" },
  // verb-prefixes - '[co] write'
  // [co] write
  {
    m: "[(co|mis|de|inter|intra|pre|re|un|counter)] #V",
    g: 0,
    t: ["V", "Prefix"],
    n: "(#Cop|#PhrV)",
    r: "co-write"
  },
  // [out] run
  { m: "[(out|under|over)] #Inf", g: 0, t: ["V", "Prefix"], r: "dir-verb-pre" },
  // dressed and [left]
  { m: "#Past and [%Adj|Past%]", g: 0, t: "Past", r: "past-and-ambig" },
  // [melted] and fallen
  { m: "[(%Adj|Past% && !#Adj)] and #Past", g: 0, t: "Past", r: "ambig-and-past" },
  // is he [stoked]
  { m: "#Cop #Pron [%Adj|Past%]", g: 0, t: "Adj", r: "is-he-stoked" },
  // to [dream] of
  { m: "to [%Noun|Verb%] #Prep", g: 0, t: "Inf", r: "to-dream-of" },
  // === adjective/adj-verb.js ===
  // Resume fragments: developed [scalable React] architecture.
  {
    m: "^[developed] (#Adj|#Prop)+? (backend|frontend|software|architecture|applications|apps|systems)",
    g: 0,
    t: "Past",
    n: "(#Pres|#Cop|#Mod)",
    r: "developed"
  },
  // does [mean]
  { m: "does (#Adv|not)? [%Adj|Present%]", g: 0, t: "Inf", r: "does-mean" },
  // [okay] by me
  { m: "[(fine|okay|cool|ok)] by me", g: 0, t: "Adj", r: "okay-by-me" },
  // i [mean]
  { m: "i (#Adv|do)? not? [mean]", g: 0, t: "Pres", r: "i-mean" },
  // the ship will near the coast
  { m: "will #Adj", t: "Aux Inf", r: "will-adj" },
  // I [frequent] this restaurant
  { m: "#Pron [#Adj] #Det #Adj? #NN", g: 0, t: "V", r: "he-adj-the" },
  // rude and [insulting]
  {
    m: "#Adj and [(%Adj|Gerund% && #Ger)] !#Prep?",
    g: 0,
    t: "Adj",
    r: "rude-and-x"
  },
  // got [tired] of
  { m: "got #Adv? [%Adj|Past%] of", g: 0, t: "Adj", r: "got-tired-of" },
  // felt [cheated]
  {
    m: "(seem|seems|seemed|appear|appeared|appears|feel|feels|felt|sound|sounds|sounded) (#Adv|#Adj)? [#Past]",
    g: 0,
    t: "Adj",
    r: "felt-loved"
  },
  // felt [cheated]
  // { m: '(seem|feel|seemed|felt) [#Past #Prt?]', g: 0, t: 'Adj', r: 'seem-confused' },
  // a bit [confused]
  { m: "a (bit|little|tad) [#Past #Prt?]", g: 0, t: "Adj", r: "a-bit-confused" },
  // do not be [embarrassed]
  { m: "not be [%Adj|Past% #Prt?]", g: 0, t: "Adj", r: "not-be-adj" },
  // is just [tired]
  { m: "#Cop just [%Adj|Past% #Prt?]", g: 0, t: "Adj", r: "is-just-right" },
  // [failed] and oppressive
  { m: "[%Adj|Past%] and #Adj", g: 0, t: "Adj", r: "failed-and" },
  // the fear or [heightened] emotion
  {
    m: "(#Det|#Prep) #Adj? #NN or [#Past] #NN",
    g: 0,
    t: "Adj",
    n: "(#Cop|#Pron)",
    r: "or-heightened"
  },
  // tired and overworked describes a state after a copula
  {
    m: "#Cop #Adv? #Adj and [(overworked|overwhelmed|overpaid|underpaid|overqualified|underqualified|understaffed)]$",
    g: 0,
    t: "Adj",
    r: "coord-state"
  },
  // their [declared] intentions
  { m: "#Poss [#Past] #NN", g: 0, n: "#Cop", t: "Adj", r: "declared" },
  // is he [cool]
  { m: "#Cop #Pron [%Adj|Present%]", g: 0, t: "Adj", r: "is-he-cool" },
  // is [crowded] with
  {
    m: "#Cop [%Adj|Past%] with",
    g: 0,
    t: "Adj",
    n: "(associated|worn|baked|aged|armed|bound|fried|loaded|mixed|packed|pumped|filled|sealed)",
    r: "crowded-with"
  },
  // is [empty]
  { m: "#Cop #Adv? [%Adj|Present%]$", g: 0, t: "Adj", r: "cop-adj" },
  // she is being [cool]
  { m: "being #Adv? [%Adj|Present%]", g: 0, t: "Adj", r: "being-adj" },
  // does the store [open]
  {
    m: "(does|will) #Det #NN [%Adj|Present%]$",
    g: 0,
    t: "Inf",
    r: "q-adj-verb"
  },
  // === verbs/auxiliary.js ===
  // these are some of our heaviest-used matches
  // ought not [to] walk
  {
    m: "ought (#Adv|not)+? [to] (#Adv|not)+? #V",
    g: 0,
    t: "Aux",
    r: "ought-to"
  },
  // ought to [be] walking
  {
    m: "ought (#Adv|not)+? to (#Adv|not)+? [be] (#Adv|not)+? #V",
    g: 0,
    t: "Aux",
    r: "ought-to-be"
  },
  // will [have] walked
  { m: `will (#Adv|not)+? [have] (#Adv|not)+? #V`, g: 0, t: "Aux", r: "will-have-vb" },
  // [was] walking
  { m: `[#Cop] (#Adv|not)+? (#Ger|#Past)`, g: 0, t: "Aux", r: "cop-walking" },
  // [would] walk
  { m: `[(#Mod|did)+] (#Adv|not)+? #V`, g: 0, t: "Aux", r: "modal-verb" },
  // would [have] [had] to go
  {
    m: `#Mod (#Adv|not)+? [have] (#Adv|not)+? [had] (#Adv|not)+? #V`,
    g: 0,
    t: "Aux",
    r: "would-have"
  },
  // [has] walked
  { m: `[(has|had)] (#Adv|not)+? #Past`, g: 0, t: "Aux", r: "had-walked" },
  // [will] walk
  {
    m: "[(do|does|did|will|have|had|has|got)] (not|#Adv)+? #V",
    g: 0,
    t: "Aux",
    r: "have-had"
  },
  // [about to] go
  { m: "[about to] #Adv? #V", g: 0, t: ["Aux", "V"], r: "about-to" },
  // would [be] walking
  { m: `#Mod (#Adv|not)+? [be] (#Adv|not)+? #V`, g: 0, t: "Aux", r: "would-be" },
  // was [being] driven
  { m: "[(be|being|been)] #Part", g: 0, t: "Aux", r: "being-driven" },
  // [may] want
  { m: "[may] #Adv? #Inf", g: 0, t: "Aux", r: "may-want" },
  // was [being] walked
  {
    m: "#Cop (#Adv|not)+? [(be|being|been)] #Adv+? #Past",
    g: 0,
    t: "Aux",
    r: "being-walked"
  },
  // [been] walking
  { m: "[(be|been)] (#Adv|not)+? #Ger", g: 0, t: "Aux", r: "been-walking" },
  // [used to] walk
  { m: "[used to] #Pres", g: 0, t: "Aux", r: "used-to-walk" },
  // was [going to] walk
  {
    m: "#Cop (#Adv|not)+? [going to] #Adv+? #Pres",
    g: 0,
    t: "Aux",
    r: "going-to-walk"
  },
  // going to [be] watched
  {
    m: "going to (#Adv|not)+? [be] (#Adv|not)+? #Past",
    g: 0,
    t: "Aux",
    r: "to-be-watched"
  },
  // there is [no] x
  { m: "(is|was) #Adv? [no]", g: 0, t: "Neg", r: "is-no" },
  // [been] told
  {
    m: "[(been|had|became|came)] #Past",
    g: 0,
    n: "#PhrV",
    t: "Aux",
    r: "been-told"
  },
  // [being] born
  { m: "[(being|having|getting)] #V", g: 0, t: "Aux", r: "being-born" },
  // [better] go
  { m: "[better] #Pres", g: 0, t: "Mod", n: "(#Cop|#Ger)", r: "better-go" },
  // even better
  { m: "even better", t: "Adv #Comp", r: "even-better" },
  // === verbs/phrasal.js ===
  // walk-up
  { m: "(#V && @hasHyphen) up", t: "PhrV", r: "foo-up" },
  // walk-off
  { m: "(#V && @hasHyphen) off", t: "PhrV", r: "foo-off" },
  // walk-over
  { m: "(#V && @hasHyphen) over", t: "PhrV", r: "foo-over" },
  // walk-out
  { m: "(#V && @hasHyphen) out", t: "PhrV", r: "foo-out" },
  // [walk in] on
  {
    m: "[#V (in|out|up|down|off|back)] (on|in)",
    g: 0,
    n: "#Cop",
    t: "PhrV Prt",
    r: "walk-in-on"
  },
  // went [on] for
  { m: "(lived|went|crept|go) [on] for", g: 0, t: "PhrV", r: "went-on" },
  // the curtains come down
  { m: "#V (up|down|in|on|for)$", t: "PhrV #Prt", n: "#PhrV", r: "come-down" },
  // work in the office
  {
    m: "#PhrV (in && #Prt) #Det",
    t: "#V #Prep #Det",
    u: "PhrV",
    r: "work-in-the"
  },
  // back it [up]
  ...["up", "down"].map((word) => ({
    m: `#V (him|her|it|us|himself|herself|itself|everything|something) [${word}]`,
    g: 0,
    t: "Adv",
    r: "phr-pron-adv"
  })),
  // runs [around] the lake
  {
    m: "#PhrV [around] the #NN",
    g: 0,
    t: "Prep",
    //(breaks the phrasal)
    r: "around-noun"
  },
  // === verbs/imperative.js ===
  // this is really hard to do
  //we do not go
  // do not [go]
  { m: "^do not? [#Inf #Prt?]", n: notIf2, g: 0, t: "Imp", r: "do-eat" },
  // please [go]
  { m: "^please do? not? [#Inf #Prt?]", g: 0, t: "Imp", r: "please-go" },
  // just [go]
  { m: "^just do? not? [#Inf #Prt?]", g: 0, t: "Imp", r: "just-go" },
  // [go] quickly.
  {
    m: "^[#Inf] (#Adj|#Adv|hard|high|fast|slow)$",
    g: 0,
    t: "Imp",
    n: "(so|such|rather|enough)",
    r: "go-quickly"
  },
  // [turn] down the noise
  { m: "^[#Inf] (up|down|over) #Det", g: 0, t: "Imp", r: "turn-down" },
  // [eat] my shorts
  {
    m: "^[#Inf] (your|my|the|a|an|any|each|every|some|more|with|on)",
    g: 0,
    n: "like",
    t: "Imp",
    r: "eat-my-shorts"
  },
  // [tell] him the story
  { m: "^[#Inf] (him|her|it|us|me|there)", g: 0, t: "Imp", r: "tell-him" },
  // [avoid] loud noises
  { m: "^[#Inf] #Adj #NN$", g: 0, t: "Imp", r: "loud-noises" },
  // [come] and have a drink
  { m: "^[#Inf] (#Adj|#Adv)? and #Inf", g: 0, t: "Imp", r: "and-reserve" },
  // Keep isolated commands here: pre-tagging also runs on replacement words.
  { m: "^[go] please?$", g: 0, t: "Imp", r: "go-imp" },
  { m: "^[stop] please?$", g: 0, t: "Imp", r: "stop-imp" },
  { m: "^[wait] please?$", g: 0, t: "Imp", r: "wait-imp" },
  { m: "^[hurry] please?$", g: 0, t: "Imp", r: "hurry-imp" },
  // let's [leave]
  { m: "^let (us|me) [#Inf]", g: 0, t: "Imp", r: "lets-leave" },
  // [shut] the door
  {
    m: "^[(shut|close|open|start|stop|end|keep)] #Det #NN",
    g: 0,
    t: "Imp",
    r: "shut-the-door"
  },
  // [turn off] the light
  { m: "^[#PhrV #Prt] #Det #NN", g: 0, t: "Imp", r: "turn-off" },
  // A modal question alone may ask about ability or knowledge. Require an
  // explicit request marker before treating it as an imperative.
  // can you please [walk]
  {
    m: "^(can|could|will|would) you (#Adv|not)+? please (#Adv|not)+? [#Inf]",
    g: 0,
    t: "Imp",
    r: "would-please"
  },
  // please can you [walk]
  {
    m: "^please (can|could|will|would) you (#Adv|not)+? [#Inf]",
    g: 0,
    t: "Imp",
    r: "please-you"
  },
  // can you [walk] please
  {
    m: "^(can|could|will|would) you (#Adv|not)+? [#Inf] .+? please$",
    g: 0,
    t: "Imp",
    r: "please-end"
  },
  // come have a drink
  { m: "^come #Inf", t: "Imp", n: "on", r: "come-have" },
  // come and have a drink
  { m: "^come and #Inf", t: "Imp . Imp", r: "come-and-have" },
  // [allow] yourself
  {
    m: "^(and|but)? (then|please)? [#Inf] (yourself|yourselves)",
    g: 0,
    t: "Imp",
    r: "allow-yourself"
  },
  // [look] what happened
  { m: "^[#Inf] what .", g: 0, t: "Imp", r: "look-what" },
  // [go] to it
  { m: "^[#Inf] (to|for|into|toward|here|there)", g: 0, t: "Imp", r: "go-to" },
  // [come] and have a drink
  { m: "^[#Inf] (and|or) #Inf", g: 0, t: "Imp", r: "inf-and-inf" },
  // [maintain] eye contact
  { m: "^[#Inf] #Adj? #Sing #Sing", g: 0, t: "Imp", r: "eye-contact" },
  // don't forget to [clean]
  { m: "^do not (forget|omit|neglect) to [#Inf]", g: 0, t: "Imp", r: "do-not-forget" },
  // [add] 2 eggs
  { m: "^[#Inf] #Value #NN", g: 0, t: "Imp", r: "add-2-eggs" },
  // === verbs/adj-gerund.js ===
  // The station was [closing]. The shop is [closing] soon.
  { m: "#Cop #Adv+? [closing] (#Adv|soon)+?$", g: 0, t: "Ger", r: "closing" },
  // that were [growing]
  { m: "(that|which) were [%Adj|Gerund%]", g: 0, t: "Ger", r: "were-growing" },
  // === _misc.js ===
  // order matters
  // u r cool
  { m: "u r", t: "#Pron #Cop", r: "u-r" },
  // the captain [who]
  { m: "#NN [(who|whom)]", g: 0, t: "Det", r: "captain-who" },
  // who is [that]?
  {
    m: "^#QW #Adv+? #Cop #Adv+? [(this|that|these|those)] #Adv+?$",
    g: 0,
    t: "Pron",
    r: "who-is-that"
  },
  // I like [this]
  {
    m: "#V [(this|that|these|those)] #Adv+? (yesterday|today|tonight|tomorrow)?$",
    g: 0,
    t: "Pron",
    r: "dem-obj"
  },
  // some sort of
  { m: "some sort of", t: "Det NN Prep", r: "some-sort-of" },
  // of some sort
  { m: "of some sort", t: "Prep Det NN", r: "of-some-sort" },
  // [some] eat apples
  { m: "^[some] #Inf #NN", g: 0, t: "Pron", r: "some-subj" },
  // put it [there]
  {
    m: "(put|puts|putting|place|placed|leave|left) #Pron [there]",
    g: 0,
    t: "Adv",
    r: "loc-there"
  },
  // [such] skill
  { m: "[such] (a|an|is)? #NN", g: 0, t: "Det", r: "such-skill" },
  // are [ya]
  { m: "(are|#Mod|see|do|for) [ya]", g: 0, t: "Pron", r: "are-ya" },
  // [long live] the king
  { m: "[long live] .", g: 0, t: "#Adv #Inf", r: "long-live" },
  // [there] she is
  { m: "[there] (#Adv|#Pron)? #Cop", g: 0, t: "There", r: "there-is" },
  // is [there] food
  { m: "#Cop [there] .", g: 0, t: "There", r: "is-there" },
  // should [there]
  { m: "#Mod #Adv? [there]", g: 0, t: "There", r: "should-there" },
  // [do] you
  { m: "^[do] (you|we|they)", g: 0, t: "QW", r: "do-you" },
  // [does] he
  { m: "^[does] (he|she|it|#Prop)", g: 0, t: "QW", r: "does-he" },
  // the person [who] runs
  { m: "#Det #NN+ [who] #V", g: 0, t: "Prep", r: "x-who" },
  // the person [which] eats
  { m: "#Det #NN+ [which] #V", g: 0, t: "Prep", r: "x-which" },
  // guess who
  { m: "guess who", t: "#Inf #QW", r: "guess-who" },
  // [fucking] ridiculous
  { m: "[fucking] !#V", g: 0, t: "#Ger", r: "f-as-ger" },
  // === nouns/organizations.js ===
  // import orgWords from './_orgWords.js'
  // let orgMap = `(${orgWords.join('|')})`
  /*
  const multi = [
    'building society',
    'central bank',
    'department store',
    'institute of technology',
    'liberation army',
    'people party',
    'social club',
    'state police',
    'state university',
  ]
  */
  // university of Toronto
  { m: "university of #Place", t: "Org", r: "uni-place" },
  // Name pairs can be business names without a known organization suffix.
  { m: "#Prop & #Prop", t: "Prop", r: "name-and-name" },
  // John & Mary Ltd
  { m: `#Pers & #Pers ${companySuffix}`, t: "Org", r: "person-and" },
  // Smith & Rogers
  { m: "#Last & #Last", t: "Org", r: "last-and-last" },
  // Microsoft of Canada
  // { m: '#Org of the? #Prop', t: 'Org', r: 'org-of-place', safe: true },
  // walmart USA
  { m: "#Org #Country", t: "Org", r: "org-country" },
  // Toronto Microsoft
  { m: "#Prop #Org", t: "Org", n: "#First", r: "title-org" },
  // FitBit Inc
  { m: "#Prop (ltd|co|inc|dept|assn|bros)", t: "Org", r: "org-abbrv" },
  // the [XYZ corporation]
  { m: `the [#Acronym ${companySuffix}]`, g: 0, t: "Org", r: "acro", safe: true },
  // [government of india]
  { m: "[government of the? #Place+]", g: 0, t: "Org", r: "gov-of-x" },
  // school board
  { m: "(health|school|commerce) board", t: "Org", r: "school-board" },
  // special committee
  {
    m: "(nominating|special|conference|executive|steering|central|congressional) committee",
    t: "Org",
    r: "special"
  },
  // global Microsoft
  {
    m: "(world|global|international|national|#Dem) #Org",
    t: "Org",
    r: "global-org"
  },
  // Toronto public school
  { m: "#NN+ (public|private) school", t: "School", r: "public-school" },
  // Toronto Yankees
  { m: "#Place+ #SportsTeam", t: "SportsTeam", r: "place-team" },
  // 'manchester united'
  {
    m: "(dc|atlanta|minnesota|manchester|newcastle|sheffield) united",
    t: "SportsTeam",
    r: "united-team"
  },
  // 'toronto fc'
  { m: "#Place+ fc", t: "SportsTeam", r: "fc-team" },
  // the new orleans basketball team
  {
    m: "#Place+ #NN{0,2} (club|society|group|team|committee|commission|association|guild|crew)",
    t: "Org",
    r: "place-society"
  },
  // === nouns/places.js ===
  // ==== Region ====
  // west Toronto
  { m: "(west|north|south|east|western|northern|southern|eastern)+ #Place", t: "Region", r: "west-norfolk" },
  //some us-state acronyms (exlude: al, in, la, mo, hi, me, md, ok..)
  // Toronto [ca]
  {
    m: "#City [(al|ak|az|ar|ca|ct|dc|fl|ga|id|il|nv|nh|nj|ny|oh|pa|sc|tn|tx|ut|vt|pr)]",
    g: 0,
    t: "Region",
    r: "us-state"
  },
  // Portland [OR]
  { m: "portland [(or && @isUpperCase)]", g: 0, t: "Region", r: "portland-or" },
  // with [turkey]
  { m: "with [(turkey && !@isTitleCase)]", g: 0, u: "Place", t: "Uncountable", r: "with-turkey" },
  // Toronto point
  {
    m: "#Prop+ (cliff|place|range|pit|place|point|room|grounds|ruins)",
    t: "Place",
    r: "foo-point"
  },
  // 123 main street
  {
    m: "#Value #NN+ (st|street|rd|road|crescent|cr|way|tr|terrace|avenue|ave|lane|boulevard|blvd|drive|dr|parkway|way)",
    t: "Address",
    r: "address-st"
  },
  // port dover
  { m: "(port|mount|mt) #Prop", t: "Place", r: "port-name" },
  // === conjunctions.js ===
  // [how] he is driving
  ...["who", "what", "where", "why", "how", "when"].map((word) => ({
    m: `[${word}] #NN #Cop #Adv? (#V|#Adj)`,
    g: 0,
    t: "Conj",
    r: "how-he-is-x"
  })),
  // is [when] he
  { m: "#Cop [(who|what|where|why|how|when)] #NN", g: 0, t: "Conj", r: "when-he" },
  // things [that] seem cool
  { m: "#NN [that] #V #Adj", g: 0, t: "Conj", r: "that-seem" },
  // he was [that] wide
  { m: "#NN #Cop not? [that] #Adj", g: 0, t: "Adv", r: "that-adj" },
  // [to] the store - a determiner/possessive/pronoun opens a noun-phrase, so this 'to' is never an infinitive-marker
  // [to] the store
  {
    m: "[to] (#Det|#Poss|#Pron|#Email|#Url)",
    g: 0,
    u: "Conj",
    t: "Prep",
    r: "to-the-store"
  },
  // [to] lunch
  { m: "[to] (#NN && !#V)", g: 0, u: "Conj", t: "Prep", r: "to-noun" },
  // well [above] the clouds, directly [under] the bridge
  ...["above", "below", "under", "over"].flatMap(
    (prep) => ["well", "just", "right", "directly"].map((word) => ({
      m: `${word} [${prep}] (#Det|#Poss|#Pron|#Prop)`,
      g: 0,
      t: "Prep",
      r: `well-${prep}`
    }))
  ),
  // I heard rumors [that] drivers save gas
  { m: "#V #Adv? #NN [(that|which)]", g: 0, t: "Prep", r: "that-prep" },
  // Tuesday, [which] he liked
  { m: "@hasComma [which] (#Pron|#V)", g: 0, t: "Prep", r: "which-cop" },
  // treated them [like] sons
  { m: "(me|him|her|us|them|it) [like] #NN", g: 0, t: "Prep", r: "noun-like" },
  // a day [like] this
  { m: "a #NN [like] (#NN|#Det)", g: 0, t: "Prep", r: "a-noun-like" },
  // really [like]
  { m: "(#Adv && !lot) [like]", g: 0, t: "V", r: "really-like" },
  // is not [like] me
  { m: "(#Cop|be|been|being) (not|never) [like]", g: 0, t: "Prep", r: "neg-like" },
  // a lot [like] ours
  { m: "a lot [like] #NN", g: 0, t: "Prep", r: "lot-like" },
  // treat them [like]
  { m: "#Inf #Pron [like]", g: 0, t: "Prep", r: "treat-like" },
  // [before] dinner
  {
    m: "[before] (#Det|#Poss|#NN|#Ger|#Date)",
    g: 0,
    t: "Prep",
    r: "before-nominal"
  },
  // ==== Questions ====
  // where
  // why
  // when
  // who
  // whom
  // whose
  // what
  // which
  //the word 'how many'
  // { match: '^(how|which)', tag: 'QuestionWord', reason: 'how-q' },
  // [how] he
  { m: "[#QW] (#Pron|#Det)", g: 0, t: "Prep", r: "how-he" },
  // [when] stolen
  { m: "[#QW] #Part", g: 0, t: "Prep", r: "when-stolen" },
  // [how] is
  { m: "[how] (#Det|#Cop|#Mod|#Past)", g: 0, t: "QW", r: "how-is" },
  // children [who] dance
  { m: "#Plur [(who|which|when)] .", g: 0, t: "Prep", r: "people-who" },
  // === expressions.js ===
  // holy shit
  { m: "holy (shit|fuck|hell)", t: "Expr", r: "swears-expr" },
  // come on
  { m: "^come on", t: "Expr", r: "come-on" },
  // // [well]..
  // { m: '^[well] !#Adj?', g: 0, t: 'Expr', r: 'well-expr' },
  // // [so]
  // { m: '^[so] !#Adj?', g: 0, t: 'Expr', r: 'so-expr' },
  // // [okay]
  // { m: '^[okay] !#Adj?', g: 0, t: 'Expr', r: 'okay-expr' },
  // // [now]
  // { m: '^[now] !#Adj?', g: 0, t: 'Expr', r: 'now-expr' },
  // // shoot,
  // { m: '^(shoot && @hasComma)', t: 'Expr', r: 'shoot-comma-expr' },
  // // say,
  // { m: '^(say && @hasComma)', t: 'Expr', r: 'say-expr' },
  // // like, hello
  // { m: '^(like && @hasComma)', t: 'Expr', r: 'like-expr' },
  // Rules promoted from the second pass.
  // const locative = '#Plural [(near|on|under|beside|behind)] #Determiner #Adjective+? #Noun [%Noun|Verb%]$'
  // Which chair did she [sit] [on]?
  // veggies, [like] kale
  {
    m: "(#NN && @hasComma) [like] #NN",
    g: 0,
    t: "Prep",
    r: "comma-like-ex"
  },
  // Everyone [but] me agreed.
  ...["everyone", "everybody", "everything", "anyone", "anybody", "anything", "nobody", "nothing", "all"].map((word) => ({
    m: `${word} [but] (me|him|her|us|them|#Det|#Poss|#Prop)`,
    g: 0,
    t: "Prep",
    r: "exceptive-but"
  })),
  // We looked [under] the bed.
  { m: "#V [under] (#Det|#Poss|#Pron)", g: 0, t: "Prep", r: "under-obj" },
  // images on a screen [like] humans do
  { m: "#NN [like] #NN+ (do|does|did)$", g: 0, t: "Prep", r: "noun-like-cmp" },
  // cities [like] New York, Boston
  ...["", "#Place ", "#Place #Place "].map((prefix5) => ({
    m: `#Plur [like] ${prefix5}(#Place && @hasComma) #Place`,
    g: 0,
    t: "Prep",
    r: "like-place"
  })),
  // [Like] his brother, he enjoys chess
  {
    m: "^[like] (#Det|#Poss)? #Adj+? (#NN && @hasComma)",
    g: 0,
    t: "Prep",
    r: "init-like"
  },
  // I like tea, [like] my sister does.
  { m: `@hasComma [like] ${subject} ${predicate}`, g: 0, t: "Conj", r: "comma-like-cl" },
  // We talked about the fact [that] she resigned.
  { m: `#NN [that] ${subject} ${predicate}`, g: 0, t: "Conj", r: "noun-that" },
  // I have heard that story [before]
  {
    m: "#V (#Det|#Poss)? #NN+? [(before|since)]$",
    g: 0,
    t: "Adv",
    n: "@hasQuestionMark",
    r: "time-adv"
  },
  // We met shortly [after].
  { m: "(shortly|soon|long) [after]$", g: 0, t: "Adv", r: "after-adv" },
  // She has [since] moved.
  { m: "(has|have|had) [since] #Past", g: 0, t: "Adv", r: "perf-since-adv" },
  // She has not arrived [yet].
  { m: "#Past [yet]$", g: 0, t: "Adv", r: "yet-adv" },
  // Who did she arrive [before]?
  {
    m: "^(who|whom) #V #Pron #V [before]$",
    g: 0,
    t: "Prep",
    r: "before-end"
  },
  // We will leave [when] the rain stops.
  {
    m: "#Mod #Inf [when] #Det",
    g: 0,
    t: "Conj",
    r: "leave-when"
  },
  // Possession of running water and enduring noun phrases are not progressives.
  { m: "[(have|has|had)] running water", g: 0, u: "Aux", r: "have-water" },
  { m: "[#Cop] (enduring && #Adj) #NN", g: 0, u: "Aux", r: "enduring-cop" },
  // Although he [was] [tired], he smiled. He [was] [tired].
  ...[
    // He [was] [tired].
    { match: "[(#Cop|been)] #Adv+? [tired]$", position: "end" },
    // Although he [was] [tired], he smiled.
    { match: "[(#Cop|been)] #Adv+? [(tired && @hasComma)]", position: "comma" }
  ].flatMap(({ match: match2, position }) => [
    // Although he [was] [tired], he smiled. He [was] [tired].
    { m: match2, g: 0, t: "Cop", u: "Pass", r: `tired-${position}-cop` },
    // Although he [was] [tired], he smiled. He [was] [tired].
    { m: match2, g: 0, u: "Aux", r: `tired-${position}-unaux` },
    // Although he [was] [tired], he smiled. He [was] [tired].
    { m: match2, g: 1, t: "Adj", r: `tired-${position}-adj` }
  ]),
  // had been tired
  { m: "(has|have|had) (#Adv|not)+? been #Adv+? tired$", u: "Pass", r: "tired-unpass" },
  // 23 Main Street in Toronto
  { m: "#Address in #Place", t: "Place", r: "address-place" },
  // the very [professional] actor
  {
    m: "#Det (very|remarkably|extremely|quite|unusually) [%Adj|Noun%] #Actor",
    g: 0,
    t: "Adj",
    r: "degree-actor"
  },
  // the [sleeping] dog
  {
    m: "#Det [sleeping] (#Actor|#Pers|puppy|kitten|dog|cat|baby|babies|child|children)",
    g: 0,
    t: "Adj",
    r: "sleeping-mod"
  },
  // [water] broke the pipe
  {
    m: "^[%Noun|Verb%] #Past (#Det|#Poss) #Adj+? #NN",
    g: 0,
    t: "NN",
    r: "bare-subj-past"
  },
  // the [present] immediately
  { m: "#Det [present] #Adv+$", g: 0, t: "NN", r: "present-obj" },
  // [falls in] June
  { m: "[(fall|falls|fell) in] #Month", g: 0, t: "#V #Prep", r: "fall-in-month" },
  // [had] he walked
  {
    m: "^[had] #NN+ (#Adv|not)+? #Past",
    g: 0,
    t: "Condition",
    r: "had-cond",
    n: "@hasQuestionMark"
  },
  // [were] he to walk
  {
    m: "^[were] #NN+ to #Inf *$",
    g: 0,
    t: "Condition",
    r: "were-he",
    n: "@hasQuestionMark"
  },
  // [had] he walked?
  {
    m: "^[had] #NN+ (#Adv|not)+? (#Past && @hasQuestionMark)$",
    g: 0,
    t: "Aux",
    r: "had-q-end",
    n: "@hasComma"
  },
  // [had] he walked the dog?
  {
    m: "^[had] #NN+ (#Adv|not)+? #Past * @hasQuestionMark$",
    g: 0,
    t: "Aux",
    r: "had-q-obj",
    n: "@hasComma"
  },
  // [This] will be one sentence. [This] might help.
  { m: "[this] #Adv+? #Mod #Adv+? #Inf", g: 0, t: "Pron", r: "this-modal-subj" },
  // has [read], had [put]
  ...["read", "put"].map((word) => ({
    m: `(has|have|had) (#Adv|not)+? [${word}]`,
    g: 0,
    t: "Part",
    r: "perf-invar"
  })),
  // what [work] he did
  { m: "(which|what|whose) [%Noun|Verb%] #Pron", g: 0, t: "NN", r: "embed-wh-obj" },
  // what [walks] he took
  { m: "(which|what|whose) [%Plural|Verb%] #Pron", g: 0, t: "Plur", r: "embed-wh-pl" },
  // John and Mary [walk]
  {
    m: "#Pers and #Pers [(%Noun|Verb% && !@isTitleCase && !@isUpperCase)]$",
    g: 0,
    t: "Inf",
    r: "joint-subj-verb"
  },
  // dogs [near] the house [bark]
  // near|on|under|beside|behind
  ...["near", "on", "under", "beside", "behind"].flatMap((word) => [
    {
      m: `#Plur [${word}] #Det #Adj+? #NN [%Noun|Verb%]$`,
      g: 0,
      t: "Prep",
      r: "subj-loc"
    },
    {
      m: `#Plur [${word}] #Det #Adj+? #NN [%Noun|Verb%]$`,
      g: 1,
      t: "Inf",
      r: "subj-loc-verb"
    }
  ]),
  // has eaten and [drunk]
  {
    m: "(has|have|had) (#Adv|not)+? #Past (and|or) #Adv+? [drunk]",
    g: 0,
    t: "Part",
    r: "coord-drunk"
  },
  // she drew a picture
  { m: "(drew && #V)", t: "Past", r: "drew-a-picture" }
];
var matches = expand_rules_default(rules);
var model_default4 = {
  two: {
    matches
  }
};

// node_modules/compromise/src/2-two/postTagger/model/second-pass.js
var noun2 = "(#NN && !#Poss && !@hasComma)";
var modifiers2 = "(#Det|#Poss)? #Adv+? #Adj+?";
var subject2 = `${modifiers2} ${noun2}+`;
var predicate2 = "#Adv+? not? (#V && !#Ger && !#Prt)";
var seatedQuestion = "^(which|what) #Adj+? #NN (did|does|do|#Mod) #Pron [sit] [on]$";
var rules2 = [
  // === second-pass.js ===
  // Corrections matched against the main sweep's output, before any are applied.
  // Keep comma context, but don't turn unambiguous verbs into list items.
  ...[
    ["%Noun|Verb%", "#Inf"],
    ["%Plural|Verb%", "#Pres"],
    ["thanks", "#Pres"]
  ].map(([target, verb]) => ({
    m: `(#NN && @hasComma) #NN (and|or) [(${target} && ${verb})]`,
    g: 0,
    t: "NN",
    n: "#Cop",
    r: "noun-list"
  })),
  // === connectors.js (second pass) ===
  // Before the meal ended, we left.
  // Before the meal, we left.
  // After the news that she resigned, we called.
  ...["before", "after", "since", "until", "till", "as", "than", "when", "whereas"].flatMap((word) => [
    // [before] she left
    // [after] she left
    // [since] she left...
    { m: `[${word}] ${subject2} ${predicate2}`, g: 0, t: "Conj", r: `${word}-clause` },
    // [Before] the guests from the village arrived, we ate.
    // [After] the guests from the village arrived, we ate.
    // [Since] the guests from the village arrived, we ate. ...
    {
      m: `[${word}] ${subject2} (from|of|with|in|on|at|beside|near) ${subject2} ${predicate2}`,
      g: 0,
      t: "Conj",
      r: `${word}-mod-subj`
    }
  ]),
  // [Before] the dog and the cat woke, she left.
  // [before] the dog and the cat woke
  // [after] the dog and the cat woke...
  ...["before", "after", "until", "when", "while"].map((word) => ({
    m: `^[${word}] ${subject2} and ${subject2} ${predicate2}`,
    g: 0,
    t: "Conj",
    r: `${word}-joint-subj`
  })),
  // She bought flowers, [for] I was ill.
  { m: `@hasComma [for] ${subject2} ${predicate2}`, g: 0, t: "Conj", r: "causal-for" },
  // The cat slept [under] the table. He sat [beside] me.
  // the plane flew well [above] the clouds
  // she stood directly [below] the window...
  ...["above", "below", "under", "over", "beside", "behind", "against", "outside", "inside", "near"].map((word) => ({
    m: `[(${word} && !#V)] (#Det|#Poss|#Pron|#Prop)`,
    g: 0,
    t: "Prep",
    r: `${word}-space-obj`
  })),
  // She sings [like] her mother
  {
    m: "(#V && !#Aux && !#Mod && !do && !does && !did && !have && !has && !had) [like] (#NN|#Det|#Poss)",
    g: 0,
    t: "Prep",
    r: "like-like"
  },
  // She sings [like] her mother does
  {
    m: `(#V && !#Aux && !#Mod && !do && !does && !did && !have && !has && !had) [like] ${subject2} ${predicate2}`,
    g: 0,
    t: "Conj",
    r: "manner-like"
  },
  // Which chair did she [sit] [on]? What cushion can he [sit] [on]?
  { m: seatedQuestion, g: 0, u: "PhrV", r: "sit-q-unphr" },
  // Which chair did she [sit] [on]? What cushion can he [sit] [on]?
  { m: seatedQuestion, g: 1, t: "Prep", r: "sit-q-prep" },
  // “May twenty five”
  { m: "(#TxtNum && #Date) #TxtNum", t: "Date", r: "textvalue-date" },
  // he ate, and [left]
  {
    m: "(#Past && @hasComma) and [%Adj|Past%] #Adv+?$",
    g: 0,
    t: "Past",
    r: "past-list"
  },
  // does [this] work
  // Keep each auxiliary as a required hook.
  ...["do", "does", "did", "#Mod"].map((aux) => ({
    m: `${aux} [(this|that|these|those)] #Adv+? #Inf`,
    hook: aux,
    g: 0,
    t: "Pron",
    r: "dem-q"
  })),
  // [This] is useful. Hope [this] helps. [This] really rocks.
  {
    m: "[this] #Adv+? (#Pres && !#Inf && !#Ger)",
    g: 0,
    t: "Pron",
    r: "this-finite-subj"
  },
  // { match: locative, group: 0, tag: 'Preposition', reason: 'subj-loc' },
  // { match: locative, group: 1, tag: 'Infinitive', reason: 'subj-loc-verb' },
  // being [injured] and treated
  {
    m: "being #Adv+? [%Adj|Past%] (and|or) #Adv+? (#Past|#Part)",
    g: 0,
    t: "Past",
    r: "coord-pass"
  },
  // dogs, [including] the poodle
  {
    m: "(#NN && @hasComma) [including] all? #Det? #Card+? #Adv+? #Adj+? #NN",
    g: 0,
    t: "Prep",
    r: "including-list"
  },
  // can you [walk], please?
  {
    m: "^(can|could|will|would) you (#Adv|not)+? [(#Inf && @hasComma)] please$",
    g: 0,
    t: "Imp",
    r: "req-verb-comma"
  },
  // can you [walk] the dog, please?
  {
    m: "^(can|could|will|would) you (#Adv|not)+? [#Inf] * @hasComma please$",
    g: 0,
    t: "Imp",
    r: "req-obj-comma"
  },
  // [Will] walked home
  { m: "[(will && @isTitleCase)] #Past", g: 0, t: "First", r: "will-past-subj" },
  // jack the ripper
  { m: "%Person|Verb% (the && #Pers) #Pers", t: "Pers", r: "known-nickname" },
  // keep the lid [closed]
  {
    m: "#Imp #Det #NN+ [%Adj|Past%]",
    g: 0,
    t: "Adj",
    r: "lid-closed"
  }
  // console.log('  ', rules.length, 'matches second-pass\n\n')
];
var second_pass_default = expand_rules_default(rules2);

// node_modules/compromise/src/2-two/postTagger/compute/index.js
var net = null;
var secondNet = null;
var secondPass2 = function(sentences, world2) {
  const { methods: methods19 } = world2;
  secondNet ||= methods19.one.buildNet(second_pass_default, world2);
  const found = methods19.one.bulkMatch(sentences, secondNet, methods19);
  methods19.one.bulkTagger(found, sentences, world2);
};
var postTagger = function(view) {
  const { world: world2 } = view;
  const { model: model5, methods: methods19 } = world2;
  net ||= methods19.one.buildNet(model5.two.matches, world2);
  const sentences = view.docs;
  const clauses2 = methods19.two.quickSplit(sentences);
  methods19.two.leftRight(clauses2, model5.two.leftRight, world2);
  const found = methods19.one.bulkMatch(clauses2, net, methods19);
  methods19.one.bulkTagger(found, clauses2, world2);
  secondPass2(sentences, world2);
  view.uncache();
  view.unfreeze();
  return view;
};
var tagger2 = (view) => view.compute(["freeze", "lexicon", "preTagger", "postTagger", "unfreeze"]);
var compute_default11 = { postTagger, tagger: tagger2 };

// node_modules/compromise/src/2-two/postTagger/api.js
var round = (n3) => Math.round(n3 * 100) / 100;
function api_default11(View2) {
  View2.prototype.confidence = function() {
    let sum = 0;
    let count = 0;
    this.docs.forEach((terms) => {
      terms.forEach((term) => {
        count += 1;
        sum += term.confidence || 1;
      });
    });
    if (count === 0) {
      return 1;
    }
    return round(sum / count);
  };
  View2.prototype.tagger = function() {
    return this.compute(["tagger"]);
  };
}

// node_modules/compromise/src/2-two/postTagger/plugin.js
var plugin2 = {
  api: api_default11,
  compute: compute_default11,
  model: model_default4,
  hooks: ["postTagger"]
};
var plugin_default16 = plugin2;

// node_modules/compromise/src/2-two/lazy/maybeMatch.js
var getWords = function(net3) {
  return Object.keys(net3.hooks).filter((w) => !w.startsWith("#") && !w.startsWith("%"));
};
var maybeMatch = function(doc, net3) {
  const words = getWords(net3);
  if (words.length === 0) {
    return doc;
  }
  if (!doc._cache) {
    doc.cache();
  }
  const cache2 = doc._cache;
  return doc.filter((_m, i3) => {
    return words.some((str) => cache2[i3].has(str));
  });
};
var maybeMatch_default = maybeMatch;

// node_modules/compromise/src/2-two/lazy/lazyParse.js
var lazyParse = function(input, reg) {
  let net3 = reg;
  if (typeof reg === "string") {
    net3 = this.buildNet([{ match: reg }]);
  }
  const doc = this.tokenize(input);
  const m3 = maybeMatch_default(doc, net3);
  if (m3.found) {
    m3.compute(["index", "tagger"]);
    return m3.match(reg);
  }
  return doc.none();
};
var lazyParse_default = lazyParse;

// node_modules/compromise/src/2-two/lazy/plugin.js
var plugin_default17 = {
  lib: {
    lazy: lazyParse_default
  }
};

// node_modules/compromise/src/2-two/swap/api/swap-verb.js
var matchVerb = function(m3, lemma) {
  const conjugate2 = m3.methods.two.transform.verb.conjugate;
  const all4 = conjugate2(lemma, m3.model);
  if (m3.has("#Gerund")) {
    return all4.Gerund;
  }
  if (m3.has("#PastTense")) {
    return all4.PastTense;
  }
  if (m3.has("#PresentTense")) {
    return all4.PresentTense;
  }
  if (m3.has("#Gerund")) {
    return all4.Gerund;
  }
  return lemma;
};
var swapVerb = function(vb3, lemma) {
  let str = lemma;
  vb3.forEach((m3) => {
    if (!m3.has("#Infinitive")) {
      str = matchVerb(m3, lemma);
    }
    m3.replaceWith(str);
  });
  return vb3;
};
var swap_verb_default = swapVerb;

// node_modules/compromise/src/2-two/swap/api/swap.js
var swapNoun = function(m3, lemma) {
  let str = lemma;
  if (m3.has("#Plural")) {
    const toPlural = m3.methods.two.transform.noun.toPlural;
    str = toPlural(lemma, m3.model);
  }
  m3.replaceWith(str, { possessives: true });
};
var swapAdverb = function(m3, lemma) {
  const { toAdverb: toAdverb2 } = m3.methods.two.transform.adjective;
  const str = lemma;
  const adv = toAdverb2(str);
  if (adv) {
    m3.replaceWith(adv);
  }
};
var swapAdjective = function(m3, lemma) {
  const { toComparative: toComparative3, toSuperlative: toSuperlative3 } = m3.methods.two.transform.adjective;
  let str = lemma;
  if (m3.has("#Comparative")) {
    str = toComparative3(str, m3.model);
  } else if (m3.has("#Superlative")) {
    str = toSuperlative3(str, m3.model);
  }
  if (str) {
    m3.replaceWith(str);
  }
};
var swap = function(from, to, tag) {
  let reg = from.split(/ /g).map((str) => str.toLowerCase().trim());
  reg = reg.filter((str) => str);
  reg = reg.map((str) => `{${str}}`).join(" ");
  let m3 = this.match(reg);
  if (tag) {
    m3 = m3.if(tag);
  }
  if (m3.has("#Verb")) {
    return swap_verb_default(m3, to);
  }
  if (m3.has("#Noun")) {
    return swapNoun(m3, to);
  }
  if (m3.has("#Adverb")) {
    return swapAdverb(m3, to);
  }
  if (m3.has("#Adjective")) {
    return swapAdjective(m3, to);
  }
  return this;
};
var swap_default = swap;

// node_modules/compromise/src/2-two/swap/plugin.js
var api4 = function(View2) {
  View2.prototype.swap = swap_default;
};
var plugin_default18 = {
  api: api4
};

// node_modules/compromise/src/2-two/left-right/model/_lib.js
var context = /^(?:#[A-Za-z][A-Za-z0-9]*|[\p{L}\p{N}][\p{L}\p{N}'’-]*)$/u;
var tagName = /^!?#[a-z][a-z0-9]*$/i;
var parseContext = (source2, fail) => {
  const alternatives = source2.startsWith("(") && source2.endsWith(")");
  const values = alternatives ? source2.slice(1, -1).split("|") : [source2];
  if (alternatives && values.length < 2 || values.some((value) => !context.test(value))) {
    fail();
  }
  const words = /* @__PURE__ */ new Set();
  const tags2 = [];
  values.forEach((value) => {
    if (value.startsWith("#")) {
      tags2.push(value.slice(1));
    } else {
      words.add(value);
    }
  });
  return { words, tags: tags2 };
};
var parse4 = (word, source2) => {
  const fail = () => {
    throw new Error(`Invalid left-right rule for "${word}": ${source2}. Expected "[pre] _ [post] -> #Tag | !#Tag".`);
  };
  if (typeof source2 !== "string") {
    fail();
  }
  const parts = source2.split("->").map((s3) => s3.trim());
  if (parts.length !== 2) {
    fail();
  }
  const actions = parts[1].split("|").map((s3) => s3.trim()).map((action) => {
    if (!tagName.test(action)) {
      fail();
    }
    if (action.startsWith("!")) {
      return { unTag: action.slice(2) };
    }
    return { tag: action.slice(1) };
  });
  const terms = parts[0].split(/\s+/);
  const index3 = terms.indexOf("_");
  if (index3 < 0 || index3 > 1 || terms.length - index3 > 2) {
    fail();
  }
  const rule = { actions, reason: `${source2}` };
  if (index3 === 1) {
    let pre = terms[0];
    if (pre.startsWith("^")) {
      pre = pre.slice(1);
      rule.start = pre ? 1 : 0;
    }
    if (pre) {
      rule.pre = parseContext(pre, fail);
    }
  }
  if (index3 < terms.length - 1) {
    let post = terms[index3 + 1];
    if (post.endsWith("$")) {
      post = post.slice(0, -1);
      rule.end = post ? 1 : 0;
    }
    if (post) {
      rule.post = parseContext(post, fail);
    }
  }
  return rule;
};
var compile = (rules7) => Object.fromEntries(Object.entries(rules7).map(([word, entries]) => {
  if (!Array.isArray(entries)) {
    throw new Error(`Left-right rules for "${word}" must be an array.`);
  }
  let key = word;
  if (word.startsWith("#")) {
    key = word.slice(1);
  } else if (word.startsWith("%") && word.endsWith("%")) {
    key = word.slice(1, -1);
  }
  return [key, entries.map((source2) => parse4(word, lib_default9(source2)))];
}));
var lib_default10 = compile;

// node_modules/compromise/src/2-two/left-right/model/by-word.js
var rules3 = {
  air: [
    // the [air] force
    "_ force -> #NN"
  ],
  said: [
    // the [said] dog
    "the _ #NN -> #Adj"
  ],
  still: [
    // was [still] in
    "#Cop _ (in|#Ger|#Adj) -> #Adv",
    // [still] good
    // [still] make
    "_ (#Adj|#V) -> #Adv"
  ],
  so: [
    // [so] hot
    "_ #Adj -> #Adv",
    // do [so]
    "do _ -> #Adv",
    // [so] he
    "_ #NN -> #Conj"
  ],
  way: [
    // [way] hotter
    // [way] over
    "_ (#Comp|#Adj) -> #Adv"
  ],
  all: [
    // they [all] swim
    "_ #V -> #Adv",
    // assign [all] tasks
    "assign _ (#Pres|#Plur) -> #Det"
  ],
  even: [
    // [even] held
    // [even] worse
    // [even] the greatest
    "_ (#V|#Comp|#Det|#Poss) -> #Adv"
  ],
  later: [
    // [later] say
    "_ #Pres -> #Adv"
  ],
  enough: [
    // high [enough]
    "#Adj _ -> #Adv"
  ],
  least: [
    // [least] expensive
    "_ #Adj -> #Adv",
    // the [least]
    "#Det _ -> #Adv"
  ],
  sun: [
    // [sun] feb 2
    "_ #Date -> #WeekDay",
    // the [sun]
    "#Det _ -> #Sing"
  ],
  more: [
    // [more] players
    "_ #NN -> #Adj",
    // any [more]
    "(the|any) _ -> #Sing"
  ],
  u: [
    // and [u]
    "#Conj _ -> #Pron",
    // [u] made me smile
    "_ #V -> #Pron"
  ],
  half: [
    // nearly [half]
    "#Adv _ -> #Frac",
    // [half] the
    "_ the -> #Frac",
    // a [half] second
    "#Det _ #Ord -> #Value"
  ],
  second: [
    // one [second]
    "#Card _ -> #Unit",
    // [second] dog
    "_ #NN -> #Ord"
  ],
  will: [
    // [will] go
    "_ #Inf -> #Mod",
    // [will] walked to the park
    "^ _ #Past -> #First"
  ],
  march: [
    // must [march]
    "#Mod _ -> #Inf",
    // in [march]
    "(in|by|before|during|on|until|after|of|within|all) _ -> #Month",
    // early [May]
    "(early|late|mid) _ -> #Month",
    // [march] quickly
    "_ #Adv -> #V"
  ],
  may: [
    // [may] be
    "_ be -> #V",
    // early [May]
    "(early|late|mid) _ -> #Month",
    // [march] quickly
    "_ #Adv -> #V"
  ],
  open: [
    // [open] the door
    "_ #Det -> #Inf"
  ],
  be: [
    // will [be] walked
    "will _ #Past -> #Aux",
    // [stay] cool
    "^ _ #Adj -> #Imp"
  ],
  about: [
    // at [about]
    "#Prep _ -> #Adv"
  ],
  plenty: [
    // [plenty] of
    "_ of -> #Uncountable"
  ],
  no: [
    // see [no]
    "#V _ -> #Neg"
  ],
  turkey: [
    // i ate [turkey]
    "(eat|ate|eating|roast|roasted|thanksgiving) _ -> #Uncountable | !#Place",
    // [turkey] dinner
    "_ (roast|dinner|sandwich|burger) -> #Uncountable | !#Place",
    // ankara [turkey]
    // in [turkey]
    "(#Place|in|near|nearby|to|from) _ -> #Country"
  ],
  that: [
    // [that] is all
    "^ _ #Cop -> #Pron",
    // says [that] he
    "#V _ #Pron -> #Conj",
    // things [that] are required
    "#NN _ #Cop -> #Conj"
  ],
  like: [
    // nothing [like]
    "nothing _ -> #Prep",
    // [like] the time
    "^ _ #Det -> #Prep"
  ],
  enduring: [
    // enduring symbols, running water
    "_ (symbols|legacy|legacies|appeal|influence|value|values) -> #Adj"
  ],
  running: [
    // enduring symbols, running water
    "(have|has|had|#Det|#Poss) _ water -> #Adj"
  ],
  wit: [
    // [wit] it
    "_ (me|it) -> #Prep"
  ],
  leads: [
    // it [leads] to
    "_ (to|from) -> #Pres",
    // that [leads]
    "(that|this) _ -> #Pres"
  ],
  look: [
    // [look] good
    "_ #Adj -> #Pres",
    // [pay] attention
    "^ _ #NN -> #Imp"
  ],
  finish: [
    // [start] listening
    "_ #Ger -> #Inf"
  ],
  help: [
    // [start] listening
    "_ #Ger -> #Inf",
    // [pay] attention
    "^ _ #NN -> #Imp"
  ],
  right: [
    // [right] after
    "_ (before|after|in|into|to|toward) -> #Adv"
  ],
  there: [
    // always [there]
    "(always|nearly|barely|practically) _ -> #Adj"
  ],
  mine: [
    // than [mine]
    "(then|than) _ -> #Poss"
  ],
  sorry: [
    // said [sorry]
    "(say|says|said) _ -> #Expr"
  ],
  wed: [
    // on [wed]
    "(in|by|before|during|on|until|after|of|within|all) _ -> #WeekDay"
  ],
  quarter: [
    // a [half] second
    "#Det _ #Ord -> #Value"
  ],
  kind: [
    // some [kind] of teacher
    "(#Det|#Comp|new|different) _ of -> #NN",
    // same [kind] of shouts
    "same _ of -> #NN",
    // a new [kind]
    "(#Det|#Comp|new|different) _ $ -> #NN"
  ],
  close: [
    // a close friend
    "#Det _ #NN -> #Adj",
    // came to a [close]
    "#Det _ $ -> #NN"
  ],
  sat: [
    // on [sat]
    "(in|by|before|during|on|until|after|of|within|all) _ -> #WeekDay",
    // [sat] november
    "^ _ #Date -> #WeekDay"
  ],
  read: [
    // he [read]
    "^(he|she|it|#Pers) _ -> #Past"
  ],
  stay: [
    // [stay] away
    "^ _ (out|away|back) -> #Imp",
    // [stay] cool
    "^ _ #Adj -> #Imp"
  ],
  keep: [
    // [stay] cool
    "^ _ #Adj -> #Imp"
  ],
  shoot: [
    // shoot
    "^ _ $ -> #Expr"
  ],
  seconds: [
    // 10 [seconds]
    "#Value _ -> #Plur | !#Value"
  ],
  premier: [
    // This is the [premier] university in Virginia
    "the _ #NN -> #Adj"
    // { m: '#Cop the [%Adj|Noun%] #NN', g: 0, t: 'Adj', r: 'premier-uni' },
  ],
  frequent: [
    // i [frequent] this restaurant
    "#Pron _ #Det -> #Inf"
  ],
  google: [
    // [google] me
    "^ _ #Pron -> #Inf"
  ],
  left: [
    // she even [left]
    "even _ $ -> #Past"
  ],
  since: [
    // she has [since] moved
    "(has|have|had) _ #Past -> #Adv"
  ],
  time: [
    // she had [time]
    "had _ $ -> #NN"
  ],
  closing: [
    // the station was [closing]
    "#Cop _ -> #Ger"
  ],
  growing: [
    // plants that were [growing]
    "#Cop _ -> #Ger"
  ],
  soon: [
    // the shop is closing [soon]
    "closing _ $ -> #Adv"
  ],
  penny: [
    // half a [penny]
    "a _ $ -> #Currency"
  ],
  next: [
    // 1pm [next] sun
    "#Time _ (sun|#WeekDay) -> #Date"
  ],
  to: [
    // from start [to] finish
    "start _ finish -> #Prep"
  ],
  in: [
    // bowed his head [in] prayer
    "_ prayer -> #Prep"
  ],
  pope: [
    // [pope] francis
    "_ #Pers -> #Hon"
  ],
  prince: [
    // [prince] paris
    "_ #Prop -> #Hon"
  ],
  born: [
    // being [born]
    "being _ -> #Past"
  ],
  ya: [
    // are [ya]
    "(are|#Mod|see|do|for) _ -> #Pron"
  ],
  after: [
    // we met shortly [after]
    "(shortly|soon|long) _ $ -> #Adv"
  ],
  yet: [
    // she has not arrived [yet]
    "#Past _ $ -> #Adv"
  ],
  me: [
    // i ate [me] sandwich (scottish slang)
    "#Past _ #NN -> #Poss"
  ]
};
var compounds = {
  // the [can]
  "can|will|may": "the _ -> #Sing",
  // five [feet]
  "foot|feet": "#Value _ -> #Unit",
  // [damn] them
  "shit|damn": "^ _ them -> #Inf",
  // [much] appreciated
  // [super] strong
  "much|super|pretty": "_ #Adj -> #Adv",
  // a [bit]
  // a [must]
  // a [while]
  "bit|must|while": "a _ -> #Sing",
  // 5 [k]
  // 5 [gb]
  "k|gb|pa|ft|m": "#Value _ -> #Unit",
  // [sounds] fun
  // [look] good
  "sound|sounds|looks": "_ #Adj -> #Pres",
  // [stops] thinking
  "start|stop|starts|stops|begin|begins": "_ #Ger -> #V",
  // help [stop]
  "start|stop|end|make": "help _ -> #Inf",
  // [start] listening
  "start|stop": "_ #Ger -> #Inf",
  // [pay] attention
  "start|stop|ask|wear|pay|show|watch|act|fix|kill|turn|try|win": "^ _ #NN -> #Imp",
  // 5pm [central]
  "eastern|mountain|pacific|central|est|pst|gmt": "#Time _ -> #Timezone",
  // [dance] music
  "dance|rock|rap|swing": "_ (music|class|lesson|night|party|festival|league|ceremony) -> #NN",
  // ten [bucks]
  "buck|bucks|grand": "#Value _ -> #Currency",
  // 5 [square] miles
  "square|cubic": "#Value _ #Unit -> #Unit",
  // is [alone]
  "just|alone": "#Cop _ $ -> #Adj",
  // [go] home
  "go|come": "^ _ home -> #Imp",
  // ok,
  // alright
  // hell
  // anyways
  "ok|alright|hell|anyways": "^ _ -> #Expr",
  // [dude] we should
  "dude|man|girl": "^ _ #Pron -> #Expr",
  // [un] skilled
  "un|contra|extra|inter|intra|macro|micro|mid|mis|mono|multi|pre|sub|tri|ex": "_ #Adj -> #Adj | #Prefix",
  "over|under": "(is|was|were) _ #Past -> #Adv",
  // ...['under', 'over'].map(word => ({
  // m: `(is|was|were) [${word} #Past]`,
  "shit|damn|fuck": "_ (#Det|#Poss|them) -> #Verb",
  // the poor
  "poor|weary|public": "the _ #Verb-> #Noun"
};
Object.entries(compounds).forEach(([words, rule]) => {
  words.split("|").forEach((word) => {
    rules3[word] ||= [];
    rules3[word].push(rule);
  });
});
var by_word_default = rules3;

// node_modules/compromise/src/2-two/left-right/model/by-tag.js
var rules4 = {
  "#Person": [
    // bought a [warhol]
    "(a|an) _ $ -> !#Pers"
  ],
  "#ProperNoun": [
    // in [#ProperNoun] -> #Place
    // in [Foo] California
    "in _ -> #Place"
  ],
  "#PastTense": [
    // well [made]
    "well _ -> #Adj",
    "(over|under) _ -> #Adj"
  ],
  "#Gerund": [
    // as [entertaining] as
    "as _ as -> #Adj",
    // more [amusing] than
    "more _ than -> #Adj",
    // very [entertaining]
    "(so|very|extremely) _ -> #Adj",
    // the [failing] line
    "#Det _ #NN -> #Adj",
    // [walking] should be fun
    "_ #Mod -> #Activity",
    // i think tipping sucks
    "#Inf _ #Pres -> #Noun"
  ],
  "#Adjective": [
    // the [above] is clear
    // real [evil] is
    "(#Det|#Adj) _ #Cop -> #NN",
    // no [golden] would
    "no _ #Mod -> #NN",
    // a [minor] in
    "a _ #Prep -> #NN",
    // is [done] well
    "#Cop _ (well|badly|quickly|slowly) -> #V",
    // for the poor this
    "the _ #Det -> #NN"
  ],
  "#Participle": [
    // a [blown] motor
    "(the|those|these|a|an) _ #NN -> #Adj"
  ],
  "#Verb": [
    // the [manufacture] of perfume
    "(a|an|the) _ of -> #NN",
    // became [embroiled]
    "(become|became|becoming|becomes) _ -> #Adj"
  ],
  "#Singular": [
    // the [staff] were
    "(the|these) _ (were|are) -> #Plur",
    // the [repairer] said
    "#Det _ said -> #Actor"
  ],
  "#Infinitive": [
    // in [love]
    // about [thank]-you letters
    "(in|about) _ -> #Sing",
    // any [thank]-you letter
    // no [thank] you
    "(any|no) _ -> #NN",
    // as [fit] as
    "as _ as -> #Adj",
    // somebody [call]
    "^(somebody|everybody) _ -> #Imp",
    // never [say]
    "^never _ -> #Imp",
    // [continue] playing
    "^ _ #Ger -> #Imp",
    // much [thank]-you mail
    "much _ -> #NN"
  ],
  "#PresentTense": [
    // taught [thank]-you etiquette
    "(taught|teaches|learns|learned) _ -> #NN",
    // some [thanks] for helping
    "(many|any|some|several) _ for -> #NN",
    // whose [thanks] are appreciated
    "whose _ #Cop -> #NN"
  ],
  "#Abbreviation": [
    // 500 fifth [ave]
    "#Value _ -> #Unit"
  ],
  "#FirstName": [
    // john [stewart]
    "#First _ -> #Last"
  ],
  "#Cardinal": [
    //  5 June
    "_ #Month -> #Date"
  ]
};
var by_tag_default = rules4;

// node_modules/compromise/src/2-two/left-right/model/by-switch.js
var rules5 = {
  "%Adj|Gerund%": [
    // [boring] the audience
    "_ #Det -> #Ger",
    // world's [leading] manufacturer
    "#Poss _ #NN -> #Adj"
  ],
  "%Adj|Noun%": [
    // her [favourite] sport
    "#Poss _ #NN -> #Adj",
    // a [representative] to
    "#Det _ #Conj -> #NN"
  ],
  "%Noun|Verb%": [
    // to [dream] of
    "to _ #Prep -> #Inf",
    // what [work] he did
    "(which|what|whose) _ #Pron -> #NN",
    // which [boost] it
    "which _ #NN -> #Inf",
    // [visit] https://example.com
    "^ _ #Url -> #Imp",
    // [commit] to
    "^ _ to -> #Imp"
    //John and Mary [walk]
    // '#Pers _ $ -> #Inf',
  ],
  "%Plural|Verb%": [
    // what [walks] he took
    "(which|what|whose) _ #Pron -> #Plur",
    // asking [questions]
    "#Ger _ -> #Plur",
    // and arms roiling around
    "and _ #Ger -> #Plur"
  ],
  "%Person|Verb%": [
    // [chuck] will ...
    "_ (will|had|has|said|says|told|did|learned|wants|wanted) -> #Pers"
  ],
  "%Person|Place%": [
    // [sydney] harbour
    "_ (harbor|harbour|pier|town|city|place|dump|landfill) -> #Place",
    // east [sydney]
    "(west|east|north|south) _ -> #Place"
  ],
  "%Adj|Present%": [
    // quickly [warm]
    "(slowly|quickly) _ -> #V"
  ]
};
var by_switch_default = rules5;

// node_modules/compromise/src/2-two/left-right/model/index.js
var model_default5 = {
  two: {
    leftRight: {
      byWord: lib_default10(by_word_default),
      byTag: lib_default10(by_tag_default),
      bySwitch: lib_default10(by_switch_default)
    }
  }
};

// node_modules/compromise/src/2-two/left-right/methods/_lib.js
var matches2 = (term, context2) => {
  if (context2 === void 0 || context2 === "") {
    return true;
  }
  if (!term) {
    return false;
  }
  if (typeof context2 === "string") {
    if (context2.startsWith("#")) {
      return term.tags.has(context2.slice(1));
    }
    return term.normal === context2;
  }
  if (context2.words.has(term.normal)) {
    return true;
  }
  for (let i3 = 0; i3 < context2.tags.length; i3 += 1) {
    if (term.tags.has(context2.tags[i3])) {
      return true;
    }
  }
  return false;
};
var lib_default11 = matches2;

// node_modules/compromise/src/2-two/left-right/methods/_actions.js
var apply = (term, rule, world2) => {
  const { setTag: setTag2, unTag: unTag2 } = world2.methods.one;
  const terms = [term];
  const reason2 = "2-left-right: " + (rule.reason || "");
  const actions = rule.actions || [rule];
  for (let i3 = 0; i3 < actions.length; i3 += 1) {
    const action = actions[i3];
    if (action.unTag) {
      unTag2(terms, action.unTag, world2.model.one.tagSet);
      continue;
    }
    setTag2(terms, action.tag, world2, rule.safe, reason2);
    if (action.tag === "Noun") {
      const tag = world2.methods.two.looksPlural(term.text) ? "Plural" : "Singular";
      setTag2(terms, tag, world2, rule.safe, reason2);
    }
  }
};
var actions_default = apply;

// node_modules/compromise/src/2-two/left-right/methods/index.js
var collect = (entry, terms, i3, pending) => {
  if (!entry) {
    return;
  }
  const bucket = Array.isArray(entry) ? entry : [entry];
  for (let r2 = 0; r2 < bucket.length; r2 += 1) {
    const rule = bucket[r2];
    if (rule.start !== void 0 && i3 !== rule.start) {
      continue;
    }
    if (rule.end !== void 0 && i3 !== terms.length - 1 - rule.end) {
      continue;
    }
    if (lib_default11(terms[i3 - 1], rule.pre) && lib_default11(terms[i3 + 1], rule.post)) {
      pending.push([terms[i3], rule]);
    }
  }
};
var leftRight = (document, { byWord: byWord3, byTag, bySwitch = {} }, world2) => {
  const pending = [];
  document.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (Object.hasOwn(byWord3, term.normal)) {
        collect(byWord3[term.normal], terms, i3, pending);
      }
      term.tags.forEach((tag) => {
        if (Object.hasOwn(byTag, tag)) {
          collect(byTag[tag], terms, i3, pending);
        }
      });
      if (term.switch && Object.hasOwn(bySwitch, term.switch)) {
        collect(bySwitch[term.switch], terms, i3, pending);
      }
    }
  });
  pending.forEach(([term, rule]) => actions_default(term, rule, world2));
};
var methods17 = { two: { leftRight } };
var methods_default10 = methods17;

// node_modules/compromise/src/2-two/left-right/plugin.js
var plugin3 = {
  model: model_default5,
  methods: methods_default10
};
var plugin_default19 = plugin3;

// node_modules/compromise/src/two.js
one_default.plugin(plugin_default14);
one_default.plugin(plugin_default15);
one_default.plugin(plugin_default16);
one_default.plugin(plugin_default17);
one_default.plugin(plugin_default19);
one_default.plugin(plugin_default18);
var two_default = one_default;

// node_modules/compromise/src/3-three/adjectives/plugin.js
var transforms = ["toComparative", "toSuperlative", "toAdverb", "toNoun"];
var toRoot2 = function(adj) {
  const { fromComparative: fromComparative3, fromSuperlative: fromSuperlative3 } = adj.methods.two.transform.adjective;
  const str = adj.text("normal");
  if (adj.has("#Comparative")) {
    return fromComparative3(str, adj.model);
  }
  if (adj.has("#Superlative")) {
    return fromSuperlative3(str, adj.model);
  }
  return str;
};
var api5 = function(View2) {
  class Adjectives extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Adjectives";
    }
    json(opts2 = {}) {
      const { toAdverb: toAdverb2, toNoun: toNoun2, toSuperlative: toSuperlative3, toComparative: toComparative3 } = this.methods.two.transform.adjective;
      opts2.normal = true;
      return this.map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        const str = toRoot2(m3);
        json.adjective = {
          adverb: toAdverb2(str, this.model),
          noun: toNoun2(str, this.model),
          superlative: toSuperlative3(str, this.model),
          comparative: toComparative3(str, this.model)
        };
        return json;
      }, []);
    }
    adverbs() {
      return this.before("#Adverb+$").concat(this.after("^#Adverb+"));
    }
    conjugate(n3) {
      const { toComparative: toComparative3, toSuperlative: toSuperlative3, toNoun: toNoun2, toAdverb: toAdverb2 } = this.methods.two.transform.adjective;
      return this.getNth(n3).map((adj) => {
        const root = toRoot2(adj);
        return {
          Adjective: root,
          Comparative: toComparative3(root, this.model),
          Superlative: toSuperlative3(root, this.model),
          Noun: toNoun2(root, this.model),
          Adverb: toAdverb2(root, this.model)
        };
      }, []);
    }
    toRoot(n3) {
      return this.getNth(n3).map((adj) => {
        return adj.replaceWith(toRoot2(adj));
      });
    }
  }
  transforms.forEach((name) => {
    Object.defineProperty(Adjectives.prototype, name, {
      configurable: true,
      writable: true,
      value: function(n3) {
        const transform = this.methods.two.transform.adjective[name];
        return this.getNth(n3).map((adj) => {
          return adj.replaceWith(transform(toRoot2(adj), this.model));
        });
      }
    });
  });
  View2.prototype.adjectives = function(n3) {
    let m3 = this.match("#Adjective");
    m3 = m3.getNth(n3);
    return new Adjectives(m3.document, m3.pointer);
  };
  View2.prototype.superlatives = function(n3) {
    let m3 = this.match("#Superlative");
    m3 = m3.getNth(n3);
    return new Adjectives(m3.document, m3.pointer);
  };
  View2.prototype.comparatives = function(n3) {
    let m3 = this.match("#Comparative");
    m3 = m3.getNth(n3);
    return new Adjectives(m3.document, m3.pointer);
  };
};
var plugin_default20 = { api: api5 };

// node_modules/compromise/src/3-three/adverbs/plugin.js
var toRoot3 = function(adj) {
  const str = adj.compute("root").text("root");
  return str;
};
var api6 = function(View2) {
  class Adverbs extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Adverbs";
    }
    conjugate(n3) {
      return this.getNth(n3).map((adv) => {
        const adj = toRoot3(adv);
        return {
          Adverb: adv.text("normal"),
          Adjective: adj
        };
      }, []);
    }
    json(opts2 = {}) {
      const fromAdverb = this.methods.two.transform.adjective.fromAdverb;
      opts2.normal = true;
      return this.map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        json.adverb = {
          adjective: fromAdverb(json.normal)
        };
        return json;
      }, []);
    }
  }
  View2.prototype.adverbs = function(n3) {
    let m3 = this.match("#Adverb");
    m3 = m3.getNth(n3);
    return new Adverbs(m3.document, m3.pointer);
  };
};
var plugin_default21 = { api: api6 };

// node_modules/compromise/src/3-three/chunker/api/clauses.js
var byComma = function(doc) {
  let commas = doc.match("@hasComma");
  commas = commas.filter((m3) => {
    if (m3.growLeft(".").wordCount() === 1) {
      return false;
    }
    if (m3.growRight(". .").wordCount() === 1) {
      return false;
    }
    let more = m3.grow(".");
    more = more.ifNo("@hasComma @hasComma");
    more = more.ifNo("@hasComma (and|or) .");
    more = more.ifNo("(#City && @hasComma) #Country");
    more = more.ifNo("(#WeekDay && @hasComma) #Date");
    more = more.ifNo("(#Date+ && @hasComma) #Value");
    more = more.ifNo("(#Adjective && @hasComma) #Adjective");
    return more.found;
  });
  return doc.splitAfter(commas);
};
var splitParentheses = function(doc) {
  let matches3 = doc.parentheses();
  matches3 = matches3.filter((m3) => {
    return m3.wordCount() >= 3 && m3.has("#Verb") && m3.has("#Noun");
  });
  return doc.splitOn(matches3);
};
var splitQuotes = function(doc) {
  let matches3 = doc.quotations();
  matches3 = matches3.filter((m3) => {
    return m3.wordCount() >= 3 && m3.has("#Verb") && m3.has("#Noun");
  });
  return doc.splitOn(matches3);
};
var clauses = function(n3) {
  let found = this;
  found = splitParentheses(found);
  found = splitQuotes(found);
  found = byComma(found);
  found = found.splitAfter("(@hasEllipses|@hasSemicolon|@hasDash|@hasColon)");
  found = found.splitAfter("^#Pronoun (said|says)");
  found = found.splitBefore("(said|says) #ProperNoun$");
  found = found.splitBefore(". . if .{4}");
  found = found.splitBefore("and while");
  found = found.splitBefore("now that");
  found = found.splitBefore("ever since");
  found = found.splitBefore("(supposing|although)");
  found = found.splitBefore("even (while|if|though)");
  found = found.splitBefore("(whereas|whose)");
  found = found.splitBefore("as (though|if)");
  found = found.splitBefore("(til|until)");
  const m3 = found.match("#Verb .* [but] .* #Verb", 0);
  if (m3.found) {
    found = found.splitBefore(m3);
  }
  const condition = found.if("if .{2,9} then .").match("then");
  found = found.splitBefore(condition);
  if (typeof n3 === "number") {
    found = found.get(n3);
  }
  return found;
};
var clauses_default = clauses;

// node_modules/compromise/src/3-three/chunker/api/chunks.js
var chunks = function(doc) {
  const all4 = [];
  let lastOne = null;
  const m3 = doc.clauses();
  m3.docs.forEach((terms) => {
    terms.forEach((term) => {
      if (!term.chunk || term.chunk !== lastOne) {
        lastOne = term.chunk;
        all4.push([term.index[0], term.index[1], term.index[1] + 1]);
      } else {
        all4[all4.length - 1][2] = term.index[1] + 1;
      }
    });
    lastOne = null;
  });
  const parts = doc.update(all4);
  return parts;
};
var chunks_default2 = chunks;

// node_modules/compromise/src/3-three/chunker/api/api.js
var api7 = function(View2) {
  class Chunks extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Chunks";
    }
    isVerb() {
      return this.filter((c2) => c2.has("<Verb>"));
    }
    isNoun() {
      return this.filter((c2) => c2.has("<Noun>"));
    }
    isAdjective() {
      return this.filter((c2) => c2.has("<Adjective>"));
    }
    isPivot() {
      return this.filter((c2) => c2.has("<Pivot>"));
    }
    // chunk-friendly debug
    debug() {
      this.toView().debug("chunks");
      return this;
    }
    // overloaded - keep Sentences class
    update(pointer) {
      const m3 = new Chunks(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.chunks = function(n3) {
    let m3 = chunks_default2(this);
    m3 = m3.getNth(n3);
    return new Chunks(this.document, m3.pointer);
  };
  View2.prototype.clauses = clauses_default;
};
var api_default12 = api7;

// node_modules/compromise/src/3-three/chunker/compute/01-easy.js
var byWord2 = {
  this: "Noun",
  then: "Pivot"
};
var easyMode = function(document) {
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let t3 = 0; t3 < document[n3].length; t3 += 1) {
      const term = document[n3][t3];
      if (Object.hasOwn(byWord2, term.normal) === true) {
        term.chunk = byWord2[term.normal];
        continue;
      }
      if (term.tags.has("Verb")) {
        term.chunk = "Verb";
        continue;
      }
      if (term.tags.has("Noun") || term.tags.has("Determiner")) {
        term.chunk = "Noun";
        continue;
      }
      if (term.tags.has("Value")) {
        term.chunk = "Noun";
        continue;
      }
      if (term.tags.has("QuestionWord")) {
        term.chunk = "Pivot";
        continue;
      }
    }
  }
};
var easy_default = easyMode;

// node_modules/compromise/src/3-three/chunker/compute/02-neighbours.js
var byNeighbour = function(document) {
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let t3 = 0; t3 < document[n3].length; t3 += 1) {
      const term = document[n3][t3];
      if (term.chunk) {
        continue;
      }
      const onRight = document[n3][t3 + 1];
      const onLeft = document[n3][t3 - 1];
      if (term.tags.has("Adjective")) {
        if (onLeft && onLeft.tags.has("Copula")) {
          term.chunk = "Adjective";
          continue;
        }
        if (onLeft && onLeft.tags.has("Determiner")) {
          term.chunk = "Noun";
          continue;
        }
        if (onRight && onRight.tags.has("Noun")) {
          term.chunk = "Noun";
          continue;
        }
        continue;
      }
      if (term.tags.has("Adverb") || term.tags.has("Negative")) {
        if (onLeft && onLeft.tags.has("Adjective")) {
          term.chunk = "Adjective";
          continue;
        }
        if (onLeft && onLeft.tags.has("Verb")) {
          term.chunk = "Verb";
          continue;
        }
        if (onRight && onRight.tags.has("Adjective")) {
          term.chunk = "Adjective";
          continue;
        }
        if (onRight && onRight.tags.has("Verb")) {
          term.chunk = "Verb";
          continue;
        }
      }
    }
  }
};
var neighbours_default3 = byNeighbour;

// node_modules/compromise/src/3-three/chunker/compute/03-matcher.js
var rules6 = [
  // === Conjunction ===
  // that the houses
  { match: "[that] #Det #NN", group: 0, chunk: "Pivot" },
  // estimated that
  { match: "#Past [that]", group: 0, chunk: "Pivot" },
  // so the
  { match: "[so] #Det", group: 0, chunk: "Pivot" },
  // === Adjective ===
  // was really nice
  { match: "#Cop #Adv+? [#Adj]", group: 0, chunk: "Adjective" },
  // was nice
  // { match: '#Copula [#Adjective]', group: 0, chunk: 'Adjective' },
  // nice and cool
  { match: "#Adj and #Adj", chunk: "Adjective" },
  // really nice
  // { match: '#Adverb+ #Adjective', chunk: 'Adjective' },
  // === Verb ===
  // quickly and suddenly run
  { match: "#Adv+ and #Adv #V", chunk: "Verb" },
  // sitting near
  { match: "#Ger #Adj$", chunk: "Verb" },
  // going to walk
  { match: "#Ger to #V", chunk: "Verb" },
  // come and have a drink
  { match: "#Pres and #Pres", chunk: "Verb" },
  // really not
  { match: "#Adv #Neg", chunk: "Verb" },
  // want to see
  { match: "(want|wants|wanted) to #Inf", chunk: "Verb" },
  // walk ourselves
  { match: "#V #Refl", chunk: "Verb" },
  // tell him the story
  // { match: '#PresentTense [#Pronoun] #Determiner', group: 0, chunk: 'Verb' },
  // tries to walk
  { match: "#V [to] #Adv? #Inf", group: 0, chunk: "Verb" },
  // upon seeing
  { match: "[#Prep] #Ger", group: 0, chunk: "Verb" },
  // ensure that
  { match: "#Inf [that] <Noun>", group: 0, chunk: "Verb" },
  // === Noun ===
  // the brown fox
  // { match: '#Determiner #Adjective+ #Noun', chunk: 'Noun' },
  // the fox
  // { match: '(the|this) <Noun>', chunk: 'Noun' },
  // brown fox
  // { match: '#Adjective+ <Noun>', chunk: 'Noun' },
  // --- of ---
  // son of a gun
  { match: "#NN of #Det? #NN", chunk: "Noun" },
  // 3 beautiful women
  { match: "#Value+ #Adv? #Adj", chunk: "Noun" },
  // the last russian tsar
  { match: "the [#Adj] #NN", chunk: "Noun" },
  // breakfast in bed
  { match: "#Sing in #Det? #Sing", chunk: "Noun" },
  // Some citizens in this Canadian capital
  { match: "#Plur [in] #Det? #NN", group: 0, chunk: "Pivot" },
  // indoor and outdoor seating
  { match: "#NN and #Det? #NN", notIf: "(#Poss|#Pron)", chunk: "Noun" }
  //  boys and girls
  // { match: '#Plural and #Determiner? #Plural', chunk: 'Noun' },
  // tomatoes and cheese
  // { match: '#Noun and #Determiner? #Noun', notIf: '#Pronoun', chunk: 'Noun' },
  // that is why
  // { match: '[that] (is|was)', group: 0, chunk: 'Noun' },
];
rules6.forEach((rule) => {
  rule.match = lib_default9(rule.match);
  if (rule.notIf) {
    rule.notIf = lib_default9(rule.notIf);
  }
});
var net2 = null;
var matcher = function(view, _, world2) {
  const { methods: methods19 } = world2;
  net2 ||= methods19.one.buildNet(rules6, world2);
  view.sweep(net2);
};
var matcher_default = matcher;

// node_modules/compromise/src/3-three/chunker/compute/04-fallback.js
var setChunk = function(term, chunk) {
  const env2 = globalThis.process?.env ?? globalThis.env ?? {};
  if (env2.DEBUG_CHUNKS) {
    const str = (term.normal + "'").padEnd(8);
    console.log(`  | '${str}  \u2192  \x1B[34m${chunk.padEnd(12)}\x1B[0m \x1B[2m -fallback- \x1B[0m`);
  }
  term.chunk = chunk;
};
var fallback = function(document) {
  for (let n3 = 0; n3 < document.length; n3 += 1) {
    for (let t3 = 0; t3 < document[n3].length; t3 += 1) {
      const term = document[n3][t3];
      if (term.chunk === void 0) {
        if (term.tags.has("Conjunction")) {
          setChunk(term, "Pivot");
        } else if (term.tags.has("Preposition")) {
          setChunk(term, "Pivot");
        } else if (term.tags.has("Adverb")) {
          setChunk(term, "Verb");
        } else {
          term.chunk = "Noun";
        }
      }
    }
  }
};
var fallback_default2 = fallback;

// node_modules/compromise/src/3-three/chunker/compute/05-fixUp.js
var fixUp = function(docs) {
  const byChunk = [];
  let current = null;
  docs.forEach((terms) => {
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (current && term.chunk === current) {
        byChunk[byChunk.length - 1].terms.push(term);
      } else {
        byChunk.push({ chunk: term.chunk, terms: [term] });
        current = term.chunk;
      }
    }
  });
  byChunk.forEach((c2) => {
    if (c2.chunk === "Verb") {
      const hasVerb = c2.terms.find((t3) => t3.tags.has("Verb"));
      if (!hasVerb) {
        c2.terms.forEach((t3) => t3.chunk = null);
      }
    }
  });
};
var fixUp_default = fixUp;

// node_modules/compromise/src/3-three/chunker/compute/index.js
var findChunks = function(view) {
  const { docs, world: world2 } = view;
  easy_default(docs);
  neighbours_default3(docs);
  matcher_default(view, docs, world2);
  fallback_default2(docs, world2);
  fixUp_default(docs, world2);
};
var compute_default12 = { chunks: findChunks };

// node_modules/compromise/src/3-three/chunker/plugin.js
var plugin_default22 = {
  compute: compute_default12,
  api: api_default12,
  hooks: ["chunks"]
};

// node_modules/compromise/src/3-three/misc/acronyms/index.js
var hasPeriod2 = /\./g;
var api8 = function(View2) {
  class Acronyms extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Acronyms";
    }
    strip() {
      this.docs.forEach((terms) => {
        terms.forEach((term) => {
          term.text = term.text.replace(hasPeriod2, "");
          term.normal = term.normal.replace(hasPeriod2, "");
        });
      });
      return this;
    }
    addPeriods() {
      this.docs.forEach((terms) => {
        terms.forEach((term) => {
          term.text = term.text.replace(hasPeriod2, "");
          term.normal = term.normal.replace(hasPeriod2, "");
          term.text = term.text.split("").join(".") + ".";
          term.normal = term.normal.split("").join(".") + ".";
        });
      });
      return this;
    }
  }
  View2.prototype.acronyms = function(n3) {
    let m3 = this.match("#Acronym");
    m3 = m3.getNth(n3);
    return new Acronyms(m3.document, m3.pointer);
  };
};
var acronyms_default2 = api8;

// node_modules/compromise/src/3-three/misc/parentheses/fns.js
var hasOpen2 = /\(/;
var hasClosed2 = /\)/;
var findEnd = function(terms, i3) {
  for (; i3 < terms.length; i3 += 1) {
    if (terms[i3].post && hasClosed2.test(terms[i3].post)) {
      let [, index3] = terms[i3].index;
      index3 ||= 0;
      return index3;
    }
  }
  return null;
};
var find2 = function(doc) {
  const ptrs = [];
  doc.docs.forEach((terms) => {
    const isOpen = false;
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (!isOpen && term.pre && hasOpen2.test(term.pre)) {
        const end2 = findEnd(terms, i3);
        if (end2 !== null) {
          const [n3, start2] = terms[i3].index;
          ptrs.push([n3, start2, end2 + 1, terms[i3].id]);
          i3 = end2;
        }
      }
    }
  });
  return doc.update(ptrs);
};
var strip = function(m3) {
  m3.docs.forEach((terms) => {
    terms[0].pre = terms[0].pre.replace(hasOpen2, "");
    const last = terms[terms.length - 1];
    last.post = last.post.replace(hasClosed2, "");
  });
  return m3;
};

// node_modules/compromise/src/3-three/misc/parentheses/index.js
var api9 = function(View2) {
  class Parentheses extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Possessives";
    }
    strip() {
      return strip(this);
    }
  }
  View2.prototype.parentheses = function(n3) {
    let m3 = find2(this);
    m3 = m3.getNth(n3);
    return new Parentheses(m3.document, m3.pointer);
  };
};
var parentheses_default = api9;

// node_modules/compromise/src/3-three/misc/possessives/index.js
var apostropheS2 = /'s$/;
var find3 = function(doc) {
  let m3 = doc.match("#Possessive+");
  if (m3.has("#Person")) {
    m3 = m3.growLeft("#Person+");
  }
  if (m3.has("#Place")) {
    m3 = m3.growLeft("#Place+");
  }
  if (m3.has("#Organization")) {
    m3 = m3.growLeft("#Organization+");
  }
  return m3;
};
var api10 = function(View2) {
  class Possessives extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Possessives";
    }
    strip() {
      this.docs.forEach((terms) => {
        terms.forEach((term) => {
          term.text = term.text.replace(apostropheS2, "");
          term.normal = term.normal.replace(apostropheS2, "");
        });
      });
      return this;
    }
  }
  View2.prototype.possessives = function(n3) {
    let m3 = find3(this);
    m3 = m3.getNth(n3);
    return new Possessives(m3.document, m3.pointer);
  };
};
var possessives_default = api10;

// node_modules/compromise/src/3-three/misc/quotations/fns.js
var pairs2 = {
  '"': '"',
  // 'StraightDoubleQuotes'
  "\uFF02": "\uFF02",
  // 'StraightDoubleQuotesWide'
  "'": "'",
  // 'StraightSingleQuotes'
  "\u201C": "\u201D",
  // 'CommaDoubleQuotes'
  "\u2018": "\u2019",
  // 'CommaSingleQuotes'
  "\u201F": "\u201D",
  // 'CurlyDoubleQuotesReversed'
  "\u201B": "\u2019",
  // 'CurlySingleQuotesReversed'
  "\u201E": "\u201D",
  // 'LowCurlyDoubleQuotes'
  "\u2E42": "\u201D",
  // 'LowCurlyDoubleQuotesReversed'
  "\u201A": "\u2019",
  // 'LowCurlySingleQuotes'
  "\xAB": "\xBB",
  // 'AngleDoubleQuotes' «, »
  "\u2039": "\u203A",
  // 'AngleSingleQuotes'
  // Prime 'non quotation'
  "\u2035": "\u2032",
  // 'PrimeSingleQuotes'
  "\u2036": "\u2033",
  // 'PrimeDoubleQuotes'
  "\u2037": "\u2034",
  // 'PrimeTripleQuotes'
  // Prime 'quotation' variation
  "\u301D": "\u301E",
  // 'PrimeDoubleQuotes'
  "`": "\xB4",
  // 'PrimeSingleQuotes'
  "\u301F": "\u301E"
  // 'LowPrimeDoubleQuotesReversed'
};
var hasOpen3 = RegExp("[" + Object.keys(pairs2).join("") + "]");
var hasClosed3 = RegExp("[" + Object.values(pairs2).join("") + "]");
var findEnd2 = function(terms, i3) {
  const have = terms[i3].pre.match(hasOpen3)[0] || "";
  if (!have || !pairs2[have]) {
    return null;
  }
  const want = pairs2[have];
  for (; i3 < terms.length; i3 += 1) {
    if (terms[i3].post && terms[i3].post.match(want)) {
      return i3;
    }
  }
  return null;
};
var find4 = function(doc) {
  const ptrs = [];
  doc.docs.forEach((terms) => {
    const isOpen = false;
    for (let i3 = 0; i3 < terms.length; i3 += 1) {
      const term = terms[i3];
      if (!isOpen && term.pre && hasOpen3.test(term.pre)) {
        const end2 = findEnd2(terms, i3);
        if (end2 !== null) {
          const [n3, start2] = terms[i3].index;
          ptrs.push([n3, start2, end2 + 1, terms[i3].id]);
          i3 = end2;
        }
      }
    }
  });
  return doc.update(ptrs);
};
var strip2 = function(m3) {
  m3.docs.forEach((terms) => {
    terms[0].pre = terms[0].pre.replace(hasOpen3, "");
    const lastTerm = terms[terms.length - 1];
    lastTerm.post = lastTerm.post.replace(hasClosed3, "");
  });
};

// node_modules/compromise/src/3-three/misc/quotations/index.js
var api11 = function(View2) {
  class Quotations extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Possessives";
    }
    strip() {
      return strip2(this);
    }
  }
  View2.prototype.quotations = function(n3) {
    let m3 = find4(this);
    m3 = m3.getNth(n3);
    return new Quotations(m3.document, m3.pointer);
  };
};
var quotations_default = api11;

// node_modules/compromise/src/3-three/misc/selections/index.js
var phoneNumbers = function(n3) {
  let m3 = this.splitAfter("@hasComma");
  m3 = m3.match("#PhoneNumber+");
  m3 = m3.getNth(n3);
  return m3;
};
var addresses = function(n3) {
  let m3 = this.match("#Address+");
  m3 = m3.getNth(n3);
  return m3;
};
var selections = [
  ["hyphenated", "@hasHyphen ."],
  ["hashTags", "#HashTag"],
  ["emails", "#Email"],
  ["emoji", "#Emoji"],
  ["emoticons", "#Emoticon"],
  ["atMentions", "#AtMention"],
  ["urls", "#Url"],
  // ['pronouns', '#Pronoun'],
  ["conjunctions", "#Conjunction"],
  ["prepositions", "#Preposition"],
  ["abbreviations", "#Abbreviation"],
  ["honorifics", "#Honorific"]
];
var aliases2 = [
  ["emojis", "emoji"],
  ["atmentions", "atMentions"]
];
var addMethods = function(View2) {
  selections.forEach((a2) => {
    View2.prototype[a2[0]] = function(n3) {
      const m3 = this.match(a2[1]);
      return typeof n3 === "number" ? m3.get(n3) : m3;
    };
  });
  View2.prototype.phoneNumbers = phoneNumbers;
  View2.prototype.addresses = addresses;
  aliases2.forEach((a2) => {
    View2.prototype[a2[0]] = View2.prototype[a2[1]];
  });
};
var selections_default = addMethods;

// node_modules/compromise/src/3-three/misc/slashes/index.js
var hasSlash2 = /\//;
var api12 = function(View2) {
  class Slashes extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Slashes";
    }
    split() {
      return this.map((m3) => {
        const str = m3.text();
        const arr = str.split(hasSlash2);
        m3 = m3.replaceWith(arr.join(" "));
        return m3.growRight("(" + arr.join("|") + ")+");
      });
    }
  }
  View2.prototype.slashes = function(n3) {
    let m3 = this.match("#SlashedTerm");
    m3 = m3.getNth(n3);
    return new Slashes(m3.document, m3.pointer);
  };
};
var slashes_default2 = api12;

// node_modules/compromise/src/3-three/misc/plugin.js
var plugin_default23 = {
  api: function(View2) {
    acronyms_default2(View2);
    parentheses_default(View2);
    possessives_default(View2);
    quotations_default(View2);
    selections_default(View2);
    slashes_default2(View2);
  }
};

// node_modules/compromise/src/3-three/normalize/methods.js
var termLoop2 = function(view, cb) {
  view.docs.forEach((terms) => {
    terms.forEach(cb);
  });
};
var methods_default11 = {
  // remove titlecasing, uppercase
  "case": (doc) => {
    termLoop2(doc, (term) => {
      term.text = term.text.toLowerCase();
    });
  },
  // visually romanize/anglicize 'Björk' into 'Bjork'.
  "unicode": (doc) => {
    const world2 = doc.world;
    const killUnicode2 = world2.methods.one.killUnicode;
    termLoop2(doc, (term) => term.text = killUnicode2(term.text, world2));
  },
  // remove hyphens, newlines, and force one space between words
  "whitespace": (doc) => {
    termLoop2(doc, (term) => {
      term.post = term.post.replace(/\s+/g, " ");
      term.post = term.post.replace(/\s([.,?!:;])/g, "$1");
      term.pre = term.pre.replace(/\s+/g, "");
    });
  },
  // remove commas, semicolons - but keep sentence-ending punctuation
  "punctuation": (doc) => {
    termLoop2(doc, (term) => {
      term.post = term.post.replace(/[–—-]/g, " ");
      term.post = term.post.replace(/[,:;]/g, "");
      term.post = term.post.replace(/\.{2,}/g, "");
      term.post = term.post.replace(/\?{2,}/g, "?");
      term.post = term.post.replace(/!{2,}/g, "!");
      term.post = term.post.replace(/\?!+/g, "?");
    });
    const docs = doc.docs;
    const terms = docs[docs.length - 1];
    if (terms && terms.length > 0) {
      const lastTerm = terms[terms.length - 1];
      lastTerm.post = lastTerm.post.replace(/ /g, "");
    }
  },
  // ====== subsets ===
  // turn "isn't" to "is not"
  "contractions": (doc) => {
    doc.contractions().expand();
  },
  //remove periods from acronyms, like 'F.B.I.'
  "acronyms": (doc) => {
    doc.acronyms().strip();
  },
  //remove words inside brackets (like these)
  "parentheses": (doc) => {
    doc.parentheses().strip();
  },
  // turn "Google's tax return" to "Google tax return"
  "possessives": (doc) => {
    doc.possessives().strip();
  },
  // turn "tax return" to tax return
  "quotations": (doc) => {
    doc.quotations().strip();
  },
  // remove them
  "emoji": (doc) => {
    doc.emojis().remove();
  },
  //turn 'Vice Admiral John Smith' to 'John Smith'
  "honorifics": (doc) => {
    doc.match("#Honorific+ #Person").honorifics().remove();
  },
  // remove needless adverbs
  "adverbs": (doc) => {
    doc.adverbs().remove();
  },
  // turn "batmobiles" into "batmobile"
  "nouns": (doc) => {
    doc.nouns().toSingular();
  },
  // turn all verbs into Infinitive form - "I walked" → "I walk"
  "verbs": (doc) => {
    doc.verbs().toInfinitive();
  },
  // turn "fifty" into "50"
  "numbers": (doc) => {
    doc.numbers().toNumber();
  },
  /** remove bullets from beginning of phrase */
  "debullet": (doc) => {
    const hasBullet = /^\s*([-–—*•])\s*$/;
    doc.docs.forEach((terms) => {
      if (hasBullet.test(terms[0].pre)) {
        terms[0].pre = terms[0].pre.replace(hasBullet, "");
      }
    });
    return doc;
  }
};

// node_modules/compromise/src/3-three/normalize/api.js
var split2 = (str) => {
  return str.split("|").reduce((h2, k2) => {
    h2[k2] = true;
    return h2;
  }, {});
};
var light = "unicode|punctuation|whitespace|acronyms";
var medium = "|case|contractions|parentheses|quotations|emoji|honorifics|debullet";
var heavy = "|possessives|adverbs|nouns|verbs";
var presets = {
  light: split2(light),
  medium: split2(light + medium),
  heavy: split2(light + medium + heavy)
};
function api_default13(View2) {
  View2.prototype.normalize = function(opts2 = "light") {
    if (typeof opts2 === "string") {
      opts2 = presets[opts2];
    }
    Object.keys(opts2).forEach((fn) => {
      if (Object.hasOwn(methods_default11, fn)) {
        methods_default11[fn](this, opts2[fn]);
      }
    });
    return this;
  };
}

// node_modules/compromise/src/3-three/normalize/plugin.js
var plugin_default24 = {
  api: api_default13
};

// node_modules/compromise/src/3-three/nouns/find.js
var findNouns = function(doc) {
  let m3 = doc.clauses().match("<Noun>");
  let commas = m3.match("@hasComma");
  commas = commas.not("#Place");
  if (commas.found) {
    m3 = m3.splitAfter(commas);
  }
  m3 = m3.splitOn("#Expression");
  m3 = m3.splitOn("(he|she|we|you|they|i)");
  m3 = m3.splitOn("(#Noun|#Adjective) [(he|him|she|it)]", 0);
  m3 = m3.splitOn("[(he|him|she|it)] (#Determiner|#Value)", 0);
  m3 = m3.splitBefore("#Noun [(the|a|an)] #Adjective? #Noun", 0);
  m3 = m3.splitOn("[(here|there)] #Noun", 0);
  m3 = m3.splitOn("[#Noun] (here|there)", 0);
  m3 = m3.splitBefore("(our|my|their|your)");
  m3 = m3.splitOn("#Noun [#Determiner]", 0);
  m3 = m3.if("#Noun");
  return m3;
};
var find_default = findNouns;

// node_modules/compromise/src/3-three/nouns/api/isSubordinate.js
var list2 = [
  "after",
  "although",
  "as if",
  "as long as",
  "as",
  "because",
  "before",
  "even if",
  "even though",
  "ever since",
  "if",
  "in order that",
  "provided that",
  "since",
  "so that",
  "than",
  "that",
  "though",
  "unless",
  "until",
  "what",
  "whatever",
  "when",
  "whenever",
  "where",
  "whereas",
  "wherever",
  "whether",
  "which",
  "whichever",
  "who",
  "whoever",
  "whom",
  "whomever",
  "whose"
];
var isSubordinate = function(m3) {
  if (m3.before("#Preposition$").found) {
    return true;
  }
  const leadIn = m3.before();
  if (!leadIn.found) {
    return false;
  }
  for (let i3 = 0; i3 < list2.length; i3 += 1) {
    if (m3.has(list2[i3])) {
      return true;
    }
  }
  return false;
};
var isSubordinate_default = isSubordinate;

// node_modules/compromise/src/3-three/nouns/api/isPlural.js
var notPlural2 = "(#Pronoun|#Place|#Value|#Person|#Uncountable|#Month|#WeekDay|#Holiday|#Possessive)";
var isPlural2 = function(m3, root) {
  if (m3.has("#Plural")) {
    return true;
  }
  if (m3.has("#Noun and #Noun")) {
    return true;
  }
  if (m3.has("(we|they)")) {
    return true;
  }
  if (root.has(notPlural2) === true) {
    return false;
  }
  if (m3.has("#Singular")) {
    return false;
  }
  const str = root.text("normal");
  return str.length > 3 && str.endsWith("s") && !str.endsWith("ss");
};
var isPlural_default = isPlural2;

// node_modules/compromise/src/3-three/nouns/api/parse.js
var getRoot2 = function(m3) {
  let tmp = m3.clone();
  tmp = tmp.match("#Noun+");
  tmp = tmp.remove("(#Adjective|#Preposition|#Determiner|#Value)");
  tmp = tmp.not("#Possessive");
  tmp = tmp.first();
  if (!tmp.found) {
    return m3;
  }
  return tmp;
};
var parseNoun = function(m3) {
  const root = getRoot2(m3);
  return {
    determiner: m3.match("#Determiner").eq(0),
    adjectives: m3.match("#Adjective"),
    number: m3.values(),
    isPlural: isPlural_default(m3, root),
    isSubordinate: isSubordinate_default(m3),
    root
  };
};
var parse_default3 = parseNoun;

// node_modules/compromise/src/3-three/nouns/api/toJSON.js
var toText2 = (m3) => m3.text();
var toArray2 = (m3) => m3.json({ terms: false, normal: true }).map((s3) => s3.normal);
var getNum = function(m3) {
  const num = null;
  if (!m3.found) {
    return num;
  }
  const val = m3.values(0);
  if (val.found) {
    const obj = val.parse()[0] || {};
    return obj.num;
  }
  return num;
};
var toJSON2 = function(m3) {
  const res = parse_default3(m3);
  return {
    root: toText2(res.root),
    number: getNum(res.number),
    determiner: toText2(res.determiner),
    adjectives: toArray2(res.adjectives),
    isPlural: res.isPlural,
    isSubordinate: res.isSubordinate
  };
};
var toJSON_default = toJSON2;

// node_modules/compromise/src/3-three/nouns/api/hasPlural.js
var hasPlural = function(root) {
  if (root.has("^(#Uncountable|#ProperNoun|#Place|#Pronoun|#Acronym)+$")) {
    return false;
  }
  return true;
};
var hasPlural_default = hasPlural;

// node_modules/compromise/src/3-three/nouns/api/toPlural.js
var keep = { tags: true };
var nounToPlural = function(m3, parsed) {
  if (parsed.isPlural === true) {
    return m3;
  }
  if (parsed.root.has("#Possessive")) {
    parsed.root = parsed.root.possessives().strip();
  }
  if (!hasPlural_default(parsed.root)) {
    return m3;
  }
  const { methods: methods19, model: model5 } = m3.world;
  const { toPlural } = methods19.two.transform.noun;
  const str = parsed.root.text({ keepPunct: false });
  const plural2 = toPlural(str, model5);
  m3.match(parsed.root).replaceWith(plural2, keep).tag("Plural", "toPlural");
  if (parsed.determiner.has("(a|an)")) {
    m3.remove(parsed.determiner);
  }
  const copula = parsed.root.after("not? #Adverb+? [#Copula]", 0);
  if (copula.found) {
    if (copula.has("is")) {
      m3.replace(copula, "are");
    } else if (copula.has("was")) {
      m3.replace(copula, "were");
    }
  }
  return m3;
};
var toPlural_default2 = nounToPlural;

// node_modules/compromise/src/3-three/nouns/api/toSingular.js
var keep2 = { tags: true };
var matchCase = function(original, str) {
  if (original.length > 1 && original === original.toUpperCase() && original !== original.toLowerCase()) {
    return str.toUpperCase();
  }
  if (/^\p{Lu}/u.test(original)) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  return str;
};
var nounToSingular = function(m3, parsed) {
  if (parsed.isPlural === false) {
    return m3;
  }
  const { methods: methods19, model: model5 } = m3.world;
  const { toSingular: toSingular2 } = methods19.two.transform.noun;
  const str = parsed.root.text("normal");
  const single = toSingular2(str, model5);
  const before2 = (parsed.root.docs[0] || []).map((term) => term.text);
  const after2 = m3.replace(parsed.root, single, keep2).tag("Singular", "toPlural");
  const terms = after2.docs[0] || [];
  if (terms.length === before2.length) {
    terms.forEach((term, i3) => {
      term.text = matchCase(before2[i3], term.text);
    });
  }
  return m3;
};
var toSingular_default2 = nounToSingular;

// node_modules/compromise/src/3-three/nouns/api/api.js
var api13 = function(View2) {
  class Nouns extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Nouns";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default3);
    }
    json(n3) {
      const opts2 = typeof n3 === "object" ? n3 : {};
      return this.getNth(n3).map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        if (opts2 && opts2.noun !== false) {
          json.noun = toJSON_default(m3);
        }
        return json;
      }, []);
    }
    conjugate(n3) {
      const methods19 = this.world.methods.two.transform.noun;
      return this.getNth(n3).map((m3) => {
        const parsed = parse_default3(m3);
        const root = parsed.root.compute("root").text("root");
        const res = {
          Singular: root
        };
        if (hasPlural_default(parsed.root)) {
          res.Plural = methods19.toPlural(root, this.model);
        }
        if (res.Singular === res.Plural) {
          delete res.Plural;
        }
        return res;
      }, []);
    }
    isPlural(n3) {
      const res = this.filter((m3) => parse_default3(m3).isPlural);
      return res.getNth(n3);
    }
    isSingular(n3) {
      const res = this.filter((m3) => !parse_default3(m3).isPlural);
      return res.getNth(n3);
    }
    adjectives(n3) {
      let res = this.update([]);
      this.forEach((m3) => {
        const adj = parse_default3(m3).adjectives;
        if (adj.found) {
          res = res.concat(adj);
        }
      });
      return res.getNth(n3);
    }
    toPlural(n3) {
      return this.getNth(n3).map((m3) => {
        return toPlural_default2(m3, parse_default3(m3));
      });
    }
    toSingular(n3) {
      return this.getNth(n3).map((m3) => {
        const res = parse_default3(m3);
        return toSingular_default2(m3, res);
      });
    }
    // create a new View, from this one
    update(pointer) {
      const m3 = new Nouns(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.nouns = function(n3) {
    let m3 = find_default(this);
    m3 = m3.getNth(n3);
    return new Nouns(this.document, m3.pointer);
  };
};
var api_default14 = api13;

// node_modules/compromise/src/3-three/nouns/plugin.js
var plugin_default25 = {
  api: api_default14
};

// node_modules/compromise/src/3-three/numbers/fractions/find.js
var findFractions = function(doc, n3) {
  let m3 = doc.match("#Fraction+");
  m3 = m3.filter((r2) => {
    return !r2.lookBehind("#Value and$").found;
  });
  m3 = m3.notIf("#Value seconds");
  if (typeof n3 === "number") {
    m3 = m3.eq(n3);
  }
  return m3;
};
var find_default2 = findFractions;

// node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/findModifiers.js
var findModifiers = (str) => {
  const mults = [
    {
      reg: /^(minus|negative)[\s-]/i,
      mult: -1
    },
    {
      reg: /^(a\s)?half[\s-](of\s)?/i,
      mult: 0.5
    }
    //  {
    //   reg: /^(a\s)?quarter[\s\-]/i,
    //   mult: 0.25
    // }
  ];
  for (let i3 = 0; i3 < mults.length; i3++) {
    if (mults[i3].reg.test(str) === true) {
      return {
        amount: mults[i3].mult,
        str: str.replace(mults[i3].reg, "")
      };
    }
  }
  return {
    amount: 1,
    str
  };
};
var findModifiers_default = findModifiers;

// node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/data.js
var data_default3 = {
  ones: {
    zeroth: 0,
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9
  },
  teens: {
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
    thirteenth: 13,
    fourteenth: 14,
    fifteenth: 15,
    sixteenth: 16,
    seventeenth: 17,
    eighteenth: 18,
    nineteenth: 19,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
  },
  tens: {
    twentieth: 20,
    thirtieth: 30,
    fortieth: 40,
    fourtieth: 40,
    fiftieth: 50,
    sixtieth: 60,
    seventieth: 70,
    eightieth: 80,
    ninetieth: 90,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fourty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
  },
  multiples: {
    hundredth: 100,
    thousandth: 1e3,
    millionth: 1e6,
    billionth: 1e9,
    trillionth: 1e12,
    quadrillionth: 1e15,
    quintillionth: 1e18,
    sextillionth: 1e21,
    septillionth: 1e24,
    hundred: 100,
    thousand: 1e3,
    million: 1e6,
    billion: 1e9,
    trillion: 1e12,
    quadrillion: 1e15,
    quintillion: 1e18,
    sextillion: 1e21,
    septillion: 1e24,
    grand: 1e3
  }
};

// node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/validate.js
var isValid = (w, has2) => {
  if (Object.hasOwn(data_default3.ones, w)) {
    if (has2.ones || has2.teens) {
      return false;
    }
  } else if (Object.hasOwn(data_default3.teens, w)) {
    if (has2.ones || has2.teens || has2.tens) {
      return false;
    }
  } else if (Object.hasOwn(data_default3.tens, w)) {
    if (has2.ones || has2.teens || has2.tens) {
      return false;
    }
  }
  return true;
};
var validate_default2 = isValid;

// node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/parseDecimals.js
var parseDecimals = function(arr) {
  let str = "0.";
  for (let i3 = 0; i3 < arr.length; i3++) {
    const w = arr[i3];
    if (Object.hasOwn(data_default3.ones, w) === true) {
      str += data_default3.ones[w];
    } else if (Object.hasOwn(data_default3.teens, w) === true) {
      str += data_default3.teens[w];
    } else if (Object.hasOwn(data_default3.tens, w) === true) {
      str += data_default3.tens[w];
    } else if (/^[0-9]$/.test(w) === true) {
      str += w;
    } else {
      return 0;
    }
  }
  return parseFloat(str);
};
var parseDecimals_default = parseDecimals;

// node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/parseNumeric.js
var parseNumeric = (str) => {
  str = str.replace(/1st$/, "1");
  str = str.replace(/2nd$/, "2");
  str = str.replace(/3rd$/, "3");
  str = str.replace(/([4567890])r?th$/, "$1");
  str = str.replace(/^[$€¥£¢]/, "");
  str = str.replace(/[%$€¥£¢]$/, "");
  str = str.replace(/,/g, "");
  str = str.replace(/([0-9])([a-z\u00C0-\u00FF]{1,2})$/, "$1");
  return str;
};
var parseNumeric_default = parseNumeric;

// node_modules/compromise/src/3-three/numbers/numbers/parse/toNumber/index.js
var improperFraction = /^([0-9,. ]+)\/([0-9,. ]+)$/;
var casualForms = {
  "a few": 3,
  "a couple": 2,
  "a dozen": 12,
  "two dozen": 24,
  zero: 0
};
var section_sum = (obj) => {
  return Object.keys(obj).reduce((sum, k2) => {
    sum += obj[k2];
    return sum;
  }, 0);
};
var parse5 = function(str) {
  if (Object.hasOwn(casualForms, str) === true) {
    return casualForms[str];
  }
  if (str === "a" || str === "an") {
    return 1;
  }
  const modifier = findModifiers_default(str);
  str = modifier.str;
  let last_mult = null;
  let has2 = {};
  let sum = 0;
  let isNegative = false;
  const terms = str.split(/[ -]/);
  for (let i3 = 0; i3 < terms.length; i3++) {
    let w = terms[i3];
    w = parseNumeric_default(w);
    if (!w || w === "and") {
      continue;
    }
    if (w === "-" || w === "negative") {
      isNegative = true;
      continue;
    }
    if (w.charAt(0) === "-") {
      isNegative = true;
      w = w.substring(1);
    }
    if (w === "point") {
      sum += section_sum(has2);
      sum += parseDecimals_default(terms.slice(i3 + 1, terms.length));
      sum *= modifier.amount;
      return sum;
    }
    const fm = w.match(improperFraction);
    if (fm) {
      const num = parseFloat(fm[1].replace(/[, ]/g, ""));
      const denom = parseFloat(fm[2].replace(/[, ]/g, ""));
      if (denom) {
        sum += num / denom || 0;
      }
      continue;
    }
    if (Object.hasOwn(data_default3.tens, w)) {
      if (has2.ones && Object.keys(has2).length === 1) {
        sum = has2.ones * 100;
        has2 = {};
      }
    }
    if (validate_default2(w, has2) === false) {
      return null;
    }
    if (/^[0-9.]+$/.test(w)) {
      has2.ones = parseFloat(w);
    } else if (Object.hasOwn(data_default3.ones, w) === true) {
      has2.ones = data_default3.ones[w];
    } else if (Object.hasOwn(data_default3.teens, w) === true) {
      has2.teens = data_default3.teens[w];
    } else if (Object.hasOwn(data_default3.tens, w) === true) {
      has2.tens = data_default3.tens[w];
    } else if (Object.hasOwn(data_default3.multiples, w) === true) {
      let mult = data_default3.multiples[w];
      if (mult === last_mult) {
        return null;
      }
      if (mult === 100 && terms[i3 + 1] !== void 0) {
        const w2 = terms[i3 + 1];
        if (data_default3.multiples[w2]) {
          mult *= data_default3.multiples[w2];
          i3 += 1;
        }
      }
      if (last_mult === null || mult < last_mult) {
        sum += (section_sum(has2) || 1) * mult;
        last_mult = mult;
        has2 = {};
      } else {
        sum += section_sum(has2);
        last_mult = mult;
        sum = (sum || 1) * mult;
        has2 = {};
      }
    }
  }
  sum += section_sum(has2);
  sum *= modifier.amount;
  sum *= isNegative ? -1 : 1;
  if (sum === 0 && Object.keys(has2).length === 0) {
    return null;
  }
  return sum;
};
var toNumber_default = parse5;

// node_modules/compromise/src/3-three/numbers/fractions/parse.js
var endS = /s$/;
var parseNumber = function(m3) {
  const str = m3.text("reduced");
  return toNumber_default(str);
};
var mapping2 = {
  half: 2,
  halve: 2,
  quarter: 4
};
var slashForm = function(m3) {
  const str = m3.text("reduced");
  const found = str.match(/^([-+]?[0-9]+)\/([-+]?[0-9]+)(st|nd|rd|th)?s?$/);
  if (found && found[1] && found[0]) {
    return {
      numerator: Number(found[1]),
      denominator: Number(found[2])
    };
  }
  return null;
};
var nOutOfN = function(m3) {
  const found = m3.match("[<num>#Value+] out of every? [<den>#Value+]");
  if (found.found !== true) {
    return null;
  }
  let { num, den } = found.groups();
  if (!num || !den) {
    return null;
  }
  num = parseNumber(num);
  den = parseNumber(den);
  if (!num || !den) {
    return null;
  }
  if (typeof num === "number" && typeof den === "number") {
    return {
      numerator: num,
      denominator: den
    };
  }
  return null;
};
var compoundOrdinal = (m3) => {
  if (!m3.has("^(a|one) #Cardinal+ #Ordinal$")) {
    return null;
  }
  const denominator = parseNumber(m3.terms().slice(1));
  if (typeof denominator === "number" && denominator > 0) {
    return { numerator: 1, denominator };
  }
  return null;
};
var nOrinalth = function(m3) {
  const found = m3.match("[<num>(#Cardinal|a)+] [<den>#Fraction+]");
  if (found.found !== true) {
    return null;
  }
  let { num, den } = found.groups();
  if (num.has("a")) {
    num = 1;
  } else {
    num = parseNumber(num);
  }
  let str = den.text("reduced");
  if (endS.test(str)) {
    str = str.replace(endS, "");
    den = den.replaceWith(str);
  }
  if (Object.hasOwn(mapping2, str)) {
    den = mapping2[str];
  } else {
    den = parseNumber(den);
  }
  if (typeof num === "number" && typeof den === "number") {
    return {
      numerator: num,
      denominator: den
    };
  }
  return null;
};
var oneNth = function(m3) {
  const found = m3.match("^#Ordinal$");
  if (found.found !== true) {
    return null;
  }
  if (m3.lookAhead("^of .")) {
    const num = parseNumber(found);
    return {
      numerator: 1,
      denominator: num
    };
  }
  return null;
};
var named = function(m3) {
  const str = m3.text("reduced");
  if (Object.hasOwn(mapping2, str)) {
    return { numerator: 1, denominator: mapping2[str] };
  }
  return null;
};
var round2 = (n3) => {
  const rounded = Math.round(n3 * 1e3) / 1e3;
  if (rounded === 0 && n3 !== 0) {
    return n3;
  }
  return rounded;
};
var parseFraction = function(m3) {
  m3 = m3.clone();
  const res = named(m3) || slashForm(m3) || nOutOfN(m3) || compoundOrdinal(m3) || nOrinalth(m3) || oneNth(m3) || null;
  if (res !== null) {
    if (res.numerator && res.denominator) {
      res.decimal = res.numerator / res.denominator;
      res.decimal = round2(res.decimal);
    }
  }
  return res;
};
var parse_default4 = parseFraction;

// node_modules/compromise/src/3-three/numbers/numbers/_toString.js
var numToString = function(n3) {
  if (n3 < 1e6) {
    return String(n3);
  }
  let str;
  if (typeof n3 === "number") {
    str = n3.toFixed(0);
  } else {
    str = n3;
  }
  if (str.indexOf("e+") === -1) {
    return str;
  }
  return str.replace(".", "").split("e+").reduce(function(p5, b) {
    return p5 + Array(b - p5.length + 2).join(0);
  });
};
var toString_default = numToString;

// node_modules/compromise/src/3-three/numbers/numbers/format/toText/data.js
var tens_mapping = [
  ["ninety", 90],
  ["eighty", 80],
  ["seventy", 70],
  ["sixty", 60],
  ["fifty", 50],
  ["forty", 40],
  ["thirty", 30],
  ["twenty", 20]
];
var ones_mapping = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
];
var sequence = [
  [1e24, "septillion"],
  [1e20, "hundred sextillion"],
  [1e21, "sextillion"],
  [1e20, "hundred quintillion"],
  [1e18, "quintillion"],
  [1e17, "hundred quadrillion"],
  [1e15, "quadrillion"],
  [1e14, "hundred trillion"],
  [1e12, "trillion"],
  [1e11, "hundred billion"],
  [1e9, "billion"],
  [1e8, "hundred million"],
  [1e6, "million"],
  [1e5, "hundred thousand"],
  [1e3, "thousand"],
  [100, "hundred"],
  [1, "one"]
];

// node_modules/compromise/src/3-three/numbers/numbers/format/toText/index.js
var breakdown_magnitudes = function(num) {
  let working = num;
  const have = [];
  sequence.forEach((a2) => {
    if (num >= a2[0]) {
      const howmany = Math.floor(working / a2[0]);
      working -= howmany * a2[0];
      if (howmany) {
        have.push({
          unit: a2[1],
          count: howmany
        });
      }
    }
  });
  return have;
};
var breakdown_hundred = function(num) {
  const arr = [];
  if (num > 100) {
    return arr;
  }
  for (let i3 = 0; i3 < tens_mapping.length; i3++) {
    if (num >= tens_mapping[i3][1]) {
      num -= tens_mapping[i3][1];
      arr.push(tens_mapping[i3][0]);
    }
  }
  if (ones_mapping[num]) {
    arr.push(ones_mapping[num]);
  }
  return arr;
};
var handle_decimal = (num) => {
  const names = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const arr = [];
  const str = toString_default(num);
  const decimal = str.match(/\.([0-9]+)/);
  if (!decimal || !decimal[0]) {
    return arr;
  }
  arr.push("point");
  const decimals = decimal[0].split("");
  for (let i3 = 0; i3 < decimals.length; i3++) {
    arr.push(names[decimals[i3]]);
  }
  return arr;
};
var toText3 = function(obj) {
  let num = obj.num;
  if (num === 0 || num === "0") {
    return "zero";
  }
  if (num > 1e21) {
    num = toString_default(num);
  }
  let arr = [];
  if (num < 0) {
    arr.push("minus");
    num = Math.abs(num);
  }
  const units = breakdown_magnitudes(num);
  for (let i3 = 0; i3 < units.length; i3++) {
    let unit_name = units[i3].unit;
    if (unit_name === "one") {
      unit_name = "";
      if (arr.length > 1) {
        arr.push("and");
      }
    }
    arr = arr.concat(breakdown_hundred(units[i3].count));
    arr.push(unit_name);
  }
  arr = arr.concat(handle_decimal(num));
  arr = arr.filter((s3) => s3);
  if (arr.length === 0) {
    arr[0] = "";
  }
  return arr.join(" ");
};
var toText_default = toText3;

// node_modules/compromise/src/3-three/numbers/fractions/convert/toCardinal.js
var toCardinal = function(obj) {
  if (!obj.numerator || !obj.denominator) {
    return "";
  }
  const a2 = toText_default({ num: obj.numerator });
  const b = toText_default({ num: obj.denominator });
  return `${a2} out of ${b}`;
};
var toCardinal_default = toCardinal;

// node_modules/compromise/src/3-three/numbers/numbers/format/toOrdinal/textOrdinal.js
var irregulars = {
  one: "first",
  two: "second",
  three: "third",
  five: "fifth",
  eight: "eighth",
  nine: "ninth",
  twelve: "twelfth",
  twenty: "twentieth",
  thirty: "thirtieth",
  forty: "fortieth",
  fourty: "fourtieth",
  fifty: "fiftieth",
  sixty: "sixtieth",
  seventy: "seventieth",
  eighty: "eightieth",
  ninety: "ninetieth"
};
var textOrdinal = (obj) => {
  const words = toText_default(obj).split(" ");
  const last = words[words.length - 1];
  if (Object.hasOwn(irregulars, last)) {
    words[words.length - 1] = irregulars[last];
  } else {
    words[words.length - 1] = last.replace(/y$/, "i") + "th";
  }
  return words.join(" ");
};
var textOrdinal_default = textOrdinal;

// node_modules/compromise/src/3-three/numbers/fractions/convert/toOrdinal.js
var toOrdinal = function(obj) {
  if (!obj.numerator || !obj.denominator) {
    return "";
  }
  const start2 = toText_default({ num: obj.numerator });
  let end2 = textOrdinal_default({ num: obj.denominator });
  if (obj.denominator === 2) {
    end2 = "half";
  }
  if (start2 && end2) {
    if (obj.numerator !== 1) {
      end2 += "s";
    }
    return `${start2} ${end2}`;
  }
  return "";
};
var toOrdinal_default = toOrdinal;

// node_modules/compromise/src/3-three/numbers/fractions/api.js
var plugin4 = function(View2) {
  class Fractions extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Fractions";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default4);
    }
    get(n3) {
      return this.getNth(n3).map(parse_default4);
    }
    json(n3) {
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(n3)[0];
        const parsed = parse_default4(p5);
        json.fraction = parsed;
        return json;
      }, []);
    }
    // become 0.5
    toDecimal(n3) {
      this.getNth(n3).forEach((m3) => {
        const { decimal } = parse_default4(m3);
        m3 = m3.replaceWith(String(decimal), true);
        m3.tag("NumericValue");
        m3.unTag("Fraction");
      });
      return this;
    }
    toFraction(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        if (obj && typeof obj.numerator === "number" && typeof obj.denominator === "number") {
          const str = `${obj.numerator}/${obj.denominator}`;
          this.replace(m3, str);
        }
      });
      return this;
    }
    toOrdinal(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        let str = toOrdinal_default(obj);
        if (m3.after("^#Noun").found) {
          str += " of";
        }
        m3.replaceWith(str);
      });
      return this;
    }
    toCardinal(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        const str = toCardinal_default(obj);
        m3.replaceWith(str);
      });
      return this;
    }
    // spell it out - '1/2' -> 'one half'
    toText(n3) {
      this.getNth(n3).forEach((m3) => {
        const obj = parse_default4(m3);
        const str = toOrdinal_default(obj);
        if (str) {
          m3.replaceWith(str);
        }
      });
      return this;
    }
    toPercentage(n3) {
      this.getNth(n3).forEach((m3) => {
        const { decimal } = parse_default4(m3);
        let percent = decimal * 100;
        percent = Math.round(percent * 100) / 100;
        m3.replaceWith(`${percent}%`);
      });
      return this;
    }
  }
  View2.prototype.fractions = function(n3) {
    let m3 = find_default2(this);
    m3 = m3.getNth(n3);
    return new Fractions(this.document, m3.pointer);
  };
};
var api_default15 = plugin4;

// node_modules/compromise/src/3-three/numbers/numbers/find.js
var ones = "one|two|three|four|five|six|seven|eight|nine";
var tens = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|fourty";
var teens = "eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
var findNumbers = function(doc) {
  let m3 = doc.match("#Value+");
  if (m3.has("#NumericValue #NumericValue")) {
    if (m3.has("#Value @hasComma #Value")) {
      m3.splitAfter("@hasComma");
    } else if (m3.has("#NumericValue #Fraction")) {
      m3.splitAfter("#NumericValue #Fraction");
    } else {
      m3 = m3.splitAfter("#NumericValue");
    }
  }
  if (m3.has("#Value #Value #Value") && !m3.has("#Multiple")) {
    if (m3.has("(" + tens + ") #Cardinal #Cardinal")) {
      m3 = m3.splitAfter("(" + tens + ") #Cardinal");
    }
  }
  if (m3.has("#Value #Value")) {
    if (m3.has("#NumericValue #NumericValue")) {
      m3 = m3.splitOn("#Year");
    }
    if (m3.has("(" + tens + ") (" + teens + ")")) {
      m3 = m3.splitAfter("(" + tens + ")");
    }
    const double = m3.match("#Cardinal #Cardinal");
    if (double.found && !m3.has("(point|decimal|#Fraction)")) {
      if (!double.has("#Cardinal (#Multiple|point|decimal)")) {
        const noMultiple = m3.has(`(${ones}) (${tens})`);
        const tensVal = double.has("(" + tens + ") #Cardinal");
        const multVal = double.has("#Multiple #Value");
        if (!noMultiple && !tensVal && !multVal) {
          double.terms().forEach((d2) => {
            m3 = m3.splitOn(d2);
          });
        }
      }
    }
    if (m3.match("#Ordinal #Ordinal").match("#TextValue").found && !m3.has("#Multiple")) {
      if (!m3.has("(" + tens + ") #Ordinal")) {
        m3 = m3.splitAfter("#Ordinal");
      }
    }
    if (m3.has("#Time")) {
      m3 = m3.splitOn("#Time");
    }
    m3 = m3.splitBefore("#Ordinal [#Cardinal]", 0);
    if (m3.has("#TextValue #NumericValue") && !m3.has("(" + tens + "|#Multiple)")) {
      m3 = m3.splitBefore("#TextValue #NumericValue");
    }
  }
  m3 = m3.splitAfter("#NumberRange");
  m3 = m3.splitBefore("#Year");
  return m3;
};
var find_default3 = findNumbers;

// node_modules/compromise/src/3-three/numbers/numbers/parse/index.js
var parseNumeric2 = function(str, m3) {
  str = str.replace(/,/g, "");
  const arr = str.split(/([0-9.,]*)/);
  let [prefix5, num] = arr;
  let suffix2 = arr.slice(2).join("");
  if (num !== "" && m3.length < 2) {
    num = Number(num || str);
    if (typeof num !== "number") {
      num = null;
    }
    suffix2 ||= "";
    if (suffix2 === "st" || suffix2 === "nd" || suffix2 === "rd" || suffix2 === "th") {
      suffix2 = "";
    }
    return {
      prefix: prefix5 || "",
      num,
      suffix: suffix2
    };
  }
  return null;
};
var parseNumber2 = function(m3) {
  if (typeof m3 === "string") {
    return { num: toNumber_default(m3) };
  }
  let str = m3.text("reduced");
  const unit = m3.growRight("#Unit").match("#Unit$").text("machine");
  const hasComma = /[0-9],[0-9]/.test(m3.text("text"));
  if (m3.terms().length === 1 && !m3.has("#Multiple")) {
    const res = parseNumeric2(str, m3);
    if (res !== null) {
      res.hasComma = hasComma;
      res.unit = unit;
      return res;
    }
  }
  let frPart = m3.match("#Fraction{2,}$");
  frPart = frPart.found === false ? m3.match("^#Fraction$") : frPart;
  let fraction = null;
  if (frPart.found) {
    if (frPart.has("#Value and #Value #Fraction")) {
      frPart = frPart.match("and #Value #Fraction");
    }
    fraction = parse_default4(frPart);
    m3 = m3.not(frPart);
    m3 = m3.not("and$");
    str = m3.text("reduced");
  }
  let num = 0;
  if (str) {
    num = toNumber_default(str) || 0;
  }
  if (fraction && fraction.decimal) {
    num += fraction.decimal;
  }
  return {
    hasComma,
    prefix: "",
    num,
    suffix: "",
    isOrdinal: m3.has("#Ordinal"),
    isText: m3.has("#TextValue"),
    isFraction: m3.has("#Fraction"),
    isMoney: m3.has("#Money"),
    unit
  };
};
var parse_default5 = parseNumber2;

// node_modules/compromise/src/3-three/numbers/numbers/format/toOrdinal/numOrdinal.js
var numOrdinal = function(obj) {
  const num = obj.num;
  if (!num && num !== 0) {
    return null;
  }
  const tens2 = num % 100;
  if (tens2 > 10 && tens2 < 20) {
    return String(num) + "th";
  }
  const mapping3 = {
    0: "th",
    1: "st",
    2: "nd",
    3: "rd"
  };
  let str = toString_default(num);
  const last = str.slice(str.length - 1, str.length);
  if (mapping3[last]) {
    str += mapping3[last];
  } else {
    str += "th";
  }
  return str;
};
var numOrdinal_default = numOrdinal;

// node_modules/compromise/src/3-three/numbers/numbers/format/suffix.js
var prefixes = {
  "\xA2": "cents",
  $: "dollars",
  "\xA3": "pounds",
  "\xA5": "yen",
  "\u20AC": "euros",
  "\u20A1": "col\xF3n",
  "\u0E3F": "baht",
  "\u20AD": "kip",
  "\u20A9": "won",
  "\u20B9": "rupees",
  "\u20BD": "ruble",
  "\u20BA": "liras"
};
var suffixes4 = {
  "%": "percent",
  // s: 'seconds',
  // cm: 'centimetres',
  // km: 'kilometres',
  // ft: 'feet',
  "\xB0": "degrees"
};
var addSuffix = function(obj) {
  const res = {
    suffix: "",
    prefix: obj.prefix
  };
  if (Object.hasOwn(prefixes, obj.prefix)) {
    res.suffix += " " + prefixes[obj.prefix];
    res.prefix = "";
  }
  if (Object.hasOwn(suffixes4, obj.suffix)) {
    res.suffix += " " + suffixes4[obj.suffix];
  }
  if (res.suffix && obj.num === 1) {
    res.suffix = res.suffix.replace(/s$/, "");
  }
  if (!res.suffix && obj.suffix) {
    res.suffix += " " + obj.suffix;
  }
  return res;
};
var suffix_default2 = addSuffix;

// node_modules/compromise/src/3-three/numbers/numbers/format/index.js
var format = function(obj, fmt2) {
  if (fmt2 === "TextOrdinal") {
    const { prefix: prefix5, suffix: suffix2 } = suffix_default2(obj);
    return prefix5 + textOrdinal_default(obj) + suffix2;
  }
  if (fmt2 === "Ordinal") {
    return obj.prefix + numOrdinal_default(obj) + obj.suffix;
  }
  if (fmt2 === "TextCardinal") {
    const { prefix: prefix5, suffix: suffix2 } = suffix_default2(obj);
    return prefix5 + toText_default(obj) + suffix2;
  }
  let num = obj.num;
  if (obj.hasComma) {
    num = num.toLocaleString();
  }
  return obj.prefix + String(num) + obj.suffix;
};
var format_default = format;

// node_modules/compromise/src/3-three/numbers/numbers/isUnit.js
var coerceToObject = function(input) {
  if (typeof input === "string" || typeof input === "number") {
    const tmp = {};
    tmp[input] = true;
    return tmp;
  }
  if (Array.isArray(input)) {
    return input.reduce((h2, s3) => {
      h2[s3] = true;
      return h2;
    }, {});
  }
  return input || {};
};
var isUnit = function(doc, input = {}) {
  input = coerceToObject(input);
  return doc.filter((p5) => {
    const { unit } = parse_default5(p5);
    if (unit && input[unit] === true) {
      return true;
    }
    return false;
  });
};
var isUnit_default = isUnit;

// node_modules/compromise/src/3-three/numbers/numbers/_lib.js
var convert2 = (view, Numbers, tag, skip, getFormat) => {
  const res = view.map((val) => {
    if (skip(val)) {
      return val;
    }
    const obj = parse_default5(val);
    if (obj.num === null) {
      return val;
    }
    const str = format_default(obj, getFormat(val));
    val.replaceWith(str, { tags: true });
    val.tag(tag);
    return val;
  });
  return new Numbers(res.document, res.pointer);
};
var lib_default12 = convert2;

// node_modules/compromise/src/3-three/numbers/numbers/api.js
var addMethod = function(View2) {
  class Numbers extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Numbers";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default5);
    }
    get(n3) {
      return this.getNth(n3).map(parse_default5).map((o2) => o2.num);
    }
    json(n3) {
      const opts2 = typeof n3 === "object" ? n3 : {};
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(opts2)[0];
        const parsed = parse_default5(p5);
        json.number = {
          prefix: parsed.prefix,
          num: parsed.num,
          suffix: parsed.suffix,
          hasComma: parsed.hasComma,
          unit: parsed.unit
        };
        return json;
      }, []);
    }
    /** any known measurement unit, for the number */
    units() {
      return this.growRight("#Unit").match("#Unit$");
    }
    /** return values that match a given unit */
    isUnit(allowed) {
      return isUnit_default(this, allowed);
    }
    /** return only ordinal numbers */
    isOrdinal() {
      return this.if("#Ordinal");
    }
    /** return only cardinal numbers*/
    isCardinal() {
      return this.if("#Cardinal");
    }
    /** convert to numeric form like '8' or '8th' */
    toNumber() {
      return lib_default12(
        this,
        Numbers,
        "NumericValue",
        () => !this.has("#TextValue"),
        (val) => val.has("#Ordinal") ? "Ordinal" : "Cardinal"
      );
    }
    /** add commas, or nicer formatting for numbers */
    toLocaleString() {
      const m3 = this;
      m3.forEach((val) => {
        const obj = parse_default5(val);
        if (obj.num === null) {
          return;
        }
        let num = obj.num.toLocaleString();
        if (val.has("#Ordinal")) {
          const str = format_default(obj, "Ordinal");
          let end2 = str.length;
          while (end2 > 0 && /[a-z]/.test(str[end2 - 1])) end2--;
          num += str.slice(end2);
        }
        val.replaceWith(num, { tags: true });
      });
      return this;
    }
    /** convert to numeric form like 'eight' or 'eighth' */
    toText() {
      return lib_default12(
        this,
        Numbers,
        "TextValue",
        (val) => val.has("#TextValue"),
        (val) => val.has("#Ordinal") ? "TextOrdinal" : "TextCardinal"
      );
    }
    /** convert ordinal to cardinal form, like 'eight', or '8' */
    toCardinal() {
      return lib_default12(
        this,
        Numbers,
        "Cardinal",
        (val) => !val.has("#Ordinal"),
        (val) => val.has("#TextValue") ? "TextCardinal" : "Cardinal"
      );
    }
    /** convert cardinal to ordinal form, like 'eighth', or '8th' */
    toOrdinal() {
      return lib_default12(
        this,
        Numbers,
        "Ordinal",
        (val) => val.has("#Ordinal"),
        (val) => val.has("#TextValue") ? "TextOrdinal" : "Ordinal"
      );
    }
    /** return only numbers that are == n */
    isEqual(n3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num === n3;
      });
    }
    /** return only numbers that are > n*/
    greaterThan(n3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num > n3;
      });
    }
    /** return only numbers that are < n*/
    lessThan(n3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num < n3;
      });
    }
    /** return only numbers > min and < max */
    between(min2, max3) {
      return this.filter((val) => {
        const num = parse_default5(val).num;
        return num > min2 && num < max3;
      });
    }
    /** set these number to n */
    set(n3) {
      if (n3 === void 0) {
        return this;
      }
      if (typeof n3 === "string") {
        n3 = parse_default5(n3).num;
      }
      const m3 = this;
      const res = m3.map((val) => {
        const obj = parse_default5(val);
        obj.num = n3;
        if (obj.num === null) {
          return val;
        }
        let fmt2 = val.has("#Ordinal") ? "Ordinal" : "Cardinal";
        if (val.has("#TextValue")) {
          fmt2 = val.has("#Ordinal") ? "TextOrdinal" : "TextCardinal";
        }
        let str = format_default(obj, fmt2);
        if (obj.hasComma && fmt2 === "Cardinal") {
          str = Number(str).toLocaleString();
        }
        val = val.not("#Currency");
        val.replaceWith(str, { tags: true });
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    add(n3) {
      if (!n3) {
        return this;
      }
      if (typeof n3 === "string") {
        n3 = parse_default5(n3).num;
      }
      const m3 = this;
      const res = m3.map((val) => {
        const obj = parse_default5(val);
        if (obj.num === null) {
          return val;
        }
        obj.num += n3;
        let fmt2 = val.has("#Ordinal") ? "Ordinal" : "Cardinal";
        if (obj.isText) {
          fmt2 = val.has("#Ordinal") ? "TextOrdinal" : "TextCardinal";
        }
        const str = format_default(obj, fmt2);
        val.replaceWith(str, { tags: true });
        return val;
      });
      return new Numbers(res.document, res.pointer);
    }
    /** decrease each number by n*/
    subtract(n3, agree) {
      return this.add(n3 * -1, agree);
    }
    /** increase each number by 1 */
    increment(agree) {
      return this.add(1, agree);
    }
    /** decrease each number by 1 */
    decrement(agree) {
      return this.add(-1, agree);
    }
    // overloaded - keep Numbers class
    update(pointer) {
      const m3 = new Numbers(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  Numbers.prototype.toNice = Numbers.prototype.toLocaleString;
  Numbers.prototype.isBetween = Numbers.prototype.between;
  Numbers.prototype.minus = Numbers.prototype.subtract;
  Numbers.prototype.plus = Numbers.prototype.add;
  Numbers.prototype.equals = Numbers.prototype.isEqual;
  View2.prototype.numbers = function(n3) {
    let m3 = find_default3(this);
    m3 = m3.getNth(n3);
    return new Numbers(this.document, m3.pointer);
  };
  View2.prototype.percentages = function(n3) {
    let m3 = find_default3(this);
    m3 = m3.filter((v2) => v2.has("#Percent"));
    m3 = m3.getNth(n3);
    return new Numbers(this.document, m3.pointer);
  };
  View2.prototype.values = View2.prototype.numbers;
};
var api_default16 = addMethod;

// node_modules/compromise/src/3-three/numbers/money/currencies.js
var currencies_default = [
  ["$", "dollar"],
  ["\u20AC", "EUR"],
  ["\xA3", "GBP"],
  ["\xA5", "JPY/YEN"],
  ["\u20B9", "INR"],
  ["\u20A9", "KRW"],
  ["\u20BD", "RUB"],
  ["\u20BA", "TRY"],
  ["\u0E3F", "THB"],
  ["\u20AA", "ILS"],
  ["\u20AB", "VND"],
  ["\u20B4", "UAH"],
  ["\u20A6", "NGN"],
  ["\u20B1", "PHP"],
  ["\u20B2", "PYG"],
  ["\u20A1", "CRC"],
  ["\uFDFC", "SAR"],
  ["\u20AE", "MNT"],
  ["\u20AD", "LAK"],
  ["\u20B8", "KZT"]
];

// node_modules/compromise/src/3-three/numbers/money/api.js
var find5 = function(doc) {
  return doc.match("#Money+ #Currency? (#Money+ #Currency?)?");
};
var parse6 = function(m3) {
  m3 = m3.clone();
  let currency = m3.match("#Currency").nouns().toSingular().text("normal");
  const num = m3.match("#Money").numbers().get()[0];
  if (!currency) {
    const str = m3.text();
    const found = currencies_default.find(([sym]) => str.includes(sym));
    if (found) {
      currency = found[1];
    }
  }
  return {
    currency,
    num
  };
};
var plugin5 = function(View2) {
  class Money extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Money";
    }
    parse(n3) {
      return this.getNth(n3).map(parse6);
    }
    get(n3) {
      return this.getNth(n3).map(parse6).map((p5) => p5.num);
    }
    json(n3) {
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(n3)[0];
        const parsed = parse6(p5);
        json.money = parsed;
        return json;
      }, []);
    }
    currency(n3) {
      return this.getNth(n3).map((p5) => {
        const parsed = parse6(p5);
        return parsed.currency;
      });
    }
  }
  View2.prototype.money = function(n3) {
    let m3 = find5(this);
    m3 = m3.getNth(n3);
    return new Money(this.document, m3.pointer);
  };
};
var api_default17 = plugin5;

// node_modules/compromise/src/3-three/numbers/plugin.js
var api14 = function(View2) {
  api_default15(View2);
  api_default16(View2);
  api_default17(View2);
};
var plugin_default26 = {
  api: api14
};

// node_modules/compromise/src/3-three/redact/redact.js
var defaults3 = {
  people: true,
  places: true,
  organizations: true,
  acronyms: true,
  money: true,
  percentages: true,
  fractions: true,
  emails: true,
  phoneNumbers: true,
  atMentions: true,
  urls: true,
  // off by default
  properNouns: false,
  dates: false,
  numbers: false,
  pronouns: false
};
var hideTags = {
  people: ["MaleName", "FemaleName", "FirstName", "LastName"],
  places: ["City", "State", "Country", "Region"],
  organizations: ["SportsTeam", "Company", "School"]
};
hideTags.pronouns = [...hideTags.people, ...hideTags.places, ...hideTags.organizations];
var redactMatch = function(m3, blockStr, keep9 = true) {
  m3 = m3.notIf("#Redacted");
  m3.replaceWith(blockStr, keep9);
  m3.tag("Redacted");
  return m3;
};
var redact = function(opts2 = {}, blockStr = "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588", keep9 = true) {
  opts2 = { ...defaults3, ...opts2 };
  if (opts2.people !== false) {
    redactMatch(this.people(), blockStr, keep9).unTag(hideTags.people);
  }
  if (opts2.places !== false) {
    redactMatch(this.places(), blockStr, keep9).unTag(hideTags.places);
  }
  if (opts2.organizations !== false) {
    redactMatch(this.organizations(), blockStr, keep9).unTag(hideTags.organizations);
  }
  if (opts2.emails !== false) {
    redactMatch(this.emails(), blockStr, keep9);
  }
  if (opts2.money !== false) {
    redactMatch(this.money(), blockStr, keep9);
  }
  if (opts2.percentages !== false) {
    redactMatch(this.percentages(), blockStr, keep9);
  }
  if (opts2.fractions !== false) {
    redactMatch(this.fractions(), blockStr, keep9);
  }
  if (opts2.phoneNumbers !== false) {
    redactMatch(this.phoneNumbers(), blockStr, keep9);
  }
  if (opts2.atMentions !== false) {
    redactMatch(this.atMentions(), blockStr, keep9);
  }
  if (opts2.acronyms !== false) {
    redactMatch(this.acronyms(), blockStr, keep9);
  }
  if (opts2.urls !== false) {
    redactMatch(this.urls(), blockStr, keep9);
  }
  if (opts2.properNouns !== false) {
    redactMatch(this.properNouns(), blockStr, keep9);
  }
  if (opts2.dates !== false) {
    redactMatch(this.dates(), blockStr, keep9);
  }
  if (opts2.numbers !== false) {
    redactMatch(this.numbers(), blockStr, keep9);
  }
  if (opts2.pronouns !== false) {
    redactMatch(this.pronouns(), blockStr, keep9).unTag(hideTags.pronouns);
  }
  return this;
};
var redact_default = redact;

// node_modules/compromise/src/3-three/redact/plugin.js
var plugin6 = {
  model: {
    one: {
      tagSet: {
        Redacted: true
      }
    }
  },
  api: function(View2) {
    View2.prototype.redact = redact_default;
  }
};
var plugin_default27 = plugin6;

// node_modules/compromise/src/3-three/sentences/questions.js
var isQuestion = function(doc) {
  const clauses2 = doc.clauses();
  if (/\.\.$/.test(doc.out("text"))) {
    return false;
  }
  if (doc.has("^#QuestionWord") && doc.has("@hasComma")) {
    return false;
  }
  if (doc.has("or not$")) {
    return true;
  }
  if (doc.has("^#QuestionWord")) {
    return true;
  }
  if (doc.has("^(do|does|did|is|was|can|could|will|would|may) #Noun")) {
    return true;
  }
  if (doc.has("^(have|must) you")) {
    return true;
  }
  if (clauses2.has("(do|does|is|was) #Noun+ #Adverb? (#Adjective|#Infinitive)$")) {
    return true;
  }
  return false;
};
var findQuestions = function(view) {
  const hasQ = /[?\uFF1F]/;
  const { document } = view;
  return view.filter((m3) => {
    const terms = m3.docs[0] || [];
    const lastTerm = terms[terms.length - 1];
    if (!lastTerm || document[lastTerm.index[0]].length !== terms.length) {
      return false;
    }
    if (hasQ.test(lastTerm.post)) {
      return true;
    }
    return isQuestion(m3);
  });
};
var questions_default = findQuestions;

// node_modules/compromise/src/3-three/sentences/parse/mainClause.js
var subordinate = `(after|although|as|because|before|if|since|than|that|though|when|whenever|where|whereas|wherever|whether|while|why|unless|until|once) !(#Value|upon|then|now)`;
var relative = `(that|which|whichever|who|whoever|whom|whose|whomever)`;
var dropIntroducedBy = function(m3, pattern) {
  const reg = m3.world.methods.one.parseMatch(pattern, {}, m3.world);
  return m3.filter((c2) => {
    const found = c2.matchOne(reg);
    if (!found.found) {
      return true;
    }
    const verb = c2.matchOne("#Verb");
    return verb.found && verb.fullPointer[0][1] <= found.fullPointer[0][1];
  });
};
var mainClause = function(s3) {
  let m3 = s3;
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.if("#Verb");
  if (m3.length === 1) {
    return m3;
  }
  m3 = dropIntroducedBy(m3, subordinate);
  m3 = m3.ifNo("^even (if|though)");
  m3 = m3.ifNo("^so that");
  m3 = m3.ifNo("^rather than");
  m3 = m3.ifNo("^provided that");
  m3 = m3.ifNo("^in case");
  if (m3.length === 1) {
    return m3;
  }
  m3 = dropIntroducedBy(m3, relative);
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo("(^despite|^during|^before|^through|^throughout)");
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo("^#Gerund");
  if (m3.length === 1) {
    return m3;
  }
  m3 = m3.ifNo("^to #Infinitive");
  m3 = m3.ifNo("^#Condition");
  if (m3.length === 1) {
    return m3;
  }
  if (m3.length === 0) {
    m3 = s3;
  }
  return m3.eq(0);
};
var mainClause_default = mainClause;

// node_modules/compromise/src/3-three/sentences/parse/index.js
var grammar = function(vb3) {
  let tense = null;
  if (vb3.has("#PastTense")) {
    tense = "PastTense";
  } else if (vb3.has("#FutureTense")) {
    tense = "FutureTense";
  } else if (vb3.has("#PresentTense")) {
    tense = "PresentTense";
  }
  return {
    tense
  };
};
var parse7 = function(s3) {
  const clauses2 = s3.clauses();
  const main = mainClause_default(clauses2);
  const chunks2 = main.chunks();
  let subj = s3.none();
  let verb = s3.none();
  let pred = s3.none();
  const relative2 = chunks2.length > 2 && !chunks2.eq(0).has("<Verb>") && chunks2.eq(1).has("^(who|whom|whose|which|that)$") && chunks2.filter((ch) => ch.has("<Verb>")).length > 1;
  let isSkipped = false;
  chunks2.forEach((ch, i3) => {
    if (i3 === 0 && !ch.has("<Verb>")) {
      subj = ch;
      return;
    }
    if (!verb.found && ch.has("<Verb>")) {
      if (relative2 && !isSkipped) {
        isSkipped = true;
        return;
      }
      verb = ch;
      return;
    }
    if (verb.found) {
      pred = pred.concat(ch);
    }
  });
  if (verb.found && !subj.found) {
    subj = verb.before("<Noun>+").first();
  }
  return {
    subj,
    verb,
    pred,
    grammar: grammar(verb)
  };
};
var parse_default6 = parse7;

// node_modules/compromise/src/3-three/verbs/api/parse/root.js
var getMain = function(vb3) {
  let root = vb3;
  if (vb3.wordCount() > 1) {
    root = vb3.not("(#Negative|#Auxiliary|#Modal|#Adverb|#Prefix)");
  }
  if (root.length > 1 && !root.has("#Phrasal #Particle")) {
    root = root.last();
  }
  root = root.not("(want|wants|wanted) to");
  if (!root.found) {
    root = vb3.not("#Negative");
    return root;
  }
  return root;
};
var root_default2 = getMain;

// node_modules/compromise/src/3-three/verbs/api/parse/adverbs.js
var getAdverbs = function(vb3, root) {
  const res = {
    pre: vb3.none(),
    post: vb3.none()
  };
  if (!vb3.has("#Adverb")) {
    return res;
  }
  const parts = vb3.splitOn(root);
  if (parts.length === 3) {
    return {
      pre: parts.eq(0).adverbs(),
      post: parts.eq(2).adverbs()
    };
  }
  if (parts.eq(0).isDoc(root)) {
    res.post = parts.eq(1).adverbs();
    return res;
  }
  res.pre = parts.eq(0).adverbs();
  return res;
};
var adverbs_default = getAdverbs;

// node_modules/compromise/src/3-three/verbs/api/parse/index.js
var getAuxiliary = function(vb3, root) {
  const parts = vb3.splitBefore(root);
  if (parts.length <= 1) {
    return vb3.none();
  }
  let aux = parts.eq(0);
  aux = aux.not("(#Adverb|#Negative|#Prefix)");
  return aux;
};
var getNegative = function(vb3) {
  return vb3.match("#Negative");
};
var getPhrasal = function(root) {
  if (!root.has("(#Particle|#PhrasalVerb)")) {
    return {
      verb: root.none(),
      particle: root.none()
    };
  }
  const particle = root.match("#Particle$");
  return {
    verb: root.not(particle),
    particle
  };
};
var parseVerb = function(view) {
  const vb3 = view.clone();
  vb3.contractions().expand();
  const root = root_default2(vb3);
  const res = {
    root,
    prefix: vb3.match("#Prefix"),
    adverbs: adverbs_default(vb3, root),
    auxiliary: getAuxiliary(vb3, root),
    negative: getNegative(vb3),
    phrasal: getPhrasal(root)
  };
  return res;
};
var parse_default7 = parseVerb;

// node_modules/compromise/src/3-three/verbs/api/parse/grammar/forms.js
var present = { tense: "PresentTense" };
var conditional = { conditional: true };
var future = { tense: "FutureTense" };
var prog = { progressive: true };
var past2 = { tense: "PastTense" };
var complete = { complete: true, progressive: false };
var passive = { passive: true };
var plural = { plural: true };
var singular = { plural: false };
var getData = function(tags2) {
  const data = {};
  tags2.forEach((o2) => {
    Object.assign(data, o2);
  });
  return data;
};
var verbForms = {
  // === Simple ===
  "imperative": [
    // walk!
    ["#Imp", []]
  ],
  "want-infinitive": [
    ["^(want|wants|wanted) to #Inf$", [present]],
    ["^wanted to #Inf$", [past2]],
    ["^will want to #Inf$", [future]]
  ],
  "gerund-phrase": [
    // started looking
    ["^#Past #Ger$", [past2]],
    // starts looking
    ["^#Pres #Ger$", [present]],
    // start looking
    ["^#Inf #Ger$", [present]],
    // will start looking
    ["^will #Inf #Ger$", [future]],
    // have started looking
    ["^have #Past #Ger$", [past2]],
    // will have started looking
    ["^will have #Past #Ger$", [past2]]
  ],
  "simple-present": [
    // he walks',
    ["^#Pres$", [present]],
    // we walk
    ["^#Inf$", [present]]
  ],
  "simple-past": [
    // he walked',
    ["^#Past$", [past2]]
  ],
  "simple-future": [
    // he will walk
    ["^will #Adv? #Inf", [future]]
  ],
  // === Progressive ===
  "present-progressive": [
    // he is walking
    ["^(is|are|am) #Ger$", [present, prog]]
  ],
  "past-progressive": [
    // he was walking
    ["^(was|were) #Ger$", [past2, prog]]
  ],
  "future-progressive": [
    // he will be
    ["^will be #Ger$", [future, prog]]
  ],
  // === Perfect ===
  "present-perfect": [
    // he has walked
    ["^(has|have) #Past$", [past2, complete]]
    //past?
  ],
  "past-perfect": [
    // he had walked
    ["^had #Past$", [past2, complete]],
    // had been to see
    ["^had #Past to #Inf", [past2, complete]]
  ],
  "future-perfect": [
    // he will have
    ["^will have #Past$", [future, complete]]
  ],
  // === Progressive-perfect ===
  "present-perfect-progressive": [
    ["^(has|have) been going to be #Ger$", [past2, prog]],
    // he has been walking
    ["^(has|have) been #Ger$", [past2, prog]]
    //present?
  ],
  "past-perfect-progressive": [
    // he had been
    ["^had been #Ger$", [past2, prog]]
  ],
  "future-perfect-progressive": [
    // will have been
    ["^will have been #Ger$", [future, prog]]
  ],
  // ==== Passive ===
  "passive-past": [
    ["^(was|were) being? (#Past|#Part)$", [past2, passive]],
    ["^had been being? (#Past|#Part)$", [past2, passive]],
    // got walked, was walked, were walked
    ["(got|were|was) #Pass", [past2, passive]],
    // was being walked
    ["^(was|were) being #Pass", [past2, passive]],
    // had been walked
    ["^had been #Pass", [past2, passive]]
  ],
  "passive-present": [
    ["^(is|are|am) being? (#Past|#Part)$", [present, passive]],
    ["^(has|have) been being? (#Past|#Part)$", [present, passive]],
    // is walked, are stolen
    ["^(is|are|am) #Pass", [present, passive]],
    // is being walked
    ["^(is|are|am) being #Pass", [present, passive]],
    // has/have been cleaned
    ["^(has|have) been #Pass", [present, passive]]
  ],
  "passive-future": [
    ["^will have been being? (#Past|#Part)$", [future, passive, conditional]],
    ["^will be being? (#Past|#Part)$", [future, passive, conditional]],
    // will have been walked
    ["will have been #Pass", [future, passive, conditional]],
    // will be cleaned
    ["will be being? #Pass", [future, passive, conditional]]
  ],
  // === Conditional ===
  "present-conditional": [
    // would be walked
    ["^#Mod be #Past$", [present, conditional, passive]]
  ],
  "past-conditional": [
    // would have been walked
    ["^#Mod have been #Past$", [past2, conditional, passive]]
  ],
  // ==== Auxiliary ===
  "auxiliary-future": [
    ["^(is|are|am|was|were) going to be #Ger$", [future, prog]],
    // going to drink
    ["(is|are|am|was|were) going to (#Inf|#Pres)", [future]]
  ],
  "auxiliary-past": [
    // he did walk
    ["^did #Inf$", [past2, singular]],
    // used to walk
    ["^used to #Inf$", [past2, complete]]
  ],
  "auxiliary-present": [
    // we do walk
    ["^(does|do) #Inf$", [present, complete, plural]]
  ],
  // === modals ===
  "modal-perfect-progressive": [
    ["^#Mod have been #Ger$", [past2, prog]]
  ],
  "modal-past": [
    // he could have walked
    ["^#Mod have #Past$", [past2]]
  ],
  "modal-infinitive": [
    // he can walk
    ["^#Mod #Inf$", []]
  ],
  "infinitive": [
    // walk
    ["^#Inf$", []]
  ]
};
var list3 = [];
Object.keys(verbForms).map((k2) => {
  verbForms[k2].forEach((a2) => {
    list3.push({
      name: k2,
      match: lib_default9(a2[0]),
      data: getData(a2[1])
    });
  });
});
var forms_default = list3;

// node_modules/compromise/src/3-three/verbs/api/parse/grammar/index.js
var cleanUp2 = function(vb3, res) {
  vb3 = vb3.clone();
  if (res.adverbs.post && res.adverbs.post.found) {
    vb3.remove(res.adverbs.post);
  }
  if (res.adverbs.pre && res.adverbs.pre.found) {
    vb3.remove(res.adverbs.pre);
  }
  if (vb3.has("#Negative")) {
    vb3 = vb3.remove("#Negative");
  }
  if (vb3.has("#Prefix")) {
    vb3 = vb3.remove("#Prefix");
  }
  if (res.root.has("#PhrasalVerb #Particle")) {
    vb3.remove("#Particle$");
  }
  vb3 = vb3.not("#Adverb");
  return vb3;
};
var isInfinitive = function(vb3) {
  return vb3.growLeft("to (#Adverb|#Negative)+?").has("^to (#Adverb|#Negative)+? #Verb");
};
var getGrammar = function(vb3, res) {
  const grammar2 = {};
  const infinitive2 = isInfinitive(vb3);
  vb3 = cleanUp2(vb3, res);
  for (let i3 = 0; i3 < forms_default.length; i3 += 1) {
    const todo = forms_default[i3];
    if (vb3.has(todo.match) === true) {
      grammar2.form = todo.name;
      Object.assign(grammar2, todo.data);
      break;
    }
  }
  if (!grammar2.form) {
    if (vb3.has("^#Verb$")) {
      grammar2.form = "infinitive";
    }
  }
  if (!grammar2.tense) {
    grammar2.tense = res.root.has("#PastTense") ? "PastTense" : "PresentTense";
  }
  grammar2.copula = res.root.has("#Copula");
  grammar2.isInfinitive = infinitive2;
  return grammar2;
};
var grammar_default = getGrammar;

// node_modules/compromise/src/3-three/verbs/api/parse/auxiliary.js
var readAuxiliary = function(parsed, form) {
  const words = parsed.auxiliary.terms().map((term) => term.text("normal"), []);
  const text6 = words.join(" ");
  const modal = /^(can|could|may|might|must|shall|should|would)( (be|have|been|being))*$/.test(text6) || /^ought to( (be|have|been|being))*$/.test(text6);
  const prospective = /^(is|are|am|was|were) going to (be|have)( (been|being))*$/.test(text6);
  if (modal || prospective) {
    let prefixLength = words[0] === "ought" ? 2 : 1;
    if (prospective) prefixLength = 3;
    const tail = words.slice(prefixLength);
    return {
      words,
      finite: words[0],
      modal,
      prospective,
      prefixLength,
      perfect: tail.includes("have"),
      progressive: parsed.root.has("#Gerund") || tail.includes("being"),
      passive: tail.length > 0 && !parsed.root.has("#Gerund") && tail.some((w) => /^(be|been|being)$/.test(w)),
      form
    };
  }
  const passive2 = /^passive-/.test(form);
  const perfectForm = /^(present|past|future)-perfect/.test(form);
  const progressiveForm = /^(present|past|future)-progressive$/.test(form);
  if (!passive2 && !perfectForm && !progressiveForm) {
    return null;
  }
  if (words.length === 0) {
    return null;
  }
  return {
    words,
    finite: words[0],
    passive: passive2,
    perfect: words.some((word) => /^(has|have|had)$/.test(word)),
    progressive: passive2 ? words.includes("being") : /progressive$/.test(form),
    form
  };
};
var auxiliary_default = readAuxiliary;

// node_modules/compromise/src/3-three/verbs/api/conjugate/groups.js
var groups = function(verbs) {
  const entries = verbs.map((vb3) => {
    const parsed = parse_default7(vb3);
    return { vb: vb3, parsed, root: vb3.match(parsed.root).harden() };
  }, []);
  entries.forEach((entry, i3) => {
    const previous = entries[i3 - 1];
    if (!previous || entry.parsed.auxiliary.found) return;
    const head = previous.head || previous;
    if (!head.parsed.auxiliary.found) return;
    const info = grammar_default(head.vb, head.parsed);
    if (info.isInfinitive) return;
    const chain = auxiliary_default(head.parsed, info.form);
    if (!chain && info.form !== "simple-future" || chain && chain.prospective) return;
    head.chain = chain;
    head.form = info.form;
    const root = entry.parsed.root;
    const headRoot = head.parsed.root;
    let compatible = headRoot.has("#Infinitive") && root.has("#Infinitive");
    if (headRoot.has("(#PastTense|#Participle)")) compatible = root.has("(#PastTense|#Participle)");
    if (headRoot.has("#Gerund")) compatible = root.has("#Gerund");
    if (!compatible || previous.vb.has("@hasComma$")) return;
    const next = previous.vb.growRight("(and|or) #Adverb+? #Verb+ #Particle?");
    if (next.match(entry.vb).wordCount() !== entry.vb.wordCount()) return;
    entry.head = head;
  });
  return entries;
};
var firstGroup = function(verbs) {
  if (verbs.length < 2) return verbs;
  const entries = groups(verbs);
  let count = 1;
  while (entries[count] && entries[count].head === entries[0]) count += 1;
  return verbs.slice(0, count);
};
var groups_default = groups;

// node_modules/compromise/src/3-three/verbs/api/parse/getSubject.js
var shouldSkip = function(last) {
  if (last.length <= 1) {
    return false;
  }
  const obj = last.parse()[0] || {};
  return obj.isSubordinate;
};
var noSubClause = function(before2) {
  let parts = before2.clauses();
  parts = parts.filter((m3, i3) => {
    if (m3.has("^(if|unless|while|but|for|per|at|by|that|which|who|from)")) {
      return false;
    }
    if (i3 > 0 && m3.has("^#Verb . #Noun+$")) {
      return false;
    }
    if (i3 > 0 && m3.has("^#Adverb")) {
      return false;
    }
    return true;
  });
  if (parts.length === 0) {
    return before2;
  }
  return parts;
};
var lastNoun2 = function(vb3) {
  let before2 = vb3.before();
  before2 = noSubClause(before2);
  if (!before2.has("(#Verb|@hasComma)") && before2.has("#Noun (on|near|under|beside|behind)")) {
    const head = before2.splitBefore("(on|near|under|beside|behind)").first().nouns();
    if (head.found) return head;
  }
  const nouns = before2.nouns();
  let last = nouns.last();
  const pronoun = last.match("(i|he|she|we|you|they)");
  if (pronoun.found) {
    return pronoun.nouns();
  }
  let det = nouns.if("^(that|this|those)");
  if (det.found) {
    return det;
  }
  if (nouns.found === false) {
    det = before2.match("^(that|this|those)");
    if (det.found) {
      return det;
    }
  }
  last = nouns.last();
  if (shouldSkip(last)) {
    nouns.remove(last);
    last = nouns.last();
  }
  if (shouldSkip(last)) {
    nouns.remove(last);
    last = nouns.last();
  }
  return last;
};
var isPlural3 = function(subj, vb3) {
  if (vb3.has("(are|were)")) {
    return true;
  }
  if (subj.has("(those|they|we)")) {
    return true;
  }
  if (subj.has("(#Singular|#Plural) of")) {
    const head = subj.splitBefore("of").first().nouns();
    if (head.found) return head.isPlural().found;
  }
  if (subj.found && subj.isPlural) {
    return subj.isPlural().found;
  }
  return false;
};
var getSubject = function(vb3) {
  const subj = lastNoun2(vb3);
  return {
    subject: subj,
    plural: isPlural3(subj, vb3)
  };
};
var getSubject_default = getSubject;

// node_modules/compromise/src/3-three/verbs/api/lib.js
var noop = (vb3) => vb3;
var isPlural4 = (vb3, parsed) => {
  const subj = getSubject_default(vb3, parsed);
  const m3 = subj.subject;
  if (m3.has("(i|we|you)")) {
    return true;
  }
  return subj.plural;
};
var wasWere = (vb3, parsed) => {
  const { subject: subject3, plural: plural2 } = getSubject_default(vb3, parsed);
  if (plural2 || subject3.has("(we|you)")) {
    return "were";
  }
  return "was";
};
var isAreAm = function(vb3, parsed) {
  if (vb3.has("were")) {
    return "are";
  }
  const { subject: subject3, plural: plural2 } = getSubject_default(vb3, parsed);
  if (subject3.has("i")) {
    return "am";
  }
  if (subject3.has("(we|you)") || plural2) {
    return "are";
  }
  return "is";
};
var doDoes = function(vb3, parsed) {
  const subj = getSubject_default(vb3, parsed);
  const m3 = subj.subject;
  if (m3.has("(i|we|you)")) {
    return "do";
  }
  if (subj.plural) {
    return "do";
  }
  return "does";
};
var haveHas = function(vb3, parsed) {
  const subj = getSubject_default(vb3, parsed);
  const m3 = subj.subject;
  if (m3.has("(i|we|you)")) {
    return "have";
  }
  if (subj.plural === false) {
    return "has";
  }
  if (m3.has("he") || m3.has("she") || m3.has("#Person")) {
    return "has";
  }
  return "have";
};
var getTense2 = function(m3) {
  if (m3.has("#Infinitive")) {
    return "Infinitive";
  }
  if (m3.has("#Participle")) {
    return "Participle";
  }
  if (m3.has("#PastTense")) {
    return "PastTense";
  }
  if (m3.has("#Gerund")) {
    return "Gerund";
  }
  if (m3.has("#PresentTense")) {
    return "PresentTense";
  }
  return void 0;
};
var toInf = function(vb3, parsed) {
  const { toInfinitive: toInfinitive3 } = vb3.methods.two.transform.verb;
  let str = parsed.root.text({ keepPunct: false });
  str = toInfinitive3(str, vb3.model, getTense2(vb3));
  if (str) {
    vb3.replace(parsed.root, str);
  }
  return vb3;
};
var noWill = (vb3) => {
  if (vb3.has("will not")) {
    return vb3.replace("will not", "have not");
  }
  return vb3.remove("will");
};

// node_modules/compromise/src/3-three/verbs/api/conjugate/question.js
var methods18 = {
  past: "toPastTense",
  present: "toPresentTense",
  future: "toFutureTense",
  participle: "toPastParticiple",
  gerund: "toGerund",
  infinitive: "toInfinitive"
};
var auxiliary = /^(do|does|did|have|has|had|is|are|am|was|were|will|would|can|could|shall|should|may|might|must)$/;
var parseQuestion = function(sentence) {
  const wh = /^(?:(?:in|on|at|to|for|from|with|about|by)\s+)?(?:why|when|where|how|what|who|whom|which|whose)\b/i.test(sentence.text());
  if (!wh && !/^(?:do|does|did|have|has|had|is|are|am|was|were|will|would|can|could|shall|should|may|might|must|won|shan)(?:n['’]t)?\b/i.test(sentence.text())) return null;
  const expanded = sentence.clone();
  expanded.contractions().expand();
  const terms = expanded.terms();
  const words = terms.map((t3) => t3.text("normal"), []);
  const finite = wh ? words.findIndex((word, i3) => i3 > 0 && auxiliary.test(word)) : 0;
  if (finite < 0) return null;
  if (!auxiliary.test(words[finite]) || words[finite] === "will" && terms.eq(finite).has("#Person")) return null;
  const copula = /^(is|are|am|was|were)$/.test(words[finite]);
  let start2 = finite + 1;
  const frontNegative = words[start2] === "not";
  if (frontNegative) start2 += 1;
  let end2 = start2;
  if (terms.eq(end2).has("#Pronoun")) {
    end2 += 1;
  } else {
    if (terms.eq(end2).has("#Preposition")) return null;
    let noun3 = false;
    for (; end2 < words.length; end2 += 1) {
      if (!terms.eq(end2).has("(#Determiner|#Adjective|#Noun|#Preposition|#Conjunction)") || terms.eq(end2).has("#Verb")) break;
      if (noun3 && copula && (terms.eq(end2).has("#Adjective") || /ing$/.test(words[end2]))) break;
      noun3 ||= terms.eq(end2).has("#Noun");
    }
    if (!noun3) return null;
  }
  if (end2 === start2 || end2 >= words.length && !copula) return null;
  if (!terms.eq(end2).has("(#Verb|#Adverb|#Negative)") && !copula) return null;
  return { terms, words, finite, start: start2, end: end2, frontNegative };
};
var isInverted = (sentence) => Boolean(parseQuestion(sentence));
var questionSelection = function(sentence) {
  const q = parseQuestion(sentence);
  if (!q) return null;
  const offset2 = sentence.fullPointer[0][1];
  const at = offset2 + q.end;
  let predicate3 = sentence.verbs().filter((vb3) => vb3.fullPointer.some((ptr) => ptr[1] <= at && ptr[2] > at));
  for (let i3 = 0; i3 < q.words.length && predicate3.found; i3 += 1) {
    const chain = predicate3.growRight("(#Adverb|#Negative)+? #Verb+ #Particle?");
    const next = chain.growRight("(and|or) #Adverb+? #Verb+ #Particle?");
    if (next.wordCount() === predicate3.wordCount()) break;
    predicate3 = next;
  }
  return sentence.terms().slice(q.finite, q.start).concat(predicate3.not("#Conjunction")).settle();
};
var question = function(sentence, target) {
  const q = parseQuestion(sentence);
  if (!q) return null;
  const { terms, words, finite, start: start2, end: end2, frontNegative } = q;
  const subject3 = terms.slice(start2, end2).text();
  const prefix5 = finite > 0 ? terms.slice(0, finite).text() : "";
  const tail = terms.slice(end2).text();
  const negative = frontNegative ? " not" : "";
  const source2 = subject3 + " " + words[finite] + negative + " " + tail;
  let work = sentence.fromText(source2).compute(["tagger", "chunks"]);
  firstGroup(work.verbs())[methods18[target]]();
  if (work.text("normal") === sentence.fromText(source2).text("normal")) return sentence;
  work = sentence.fromText(work.text()).compute(["tagger", "chunks"]);
  const subjectLength = end2 - start2;
  let rest = work.terms().slice(subjectLength);
  let head = rest.eq(0).text("normal");
  if (!auxiliary.test(head)) {
    head = target === "past" ? "did" : doDoes(work.verbs(0));
    firstGroup(work.verbs()).toInfinitive();
    rest = work.terms().slice(subjectLength);
  } else {
    rest = rest.slice(1);
  }
  const contracted = sentence.has("@hasContraction") && frontNegative;
  const not = rest.match("not").eq(0);
  if (contracted && not.found) {
    if (head !== "am") {
      const special = { will: "won't", can: "can't", shall: "shan't" };
      head = special[head] || head + "n't";
      if (sentence.text().includes("\u2019")) head = head.replace("'", "\u2019");
      rest = rest.not(not);
    }
  }
  if (!prefix5 && /^[A-Z]/.test(sentence.text())) head = head[0].toUpperCase() + head.slice(1);
  const result = [prefix5, head, subject3, rest.text()].filter(Boolean).join(" ");
  const changed = sentence.replaceWith(result).fullSentence().compute(["contractions", "tagger", "contractionTwo", "chunks"]);
  for (let i3 = 0; i3 < finite; i3 += 1) {
    const term = changed.terms().eq(i3);
    term.unTag([...term.termList()[0].tags]);
    term.tag([...terms.eq(i3).termList()[0].tags]);
  }
  changed.terms().eq(finite).tag("Auxiliary");
  return changed.compute("chunks");
};
var question_default = question;

// node_modules/compromise/src/3-three/verbs/api/conjugate/inflect.js
var infinitive = (root, format2 = "normal") => {
  return root.methods.two.transform.verb.toInfinitive(root.text(format2), root.model, getTense2(root));
};
var inflect = (root, tense, format2) => {
  const word = infinitive(root, format2);
  if (tense === "Infinitive") return word;
  const forms6 = root.methods.two.transform.verb.conjugate(word, root.model);
  return forms6[tense] || (tense === "Participle" ? forms6.PastTense : void 0);
};

// node_modules/compromise/src/3-three/verbs/api/conjugate/coordinate.js
var resultTense = function(head, target) {
  const { chain, parsed, form } = head;
  if (target === "infinitive") return "Infinitive";
  if (target === "gerund") return chain && chain.passive ? "Participle" : "Gerund";
  if (parsed.root.has("#Gerund")) return "Gerund";
  if (target === "participle") return "Participle";
  if (chain && chain.passive) return "Participle";
  if (chain && chain.perfect) {
    return target === "present" && form === "modal-past" ? "Infinitive" : "Participle";
  }
  if (chain && chain.modal) {
    return target === "past" && form === "modal-infinitive" && chain.finite !== "can" ? "Participle" : "Infinitive";
  }
  if (target === "future") return "Infinitive";
  if (target === "past") return "PastTense";
  return isAreAm(head.vb, parsed) === "is" ? "PresentTense" : "Infinitive";
};
var coordinateNormal = function(verbs, target, convert3) {
  if (verbs.length < 2) return verbs.map(convert3);
  const entries = groups_default(verbs);
  entries.forEach((entry) => {
    if (entry.head) entry.tense = resultTense(entry.head, target);
  });
  return verbs.map((vb3, i3) => {
    const entry = entries[i3];
    if (!entry.head) {
      return convert3(vb3);
    }
    const root = entry.parsed.root;
    const word = inflect(root, entry.tense);
    if (word && word !== root.text("normal")) {
      entry.root.replaceWith(word);
      vb3.fullSentence().compute(["tagger", "chunks"]);
    }
    return vb3;
  });
};
var coordinate = function(verbs, target, convert3) {
  const sentences = verbs.fullSentence().settle();
  if (!sentences.some((s3) => isInverted(s3))) return coordinateNormal(verbs, target, convert3);
  return sentences.map((sentence) => {
    const index3 = sentence.fullPointer[0][0];
    const selected = verbs.filter((vb3) => vb3.fullPointer[0][0] === index3);
    const required = questionSelection(sentence);
    if (!required) return coordinateNormal(selected, target, convert3);
    const outside = selected.not(required);
    const inside = selected.not(outside).harden();
    const others = coordinateNormal(outside, target, convert3);
    if (!inside.found) return others;
    if (required.terms().not(inside.terms()).not("#Negative").found) return inside.concat(others).settle();
    const end2 = sentence.fullPointer[0][2];
    const trailing = others.fullPointer.map((ptr) => [ptr[0], end2 - ptr[1], end2 - ptr[2]]);
    const result = question_default(sentence, target);
    const newEnd = result.fullPointer[0][2];
    const remaining = result.update(trailing.map((ptr) => [ptr[0], newEnd - ptr[1], newEnd - ptr[2]]));
    return questionSelection(result).concat(remaining).settle();
  });
};
var coordinate_default = coordinate;

// node_modules/compromise/src/3-three/sentences/conjugate/toPast.js
var toPast2 = function(s3) {
  const inverted = question_default(s3, "past");
  if (inverted) return inverted;
  let verbs = s3.verbs();
  const first = firstGroup(verbs);
  if (first.has("#PastTense") && !first.has("#Auxiliary")) {
    return s3;
  }
  first.toPastTense();
  if (verbs.length > 1) {
    verbs = verbs.slice(first.length);
    verbs = verbs.filter((v2) => !v2.lookBehind("to$").found);
    verbs = verbs.if("#PresentTense");
    verbs = verbs.notIf("#Gerund");
    const list4 = s3.match("to #Verb+ #Conjunction #Verb").terms();
    verbs = verbs.not(list4);
    if (verbs.found) {
      verbs.verbs().toPastTense();
    }
  }
  return s3;
};
var toPast_default = toPast2;

// node_modules/compromise/src/3-three/sentences/conjugate/toPresent.js
var toPresent2 = function(s3) {
  const inverted = question_default(s3, "present");
  if (inverted) return inverted;
  let verbs = s3.verbs();
  const first = firstGroup(verbs);
  first.toPresentTense();
  if (verbs.length > 1) {
    verbs = verbs.slice(first.length);
    verbs = verbs.filter((v2) => !v2.lookBehind("to$").found);
    verbs = verbs.notIf("#Gerund");
    if (verbs.found) {
      verbs.verbs().toPresentTense();
    }
  }
  return s3;
};
var toPresent_default = toPresent2;

// node_modules/compromise/src/3-three/sentences/conjugate/toFuture.js
var toFuture = function(s3) {
  const inverted = question_default(s3, "future");
  if (inverted) return inverted;
  let verbs = s3.verbs();
  const first = firstGroup(verbs);
  first.toFutureTense();
  s3 = s3.fullSentence();
  verbs = s3.verbs();
  if (verbs.length > 1) {
    verbs = verbs.slice(first.length);
    const toChange = verbs.filter((vb3) => {
      if (vb3.lookBehind("to$").found) {
        return false;
      }
      if (vb3.has("#Copula #Gerund")) {
        return true;
      }
      if (vb3.has("#Gerund")) {
        return false;
      }
      if (vb3.has("#Copula")) {
        return true;
      }
      if (vb3.has("#PresentTense") && !vb3.has("#Infinitive") && vb3.lookBefore("(he|she|it|that|which)$").found) {
        return false;
      }
      return true;
    });
    if (toChange.found) {
      toChange.forEach((m3) => {
        if (m3.has("#Copula")) {
          m3.match("was").replaceWith("is");
          m3.match("is").replaceWith("will be");
          return;
        }
        m3.toInfinitive();
      });
    }
  }
  return s3;
};
var toFuture_default = toFuture;

// node_modules/compromise/src/3-three/sentences/conjugate/toNegative.js
var toNegative = function(s3) {
  s3.verbs().first().toNegative().compute("chunks");
  return s3;
};
var toPositive = function(s3) {
  s3.verbs().first().toPositive().compute("chunks");
  return s3;
};

// node_modules/compromise/src/3-three/sentences/conjugate/toInfinitive.js
var toInfinitive2 = function(s3) {
  s3.verbs().toInfinitive();
  return s3;
};
var toInfinitive_default2 = toInfinitive2;

// node_modules/compromise/src/3-three/sentences/api.js
var api15 = function(View2) {
  class Sentences extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Sentences";
    }
    json(opts2 = {}) {
      return this.map((m3) => {
        const json = m3.toView().json(opts2)[0] || {};
        const { subj, verb, pred, grammar: grammar2 } = parse_default6(m3);
        json.sentence = {
          subject: subj.text("normal"),
          verb: verb.text("normal"),
          predicate: pred.text("normal"),
          grammar: grammar2
        };
        return json;
      }, []);
    }
    toPastTense(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        return toPast_default(s3, parsed);
      });
    }
    toPresentTense(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        return toPresent_default(s3, parsed);
      });
    }
    toFutureTense(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        s3 = toFuture_default(s3, parsed);
        return s3;
      });
    }
    toInfinitive(n3) {
      return this.getNth(n3).map((s3) => {
        const parsed = parse_default6(s3);
        return toInfinitive_default2(s3, parsed);
      });
    }
    toNegative(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default6(vb3);
        return toNegative(vb3, parsed);
      });
    }
    toPositive(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default6(vb3);
        return toPositive(vb3, parsed);
      });
    }
    isQuestion(n3) {
      return this.questions(n3);
    }
    isExclamation(n3) {
      const res = this.filter((s3) => s3.lastTerm().has("@hasExclamation"));
      return res.getNth(n3);
    }
    isStatement(n3) {
      const res = this.filter((s3) => !s3.isExclamation().found && !s3.isQuestion().found);
      return res.getNth(n3);
    }
    // overloaded - keep Sentences class
    update(pointer) {
      const m3 = new Sentences(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  Sentences.prototype.toPresent = Sentences.prototype.toPresentTense;
  Sentences.prototype.toPast = Sentences.prototype.toPastTense;
  Sentences.prototype.toFuture = Sentences.prototype.toFutureTense;
  const methods19 = {
    sentences: function(n3) {
      let m3 = this.map((s3) => s3.fullSentence());
      m3 = m3.getNth(n3);
      return new Sentences(this.document, m3.pointer);
    },
    questions: function(n3) {
      const m3 = questions_default(this);
      return m3.getNth(n3);
    }
  };
  Object.assign(View2.prototype, methods19);
};
var api_default18 = api15;

// node_modules/compromise/src/3-three/sentences/plugin.js
var plugin_default28 = { api: api_default18 };

// node_modules/compromise/src/3-three/topics/people/find.js
var find6 = function(doc) {
  let m3 = doc.splitAfter("@hasComma");
  m3 = m3.match("#Honorific+? #Person+");
  const poss = m3.match("#Possessive").notIf("(his|her)");
  m3 = m3.splitAfter(poss);
  return m3;
};
var find_default4 = find6;

// node_modules/compromise/src/3-three/topics/people/parse.js
var parse8 = function(m3) {
  const res = {};
  res.firstName = m3.match("#FirstName+");
  res.lastName = m3.match("#LastName+");
  res.honorific = m3.match("#Honorific+");
  const last = res.lastName;
  const first = res.firstName;
  if (!first.found || !last.found) {
    if (!first.found && !last.found && m3.has("^#Honorific .$")) {
      res.lastName = m3.match(".$");
      return res;
    }
  }
  return res;
};
var parse_default8 = parse8;

// node_modules/compromise/src/3-three/topics/people/gender.js
var m2 = "male";
var f2 = "female";
var honorifics = {
  mr: m2,
  mrs: f2,
  miss: f2,
  madam: f2,
  // british stuff
  king: m2,
  queen: f2,
  duke: m2,
  duchess: f2,
  baron: m2,
  baroness: f2,
  count: m2,
  countess: f2,
  prince: m2,
  princess: f2,
  sire: m2,
  dame: f2,
  lady: f2,
  ayatullah: m2,
  //i think?
  congressman: m2,
  congresswoman: f2,
  "first lady": f2,
  // marked as non-binary
  mx: null
};
var predictGender = function(parsed, person) {
  const { firstName, honorific } = parsed;
  if (firstName.has("#FemaleName")) {
    return f2;
  }
  if (firstName.has("#MaleName")) {
    return m2;
  }
  if (honorific.found) {
    let hon = honorific.text("normal");
    hon = hon.replace(/\./g, "");
    if (Object.hasOwn(honorifics, hon)) {
      return honorifics[hon];
    }
    if (/^her /.test(hon)) {
      return f2;
    }
    if (/^his /.test(hon)) {
      return m2;
    }
  }
  const after2 = person.after();
  if (!after2.has("#Person") && after2.has("#Pronoun")) {
    const pro = after2.match("#Pronoun");
    if (pro.has("(they|their)")) {
      return null;
    }
    const hasMasc = pro.has("(he|his)");
    const hasFem = pro.has("(she|her|hers)");
    if (hasMasc && !hasFem) {
      return m2;
    }
    if (hasFem && !hasMasc) {
      return f2;
    }
  }
  return null;
};
var gender_default = predictGender;

// node_modules/compromise/src/3-three/topics/people/api.js
var addMethod2 = function(View2) {
  class People extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "People";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default8);
    }
    json(n3) {
      const opts2 = typeof n3 === "object" ? n3 : {};
      return this.getNth(n3).map((p5) => {
        const json = p5.toView().json(opts2)[0];
        const parsed = parse_default8(p5);
        json.person = {
          firstName: parsed.firstName.text("normal"),
          lastName: parsed.lastName.text("normal"),
          honorific: parsed.honorific.text("normal"),
          presumed_gender: gender_default(parsed, p5)
        };
        return json;
      }, []);
    }
    // used for co-reference resolution only
    presumedMale() {
      return this.filter((m3) => {
        return m3.has("(#MaleName|mr|mister|sr|jr|king|pope|prince|sir)");
      });
    }
    presumedFemale() {
      return this.filter((m3) => {
        return m3.has("(#FemaleName|mrs|miss|queen|princess|madam)");
      });
    }
    // overloaded - keep People class
    update(pointer) {
      const m3 = new People(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.people = function(n3) {
    let m3 = find_default4(this);
    m3 = m3.getNth(n3);
    return new People(this.document, m3.pointer);
  };
};
var api_default19 = addMethod2;

// node_modules/compromise/src/3-three/topics/places/find.js
var find7 = function(doc) {
  let m3 = doc.match("(#Place|#Address)+");
  let splits = m3.match("@hasComma");
  splits = splits.filter((c2) => {
    if (c2.has("(asia|africa|europe|america)$")) {
      return true;
    }
    if (c2.has("(#City|#Region|#ProperNoun)$") && c2.after("^(#Country|#Region)").found) {
      return false;
    }
    return true;
  });
  m3 = m3.splitAfter(splits);
  return m3;
};
var find_default5 = find7;

// node_modules/compromise/src/3-three/topics/places/api.js
var addMethod3 = function(View2) {
  View2.prototype.places = function(n3) {
    let m3 = find_default5(this);
    m3 = m3.getNth(n3);
    return new View2(this.document, m3.pointer);
  };
};
var api_default20 = addMethod3;

// node_modules/compromise/src/3-three/topics/orgs/api.js
var api16 = function(View2) {
  View2.prototype.organizations = function(n3) {
    const m3 = this.match("#Organization+");
    return m3.getNth(n3);
  };
};
var api_default21 = api16;

// node_modules/compromise/src/3-three/topics/topics.js
var find8 = function(n3) {
  const r2 = this.clauses();
  let m3 = r2.people();
  m3 = m3.concat(r2.places());
  m3 = m3.concat(r2.organizations());
  m3 = m3.concat(r2.match("#Acronym").ifNo(m3));
  m3 = m3.not("(someone|man|woman|mother|brother|sister|father)");
  m3 = m3.sort("seq");
  m3 = m3.getNth(n3);
  return m3;
};
var api17 = function(View2) {
  View2.prototype.topics = find8;
};
var topics_default = api17;

// node_modules/compromise/src/3-three/topics/plugin.js
var api18 = function(View2) {
  api_default19(View2);
  api_default20(View2);
  api_default21(View2);
  topics_default(View2);
};
var plugin_default29 = { api: api18 };

// node_modules/compromise/src/3-three/verbs/find.js
var findVerbs = function(doc) {
  let m3 = doc.match("<Verb>");
  m3 = m3.not("#Conjunction");
  m3 = m3.not("#Preposition");
  let gerunds = doc.match("#Preposition (#Adverb|#Negative)+? [#Gerund]", 0);
  const passive2 = "(being|having) (#Adverb|#Negative|#Auxiliary)+? (#PastTense|#Participle|#Gerund)";
  let chains = doc.match("#Preposition (#Adverb|#Negative)+? [" + passive2 + "]", 0);
  gerunds = gerunds.concat(chains);
  while (gerunds.found) {
    chains = gerunds.growRight("(and|or) (#Adverb|#Negative)+? " + passive2);
    const next = chains.growRight("(and|or) (#Adverb|#Negative)+? #Gerund");
    if (next.wordCount() === gerunds.wordCount()) {
      break;
    }
    gerunds = next;
  }
  m3 = m3.not(gerunds.terms());
  m3 = m3.splitAfter("@hasComma");
  m3 = m3.splitAfter("[(do|did|am|was|is|will)] (is|was)", 0);
  m3 = m3.splitBefore("(#Verb && !#Copula && !#Auxiliary) [being] #Verb", 0);
  m3 = m3.splitBefore("(#Verb && !#Auxiliary) [to be] #Verb", 0);
  m3 = m3.splitAfter("[help] #PresentTense", 0);
  m3 = m3.splitBefore("(#PresentTense|#PastTense) [#Copula]$", 0);
  m3 = m3.splitBefore("(#PresentTense|#PastTense) [will be]$", 0);
  m3 = m3.splitBefore("(#PresentTense|#PastTense) [(had|has)]", 0);
  m3 = m3.not("#Reflexive$");
  m3 = m3.not("#Adjective");
  m3 = m3.splitAfter("[#PastTense] #PastTense", 0);
  m3 = m3.splitAfter("[#PastTense] #Auxiliary+ #PastTense", 0);
  m3 = m3.splitAfter("#Copula [#Gerund] #PastTense", 0);
  m3 = m3.if("#Verb");
  if (m3.has("(#Verb && !#Auxiliary) #Adverb+? #Copula")) {
    m3 = m3.splitBefore("#Copula");
  }
  return m3;
};
var find_default6 = findVerbs;

// node_modules/compromise/src/3-three/verbs/api/toJSON.js
var toArray3 = function(m3) {
  if (!m3 || !m3.isView) {
    return [];
  }
  const opts2 = { normal: true, terms: false, text: false };
  return m3.json(opts2).map((s3) => s3.normal);
};
var toText4 = function(m3) {
  if (!m3 || !m3.isView) {
    return "";
  }
  return m3.text("normal");
};
var toInf2 = function(root) {
  const { toInfinitive: toInfinitive3 } = root.methods.two.transform.verb;
  const str = root.text("normal");
  return toInfinitive3(str, root.model, getTense2(root));
};
var toJSON3 = function(vb3) {
  const parsed = parse_default7(vb3);
  vb3 = vb3.clone().toView();
  const info = grammar_default(vb3, parsed);
  return {
    root: parsed.root.text(),
    preAdverbs: toArray3(parsed.adverbs.pre),
    postAdverbs: toArray3(parsed.adverbs.post),
    auxiliary: toText4(parsed.auxiliary),
    negative: parsed.negative.found,
    prefix: toText4(parsed.prefix),
    infinitive: toInf2(parsed.root),
    grammar: info
  };
};
var toJSON_default2 = toJSON3;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toInfinitive.js
var keep3 = { tags: true };
var toInf3 = function(vb3, parsed) {
  vb3.growLeft("@hasContraction+").contractions().expand();
  parsed = parse_default7(vb3);
  const { root, auxiliary: auxiliary2 } = parsed;
  const aux = auxiliary2.terms().harden();
  const str = infinitive(root);
  if (str === "be" && parsed.negative.found) {
    const copula = isAreAm(vb3, parsed);
    if (aux.found) {
      vb3.remove(root);
      vb3.match(aux).firstTerm().replaceWith(copula);
      vb3.remove(aux.slice(1));
    } else {
      vb3.replace(root, copula);
    }
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  if (str) {
    vb3.replace(root, str, keep3).tag("Verb").firstTerm().tag("Infinitive");
  }
  if (aux.found) {
    vb3.remove(aux);
  }
  if (parsed.negative.found && !vb3.has("never")) {
    if (!vb3.has("not")) {
      vb3.prepend("not");
    }
    const does = doDoes(vb3, parsed);
    vb3.prepend(does);
  }
  vb3.fullSentence().compute(["freeze", "lexicon", "preTagger", "postTagger", "unfreeze", "chunks"]);
  return vb3;
};
var toInfinitive_default3 = toInf3;

// node_modules/compromise/src/3-three/verbs/api/conjugate/auxiliary.js
var plan = function(chain, target, vb3, parsed) {
  const { finite, passive: passive2, progressive, words } = chain;
  let perfect = chain.perfect;
  if (target === "gerund") {
    if (progressive) return words;
    return [isAreAm(vb3, parsed), "being"];
  }
  if (chain.modal || chain.prospective) {
    if (target === "participle") {
      if (perfect) return words;
      const prefix5 = words.slice(0, chain.prefixLength);
      const tail2 = words.slice(chain.prefixLength);
      if (tail2[0] === "be") tail2[0] = "been";
      return [...prefix5, "have", ...tail2];
    }
    const head2 = target === "past" ? wasWere(vb3, parsed) : isAreAm(vb3, parsed);
    return [head2, ...words.slice(1)];
  }
  if (target === "present" && /^(has|have|is|are|am)$/.test(finite)) return words;
  if (target === "past" && /^(had|was|were|got)$/.test(finite)) return words;
  if (target === "future" && finite === "will") return words;
  if (target === "participle") {
    if (perfect && finite !== "will") return words;
    if (!passive2 && chain.form === "future-perfect-progressive") return words;
    perfect = true;
    target = "present";
  }
  if (passive2 && finite === "will" && target === "past" && !progressive) {
    perfect = true;
  }
  if (finite === "got" && target === "past") return words;
  if (finite === "got" && target === "future") return ["will", "get"];
  const tail = words.slice(finite === "will" ? 2 : 1);
  if (!passive2 && progressive && perfect && !chain.perfect) tail.unshift("been");
  if (passive2) {
    tail.length = 0;
    if (perfect) tail.push("been");
    if (progressive) tail.push("being");
  }
  const base = perfect ? "have" : "be";
  if (target === "future") return ["will", base, ...tail];
  let head;
  if (target === "past") {
    head = perfect ? "had" : wasWere(vb3, parsed);
  } else {
    head = perfect ? haveHas(vb3, parsed) : isAreAm(vb3, parsed);
  }
  return [head, ...tail];
};
var write = function(vb3, parsed, words, target, passive2) {
  const slots = vb3.match(parsed.auxiliary).terms().map((term) => ({ view: term.harden() }), []).map((slot) => slot.view);
  const root = vb3.match(parsed.root).harden();
  const sourceTail = slots.slice(1);
  const targetTail = target.slice(1);
  const overlap = Math.min(sourceTail.length, targetTail.length);
  const extra = targetTail.slice(0, targetTail.length - overlap);
  if (extra.length > 0) {
    const text6 = extra.join(" ");
    if (!passive2 && target[0] === "will" && target[1] === "have") {
      slots[0].toView().insertAfter(text6).terms().slice(1).tag("Auxiliary");
    } else {
      const anchor = sourceTail.length > 0 ? sourceTail[0] : root;
      anchor.toView().insertBefore(text6).terms().slice(0, extra.length).tag("Auxiliary");
    }
  }
  for (let i3 = 0; i3 < overlap; i3 += 1) {
    const sourceIndex = slots.length - 1 - i3;
    const replacement = target[target.length - 1 - i3];
    if (words[sourceIndex] !== replacement) {
      slots[sourceIndex].replaceWith(replacement).tag("Auxiliary");
    }
  }
  for (let i3 = sourceTail.length - overlap - 1; i3 >= 0; i3 -= 1) {
    sourceTail[i3].remove();
  }
  if (words[0] !== target[0]) slots[0].replaceWith(target[0]).tag("Auxiliary");
  return vb3;
};
var convertAuxiliary = function(vb3, parsed, form, target) {
  const chain = auxiliary_default(parsed, form);
  if (!chain) return null;
  if (target === "gerund" && !chain.passive) return null;
  if (chain.modal && target !== "participle" && target !== "gerund") return null;
  if (chain.prospective && !chain.perfect && !chain.passive && form === "auxiliary-future") return null;
  const words = plan(chain, target, vb3, parsed);
  if (words.join(" ") === chain.words.join(" ")) return vb3;
  vb3.growLeft("@hasContraction+").contractions().expand();
  const live = parse_default7(vb3);
  const root = vb3.match(live.root).harden();
  write(vb3, live, chain.words, words, chain.passive);
  if (target === "participle" && chain.modal && !chain.perfect && !chain.passive && !chain.progressive) {
    root.replaceWith(inflect(live.root, "Participle"));
  }
  vb3.fullSentence().compute(["tagger", "chunks"]);
  return vb3;
};
var auxiliary_default2 = convertAuxiliary;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toPast.js
var keep4 = { tags: true };
var fns6 = {
  noAux: (vb3, parsed) => {
    if (parsed.auxiliary.found) {
      vb3 = vb3.remove(parsed.auxiliary);
    }
    return vb3;
  },
  // walk->walked
  simple: (vb3, parsed) => {
    const root = parsed.root;
    if (root.has("#Modal")) {
      return vb3;
    }
    let str = inflect(root, "PastTense", { keepPunct: false });
    str = str === "been" ? "was" : str;
    if (str === "was") {
      str = wasWere(vb3, parsed);
    }
    if (str) {
      vb3.replace(root, str, keep4);
    }
    return vb3;
  },
  both: function(vb3, parsed) {
    if (parsed.root.has("be")) {
      vb3.replace("will", wasWere(vb3, parsed));
      return vb3.remove("be");
    }
    if (parsed.negative.found) {
      vb3.replace("will", "did");
      return vb3;
    }
    vb3 = fns6.simple(vb3, parsed);
    vb3 = fns6.noAux(vb3, parsed);
    return vb3;
  }
};
var forms = {
  // walk -> walked
  "infinitive": fns6.simple,
  // he walks -> he walked
  "simple-present": fns6.simple,
  // he walked
  "simple-past": noop,
  // he will walk -> he walked
  "simple-future": fns6.both,
  // would be walked -> 'would have been walked'
  "present-conditional": (vb3) => {
    vb3.replace("be", "have been");
    return vb3;
  },
  // would have been walked
  "past-conditional": noop,
  // is going to drink -> was going to drink
  "auxiliary-future": (vb3, parsed) => {
    vb3.replace("(is|are|am)", wasWere(vb3, parsed), keep4);
    return vb3;
  },
  // used to walk
  "auxiliary-past": noop,
  // we do walk -> we did walk
  "auxiliary-present": (vb3) => {
    vb3.replace("(do|does)", "did", keep4);
    return vb3;
  },
  // must walk -> 'must have walked'
  "modal-infinitive": (vb3, parsed) => {
    if (vb3.has("can")) {
      vb3.replace("can", "could", keep4);
    } else {
      vb3.match(parsed.root).replaceWith("have " + inflect(parsed.root, "Participle"));
      vb3.match("have").tag("Auxiliary");
    }
    return vb3;
  },
  // must have walked
  "modal-past": noop,
  // wanted to walk
  "want-infinitive": (vb3) => {
    vb3.replace("(want|wants)", "wanted", keep4);
    vb3.remove("will");
    return vb3;
  },
  // started looking
  "gerund-phrase": (vb3, parsed) => {
    parsed.root = parsed.root.not("#Gerund$");
    fns6.simple(vb3, parsed);
    noWill(vb3);
    return vb3;
  }
};
var toPast3 = function(vb3, parsed, form) {
  const converted = auxiliary_default2(vb3, parsed, form, "past");
  if (converted) return converted;
  if (Object.hasOwn(forms, form)) {
    vb3 = forms[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  return vb3;
};
var toPast_default2 = toPast3;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toParticiple.js
var simple = (vb3, parsed) => {
  const { root, auxiliary: auxiliary2 } = parsed;
  if (root.has("#Modal")) {
    return vb3;
  }
  let str = infinitive(root, { keepPunct: false });
  if (str === "be" && parsed.negative.has("not")) {
    const have = haveHas(vb3, parsed);
    vb3.replace(root, have);
    vb3.match(parsed.negative).insertAfter("been");
    vb3.match(have).tag("Auxiliary");
    return vb3;
  }
  str = inflect(root, "Participle", { keepPunct: false });
  if (auxiliary2.has("(do|does|did)")) {
    const have = haveHas(vb3, parsed);
    vb3.replace(root, str);
    vb3.replace("(do|does|did)", have).match(have).tag("Auxiliary");
    return vb3;
  }
  if (str) {
    vb3 = vb3.replace(root, str);
    const have = haveHas(vb3, parsed);
    vb3.prepend(have).match(have).tag("Auxiliary");
    vb3.remove(auxiliary2);
  }
  return vb3;
};
var forms2 = {
  // walk -> walked
  "infinitive": simple,
  // he walks -> he walked
  "simple-present": simple,
  // he will walk -> he walked
  "simple-future": (vb3, parsed) => {
    vb3.replace(parsed.root, inflect(parsed.root, "Participle"));
    return vb3.replace("will", haveHas(vb3, parsed));
  },
  // would be walked -> 'would have been walked'
  "present-conditional": (vb3) => vb3.replace("be", "have been"),
  // would have been walked
  "past-conditional": noop,
  // is going to drink -> was going to drink
  "auxiliary-future": (vb3, parsed) => {
    const have = haveHas(vb3, parsed);
    vb3.replace("(is|are|am|was|were)", have);
    vb3.match("going").insertBefore("been");
    vb3.match("(have|has|been|be)").tag("Auxiliary");
    vb3.match("going").unTag("Auxiliary").tag("Gerund");
    vb3.match("to").unTag("Auxiliary").tag("Conjunction");
    return vb3;
  },
  // must walk -> 'must have walked'
  "modal-infinitive": (vb3, parsed) => {
    vb3.match(parsed.root).replaceWith("have " + inflect(parsed.root, "Participle"));
    vb3.match("have").tag("Auxiliary");
    return vb3;
  },
  // must have walked
  "modal-past": noop,
  "modal-perfect-progressive": noop
  // wanted to walk
  // 'want-infinitive': noop,
  // started looking
  // 'gerund-phrase': noop,
};
var toParticiple2 = function(vb3, parsed, form) {
  const converted = auxiliary_default2(vb3, parsed, form, "participle");
  if (converted) return converted;
  if (Object.hasOwn(forms2, form)) {
    vb3 = forms2[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  vb3 = simple(vb3, parsed, form);
  vb3.fullSentence().compute(["tagger", "chunks"]);
  return vb3;
};
var toParticiple_default = toParticiple2;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toPresent.js
var keep5 = { tags: true };
var simple2 = (vb3, parsed) => {
  const root = parsed.root;
  let str = infinitive(root);
  const plural2 = isPlural4(vb3, parsed);
  if (plural2 === false) {
    str = inflect(root, "PresentTense");
  }
  if (root.has("#Copula")) {
    str = isAreAm(vb3, parsed);
  }
  if (str) {
    vb3 = vb3.replace(root, str, keep5);
    if (!plural2) vb3.not("#Particle").unTag("Infinitive");
    vb3.not("#Particle").tag("PresentTense");
  }
  return vb3;
};
var toGerund2 = (vb3, parsed) => {
  const root = parsed.root;
  const str = inflect(root, "Gerund");
  if (str) {
    vb3 = vb3.replace(root, str, keep5);
    vb3.not("#Particle").tag("Gerund");
  }
  return vb3;
};
var vbToInf = (vb3, parsed) => {
  const root = parsed.root;
  const str = infinitive(root);
  if (str) {
    vb3 = vb3.replace(parsed.root, str, keep5);
  }
  return vb3;
};
var forms3 = {
  // walk
  "infinitive": simple2,
  // he walks -> he walked
  "simple-present": (vb3, parsed) => {
    const { conjugate: conjugate2 } = vb3.methods.two.transform.verb;
    const { root } = parsed;
    if (root.has("#Infinitive")) {
      const subj = getSubject_default(vb3, parsed);
      const m3 = subj.subject;
      if (isPlural4(vb3, parsed) || m3.has("i")) {
        return vb3;
      }
      const str = root.text("normal");
      const pres = conjugate2(str, vb3.model).PresentTense;
      if (str !== pres) {
        vb3.replace(root, pres, keep5).not("#Particle").unTag("Infinitive").tag("PresentTense");
      }
    } else {
      return simple2(vb3, parsed);
    }
    return vb3;
  },
  // he walked
  "simple-past": simple2,
  // he will walk -> he walked
  "simple-future": (vb3, parsed) => {
    const { root, auxiliary: auxiliary2 } = parsed;
    if (auxiliary2.has("will") && root.has("be")) {
      const str = isAreAm(vb3, parsed);
      vb3.replace(root, str);
      vb3 = vb3.remove("will");
      vb3.replace("not " + str, str + " not");
    } else if (parsed.negative.found) {
      vb3.replace("will", doDoes(vb3, parsed)).match("(do|does)").tag("Auxiliary");
    } else {
      simple2(vb3, parsed);
      vb3 = vb3.remove("will");
    }
    return vb3;
  },
  // would be walked ->
  "present-conditional": noop,
  // would have been walked ->
  "past-conditional": (vb3) => {
    vb3.replace("been", "be");
    return vb3.remove("have");
  },
  // is going to drink -> is drinking
  "auxiliary-future": (vb3, parsed) => {
    const copula = isAreAm(vb3, parsed);
    vb3.replace("(was|were)", copula);
    if (parsed.root.has("#Gerund") && vb3.has("going to be")) {
      vb3.remove("going to be");
      return vb3;
    }
    toGerund2(vb3, parsed);
    vb3.remove("(going|to)");
    return vb3;
  },
  // did walk -> is walking
  "auxiliary-past": (vb3, parsed) => {
    if (parsed.auxiliary.has("did")) {
      const str = doDoes(vb3, parsed);
      vb3.replace(parsed.auxiliary, str);
      return vb3;
    }
    toGerund2(vb3, parsed);
    vb3.replace(parsed.auxiliary, "is");
    return vb3;
  },
  // we do walk ->
  "auxiliary-present": noop,
  // must walk -> 'must have walked'
  "modal-infinitive": noop,
  // must have walked
  "modal-past": (vb3, parsed) => {
    vbToInf(vb3, parsed);
    return vb3.remove("have");
  },
  // started looking
  "gerund-phrase": (vb3, parsed) => {
    parsed.root = parsed.root.not("#Gerund$");
    simple2(vb3, parsed);
    return vb3.remove("(will|have)");
  },
  // wanted to walk
  "want-infinitive": (vb3, parsed) => {
    let str = "wants";
    if (isPlural4(vb3, parsed)) {
      str = "want";
    }
    vb3.replace("(want|wanted|wants)", str, keep5);
    vb3.remove("will");
    return vb3;
  }
};
var toPresent3 = function(vb3, parsed, form) {
  const converted = auxiliary_default2(vb3, parsed, form, "present");
  if (converted) return converted;
  if (Object.hasOwn(forms3, form)) {
    vb3 = forms3[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  return vb3;
};
var toPresent_default2 = toPresent3;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toFuture.js
var keep6 = { tags: true };
var simple3 = (vb3, parsed) => {
  const { root, auxiliary: auxiliary2 } = parsed;
  if (root.has("#Modal")) {
    return vb3;
  }
  const str = infinitive(root);
  if (str === "be" && parsed.negative.has("not")) {
    vb3.replace(root, "will");
    vb3.match(parsed.negative).insertAfter("be");
    return vb3;
  }
  if (str) {
    vb3 = vb3.replace(root, str, keep6);
    vb3.not("#Particle").tag("Verb");
  }
  vb3.prepend("will").match("will").tag("Auxiliary");
  vb3.remove(auxiliary2);
  return vb3;
};
var forms4 = {
  // walk ->
  "infinitive": simple3,
  // he walks ->
  "simple-present": simple3,
  // he walked
  "simple-past": simple3,
  // he will walk ->
  "simple-future": noop,
  // would be walked ->
  "present-conditional": (vb3) => vb3.replace("would", "will"),
  // would have been walked ->
  "past-conditional": (vb3) => vb3.replace("would", "will"),
  // is going to drink ->
  "auxiliary-future": (vb3, parsed) => vb3.replace("(was|were)", isAreAm(vb3, parsed)),
  // used to walk -> is walking
  // did walk -> is walking
  "auxiliary-past": (vb3) => {
    if (vb3.has("used") && vb3.has("to")) {
      vb3.replace("used", "will");
      return vb3.remove("to");
    }
    vb3.replace("did", "will");
    return vb3;
  },
  // we do walk ->
  // he does walk ->
  "auxiliary-present": (vb3) => {
    return vb3.replace("(do|does)", "will");
  },
  // must walk ->
  "modal-infinitive": noop,
  // must have walked
  "modal-past": noop,
  // started looking
  "gerund-phrase": (vb3, parsed) => {
    parsed.root = parsed.root.not("#Gerund$");
    simple3(vb3, parsed);
    return vb3.remove("(had|have)");
  },
  // wanted to walk
  "want-infinitive": (vb3) => {
    vb3.replace("(want|wants|wanted)", "will want");
    return vb3;
  }
};
var toFuture2 = function(vb3, parsed, form) {
  const converted = auxiliary_default2(vb3, parsed, form, "future");
  if (converted) return converted;
  if (vb3.has("will")) {
    return vb3;
  }
  if (Object.hasOwn(forms4, form)) {
    vb3 = forms4[form](vb3, parsed);
    vb3.fullSentence().compute(["tagger", "chunks"]);
    return vb3;
  }
  return vb3;
};
var toFuture_default2 = toFuture2;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toGerund.js
var keep7 = { tags: true };
var toGerund3 = function(vb3, parsed, form) {
  const converted = auxiliary_default2(vb3, parsed, form, "gerund");
  if (converted) return converted;
  if (vb3.has("#Gerund")) {
    return vb3;
  }
  vb3.growLeft("@hasContraction+").contractions().expand();
  parsed = parse_default7(vb3);
  const { root, auxiliary: auxiliary2 } = parsed;
  const str = infinitive(root);
  const gerund = inflect(root, "Gerund");
  if (gerund) {
    const aux = isAreAm(vb3, parsed);
    if (str === "be" && !auxiliary2.found && parsed.negative.found) {
      vb3.replace(root, aux);
      vb3.match(parsed.negative).insertAfter(gerund);
    } else {
      vb3.replace(root, gerund, keep7);
      vb3.remove(auxiliary2);
      vb3.prepend(aux);
    }
  }
  vb3.replace("not is", "is not");
  vb3.replace("not are", "are not");
  vb3.fullSentence().compute(["tagger", "chunks"]);
  return vb3;
};
var toGerund_default = toGerund3;

// node_modules/compromise/src/3-three/verbs/api/conjugate/toNegative.js
var keep8 = { tags: true };
var doesNot = function(vb3, parsed) {
  const does = doDoes(vb3, parsed);
  vb3.prepend(does + " not");
  return vb3;
};
var isWas = function(vb3) {
  let m3 = vb3.match("be");
  if (m3.found) {
    m3.prepend("not");
    return vb3;
  }
  m3 = vb3.match("(is|was|am|are|will|were)");
  if (m3.found) {
    m3.append("not");
    return vb3;
  }
  return vb3;
};
var hasCopula = (vb3) => vb3.has("(is|was|am|are|will|were|be)");
var forms5 = {
  // he walks' -> 'he does not walk'
  "simple-present": (vb3, parsed) => {
    if (hasCopula(vb3) === true) {
      return isWas(vb3, parsed);
    }
    vb3 = toInf(vb3, parsed);
    vb3 = doesNot(vb3, parsed);
    return vb3;
  },
  // 'he walked' -> 'he did not walk'
  "simple-past": (vb3, parsed) => {
    if (hasCopula(vb3) === true) {
      return isWas(vb3, parsed);
    }
    vb3 = toInf(vb3, parsed);
    vb3.prepend("did not");
    return vb3;
  },
  // walk! -> 'do not walk'
  "imperative": (vb3) => {
    vb3.prepend("do not");
    return vb3;
  },
  // walk -> does not walk
  "infinitive": (vb3, parsed) => {
    if (hasCopula(vb3) === true) {
      return isWas(vb3, parsed);
    }
    return doesNot(vb3, parsed);
  },
  "passive-past": (vb3) => {
    if (vb3.has("got")) {
      vb3.replace("got", "get", keep8);
      vb3.prepend("did not");
      return vb3;
    }
    const m3 = vb3.match("(was|were|had|have)");
    if (m3.found) {
      m3.append("not");
    }
    return vb3;
  },
  "auxiliary-past": (vb3) => {
    if (vb3.has("used")) {
      vb3.prepend("did not");
      return vb3;
    }
    const m3 = vb3.match("(did|does|do)");
    if (m3.found) {
      m3.append("not");
    }
    return vb3;
  },
  // wants to walk
  "want-infinitive": (vb3, parsed) => {
    vb3 = doesNot(vb3, parsed);
    vb3 = vb3.replace("wants", "want", keep8);
    return vb3;
  }
};
var toNegative2 = function(vb3, parsed, form) {
  if (vb3.has("#Negative")) {
    return vb3;
  }
  if (Object.hasOwn(forms5, form)) {
    vb3 = forms5[form](vb3, parsed);
    return vb3;
  }
  let m3 = vb3.matchOne("be");
  if (m3.found) {
    m3.prepend("not");
    return vb3;
  }
  if (hasCopula(vb3) === true) {
    return isWas(vb3, parsed);
  }
  m3 = vb3.matchOne("(will|had|have|has|did|does|do|#Modal)");
  if (m3.found) {
    m3.append("not");
    return vb3;
  }
  return vb3;
};
var toNegative_default = toNegative2;

// node_modules/compromise/src/3-three/verbs/api/api.js
var api19 = function(View2) {
  class Verbs extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Verbs";
    }
    parse(n3) {
      return this.getNth(n3).map(parse_default7);
    }
    json(opts2, n3) {
      const m3 = this.getNth(n3);
      const arr = m3.map((vb3) => {
        const json = vb3.toView().json(opts2)[0] || {};
        json.verb = toJSON_default2(vb3);
        return json;
      }, []);
      return arr;
    }
    subjects(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default7(vb3);
        return getSubject_default(vb3, parsed).subject;
      });
    }
    adverbs(n3) {
      return this.getNth(n3).map((vb3) => vb3.match("#Adverb"));
    }
    isSingular(n3) {
      return this.getNth(n3).filter((vb3) => {
        return getSubject_default(vb3).plural !== true;
      });
    }
    isPlural(n3) {
      return this.getNth(n3).filter((vb3) => {
        return getSubject_default(vb3).plural === true;
      });
    }
    isImperative(n3) {
      return this.getNth(n3).filter((vb3) => vb3.has("#Imperative"));
    }
    toInfinitive(n3) {
      return coordinate_default(this.getNth(n3), "infinitive", (vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toInfinitive_default3(vb3, parsed, info.form);
      });
    }
    toPresentTense(n3) {
      return coordinate_default(this.getNth(n3), "present", (vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toPresent_default2(vb3, parsed, info.form);
      });
    }
    toPastTense(n3) {
      return coordinate_default(this.getNth(n3), "past", (vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toPast_default2(vb3, parsed, info.form);
      });
    }
    toFutureTense(n3) {
      return coordinate_default(this.getNth(n3), "future", (vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toFuture_default2(vb3, parsed, info.form);
      });
    }
    toGerund(n3) {
      return coordinate_default(this.getNth(n3), "gerund", (vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toGerund_default(vb3, parsed, info.form);
      });
    }
    toPastParticiple(n3) {
      return coordinate_default(this.getNth(n3), "participle", (vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.isInfinitive) {
          return vb3;
        }
        return toParticiple_default(vb3, parsed, info.form);
      });
    }
    conjugate(n3) {
      const { conjugate: conjugate2, toInfinitive: toInfinitive3 } = this.world.methods.two.transform.verb;
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        if (info.form === "imperative") {
          info.form = "simple-present";
        }
        let inf = parsed.root.text("normal");
        if (!parsed.root.has("#Infinitive")) {
          const tense = getTense2(parsed.root);
          inf = toInfinitive3(inf, vb3.model, tense) || inf;
        }
        return conjugate2(inf, vb3.model);
      }, []);
    }
    /** return only verbs with 'not'*/
    isNegative() {
      return this.if("#Negative");
    }
    /**  return only verbs without 'not'*/
    isPositive() {
      return this.ifNo("#Negative");
    }
    /** remove 'not' from these verbs */
    toPositive() {
      const m3 = this.match("do not #Verb");
      if (m3.found) {
        m3.remove("do not");
      }
      return this.remove("#Negative");
    }
    toNegative(n3) {
      return this.getNth(n3).map((vb3) => {
        const parsed = parse_default7(vb3);
        const info = grammar_default(vb3, parsed);
        return toNegative_default(vb3, parsed, info.form);
      });
    }
    // overloaded - keep Verb class
    update(pointer) {
      const m3 = new Verbs(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  Verbs.prototype.toPast = Verbs.prototype.toPastTense;
  Verbs.prototype.toPresent = Verbs.prototype.toPresentTense;
  Verbs.prototype.toFuture = Verbs.prototype.toFutureTense;
  View2.prototype.verbs = function(n3) {
    let vb3 = find_default6(this);
    vb3 = vb3.getNth(n3);
    return new Verbs(this.document, vb3.pointer);
  };
};
var api_default22 = api19;

// node_modules/compromise/src/3-three/verbs/plugin.js
var plugin_default30 = {
  api: api_default22
};

// node_modules/compromise/src/3-three/coreference/compute/lib.js
var findChained = function(want, s3) {
  const m3 = s3.match(want);
  if (m3.found) {
    const ref = m3.pronouns().refersTo();
    if (ref.found) {
      return ref;
    }
  }
  return s3.none();
};
var prevSentence = function(m3) {
  if (!m3.found) {
    return m3;
  }
  const [n3] = m3.fullPointer[0];
  if (n3 && n3 > 0) {
    return m3.update([[n3 - 1]]);
  }
  return m3.none();
};

// node_modules/compromise/src/3-three/coreference/compute/findPerson.js
var byGender = function(ppl, gender) {
  if (gender === "m") {
    return ppl.filter((m3) => !m3.presumedFemale().found);
  } else if (gender === "f") {
    return ppl.filter((m3) => !m3.presumedMale().found);
  }
  return ppl;
};
var getPerson = function(s3, gender) {
  let people = s3.people();
  people = byGender(people, gender);
  if (people.found) {
    return people.last();
  }
  people = s3.nouns("#Actor");
  if (people.found) {
    return people.last();
  }
  if (gender === "f") {
    return findChained("(she|her|hers)", s3);
  }
  if (gender === "m") {
    return findChained("(he|him|his)", s3);
  }
  return s3.none();
};
var findPerson_default = getPerson;

// node_modules/compromise/src/3-three/coreference/compute/findThey.js
var getThey = function(s3) {
  const nouns = s3.nouns();
  let things = nouns.isPlural().notIf("#Pronoun");
  if (things.found) {
    return things.last();
  }
  const chain = findChained("(they|their|theirs)", s3);
  if (chain.found) {
    return chain;
  }
  things = nouns.match("(somebody|nobody|everybody|anybody|someone|noone|everyone|anyone)");
  if (things.found) {
    return things.last();
  }
  return s3.none();
};
var findThey_default = getThey;

// node_modules/compromise/src/3-three/coreference/compute/index.js
var addReference = function(pron, m3) {
  if (m3 && m3.found) {
    const term = pron.docs[0][0];
    term.reference = m3.ptrs[0];
  }
};
var stepBack = function(m3, cb) {
  let s3 = m3.before();
  let res = cb(s3);
  if (res.found) {
    return res;
  }
  s3 = prevSentence(m3);
  res = cb(s3);
  if (res.found) {
    return res;
  }
  s3 = prevSentence(s3);
  res = cb(s3);
  if (res.found) {
    return res;
  }
  return m3.none();
};
var coreference = function(view) {
  const pronouns = view.pronouns().if("(he|him|his|she|her|hers|they|their|theirs|it|its)");
  pronouns.forEach((pron) => {
    let res = null;
    if (pron.has("(he|him|his)")) {
      res = stepBack(pron, (m3) => findPerson_default(m3, "m"));
    } else if (pron.has("(she|her|hers)")) {
      res = stepBack(pron, (m3) => findPerson_default(m3, "f"));
    } else if (pron.has("(they|their|theirs)")) {
      res = stepBack(pron, findThey_default);
    }
    if (res && res.found) {
      addReference(pron, res);
    }
  });
};
var compute_default13 = coreference;

// node_modules/compromise/src/3-three/coreference/api/pronouns.js
var api20 = function(View2) {
  class Pronouns extends View2 {
    constructor(document, pointer, groups2) {
      super(document, pointer, groups2);
      this.viewType = "Pronouns";
    }
    hasReference() {
      this.compute("coreference");
      return this.filter((m3) => {
        const term = m3.docs[0][0];
        return term.reference;
      });
    }
    // get the noun-phrase this pronoun refers to
    refersTo() {
      this.compute("coreference");
      return this.map((m3) => {
        if (!m3.found) {
          return m3.none();
        }
        const term = m3.docs[0][0];
        if (term.reference) {
          return m3.update([term.reference]);
        }
        return m3.none();
      });
    }
    // overloaded - keep Numbers class
    update(pointer) {
      const m3 = new Pronouns(this.document, pointer);
      m3._cache = this._cache;
      return m3;
    }
  }
  View2.prototype.pronouns = function(n3) {
    let m3 = this.match("#Pronoun");
    m3 = m3.getNth(n3);
    return new Pronouns(m3.document, m3.pointer);
  };
};
var pronouns_default = api20;

// node_modules/compromise/src/3-three/coreference/plugin.js
var plugin_default31 = {
  compute: { coreference: compute_default13 },
  api: pronouns_default
};

// node_modules/compromise/src/three.js
two_default.plugin(plugin_default20);
two_default.plugin(plugin_default21);
two_default.plugin(plugin_default22);
two_default.plugin(plugin_default31);
two_default.plugin(plugin_default23);
two_default.plugin(plugin_default24);
two_default.plugin(plugin_default25);
two_default.plugin(plugin_default26);
two_default.plugin(plugin_default27);
two_default.plugin(plugin_default28);
two_default.plugin(plugin_default29);
two_default.plugin(plugin_default30);
var three_default = two_default;

// src/lib/question-word-forms.ts
var VERB_VARIANTS = {
  am: ["be"],
  is: ["be"],
  are: ["be"],
  was: ["be"],
  were: ["be"],
  been: ["be"],
  being: ["be"],
  could: ["can"],
  might: ["may"],
  should: ["shall"],
  would: ["will"],
  lay: ["lie"],
  lain: ["lie"],
  abode: ["abide"],
  bidden: ["bid"],
  born: ["bear"],
  borne: ["bear"],
  dwelt: ["dwell"],
  shrunken: ["shrink"],
  woke: ["wake"],
  burnt: ["burn"],
  dreamt: ["dream"],
  leant: ["lean"],
  leapt: ["leap"],
  learnt: ["learn"],
  smelt: ["smell"],
  spelt: ["spell"],
  spilt: ["spill"],
  spoilt: ["spoil"],
  focussed: ["focus"],
  focussing: ["focus"],
  panicking: ["panic"]
};
var SPELLING_VARIANTS = {
  analyse: "analyze",
  organise: "organize",
  recognise: "recognize",
  realise: "realize",
  specialise: "specialize",
  apologise: "apologize",
  prioritise: "prioritize",
  colour: "color",
  colourful: "colorful",
  labour: "labor",
  favour: "favor",
  favourite: "favorite",
  honour: "honor",
  neighbour: "neighbor",
  centre: "center",
  fulfil: "fulfill"
};
var spelling = (word) => (SPELLING_VARIANTS[word] ?? word).normalize("NFD").replace(/\p{M}/gu, "");
var normalized = (text6) => text6.trim().toLocaleLowerCase().replaceAll("\u2019", "'");
var tokens = (text6) => normalized(text6).match(/\p{L}+(?:['-]\p{L}+)*/gu) ?? [];
var placeholder = (word) => /^(?:sb|sth|somebody|someone|something)(?:'s)?$/.test(word) || /^(?:one's|v|v-ing|ving|v-ed|ved|n|adj|adv)$/.test(word);
var REFLEXIVES = /* @__PURE__ */ new Set([
  "myself",
  "yourself",
  "himself",
  "herself",
  "itself",
  "ourselves",
  "yourselves",
  "themselves"
]);
function hasWordForm(source2, surface, posHint = "") {
  const word = spelling(normalized(source2));
  const candidate = spelling(normalized(surface));
  if (candidate === word) return true;
  if (word === "oneself") return REFLEXIVES.has(candidate);
  if (!/\s/.test(candidate)) {
    if (VERB_VARIANTS[candidate]?.includes(word)) return true;
    const verb = three_default(candidate);
    verb.tag("Verb");
    if (spelling(verb.verbs().toInfinitive().text()) === word) return true;
    const noun3 = three_default(candidate.replace(/'s$|(?<=s)'$/, ""));
    noun3.tag("Noun");
    if (spelling(noun3.nouns().toSingular().text()) === word) return true;
    const sourceVerb = three_default(word);
    sourceVerb.tag("Verb");
    if (sourceVerb.verbs().conjugate().some((forms6) => {
      const inflections = forms6;
      return spelling(inflections.Infinitive) === word && Object.values(inflections).some(
        (form) => spelling(form) === candidate
      );
    }))
      return true;
  }
  const adjective = three_default(word);
  if (!["adj.", "adv."].includes(posHint) && !adjective.has("#Adjective") && !adjective.has("#Adverb"))
    return false;
  adjective.tag("Adjective");
  return candidate === `more ${word}` || candidate === `most ${word}` || candidate === adjective.adjectives().toComparative().text() || candidate === adjective.adjectives().toSuperlative().text();
}
function hasPhraseUsage(source2, usage) {
  const fixed = source2.filter((word) => !placeholder(word));
  if (source2.some(placeholder)) {
    return usage.some((word) => hasWordForm(fixed[0], word));
  }
  let cursor = 0;
  for (const expected of fixed) {
    const next = usage.findIndex(
      (word, index3) => index3 >= cursor && hasWordForm(expected, word)
    );
    if (next < 0) return false;
    cursor = next + 1;
  }
  return true;
}
function entryReadings(source2) {
  const bare = source2.replace(/\([^)]*\)/gu, " ").trim() || source2;
  let readings = [""];
  for (const part of bare.split(/\s+/u)) {
    const choices2 = part.includes("/") ? part.split("/").filter(Boolean) : [part];
    readings = readings.flatMap((reading) => choices2.map((choice) => `${reading} ${choice}`)).slice(0, 16);
  }
  return readings.map((reading) => reading.trim());
}
function sourceWordFormIssue(source2, pos, answer, usage, language = "zh") {
  let first = null;
  for (const reading of entryReadings(source2)) {
    const issue = readingIssue(source2, reading, pos, answer, usage, language);
    if (!issue) return null;
    first ??= issue;
  }
  return first;
}
function readingIssue(source2, reading, pos, answer, usage, language) {
  const sourceWords = tokens(reading);
  const candidate = normalized(answer);
  const answerWords = tokens(candidate);
  const fixedSource = sourceWords.filter((word) => !placeholder(word));
  const related = sourceWords.length === 1 ? hasWordForm(sourceWords[0], candidate, normalizePartOfSpeech(pos)) || answerWords.length > 1 && answerWords.some(
    (part) => hasWordForm(sourceWords[0], part, normalizePartOfSpeech(pos))
  ) : usage ? fixedSource.some(
    (word) => answerWords.some((part) => hasWordForm(word, part))
  ) : fixedSource.some(
    (word, index3) => index3 === 0 && answerWords.some((part) => hasWordForm(word, part))
  ) || answerWords.length > 0 && answerWords.every(
    (part) => fixedSource.some((word) => hasWordForm(word, part))
  );
  if (!related)
    return language === "en" ? `"${answer}" is not a form of the source "${source2}"; use an inflection of the source itself, not a synonym or derived word` : `\u300C${answer}\u300D\u4E0D\u662F\u6307\u5B9A\u55AE\u5B57\u300C${source2}\u300D\u7684\u5408\u6CD5\u8A5E\u5F62\uFF1B\u8ACB\u4FDD\u7559\u4F86\u6E90\u55AE\u5B57\uFF0C\u4E0D\u8981\u63DB\u6210\u540C\u7FA9\u8A5E\u6216\u884D\u751F\u8A5E`;
  if (usage && sourceWords.length > 1 && !hasPhraseUsage(sourceWords, tokens(usage)))
    return language === "en" ? `usage "${usage}" does not contain the words of the source phrase "${source2}"; keep every fixed word of the phrase (inflected forms are fine)` : `\u300C${usage}\u300D\u6C92\u6709\u4FDD\u7559\u4F86\u6E90\u7247\u8A9E\u300C${source2}\u300D\u7684\u7D44\u6210\uFF1B\u8ACB\u4F7F\u7528\u5BE6\u969B\u8A5E\u5F62\u4E26\u4FDD\u7559\u7247\u8A9E\u4E2D\u7684\u5B57\u8A5E`;
  return null;
}

// src/lib/question-spans.ts
var WORD_CHAR = /[A-Za-z0-9]/;
function wordOccurrences(haystack, needle) {
  if (!needle) return [];
  const found = [];
  const lowerHay = haystack.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  let from = 0;
  for (; ; ) {
    const at = lowerHay.indexOf(lowerNeedle, from);
    if (at === -1) return found;
    const before2 = at === 0 ? "" : haystack[at - 1];
    const after2 = haystack[at + needle.length] ?? "";
    if (!WORD_CHAR.test(before2) && !WORD_CHAR.test(after2)) found.push(at);
    from = at + 1;
  }
}
function locateUsageAnswer(prose, usage, answer, language = "zh") {
  const en = language === "en";
  if (!usage.trim())
    return { issue: en ? "usage is empty" : "\u7F3A\u5C11\u76EE\u6A19\u7528\u6CD5 usage" };
  const usages = wordOccurrences(prose, usage);
  if (usages.length !== 1)
    return {
      issue: en ? `"${usage}" occurs ${usages.length} times in the text; ${usages.length ? "give a longer usage that occurs exactly once" : "answer and usage must be copied exactly from the text"}` : "\u76EE\u6A19\u7528\u6CD5\u5FC5\u9808\u5728\u539F\u6587\u6070\u597D\u51FA\u73FE\u4E00\u6B21"
    };
  const answers = wordOccurrences(usage, answer);
  if (answers.length !== 1)
    return {
      issue: answers.length ? en ? `answer "${answer}" occurs ${answers.length} times inside usage "${usage}"; it must occur exactly once` : `\u7B54\u6848\u5728\u76EE\u6A19\u7528\u6CD5\u4E2D\u51FA\u73FE ${answers.length} \u6B21\uFF0C\u5FC5\u9808\u6070\u597D\u4E00\u6B21` : en ? `answer "${answer}" is not inside usage "${usage}" as whole words` : "\u7B54\u6848\u5FC5\u9808\u4F4D\u65BC\u76EE\u6A19\u7528\u6CD5\u5167\u4E14\u4E0D\u8D85\u51FA\u7BC4\u570D"
    };
  return { at: usages[0] + answers[0] };
}

// src/lib/question-assembly.ts
function teaching(source2, distractors, mode) {
  return mode === "agent" ? assembleAgentTeaching(source2) : assembleOptionTeaching(source2, distractors);
}
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}
function usableDistractors(answer, candidates, count, allowPhrases = false) {
  const answerKey = answer.toLocaleLowerCase();
  const singleToken = !/\s/.test(answer);
  const seen = /* @__PURE__ */ new Set([answerKey]);
  const kept = [];
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase();
    if (seen.has(key)) continue;
    if (!allowPhrases && singleToken && /\s/.test(candidate)) continue;
    seen.add(key);
    kept.push(candidate);
    if (kept.length === count) return kept;
  }
  return null;
}
function buildSlots(words) {
  const slots = [];
  words.forEach((word, wordIndex) => {
    word.senses.forEach((_, senseIndex) => {
      slots.push({
        ref: `s${slots.length + 1}`,
        senseIndex,
        sourceRef: createSourceRef(wordIndex, senseIndex),
        word
      });
    });
  });
  return slots;
}
function wordBankSourceSlots(words, blanks, mode = "generated") {
  const slots = new Map(buildSlots(words).map((slot) => [slot.ref, slot]));
  const seen = /* @__PURE__ */ new Set();
  blanks.forEach((blank2, index3) => {
    const ref = isRecord(blank2) ? text(blank2.ref) : "";
    if (!ref) throw new Error(`\u6587\u610F\u9078\u586B\u7B2C ${index3 + 1} \u683C\u7F3A\u5C11\u4F86\u6E90 ref`);
    if (!slots.has(ref))
      throw new Error(`\u6587\u610F\u9078\u586B\u7B2C ${index3 + 1} \u683C\u6709\u672A\u77E5\u7684\u4F86\u6E90 ref\u300C${ref}\u300D`);
    if (mode === "generated" && seen.has(ref))
      throw new Error(`\u6587\u610F\u9078\u586B\u4F86\u6E90 ref\u300C${ref}\u300D\u91CD\u8907`);
    seen.add(ref);
  });
  if (mode === "generated" && seen.size !== slots.size)
    throw new Error("\u6587\u610F\u9078\u586B\u5FC5\u9808\u5C07\u672C\u6279\u6BCF\u500B\u4F86\u6E90 ref \u5404\u914D\u7F6E\u4E00\u6B21");
  return slots;
}
function resolveSlot(slots, ref, position, mode = "generated") {
  if (!slots.length) return null;
  if (mode === "agent") {
    if (ref) return slots.find((slot) => slot.ref === ref) ?? null;
    return slots.length === 1 ? slots[0] : null;
  }
  return slots.find((slot) => slot.ref === ref) ?? slots[position % slots.length];
}
function multipleChoiceItem(slot, style, prompt, answer, distractors, difficulty, source2, mode) {
  const { answerIndex, options } = placeAnswer(
    answer,
    distractors,
    `${mode === "agent" ? slot.word.senses[slot.senseIndex].id : slot.sourceRef}:${prompt}`
  );
  return {
    answerIndex,
    difficulty,
    kind: "multipleChoice",
    options,
    prompt,
    questionStyle: style,
    sourceRef: slot.sourceRef,
    ...teaching(source2, distractors, mode)
  };
}
function assembleSentences(value, kind, difficulty, words, mode) {
  const slots = buildSlots(words);
  const items = Array.isArray(value.items) ? value.items : [];
  if (!items.length) throw new Error("AI \u56DE\u8986\u6C92\u6709 items");
  const dropped = [];
  const questions = [];
  items.forEach((raw, position) => {
    if (!isRecord(raw)) return dropped.push(`\u7B2C ${position + 1} \u7B46\u683C\u5F0F\u932F\u8AA4`);
    const slot = resolveSlot(slots, text(raw.ref), position, mode);
    if (!slot) return dropped.push(`\u7B2C ${position + 1} \u7B46\u5C0D\u4E0D\u5230\u8F38\u5165\u8A5E\u7FA9`);
    const sentence = text(raw.sentence);
    const answer = text(raw.answer);
    const usage = text(raw.usage) || (mode === "agent" ? answer : "");
    if (!sentence || !answer || !usage)
      return dropped.push(`${slot.word.word}\uFF1A\u7F3A\u5C11\u53E5\u5B50\u3001\u76EE\u6A19\u7528\u6CD5\u6216\u7B54\u6848`);
    const location = locateUsageAnswer(sentence, usage, answer);
    if ("issue" in location)
      return dropped.push(`${slot.word.word}\uFF1A${location.issue}`);
    if (mode === "generated") {
      const wordFormIssue = sourceWordFormIssue(
        slot.word.word,
        slot.word.senses[slot.senseIndex].pos,
        answer,
        usage
      );
      if (wordFormIssue) return dropped.push(wordFormIssue);
    }
    const answerAt = location.at;
    const prompt = `${sentence.slice(0, answerAt)}_____${sentence.slice(answerAt + answer.length)}`;
    const distractors = usableDistractors(
      answer,
      stringArray(raw.distractors),
      3,
      true
    );
    if (!distractors)
      return dropped.push(`${slot.word.word}\uFF1A\u5E72\u64FE\u9078\u9805\u4E0D\u8DB3\u6216\u91CD\u8907`);
    questions.push(
      multipleChoiceItem(
        slot,
        kind,
        prompt,
        answer,
        distractors,
        difficulty,
        raw,
        mode
      )
    );
  });
  if (!questions.length) throw new Error(dropped[0] ?? "AI \u56DE\u8986\u6C92\u6709\u53EF\u7528\u7684\u984C\u76EE");
  return { dropped, payload: { kind: "questions", questions } };
}
function cutBlanks(passage, blanks) {
  const ordered = [...blanks].sort((first, second) => first.at - second.at);
  let result = "";
  let cursor = 0;
  ordered.forEach((blank2, index3) => {
    result += passage.slice(cursor, blank2.at) + blankToken(index3);
    cursor = blank2.at + blank2.answer.length;
  });
  return { children: ordered, passage: result + passage.slice(cursor) };
}
function assemblePassage(value, format2, difficulty, words, mode) {
  const spec = PASSAGE_FORMATS[format2];
  const slots = buildSlots(words);
  const title = text(value.title);
  const rawPassage = text(value.passage);
  if (!title || !rawPassage) throw new Error("AI \u56DE\u8986\u7F3A\u5C11\u6A19\u984C\u6216\u6587\u7AE0");
  const wordKeys = words.map((_, wordIndex) => createSourceRef(wordIndex));
  const dropped = [];
  if (format2 === "reading") {
    const items = Array.isArray(value.items) ? value.items : [];
    const children2 = items.flatMap((raw2, position) => {
      if (!isRecord(raw2)) return [];
      const slot = resolveSlot(
        slots,
        text(raw2.ref),
        position,
        text(raw2.ref) ? mode : "generated"
      );
      const question2 = text(raw2.question);
      const answer = text(raw2.answer);
      const distractors = usableDistractors(
        answer,
        stringArray(raw2.distractors),
        3,
        mode === "agent"
      );
      if (!slot || !question2 || !answer || !distractors) {
        dropped.push(`\u95B1\u8B80\u984C\u7B2C ${position + 1} \u984C\u8CC7\u6599\u4E0D\u5B8C\u6574`);
        return [];
      }
      const { answerIndex, options } = placeAnswer(
        answer,
        distractors,
        `${mode === "agent" ? slot.word.senses[slot.senseIndex].id : slot.sourceRef}:${question2}`
      );
      return [
        {
          answerIndex,
          kind: "multipleChoice",
          options,
          prompt: question2,
          sourceRef: slot.sourceRef,
          ...teaching(raw2, distractors, mode)
        }
      ];
    });
    if (!children2.length) throw new Error("AI \u56DE\u8986\u6C92\u6709\u53EF\u7528\u7684\u95B1\u8B80\u5B50\u984C");
    return {
      dropped,
      payload: {
        kind: "questions",
        questions: [
          {
            difficulty,
            format: format2,
            kind: "reading",
            passage: rawPassage,
            questions: children2,
            title,
            wordKeys
          }
        ]
      }
    };
  }
  const bankSlots = format2 === "wordBank" ? wordBankSourceSlots(
    words,
    Array.isArray(value.blanks) ? value.blanks : [],
    mode
  ) : null;
  const raw = format2 === "discourse" ? (Array.isArray(value.removals) ? value.removals : []).filter(isRecord).map((item) => ({
    answer: text(item.sentence),
    usage: "",
    ref: "",
    source: item
  })) : (Array.isArray(value.blanks) ? value.blanks : []).flatMap(
    (item) => isRecord(item) ? [
      {
        answer: text(item.answer),
        usage: text(item.usage) || (mode === "agent" ? text(item.answer) : ""),
        ref: text(item.ref),
        source: item
      }
    ] : []
  );
  const located = [];
  raw.forEach((item, position) => {
    const slot = bankSlots ? bankSlots.get(item.ref) : resolveSlot(
      slots,
      item.ref,
      position,
      format2 === "discourse" ? "generated" : mode
    );
    if (mode === "agent" && !slot) {
      dropped.push(`\u7B2C ${position + 1} \u683C\u7F3A\u5C11\u6709\u6548\u4F86\u6E90 ref\uFF1B\u8ACB\u6307\u5B9A sources.ref`);
      return;
    }
    let at;
    if (format2 === "discourse") {
      const hits = wordOccurrences(rawPassage, item.answer);
      if (hits.length !== 1) {
        dropped.push(
          `\u300C${item.answer.slice(0, 24)}\u300D\u5728\u6587\u7AE0\u4E2D\u51FA\u73FE ${hits.length} \u6B21\uFF0C\u5FC5\u9808\u6070\u597D\u4E00\u6B21`
        );
        return;
      }
      at = hits[0];
    } else {
      const location = locateUsageAnswer(rawPassage, item.usage, item.answer);
      if ("issue" in location) {
        dropped.push(`\u7B2C ${position + 1} \u683C\uFF1A${location.issue}`);
        return;
      }
      at = location.at;
    }
    if (mode === "generated" && format2 === "wordBank" && slot) {
      const wordFormIssue = sourceWordFormIssue(
        slot.word.word,
        slot.word.senses[slot.senseIndex].pos,
        item.answer,
        item.usage
      );
      if (wordFormIssue) {
        dropped.push(wordFormIssue);
        return;
      }
    }
    if (located.some(
      (existing) => at < existing.at + existing.answer.length && existing.at < at + item.answer.length
    )) {
      dropped.push(`\u300C${item.answer.slice(0, 24)}\u300D\u8207\u5176\u4ED6\u7A7A\u683C\u91CD\u758A`);
      return;
    }
    located.push({
      answer: item.answer,
      at,
      slot,
      source: item.source
    });
  });
  if (!located.length)
    throw new Error(dropped[0] ?? "\u6587\u7AE0\u4E2D\u627E\u4E0D\u5230\u53EF\u7528\u7684\u7A7A\u683C\u4F4D\u7F6E");
  const { children, passage } = cutBlanks(rawPassage, located);
  const answers = children.map((child) => child.answer);
  if (spec.sharedBank) {
    const candidates = stringArray(value.options);
    if (candidates.length !== spec.optionCount || new Set(candidates.map((option) => option.toLocaleLowerCase())).size !== candidates.length || answers.some((answer) => !candidates.includes(answer)))
      throw new Error(
        `\u5171\u7528\u9078\u9805\u5FC5\u9808\u6709 ${spec.optionCount} \u500B\u4E0D\u91CD\u8907\u9078\u9805\u4E26\u5305\u542B\u6BCF\u683C\u7B54\u6848`
      );
    if (new Set(answers.map((answer) => answer.toLocaleLowerCase())).size !== answers.length)
      throw new Error("\u5171\u7528\u9078\u9805\u7684\u6BCF\u500B\u7B54\u6848\u53EA\u80FD\u914D\u7F6E\u5230\u4E00\u500B\u7A7A\u683C");
    const sharedTeaching = (child, used) => {
      const own = mode === "agent" ? assembleAgentTeaching(child.source) : {};
      if (own.whyWrong) return own;
      return {
        ...own,
        ...assembleSharedBankTeaching(
          child.source,
          value,
          format2,
          child.answer,
          used
        )
      };
    };
    const bank = placeAnswer(
      candidates[0],
      candidates.slice(1),
      `${title}:bank`
    ).options;
    return {
      dropped,
      payload: {
        kind: "questions",
        questions: [
          {
            difficulty,
            format: format2,
            kind: "reading",
            optionBank: bank,
            passage,
            questions: children.map((child, index3) => ({
              answerIndex: bank.indexOf(child.answer),
              blank: index3 + 1,
              kind: "multipleChoice",
              options: bank,
              prompt: `Blank ${index3 + 1}`,
              sourceRef: format2 === "wordBank" ? child.slot.sourceRef : (child.slot ?? slots[index3 % slots.length]).sourceRef,
              ...sharedTeaching(child, answers)
            })),
            title,
            wordKeys
          }
        ]
      }
    };
  }
  const questions = children.flatMap((child, index3) => {
    const source2 = child.source;
    const distractors = usableDistractors(
      child.answer,
      stringArray(source2?.distractors),
      3,
      true
    );
    if (!distractors) {
      dropped.push(`\u7B2C ${index3 + 1} \u683C\u5E72\u64FE\u9078\u9805\u4E0D\u8DB3`);
      return [];
    }
    const { answerIndex, options } = placeAnswer(
      child.answer,
      distractors,
      `${title}:${index3}`
    );
    return [
      {
        answerIndex,
        blank: index3 + 1,
        kind: "multipleChoice",
        options,
        prompt: `Blank ${index3 + 1}`,
        sourceRef: (child.slot ?? slots[index3 % slots.length]).sourceRef,
        ...teaching(source2, distractors, mode)
      }
    ];
  });
  if (!questions.length) throw new Error(dropped[0] ?? "AI \u56DE\u8986\u6C92\u6709\u53EF\u7528\u7684\u7A7A\u683C");
  const kept = new Set(questions.map((question2) => question2.blank));
  let renumbered = passage;
  let next = 1;
  for (let index3 = 1; index3 <= children.length; index3 += 1) {
    renumbered = kept.has(index3) ? renumbered.replace(blankToken(index3 - 1), blankToken(next++ - 1)) : renumbered.replace(blankToken(index3 - 1), children[index3 - 1].answer);
  }
  questions.forEach((question2, index3) => {
    question2.blank = index3 + 1;
    question2.prompt = `Blank ${index3 + 1}`;
  });
  return {
    dropped,
    payload: {
      kind: "questions",
      questions: [
        {
          difficulty,
          format: format2,
          kind: "reading",
          passage: renumbered,
          questions,
          title,
          wordKeys
        }
      ]
    }
  };
}
function assembleGeneratedQuestions(value, kind, difficulty, words, mode = "generated") {
  if (!isRecord(value)) throw new Error("AI \u56DE\u8986\u5FC5\u9808\u662F JSON object");
  return isPassageKind(kind) ? assemblePassage(value, kind, difficulty, words, mode) : assembleSentences(value, kind, difficulty, words, mode);
}

// src/lib/hash.ts
var ROUND_CONSTANTS = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var encoder = new TextEncoder();
var schedule = new Uint32Array(64);
function rotateRight(value, bits) {
  return value >>> bits | value << 32 - bits;
}
function sha256(bytes) {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const block = new Uint8Array(paddedLength);
  block.set(bytes);
  block[bytes.length] = 128;
  const view = new DataView(block.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296));
  view.setUint32(paddedLength - 4, bitLength % 4294967296);
  let h0 = 1779033703;
  let h1 = 3144134277;
  let h2 = 1013904242;
  let h3 = 2773480762;
  let h4 = 1359893119;
  let h5 = 2600822924;
  let h6 = 528734635;
  let h7 = 1541459225;
  for (let offset2 = 0; offset2 < paddedLength; offset2 += 64) {
    for (let index3 = 0; index3 < 16; index3 += 1)
      schedule[index3] = view.getUint32(offset2 + index3 * 4);
    for (let index3 = 16; index3 < 64; index3 += 1) {
      const previous = schedule[index3 - 15];
      const recent = schedule[index3 - 2];
      const s0 = rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ previous >>> 3;
      const s1 = rotateRight(recent, 17) ^ rotateRight(recent, 19) ^ recent >>> 10;
      schedule[index3] = schedule[index3 - 16] + s0 + schedule[index3 - 7] + s1 >>> 0;
    }
    let a2 = h0;
    let b = h1;
    let c2 = h2;
    let d2 = h3;
    let e2 = h4;
    let f3 = h5;
    let g4 = h6;
    let h8 = h7;
    for (let index3 = 0; index3 < 64; index3 += 1) {
      const s1 = rotateRight(e2, 6) ^ rotateRight(e2, 11) ^ rotateRight(e2, 25);
      const choice = e2 & f3 ^ ~e2 & g4;
      const temp1 = h8 + s1 + choice + ROUND_CONSTANTS[index3] + schedule[index3] >>> 0;
      const s0 = rotateRight(a2, 2) ^ rotateRight(a2, 13) ^ rotateRight(a2, 22);
      const majority = a2 & b ^ a2 & c2 ^ b & c2;
      const temp2 = s0 + majority >>> 0;
      h8 = g4;
      g4 = f3;
      f3 = e2;
      e2 = d2 + temp1 >>> 0;
      d2 = c2;
      c2 = b;
      b = a2;
      a2 = temp1 + temp2 >>> 0;
    }
    h0 = h0 + a2 >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c2 >>> 0;
    h3 = h3 + d2 >>> 0;
    h4 = h4 + e2 >>> 0;
    h5 = h5 + f3 >>> 0;
    h6 = h6 + g4 >>> 0;
    h7 = h7 + h8 >>> 0;
  }
  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  for (const [index3, word] of [h0, h1, h2, h3, h4, h5, h6, h7].entries())
    digestView.setUint32(index3 * 4, word);
  return digest;
}
var HASH_BYTE_LENGTH = 16;
var HASH_HEX_LENGTH = HASH_BYTE_LENGTH * 2;
function toHex(bytes, byteLength) {
  let hex = "";
  for (let index3 = 0; index3 < byteLength; index3 += 1)
    hex += bytes[index3].toString(16).padStart(2, "0");
  return hex;
}
function hashText(text6) {
  return toHex(sha256(encoder.encode(text6)), HASH_BYTE_LENGTH);
}
function canonicalize(value, inArray = false) {
  if (value === void 0 || typeof value === "function" || typeof value === "symbol")
    return inArray ? null : void 0;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint")
    throw new TypeError("Cannot hash a BigInt value");
  if (Array.isArray(value))
    return value.map((item) => canonicalize(item, true));
  if (typeof value === "object") {
    const normalized2 = {};
    for (const key of Object.keys(value).sort()) {
      const item = canonicalize(value[key]);
      if (item !== void 0) normalized2[key] = item;
    }
    return normalized2;
  }
  return value;
}
function canonicalHash(value) {
  return hashText(JSON.stringify(canonicalize(value)) ?? "undefined");
}

// src/lib/id.ts
function randomUUID() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function")
    return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index3 = 0; index3 < bytes.length; index3 += 1)
      bytes[index3] = Math.floor(Math.random() * 256);
  }
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}

// src/lib/library.ts
function normalizeWordKey(word) {
  return word.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
var wordCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true
});
function isSetWordKey(wordKey) {
  return /^word-[0-9a-f]{32}$/u.test(wordKey);
}
function asSenseId(value) {
  return value;
}
function buildSenseId(wordKey, pos, meaningZh) {
  return `sense-${canonicalHash({ wordKey, pos: normalizePartOfSpeech(pos) || pos.trim().toLocaleLowerCase(), meaningZh: meaningZh.trim() })}`;
}
function buildQuestionFingerprint(question2) {
  const content = question2.kind === "reading" ? {
    ...question2,
    questions: question2.questions.map(({ id: _id, ...child }) => child)
  } : question2;
  return `fingerprint-${canonicalHash(content)}`;
}
function buildQuestionId(sourceId) {
  const normalized2 = sourceId?.trim();
  if (normalized2) return normalized2;
  return `question-${randomUUID()}`;
}
function canonicalizeQuestion(question2) {
  const {
    id: rawId,
    fingerprint: _rawFingerprint,
    createdAt: rawCreatedAt,
    updatedAt: rawUpdatedAt,
    ...rawContent
  } = question2;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = rawCreatedAt || now;
  const updatedAt = rawUpdatedAt || createdAt;
  const content = rawContent;
  return {
    ...content,
    id: buildQuestionId(rawId),
    fingerprint: buildQuestionFingerprint(content),
    createdAt,
    updatedAt
  };
}
function senseDescription(value) {
  const description = value?.trim();
  return description ? { description } : {};
}

// src/lib/question-generation.ts
function getQuestionSourceRefs(words) {
  return Object.fromEntries(
    words.flatMap((word, wordIndex) => [
      [
        createSourceRef(wordIndex),
        { wordKey: word.wordKey, senseId: word.senses[0].id }
      ],
      ...word.senses.map((sense2, senseIndex) => [
        createSourceRef(wordIndex, senseIndex),
        { wordKey: word.wordKey, senseId: sense2.id }
      ])
    ])
  );
}

// src/lib/question-shape.ts
function isValidAnswerIndex(optionCount, answerIndex) {
  return Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < optionCount;
}
function questionPromptIssue(_questionStyle, prompt) {
  const blankRuns = prompt.match(/_+/gu) ?? [];
  return blankRuns.length === 1 && blankRuns[0] === "_____" ? null : "blank";
}
function passageBlankIssue(format2, passage, childCount) {
  const spec = PASSAGE_FORMATS[format2];
  if (format2 === "reading")
    return countBlankTokens(passage) === 0 ? null : "\u95B1\u8B80\u6E2C\u9A57\u7684\u6587\u7AE0\u4E0D\u53EF\u6709\u7A7A\u683C";
  const numbers = blankTokenNumbers(passage);
  if (numbers.length !== childCount)
    return `\u6587\u7AE0\u7684\u7A7A\u683C\u6578\uFF08${numbers.length}\uFF09\u8207\u984C\u6578\uFF08${childCount}\uFF09\u4E0D\u4E00\u81F4`;
  const expected = Array.from({ length: childCount }, (_, index3) => index3 + 1);
  if (numbers.some((value, index3) => value !== expected[index3]))
    return "\u6587\u7AE0\u7684\u7A7A\u683C\u5FC5\u9808\u5F9E __1__ \u4F9D\u5E8F\u7DE8\u865F\u4E14\u4E0D\u91CD\u8907";
  if (spec.sharedBank && childCount > spec.optionCount)
    return `${format2} \u7684\u7A7A\u683C\u6578\u4E0D\u53EF\u8D85\u904E\u9078\u9805\u6578`;
  return null;
}

// src/lib/library-import.ts
function text2(value) {
  return typeof value === "string" ? value.trim() : "";
}
function optionalText(value, field) {
  if (value === void 0) return void 0;
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} \u683C\u5F0F\u932F\u8AA4`);
  return value.trim();
}
function stringList(value, field) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim()))
    throw new Error(`${field} \u5FC5\u9808\u662F\u975E\u7A7A\u5B57\u4E32\u9663\u5217`);
  return value.map((item) => item.trim());
}
function assertSchemaEnvelope(value, required = true) {
  if (required && value.schemaVersion !== 1)
    throw new Error("\u532F\u5165\u8CC7\u6599\u7F3A\u5C11 schemaVersion 1");
  if (value.schemaVersion !== void 0 && value.schemaVersion !== 1)
    throw new Error("\u53EA\u652F\u63F4 schemaVersion 1");
  if (value.batch !== void 0 && (typeof value.batch !== "number" || !Number.isInteger(value.batch) || value.batch < 1))
    throw new Error("batch \u5FC5\u9808\u662F\u6B63\u6574\u6578");
}
function questionDifficulty(value, index3, allowedDifficulty) {
  if (value === 1 || value === 2 || value === 3) {
    if (allowedDifficulty === void 0 || value === allowedDifficulty)
      return value;
  }
  if (allowedDifficulty !== void 0)
    throw new Error(
      `\u7B2C ${index3 + 1} \u984C difficulty \u5FC5\u9808\u662F ${allowedDifficulty}`
    );
  throw new Error(`\u7B2C ${index3 + 1} \u984C\u7F3A\u5C11\u6709\u6548 difficulty`);
}
function childQuestionId(question2) {
  return `child-${canonicalHash(question2)}`;
}
function normalizeSense(value, wordKey, index3) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`\u7B2C ${index3 + 1} \u500B\u8A5E\u7FA9\u683C\u5F0F\u932F\u8AA4`);
  const source2 = value;
  assertKnownKeys(
    source2,
    ["id", "pos", "meaningZh", "examples", "supplementary", "description"],
    `senses[${index3}]`
  );
  const rawPos = requiredText(source2.pos, `senses[${index3}].pos`);
  const pos = normalizePartOfSpeech(rawPos);
  if (!pos) throw new Error(`senses[${index3}].pos \u4E0D\u662F\u652F\u63F4\u7684\u8A5E\u6027`);
  const meaningZh = requiredText(
    source2.meaningZh,
    `senses[${index3}].meaningZh`
  );
  const examples = source2.examples;
  if (!Array.isArray(examples))
    throw new Error(`senses[${index3}].examples \u683C\u5F0F\u932F\u8AA4`);
  if (!examples.every((example) => typeof example === "string"))
    throw new Error(`senses[${index3}].examples \u683C\u5F0F\u932F\u8AA4`);
  if (typeof source2.supplementary !== "boolean")
    throw new Error(`senses[${index3}].supplementary \u683C\u5F0F\u932F\u8AA4`);
  if (source2.description !== void 0 && typeof source2.description !== "string")
    throw new Error(`senses[${index3}].description \u683C\u5F0F\u932F\u8AA4`);
  const id = requiredText(source2.id, `senses[${index3}].id`);
  const expectedId = buildSenseId(wordKey, pos, meaningZh);
  if (id !== expectedId)
    throw new Error(`senses[${index3}].id \u8207 wordKey\u3001pos\u3001meaningZh \u4E0D\u4E00\u81F4`);
  return {
    id: expectedId,
    pos,
    meaningZh,
    examples: examples.map((example) => example.trim()).filter(Boolean),
    supplementary: source2.supplementary,
    ...senseDescription(source2.description)
  };
}
function normalizeWord(value, index3) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`\u7B2C ${index3 + 1} \u500B\u55AE\u5B57\u683C\u5F0F\u932F\u8AA4`);
  const source2 = value;
  assertKnownKeys(
    source2,
    ["wordKey", "word", "senses", "starred", "updatedAt"],
    `words[${index3}]`
  );
  const word = requiredText(source2.word, `words[${index3}].word`);
  const rawWordKey = requiredText(source2.wordKey, `words[${index3}].wordKey`);
  const wordKey = normalizeWordKey(rawWordKey);
  if (!isSetWordKey(wordKey) && wordKey !== normalizeWordKey(word))
    throw new Error(`words[${index3}].wordKey \u5FC5\u9808\u8207 word \u76F8\u7B26`);
  const rawSenses = source2.senses;
  if (!Array.isArray(rawSenses))
    throw new Error(`\u7B2C ${index3 + 1} \u500B\u55AE\u5B57\u7684 senses \u683C\u5F0F\u932F\u8AA4`);
  if (!rawSenses.length) throw new Error(`\u7B2C ${index3 + 1} \u500B\u55AE\u5B57\u7F3A\u5C11 senses`);
  if (source2.starred !== void 0 && typeof source2.starred !== "boolean")
    throw new Error(`words[${index3}].starred \u683C\u5F0F\u932F\u8AA4`);
  const senses = rawSenses.map(
    (sense2, senseIndex) => normalizeSense(sense2, wordKey, senseIndex)
  );
  if (new Set(senses.map((sense2) => sense2.id)).size !== senses.length)
    throw new Error(`\u7B2C ${index3 + 1} \u500B\u55AE\u5B57\u5305\u542B\u91CD\u8907 sense`);
  return {
    wordKey,
    word,
    senses,
    ...source2.starred ? { starred: true } : {},
    updatedAt: requiredText(source2.updatedAt, `words[${index3}].updatedAt`)
  };
}
function sourceRef(value, index3, refs) {
  if (!refs) {
    if (value.sourceRef !== void 0)
      throw new Error(`\u7B2C ${index3 + 1} \u984C\u4E0D\u61C9\u5305\u542B sourceRef`);
    return null;
  }
  const key = text2(value.sourceRef);
  if (!key || !refs[key])
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u7F3A\u5C11\u6709\u6548 sourceRef`);
  return refs[key];
}
function assertEnglish(value, field, requireEnglish = false) {
  if (requireEnglish && containsHan(value))
    throw new Error(`${field} \u5FC5\u9808\u4F7F\u7528\u82F1\u6587`);
}
function readQuestionStyle(value, index3) {
  if (value === "vocabulary" || value === "grammar") return value;
  throw new Error(`\u7B2C ${index3 + 1} \u984C\u7F3A\u5C11\u984C\u578B`);
}
function readPassageFormat(value, index3) {
  if (value === "reading" || value === "cloze" || value === "wordBank" || value === "discourse")
    return value;
  throw new Error(`\u7B2C ${index3 + 1} \u984C\u7684\u984C\u7D44\u683C\u5F0F\u7121\u6548`);
}
function assertGeneratedIdentity(value, index3) {
  const generatedOnlyKeys = [
    "id",
    "fingerprint",
    "createdAt",
    "updatedAt",
    "wordKey",
    "senseId"
  ];
  const present2 = generatedOnlyKeys.filter((key) => value[key] !== void 0);
  if (present2.length)
    throw new Error(
      `\u7B2C ${index3 + 1} \u984C AI \u56DE\u8986\u4E0D\u53EF\u5305\u542B\u6B63\u5F0F\u8EAB\u4EFD\u6B04\u4F4D\uFF1A${present2.join("\u3001")}`
    );
}
function generatedQuestionId(value, refs) {
  return refs ? buildQuestionId() : buildQuestionId(requiredText(value, "question.id"));
}
function generatedTimestamp(value, generatedAt, refs) {
  return refs ? generatedAt : requiredText(value, "question.timestamp");
}
function normalizeMultipleChoice(value, index3, refs, allowedDifficulty, expectedQuestionStyle, requireEnglish = false) {
  assertKnownKeys(
    value,
    [
      "id",
      "fingerprint",
      "wordKey",
      "senseId",
      "sourceRef",
      "difficulty",
      "explanation",
      "createdAt",
      "updatedAt",
      "kind",
      "questionStyle",
      "prompt",
      "options",
      "answerIndex",
      "trap",
      "whyWrong"
    ],
    `questions[${index3}]`
  );
  if (refs) assertGeneratedIdentity(value, index3);
  const prompt = requiredText(value.prompt, `questions[${index3}].prompt`);
  const options = stringList(value.options, `questions[${index3}].options`);
  const answerIndex = typeof value.answerIndex === "number" ? value.answerIndex : Number.NaN;
  if (options.length !== 4 || !isValidAnswerIndex(options.length, answerIndex))
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u9078\u64C7\u984C\u8CC7\u6599\u4E0D\u5B8C\u6574`);
  const questionStyle = readQuestionStyle(value.questionStyle, index3);
  if (expectedQuestionStyle && questionStyle !== expectedQuestionStyle)
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u984C\u578B\u5FC5\u9808\u662F ${expectedQuestionStyle}`);
  if (questionPromptIssue(questionStyle, prompt))
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u984C\u5E79\u5FC5\u9808\u4E14\u53EA\u80FD\u5305\u542B\u4E00\u500B _____`);
  assertEnglish(prompt, `\u7B2C ${index3 + 1} \u984C\u984C\u5E79`, requireEnglish);
  for (const [optionIndex, option] of options.entries())
    assertEnglish(
      option,
      `\u7B2C ${index3 + 1} \u984C\u9078\u9805 ${optionIndex + 1}`,
      requireEnglish
    );
  const resolvedSource = sourceRef(value, index3, refs);
  const wordKey = resolvedSource?.wordKey ?? normalizeWordKey(
    value.wordKey === void 0 ? "" : requiredText(value.wordKey, `questions[${index3}].wordKey`)
  );
  const senseId = asSenseId(
    resolvedSource?.senseId ?? (value.senseId === void 0 ? "" : requiredText(value.senseId, `questions[${index3}].senseId`))
  );
  if (!wordKey || !senseId)
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u5FC5\u9808\u7D81\u5B9A wordKey \u8207 senseId`);
  const trap = optionalText(value.trap, `questions[${index3}].trap`);
  const explanation = optionalText(
    value.explanation,
    `questions[${index3}].explanation`
  );
  const whyWrong = readWhyWrong(value.whyWrong, `questions[${index3}].whyWrong`);
  const content = {
    kind: "multipleChoice",
    wordKey,
    senseId,
    difficulty: questionDifficulty(value.difficulty, index3, allowedDifficulty),
    questionStyle,
    prompt,
    options,
    answerIndex,
    explanation,
    trap,
    whyWrong
  };
  const fingerprint = buildQuestionFingerprint(content);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...content,
    id: generatedQuestionId(value.id, refs),
    fingerprint,
    createdAt: generatedTimestamp(value.createdAt, now, refs),
    updatedAt: generatedTimestamp(value.updatedAt, now, refs)
  };
}
function readWhyWrong(value, field) {
  if (value === void 0) return void 0;
  if (!isRecord(value) || !Object.values(value).every((item) => typeof item === "string"))
    throw new Error(`${field} \u683C\u5F0F\u932F\u8AA4`);
  return value;
}
function normalizeReading(value, index3, refs, allowedDifficulty, requireEnglish = false) {
  assertKnownKeys(
    value,
    [
      "id",
      "fingerprint",
      "difficulty",
      "explanation",
      "createdAt",
      "updatedAt",
      "kind",
      "format",
      "title",
      "passage",
      "wordKeys",
      "questions",
      "optionBank"
    ],
    `questions[${index3}]`
  );
  if (refs) assertGeneratedIdentity(value, index3);
  const format2 = readPassageFormat(value.format, index3);
  const spec = PASSAGE_FORMATS[format2];
  const optionBank = value.optionBank === void 0 ? void 0 : stringList(value.optionBank, `questions[${index3}].optionBank`);
  if (spec.sharedBank && (!optionBank || optionBank.length !== spec.optionCount))
    throw new Error(
      `\u7B2C ${index3 + 1} \u984C\u5FC5\u9808\u63D0\u4F9B ${spec.optionCount} \u500B\u5171\u7528\u9078\u9805`
    );
  if (!spec.sharedBank && optionBank)
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u4E0D\u8A72\u6709\u5171\u7528\u9078\u9805`);
  const title = requiredText(value.title, `questions[${index3}].title`);
  const passage = requiredText(value.passage, `questions[${index3}].passage`);
  assertEnglish(title, `\u7B2C ${index3 + 1} \u984C\u6A19\u984C`, requireEnglish);
  assertEnglish(passage, `\u7B2C ${index3 + 1} \u984C\u6587\u7AE0`, requireEnglish);
  const rawWordKeys = stringList(
    value.wordKeys,
    `questions[${index3}].wordKeys`
  );
  const wordKeys = rawWordKeys.map((wordKey) => {
    if (!refs) return normalizeWordKey(wordKey);
    const source2 = refs[wordKey];
    if (!source2) throw new Error(`\u7B2C ${index3 + 1} \u984C\u5305\u542B\u672A\u77E5 sourceRef`);
    return source2.wordKey;
  });
  if (new Set(wordKeys).size !== wordKeys.length)
    throw new Error(`\u7B2C ${index3 + 1} \u984C wordKeys \u4E0D\u53EF\u91CD\u8907`);
  const rawQuestions = value.questions;
  if (!Array.isArray(rawQuestions))
    throw new Error(`\u7B2C ${index3 + 1} \u984C questions \u683C\u5F0F\u932F\u8AA4`);
  if (!wordKeys.length || !rawQuestions.length)
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u95B1\u8B80\u8CC7\u6599\u4E0D\u5B8C\u6574`);
  const childIds = /* @__PURE__ */ new Set();
  const questions = rawQuestions.map((item, childIndex) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error(`\u95B1\u8B80\u984C ${childIndex + 1} \u683C\u5F0F\u932F\u8AA4`);
    const child = item;
    assertKnownKeys(
      child,
      [
        "id",
        "kind",
        "blank",
        "sourceRef",
        "prompt",
        "options",
        "answerIndex",
        "wordKey",
        "senseId",
        "explanation",
        "whyWrong"
      ],
      `reading.questions[${childIndex}]`
    );
    if (refs) assertGeneratedIdentity(child, childIndex);
    if (child.kind !== "multipleChoice")
      throw new Error(`\u95B1\u8B80\u984C ${childIndex + 1} \u5FC5\u9808\u662F multipleChoice`);
    const prompt = requiredText(
      child.prompt,
      `reading.questions[${childIndex}].prompt`
    );
    const options = stringList(
      child.options,
      `reading.questions[${childIndex}].options`
    );
    const answerIndex = typeof child.answerIndex === "number" ? child.answerIndex : Number.NaN;
    if (options.length !== spec.optionCount || !isValidAnswerIndex(options.length, answerIndex))
      throw new Error(`\u7B2C ${childIndex + 1} \u5C0F\u984C\u9078\u9805\u8CC7\u6599\u4E0D\u5B8C\u6574`);
    if (spec.sharedBank && optionBank && options.some((option, at) => option !== optionBank[at]))
      throw new Error(`\u7B2C ${childIndex + 1} \u5C0F\u984C\u5FC5\u9808\u4F7F\u7528\u5171\u7528\u9078\u9805`);
    assertEnglish(prompt, `\u95B1\u8B80\u984C ${childIndex + 1} \u984C\u5E79`, requireEnglish);
    for (const [optionIndex, option] of options.entries())
      assertEnglish(
        option,
        `\u95B1\u8B80\u984C ${childIndex + 1} \u9078\u9805 ${optionIndex + 1}`,
        requireEnglish
      );
    const resolvedSource = sourceRef(child, childIndex, refs);
    const wordKey = resolvedSource?.wordKey ?? normalizeWordKey(
      child.wordKey === void 0 ? "" : requiredText(
        child.wordKey,
        `reading.questions[${childIndex}].wordKey`
      )
    );
    const senseId = asSenseId(
      resolvedSource?.senseId ?? (child.senseId === void 0 ? "" : requiredText(
        child.senseId,
        `reading.questions[${childIndex}].senseId`
      ))
    );
    if (!wordKey || !senseId)
      throw new Error(`\u95B1\u8B80\u984C ${childIndex + 1} \u5FC5\u9808\u7D81\u5B9A wordKey \u8207 senseId`);
    const normalized2 = {
      kind: "multipleChoice",
      ...spec.blanks ? { blank: childIndex + 1 } : {},
      prompt,
      options,
      answerIndex,
      wordKey,
      senseId,
      explanation: optionalText(
        child.explanation,
        `reading.questions[${childIndex}].explanation`
      ),
      whyWrong: readWhyWrong(
        child.whyWrong,
        `reading.questions[${childIndex}].whyWrong`
      )
    };
    const id = refs ? childQuestionId(normalized2) : requiredText(child.id, `reading.questions[${childIndex}].id`);
    if (childIds.has(id))
      throw new Error(`\u95B1\u8B80\u984C ${childIndex + 1} id \u4E0D\u53EF\u91CD\u8907`);
    childIds.add(id);
    return { ...normalized2, id };
  });
  const blankIssue = passageBlankIssue(format2, passage, questions.length);
  if (blankIssue) throw new Error(`\u7B2C ${index3 + 1} \u984C${blankIssue}`);
  if (spec.sharedBank) {
    const answers = questions.map((child) => child.answerIndex);
    if (new Set(answers).size !== answers.length)
      throw new Error(`\u7B2C ${index3 + 1} \u984C\u5171\u7528\u9078\u9805\u6BCF\u500B\u53EA\u80FD\u7528\u4E00\u6B21`);
  }
  const content = {
    kind: "reading",
    format: format2,
    ...optionBank ? { optionBank } : {},
    difficulty: questionDifficulty(value.difficulty, index3, allowedDifficulty),
    explanation: optionalText(
      value.explanation,
      `questions[${index3}].explanation`
    ),
    title,
    passage,
    wordKeys,
    questions
  };
  const fingerprint = buildQuestionFingerprint(content);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...content,
    id: generatedQuestionId(value.id, refs),
    fingerprint,
    createdAt: generatedTimestamp(value.createdAt, now, refs),
    updatedAt: generatedTimestamp(value.updatedAt, now, refs)
  };
}
function normalizeQuestion(value, index3, refs, allowedDifficulty, expectedQuestionKind, expectedQuestionStyle, requireEnglish = false) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u683C\u5F0F\u932F\u8AA4`);
  const source2 = value;
  if (expectedQuestionKind && source2.kind !== expectedQuestionKind)
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u985E\u578B\u4E0D\u7B26\u5408\u76EE\u524D\u751F\u6210\u8A2D\u5B9A`);
  if (source2.kind === "reading")
    return normalizeReading(
      source2,
      index3,
      refs,
      allowedDifficulty,
      requireEnglish
    );
  if (source2.kind !== "multipleChoice")
    throw new Error(`\u7B2C ${index3 + 1} \u984C\u5FC5\u9808\u662F multipleChoice \u6216 reading`);
  return normalizeMultipleChoice(
    source2,
    index3,
    refs,
    allowedDifficulty,
    expectedQuestionStyle,
    requireEnglish
  );
}
function normalizeLibraryImportValue(parsedValue, options) {
  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue))
    throw new Error("\u532F\u5165\u8CC7\u6599\u5FC5\u9808\u662F object");
  const parsed = parsedValue;
  assertSchemaEnvelope(parsed, !options.questionSources);
  if (parsed.kind === "words") {
    assertKnownKeys(
      parsed,
      ["kind", "schemaVersion", "batch", "words"],
      "\u532F\u5165\u8CC7\u6599"
    );
    if (!Array.isArray(parsed.words))
      throw new Error("\u627E\u4E0D\u5230\u6709\u6548\u7684 words \u9663\u5217");
    return { kind: "words", words: parsed.words.map(normalizeWord) };
  }
  if (parsed.kind === "questions") {
    assertKnownKeys(
      parsed,
      ["kind", "schemaVersion", "batch", "questions"],
      "\u532F\u5165\u8CC7\u6599"
    );
    if (!Array.isArray(parsed.questions))
      throw new Error("\u627E\u4E0D\u5230\u6709\u6548\u7684 questions \u9663\u5217");
    const requireEnglish = options.requireEnglish ?? true;
    return {
      kind: "questions",
      questions: parsed.questions.map(
        (question2, index3) => normalizeQuestion(
          question2,
          index3,
          options.questionSources,
          options.allowedDifficulty,
          options.expectedQuestionKind,
          options.expectedQuestionStyle,
          requireEnglish
        )
      )
    };
  }
  throw new Error("\u627E\u4E0D\u5230 words \u6216 questions");
}
function parseLibraryImportValue(value, options = {}) {
  try {
    return { valid: true, data: normalizeLibraryImportValue(value, options) };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "JSON \u683C\u5F0F\u932F\u8AA4"
    };
  }
}

// packages/agent-contract/src/validation.ts
import { z as z2 } from "zod";
var AgentQuestionError = class extends Error {
  constructor(code, field, message, sourceId) {
    super(message);
    this.code = code;
    this.field = field;
    this.sourceId = sourceId;
  }
  code;
  field;
  sourceId;
};
function questionSourceIds(question2) {
  return question2.kind === "reading" ? [...new Set(question2.questions.map((q) => q.senseId))] : [question2.senseId];
}
function validateQuestionItems(snapshot, items, mode, requestedSenseIds, parse9, warnings = () => []) {
  const questions = [];
  const report = {
    status: "success",
    mode,
    submittedCount: items.length,
    validCount: 0,
    savedCount: 0,
    failedCount: 0,
    errors: [],
    warnings: [],
    items: [],
    requestedSenseIds: [...new Set(requestedSenseIds)],
    usedSenseIds: [],
    unusedSenseIds: []
  };
  const sources = new Map(snapshot.words.flatMap((w) => w.senses.map((s3) => [s3.id, w.word])));
  if (!items.length || items.length > 200) {
    report.status = "rejected";
    report.errors.push({ itemId: "batch", sourceIndex: 0, severity: "error", code: "invalid_batch_size", field: "items", message: "Submit 1\u2013200 independent items or passage groups per batch." });
    return { questions, report };
  }
  items.forEach((value, sourceIndex) => {
    const itemId = isRecord(value) && typeof value.itemId === "string" ? value.itemId : `item-${canonicalHash(value ?? null)}`;
    let sourceId = isRecord(value) && typeof value.senseId === "string" ? value.senseId : void 0;
    try {
      const parsed = parse9(value);
      const sourceIds = [...new Set(parsed.flatMap(questionSourceIds))];
      sourceId ??= sourceIds[0];
      const context2 = { itemId, sourceIndex, ...sourceId ? { sourceId, sourceWord: sources.get(sourceId) } : {} };
      report.warnings.push(...warnings(value).map((warning) => ({ ...context2, ...warning })));
      for (const question2 of parsed) if (snapshot.questions.some((old) => old.fingerprint === question2.fingerprint)) {
        report.warnings.push({ ...context2, severity: "warning", code: "matching_question", field: "content", message: "This set already has a question with identical content; keep or change it as the user prefers." });
      }
      questions.push(...parsed);
      report.validCount++;
      report.items.push({ itemId, sourceIds, questionIds: parsed.map((q) => q.id), valid: true });
    } catch (reason2) {
      sourceId ??= reason2 instanceof AgentQuestionError ? reason2.sourceId : void 0;
      const code = reason2 instanceof AgentQuestionError ? reason2.code : "invalid_question_structure";
      const field = reason2 instanceof AgentQuestionError ? reason2.field : reason2 instanceof z2.ZodError ? reason2.issues[0]?.path.join(".") || "output" : "output";
      report.errors.push({
        itemId,
        sourceIndex,
        ...sourceId ? { sourceId, sourceWord: sources.get(sourceId) } : {},
        severity: "error",
        code,
        field,
        message: reason2 instanceof Error ? reason2.message : "Invalid question format"
      });
      report.failedCount++;
      report.items.push({ itemId, sourceIds: sourceId ? [sourceId] : [], questionIds: [], valid: false });
    }
  });
  report.usedSenseIds = [...new Set(questions.flatMap(questionSourceIds))];
  report.unusedSenseIds = report.requestedSenseIds.filter((id) => !report.usedSenseIds.includes(id));
  report.status = report.failedCount ? report.validCount && mode === "partial" ? "partial_success" : "rejected" : "success";
  return { questions: report.status === "rejected" ? [] : questions, report };
}

// packages/agent-contract/src/generation.ts
var text3 = z3.string().trim().min(1);
var teaching2 = {
  explanation: z3.string().optional(),
  whyWrong: z3.union([
    z3.array(z3.object({ option: text3, reason: text3 })),
    z3.record(z3.string(), z3.string())
  ]).optional()
};
var source = {
  senseId: text3.optional().describe("Stable senseId of this item's source, copied exactly. Sources may be used in any order and more than once."),
  ref: text3.optional().describe("Same value as senseId (brief sources set ref = senseId); give either one. Optional when there is only one source.")
};
var blank = {
  ...source,
  usage: text3.optional().describe("A passage snippet locating the answer when it occurs more than once; optional when it occurs once."),
  answer: text3,
  ...teaching2
};
var choices = { distractors: z3.array(text3).length(3) };
function outputShape(kind) {
  const article = { title: text3, passage: text3 };
  const schema = kind === "vocabulary" ? z3.object({ items: z3.array(z3.object({ ...blank, sentence: text3, ...choices })).min(1).max(200) }) : kind === "reading" ? z3.object({ ...article, items: z3.array(z3.object({ ...source, question: text3, answer: text3, ...choices, ...teaching2 })).min(1) }) : kind === "discourse" ? z3.object({ ...article, options: z3.array(text3).length(5), unusedReason: z3.string().optional().describe("Why the unused sentence fits no gap. Each removal needs only its explanation, not per-option reasons."), removals: z3.array(z3.object({ ...source, sentence: text3, ...teaching2 })).min(1) }) : kind === "wordBank" ? z3.object({ ...article, options: z3.array(text3).length(10), optionMeanings: z3.array(z3.object({ option: text3, meaning: text3 })).optional().describe("Short Traditional Chinese meaning of every shared option, written once per set. Each blank needs only its explanation, not per-option reasons."), blanks: z3.array(z3.object(blank)).min(1) }) : z3.object({ ...article, blanks: z3.array(z3.object({ ...blank, ...choices })).min(1) });
  return schema;
}
function agentQuestionOutputSchema(kind) {
  return z3.toJSONSchema(outputShape(kind));
}
function parseAgentGeneratedQuestions(output, kind, difficulty, words, itemId) {
  const assembled = assembleGeneratedQuestions(output, kind, difficulty, words, "agent");
  if (assembled.dropped.length) throw new Error(assembled.dropped.join("\uFF1B"));
  const parsed = parseLibraryImportValue(assembled.payload, {
    questionSources: getQuestionSourceRefs(words),
    allowedDifficulty: difficulty,
    requireEnglish: false
  });
  if (!parsed.valid) throw new Error(parsed.error);
  if (parsed.data.kind !== "questions") throw new Error("Invalid question data");
  return parsed.data.questions.map((question2) => {
    const normalized2 = canonicalizeQuestion(question2.kind === "reading" ? { ...question2, wordKeys: [...new Set(question2.questions.map((q) => q.wordKey))] } : question2);
    return { ...normalized2, id: `question-${canonicalHash(itemId ? { itemId, sourceIds: normalized2.kind === "reading" ? normalized2.questions.map((q) => q.senseId) : [normalized2.senseId] } : normalized2.fingerprint)}` };
  });
}
function collectAgentGeneratedQuestions(snapshot, kind, difficulty, senseIds, output, mode) {
  const requested = senseIds ? new Set(senseIds) : void 0;
  const words = snapshot.words.map((word) => ({ ...word, senses: word.senses.filter((s3) => !requested || requested.has(s3.id)) })).filter((w) => w.senses.length);
  const slots = words.flatMap((word) => word.senses.map((sense2) => ({ word, sense: sense2 })));
  const byId = new Map(slots.map((slot) => [slot.sense.id, slot]));
  const resolve = (raw) => {
    const senseId = typeof raw.senseId === "string" ? raw.senseId : void 0;
    const ref = typeof raw.ref === "string" ? raw.ref : void 0;
    if (senseId && ref && senseId !== ref)
      throw new AgentQuestionError("source_ref_conflict", "ref", "ref and senseId point to different sources; ref is the senseId, so give only one.", senseId);
    if (!senseId && ref && !byId.has(ref))
      throw new AgentQuestionError("unknown_source", "ref", `Source ${ref} is not in this set or the requested senseIds. Copy ref exactly from the brief (it equals the senseId); it is not a position number.`, ref);
    const id = senseId ?? ref ?? (slots.length === 1 ? slots[0].sense.id : void 0);
    if (!id) throw new AgentQuestionError("missing_source", "senseId", "Give this item a senseId; it may be omitted only when there is a single source.");
    const slot = byId.get(id);
    if (!slot) throw new AgentQuestionError("unknown_source", "senseId", `Source ${id} is not in this set or the requested senseIds.`, id);
    return slot;
  };
  const rawItems = kind === "vocabulary" && isRecord(output) && Array.isArray(output.items) ? output.items : [output];
  const items = rawItems.map((item) => {
    if (!isRecord(item) || item.senseId !== void 0) return item;
    const slot = typeof item.ref === "string" ? byId.get(item.ref) : slots.length === 1 ? slots[0] : void 0;
    return slot ? { ...item, senseId: slot.sense.id } : item;
  });
  const parse9 = (value) => {
    const candidate = kind === "vocabulary" ? { items: [value] } : value;
    const shaped = outputShape(kind).parse(candidate);
    const data = shaped;
    const field = kind === "cloze" || kind === "wordBank" ? "blanks" : kind === "discourse" ? "removals" : "items";
    const entries = data[field];
    data[field] = entries.map((raw) => {
      const slot = resolve(raw);
      const answer = kind === "discourse" ? String(raw.sentence) : String(raw.answer);
      if (kind === "vocabulary" || kind === "cloze" || kind === "wordBank") {
        const prose = kind === "vocabulary" ? String(raw.sentence) : String(data.passage);
        const usage = typeof raw.usage === "string" ? raw.usage : answer;
        const location = locateUsageAnswer(prose, usage, answer, "en");
        if ("issue" in location) throw new AgentQuestionError("answer_not_locatable", "usage", location.issue, slot.sense.id);
        if (kind !== "cloze") {
          const issue = sourceWordFormIssue(slot.word.word, slot.sense.pos, answer, usage, "en");
          if (issue) {
            const other = slots.find((o2) => o2.word !== slot.word && !sourceWordFormIssue(o2.word.word, o2.sense.pos, answer, usage));
            throw new AgentQuestionError(
              "source_answer_mismatch",
              "answer",
              other ? `${issue} The answer is a form of "${other.word.word}" in this set; check whether senseId should be ${other.sense.id}.` : issue,
              slot.sense.id
            );
          }
        }
      }
      if (Array.isArray(raw.distractors)) {
        const options = [answer, ...raw.distractors].map((option) => option.trim().toLocaleLowerCase());
        const repeated = [...new Set(options.filter((option, index3) => options.indexOf(option) !== index3))];
        if (repeated.length) throw new AgentQuestionError("duplicate_options", "distractors", `Repeated options: ${repeated.join(", ")} (the answer "${answer}" counts as an option); use different distractors.`, slot.sense.id);
      }
      return { ...raw, ref: `s${slots.indexOf(slot) + 1}` };
    });
    return parseAgentGeneratedQuestions(data, kind, difficulty, words, isRecord(value) && typeof value.itemId === "string" ? value.itemId : void 0);
  };
  const range = questionLengthRange(kind, difficulty);
  return validateQuestionItems(snapshot, items, mode, senseIds ?? [], parse9, (value) => {
    const prose = isRecord(value) ? kind === "vocabulary" ? value.sentence : value.passage : void 0;
    if (typeof prose !== "string") return [];
    const actual = countEnglishWords(prose);
    return actual < range.min || actual > range.max ? [{
      severity: "warning",
      code: actual < range.min ? "prose_too_short" : "prose_too_long",
      field: kind === "vocabulary" ? "sentence" : "passage",
      message: `Length is ${actual} words; ${range.min}\u2013${range.max} is recommended. Saved anyway; follow the user's request.`,
      actual,
      recommendedMin: range.min,
      recommendedMax: range.max
    }] : [];
  });
}

// packages/agent-contract/src/index.ts
import { z as z6 } from "zod";

// src/lib/folders.ts
var UNCATEGORIZED_FOLDER_ID = "__uncategorized__";

// packages/agent-contract/src/folders.ts
import { z as z4 } from "zod";
var text4 = z4.string().trim().min(1).max(200);
var actionSchema = z4.discriminatedUnion("type", [
  z4.strictObject({ type: z4.literal("create_folder"), name: text4, parentId: text4.optional() }),
  z4.strictObject({ type: z4.literal("update_folder"), folderId: text4, name: text4.optional(), parentId: text4.nullable().optional() }),
  z4.strictObject({ type: z4.literal("delete_folder"), folderId: text4 })
]);

// packages/agent-contract/src/cloud.ts
import { z as z5 } from "zod";

// src/constants/backup.ts
var SET_SHARE_MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
var SET_SHARE_MAX_JSON_BYTES = 25 * 1024 * 1024;

// src/constants/practice.ts
var PRACTICE_QUESTION_TASKS = [
  "meaning",
  "reverse",
  ...QUESTION_KINDS
];
var PRACTICE_TASKS = [...PRACTICE_QUESTION_TASKS];
var DEFAULT_QUESTION_TASKS = [
  ...QUESTION_KINDS
];

// src/constants/storage.ts
var AI_PREFERENCES_STORAGE_KEY = "lexiro_ai_preferences";
var SYNC_JOURNAL_STORAGE_KEY = "lexiro_sync_journal";
var NAMESPACE_SCOPED_KEYS = [
  AI_PREFERENCES_STORAGE_KEY,
  SYNC_JOURNAL_STORAGE_KEY
];

// src/lib/persist.ts
var scopedKeys = new Set(NAMESPACE_SCOPED_KEYS);

// src/lib/sync-journal.ts
var queue = Promise.resolve();

// packages/agent-contract/src/cloud.ts
var record = z5.strictObject({
  type: z5.enum(["folder", "set", "membership", "word", "question"]),
  recordKey: z5.string().min(1),
  deleted: z5.boolean(),
  updatedAt: z5.iso.datetime({ offset: true, local: true }),
  payload: z5.record(z5.string(), z5.unknown()).nullable()
});
var practice = z5.object({
  updatedAt: z5.iso.datetime({ offset: true, local: true }),
  snapshot: z5.record(z5.string(), z5.unknown()).nullable()
});

// packages/agent-contract/src/index.ts
var text5 = z6.string().trim().min(1).max(1e4);
var sense = z6.object({
  id: text5.optional(),
  pos: text5,
  meaningZh: text5,
  examples: z6.array(text5).max(20).default([]),
  supplementary: z6.boolean().optional(),
  description: z6.string().trim().max(2e3).optional()
});
var wordInput = z6.object({
  wordKey: text5.optional(),
  word: text5.max(200),
  starred: z6.boolean().optional(),
  senses: z6.array(sense).min(1).max(20)
});
var mutation = z6.discriminatedUnion("type", [
  z6.strictObject({ type: z6.literal("rename_set"), setName: text5.max(200) }),
  z6.strictObject({ type: z6.literal("move_set"), folderId: text5 }),
  z6.strictObject({
    type: z6.literal("put_words"),
    words: z6.array(wordInput).min(1).max(200)
  }),
  z6.strictObject({
    type: z6.literal("mark_words"),
    wordKeys: z6.array(text5).min(1).max(200),
    starred: z6.boolean()
  }),
  z6.strictObject({
    type: z6.literal("delete_words"),
    wordKeys: z6.array(text5).min(1).max(200)
  }),
  z6.strictObject({
    type: z6.literal("put_questions"),
    questions: z6.array(z6.unknown()).min(1).max(200),
    mode: z6.enum(["atomic", "partial"]).default("partial")
  }),
  z6.strictObject({
    type: z6.literal("delete_questions"),
    questionIds: z6.array(text5).min(1).max(100)
  }),
  z6.strictObject({
    type: z6.literal("generated_questions"),
    kind: z6.enum(["vocabulary", "cloze", "wordBank", "discourse", "reading"]),
    difficulty: z6.union([z6.literal(1), z6.literal(2), z6.literal(3)]),
    senseIds: z6.array(text5).min(1).optional(),
    output: z6.unknown(),
    mode: z6.enum(["atomic", "partial"]).default("partial")
  }),
  z6.strictObject({ type: z6.literal("delete_set") })
]);
var snapshotSchema = z6.strictObject({
  set: z6.strictObject({
    id: text5,
    setName: text5.max(200),
    folderId: text5,
    order: z6.number().finite().optional(),
    createdAt: z6.iso.datetime(),
    updatedAt: z6.iso.datetime()
  }),
  words: z6.array(
    z6.strictObject({
      wordKey: text5,
      word: text5.max(200),
      starred: z6.boolean().optional(),
      updatedAt: z6.iso.datetime(),
      senses: z6.array(
        z6.strictObject({
          id: text5,
          pos: text5,
          meaningZh: text5,
          examples: z6.array(text5),
          supplementary: z6.boolean(),
          description: text5.optional()
        })
      ).min(1)
    })
  ),
  memberships: z6.array(
    z6.strictObject({ wordKey: text5, senseIds: z6.array(text5).min(1) })
  ),
  questions: z6.array(z6.unknown())
});
function createAgentSet(setId, setName, folderId = UNCATEGORIZED_FOLDER_ID) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    set: {
      id: setId,
      setName: text5.max(200).parse(setName),
      folderId,
      createdAt: now,
      updatedAt: now
    },
    words: [],
    memberships: [],
    questions: []
  };
}
function selectedWords(snapshot, ids) {
  const wanted = new Set(ids);
  const words = snapshot.words.map((word) => ({
    ...word,
    senses: word.senses.filter((s3) => wanted.has(s3.id))
  })).filter((w) => w.senses.length);
  if (words.reduce((n3, w) => n3 + w.senses.length, 0) !== wanted.size)
    throw new Error("Source senses must belong to this set");
  return words;
}
function agentGenerationBrief(snapshot, kind, difficulty, senseIds) {
  const words = selectedWords(
    snapshot,
    senseIds ?? snapshot.words.flatMap((w) => w.senses.map((s3) => s3.id))
  );
  const sources = words.flatMap(
    (w) => w.senses.map((s3) => ({
      ref: s3.id,
      word: w.word,
      pos: s3.pos,
      meaningZh: s3.meaningZh,
      senseId: s3.id,
      ...s3.examples[0] ? { knownExample: s3.examples[0] } : {}
    }))
  );
  return {
    kind,
    difficulty,
    sources,
    instructions: `You write and submit the content yourself; the service never calls a model API. Follow the user's request for which words, how many items, length, difficulty, order and explanations. sources are what you may use: you need not use all of them, may write several items for one source, and need not write one item per source. Bind each item to its source with senseId (brief sources set ref = senseId, so either works); never bind by array position. With a single source, senseId may be omitted. Keep the answer in the prose and name the exact span to blank in answer; add usage only when that span occurs more than once. explanation, whyWrong and reading skill/evidence are optional. See outputSchema for the format; JSON key order does not matter. Ordinary multiple-choice items need three distractors; shared option banks have ten options for wordBank and five for discourse. Length outside the recommended range is only a warning; wrong sources, unlocatable answers and invalid options are errors. mode defaults to partial, which saves valid independent items and reports per-item errors; atomic saves nothing if any error occurs. Passage groups are saved or rejected as a whole. validate checks without writing. put_questions can add or edit complete stored questions without a brief. Difficulty, style and similarity are your judgment; follow the user on whether inflected or derived forms share items. Source entries are never removed.`,
    outputSchema: agentQuestionOutputSchema(kind)
  };
}
export {
  agentGenerationBrief,
  collectAgentGeneratedQuestions,
  createAgentSet
};

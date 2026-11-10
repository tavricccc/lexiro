// A clickable mock of Lexiro with invented data. It shows what every screen looks like and how it
// behaves; it holds no product logic. Screens are addressed by hash so each can be opened directly.

const sets = [
  { id: "gsat", created: "2026/03/02", name: "學測核心 7000", hue: "mint", icon: "graduation-cap", words: 1284, questions: 96, known: 62, folder: "學測" },
  { id: "toeic", created: "2026/06/18", name: "TOEIC Business", hue: "sky", icon: "briefcase", words: 620, questions: 48, known: 18, folder: "多益" },
  { id: "read", created: "2026/09/27", name: "閱讀測驗錯題", hue: "rose", icon: "bookmark-simple", words: 48, questions: 22, known: 35, folder: "學測" },
  { id: "travel", created: "2026/10/05", name: "旅行前要記的字", hue: "amber", icon: "airplane-tilt", words: 86, questions: 0, known: 80, folder: "" },
  { id: "news", created: "2026/11/01", name: "The Economist 筆記", hue: "violet", icon: "newspaper", words: 212, questions: 30, known: 44, folder: "" },
];
const words = [
  ["abandon", "v.", "拋棄；放棄", 3], ["ambiguous", "adj.", "模稜兩可的", 1], ["benevolent", "adj.", "仁慈的；樂善好施的", 2],
  ["candid", "adj.", "坦率的", 3], ["deteriorate", "v.", "惡化", 1], ["eloquent", "adj.", "口才好的；有說服力的", 2],
  ["feasible", "adj.", "可行的", 3], ["gratitude", "n.", "感激", 3], ["hinder", "v.", "阻礙", 0],
  ["inevitable", "adj.", "不可避免的", 1], ["jeopardize", "v.", "危及", 0], ["meticulous", "adj.", "一絲不苟的", 2],
  ["notorious", "adj.", "惡名昭彰的", 2], ["obsolete", "adj.", "過時的", 3], ["resilient", "adj.", "有韌性的；能迅速恢復的", 1],
  ["ubiquitous", "adj.", "無所不在的", 0],
];
const kinds = [["英選中", 91, "mint"], ["詞彙題", 84, "sky"], ["綜合測驗", 72, "violet"], ["文意選填", 66, "amber"], ["篇章結構", 58, "rose"], ["閱讀測驗", 77, "sky"]];
const players = [["Tavric", "mint", 2840], ["佳穎", "rose", 2610], ["Kevin", "sky", 2280], ["小安", "amber", 1930]];

const icon = (name, weight = "") => `<i class="ph${weight ? "-" + weight : ""} ph-${name}"></i>`;
// One small ring says how well something is known: the arc grows and its colour moves amber, sky, mint.
const dial = (pct, label) => `<svg class="dial" data-t="${pct >= 67 ? 3 : pct >= 34 ? 2 : pct > 0 ? 1 : 0}" viewBox="0 0 20 20" role="img" aria-label="${label}"><circle cx="10" cy="10" r="7"/><circle class="arc" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="${pct} 100"/></svg>`;
const lv = (n) => dial([0, 33, 66, 100][n], `熟悉度 ${n} / 3`);
const each = (list, fn) => list.map(fn).join("");
const avatarBtn = `<button class="btn btn-icon btn-glass only-phone" data-open="me" aria-label="我的"><span class="avatar" style="--av:calc(var(--h-control) - 8px)">T</span></button>`;
const back = (href, label) => `<a class="btn btn-icon btn-glass" href="${href}" aria-label="返回${label}">${icon("caret-left", "bold")}</a>`;

const setCard = (s) => `
  <a class="tile set hue-${s.hue}" href="#/set">
    <div class="between"><span class="glyph">${icon(s.icon)}</span>
      <button class="btn btn-icon btn-ghost btn-compact" data-menu="set" aria-label="「${s.name}」的更多動作">${icon("dots-three", "bold")}</button></div>
    <div class="name cut">${s.name}</div>
    <div class="meta"><span class="latin muted">${s.created}</span>${dial(s.known, `已熟悉 ${s.known}%`)}</div>
  </a>`;
const wordRow = ([hw, pos, zh, l]) => `
  <a class="w" href="#/word"><span class="head"><span class="hw">${hw}</span><span class="pos">${pos}</span><span class="zh">${zh}</span></span>${lv(l)}
    <button class="btn btn-icon btn-ghost btn-compact" aria-label="朗讀 ${hw}">${icon("speaker-high")}</button></a>`;
const weekDots = (hue) => `<div class="week hue-${hue}">${each(["一", "二", "三", "四", "五", "六", "日"], (d, i) =>
  `<span class="${i < 4 ? "on" : i === 4 ? "now" : ""}"><b>${i < 4 ? icon("check", "bold") : ""}</b>${d}</span>`)}</div>`;

const screens = {
  home: () => `
    <header class="bar-top"><h1 class="t-page">今天</h1><div class="acts">${avatarBtn}</div></header>
    <div class="bento b4 pop-in">
      <section class="hero wide" style="--span:7;--rows:2">
        <div class="hero-top">
          <div><p class="muted" style="font-weight:600">今日目標</p><p class="fig">12<small>/ 20 題</small></p></div>
          <div class="ring ring-xl" style="--v:60"><i class="ph ph-target" style="font-size:34px;color:var(--mint)"></i></div>
        </div>
        <div class="hero-acts">
          <button class="btn btn-lg btn-mint" data-open="setup">${icon("play")}開始練習</button>
          <a class="btn btn-lg btn-onforest" href="#/practice">接續上次<span class="latin" style="opacity:.7">8/20</span></a>
        </div>
      </section>
      <a class="tile tile-hue hue-amber" href="#/progress" style="--span:5;--i:1">
        <div class="stack" style="gap:var(--sp-4)">
          <div class="between"><span class="glyph">${icon("fire")}</span><p class="fig">7<small>天連續</small></p></div>
          ${weekDots("amber")}
        </div>
      </a>
      <button class="tile tile-hue hue-rose" data-open="setup" style="--span:5;--i:2">
        <div class="stack" style="gap:var(--sp-4)">
          <div class="between"><span class="glyph">${icon("arrow-counter-clockwise", "bold")}</span><p class="fig">14<small>個要再看</small></p></div>
          <div class="words-peek"><span>ubiquitous</span><span>hinder</span><span>jeopardize</span><span>+11</span></div>
        </div>
      </button>
    </div>
    <div class="sec"><h2>接著練</h2><a href="#/library">全部</a></div>
    <div class="scroller">${each(sets.slice(0, 4), setCard)}</div>
    <div class="sec"><h2>換個方式</h2></div>
    <div class="bento b4">
      <div class="tile flip half" id="flip" style="--span:4" role="button" tabindex="0">
        <div class="between"><span class="chip">隨機一個字</span><button class="btn btn-icon btn-ghost btn-compact" aria-label="朗讀">${icon("speaker-high")}</button></div>
        <div><p class="word">resilient</p><p class="back">有韌性的；能迅速恢復的</p><p class="hint muted t-sub">點一下看意思</p></div>
      </div>
      <a class="tile tile-hue hue-violet half" href="#/rooms" style="--span:4">
        <div class="stack" style="gap:var(--sp-5);min-height:148px;align-content:space-between">
          <span class="glyph">${icon("lightning")}</span>
          <div><p style="font-size:1.375rem;font-weight:700;line-height:1.25">找朋友對戰</p><p class="muted t-sub" style="font-weight:600">最多 8 人</p></div>
        </div>
      </a>
      <a class="tile wide" href="#/progress" style="--span:4">
        <div class="stack" style="gap:var(--sp-4)">
          <div class="between"><b>本週正確率</b><span class="fig" style="font-size:1.75rem">82<small>%</small></span></div>
          <div class="kinds">${each(kinds.slice(0, 3), ([n, v, h]) => `<div class="k hue-${h}"><span>${n}</span><div class="meter" style="--v:${v}%"><i></i></div><b>${v}%</b></div>`)}</div>
        </div>
      </a>
    </div>`,

  library: () => `
    <header class="bar-top"><h1 class="t-page">我的單字</h1><div class="acts">
      <button class="btn btn-icon btn-glass" aria-label="排序">${icon("arrows-down-up", "bold")}</button>
      <button class="btn btn-icon btn-primary" data-menu="add" aria-label="新增">${icon("plus", "bold")}</button>${avatarBtn}</div></header>
    <label class="search" style="margin-bottom:var(--sp-4)">${icon("magnifying-glass", "bold")}<input placeholder="搜尋單字集、單字或中文" aria-label="搜尋"></label>
    <div class="folders">
      <button class="pill" aria-pressed="true">全部 <b>5</b></button>
      <button class="pill">${icon("folder-simple")}學測 <b>2</b></button>
      <button class="pill">${icon("folder-simple")}多益 <b>1</b></button>
      <button class="pill">未分類 <b>2</b></button>
    </div>
    <div class="grid pop-in">${each(sets, setCard)}
      <a class="dashed" href="#/new">${icon("plus", "bold")}新增單字集</a></div>`,

  set: () => `
    <header class="bar-top">${back("#/library", "我的單字")}<span class="grow"></span><div class="acts">
      <button class="btn btn-icon btn-glass" aria-label="分享">${icon("share-fat")}</button>
      <button class="btn btn-icon btn-glass" data-menu="set" aria-label="更多動作">${icon("dots-three", "bold")}</button></div></header>
    <section class="cover hue-mint">
      <div class="between" style="align-items:flex-start">
        <div class="stack" style="gap:var(--sp-2)"><span class="chip" style="background:rgb(255 255 255/55%);color:inherit;justify-self:start">${icon("folder-simple")}學測</span><h1>學測核心 7000</h1></div>
        <div class="ring" style="--v:62"><b class="latin">62%</b></div>
      </div>
      <div class="facts"><div><b>1,284</b><span>單字</span></div><div><b>96</b><span>題目</span></div><div><b>796</b><span>已熟悉</span></div><div><b>14</b><span>要再看</span></div></div>
      <div class="hero-acts"><button class="btn btn-lg btn-ink" data-open="setup">${icon("play")}開始練習</button>
        <a class="btn btn-lg btn-veil" href="#/new">${icon("plus", "bold")}加單字</a></div>
    </section>
    <div class="toolbar">
      <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="words">單字 <b>1,284</b></button><button role="tab" aria-selected="false" data-tab="questions">題目 <b>96</b></button></div>
      <label class="search">${icon("magnifying-glass", "bold")}<input placeholder="搜尋本集" aria-label="搜尋本集"></label>
    </div>
    <div data-pane="words" class="sheet-list cols">${each(words, wordRow)}</div>
    <div data-pane="questions" hidden class="grid">${each([["詞彙題", 40, "sky", "text-aa"], ["綜合測驗", 18, "violet", "article"], ["文意選填", 14, "amber", "list-checks"], ["篇章結構", 8, "rose", "rows"], ["閱讀測驗", 16, "mint", "book-open-text"]],
      ([n, c, h, ic]) => `<a class="tile hue-${h}" href="#/practice"><div class="rowx"><span class="glyph">${icon(ic)}</span><b class="grow">${n}</b><span class="latin muted" style="font-weight:600">${c} 題</span>${icon("caret-right", "bold")}</div></a>`)}</div>`,

  word: () => `
    <header class="bar-top">${back("#/set", "單字集")}<span class="grow"></span><div class="acts">
      <button class="btn btn-icon btn-glass" aria-label="編輯">${icon("pencil-simple")}</button>
      <button class="btn btn-icon btn-glass" aria-label="更多動作">${icon("dots-three", "bold")}</button></div></header>
    <div class="split">
      <div class="stack">
        <div class="word-hero">
          <div class="rowx"><span class="chip chip-accent">學測核心 7000</span>${lv(1)}</div>
          <div class="rowx" style="gap:var(--sp-4)"><h1>resilient</h1><button class="btn btn-icon btn-primary" aria-label="朗讀 resilient">${icon("speaker-high")}</button></div>
        </div>
        <section class="tile sense">
          <div class="rowx"><span class="chip latin" style="font-style:italic">adj.</span><p class="zh grow">有韌性的；能迅速恢復的</p></div>
          <ul><li>形容人在挫折後很快站起來</li><li>常搭配 remain、prove、be resilient to</li></ul>
          <div class="ex"><p>Children are often more <mark>resilient</mark> than adults expect.</p><p class="muted t-sub">孩子往往比大人以為的更有韌性。</p></div>
          <div class="ex"><p>The local economy proved <mark>resilient</mark> to the downturn.</p><p class="muted t-sub">當地經濟在不景氣中展現了韌性。</p></div>
        </section>
        <section class="tile sense">
          <div class="rowx"><span class="chip latin" style="font-style:italic">adj.</span><p class="zh grow">有彈性的；能回復原狀的</p></div>
          <div class="ex"><p>The soles are made of a <mark>resilient</mark> rubber.</p><p class="muted t-sub">鞋底用的是有彈性的橡膠。</p></div>
        </section>
      </div>
      <div class="stack">
        <section class="tile"><div class="stack" style="gap:var(--sp-4)">
          <b>答題紀錄</b>
          <div class="trio" style="gap:var(--sp-3)"><div><p class="fig" style="font-size:1.75rem">9</p><p class="muted t-sub">次</p></div><div><p class="fig" style="font-size:1.75rem">5</p><p class="muted t-sub">答對</p></div><div><p class="fig" style="font-size:1.75rem">3<small>天前</small></p><p class="muted t-sub">上次</p></div></div>
          <div class="steps" aria-label="最近九次">${each([1, 0, 1, 1, 0, 0, 1, 0, 1], (v) => `<i class="${v ? "ok" : "no"}"></i>`)}</div>
        </div></section>
        <section class="tile"><div class="stack" style="gap:var(--sp-3)"><b>用到這個字的題目</b>
          <a class="qrow" href="#/practice" style="padding-inline:0"><span class="glyph hue-sky" style="width:36px;height:36px;border-radius:11px">${icon("text-aa")}</span><span class="grow">詞彙題</span><span class="latin muted">3</span>${icon("caret-right", "bold")}</a>
          <a class="qrow" href="#/practice" style="padding-inline:0"><span class="glyph hue-amber" style="width:36px;height:36px;border-radius:11px">${icon("list-checks")}</span><span class="grow">文意選填</span><span class="latin muted">1</span>${icon("caret-right", "bold")}</a>
        </div></section>
      </div>
    </div>`,

  practice: () => `
    <div class="focus">
      <div class="focus-top">
        <a class="btn btn-icon btn-glass" href="#/home" aria-label="退出練習">${icon("x", "bold")}</a>
        <div class="steps" aria-label="第 8 題，共 12 題">${each([1, 1, 0, 1, 1, 1, 0, 2, 3, 3, 3, 3], (v) => `<i class="${["no", "ok", "now", ""][v]}"></i>`)}</div>
        <button class="btn btn-icon btn-glass" aria-label="稍後複習" aria-pressed="false">${icon("flag-banner")}</button>
      </div>
      <div class="focus-body">
        <div class="prompt">
          <div class="rowx"><span class="chip">英選中</span><span class="chip">學測核心 7000</span></div>
          <div class="rowx" style="gap:var(--sp-4)"><h1>ubiquitous</h1><button class="btn btn-icon btn-glass" aria-label="朗讀 ubiquitous">${icon("speaker-high")}</button></div>
        </div>
        <div class="opts" role="radiogroup" aria-label="選擇答案">${each(["惡名昭彰的", "無所不在的", "過時的", "模稜兩可的"], (t, i) =>
          `<button class="opt" role="radio" aria-checked="false" data-i="${i}"><kbd>${"ABCD"[i]}</kbd><span class="grow">${t}<span class="why" hidden>${["notorious", "", "obsolete", "ambiguous"][i]}</span></span></button>`)}</div>
        <div id="verdict"></div>
      </div>
      <div class="focus-foot">
        <div><button class="btn btn-lg btn-glass" id="skip">跳過</button><button class="btn btn-lg btn-ink" id="confirm" disabled>確認答案</button></div>
        <p class="keys"><span><b>1</b>–<b>4</b> 選擇</span><span><b>Enter</b> 確認</span><span><b>←</b> 上一題</span></p>
      </div>
    </div>`,

  cloze: () => `
    <div class="focus">
      <div class="focus-top">
        <a class="btn btn-icon btn-glass" href="#/home" aria-label="退出練習">${icon("x", "bold")}</a>
        <div class="steps">${each([1, 1, 2, 3, 3, 3], (v) => `<i class="${["no", "ok", "now", ""][v]}"></i>`)}</div>
        <button class="btn btn-icon btn-glass" aria-label="稍後複習">${icon("flag-banner")}</button>
      </div>
      <div class="focus-body" style="max-width:1120px;align-content:start">
        <div class="split" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))">
          <article class="tile" style="font-family:var(--font-latin);font-size:1.0625rem;line-height:1.75;font-weight:500">
            <div class="rowx" style="margin-bottom:var(--sp-3)"><span class="chip">綜合測驗</span></div>
            Smartphones have become so <b class="chip chip-positive">ubiquitous</b> that it is hard to imagine daily life without them. Yet researchers warn that constant notifications may <b class="chip chip-positive">hinder</b> our ability to focus. One study found that students who kept their phones in another room performed <b class="chip" style="background:var(--ink);color:var(--surface)">3</b> better on memory tasks than those who kept them on the desk. The effect was <b class="chip">4</b> even when the phones were switched off.
          </article>
          <div class="stack">
            <div class="opts" style="grid-template-columns:1fr" role="radiogroup">${each(["slightly", "significantly", "reluctantly", "randomly"], (t, i) =>
              `<button class="opt latin" role="radio" aria-checked="${i === 1}" data-i="${i}"><kbd>${"ABCD"[i]}</kbd><span class="grow">${t}</span></button>`)}</div>
          </div>
        </div>
      </div>
      <div class="focus-foot"><div><button class="btn btn-lg btn-glass">跳過</button><button class="btn btn-lg btn-ink">確認答案</button></div></div>
    </div>`,

  result: () => `
    <div class="result pop-in">
      <section class="hero">
        <div class="confetti">${each([...Array(22)], (_, i) => `<i style="--x:${(i * 37) % 100}%;--c:${["#8ee0b4", "#f39a1e", "#e0559b", "#2f8cf0", "#7a5cf0"][i % 5]};--t:${2.6 + (i % 5) * 0.5}s;--d:${-(i % 7) * 0.45}s"></i>`)}</div>
        <div class="ring" style="--v:85"><div><p class="fig" style="font-size:3.5rem">17</p><p class="muted" style="font-weight:600">/ 20 題</p></div></div>
        <div class="rowx" style="justify-content:center;flex-wrap:wrap">
          <span class="chip" style="background:rgb(255 255 255/12%);color:var(--on-forest)">${icon("fire")}連續 8 天</span>
          <span class="chip" style="background:var(--mint);color:var(--mint-ink)">${icon("target")}今日目標達成</span>
        </div>
      </section>
      <div class="trio">
        <div class="tile tile-hue hue-mint"><p class="fig">85<small>%</small></p><p class="muted t-sub" style="font-weight:600">正確率</p></div>
        <div class="tile tile-hue hue-sky"><p class="fig">4:12</p><p class="muted t-sub" style="font-weight:600">用時</p></div>
        <div class="tile tile-hue hue-amber"><p class="fig">+6</p><p class="muted t-sub" style="font-weight:600">新熟悉</p></div>
      </div>
      <div class="sec" style="margin-bottom:0"><h2>答錯的 3 題</h2></div>
      <div class="sheet-list">${each([words[15], words[8], words[10]], wordRow)}</div>
      <div class="hero-acts" style="justify-content:center;margin-top:var(--sp-3)">
        <a class="btn btn-lg btn-primary" href="#/practice">${icon("arrow-counter-clockwise", "bold")}重做錯題</a>
        <a class="btn btn-lg btn-glass" href="#/home">回到今天</a>
      </div>
    </div>`,

  progress: () => `
    <header class="bar-top"><h1 class="t-page">進度</h1><div class="acts">${avatarBtn}</div></header>
    <div class="trio pop-in" style="margin-bottom:var(--gap)">
      <div class="tile tile-hue hue-amber"><span class="glyph" style="margin-bottom:var(--sp-3)">${icon("fire")}</span><p class="fig">7<small>天</small></p><p class="muted t-sub" style="font-weight:600">連續</p></div>
      <div class="tile tile-hue hue-mint"><span class="glyph" style="margin-bottom:var(--sp-3)">${icon("check-fat")}</span><p class="fig">1,952</p><p class="muted t-sub" style="font-weight:600">已熟悉</p></div>
      <div class="tile tile-hue hue-sky"><span class="glyph" style="margin-bottom:var(--sp-3)">${icon("crosshair")}</span><p class="fig">82<small>%</small></p><p class="muted t-sub" style="font-weight:600">本週正確率</p></div>
    </div>
    <div class="cols-3 stack">
      <section class="tile span-2"><div class="stack" style="gap:var(--sp-4)">
        <div class="between"><b>每天的練習</b><span class="rowx muted t-sub" style="font-weight:600;gap:4px">少<i class="hk" data-v="0"></i><i class="hk" data-v="1"></i><i class="hk" data-v="2"></i><i class="hk" data-v="3"></i><i class="hk" data-v="4"></i>多</span></div>
        <div class="heat">${each([...Array(210)], (_, i) => `<i data-v="${i > 205 ? 0 : [0, 1, 2, 0, 3, 1, 4, 2, 0, 1, 3, 2, 4, 1][(i * 7 + (i >> 2)) % 14]}"></i>`)}</div>
      </div></section>
      <section class="tile"><div class="stack" style="gap:var(--sp-4)">
        <div class="between"><b>每日目標</b><button class="btn btn-compact btn-secondary" data-open="me">20 題</button></div>
        <div class="rowx" style="gap:var(--sp-5)"><div class="ring ring-paper" style="--v:60;--size:88px;--w:10px"><b class="latin">60%</b></div><p class="fig">12<small>/ 20</small></p></div>
      </div></section>
      <section class="tile span-2"><div class="stack" style="gap:var(--sp-4)">
        <b>各題型正確率</b>
        <div class="kinds">${each(kinds, ([n, v, h]) => `<div class="k hue-${h}"><span>${n}</span><div class="meter" style="--v:${v}%"><i></i></div><b>${v}%</b></div>`)}</div>
      </div></section>
      <section class="tile"><div class="stack" style="gap:var(--sp-4)">
        <b>單字熟悉度</b>
        <div class="dist"><i style="flex:1952;background:var(--hue-mint)"></i><i style="flex:214;background:var(--hue-sky)"></i><i style="flex:62;background:var(--hue-amber)"></i><i style="flex:22;background:var(--fill-pressed)"></i></div>
        <div class="legend"><span style="--c:var(--hue-mint)">熟悉 <b>1,952</b></span><span style="--c:var(--hue-sky)">快了 <b>214</b></span><span style="--c:var(--hue-amber)">要再看 <b>62</b></span><span style="--c:var(--fill-pressed)">沒練過 <b>22</b></span></div>
      </div></section>
    </div>
    <div class="sec"><h2>最常答錯</h2><button class="btn btn-compact btn-secondary" data-open="setup">${icon("play")}練這些</button></div>
    <div class="sheet-list cols">${each(words.filter((w) => w[3] < 2), wordRow)}</div>`,

  rooms: () => `
    <header class="bar-top"><h1 class="t-page">對戰</h1><div class="acts">${avatarBtn}</div></header>
    <div class="duo pop-in">
      <section class="tile tile-hue hue-violet"><div class="stack" style="gap:var(--sp-5)">
        <div class="rowx"><span class="glyph">${icon("sign-in", "bold")}</span><b style="font-size:1.375rem">加入房間</b></div>
        <div class="code" role="group" aria-label="6 碼房號">${each([..."K7"], (c) => `<input maxlength="1" value="${c}" aria-label="房號">`)}${each([...Array(4)], () => `<input maxlength="1" aria-label="房號">`)}</div>
        <a class="btn btn-lg btn-ink" href="#/room" style="justify-self:start;min-width:160px">加入</a>
      </div></section>
      <section class="hero"><div class="stack" style="gap:var(--sp-5);align-content:space-between;height:100%">
        <div class="rowx"><span class="glyph" style="background:rgb(255 255 255/12%);color:var(--mint)">${icon("lightning")}</span><b style="font-size:1.375rem">開新房間</b></div>
        <div class="rowx">${each(players, ([n, h]) => `<span class="avatar hue-${h}" style="margin-inline-end:-18px;box-shadow:0 0 0 3px var(--forest)">${n[0]}</span>`)}<span class="muted" style="margin-inline-start:26px;font-weight:600">最多 8 人</span></div>
        <a class="btn btn-lg btn-mint" href="#/room" style="justify-self:start;min-width:160px">選題目開房</a>
      </div></section>
    </div>
    <div class="sec"><h2>最近的對戰</h2></div>
    <div class="sheet-list">${each([["學測核心 7000", "昨天", 1, 4], ["TOEIC Business", "3 天前", 2, 3], ["閱讀測驗錯題", "上週", 1, 2]], ([n, d, r, c]) =>
      `<div class="qrow"><span class="glyph hue-${r === 1 ? "amber" : "sky"}" style="width:40px;height:40px">${icon(r === 1 ? "trophy" : "medal")}</span><span class="grow"><b>${n}</b></span><span class="muted">${d}</span><span class="latin" style="font-weight:700">第 ${r} 名<span class="muted" style="font-weight:500"> / ${c}</span></span></div>`)}</div>`,

  room: () => `
    <header class="bar-top">${back("#/rooms", "對戰")}<span class="grow"></span><div class="acts"><button class="btn btn-glass">離開</button></div></header>
    <div class="stack pop-in" style="max-width:860px;margin-inline:auto;justify-items:stretch">
      <section class="hero" style="justify-items:center;text-align:center;padding-block:var(--sp-8)">
        <p class="muted" style="font-weight:600">房號</p><p class="big-code">K7M2QX</p>
        <div class="hero-acts"><button class="btn btn-onforest">${icon("copy")}複製</button><button class="btn btn-onforest">${icon("share-fat")}分享</button></div>
      </section>
      <div class="sec" style="margin-bottom:0"><h2>玩家 <span class="latin muted">4 / 8</span></h2></div>
      <div class="players">${each(players, ([n, h], i) => `<div class="player"><span class="avatar hue-${h}">${n[0]}</span><span class="grow cut">${n}</span>${i === 0 ? `<span class="chip">房主</span>` : ""}</div>`)}
        ${each([...Array(2)], () => `<div class="player open"><span class="avatar" style="background:var(--fill-hover);color:var(--ink-faint)">${icon("plus", "bold")}</span>等待加入</div>`)}</div>
      <div class="tile"><div class="between"><span class="rowx"><span class="glyph hue-mint">${icon("graduation-cap")}</span><span><b>學測核心 7000</b><br><span class="muted t-sub latin">15 題 · 每題 20 秒</span></span></span><button class="btn btn-secondary btn-compact">更改</button></div></div>
      <a class="btn btn-lg btn-primary" href="#/duel" style="justify-self:center;min-width:240px">${icon("play")}開始對戰</a>
    </div>`,

  duel: () => `
    <div class="focus">
      <div class="focus-top">
        <a class="btn btn-icon btn-glass" href="#/rooms" aria-label="離開房間">${icon("x", "bold")}</a>
        <div class="steps">${each([...Array(15)], (_, i) => `<i class="${i < 6 ? "ok" : i === 6 ? "now" : ""}"></i>`)}</div>
        <div class="ring timer" style="--v:65"><span>13</span></div>
      </div>
      <div class="focus-body" style="max-width:1120px;align-content:start">
        <div class="split">
          <div class="stack" style="gap:var(--sp-6)">
            <div class="prompt"><span class="chip">詞彙題</span>
              <p class="stem">The new policy was so <u>&nbsp;</u> that even the experts disagreed on what it meant.</p></div>
            <div class="opts" role="radiogroup">${each(["feasible", "ambiguous", "candid", "obsolete"], (t, i) =>
              `<button class="opt latin" role="radio" aria-checked="${i === 1}"><kbd>${"ABCD"[i]}</kbd><span class="grow">${t}</span></button>`)}</div>
          </div>
          <div class="board">${each(players, ([n, h, p], i) => `<div class="p ${i === 0 ? "me" : ""}"><span class="rank">${i + 1}</span><span class="avatar hue-${h}" style="--av:32px">${n[0]}</span><span class="grow cut">${n}</span>${i === 2 ? `<span class="chip">作答中</span>` : icon("check-circle")}<span class="pts">${p.toLocaleString()}</span></div>`)}</div>
        </div>
      </div>
      <div class="focus-foot"><div><button class="btn btn-lg btn-ink" style="flex:1">送出</button></div></div>
    </div>`,

  new: () => `
    <header class="bar-top">${back("#/library", "我的單字")}<h1 class="t-page" style="margin-inline-start:var(--sp-2)">新增單字集</h1></header>
    <div class="stack" style="max-width:920px">
      <section class="tile"><div class="entry-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,220px)">
        <div class="field"><label for="n1">名稱</label><input id="n1" class="input input-xl" value="旅行前要記的字"></div>
        <div class="field"><label for="n2">資料夾</label><div class="field-select"><select id="n2" class="input"><option>未分類</option><option>學測</option><option>多益</option></select><svg class="i" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></div></div>
      </div></section>
      ${each([["itinerary", "n.", "行程"], ["", "", ""]], ([a, b, c], i) => `
      <section class="tile entry">
        <div class="between"><span class="chip latin">${i + 1}</span><button class="btn btn-icon btn-ghost btn-compact" aria-label="移除這個單字">${icon("trash")}</button></div>
        <div class="entry-grid">
          <div class="field"><label>英文單字</label><input class="input input-xl" value="${a}" placeholder="wander"></div>
          <div class="field"><label>詞性</label><input class="input latin" value="${b}" placeholder="v."></div>
          <div class="field"><label>中文意思</label><input class="input" value="${c}" placeholder="漫遊、閒逛"></div>
        </div>
        <div class="field"><label>例句</label><input class="input latin" value="${a ? "Our itinerary includes three days in Kyoto." : ""}" placeholder="輸入一個英文例句"></div>
        <button class="btn btn-compact btn-secondary" style="justify-self:start">${icon("plus", "bold")}再加一個詞義</button>
      </section>`)}
      <button class="dashed">${icon("plus", "bold")}再加一個單字</button>
    </div>
    <div class="savebar frost"><span class="rowx muted t-sub" style="padding-inline:var(--sp-3);font-weight:600">${icon("check-circle")}已自動儲存</span><a class="btn btn-primary" href="#/set">完成</a></div>`,

  empty: () => `
    <header class="bar-top"><h1 class="t-page">今天</h1><div class="acts">${avatarBtn}</div></header>
    <section class="tile empty">
      <img src="/public/illustrations/open-doodles-reading.svg" alt="">
      <div class="stack" style="gap:var(--sp-2)"><h2 class="t-section">先加入一組單字</h2></div>
      <div class="hero-acts" style="justify-content:center"><a class="btn btn-lg btn-primary" href="#/new">${icon("plus", "bold")}新增單字集</a><button class="btn btn-lg btn-glass">${icon("download-simple", "bold")}匯入</button></div>
    </section>`,
};

const sheets = {
  setup: () => `
    <div class="sheet" role="dialog" aria-label="開始練習">
      <div class="sheet-head"><h2>練什麼</h2><button class="btn btn-icon btn-glass" data-close aria-label="關閉">${icon("x", "bold")}</button></div>
      <div class="modes">
        <button class="mode" aria-pressed="true"><span class="glyph hue-mint">${icon("cards")}</span><div><b>單字複習</b><br><span class="latin">1,284 字</span></div></button>
        <button class="mode" aria-pressed="false"><span class="glyph hue-violet">${icon("exam")}</span><div><b>學測題型</b><br><span class="latin">96 題</span></div></button>
      </div>
      <p class="label">題型</p>
      <div class="chips">${each(["英選中", "詞彙題", "綜合測驗", "文意選填", "篇章結構", "閱讀測驗"], (n, i) => `<button class="chip" style="height:36px;padding-inline:14px" aria-pressed="${i === 0}">${n}</button>`)}</div>
      <p class="label">範圍</p>
      <div class="chips"><button class="chip" style="height:36px;padding-inline:14px" aria-pressed="true">全部單字集</button><button class="chip" style="height:36px;padding-inline:14px">只練要再看的</button><button class="chip" style="height:36px;padding-inline:14px">${icon("plus", "bold")}選單字集</button></div>
      <p class="label">題數</p>
      <div class="tabs" style="display:flex">${each([10, 20, 30, 50], (n) => `<button style="flex:1;justify-content:center" class="latin" aria-selected="${n === 20}">${n}</button>`)}</div>
      <a class="btn btn-lg btn-primary" href="#/practice" data-close style="width:100%;margin-top:var(--sp-6)">${icon("play")}開始 20 題</a>
    </div>`,
  me: () => {
    const nav = [["account", "帳號", "user-circle"], ["study", "學習", "target"], ["look", "外觀", "palette"], ["agent", "AI 助理", "plugs-connected"], ["data", "資料", "database"], ["about", "關於", "info"]];
    return `
    <div class="sheet settings" role="dialog" aria-label="設定">
      <div class="settings-nav" role="tablist">
        <div class="rowx" style="padding:var(--sp-2) var(--sp-2) var(--sp-4)"><span class="avatar">T</span><span class="grow"><b class="cut" style="display:block">Tavric</b></span></div>
        ${each(nav, ([id, n, ic], i) => `<button role="tab" aria-selected="${i === 0}" data-nav="${id}">${icon(ic)}${n}</button>`)}
      </div>
      <button class="btn btn-icon btn-glass settings-close only-wide" data-close aria-label="關閉">${icon("x", "bold")}</button>
      <div class="settings-body">
        <div class="sheet-head" style="margin:0"><h2>我的</h2><button class="btn btn-icon btn-glass" data-close aria-label="關閉">${icon("x", "bold")}</button></div>
        <section class="group" data-group="account" data-on><h3>帳號</h3>
          <div class="paper account"><span class="avatar" style="--av:56px">T</span><div class="grow"><b style="font-size:1.125rem">Tavric</b><p class="muted t-sub cut">tavric@example.com</p></div></div>
          <div class="paper"><button class="srow"><span class="sicon">${icon("sign-out")}</span>登出</button><button class="srow" style="color:var(--wrong)"><span class="sicon" style="color:inherit">${icon("trash")}</span>刪除帳號</button></div>
          <h3>同步</h3>
          <div class="paper">
            <div class="srow"><span class="sicon">${icon("cloud-check")}</span>雲端同步<span class="v"><span class="sync-dot"></span>已同步</span></div>
            <button class="srow"><span class="sicon">${icon("arrows-clockwise", "bold")}</span>立即同步</button>
          </div>
        </section>
        <section class="group" data-group="study"><h3>學習</h3>
          <div class="paper">
            <div class="srow"><span class="sicon">${icon("target")}</span>每日目標<span class="v"><span class="tabs">${each([10, 20, 30], (n) => `<button class="latin" style="height:30px;padding-inline:12px" aria-selected="${n === 20}">${n}</button>`)}</span></span></div>
            <div class="srow"><span class="sicon">${icon("bell-ringing")}</span>每日提醒<button class="switch" role="switch" aria-checked="true" aria-label="每日提醒" style="margin-inline-start:auto"></button></div>
            <div class="srow"><span class="sicon">${icon("stack")}</span>每個單字只考一個詞義<button class="switch" role="switch" aria-checked="true" aria-label="每個單字只考一個詞義" style="margin-inline-start:auto"></button></div>
          </div>
        </section>
        <section class="group" data-group="look"><h3>外觀</h3>
          <div class="paper"><div class="srow"><span class="sicon">${icon("moon")}</span>主題<span class="v"><span class="tabs" id="scheme">${each([["system", "系統"], ["light", "淺色"], ["dark", "深色"]], ([v, n]) => `<button style="height:30px;padding-inline:12px" data-scheme-pick="${v}" aria-selected="${v === "light"}">${n}</button>`)}</span></span></div></div>
        </section>
        <section class="group" data-group="agent"><h3>AI 助理</h3>
          <div class="paper">
            <div class="srow"><span class="sicon">${icon("plugs-connected")}</span><span class="grow cut latin">mcp.lexiro.app/sse</span><button class="btn btn-compact btn-secondary">${icon("copy")}複製</button></div>
            <div class="srow"><span class="sicon">${icon("open-ai-logo")}</span>ChatGPT<button class="btn btn-compact btn-ghost" style="margin-inline-start:auto;color:var(--danger)">解除</button></div>
          </div>
          <p>把網址貼到 ChatGPT 或 Codex，就能請它幫你整理單字和出題。</p>
        </section>
        <section class="group" data-group="data"><h3>資料</h3>
          <div class="paper">
            <button class="srow"><span class="sicon">${icon("export")}</span>匯出完整備份<span class="v">${icon("caret-right", "bold")}</span></button>
            <button class="srow"><span class="sicon">${icon("download-simple", "bold")}</span>匯入備份<span class="v">${icon("caret-right", "bold")}</span></button>
          </div>
        </section>
        <section class="group" data-group="about"><h3>關於</h3>
          <div class="paper"><div class="srow"><span class="sicon">${icon("info")}</span>版本<span class="v latin">2.1.0</span></div><button class="srow"><span class="sicon">${icon("arrow-circle-up")}</span>檢查更新</button></div>
        </section>
      </div>
    </div>`;
  },
};

const menus = {
  add: [["cards", "新增單字集", "#/new"], ["folder-simple-plus", "新增資料夾"], ["download-simple", "匯入單字集"]],
  set: [["pencil-simple", "重新命名"], ["folder-simple", "移到資料夾"], ["share-fat", "分享"], ["trash", "刪除"]],
};

const view = document.getElementById("view");
const layer = document.getElementById("layer");
const FOCUS = new Set(["practice", "cloze", "result", "duel"]);
const PARENT = { set: "library", word: "library", new: "library", room: "rooms", empty: "home" };

function render() {
  // A screen may be opened in a given state: #/home?sheet=setup, #/practice?answer=1, #/home?scheme=dark
  const [name = "home", query = ""] = (location.hash.replace("#/", "") || "home").split("?");
  const state = new URLSearchParams(query);
  document.documentElement.dataset.scheme = state.get("scheme") ?? document.documentElement.dataset.scheme;
  const screen = screens[name] ?? screens.home;
  layer.innerHTML = "";
  view.innerHTML = screen();
  document.body.toggleAttribute("data-focus", FOCUS.has(name));
  const current = PARENT[name] ?? name;
  for (const link of document.querySelectorAll(".side a.nav, .dock a")) {
    if (link.getAttribute("href") === `#/${current}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  scrollTo(0, 0);
  if (state.get("sheet")) layer.innerHTML = `<div class="scrim">${sheets[state.get("sheet")]()}</div>`;
  if (state.get("nav")) document.querySelector(`[data-nav="${state.get("nav")}"]`)?.click();
  if (state.get("tab")) document.querySelector(`[data-tab="${state.get("tab")}"]`)?.click();
  if (state.get("menu")) document.querySelector(`[data-menu="${state.get("menu")}"]`)?.click();
  if (state.get("answer")) { document.querySelectorAll(".opts .opt")[Number(state.get("answer"))]?.click(); document.getElementById("confirm")?.click(); }
}

function closeLayer() { layer.innerHTML = ""; }

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open], [data-close], [data-menu], [data-tab], [data-nav], [data-scheme-pick], .opt, .switch, .flip, .pill, .chip[aria-pressed], .mode, .tabs button");
  if (event.target.classList.contains("scrim")) return closeLayer();
  if (!target) { if (!event.target.closest(".menu")) layer.querySelector(".menu")?.remove(); return; }
  if (target.dataset.menu) {
    event.preventDefault(); event.stopPropagation();
    const box = target.getBoundingClientRect();
    layer.innerHTML = `<div class="menu" style="top:${box.bottom + 8}px;right:${Math.max(12, innerWidth - box.right)}px">${menus[target.dataset.menu].map(([ic, n]) => `<button>${icon(ic)}${n}</button>`).join("")}</div>`;
    return;
  }
  if (target.dataset.open) { event.preventDefault(); layer.innerHTML = `<div class="scrim">${sheets[target.dataset.open]()}</div>`; return; }
  if (target.hasAttribute("data-close")) { closeLayer(); return; }
  if (target.dataset.tab) {
    for (const tab of target.parentElement.children) tab.setAttribute("aria-selected", tab === target);
    for (const pane of document.querySelectorAll("[data-pane]")) pane.hidden = pane.dataset.pane !== target.dataset.tab;
    return;
  }
  if (target.dataset.nav) {
    for (const tab of target.parentElement.querySelectorAll("button")) tab.setAttribute("aria-selected", tab === target);
    for (const group of document.querySelectorAll("[data-group]")) group.toggleAttribute("data-on", group.dataset.group === target.dataset.nav);
    return;
  }
  if (target.dataset.schemePick) document.documentElement.dataset.scheme = target.dataset.schemePick === "dark" ? "dark" : "light";
  if (target.matches(".tabs button")) { for (const tab of target.parentElement.children) tab.setAttribute("aria-selected", tab === target); return; }
  if (target.matches(".switch")) { target.setAttribute("aria-checked", target.getAttribute("aria-checked") !== "true"); return; }
  if (target.matches(".flip")) { target.toggleAttribute("data-open"); return; }
  if (target.matches(".pill")) { for (const pill of target.parentElement.children) pill.setAttribute("aria-pressed", pill === target); return; }
  if (target.matches(".mode")) { for (const mode of target.parentElement.children) mode.setAttribute("aria-pressed", mode === target); return; }
  if (target.matches(".chip[aria-pressed]")) { target.setAttribute("aria-pressed", target.getAttribute("aria-pressed") !== "true"); return; }
  if (target.matches(".opt") && !document.querySelector(".opt[data-state]")) {
    for (const option of target.parentElement.children) option.setAttribute("aria-checked", option === target);
    document.getElementById("confirm")?.removeAttribute("disabled");
  }
});

// The meaning question answers itself: confirm reveals right and wrong, then offers the next step.
document.addEventListener("click", (event) => {
  const confirm = event.target.closest("#confirm");
  if (!confirm) return;
  if (confirm.dataset.done) { location.hash = "#/result"; return; }
  const options = [...document.querySelectorAll(".opts .opt")];
  const picked = options.findIndex((option) => option.getAttribute("aria-checked") === "true");
  const right = picked === 1;
  options.forEach((option, index) => {
    option.dataset.state = index === 1 ? "right" : index === picked ? "wrong" : "dim";
    option.querySelector(".why")?.removeAttribute("hidden");
  });
  document.getElementById("verdict").innerHTML = `
    <div class="verdict ${right ? "is-right" : "is-wrong"}">
      <h2>${icon(right ? "check-circle" : "x-circle")}${right ? "答對了" : "正確答案是 無所不在的"}</h2>
      <p class="latin" style="font-weight:500;font-size:1.0625rem">Smartphones have become <b>ubiquitous</b> in modern life.</p>
      <p class="muted t-sub">智慧型手機在現代生活中已經無所不在。</p>
    </div>`;
  document.getElementById("skip").hidden = true;
  confirm.dataset.done = "1";
  confirm.innerHTML = `下一題${icon("arrow-right", "bold")}`;
});

addEventListener("keydown", (event) => { if (event.key === "Escape") closeLayer(); });
addEventListener("hashchange", render);
render();

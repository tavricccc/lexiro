/* The page's own interactions: the hero's deck of word cards and the sample questions. */

/* The deck: each card keeps its place in the fan (data-pos, CSS transform). On top of it one spring per
   card carries the drag, the pointer's parallax and a slow sway, written as translate and rotate. */
const deck = document.querySelector("[data-deck]");
if (deck) {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const cards = [...deck.querySelectorAll(".wcard")].map((el, i) => ({ el, i, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, flying: 0 }));
  const posOf = (card) => Number(card.el.dataset.pos);
  const topCard = () => cards.find((card) => posOf(card) === 0);
  const place = (card, pos) => {
    card.el.dataset.pos = String(pos);
    if (pos === 0) card.el.removeAttribute("aria-hidden");
    else card.el.setAttribute("aria-hidden", "true");
  };
  const toBack = (card) => {
    const from = posOf(card);
    for (const other of cards) if (posOf(other) > from) place(other, posOf(other) - 1);
    place(card, cards.length - 1);
  };
  const toFront = (card) => {
    const from = posOf(card);
    for (const other of cards) if (posOf(other) < from) place(other, posOf(other) + 1);
    place(card, 0);
  };

  const elastic = (d, max) => max * Math.tanh(d / max);

  const throwCard = (card, vx, vy) => {
    if (card.flying) return;
    if (still.matches) { card.x = card.y = card.r = 0; toBack(card); paint(); return; }
    const width = deck.offsetWidth;
    /* to the left it goes up, clear of the headline */
    if (vx < 0 && vy < -vx) vy = Math.min(vy, vx * 2.2);
    const speed = Math.hypot(vx, vy) || 1;
    const push = Math.max(speed, width * 4.2) / speed;
    card.vx = vx * push;
    card.vy = vy * push;
    card.vr = Math.sign(vx || 1) * 70;
    card.flying = 0.001;
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let drag = null;
  let visible = true;
  let frame = 0;
  let before = 0;

  const paint = () => {
    for (const card of cards) {
      card.el.style.translate = `${card.x.toFixed(2)}px ${card.y.toFixed(2)}px`;
      card.el.style.rotate = `${card.r.toFixed(3)}deg`;
    }
  };

  const step = (now) => {
    frame = 0;
    const dt = Math.min(0.032, (now - before) / 1000 || 0.016);
    before = now;
    const width = deck.offsetWidth;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5);
    const pull = drag?.moved ? Math.min(1, Math.hypot(drag.dx, drag.dy) / width) : 0;
    let moving = false;
    for (const card of cards) {
      const pos = posOf(card);
      if (card.flying) {
        card.flying += dt;
        card.x += card.vx * dt;
        card.y += card.vy * dt;
        card.r += card.vr * dt;
        card.el.style.opacity = String(Math.max(0, 1 - card.flying / 0.34));
        if (card.flying > 0.34) {
          /* back into the fan from behind the trees */
          card.flying = 0;
          toBack(card);
          Object.assign(card, { x: 0, y: width * 1.3, r: 0, vx: 0, vy: 0, vr: 0 });
          card.el.style.opacity = "";
        }
        moving = true;
        continue;
      }
      const held = drag?.moved && drag.card === card;
      let x = 0, y = 0, r = 0;
      if (held) {
        /* elastic, so a held card never covers the headline or leaves the trees' layer */
        x = elastic(drag.dx, width * 0.5);
        y = elastic(drag.dy, width * 0.4);
        r = Math.max(-16, Math.min(16, (x / width) * 18 * drag.grip + card.vx * 0.004));
      } else if (!still.matches) {
        const depth = 1 - pos * 0.17;
        const t = now / 1000;
        x = pointer.x * width * 0.035 * depth + Math.sin(t * 0.7 + card.i * 1.9) * width * 0.004;
        y = pointer.y * width * 0.025 * depth + Math.sin(t * 0.9 + card.i * 1.3) * width * 0.011;
        r = pointer.x * 1.2 * depth + Math.sin(t * 0.6 + card.i * 2.3) * 0.7;
        /* the fan opens while a card is pulled out of it */
        const side = pos === 0 ? 0 : pos % 2 ? 1 : -1;
        x += side * pull * width * 0.05;
        r += side * pull * 2.2;
      }
      if (still.matches) {
        Object.assign(card, { x, y, r: 0 });
        continue;
      }
      const stiff = held ? 900 : 130;
      const damp = held ? 46 : 14;
      for (const [k, v, to] of [["x", "vx", x], ["y", "vy", y], ["r", "vr", r]]) {
        card[v] += ((to - card[k]) * stiff - card[v] * damp) * dt;
        card[k] += card[v] * dt;
      }
      moving = true;
    }
    paint();
    if (visible && (moving || drag)) wake();
  };
  const wake = () => { if (!frame) frame = requestAnimationFrame(step); };

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); }).observe(deck);
  still.addEventListener("change", wake);

  deck.closest("section").addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || drag) return;
    const box = deck.getBoundingClientRect();
    const clamp = (value) => Math.max(-1, Math.min(1, value));
    pointer.tx = clamp((event.clientX - box.left - box.width / 2) / (innerWidth / 2));
    pointer.ty = clamp((event.clientY - box.top - box.height / 2) / (innerHeight / 2));
    wake();
  });

  for (const card of cards) {
    const { el } = card;
    el.addEventListener("dragstart", (event) => event.preventDefault());
    el.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag || card.flying) return;
      const box = el.getBoundingClientRect();
      drag = {
        card, id: event.pointerId, x0: event.clientX, y0: event.clientY, dx: 0, dy: 0, moved: false,
        grip: event.clientY < box.top + box.height / 2 ? 1 : -1, px: event.clientX, py: event.clientY, pt: event.timeStamp, vx: 0, vy: 0,
      };
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (drag?.card !== card || drag.id !== event.pointerId) return;
      drag.dx = event.clientX - drag.x0;
      drag.dy = event.clientY - drag.y0;
      if (!drag.moved && Math.hypot(drag.dx, drag.dy) > 6) {
        drag.moved = true;
        if (posOf(card) !== 0) toFront(card);
        el.classList.add("is-held");
      }
      const dt = Math.max(1, event.timeStamp - drag.pt) / 1000;
      drag.vx += ((event.clientX - drag.px) / dt - drag.vx) * 0.5;
      drag.vy += ((event.clientY - drag.py) / dt - drag.vy) * 0.5;
      Object.assign(drag, { px: event.clientX, py: event.clientY, pt: event.timeStamp });
      wake();
    });
    const release = (event, cancelled) => {
      if (drag?.card !== card || drag.id !== event.pointerId) return;
      const done = drag;
      drag = null;
      el.classList.remove("is-held");
      if (event.timeStamp - done.pt > 90) done.vx = done.vy = 0;
      const width = deck.offsetWidth;
      if (cancelled) { /* the spring takes it home */ }
      else if (!done.moved) {
        if (posOf(card) !== 0) toFront(card);
        else throwCard(card, -0.8, -0.45);
      } else if (Math.hypot(done.dx, done.dy) > width * 0.5 || Math.hypot(done.vx, done.vy) > 750) {
        const fast = Math.hypot(done.vx, done.vy) > 300;
        throwCard(card, fast ? done.vx : done.dx, fast ? done.vy : done.dy);
      }
      wake();
    };
    el.addEventListener("pointerup", (event) => release(event, false));
    el.addEventListener("pointercancel", (event) => release(event, true));
  }

  /* keyboard: the pointer works the cards themselves */
  deck.querySelector(".deck__hit").addEventListener("click", () => { throwCard(topCard(), -0.8, -0.45); wake(); });
}

for (const quiz of document.querySelectorAll("[data-quiz]")) {
  const options = [...quiz.querySelectorAll(".opt")];
  const feedback = quiz.querySelector(".q__fb");
  for (const option of options) {
    option.addEventListener("click", () => {
      const right = option.dataset.i === quiz.dataset.answer;
      for (const other of options) other.classList.remove("is-right", "is-wrong");
      option.classList.add(right ? "is-right" : "is-wrong");
      feedback.textContent = right ? quiz.dataset.ok : option.dataset.why;
      feedback.dataset.state = right ? "right" : "wrong";
    });
  }
}

for (const order of document.querySelectorAll("[data-order]")) {
  const answer = order.dataset.order.split("|");
  const line = order.querySelector(".q__line");
  const feedback = order.querySelector(".q__fb");
  const pieces = [...order.querySelectorAll(".opt")];
  let picked = [];
  for (const piece of pieces) {
    piece.addEventListener("click", () => {
      if (picked.length === answer.length) {
        picked = [];
        for (const other of pieces) other.classList.remove("is-used");
        feedback.textContent = "";
      }
      if (picked.includes(piece)) picked = picked.filter((entry) => entry !== piece);
      else picked.push(piece);
      piece.classList.toggle("is-used", picked.includes(piece));
      line.textContent = picked.map((entry) => entry.textContent).join(" ");
      if (picked.length < answer.length) return;
      const right = picked.every((entry, index) => entry.textContent === answer[index]);
      feedback.textContent = right ? "順序正確。abundant 放在名詞 natural resources 前面。" : "還差一點，再點一個片段重排。";
      feedback.dataset.state = right ? "right" : "wrong";
    });
  }
}

/* The nav has no ground: it takes light words over a dark screen, and steps aside while scrolling down. */
const nav = document.querySelector("header.nav");
if (nav) {
  const dark = [...document.querySelectorAll("[data-nav='dark']")];
  /* grounds that change under the links: no one colour reads on them, so the nav waits until they have passed */
  const busy = [...document.querySelectorAll(".scene__front, .facts, .stagebox, .tile--list, .chat, .lv, .bars")];
  let last = scrollY;
  const read = () => {
    const height = nav.offsetHeight;
    const meets = (element, from, to) => {
      const box = element.getBoundingClientRect();
      return box.height > 0 && box.top < to && box.bottom > from;
    };
    nav.classList.toggle("is-dark", dark.some((section) => meets(section, height / 2, height / 2)));
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 24);
    const open = nav.classList.contains("is-open") || nav.contains(document.activeElement);
    const over = busy.some((element) => meets(element, 0, height));
    if (over && !open) nav.classList.add("is-away");
    else if (y < 80 || y < last - 4 || open) nav.classList.remove("is-away");
    else if (y > last + 4) nav.classList.add("is-away");
    last = y;
  };
  addEventListener("scroll", read, { passive: true });
  addEventListener("resize", read);
  read();
}

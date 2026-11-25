/* The page's own interactions: the hero's deck of word cards and the sample questions. */

const deck = document.querySelector("[data-deck]");
if (deck) {
  const cards = [...deck.querySelectorAll(".wcard")];
  let busy = false;
  deck.querySelector(".deck__hit").addEventListener("click", () => {
    if (busy) return;
    busy = true;
    const top = cards.find((card) => card.dataset.pos === "0");
    top.classList.add("is-leaving");
    setTimeout(() => {
      for (const card of cards) {
        const pos = (Number(card.dataset.pos) + cards.length - 1) % cards.length;
        card.dataset.pos = String(pos);
        card.toggleAttribute("aria-hidden", pos !== 0);
        if (pos !== 0) card.setAttribute("aria-hidden", "true");
      }
      top.classList.remove("is-leaving");
      setTimeout(() => { busy = false; }, 420);
    }, 260);
  });
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

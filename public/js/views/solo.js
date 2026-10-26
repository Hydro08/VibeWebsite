import { $, esc, S, LANGS, editor, award, shake, toast } from "../core/util.js";
import { runInto, preload } from "../run/run.js";
import { checkInto } from "../run/check.js";
import { LEVELS } from "../data/levels.js";
import { starter } from "./lesson.js";

// Flow: pick a language → level path → level. Each language has its own progress.
let retry = null, // set while a level is open: refills the hearts
  el,
  lang = null,
  cur = null,
  onLevel = () => {};
const key = (l) => `solo2:${S.me}:${l}`; // saved per user and per language in this browser
const done = (l = lang) => {
  try {
    return JSON.parse(localStorage[key(l)] || "[]");
  } catch {
    return [];
  }
};
const save = (i) => {
  const d = done();
  if (!d.includes(i)) {
    d.push(i);
    try {
      localStorage[key(lang)] = JSON.stringify(d);
    } catch {}
  }
};
const nextLevel = (d) => {
  let i = 0;
  while (d.includes(i)) i++;
  return i;
}; // first level not cleared yet
const BOSS = LEVELS.length - 1;
const HEARTS = 3; // lives per attempt: a wrong answer costs one, 0 = try the level again
const heart = (i, lost) =>
  `<svg class="heart${lost ? " lost" : ""}" data-h="${i}" viewBox="0 0 24 24" aria-hidden="true">
    <path class="hf" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.4 4.5c2 0 3.7 1.1 4.6 2.7l1 1.7 1-1.7c.9-1.6 2.6-2.7 4.6-2.7 3.7 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z"/>
    <path class="hc" d="M12 7.5l-2 3.2 2.4 2-2 3.3"/></svg>`;

// onLevelChange(true) while a level is open, so the Arena can hide its Solo/PVP switch
export function soloInit(box, onLevelChange) {
  el = box;
  onLevel = onLevelChange || onLevel;
  Object.keys(localStorage)
    .filter((k) => /^solo:/.test(k))
    .forEach((k) => localStorage.removeItem(k)); // old progress format
  el.onclick = (e) => {
    const p = e.target.closest("[data-pick]"),
      n = e.target.closest("[data-lv]");
    if (p) {
      lang = p.dataset.pick;
      preload();
      return map();
    }
    if (e.target.closest("[data-langs]")) return picker();
    if (n) {
      if (n.classList.contains("lock")) {
        shake(n);
        return toast("🔒 Clear the previous level first");
      }
      return play(+n.dataset.lv);
    }
    if (e.target.closest("[data-retry]")) return retry?.();
    if (e.target.closest("[data-back]")) return map();
    if (e.target.closest("[data-prev]")) return play(cur - 1);
    if (e.target.closest("[data-next]")) return play(cur + 1);
  };
}
export function soloShow() {
  preload();
  if (!lang) return picker();
  if (cur === null) {
    map();
    requestAnimationFrame(() =>
      el.querySelector(".now")?.scrollIntoView({ block: "center" }),
    );
  }
}

function picker() {
  retry = null;
  lang = null;
  cur = null;
  onLevel(false);
  el.innerHTML = `<div class="card"><h2>🎯 Solo mode</h2>
    <p class="mut">Choose your language first. Every language has its own ${LEVELS.length} levels and its own progress.</p></div>
    <div class="lessons">${LANGS.map((l) => {
      const n = done(l).length,
        full = n >= LEVELS.length;
      return `<button class="lc ghost" data-pick="${esc(l)}"><span class="lic">${full ? "🏆" : "💻"}</span>
        <span><b>${esc(l)}</b><br><span class="mut">${n}/${LEVELS.length} levels</span></span>
        ${full ? '<span class="pill ok" style="margin-left:auto">✅ Completed</span>' : ""}</button>`;
    }).join("")}</div>`;
}

function map() {
  cur = null;
  retry = null;
  onLevel(false);
  const d = done(),
    n = nextLevel(d),
    full = d.length >= LEVELS.length;
  el.innerHTML = `<div class="card">
    <div class="row" style="justify-content:space-between"><button class="ghost" data-langs style="flex:0 0 auto">← Languages</button>
      ${full ? '<span class="pill ok" style="flex:0 0 auto">✅ Completed</span>' : ""}</div>
    <h2>🎯 Solo mode · ${esc(lang)}</h2>
    <p class="mut">Clear a level to unlock the next one. ${d.length}/${LEVELS.length} cleared.</p>
    <div class="prog"><i style="width:${Math.round((d.length / LEVELS.length) * 100)}%"></i></div></div>
    <div class="path">${LEVELS.map((l, i) => {
      const st = i < n ? "done" : i === n ? "now" : "lock";
      const face =
        st === "lock" ? "🔒" : st === "done" ? "✓" : i === BOSS ? "👑" : i + 1;
      return `<button class="node ${st}${i === BOSS ? " boss" : ""}" data-lv="${i}" style="--x:${Math.round(Math.sin(i * 0.9) * 70)}px">${face}${st === "lock" ? "" : `<small>${esc(l.topic)}</small>`}</button>`;
    }).join("")}</div>`;
}

function play(i) {
  if (i > nextLevel(done()) || i >= LEVELS.length) return map(); // locked
  cur = i;
  onLevel(true);
  const L = LEVELS[i];
  el.innerHTML = `<div class="card">
    <div class="row" style="justify-content:space-between"><button class="ghost" data-back style="flex:0 0 auto">← Back to levels</button><span class="pill" style="flex:0 0 auto">${esc(lang)}</span></div>
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">${i === BOSS ? "👑" : "Level " + (i + 1)} · ${esc(L.topic)}</h2>
      <div class="hearts" id="so-hearts" title="Hearts: a wrong answer costs one" style="flex:0 0 auto"></div></div>
    <div class="task">🎯 ${esc(L.task)}</div>
    <textarea id="so-code" class="code" spellcheck="false"></textarea>
    <div class="row"><button id="so-run" class="ghost">▶ Run</button><button id="so-check">✔ Check</button></div>
    <pre id="so-out" class="out">Output appears here.</pre><div id="so-msg"></div>
    <div id="so-nav" class="so-nav"></div></div>`;
  const ta = $("#so-code");
  ta.value = starter(lang);
  editor(ta);
  // centered nav: previous level (from level 2 on) + next level once this one is cleared
  const nav = $("#so-nav");
  const showNav = () => {
    const prev =
      i > 0 ? `<button class="ghost" data-prev>← Level ${i}</button>` : "";
    let next = "";
    if (done().includes(i))
      next =
        i + 1 < LEVELS.length
          ? `<button data-next>Level ${i + 2} →</button>`
          : `<p class="ok">🏆 You cleared all ${LEVELS.length} levels in ${esc(lang)}!</p><button data-back>Back to levels</button>`;
    nav.innerHTML = prev + next;
  };
  showNav();

  // ----- hearts -----
  let hp = HEARTS;
  const box = $("#so-hearts"),
    runB = $("#so-run"),
    chkB = $("#so-check");
  const drawHearts = () =>
    (box.innerHTML = Array.from({ length: HEARTS }, (_, k) =>
      heart(k, k >= hp),
    ).join(""));
  drawHearts();
  const floatText = (txt) => {
    const f = document.createElement("span");
    f.className = "heart-fly";
    f.textContent = txt;
    box.append(f);
    setTimeout(() => f.remove(), 1100);
  };
  const lose = () => {
    hp--;
    const h = box.querySelector(`[data-h="${hp}"]`);
    h?.classList.add("break"); // crack + shake, then it turns grey
    floatText("-1 💔");
    shake(box);
    setTimeout(drawHearts, 650);
    if (hp > 0) return;
    // out of hearts: lock Run/Check until the player retries
    runB.disabled = chkB.disabled = true;
    setTimeout(() => {
      $("#so-msg").innerHTML = `<div class="gameover"><b>💔 Out of hearts!</b>
        <span class="mut">Take a breath, re-read the task, and try again.</span>
        <button data-retry>↻ Try again (${HEARTS} ❤️)</button></div>`;
    }, 700);
  };
  retry = () => {
    hp = HEARTS;
    drawHearts();
    box.classList.remove("win");
    box.classList.add("refill");
    setTimeout(() => box.classList.remove("refill"), 900);
    runB.disabled = chkB.disabled = false;
    $("#so-msg").innerHTML = "";
    $("#so-out").className = "out";
    $("#so-out").textContent = "Output appears here.";
  };

  runB.onclick = () => runInto(runB, $("#so-out"), lang, ta.value);
  chkB.onclick = async () => {
    const ok = await checkInto(
      chkB,
      $("#so-out"),
      $("#so-msg"),
      lang,
      ta.value,
      L.expect,
    );
    if (!ok) {
      // a crash / syntax error ("Fix the error first") is free; only a wrong answer costs a heart
      if (!$("#so-out").classList.contains("bad")) lose();
      return;
    }
    box.classList.add("win"); // hearts dance
    floatText("✨");
    save(i);
    award(`practice:solo-${lang}-${i + 1}`); // XP is paid once per level and language
    showNav();
    nav.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
}

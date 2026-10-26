import { $, esc, S, LANGS, editor, award } from "../core/util.js";
import { runInto, preload } from "../run/run.js";
import { TASKS } from "../data/tasks.js";
import { checkInto } from "../run/check.js";
import { THEMES, getTheme, setTheme, attachHighlight } from "../editor/highlight.js";
import { freedomInit } from "./freedom.js";

// ids are prefixed "pp-" so they can never clash with the battle room's elements
export function practiceInit() {
  const el = $("#v-practice");
  el.dataset.ed = getTheme(); // code theme (colours of the letters) — shared by both modes
  el.innerHTML = `<div class="card" id="pp-head">
    <div class="row"><h2 style="margin:0">Practice area</h2>
      <label class="pp-theme">🎨 <select id="pp-theme" title="Code theme">${THEMES.map((t) => `<option value="${t.id}">${t.name}</option>`).join("")}</select></label></div>
    <div class="seg" id="pp-seg"><button class="on" data-m="act">🎯 Activity</button><button data-m="free">🆓 Freedom</button></div>
    <p class="mut" id="pp-sub"></p></div>
  <div class="card" id="pp-act">
    <div class="row"><select id="pp-topic">${TASKS.map((t, i) => `<option value="${i}">${esc(t.topic)}</option>`).join("")}</select><button class="ghost" id="pp-rand" style="flex:0 0 auto">🎲 Random</button></div>
    <div class="task" id="pp-task"></div>
    <select id="pp-lang">${LANGS.map((l) => `<option>${l}</option>`).join("")}</select>
    <textarea id="pp-code" class="code" spellcheck="false" placeholder="Write your code here…"></textarea>
    <div class="row"><button class="ghost" id="pp-run">▶ Run</button><button id="pp-check">✔ Check</button></div>
    <pre id="pp-out" class="out">Output appears here.</pre><div id="pp-msg"></div></div>
  <div class="card vsc-card" id="pp-free" hidden></div>`;
  editor($("#pp-code"));
  const hl = attachHighlight($("#pp-code"), {
    lang: () => $("#pp-lang").value,
    gutter: true,
  });

  // ----- theme + mode switch -----
  $("#pp-theme").value = el.dataset.ed;
  $("#pp-theme").onchange = (e) => setTheme(e.target.value, el);
  const SUB = {
    act: "Solo mode — pick a topic, write your code, use Run to test and Check to verify your answer.",
    free: "Free coding — no task, no rules. Create files, write anything and run it.",
  };
  let freeReady = false;
  const mode = (m) => {
    $("#pp-act").hidden = m !== "act";
    $("#pp-free").hidden = m !== "free";
    el.classList.toggle("wide", m === "free");
    $("#pp-sub").textContent = SUB[m];
    document
      .querySelectorAll("#pp-seg button")
      .forEach((b) => b.classList.toggle("on", b.dataset.m === m));
    sessionStorage.ppMode = m;
    if (m === "free" && !freeReady) {
      freeReady = true;
      freedomInit($("#pp-free"));
    }
    if (m === "act") hl.update();
  };
  $("#pp-seg").onclick = (e) => {
    const b = e.target.closest("[data-m]");
    if (b) mode(b.dataset.m);
  };
  mode(sessionStorage.ppMode === "free" ? "free" : "act");

  const sel = $("#pp-topic");
  const showTask = () => {
    $("#pp-task").innerHTML = "🎯 <b>Task:</b> " + esc(TASKS[+sel.value].task);
    $("#pp-msg").innerHTML = "";
  };
  sel.onchange = showTask;
  showTask();

  $("#pp-rand").onclick = () => {
    let i;
    do i = Math.floor(Math.random() * TASKS.length);
    while (i === sel.selectedIndex && TASKS.length > 1);
    sel.selectedIndex = i;
    showTask();
  };
  $("#pp-lang").onchange = () => {
    preload();
    hl.update(); // re-colour for the new language
  };
  $("#pp-run").onclick = () =>
    runInto(
      $("#pp-run"),
      $("#pp-out"),
      $("#pp-lang").value,
      $("#pp-code").value,
    );
  $("#pp-check").onclick = async () => {
    const t = TASKS[+sel.value],
      lang = $("#pp-lang").value;
    const ok = await checkInto(
      $("#pp-check"),
      $("#pp-out"),
      $("#pp-msg"),
      lang,
      $("#pp-code").value,
      t.expect,
    );
    if (!ok) return;
    rate($("#pp-msg"), t.topic, lang, $("#pp-code").value); // AI rating (x/10)
    const g = await award(`practice:${t.topic}:${lang}`);
    if (g && !g.gained)
      $("#pp-msg").insertAdjacentHTML(
        "beforeend",
        '<p class="mut">You already earned XP for this one. Try another topic or language!</p>',
      );
  };
}

// asks the server's AI to rate a correct solution: "Too simple · 3/10" … "Excellent · 10/10"
async function rate(msgEl, topic, lang, code) {
  msgEl.insertAdjacentHTML(
    "beforeend",
    '<div class="rate" id="pp-rate"><span class="mut">🤖 AI is rating your code…</span></div>',
  );
  const box = $("#pp-rate");
  try {
    const r = await fetch("/api/rate", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: S.tok },
      body: JSON.stringify({ topic, lang, code }),
    });
    const d = await r.json();
    if (!r.ok) throw 0;
    box.innerHTML = `<b>🤖 ${esc(d.label)} · ${d.score}/10</b><div class="prog"><i style="width:${d.score * 10}%"></i></div><p class="mut">${esc(d.feedback)}</p>`;
  } catch {
    box.innerHTML =
      '<span class="mut">AI rating is unavailable right now.</span>';
  }
}

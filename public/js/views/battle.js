// battle.js
import { $ as q, esc, S, LANGS, editor, toast } from "../core/util.js";
const $ = (s) => q(s, document.getElementById("room")); // scoped to the room: no id clashes with other views
import { runInto, preload } from "../run/run.js";

const TPL = `
<div class="top"><div><span class="mut">Room</span> <b class="rc" id="rc"></b> <span class="pill" id="vis"></span></div>
  <div class="row"><span class="pill" id="tp"></span><span class="pill" id="lg"></span></div><div id="tm"></div>
  <button class="ghost" data-a="leave">Leave</button></div>
<div id="lobby" class="lobby"><div id="qr"></div><div class="mut" id="qt"></div>
  <div class="pcs" id="pcs"></div><button id="rdy" data-a="ready"></button><button id="sit" data-a="sit" hidden>🎮 Join as player</button><div class="mut" id="spec"></div></div>
<div id="arena" hidden><div class="bar"><button id="dn" data-a="done" hidden></button><div class="mut" id="rvn"></div></div><div class="arena">
  <div class="pane"><header><span><span id="ln"></span> <span id="lt" class="mut"></span></span><button id="run" data-a="run">▶ Run</button></header>
    <textarea id="ed" class="code" spellcheck="false" placeholder="Write your code here…" disabled></textarea>
    <pre id="pl" class="code blur" hidden></pre><pre id="out" class="out">Run your code to test it. Output shows only for you.</pre><div class="badge" id="lb" hidden></div></div>
  <div class="pane"><header><span><span id="rn"></span> <span id="rt" class="mut"></span></span></header><pre id="pr" class="code blur"></pre><div class="badge" id="rb" hidden></div></div>
</div></div>
<div class="chat card"><div id="msgs"></div><form class="row" id="cf"><input id="ci" maxlength="200" autocomplete="off"><button id="cs" style="flex:0 0 auto">Send</button></form></div>
<div id="ov" hidden><div id="ovc"></div></div>`;

const WORDS = [
  "Hello World",
  "FizzBuzz",
  "Palindrome",
  "Prime numbers",
  "Reverse a string",
  "Factorial",
  "Fibonacci",
];
let st,
  codes = {},
  typing = {},
  lp,
  roll,
  myLang,
  myMins,
  sendT,
  L,
  R,
  qrT,
  qrAt = 0,
  root;
const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

export function battleInit() {
  root = document.getElementById("room");
  root.innerHTML = TPL;
  const sk = S.sock;
  sk.on("state", (s) => {
    if (!S.room) return;
    st = s;
    st.until = Date.now() + s.left;
    render();
  });
  sk.on("kicked", (msg) => {
    if (!S.room) return;
    closeRoom();
    toast(msg || "You left the room");
  });
  sk.on("code", ({ u, m }) => {
    codes[u] = m;
    if (st && st.phase === "code" && m) typing[u] = Date.now();
    paint();
  });
  root.onclick = (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    if (a === "leave") leaveRoom();
    else if (["ready", "done", "again", "sit", "judge"].includes(a)) sk.emit(a);
    else if (a === "mins") {
      myMins = +b.dataset.v;
      sk.emit("mins", myMins);
      render();
    } else if (a === "lang") {
      myLang = b.dataset.v;
      sk.emit("lang", myLang);
      render();
    } else if (a === "run")
      runInto($("#run"), $("#out"), st.lang, $("#ed").value);
  };
  $("#cf").onsubmit = (e) => {
    e.preventDefault();
    const v = $("#ci").value.trim();
    if (v) sk.emit("chat", v);
    $("#ci").value = "";
  };
  editor($("#ed"), {
    noPaste: true,
    onInput: () => {
      clearTimeout(sendT);
      sendT = setTimeout(() => sk.emit("code", $("#ed").value), 120);
    },
  });
  // anti-cheat: leaving the tab during prep/code = disqualified (a second window in split screen is fine)
  document.addEventListener("visibilitychange", () => {
    if (
      S.room &&
      document.hidden &&
      st &&
      st.players.some((p) => p.u === S.me) &&
      ["prep", "code"].includes(st.phase)
    )
      sk.emit("dq");
  });
  setInterval(() => {
    if (!S.room || !st) return;
    const s = Math.max(0, Math.ceil((st.until - Date.now()) / 1000));
    $("#tm").textContent = ["code", "reveal"].includes(st.phase) ? fmt(s) : "";
    $("#rvn").textContent =
      st.phase === "reveal"
        ? `👀 Codes revealed · AI judges in ${s}s, or as soon as all players press the button`
        : "";
    const c = $("#cd");
    if (c) c.textContent = st.left ? s : "";
    const ty = (u) =>
      u && Date.now() - (typing[u] || 0) < 1500 ? "✍️ typing…" : "";
    $("#rt").textContent = ty(R);
    $("#lt").textContent = S.me === L ? "" : ty(L);
    $("#qt").textContent =
      st.phase === "lobby"
        ? `QR refreshes in ${Math.max(0, 30 - Math.floor((Date.now() - qrAt) / 1000))}s · code ${st.id}`
        : "";
  }, 250);
}

// QR carries a one-time key that changes every 30 seconds
function rotateQr() {
  if (!S.room || !st || st.phase !== "lobby") return;
  S.sock.emit("qr", (k) => {
    qrAt = Date.now();
    $("#qr").innerHTML = "";
    new QRCode($("#qr"), {
      text: `${location.origin}/?room=${S.roomId}&k=${k}`,
      width: 150,
      height: 150,
    });
  });
}
export function enterRoom(id) {
  S.room = true;
  S.roomId = id;
  sessionStorage.r = id;
  codes = {};
  lp = null;
  st = null;
  document.getElementById("app").hidden = true;
  root.hidden = false;
  $("#rc").textContent = id;
  preload();
  clearInterval(qrT);
  qrAt = 0;
  qrT = setInterval(rotateQr, 30000);
  setTimeout(rotateQr, 400);
}
function leaveRoom() {
  S.sock.emit("leave");
  closeRoom();
}
function closeRoom() {
  S.room = false;
  sessionStorage.removeItem("r");
  clearInterval(qrT);
  root.hidden = true;
  document.getElementById("app").hidden = false;
}
function paint() {
  if (st) {
    $("#pl").textContent = codes[L] || "";
    $("#pr").textContent = codes[R] || "";
  }
}

function render() {
  const P = st.players,
    ph = st.phase,
    mine = P.find((p) => p.u === S.me),
    isP = !!mine,
    opp = P.find((p) => p.u !== S.me);
  if (ph !== lp) {
    if (ph === "topic") {
      myLang = myMins = null;
      clearInterval(roll);
      roll = setInterval(() => {
        if (!st.topic && $("#ot"))
          $("#ot").textContent = WORDS[(Math.random() * WORDS.length) | 0];
      }, 90);
    }
    if (ph === "lobby") setTimeout(rotateQr, 200);
    lp = ph;
  }
  $("#vis").textContent = st.pub ? "🌐 Public" : "🔒 Private";
  $("#lobby").hidden = ph !== "lobby";
  $("#arena").hidden = ph === "lobby";
  $("#pcs").innerHTML = [0, 1]
    .map((i) =>
      P[i]
        ? `<div class="pc ${P[i].ready ? "on" : ""}"><b>${esc(P[i].u)}</b><span class="mut">${P[i].ready ? "READY ✅" : "not ready"}</span></div>`
        : '<div class="pc mut">Waiting for player…</div>',
    )
    .join("");
  $("#rdy").hidden = !isP;
  $("#rdy").classList.toggle("ready", !!(mine && mine.ready)); // orbiting light
  $("#rdy").textContent = mine && mine.ready ? "Cancel ready" : "I'M READY";
  $("#sit").hidden = isP || P.length >= 2 || ph !== "lobby";
  $("#spec").textContent =
    (!isP ? "You are spectating · " : "") +
    (st.n ? "👀 " + st.n + " watching" : "") +
    (!isP && ph === "lobby" && P.length < 2 ? " · 🔔 A seat is open!" : "");
  $("#tp").textContent = st.topic ? "📝 " + st.topic : "";
  $("#tp").hidden = !st.topic;
  $("#lg").textContent = st.lang ? `${st.lang} · ${st.mins} min` : "";
  $("#lg").hidden = !st.lang;
  // arena: me on the left, opponent (blurred) on the right; spectators see both blurred
  L = isP ? S.me : (P[0] || {}).u;
  R = isP ? (opp || {}).u : (P[1] || {}).u;
  $("#ln").textContent = isP ? "You" : L || "";
  $("#rn").textContent = R || "";
  $("#ed").hidden = !isP;
  $("#out").hidden = !isP;
  $("#run").hidden = !isP;
  $("#pl").hidden = isP;
  // codes stay hidden (blurred) for players while coding; after the match they are revealed
  const shown = ["reveal", "judging", "result"].includes(ph);
  $("#pl").classList.toggle("blur", isP && !shown);
  $("#pr").classList.toggle("blur", isP && !shown); // spectators always see real code
  const can = isP && ph === "code" && !mine.done;
  $("#ed").disabled = !can;
  $("#run").disabled = !can;
  if (ph === "topic" || ph === "lang") {
    $("#ed").value = "";
    $("#out").textContent =
      "Run your code to test it. Output shows only for you.";
  }
  const badge = (el, p) => {
    el.hidden = !(p && (p.done || p.dq));
    if (p) el.textContent = p.dq ? "DISQUALIFIED" : "DONE!";
    el.classList.toggle("x", !!(p && p.dq));
  };
  badge(
    $("#lb"),
    P.find((p) => p.u === L),
  );
  badge(
    $("#rb"),
    P.find((p) => p.u === R),
  );
  const dn = $("#dn");
  if (ph === "reveal") {
    // codes are revealed: each player can skip the 30s wait and ask the AI to judge
    const voted = (st.votes || []).includes(S.me);
    dn.hidden = !isP;
    dn.dataset.a = "judge";
    dn.disabled = voted;
    dn.textContent = voted
      ? `✅ Waiting for ${opp ? opp.u : "opponent"}… (${(st.votes || []).length}/${P.length})`
      : "🤖 Judge us, AI!";
  } else {
    dn.dataset.a = "done";
    dn.hidden = !(isP && ph === "code");
    dn.disabled = !can;
    dn.textContent = can ? "I'M DONE" : "Submitted ✅ waiting…";
  }
  // chat: players are locked out during the battle but can still read
  const m = $("#msgs");
  m.innerHTML = st.chat
    .map((c) => `<div><b>${esc(c.u)}</b> ${esc(c.m)}</div>`)
    .join("");
  m.scrollTop = m.scrollHeight;
  const ok = !isP || ["lobby", "result"].includes(ph);
  $("#ci").disabled = $("#cs").disabled = !ok;
  $("#ci").placeholder = ok
    ? "Say something…"
    : "🔒 Players can’t chat during the battle";
  // overlay
  const o = $("#ov"),
    c = $("#ovc");
  o.hidden = !["topic", "lang", "prep", "judging", "result"].includes(ph);
  if (ph === "topic") {
    c.innerHTML =
      `<p class="mut">AI is picking your topic…</p><h2 id="ot">${st.topic ? esc(st.topic) : ""}</h2>` +
      (st.topic ? "" : '<div class="mut">🎰</div>');
    if (st.topic) clearInterval(roll);
  }
  if (ph === "lang")
    c.innerHTML =
      `<p class="mut">Topic</p><h2>${esc(st.topic)}</h2>` +
      (isP
        ? `<p>Choose your language</p><div class="langs">${LANGS.map((l) => `<button data-a="lang" data-v="${l}" class="${myLang === l ? "sel" : ""}">${l}</button>`).join("")}</div><p>Choose your time</p><div class="langs">${[3, 5, 10].map((m) => `<button data-a="mins" data-v="${m}" class="${myMins === m ? "sel" : ""}">${m} min</button>`).join("")}</div><p class="mut">Different picks? We flip a coin 🎲</p>`
        : '<p class="mut">Players are choosing…</p>') +
      '<div class="big" id="cd"></div>';
  if (ph === "prep")
    c.innerHTML = `<h2>${esc(st.lang)}</h2><p class="mut">${st.how === "same" ? "You both picked it" : "Different picks — the coin chose"}</p><h2>⏱️ ${st.mins} minutes</h2><p class="mut">${st.howT === "same" ? "You both picked it" : "Different picks — the coin chose"}</p><p>${esc(st.topic)}</p><div class="big" id="cd"></div><p class="mut">Don’t leave this tab — leaving = disqualified</p>`;
  if (ph === "judging") c.innerHTML = "<h2>🤖 AI is judging…</h2>";
  if (ph === "result") {
    const r = st.result,
      alive = P.filter((p) => !p.gone),
      ag = st.again || [],
      iAgreed = ag.includes(S.me),
      secs = Math.max(0, Math.ceil((st.until - Date.now()) / 1000));
    const note = !isP
      ? `Rematch closes in <b id="cd">${secs}</b>s`
      : alive.length > 1
        ? `Confirm within <b id="cd">${secs}</b>s or you'll go back to the Arena`
        : `Your opponent left · back to the lobby in <b id="cd">${secs}</b>s`;
    const againBox =
      (alive.length > 1
        ? `<p>🔁 Play again: <b>${ag.length}/${alive.length}</b> confirmed</p>`
        : "") +
      (isP
        ? iAgreed
          ? `<button disabled>✅ Waiting${opp && alive.length > 1 ? " for " + esc(opp.u) : ""}…</button>`
          : '<button data-a="again">🔁 Play again</button>'
        : "") +
      `<p class="mut">${note}</p>`;
    c.innerHTML =
      `<h2>${r.winner ? "🏆 " + esc(r.winner) + " wins!" : "🤝 Draw"}</h2><p>${esc(r.reason)}</p><p class="mut">${Object.entries(
        r.scores || {},
      )
        .map(([u, s]) => esc(u) + ": " + esc(s) + "%")
        .join(" · ")}</p>` +
      againBox +
      '<button class="ghost" data-a="leave">Back to Arena</button>';
  }
  paint();
}

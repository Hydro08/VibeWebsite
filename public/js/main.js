import { $, esc, S, logout, rank } from "./core/util.js";
import { authInit } from "./core/auth.js";
import { battleInit } from "./views/battle.js";
import { lobbyInit, lobbyShow, joinRoom, createDialog } from "./views/lobby.js";
import { practiceInit } from "./views/practice.js";
import { lessonInit, lessonShow } from "./views/lesson.js";
import { profileInit, profileShow } from "./views/profile.js";
import { TASKS } from "./data/tasks.js";
import { bgInit, bgFocus } from "./core/bg.js";
import { typeLogos } from "./core/logo.js";

const TABS = ["home", "practice", "lesson", "lobby", "profile"];

function go(tab) {
  if (!TABS.includes(tab)) tab = "home";
  sessionStorage.tab = tab; // remember where we are
  bgFocus(tab); // the black hole moves to this tab's spot
  TABS.forEach((t) => ($("#v-" + t).hidden = t !== tab));
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  homeLive(tab === "home");
  lobbyShow(tab === "lobby");
  if (tab === "lesson") lessonShow();
  if (tab === "profile") profileShow();
}

// ---------- home: the HTML lives in index.html, this only fills it in ----------
let mode = "best",
  homeTimer;

async function loadBoard() {
  const box = $("#lb-list");
  try {
    const r = await fetch("/api/leaderboard?by=" + mode, {
      headers: { authorization: S.tok },
    });
    if (!r.ok) throw 0;
    const { rows } = await r.json();
    box.innerHTML = rows.length
      ? rows
          .map(
            (x, i) => `<div class="lr${x.u === S.me ? " me" : ""}">
        <span class="rk">${["🥇", "🥈", "🥉"][i] || i + 1}</span>
        <span class="nm">${esc(x.u)}</span>
        <span class="mut">${x.m} matches</span>
        <b>${x.v}</b></div>`,
          )
          .join("")
      : '<p class="mut">No one here yet. Win a match to take the top spot!</p>';
  } catch {
    box.innerHTML = '<p class="mut">Could not load the leaderboard.</p>';
  }
}

async function loadMe() {
  try {
    const r = await fetch("/api/me", { headers: { authorization: S.tok } });
    if (!r.ok) return;
    const raw = await r.json(),
      d = typeof raw.xp === "object" ? raw.xp : raw, // works with the old and the fixed /api/me
      span = d.next - d.base,
      got = d.xp - d.base;
    $("#lv-pill").textContent = `Lv ${d.level} · ${rank(d.level)}`;
    $("#lv-bar").style.width = Math.round((got / span) * 100) + "%";
    $("#lv-xp").textContent = `${got} / ${span} XP to Lv ${d.level + 1}`;
  } catch {}
}

// one "list" call fills two cards: 🟢 Open rooms (waiting for a challenger) and 🔴 Live now (a match is running)
const PHASE = {
  topic: "🎰 Starting",
  lang: "🎰 Starting",
  prep: "⏳ Prep",
  code: "⌨️ Coding",
  judging: "🤖 Judging",
};
function loadLive() {
  S.sock.emit("list", (list) => {
    const MAX = 5,
      more = (n) =>
        n > MAX
          ? `<p class="mut" style="text-align:center">+${n - MAX} more</p>`
          : "";
    const open = list.filter(
        (r) => r.phase === "lobby" && r.players.length < 2,
      ),
      live = list.filter((r) => !["lobby", "result"].includes(r.phase)); // finished / full-waiting rooms are hidden

    $("#open-n").textContent = open.length;
    $("#open").innerHTML = open.length
      ? open
          .slice(0, MAX)
          .map(
            (
              r,
            ) => `<div class="lr"><span class="nm">#${r.id} · ${r.players.length ? esc(r.players[0]) : "Empty"}</span>
              <span class="mut">${r.players.length ? "waiting" : ""}</span>
              <button data-j="${r.id}">Join</button></div>`,
          )
          .join("") + more(open.length)
      : '<p class="mut">No open rooms. Create one and wait for a challenger!</p>';

    $("#live-n").textContent = live.length;
    $("#live").innerHTML = live.length
      ? live
          .slice(0, MAX)
          .map(
            (
              r,
            ) => `<div class="lr"><span class="nm">#${r.id} · ${r.players.map(esc).join(" vs ")}</span>
              <span class="mut">${PHASE[r.phase] || "Live"}${r.n ? " · 👀 " + r.n : ""}</span>
              <button data-j="${r.id}" class="ghost">👀 Watch</button></div>`,
          )
          .join("") + more(live.length)
      : '<p class="mut">No matches right now.</p>';
  });
}

function loadOnline() {
  S.sock.emit("online", (d) => {
    if (!d) return;
    const MAX = 8,
      users = [...d.users].sort((a, b) => (b.u === S.me) - (a.u === S.me)); // you first
    $("#on-n").textContent = d.total;
    $("#on-list").innerHTML = users.length
      ? users
          .slice(0, MAX)
          .map(
            (x) => `<div class="lr${x.u === S.me ? " me" : ""}">
        <span class="dot${x.busy ? " busy" : ""}"></span>
        <span class="nm">${esc(x.u)}${x.u === S.me ? " (you)" : ""}</span>
        <span class="mut">${x.busy ? "⚔️ In match" : "Online"}</span></div>`,
          )
          .join("") +
        (d.total > MAX
          ? `<p class="mut" style="text-align:center">+${d.total - MAX} more</p>`
          : "")
      : '<p class="mut">Nobody online.</p>';
  });
}

// refresh only while the Home tab is open
function homeLive(on) {
  clearInterval(homeTimer);
  if (!on) return;
  loadMe(); // fills in the level pill, XP bar and XP text under "Hi, name"
  loadBoard();
  loadLive();
  loadOnline();
  homeTimer = setInterval(() => {
    loadBoard();
    loadLive();
    loadOnline();
  }, 5000);
}

function homeInit() {
  $("#hn").textContent = S.me;
  $("#hc").onclick = createDialog;
  $("#hl").onclick = () => go("lobby");

  const idx = Math.floor(Date.now() / 864e5) % TASKS.length; // changes every day
  $("#dc-t").textContent = TASKS[idx].topic;
  $("#dc-d").textContent = TASKS[idx].task;
  $("#dc").onclick = () => {
    go("practice");
    const sel = $("#pp-topic");
    sel.value = idx;
    sel.dispatchEvent(new Event("change"));
  };

  $("#lb-tabs").onclick = (e) => {
    const b = e.target.closest("[data-m]");
    if (!b) return;
    mode = b.dataset.m;
    document
      .querySelectorAll("#lb-tabs button")
      .forEach((x) => (x.className = x.dataset.m === mode ? "" : "ghost"));
    loadBoard();
  };
  ["#open", "#live"].forEach((id) => {
    $(id).onclick = (e) => {
      const j = e.target.closest("[data-j]");
      if (j) joinRoom(j.dataset.j);
    };
  });
}

function start() {
  S.sock = io({ auth: { token: S.tok } });
  // log out ONLY when the server rejects the token. A network error (server down /
  // restarting) must NOT wipe the saved login: socket.io just retries by itself.
  S.sock.on("connect_error", (err) => {
    if (err && err.message === "auth") logout();
  });
  $("#auth").hidden = true;
  $("#app").hidden = false;
  homeInit();
  lobbyInit();
  practiceInit();
  lessonInit();
  profileInit();
  battleInit();
  document.querySelector("nav").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) go(b.dataset.tab);
  };
  go(sessionStorage.tab || "home");
  const q = new URLSearchParams(location.search),
    id = q.get("room") || sessionStorage.r;
  history.replaceState(0, "", "/");
  if (id)
    S.sock.once("connect", () => joinRoom(id, q.get("k"), !q.get("room")));
}

bgInit();
S.tok ? start() : authInit(start);
typeLogos();

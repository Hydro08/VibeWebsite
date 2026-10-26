// lobby.js — the "Arena": Solo levels + PVP rooms
import { $, esc, S } from "../core/util.js";
import { enterRoom } from "./battle.js";
import { soloInit, soloShow } from "./solo.js";

let mode = "solo",
  tab = "public",
  timer,
  active = false;

export function joinRoom(id, k, quiet) {
  S.sock.emit("join", id, k || null, (r) => {
    if (r.error) {
      sessionStorage.removeItem("r");
      if (!quiet) alert(r.error);
      return;
    }
    enterRoom(r.id);
  });
}

// create a room straight away: public or private
export function createRoom(pub) {
  S.sock.emit("create", { pub: !!pub }, (r) => {
    r.error ? alert(r.error) : enterRoom(r.id);
  });
}

// used by the Home button (no tab selected there, so ask)
export function createDialog() {
  const m = document.createElement("div");
  m.id = "modal";
  m.innerHTML = `<div class="card"><h2>Create room</h2>
    <button data-pub="1">🌐 Public<br><small>Shows in the Arena, anyone can join or watch</small></button>
    <button data-pub="0" class="ghost">🔒 Private<br><small>Only with the code or QR</small></button>
    <button class="ghost" data-x>Cancel</button></div>`;
  m.onclick = (e) => {
    if (e.target === m || e.target.closest("[data-x]")) return m.remove();
    const b = e.target.closest("[data-pub]");
    if (!b) return;
    m.remove();
    createRoom(b.dataset.pub === "1");
  };
  document.body.append(m);
}

export function lobbyInit() {
  const el = $("#v-lobby");
  el.innerHTML = `<div class="tabs"><button data-mode="solo">🎯 Solo mode</button><button data-mode="mp" class="ghost">⚔️ PVP</button></div>
    <div id="ar-solo"></div>
    <div id="ar-mp" hidden>
      <div class="tabs"><button data-t="public">🌐 Public</button><button data-t="private" class="ghost">🔒 Private</button></div>
      <div id="lb-pub" class="card"><div id="rooms" class="card" style="padding:0;border:0;background:none"></div></div>
      <div id="lb-priv" class="card" hidden><p class="mut">Have a code? Enter it, or scan the room's QR.</p>
        <div class="row"><input id="jc" inputmode="numeric" maxlength="6" placeholder="6-digit code"><button id="jb" style="flex:0 0 auto">Join</button></div></div>
      <button id="mk">+ Create room</button>
    </div>`;
  // hide the Solo/PVP switch while a level is open: go back to the levels first
  soloInit(
    $("#ar-solo"),
    (inLevel) => ($("#v-lobby > .tabs").hidden = inLevel),
  );
  el.onclick = (e) => {
    const m = e.target.closest("[data-mode]"),
      t = e.target.closest("[data-t]"),
      j = e.target.closest("[data-j]");
    if (m) setMode(m.dataset.mode);
    if (t) setTab(t.dataset.t);
    if (j) joinRoom(j.dataset.j);
  };
  // Arena: follows the selected tab → Public tab = public room, Private tab = private room
  $("#mk").onclick = () => createRoom(tab === "public");
  $("#jb").onclick = () => joinRoom($("#jc").value.trim());
}

function setMode(m) {
  mode = m;
  document
    .querySelectorAll("#v-lobby [data-mode]")
    .forEach((b) => (b.className = b.dataset.mode === m ? "" : "ghost"));
  $("#ar-solo").hidden = m !== "solo";
  $("#ar-mp").hidden = m !== "mp";
  if (active && m === "solo") soloShow();
  poll();
}
function setTab(t) {
  tab = t;
  document
    .querySelectorAll("#v-lobby [data-t]")
    .forEach((b) => (b.className = b.dataset.t === t ? "" : "ghost"));
  $("#lb-pub").hidden = t !== "public";
  $("#lb-priv").hidden = t !== "private";
  $("#mk").textContent =
    t === "public" ? "+ Create public room" : "+ Create private room";
}
function refresh() {
  S.sock.emit("list", (list) => {
    $("#rooms").innerHTML = list.length
      ? list
          .map((r) => {
            const open = r.phase === "lobby" && r.players.length < 2; // match running or full → spectate
            const who = r.players.length
              ? r.players.map(esc).join(" vs ")
              : "Empty";
            return `<div class="rr"><div><b>#${r.id}</b> · ${who}<div class="mut">${open ? "Waiting " + r.players.length + "/2" : "⚔️ In match"}${r.n ? " · 👀 " + r.n : ""}</div></div>
        <button data-j="${r.id}" ${open ? "" : 'class="ghost"'}>${open ? "Join" : "👀 Spectate"}</button></div>`;
          })
          .join("")
      : '<p class="mut">No public rooms yet. Create one!</p>';
  });
}
// poll the room list only while the Arena tab is open on PVP
function poll() {
  clearInterval(timer);
  if (active && mode === "mp") {
    refresh();
    timer = setInterval(refresh, 3000);
  }
}
export function lobbyShow(on) {
  active = on;
  if (on) {
    setMode(mode);
    setTab(tab);
  } else poll();
}

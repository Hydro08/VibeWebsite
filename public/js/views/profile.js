import { $, esc, S, logout, rank, setSession } from "../core/util.js";

export function profileInit() {
  $("#v-profile").innerHTML = "";
}

const n = (v) => Number(v) || 0;
const day = (t) =>
  t
    ? new Date(t).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

export async function profileShow() {
  const el = $("#v-profile");
  try {
    const r = await fetch("/api/me", { headers: { authorization: S.tok } });
    if (r.status === 401) return logout(); // only when the token is really invalid
    if (!r.ok) throw 0;
    const d = await r.json();

    const name = String(d.username || S.me || "?");
    const w = n(d.w),
      l = n(d.l),
      dr = n(d.d),
      streak = n(d.streak),
      best = n(d.best),
      total = w + l + dr;

    // level + xp (server sends level, xp, base, next)
    const level = n(d.level) || 1,
      xp = n(d.xp),
      base = n(d.base),
      span = Math.max(1, n(d.next) - base),
      pct = Math.min(100, Math.round(((xp - base) / span) * 100));

    const box = (v, k) =>
      `<div><b>${esc(v)}</b><span class="mut">${k}</span></div>`;

    el.innerHTML = `<div class="card"><div class="row" style="gap:14px">
        <div class="avatar" style="flex:0 0 auto">${esc(name[0].toUpperCase())}</div>
        <div><h2>${esc(name)}</h2>
          <div class="mut">Lv ${level} · ${rank(level)}</div>
          <div class="prog" style="margin:6px 0"><i style="width:${pct}%"></i></div>
          <div class="mut">${xp} XP total · ${xp - base}/${span} to Lv ${level + 1}</div>
          <div class="mut">Player joined: ${day(d.joined)}</div></div></div></div>
      <div class="card"><div class="stats">
        ${box(total, "Matches")}${box(w, "Wins")}${box(l, "Losses")}${box(dr, "Draws")}
        ${box(total ? Math.round((w / total) * 100) + "%" : "—", "Win rate")}
        ${box(streak, "Win streak")}${box(best, "Best streak")}${box(d.fav || "—", "Favorite language")}
      </div><div class="mut">Last match: ${d.last ? new Date(d.last).toLocaleString() : "—"}</div></div>
      <div class="card"><h2 style="font-size:1.1rem">Change username</h2>
        <input id="un-new" placeholder="New username (3-16: letters, numbers, _)" autocomplete="off" maxlength="16">
        <div class="err" id="un-msg" role="alert"></div>
        <button id="un-go">Change username</button>
        <div class="mut" id="un-left"></div></div>
      <div class="card"><h2 style="font-size:1.1rem">Change password</h2>
        <input id="pw-old" type="password" placeholder="Current password" autocomplete="current-password">
        <input id="pw-new" type="password" placeholder="New password (min 4)" autocomplete="new-password">
        <div class="err" id="pw-msg" role="alert"></div>
        <button id="pw-go">Update password</button></div>
      <button class="ghost" id="lo">Log out</button>`;
    $("#lo").onclick = logout;
    nameInit(d);
    $("#pw-go").onclick = async () => {
      const msg = $("#pw-msg"),
        b = $("#pw-go");
      msg.className = "err";
      msg.textContent = "";
      b.disabled = true;
      try {
        const r = await fetch("/api/password", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: S.tok },
          body: JSON.stringify({
            old: $("#pw-old").value,
            next: $("#pw-new").value,
          }),
        });
        const x = await r.json().catch(() => ({}));
        if (!r.ok) throw x.error || "Failed";
        msg.className = "mut";
        msg.textContent = "✅ Password updated";
        $("#pw-old").value = $("#pw-new").value = "";
      } catch (e) {
        msg.textContent = typeof e === "string" ? e : "Could not connect";
      }
      b.disabled = false;
    };
  } catch (e) {
    console.error("profile:", e);
    el.innerHTML = '<p class="err">Could not load profile.</p>';
  }
}

// ---------- change username (once every 24 hours, with a live countdown) ----------
let nameTimer;
function nameInit(d) {
  clearInterval(nameTimer);
  const go = $("#un-go"),
    inp = $("#un-new"),
    left = $("#un-left"),
    msg = $("#un-msg");
  const wait = () => Math.max(0, (d.nameAt || 0) + 864e5 - Date.now());
  const u = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const tick = () => {
    const w = wait(),
      h = Math.floor(w / 36e5),
      m = Math.floor((w % 36e5) / 6e4),
      s = Math.floor((w % 6e4) / 1e3);
    go.disabled = inp.disabled = w > 0;
    left.textContent =
      w > 0
        ? `⏳ ${h ? u(h, "hour") + " " + u(m, "minute") : u(m, "minute") + " " + u(s, "second")} remaining before you can change your username again.`
        : "✅ You can change your username now. After that, you can change it again once every 24 hours.";
  };
  tick();
  nameTimer = setInterval(tick, 1000);
  go.onclick = async () => {
    msg.textContent = "";
    go.disabled = true;
    try {
      const r = await fetch("/api/username", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: S.tok },
        body: JSON.stringify({ name: inp.value }),
      });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (x.nameAt) d.nameAt = x.nameAt;
        throw x.error || "Failed";
      }
      // move this browser's saved progress to the new name, then reload so everything reconnects
      const old = S.me,
        remember = !!localStorage.t;
      for (const k of Object.keys(localStorage)) {
        const mm = /^(lessons2|solo2|solved):([^:]+)(.*)$/.exec(k);
        if (mm && mm[2] === old) {
          localStorage[`${mm[1]}:${x.username}${mm[3]}`] = localStorage[k];
          localStorage.removeItem(k);
        }
      }
      setSession(S.tok, x.username, remember);
      location.reload();
    } catch (e) {
      msg.textContent = typeof e === "string" ? e : "Could not connect";
      tick();
    }
  };
}

import { $, S, setSession } from "./util.js";

const TEXT = {
  login: {
    title: "Ready to Code — log in",
    btn: "Log in",
    pw: "current-password",
  },
  signup: {
    title: "Create your account",
    btn: "Create account",
    pw: "new-password",
  },
};

export function authInit(onLogin) {
  const el = $("#auth");
  el.innerHTML = `<div class="logo">&lt;BATTLE OF THE CODERS/&gt;</div>
  <div class="card">
    <div class="tabs"><button id="tl">Log in</button><button id="ts">Sign up</button></div>
    <h2 id="at" style="font-size:1.3rem"></h2>
    <input id="u" placeholder="Username" autocomplete="username">
    <input id="p" type="password" placeholder="Password">
    <label class="rm"><input type="checkbox" id="rm"> Remember me</label>
    <div class="err" id="err" role="alert"></div>
    <button id="go"></button>
  </div>`;

  let mode = "login";
  const setMode = (m) => {
    mode = m;
    const t = TEXT[m];
    $("#err").textContent = "";
    $("#at").textContent = t.title;
    $("#go").textContent = t.btn;
    $("#p").autocomplete = t.pw;
    $("#tl").className = m === "login" ? "" : "ghost";
    $("#ts").className = m === "signup" ? "" : "ghost";
  };

  async function submit() {
    const err = $("#err"),
      btn = $("#go"),
      remember = $("#rm").checked;
    err.textContent = "";
    btn.disabled = true;
    try {
      const r = await fetch("/api/" + mode, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: $("#u").value,
          password: $("#p").value,
          remember,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!d)
        throw "Server not reachable. Open the site through the Node server (http://localhost:3000).";
      if (!r.ok) throw d.error;
      setSession(d.token, d.username, remember);
      onLogin();
    } catch (e) {
      err.textContent =
        typeof e === "string" ? e : "Could not connect. Is the server running?";
    }
    btn.disabled = false;
  }

  $("#tl").onclick = () => setMode("login");
  $("#ts").onclick = () => setMode("signup");
  $("#go").onclick = submit;
  ["#u", "#p"].forEach((s) =>
    $(s).addEventListener("keydown", (e) => e.key === "Enter" && submit()),
  );
  setMode("login");
  el.hidden = false;
}

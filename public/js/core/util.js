export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
export const LANGS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Lua",
  "C",
  "C++",
  "C#",
  "Java",
  "Go",
  "Rust",
  "Kotlin",
]; // keep in sync with server/game.js
export const TOPICS = [
  "Hello World",
  "FizzBuzz",
  "Palindrome check",
  "Prime numbers",
  "Reverse a string",
  "Factorial",
  "Count vowels",
  "Fibonacci",
  "Sum 1 to N",
];
// shared app state: socket, session and screen switchers (set by main.js)
export const S = {
  me: localStorage.u || sessionStorage.u,
  tok: localStorage.t || sessionStorage.t,
  sock: null,
  room: false,
};
// remember = true → survives closing the browser
export function setSession(t, u, remember) {
  ["t", "u"].forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  const st = remember ? localStorage : sessionStorage;
  st.t = t;
  st.u = u;
  S.tok = t;
  S.me = u;
}
export const logout = () => {
  fetch("/api/logout", {
    method: "POST",
    headers: { authorization: S.tok || "" },
    keepalive: true,
  }).catch(() => {});
  localStorage.removeItem("t");
  localStorage.removeItem("u");
  sessionStorage.clear();
  location.href = "/";
};
// editor helper: Tab / auto-indent / auto-close brackets & quotes; optionally block paste/drop (battle mode)
const IND = "  "; // one indent level (change to "    " for 4 spaces)
const PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
const CLOSERS = new Set([")", "]", "}", '"', "'", "`"]);

export function editor(ta, { noPaste = false, onInput } = {}) {
  // execCommand keeps Ctrl+Z undo working and fires the normal "input" event
  const ins = (t) => document.execCommand("insertText", false, t);
  const caret = (i) => (ta.selectionStart = ta.selectionEnd = i);

  ta.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const s = ta.selectionStart,
      en = ta.selectionEnd,
      v = ta.value,
      before = v[s - 1],
      after = v[s];

    if (e.key === "Tab") {
      e.preventDefault();
      return ins(IND);
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
      const indent = line.match(/^[ \t]*/)[0];
      const t = line.trimEnd();
      // between a pair like {|} → put the closer on its own line, cursor in the middle
      if (
        s === en &&
        before &&
        after &&
        "{[(".includes(before) &&
        PAIRS[before] === after
      ) {
        ins("\n" + indent + IND + "\n" + indent);
        return caret(s + 1 + indent.length + IND.length);
      }
      // after { ( [ or a trailing ":" (Python, etc.) → indent one more level
      return ins("\n" + indent + (/[{(\[:]$/.test(t) ? IND : ""));
    }

    // Backspace inside an empty pair {} () "" deletes both
    if (
      e.key === "Backspace" &&
      s === en &&
      before &&
      after &&
      PAIRS[before] === after
    ) {
      e.preventDefault();
      ta.setSelectionRange(s - 1, s + 1);
      return document.execCommand("delete");
    }

    // typing a closer right before the same closer just steps over it
    if (CLOSERS.has(e.key) && s === en && after === e.key) {
      e.preventDefault();
      return caret(s + 1);
    }

    // auto-close brackets and quotes (wrap the selection if there is one)
    if (PAIRS[e.key]) {
      if (s !== en) {
        e.preventDefault();
        return ins(e.key + v.slice(s, en) + PAIRS[e.key]);
      }
      const isQuote = e.key === PAIRS[e.key];
      if (after && !/[\s)\]}]/.test(after)) return; // text right after the cursor
      if (isQuote && before && /\w/.test(before)) return; // e.g. don't
      e.preventDefault();
      ins(e.key + PAIRS[e.key]);
      caret(s + 1);
    }
  });

  // auto-dedent: when you finish typing else / elif / except / finally on its own line,
  // it snaps back to the same indent as the matching if / try above it
  const OPENER = /^(if|elif|else|for|while|try|except)\b/;
  ta.addEventListener("input", (e) => {
    if (e.inputType !== "insertText" || !/^[a-z]$/i.test(e.data || "")) return;
    const v = ta.value,
      p = ta.selectionStart;
    if (p !== ta.selectionEnd) return;
    const ls = v.lastIndexOf("\n", p - 1) + 1,
      le = v.indexOf("\n", p),
      end = le < 0 ? v.length : le;
    if (v.slice(p, end).trim()) return; // only when the caret is at the end of the line
    const m = v.slice(ls, p).match(/^([ \t]*)(else|elif|except|finally)$/);
    if (!m || !m[1]) return;
    const cur = m[1].length;
    const above = ls ? v.slice(0, ls - 1).split("\n") : [];
    let target = null;
    for (let i = above.length - 1; i >= 0; i--) {
      const l = above[i];
      if (!l.trim()) continue;
      const ind = l.match(/^[ \t]*/)[0];
      if (ind.length > cur) continue; // still inside the body
      if (ind.length === cur) {
        if (OPENER.test(l.trim())) return; // already lined up with its if
        continue;
      }
      if (OPENER.test(l.trim())) target = ind; // found the matching if / try
      break;
    }
    if (target === null) return;
    ta.setSelectionRange(ls, ls + cur);
    if (target) ins(target);
    else document.execCommand("delete");
    caret(ls + target.length + m[2].length);
  });

  if (noPaste)
    ["paste", "drop", "cut"].forEach((t) =>
      ta.addEventListener(t, (e) => e.preventDefault()),
    );
  if (onInput) ta.addEventListener("input", onInput);
}

export const rank = (lv) =>
  lv >= 15
    ? "👑 Legend"
    : lv >= 10
      ? "🏆 Master"
      : lv >= 6
        ? "🔥 Veteran"
        : lv >= 3
          ? "⚔️ Challenger"
          : "🌱 Rookie";

export function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

// ask the server for XP; it only pays once per key
export async function award(key) {
  try {
    const r = await fetch("/api/xp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: S.tok },
      body: JSON.stringify({ key }),
    });
    const d = await r.json();
    if (!r.ok) return null;
    if (d.gained)
      toast(`+${d.gained} XP` + (d.up ? ` · 🎉 Level ${d.level}!` : ""));
    return d;
  } catch {
    return null;
  }
}

// shake (and vibrate on phones) an element, e.g. a locked lesson or level
export function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth; // restart the animation
  el.classList.add("shake");
  navigator.vibrate?.(80);
}

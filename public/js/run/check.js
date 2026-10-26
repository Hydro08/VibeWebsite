// check.js — runs the code and compares its output with what the task expects
import { runCode } from "./run.js";
import { esc } from "../core/util.js";

const norm = (s) =>
  String(s || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();

// runs the code and compares its output with `expect`; returns true when correct
export async function checkInto(
  btn,
  outEl,
  msgEl,
  lang,
  code,
  expect,
  stdin = "",
) {
  btn.disabled = true;
  msgEl.innerHTML = "";
  outEl.className = "out";
  outEl.textContent = "Checking…";
  const r = await runCode(lang, code, undefined, stdin);
  outEl.textContent =
    ((r.out || "") + (r.err ? "\n❌ " + r.err : "")).trim() || "(no output)";
  let ok = false;
  if (r.err) {
    outEl.classList.add("bad");
    msgEl.innerHTML =
      '<p class="err">Fix the error first, then Check again.</p>';
  } else if (norm(r.out) === norm(expect)) {
    ok = true;
    msgEl.innerHTML = '<p class="ok">✅ Correct! Nice work.</p>';
  } else {
    msgEl.innerHTML = `<p class="err">Not quite. Your output should be:</p><pre class="out">${esc(expect)}</pre>`;
  }
  btn.disabled = false;
  return ok;
}

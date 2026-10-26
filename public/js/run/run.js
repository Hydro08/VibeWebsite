let w = null,
  seq = 0,
  chain = Promise.resolve();
const warm = new Set(),
  pending = new Map();

function kill(msg) {
  // stop the worker (timeout / crash) and fail whatever was waiting
  if (w) w.terminate();
  w = null;
  warm.clear();
  pending.forEach((f) => f({ out: "", err: msg, fail: true }));
  pending.clear();
}
function worker() {
  if (w) return w;
  w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  w.onmessage = (e) => {
    const f = pending.get(e.data.id);
    if (f) f(e.data);
  };
  w.onerror = () =>
    kill("Could not start the code runner (check your internet or browser).");
  return w;
}
const exec = (lang, code, proj, stdin) =>
  new Promise((resolve) => {
    const id = ++seq,
      x = worker();
    const limit = warm.has(lang) || lang === "JavaScript" ? 5000 : 60000; // first use downloads the runtime
    const t = setTimeout(() => kill("⏱ Timed out — infinite loop?"), limit);
    pending.set(id, (d) => {
      clearTimeout(t);
      pending.delete(id);
      if (!d.fail) warm.add(lang);
      resolve(d);
    });
    x.postMessage({ id, lang, code, proj, stdin });
  });

// ---------- remote compilers (godbolt) for C, C++, C#, Java, Go, Rust, Kotlin ----------
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const txt = (a) => strip((a || []).map((x) => x.text).join("\n"));

// language name → godbolt language id, which compiler to pick, extra args
const REMOTE = {
  C: { id: "c", pick: /gcc \d/, args: "-O1 -std=c17" },
  "C++": { id: "c++", pick: /gcc \d/, args: "-O1 -std=c++20" },
  "C#": { id: "csharp", pick: /\.net/i, args: "" },
  Java: { id: "java", pick: /java|jdk/i, args: "" },
  Go: { id: "go", pick: /gc \d|go \d/i, args: "" },
  Rust: { id: "rust", pick: /rustc \d|rust \d/i, args: "-O" },
  Kotlin: { id: "kotlin", pick: /kotlin/i, args: "" },
};
export const REMOTE_LANGS = Object.keys(REMOTE);

const ver = (c) =>
  (c.semver || c.name.match(/[\d.]+/)?.[0] || "0").split(".").map(Number);
const cmp = (a, b) => {
  const x = ver(a),
    y = ver(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0);
  return 0;
};
// skip non-x86 / experimental builds
const BAD =
  /arm|aarch|risc|mips|ppc|power|sparc|s390|msp430|avr|loongarch|m68k|sh4|bpf|hexagon|xtensa|tricore|vax|z80|wasm|cross|gccrs|trunk|snapshot|nightly|assert|\(/i;
const compilerIds = {};
async function compilerId(lang) {
  if (compilerIds[lang]) return compilerIds[lang];
  const cfg = REMOTE[lang];
  const r = await fetch(
    `https://godbolt.org/api/compilers/${cfg.id}?fields=id,name,semver`,
    { headers: { accept: "application/json" } },
  );
  const list = await r.json();
  const named = list.filter((c) => cfg.pick.test(c.name));
  const pool = [
    named.filter(
      (c) => /x86/i.test(c.name) && !BAD.test(c.name.replace(/^x86-64/i, "")),
    ),
    named.filter((c) => !BAD.test(c.name)),
    named,
    list,
  ].find((t) => t.length);
  const best = pool && pool.sort(cmp)[0];
  if (!best) throw new Error("no compiler");
  console.log("compiler:", lang, "→", best.name, best.id); // para makita mo kung ano ang napili
  return (compilerIds[lang] = best.id);
}

async function runRemote(lang, code, stdin = "") {
  if (!code.trim()) return { out: "", err: "" };
  const cfg = REMOTE[lang],
    ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), 25000);
  try {
    const id = await compilerId(lang);
    const r = await fetch(`https://godbolt.org/api/compiler/${id}/compile`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        source: code,
        lang: cfg.id,
        options: {
          userArguments: cfg.args,
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
          executeParameters: { args: [], stdin },
        },
      }),
    });
    const d = await r.json();
    if (d.buildResult && d.buildResult.code !== 0)
      return { out: "", err: "Compile error:\n" + txt(d.buildResult.stderr) };
    const out = (txt(d.stdout) + "\n" + txt(d.stderr)).trim(),
      raw = txt(d.stdout); // untouched, so a prompt like "Name: " keeps its trailing space
    return d.code
      ? { out, raw, err: "Exited with code " + d.code }
      : { out, raw };
  } catch (e) {
    return {
      out: "",
      err:
        e.name === "AbortError"
          ? "⏱ Timed out"
          : `Could not reach the ${lang} compiler (check your internet).`,
    };
  } finally {
    clearTimeout(t);
  }
}

// ---------- modules: C / C++ get their local #include "x.h" pasted in (and x.c / x.cpp next to it) ----------
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const norm = (p) => {
  const o = [];
  for (const s of p.split("/")) {
    if (!s || s === ".") continue;
    if (s === "..") o.pop();
    else o.push(s);
  }
  return o.join("/");
};
function bundleC(entry, files) {
  const seen = new Set();
  const inline = (path) => {
    if (seen.has(path)) return "";
    seen.add(path);
    return files[path]
      .replace(/^[ \t]*#[ \t]*pragma[ \t]+once.*$/gm, "")
      .replace(/^[ \t]*#[ \t]*include[ \t]*"([^"]+)"[^\n]*$/gm, (m, inc) => {
        const a = norm(dirOf(path) ? dirOf(path) + "/" + inc : inc),
          hit = a in files ? a : norm(inc) in files ? norm(inc) : null;
        if (!hit) return m;
        let body = inline(hit);
        const stem = hit.replace(/\.(h|hpp|hh)$/i, "");
        if (stem !== hit)
          for (const e of [".c", ".cpp", ".cc"])
            if (stem + e in files && stem + e !== entry)
              body += "\n" + inline(stem + e);
        return body;
      });
  };
  return inline(entry);
}

// one run at a time, so output never mixes between runs
// proj = { files: { "path/a.py": "code", … }, entry: "path/of/the/file/being/run" } (Freedom mode only)
export const runCode = (lang, code, proj, stdin = "") =>
  (chain = chain.then(() => {
    if (REMOTE[lang]) {
      const src =
        proj && (lang === "C" || lang === "C++") && proj.entry in proj.files
          ? bundleC(proj.entry, { ...proj.files, [proj.entry]: code })
          : code;
      return runRemote(lang, src, stdin);
    }
    return exec(lang, code, proj, stdin);
  }));
// download the runtimes in the background so Run is fast later
export const preload = () =>
  ["Python", "Lua", "TypeScript"].forEach((l) => runCode(l, ""));

// does this program read from the keyboard? (cin, Scanner, input(), io.read …)
const READS = {
  C: /\b(scanf|fscanf|gets|fgets|getchar|getline)\s*\(/,
  "C++": /\b(cin|scanf|getchar|getline)\b/,
  "C#": /Console\s*\.\s*(ReadLine|Read|ReadKey)\s*\(/,
  Java: /\bScanner\b|BufferedReader|System\.in\b/,
  Go: /fmt\.(Scan|Fscan)|bufio\.New(Reader|Scanner)/,
  Rust: /\bstdin\s*\(/,
  Kotlin: /\b(readLine|readln|readInt)\b|\bScanner\b|System\.in\b/,
  Python: /\binput\s*\(|sys\.stdin/,
  Lua: /\bio\.(read|lines)\b/,
};
// the program stopped because it wanted more input than was typed (not a real error)
const WAITING =
  /EOFError|NoSuchElementException|InputMismatchException|end of file|unexpected EOF|EOF when reading|@@BC_WAIT@@/i;
// languages where we can tell exactly where the program asked for input
const DETECT = ["C++", "Python", "Java", "Lua"];
// C++: swap cin's buffer for one that, when it runs out of typed input, prints a marker and stops.
// (#line 1 keeps your compile-error line numbers right)
const CIN_HOOK =
  '#include <iostream>\n#include <cstdio>\n#include <cstdlib>\nnamespace bc_ { struct B : std::streambuf { std::streambuf* o; B(std::streambuf* x) : o(x) {} int_type underflow() override { int_type c = o->sgetc(); if (c == traits_type::eof()) { std::cout.flush(); std::fputs("@@BC_WAIT@@", stdout); std::fflush(stdout); std::_Exit(0); } return c; } int_type uflow() override { underflow(); return o->sbumpc(); } }; struct I { I() { static B b(std::cin.rdbuf()); std::cin.rdbuf(&b); } } i_; }\n#line 1\n';

// Programs that read input behave like a terminal: the output stops where the program asks, and you
// type right there. The remote compilers have no live keyboard, so every Enter runs the program
// again from the start with everything typed so far.
async function consoleRun(btn, outEl, lang, code, proj) {
  const lines = [], // what you typed
    pos = []; // where in the output each value was asked for
  let cur = "", // output of the last run
    waiting = false;
  const draw = (busy) => {
    outEl.className = "out";
    const nodes = [];
    let at = 0;
    const add = (t, cls) => {
      if (!t) return;
      const sp = document.createElement("span");
      if (cls) sp.className = cls;
      sp.textContent = t;
      nodes.push(sp);
    };
    lines.forEach((l, j) => {
      const p = Math.min(pos[j] ?? Infinity, cur.length);
      add(cur.slice(at, p));
      add(l + "\n", "con-typed");
      at = p;
    });
    add(cur.slice(at));
    if (waiting && !busy) {
      const inp = document.createElement("input");
      inp.className = "con-in";
      inp.autocapitalize = "off";
      inp.autocomplete = "off";
      inp.spellcheck = false;
      inp.enterKeyHint = "send";
      const fit = () =>
        (inp.style.width = Math.max(2, inp.value.length + 1) + "ch");
      fit();
      inp.oninput = fit;
      inp.onkeydown = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        lines.push(inp.value);
        go();
      };
      nodes.push(inp);
      outEl.onclick = (e) => e.target === outEl && inp.focus();
    }
    if (lines.length && !busy) {
      const rs = document.createElement("button");
      rs.className = "con-reset";
      rs.textContent = "⟲ restart";
      rs.onclick = () => {
        lines.length = pos.length = 0;
        go();
      };
      nodes.push(document.createTextNode("\n"), rs);
    }
    outEl.replaceChildren(...nodes);
    if (waiting && !busy)
      outEl.querySelector(".con-in").focus({ preventScroll: true });
  };
  const go = async () => {
    btn.disabled = true;
    if (lines.length) draw(true);
    else outEl.textContent = "Running…";
    const src = lang === "C++" ? CIN_HOOK + code : code;
    const r = await runCode(
      lang,
      src,
      proj,
      lines.length ? lines.join("\n") + "\n" : "",
    );
    const hit = WAITING.test(
      (r.raw ?? r.out ?? "") + " " + (r.err || "") + " " + (r.out || ""),
    );
    waiting = DETECT.includes(lang) ? hit : true; // others: always leave a line to type on
    let text = (r.raw ?? r.out ?? "").replace(/@@BC_WAIT@@/g, "");
    if (!waiting || !DETECT.includes(lang)) {
      if (r.err && !hit) {
        const extra = (r.out || "").replace(/@@BC_WAIT@@/g, "");
        text = (r.raw !== undefined ? extra : text) + "\n❌ " + r.err;
      }
    }
    if (hit && !r.raw) text = text.replace(/\n?Traceback[\s\S]*$/, ""); // Python: hide the EOF traceback
    cur = text;
    if (waiting)
      pos[lines.length] = DETECT.includes(lang) ? text.length : Infinity;
    draw(false);
    if (r.err && !hit) outEl.classList.add("bad");
    btn.disabled = false;
  };
  go();
}

export async function runInto(btn, outEl, lang, code, proj) {
  if (READS[lang] && READS[lang].test(code))
    return consoleRun(btn, outEl, lang, code, proj);
  btn.disabled = true;
  outEl.className = "out";
  outEl.textContent = "Running…";
  const r = await runCode(lang, code, proj);
  outEl.textContent =
    ((r.out || "") + (r.err ? "\n❌ " + r.err : "")).trim() || "(no output)";
  if (r.err) outEl.classList.add("bad");
  btn.disabled = false;
}

// Freedom mode — a mini VS Code: explorer, tabs, themed editor with line numbers,
// output panel and status bar. Files are saved in this browser (localStorage, per user).
import { $, esc, S, editor } from "../core/util.js";
import { runInto, preload } from "../run/run.js";
import { attachHighlight } from "../editor/highlight.js";

const EXT = {
  py: "Python",
  js: "JavaScript",
  ts: "TypeScript",
  lua: "Lua",
  c: "C",
  cpp: "C++",
  cs: "C#",
  java: "Java",
  go: "Go",
  rs: "Rust",
  kt: "Kotlin",
  h: "C", // headers: can be #included, not run
  hpp: "C++",
};
const NORUN = ["h", "hpp"];
const HELLO = {
  py: 'print("Hello, BattleCoder!")\n',
  js: 'console.log("Hello, BattleCoder!");\n',
  ts: 'const msg: string = "Hello, BattleCoder!";\nconsole.log(msg);\n',
  lua: 'print("Hello, BattleCoder!")\n',
  c: '#include <stdio.h>\n\nint main() {\n  printf("Hello, BattleCoder!\\n");\n  return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, BattleCoder!" << std::endl;\n  return 0;\n}\n',
  cs: 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, BattleCoder!");\n  }\n}\n',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, BattleCoder!");\n  }\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, BattleCoder!")\n}\n',
  rs: 'fn main() {\n  println!("Hello, BattleCoder!");\n}\n',
  kt: 'fun main() {\n  println("Hello, BattleCoder!")\n}\n',
  h: "#pragma once\n\nint add(int a, int b);\n",
  hpp: "#pragma once\n\nint add(int a, int b);\n",
};
const ext = (n) => (n.split(".").pop() || "").toLowerCase();
const langOf = (n) => EXT[ext(n)] || "";
const KEY = () => "bc_free_v1_" + (S.me || "guest");

const base = (p) => p.split("/").pop();
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const join = (d, n) => (d ? d + "/" + n : n);
const SEG = /^[\w][\w.-]{0,40}$/;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY()));
    if (d && Array.isArray(d.files)) {
      d.folders = Array.isArray(d.folders)
        ? d.folders.filter((x) => typeof x === "string")
        : [];
      d.collapsed = Array.isArray(d.collapsed) ? d.collapsed : [];
      d.sel = typeof d.sel === "string" ? d.sel : "";
      d.open = (d.open || []).filter((n) => d.files.some((f) => f.name === n));
      if (!d.files.some((f) => f.name === d.active))
        d.active = d.open[0] || null;
      return d;
    }
  } catch {}
  return {
    files: [
      { name: "main.py", code: HELLO.py },
      { name: "main.js", code: HELLO.js },
      { name: "projects/hello.py", code: HELLO.py },
    ],
    folders: ["projects"],
    collapsed: [],
    sel: "",
    open: ["main.py"],
    active: "main.py",
  };
}

export function freedomInit(root) {
  const st = load();
  root.innerHTML = `<div class="vsc">
    <div class="vsc-title">
      <span class="vsc-dots"><i style="background:#ef4444"></i><i style="background:#facc15"></i><i style="background:#22c55e"></i></span>
      <b>BattleCoder — Freedom</b>
      <button id="fr-run" title="Run (Ctrl+Enter)">▶ Run</button>
    </div>
    <div class="vsc-body">
      <aside class="vsc-side">
        <div class="vsc-sh"><span>EXPLORER</span><span><button class="mini" id="fr-new" title="New file">📄＋</button><button class="mini" id="fr-newdir" title="New folder">📁＋</button></span></div>
        <div id="fr-err" class="vsc-err"></div>
        <div id="fr-files" class="vsc-files"></div>
      </aside>
      <section class="vsc-main">
        <div id="fr-tabs" class="vsc-tabs"></div>
        <div class="vsc-ed"><textarea id="fr-code" class="code" spellcheck="false" placeholder="Create or open a file…"></textarea></div>
        <div class="vsc-panel">
          <div class="vsc-ph"><span>OUTPUT</span><button class="mini" id="fr-clear" title="Clear output">🗑</button></div>
          <pre id="fr-out" class="out">Press ▶ Run (or Ctrl+Enter) to run the active file.</pre>
        </div>
      </section>
    </div>
    <div class="vsc-status"><span id="fr-lang">—</span><span id="fr-pos">Ln 1, Col 1</span><span>Spaces: 2</span><span>UTF-8</span><span id="fr-save" class="vsc-save">Saved ✓</span></div>
  </div>
  <p class="mut vsc-help">Files and folders are saved in this browser. Run runs the active file and it can import your other files (Python <code>import</code>, JS/TS <code>import</code> / <code>require</code>, Lua <code>require</code>, C/C++ <code>#include "x.h"</code>). Other languages run as a single file. Supported: ${Object.keys(
    EXT,
  )
    .map((e) => "." + e)
    .join(" ")}</p>`;

  const ta = $("#fr-code", root),
    out = $("#fr-out", root),
    runBtn = $("#fr-run", root);
  const cur = () => st.files.find((f) => f.name === st.active) || null;
  const hl = attachHighlight(ta, {
    lang: () => (cur() ? langOf(cur().name) : ""),
    gutter: true,
  });
  editor(ta);

  // ----- saving -----
  let saveT;
  const saved = $("#fr-save", root);
  const persist = () => {
    saved.textContent = "● Saving…";
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY(), JSON.stringify(st));
        saved.textContent = "Saved ✓";
      } catch {
        saved.textContent = "⚠ Could not save";
      }
    }, 250);
  };
  const err = (m) => {
    const e = $("#fr-err", root);
    e.textContent = m;
    clearTimeout(err.t);
    err.t = setTimeout(() => (e.textContent = ""), 3500);
  };

  // ----- rendering -----
  const badge = (n) =>
    `<span class="vi" data-x="${esc(ext(n))}">${esc(ext(n))}</span>`;
  const allDirs = () => {
    const set = new Set();
    const add = (p) => {
      const parts = p.split("/");
      for (let i = 1; i <= parts.length; i++)
        set.add(parts.slice(0, i).join("/"));
    };
    st.folders.forEach(add);
    st.files.forEach((f) => dirOf(f.name) && add(dirOf(f.name)));
    return [...set];
  };
  const hasName = (p) =>
    st.files.some((f) => f.name === p) || allDirs().includes(p);
  function renderSide() {
    const dirs = allDirs(),
      out = [];
    const walk = (dir, depth) => {
      dirs
        .filter((d) => dirOf(d) === dir)
        .sort((x, y) => base(x).localeCompare(base(y)))
        .forEach((d) => {
          const shut = st.collapsed.includes(d);
          out.push(`<div class="vsc-dir${st.sel === d ? " sel" : ""}" data-d="${esc(d)}" style="padding-left:${8 + depth * 14}px">
            <span class="chev">${shut ? "▸" : "▾"}</span><span class="fi">${shut ? "📁" : "📂"}</span><span class="nm">${esc(base(d))}</span>
            <span class="acts"><button class="mini" data-do="nf" title="New file here">📄</button><button class="mini" data-do="nd" title="New folder here">📁</button><button class="mini" data-do="rn" title="Rename">✎</button><button class="mini" data-do="rm" title="Delete folder">✕</button></span></div>`);
          if (!shut) walk(d, depth + 1);
        });
      st.files
        .filter((f) => dirOf(f.name) === dir)
        .sort((x, y) => x.name.localeCompare(y.name))
        .forEach((f) =>
          out.push(`<div class="vsc-file${f.name === st.active ? " on" : ""}" data-n="${esc(f.name)}" style="padding-left:${8 + depth * 14 + 14}px">
            ${badge(f.name)}<span class="nm">${esc(base(f.name))}</span>
            <span class="acts"><button class="mini" data-do="rn" title="Rename">✎</button><button class="mini" data-do="rm" title="Delete">✕</button></span></div>`),
        );
    };
    walk("", 0);
    $("#fr-files", root).innerHTML =
      out.join("") ||
      '<p class="mut" style="padding:8px 10px">No files yet. Press 📄＋ to create one.</p>';
  }
  function renderTabs() {
    $("#fr-tabs", root).innerHTML = st.open
      .map(
        (n) =>
          `<div class="vsc-tab${n === st.active ? " on" : ""}" data-n="${esc(n)}" title="${esc(n)}">${badge(n)}<span>${esc(base(n))}</span><button class="mini" data-do="x" title="Close">×</button></div>`,
      )
      .join("");
  }
  function status() {
    const f = cur();
    $("#fr-lang", root).textContent = f ? langOf(f.name) + " · " + f.name : "—";
    const p = ta.selectionStart,
      before = ta.value.slice(0, p).split("\n");
    $("#fr-pos", root).textContent =
      `Ln ${before.length}, Col ${before.at(-1).length + 1}`;
  }
  let warmed = false;
  function show() {
    const f = cur();
    ta.value = f ? f.code : "";
    ta.disabled = !f;
    runBtn.disabled = !f;
    renderSide();
    renderTabs();
    hl.update();
    status();
    if (
      f &&
      !warmed &&
      ["Python", "Lua", "TypeScript"].includes(langOf(f.name))
    ) {
      warmed = true;
      preload(); // download the runtimes in the background
    }
  }

  // ----- actions -----
  // validates a full path ("a/b/c.py" or a folder "a/b"); skip = the path being renamed
  const check = (p, isDir, skip) => {
    const parts = p.split("/");
    if (p.length > 90 || parts.some((x) => !SEG.test(x)))
      return "Use letters, numbers, . - _ only (use / for folders)";
    if (!isDir && !EXT[ext(p)])
      return (
        "Unsupported type — use " +
        Object.keys(EXT)
          .map((e) => "." + e)
          .join(" ")
      );
    for (let i = 1; i < parts.length; i++)
      if (st.files.some((f) => f.name === parts.slice(0, i).join("/")))
        return "A file with that name is in the way";
    if (p !== skip && hasName(p)) return "That name already exists";
    return "";
  };
  const addDirs = (p) => {
    const parts = p.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const d = parts.slice(0, i).join("/");
      if (!st.folders.includes(d)) st.folders.push(d);
    }
  };
  const open = (n) => {
    if (!st.open.includes(n)) st.open.push(n);
    st.active = n;
    st.sel = dirOf(n);
    show();
    persist();
  };
  function close(n) {
    const i = st.open.indexOf(n);
    if (i < 0) return;
    st.open.splice(i, 1);
    if (st.active === n)
      st.active = st.open[Math.min(i, st.open.length - 1)] || null;
    show();
    persist();
  }
  function remove(n) {
    if (!confirm(`Delete ${n}?`)) return;
    st.files = st.files.filter((f) => f.name !== n);
    st.open = st.open.filter((x) => x !== n);
    if (st.active === n) st.active = st.open.at(-1) || null;
    show();
    persist();
  }
  function removeDir(d) {
    const inside = (p) => p === d || p.startsWith(d + "/");
    const n = st.files.filter((f) => inside(f.name)).length;
    if (
      !confirm(
        `Delete folder "${d}"${n ? ` and its ${n} file${n > 1 ? "s" : ""}` : ""}?`,
      )
    )
      return;
    st.files = st.files.filter((f) => !inside(f.name));
    st.folders = st.folders.filter((x) => !inside(x));
    st.collapsed = st.collapsed.filter((x) => !inside(x));
    st.open = st.open.filter((x) => !inside(x));
    if (inside(st.active || "")) st.active = st.open.at(-1) || null;
    if (inside(st.sel)) st.sel = dirOf(d);
    show();
    persist();
  }
  function renameDir(d, nd) {
    const mv = (p) =>
      p === d ? nd : p.startsWith(d + "/") ? nd + p.slice(d.length) : p;
    st.files.forEach((f) => (f.name = mv(f.name)));
    st.folders = st.folders.map(mv);
    st.collapsed = st.collapsed.map(mv);
    st.open = st.open.map(mv);
    if (st.active) st.active = mv(st.active);
    st.sel = mv(st.sel);
    addDirs(nd);
    show();
    persist();
  }
  // small inline text box (new file / new folder / rename). tmp = host is a throw-away row
  function ask(host, value, done, all = false, tmp = false) {
    const i = document.createElement("input");
    i.className = "vsc-in";
    i.value = value;
    i.maxLength = 60;
    let fin = false;
    const end = (ok) => {
      if (fin) return;
      fin = true;
      const v = i.value.trim();
      i.remove();
      if (tmp) host.remove();
      if (ok && v && v !== value) done(v);
      else show();
    };
    i.onkeydown = (e) => {
      if (e.key === "Enter") end(true);
      else if (e.key === "Escape") end(false);
    };
    i.onblur = () => end(true);
    host.prepend(i);
    i.focus();
    i.setSelectionRange(
      0,
      all || !value.includes(".") ? value.length : value.lastIndexOf("."),
    );
  }
  // where a new row's input goes: top of the explorer (root) or right under the folder
  function slot(dir) {
    const list = $("#fr-files", root);
    if ($(".vsc-in", list)) return null;
    if (!dir) return { host: list, tmp: false };
    if (st.collapsed.includes(dir)) {
      st.collapsed = st.collapsed.filter((x) => x !== dir);
      renderSide();
    }
    const row = [...list.querySelectorAll(".vsc-dir")].find(
      (r) => r.dataset.d === dir,
    );
    if (!row) return { host: list, tmp: false };
    const t = document.createElement("div");
    t.className = "vsc-newrow";
    t.style.paddingLeft = (parseInt(row.style.paddingLeft) || 8) + 14 + "px";
    row.after(t);
    return { host: t, tmp: true };
  }
  function newFile(dir) {
    const sl = slot(dir);
    if (!sl) return;
    ask(
      sl.host,
      "untitled.py",
      (n) => {
        const p = join(dir, n),
          m = check(p, false);
        if (m) return (err(m), show());
        if (dirOf(p)) addDirs(dirOf(p));
        st.files.push({ name: p, code: HELLO[ext(p)] || "" });
        open(p);
      },
      true,
      sl.tmp,
    );
  }
  function newDir(dir) {
    const sl = slot(dir);
    if (!sl) return;
    ask(
      sl.host,
      "new-folder",
      (n) => {
        const p = join(dir, n),
          m = check(p, true);
        if (m) return (err(m), show());
        addDirs(p);
        st.sel = p;
        show();
        persist();
      },
      true,
      sl.tmp,
    );
  }

  $("#fr-new", root).onclick = () => newFile(st.sel);
  $("#fr-newdir", root).onclick = () => newDir(st.sel);
  $("#fr-files", root).onclick = (e) => {
    const act = e.target.closest("[data-do]")?.dataset.do;
    const dr = e.target.closest(".vsc-dir");
    if (dr) {
      const d = dr.dataset.d;
      if (act === "nf") return newFile(d);
      if (act === "nd") return newDir(d);
      if (act === "rm") return removeDir(d);
      if (act === "rn")
        return ask(dr, base(d), (v) => {
          const p = join(dirOf(d), v),
            m = check(p, true, d);
          if (m) return (err(m), show());
          if (p === d) return show();
          if (p.startsWith(d + "/"))
            return (err("Can't move a folder into itself"), show());
          renameDir(d, p);
        });
      // plain click: open / close the folder and make it the target for new files
      st.sel = d;
      st.collapsed = st.collapsed.includes(d)
        ? st.collapsed.filter((x) => x !== d)
        : [...st.collapsed, d];
      renderSide();
      return persist();
    }
    const row = e.target.closest(".vsc-file");
    if (!row) return;
    const n = row.dataset.n;
    if (act === "rm") return remove(n);
    if (act === "rn")
      return ask(row, base(n), (v) => {
        const p = join(dirOf(n), v),
          m = check(p, false, n);
        if (m) return (err(m), show());
        if (dirOf(p)) addDirs(dirOf(p));
        const f = st.files.find((x) => x.name === n);
        f.name = p;
        st.open = st.open.map((x) => (x === n ? p : x));
        if (st.active === n) st.active = p;
        show();
        persist();
      });
    open(n);
  };
  $("#fr-tabs", root).onclick = (e) => {
    const t = e.target.closest(".vsc-tab");
    if (!t) return;
    if (e.target.closest("[data-do=x]")) close(t.dataset.n);
    else if (t.dataset.n !== st.active) open(t.dataset.n);
  };
  $("#fr-clear", root).onclick = () => {
    out.className = "out";
    out.textContent = "";
  };

  ta.addEventListener("input", () => {
    const f = cur();
    if (f) f.code = ta.value;
    persist();
    status();
  });
  ["keyup", "click", "focus"].forEach((ev) => ta.addEventListener(ev, status));

  const run = () => {
    const f = cur();
    if (!f || runBtn.disabled) return;
    const lang = langOf(f.name);
    if (NORUN.includes(ext(f.name))) {
      out.className = "out bad";
      out.textContent =
        "ℹ️ Header files can't be run. #include it from a .c / .cpp file and run that one.";
      return;
    }
    if (!lang) {
      out.className = "out bad";
      out.textContent = "❌ Can't run ." + ext(f.name) + " files.";
      return;
    }
    runInto(runBtn, out, lang, f.code, {
      files: Object.fromEntries(st.files.map((x) => [x.name, x.code])),
      entry: f.name,
    });
  };
  runBtn.onclick = run;
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); // autosave already — just stop the browser's "save page" dialog
      clearTimeout(saveT);
      persist();
    }
  });

  show();
}

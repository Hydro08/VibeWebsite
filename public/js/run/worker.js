// Module worker: runs player code off the main thread so infinite loops can be terminated.
// Runtimes load lazily from a CDN the first time each language is used.
const CDN = "https://cdn.jsdelivr.net";
let py = null,
  lua = null,
  sucrase = null;

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const txt = (a) => strip((a || []).map((x) => x.text).join("\n"));
async function runCpp(code) {
  if (!code.trim()) return { out: "", err: "" };
  const ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch("https://godbolt.org/api/compiler/g142/compile", {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        source: code,
        lang: "c++",
        options: {
          userArguments: "-O1 -std=c++17",
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
          executeParameters: { args: [], stdin: "" },
        },
      }),
    });
    const d = await r.json();
    if (d.buildResult && d.buildResult.code !== 0)
      return { out: "", err: "Compile error:\n" + txt(d.buildResult.stderr) };
    const out = (txt(d.stdout) + "\n" + txt(d.stderr)).trim();
    return d.code ? { out, err: "Exited with code " + d.code } : { out };
  } catch (e) {
    return {
      out: "",
      err:
        e.name === "AbortError"
          ? "⏱ Timed out"
          : "Could not reach the C++ compiler (check your internet).",
    };
  } finally {
    clearTimeout(t);
  }
}

const fmt = (x) => {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};
const runJS = (code, con) =>
  new Function("console", `"use strict";return (async()=>{${code}\n})()`)(con);

// ---------- modules (Freedom mode): import / require / from x import y between your own files ----------
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
const USES_MODULES = /^\s*(import|export)\b|\brequire\s*\(|\bimport\s*\(/m;
// JS / TS files -> CommonJS (sucrase turns import/export into require), then a tiny require() that
// only knows your project files
async function runModules(proj, code, con) {
  sucrase ??= await import(CDN + "/npm/sucrase@3.35.0/+esm");
  const files = { ...proj.files, [proj.entry]: code },
    cache = {},
    conv = (path) =>
      sucrase.transform(files[path], {
        transforms: /\.ts$/.test(path)
          ? ["typescript", "imports"]
          : ["imports"],
      }).code;
  const find = (from, spec) => {
    const b = norm(spec.startsWith("/") ? spec : dirOf(from) + "/" + spec),
      alt = b.replace(/\.(js|mjs)$/, "");
    for (const c of [
      b,
      b + ".js",
      b + ".ts",
      b + "/index.js",
      b + "/index.ts",
      alt + ".ts",
    ])
      if (c in files) return c;
    return null;
  };
  const req = (from) => (spec) => {
    if (!/^\.{0,2}\//.test(spec) && !spec.startsWith("."))
      throw new Error(
        `Cannot find module '${spec}' (you can only import your own files)`,
      );
    const path = find(from, spec);
    if (!path) throw new Error(`Cannot find module '${spec}' (from ${from})`);
    if (cache[path]) return cache[path].exports;
    const m = (cache[path] = { exports: {} });
    new Function("require", "module", "exports", "console", conv(path))(
      req(path),
      m,
      m.exports,
      con,
    );
    return m.exports;
  };
  const m = { exports: {} };
  await new Function(
    "require",
    "module",
    "exports",
    "console",
    `return (async()=>{${conv(proj.entry)}\n})()`,
  )(req(proj.entry), m, m.exports, con);
}

self.onmessage = async (e) => {
  const { id, lang, code, proj, stdin = "" } = e.data,
    out = [];
  const log = (...a) => out.push(a.map(fmt).join(" "));
  const con = { log, info: log, warn: log, error: log };
  try {
    if (lang === "JavaScript" && !(proj && USES_MODULES.test(code)))
      await runJS(code, con);
    else if (lang === "JavaScript" || lang === "TypeScript") {
      if (proj) await runModules(proj, code, con);
      else {
        sucrase ??= await import(CDN + "/npm/sucrase@3.35.0/+esm");
        await runJS(
          sucrase.transform(code, { transforms: ["typescript"] }).code,
          con,
        );
      }
    } else if (lang === "Lua") {
      if (!lua) {
        const { LuaFactory } = await import(CDN + "/npm/wasmoon@1.16.0/+esm");
        lua = await new LuaFactory(
          CDN + "/npm/wasmoon@1.16.0/dist/glue.wasm",
        ).createEngine();
      }
      lua.global.set("print", (...a) => out.push(a.map(String).join("\t")));
      // io.read() reads from the Input box
      lua.global.set("__stdin", stdin);
      await lua.doString(`local buf, pos = __stdin, 1
io.read = function(fmt)
  fmt = tostring(fmt or "l"):gsub("^%*", "")
  if pos > #buf then error("EOFError: waiting for input", 0) end -- the console shows a line to type on
  if fmt == "a" then local r = buf:sub(pos); pos = #buf + 1; return r end
  if fmt == "n" then
    local s, e = buf:find("^%s*[-+]?%d*%.?%d+", pos)
    if not s then return nil end
    pos = e + 1
    return tonumber((buf:sub(s, e):gsub("%s", "")))
  end
  local e = buf:find("\n", pos, true)
  local line = buf:sub(pos, (e or #buf + 1) - 1)
  pos = (e or #buf) + 1
  if fmt == "L" then line = line .. "\n" end
  return line
end`);
      // forget modules from the last run, then mount this project so require("utils") / require("lib.math") works
      await lua.doString(
        `__base = __base or (function() local t = {} for k in pairs(package.loaded) do t[k] = true end return t end)()
         for k in pairs(package.loaded) do if not __base[k] then package.loaded[k] = nil end end`,
      );
      if (proj) {
        const dir = "/p" + id,
          here = dir + (dirOf(proj.entry) ? "/" + dirOf(proj.entry) : "");
        for (const [n, c] of Object.entries(proj.files))
          lua.mountFile(dir + "/" + n, n === proj.entry ? code : c);
        lua.global.set(
          "__dirs",
          `${here}/?.lua;${here}/?/init.lua;${dir}/?.lua;${dir}/?/init.lua`,
        );
        await lua.doString(`package.path = __dirs .. ";" .. package.path`);
      }
      await lua.doString(code);
    } else {
      if (!py) {
        const { loadPyodide } = await import(
          CDN + "/pyodide/v0.26.4/full/pyodide.mjs"
        );
        py = await loadPyodide({ indexURL: CDN + "/pyodide/v0.26.4/full/" });
      }
      const pyOut = []; // raw bytes: keeps a prompt like "Name: " (no newline) and its trailing space
      py.setStdout({ raw: (b) => pyOut.push(b) });
      py.setStderr({ batched: (s) => out.push(s) });
      const lines = stdin ? stdin.split("\n") : []; // input() reads one line per call
      py.setStdin({ stdin: () => (lines.length ? lines.shift() : null) });
      // every run starts clean: fresh __main__, and your project files are put in /proj so
      // "import utils" / "from lib.math import add" find them
      const g = py.globals.get("dict")();
      g.set("__name__", "__main__");
      py.globals.set("__root", "/proj");
      py.runPython(
        `import sys, shutil
shutil.rmtree(__root, ignore_errors=True)
for _m in [k for k, v in list(sys.modules.items()) if str(getattr(v, "__file__", "") or "").startswith(__root + "/")]:
    del sys.modules[_m]
sys.path[:] = [p for p in sys.path if not p.startswith(__root)]`,
      );
      if (proj) {
        for (const [n, c] of Object.entries(proj.files)) {
          const full = "/proj/" + n;
          py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
          py.FS.writeFile(full, n === proj.entry ? code : c);
        }
        const here =
          "/proj" + (dirOf(proj.entry) ? "/" + dirOf(proj.entry) : "");
        py.globals.set("__here", here);
        py.runPython(
          `import sys, os, importlib
sys.path[:0] = [__here, __root] if __here != __root else [__root]
os.chdir(__here)
importlib.invalidate_caches()`,
        );
        g.set("__file__", "/proj/" + proj.entry);
      }
      try {
        await py.runPythonAsync(code, { globals: g });
      } finally {
        g.destroy();
        if (pyOut.length)
          out.push(new TextDecoder().decode(Uint8Array.from(pyOut)));
      }
    }
    self.postMessage({ id, out: out.join("\n") });
  } catch (err) {
    self.postMessage({
      id,
      out: out.join("\n"),
      err: String((err && err.message) || err),
    });
  }
};

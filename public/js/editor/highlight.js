// Syntax highlighting + code themes for the editors.
// attachHighlight(textarea) draws coloured code behind a transparent <textarea>,
// so typing, undo, selection and the existing editor() helper keep working as before.
import { esc } from "../core/util.js";

// ---------- themes (5 for now: add more in THEMES + the [data-ed] blocks in style.css) ----------
export const THEMES = [
  { id: "neon", name: "Neon (default)" },
  { id: "dracula", name: "Dracula" },
  { id: "monokai", name: "Monokai" },
  { id: "nord", name: "Nord" },
  { id: "tokyo", name: "Tokyo Night" },
  { id: "catppuccin", name: "Catppuccin" },
  { id: "onedark", name: "One Dark" },
  { id: "gruvbox", name: "Gruvbox" },
  { id: "solarized", name: "Solarized" },
  { id: "synthwave", name: "Synthwave" },
  { id: "ayu", name: "Ayu" },
  { id: "github", name: "GitHub Dark" },
  { id: "matrix", name: "Matrix" },
  { id: "sunset", name: "Sunset" },
];
const KEY = "bc_theme";
export const getTheme = () => {
  try {
    const t = localStorage.getItem(KEY);
    return THEMES.some((x) => x.id === t) ? t : "neon";
  } catch {
    return "neon";
  }
};
export const setTheme = (id, root) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  if (root) root.dataset.ed = id;
};

// ---------- language definitions ----------
const w = (s) => new Set(s.split(/\s+/).filter(Boolean));
const C_LIKE = { line: "//", block: true, meta: false };
const DEFS = {
  Python: {
    line: "#",
    tri: true,
    deco: true,
    kw: w(
      "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case",
    ),
    lit: w("True False None self cls"),
  },
  JavaScript: {
    ...C_LIKE,
    sq: true,
    tpl: true,
    kw: w(
      "async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch throw try typeof var void while with yield get set",
    ),
    lit: w("true false null undefined this NaN Infinity"),
  },
  TypeScript: {
    ...C_LIKE,
    sq: true,
    tpl: true,
    deco: true,
    kw: w(
      "abstract as async await break case catch class const continue declare default delete do else enum export extends finally for from function if implements import in instanceof interface keyof let namespace new of private protected public readonly return static super switch throw try type typeof var void while yield get set",
    ),
    lit: w("true false null undefined this NaN Infinity"),
    types: w("string number boolean any unknown never object symbol bigint"),
  },
  Lua: {
    line: "--",
    luaBlock: true,
    kw: w(
      "and break do else elseif end for function goto if in local not or repeat return then until while",
    ),
    lit: w("true false nil self"),
  },
  C: {
    ...C_LIKE,
    pre: true,
    kw: w(
      "auto break case const continue default do else enum extern for goto if inline register return sizeof static struct switch typedef union volatile while",
    ),
    lit: w("NULL true false"),
    types: w(
      "int char float double long short unsigned signed void size_t bool FILE",
    ),
  },
  "C++": {
    ...C_LIKE,
    pre: true,
    kw: w(
      "alignas auto break case catch class const constexpr continue default delete do else enum explicit export extern for friend goto if inline mutable namespace new noexcept operator private protected public return sizeof static struct switch template this throw try typedef typename union using virtual volatile while override final",
    ),
    lit: w("nullptr NULL true false this"),
    types: w(
      "int char float double long short unsigned signed void bool string vector map set size_t auto",
    ),
  },
  "C#": {
    ...C_LIKE,
    pre: true,
    deco: true,
    kw: w(
      "abstract as async await base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly ref return sealed sizeof static struct switch throw try typeof unchecked unsafe using virtual volatile while var get set",
    ),
    lit: w("true false null this"),
    types: w(
      "int long short byte char float double decimal bool string object void uint ulong",
    ),
  },
  Java: {
    ...C_LIKE,
    deco: true,
    kw: w(
      "abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized throw throws transient try var volatile while",
    ),
    lit: w("true false null this"),
    types: w("int long short byte char float double boolean void String"),
  },
  Go: {
    ...C_LIKE,
    tpl: true,
    kw: w(
      "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var",
    ),
    lit: w("true false nil iota"),
    types: w(
      "int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any",
    ),
  },
  Rust: {
    ...C_LIKE,
    kw: w(
      "as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return static struct super trait type unsafe use where while",
    ),
    lit: w("true false self Self None Some Ok Err"),
    types: w(
      "i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box",
    ),
    rust: true,
  },
  Kotlin: {
    ...C_LIKE,
    deco: true,
    tpl: false,
    kw: w(
      "abstract as break by catch class companion const constructor continue data do else enum final finally for fun if import in infix init inline inner interface internal is lateinit object open operator out override package private protected public return sealed super suspend this throw try typealias val var vararg when where while",
    ),
    lit: w("true false null this"),
    types: w("Int Long Short Byte Char Float Double Boolean String Unit Any"),
  },
};

// ---------- tokenizer: builds one regex per language, cached ----------
const cache = {};
function build(lang) {
  if (cache[lang]) return cache[lang];
  const d = DEFS[lang];
  if (!d) return (cache[lang] = null);
  const src = [];
  // 1 comment
  const cm = [];
  if (d.luaBlock) cm.push("--\\[\\[[\\s\\S]*?(?:\\]\\]|$)");
  if (d.block) cm.push("\\/\\*[\\s\\S]*?(?:\\*\\/|$)");
  cm.push(d.line.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "[^\\n]*");
  src.push("(" + cm.join("|") + ")");
  // 2 string
  const st = [];
  if (d.tri) st.push('"""[\\s\\S]*?(?:"""|$)', "'''[\\s\\S]*?(?:'''|$)");
  if (d.luaBlock) st.push("\\[\\[[\\s\\S]*?(?:\\]\\]|$)");
  if (d.tpl) st.push("`(?:\\\\[\\s\\S]|[^`\\\\])*(?:`|$)");
  st.push('"(?:\\\\.|[^"\\\\\\n])*"?');
  if (d.block && !d.sq)
    // char literal only when it closes (so Rust lifetimes like 'a don't swallow the line)
    st.push("'(?:\\\\[^'\\n]*|[^'\\\\\\n])'");
  else st.push("'(?:\\\\.|[^'\\\\\\n])*'?");
  src.push("(" + st.join("|") + ")");
  // 4 meta (#include / #define, @decorators)
  const mt = [];
  if (d.pre) mt.push("^[ \\t]*#[ \\t]*[a-z]+");
  if (d.deco) mt.push("@[A-Za-z_][\\w.]*");
  src.push(mt.length ? "(" + mt.join("|") + ")" : "(?!)()");
  // 5 number
  src.push(
    "(\\b0[xX][\\da-fA-F_]+[a-zA-Z]*\\b|\\b0[bB][01_]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[a-zA-Z]*\\b|\\.\\d+\\b)",
  );
  // 6 identifier   7 operator
  src.push("([A-Za-z_$][\\w$]*)", "([-+*/%=<>!&|^~?:]+)");
  return (cache[lang] = { d, re: new RegExp(src.join("|"), "gm") });
}

export function highlight(code, lang) {
  const b = build(lang);
  if (!b) return esc(code);
  const { d, re } = b;
  re.lastIndex = 0;
  let out = "",
    last = 0,
    m;
  while ((m = re.exec(code))) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    out += esc(code.slice(last, m.index));
    last = m.index + m[0].length;
    const t = m[0];
    let cls = "";
    // groups: 1 comment, 2 string, 3 meta, 4 number, 5 identifier, 6 operator
    if (m[1] !== undefined) cls = "c";
    else if (m[2] !== undefined) cls = "s";
    else {
      if (m[3] !== undefined) cls = "m";
      else if (m[4] !== undefined) cls = "n";
      else if (m[5] !== undefined) {
        if (d.kw.has(t)) cls = "k";
        else if (d.lit && d.lit.has(t)) cls = "l";
        else if (d.types && d.types.has(t)) cls = "t";
        else if (/^\s*\(/.test(code.slice(last, last + 24))) cls = "f";
        else if (/^[A-Z][A-Za-z0-9_]*$/.test(t) && /[a-z]/.test(t)) cls = "t";
      } else if (m[6] !== undefined) cls = "o";
    }
    out += cls ? `<span class="t-${cls}">${esc(t)}</span>` : esc(t);
  }
  return out + esc(code.slice(last));
}

// ---------- editor overlay ----------
// opts.lang: () => language name   opts.gutter: show line numbers
export function attachHighlight(ta, { lang = () => "", gutter = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "hl" + (gutter ? " has-gut" : "");
  ta.parentNode.insertBefore(wrap, ta);
  const stack = document.createElement("div");
  stack.className = "hl-stack";
  const pre = document.createElement("pre");
  pre.className = "hl-pre";
  pre.setAttribute("aria-hidden", "true");
  const inner = document.createElement("div");
  inner.className = "hl-in";
  pre.append(inner);
  let gut = null,
    gin = null;
  if (gutter) {
    gut = document.createElement("div");
    gut.className = "hl-gut";
    gin = document.createElement("div");
    gin.className = "hl-gin";
    gut.append(gin);
    wrap.append(gut);
  }
  stack.append(pre, ta);
  wrap.append(stack);
  ta.classList.add("hl-ta");
  ta.setAttribute("wrap", "off");

  let lines = 0;
  const update = () => {
    const v = ta.value;
    inner.innerHTML = highlight(v, lang()) + "\n ";
    if (gin) {
      const n = v.split("\n").length;
      if (n !== lines) {
        lines = n;
        gin.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
      }
    }
    sync();
  };
  const sync = () => {
    const x = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    inner.style.transform = x;
    if (gin) gin.style.transform = `translateY(${-ta.scrollTop}px)`;
  };
  ta.addEventListener("input", update);
  ta.addEventListener("scroll", sync);
  new ResizeObserver(sync).observe(ta);
  update();
  return { update, wrap };
}

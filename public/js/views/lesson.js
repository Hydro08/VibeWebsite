import { $, esc, S, LANGS, editor, toast, shake } from "../core/util.js";
import { runInto, preload } from "../run/run.js";
import { checkInto } from "../run/check.js";

// ---------- boilerplate per language ----------
const I = (s, n) =>
  s
    .split("\n")
    .map((l) => (l ? " ".repeat(n) + l : l))
    .join("\n");
const T = (t) => (t ? t + "\n\n" : "");
const W = {
  C: (b, t) =>
    `#include <stdio.h>\n\n${T(t)}int main(void) {\n${I(b, 2)}\n  return 0;\n}\n`,
  "C++": (b, t) =>
    `#include <iostream>\n#include <string>\n#include <vector>\n\n${T(t)}int main() {\n${I(b, 2)}\n}\n`,
  "C#": (b, t) =>
    `using System;\n\nclass Program {\n${t ? I(t, 2) + "\n\n" : ""}  static void Main() {\n${I(b, 4)}\n  }\n}\n`,
  Java: (b, t) =>
    `public class Main {\n${t ? I(t, 2) + "\n\n" : ""}  public static void main(String[] args) {\n${I(b, 4)}\n  }\n}\n`,
  Go: (b, t) =>
    `package main\n\nimport "fmt"\n\n${T(t)}func main() {\n${I(b, 2)}\n}\n`,
  Rust: (b, t) => `${T(t)}fn main() {\n${I(b, 4)}\n}\n`,
  Kotlin: (b, t) => `${T(t)}fun main() {\n${I(b, 2)}\n}\n`,
};
const plain = (b, t) => T(t) + b + "\n"; // Python, JavaScript, TypeScript, Lua
const build = (lang, body, top = "") => (W[lang] || plain)(body, top);
const comment = (lang) => ({ Python: "#", Lua: "--" })[lang] || "//";
export const starter = (lang) => build(lang, comment(lang) + " your code here");

// ---------- lessons (body = code inside main, top = code above main) ----------
const LESSONS = [
  {
    title: "Hello World",
    icon: "👋",
    text: "Every programmer starts by printing text to the screen. Each language has its own print command.",
    task: "Print exactly: Hello, Battle Coder!",
    expect: "Hello, Battle Coder!",
    body: {
      Python: 'print("Hello, World!")',
      JavaScript: 'console.log("Hello, World!");',
      TypeScript: 'console.log("Hello, World!");',
      Lua: 'print("Hello, World!")',
      C: 'printf("Hello, World!\\n");',
      "C++": 'std::cout << "Hello, World!" << std::endl;',
      "C#": 'Console.WriteLine("Hello, World!");',
      Java: 'System.out.println("Hello, World!");',
      Go: 'fmt.Println("Hello, World!")',
      Rust: 'println!("Hello, World!");',
      Kotlin: 'println("Hello, World!")',
    },
  },
  {
    title: "Variables",
    icon: "📦",
    text: "A variable is a named box that stores a value, like text (a string) or a number.",
    task: 'Create name = "Ana" and age = 20, then print exactly: Ana is 20',
    expect: "Ana is 20",
    body: {
      Python: 'name = "Sam"\nage = 30\nprint(name, "is", age)',
      JavaScript:
        'const name = "Sam";\nconst age = 30;\nconsole.log(name + " is " + age);',
      TypeScript:
        'const name: string = "Sam";\nconst age: number = 30;\nconsole.log(`${name} is ${age}`);',
      Lua: 'local name = "Sam"\nlocal age = 30\nprint(name .. " is " .. age)',
      C: 'char name[] = "Sam";\nint age = 30;\nprintf("%s is %d\\n", name, age);',
      "C++":
        'std::string name = "Sam";\nint age = 30;\nstd::cout << name << " is " << age << "\\n";',
      "C#": 'string name = "Sam";\nint age = 30;\nConsole.WriteLine(name + " is " + age);',
      Java: 'String name = "Sam";\nint age = 30;\nSystem.out.println(name + " is " + age);',
      Go: 'name := "Sam"\nage := 30\nfmt.Println(name, "is", age)',
      Rust: 'let name = "Sam";\nlet age = 30;\nprintln!("{} is {}", name, age);',
      Kotlin: 'val name = "Sam"\nval age = 30\nprintln("$name is $age")',
    },
  },
  {
    title: "If / Else",
    icon: "🔀",
    text: "Use if to choose what to do based on a condition. The % operator gives the remainder: 10 % 2 is 0, so 10 is even.",
    task: 'Set n = 10. Print "even" if n is even, otherwise print "odd".',
    expect: "even",
    body: {
      Python: 'n = 3\nif n > 5:\n    print("big")\nelse:\n    print("small")',
      JavaScript:
        'const n = 3;\nif (n > 5) {\n  console.log("big");\n} else {\n  console.log("small");\n}',
      TypeScript:
        'const n: number = 3;\nif (n > 5) {\n  console.log("big");\n} else {\n  console.log("small");\n}',
      Lua: 'local n = 3\nif n > 5 then\n  print("big")\nelse\n  print("small")\nend',
      C: 'int n = 3;\nif (n > 5) {\n  printf("big\\n");\n} else {\n  printf("small\\n");\n}',
      "C++":
        'int n = 3;\nif (n > 5) {\n  std::cout << "big\\n";\n} else {\n  std::cout << "small\\n";\n}',
      "C#": 'int n = 3;\nif (n > 5) {\n  Console.WriteLine("big");\n} else {\n  Console.WriteLine("small");\n}',
      Java: 'int n = 3;\nif (n > 5) {\n  System.out.println("big");\n} else {\n  System.out.println("small");\n}',
      Go: 'n := 3\nif n > 5 {\n  fmt.Println("big")\n} else {\n  fmt.Println("small")\n}',
      Rust: 'let n = 3;\nif n > 5 {\n    println!("big");\n} else {\n    println!("small");\n}',
      Kotlin:
        'val n = 3\nif (n > 5) {\n  println("big")\n} else {\n  println("small")\n}',
    },
  },
  {
    title: "Loops",
    icon: "🔁",
    text: "A loop repeats code. The examples below print 0, 1, 2 — your task is a slightly different range.",
    task: "Print the numbers 1 to 5, one per line.",
    expect: "1\n2\n3\n4\n5",
    body: {
      Python: "for i in range(3):\n    print(i)",
      JavaScript: "for (let i = 0; i < 3; i++) {\n  console.log(i);\n}",
      TypeScript: "for (let i = 0; i < 3; i++) {\n  console.log(i);\n}",
      Lua: "for i = 0, 2 do\n  print(i)\nend",
      C: 'for (int i = 0; i < 3; i++) {\n  printf("%d\\n", i);\n}',
      "C++": 'for (int i = 0; i < 3; i++) {\n  std::cout << i << "\\n";\n}',
      "C#": "for (int i = 0; i < 3; i++) {\n  Console.WriteLine(i);\n}",
      Java: "for (int i = 0; i < 3; i++) {\n  System.out.println(i);\n}",
      Go: "for i := 0; i < 3; i++ {\n  fmt.Println(i)\n}",
      Rust: 'for i in 0..3 {\n    println!("{}", i);\n}',
      Kotlin: "for (i in 0..2) {\n  println(i)\n}",
    },
  },
  {
    title: "Functions",
    icon: "🧩",
    text: "A function is a reusable piece of code with inputs (parameters) and an output (return value). Define it above main — in Java and C# it goes inside the class, as a static method.",
    task: "Write a function add(a, b) that returns a + b, then print add(2, 3).",
    expect: "5",
    top: {
      Python: "def twice(x):\n    return x * 2",
      JavaScript: "function twice(x) {\n  return x * 2;\n}",
      TypeScript: "function twice(x: number): number {\n  return x * 2;\n}",
      Lua: "function twice(x)\n  return x * 2\nend",
      C: "int twice(int x) {\n  return x * 2;\n}",
      "C++": "int twice(int x) {\n  return x * 2;\n}",
      "C#": "static int Twice(int x) {\n  return x * 2;\n}",
      Java: "static int twice(int x) {\n  return x * 2;\n}",
      Go: "func twice(x int) int {\n  return x * 2\n}",
      Rust: "fn twice(x: i32) -> i32 {\n    x * 2\n}",
      Kotlin: "fun twice(x: Int): Int {\n  return x * 2\n}",
    },
    body: {
      Python: "print(twice(4))",
      JavaScript: "console.log(twice(4));",
      TypeScript: "console.log(twice(4));",
      Lua: "print(twice(4))",
      C: 'printf("%d\\n", twice(4));',
      "C++": 'std::cout << twice(4) << "\\n";',
      "C#": "Console.WriteLine(Twice(4));",
      Java: "System.out.println(twice(4));",
      Go: "fmt.Println(twice(4))",
      Rust: 'println!("{}", twice(4));',
      Kotlin: "println(twice(4))",
    },
  },
  {
    title: "Lists / Arrays",
    icon: "📚",
    text: "A list (or array) holds many values in one variable. You can read its length and loop over it.",
    task: "Given nums = [1, 2, 3, 4], print the sum of all the numbers.",
    expect: "10",
    body: {
      Python: "nums = [1, 2, 3]\nprint(len(nums))",
      JavaScript: "const nums = [1, 2, 3];\nconsole.log(nums.length);",
      TypeScript:
        "const nums: number[] = [1, 2, 3];\nconsole.log(nums.length);",
      Lua: "local nums = {1, 2, 3}\nprint(#nums)",
      C: 'int nums[] = {1, 2, 3};\nprintf("%d\\n", (int)(sizeof(nums) / sizeof(nums[0])));',
      "C++":
        'std::vector<int> nums = {1, 2, 3};\nstd::cout << nums.size() << "\\n";',
      "C#": "int[] nums = {1, 2, 3};\nConsole.WriteLine(nums.Length);",
      Java: "int[] nums = {1, 2, 3};\nSystem.out.println(nums.length);",
      Go: "nums := []int{1, 2, 3}\nfmt.Println(len(nums))",
      Rust: 'let nums = vec![1, 2, 3];\nprintln!("{}", nums.len());',
      Kotlin: "val nums = listOf(1, 2, 3)\nprintln(nums.size)",
    },
  },
  {
    title: "While Loops",
    icon: "♻️",
    text: "A while loop keeps repeating as long as its condition is true. Don't forget to change the variable, or it will run forever!",
    task: "Use a loop to print 5 down to 1, one per line.",
    expect: "5\n4\n3\n2\n1",
    body: {
      Python: "i = 1\nwhile i <= 3:\n    print(i)\n    i += 1",
      JavaScript: "let i = 1;\nwhile (i <= 3) {\n  console.log(i);\n  i++;\n}",
      TypeScript: "let i = 1;\nwhile (i <= 3) {\n  console.log(i);\n  i++;\n}",
      Lua: "local i = 1\nwhile i <= 3 do\n  print(i)\n  i = i + 1\nend",
      C: 'int i = 1;\nwhile (i <= 3) {\n  printf("%d\\n", i);\n  i++;\n}',
      "C++":
        'int i = 1;\nwhile (i <= 3) {\n  std::cout << i << "\\n";\n  i++;\n}',
      "C#": "int i = 1;\nwhile (i <= 3) {\n  Console.WriteLine(i);\n  i++;\n}",
      Java: "int i = 1;\nwhile (i <= 3) {\n  System.out.println(i);\n  i++;\n}",
      Go: "i := 1\nfor i <= 3 { // Go uses for as its while\n  fmt.Println(i)\n  i++\n}",
      Rust: 'let mut i = 1;\nwhile i <= 3 {\n    println!("{}", i);\n    i += 1;\n}',
      Kotlin: "var i = 1\nwhile (i <= 3) {\n  println(i)\n  i++\n}",
    },
  },
  {
    title: "Strings",
    icon: "🔤",
    text: "A string is text. Every language can tell you its length, which counts every character including spaces.",
    task: 'Print the length of the string "Battle Coder".',
    expect: "12",
    top: { C: "#include <string.h>" },
    body: {
      Python: 's = "hello"\nprint(len(s))',
      JavaScript: 'const s = "hello";\nconsole.log(s.length);',
      TypeScript: 'const s: string = "hello";\nconsole.log(s.length);',
      Lua: 'local s = "hello"\nprint(#s)',
      C: 'char s[] = "hello";\nprintf("%d\\n", (int)strlen(s));',
      "C++": 'std::string s = "hello";\nstd::cout << s.size() << "\\n";',
      "C#": 'string s = "hello";\nConsole.WriteLine(s.Length);',
      Java: 'String s = "hello";\nSystem.out.println(s.length());',
      Go: 's := "hello"\nfmt.Println(len(s))',
      Rust: 'let s = "hello";\nprintln!("{}", s.len());',
      Kotlin: 'val s = "hello"\nprintln(s.length)',
    },
  },
  {
    title: "Nested Loops",
    icon: "🪆",
    text: "A loop inside a loop. The inner loop runs completely for every step of the outer loop.",
    task: "Use nested loops to print i * j for i = 1..3 and j = 1..3, one result per line (1, 2, 3, 2, 4, 6, 3, 6, 9).",
    expect: "1\n2\n3\n2\n4\n6\n3\n6\n9",
    body: {
      Python:
        "for i in range(1, 3):\n    for j in range(1, 3):\n        print(i * j)",
      JavaScript:
        "for (let i = 1; i <= 2; i++) {\n  for (let j = 1; j <= 2; j++) {\n    console.log(i * j);\n  }\n}",
      TypeScript:
        "for (let i = 1; i <= 2; i++) {\n  for (let j = 1; j <= 2; j++) {\n    console.log(i * j);\n  }\n}",
      Lua: "for i = 1, 2 do\n  for j = 1, 2 do\n    print(i * j)\n  end\nend",
      C: 'for (int i = 1; i <= 2; i++) {\n  for (int j = 1; j <= 2; j++) {\n    printf("%d\\n", i * j);\n  }\n}',
      "C++":
        'for (int i = 1; i <= 2; i++) {\n  for (int j = 1; j <= 2; j++) {\n    std::cout << i * j << "\\n";\n  }\n}',
      "C#": "for (int i = 1; i <= 2; i++) {\n  for (int j = 1; j <= 2; j++) {\n    Console.WriteLine(i * j);\n  }\n}",
      Java: "for (int i = 1; i <= 2; i++) {\n  for (int j = 1; j <= 2; j++) {\n    System.out.println(i * j);\n  }\n}",
      Go: "for i := 1; i <= 2; i++ {\n  for j := 1; j <= 2; j++ {\n    fmt.Println(i * j)\n  }\n}",
      Rust: 'for i in 1..=2 {\n    for j in 1..=2 {\n        println!("{}", i * j);\n    }\n}',
      Kotlin:
        "for (i in 1..2) {\n  for (j in 1..2) {\n    println(i * j)\n  }\n}",
    },
  },
  {
    title: "Recursion",
    icon: "🌀",
    text: "A recursive function calls itself on a smaller problem until it reaches a base case (the stopping point). Example: factorial(4) = 4 × 3 × 2 × 1.",
    task: "Write a recursive function sumTo(n) that returns n + (n-1) + ... + 1, then print sumTo(10).",
    expect: "55",
    top: {
      Python:
        "def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)",
      JavaScript:
        "function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}",
      TypeScript:
        "function fact(n: number): number {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}",
      Lua: "function fact(n)\n  if n <= 1 then return 1 end\n  return n * fact(n - 1)\nend",
      C: "int fact(int n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}",
      "C++":
        "int fact(int n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}",
      "C#": "static int Fact(int n) {\n  if (n <= 1) return 1;\n  return n * Fact(n - 1);\n}",
      Java: "static int fact(int n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}",
      Go: "func fact(n int) int {\n  if n <= 1 {\n    return 1\n  }\n  return n * fact(n-1)\n}",
      Rust: "fn fact(n: i32) -> i32 {\n    if n <= 1 {\n        return 1;\n    }\n    n * fact(n - 1)\n}",
      Kotlin:
        "fun fact(n: Int): Int {\n  if (n <= 1) return 1\n  return n * fact(n - 1)\n}",
    },
    body: {
      Python: "print(fact(4))",
      JavaScript: "console.log(fact(4));",
      TypeScript: "console.log(fact(4));",
      Lua: "print(fact(4))",
      C: 'printf("%d\\n", fact(4));',
      "C++": 'std::cout << fact(4) << "\\n";',
      "C#": "Console.WriteLine(Fact(4));",
      Java: "System.out.println(fact(4));",
      Go: "fmt.Println(fact(4))",
      Rust: 'println!("{}", fact(4));',
      Kotlin: "println(fact(4))",
    },
  },
];

// ---------- state + progress (saved per user and per language) ----------
let cur = null,
  lang = "Python",
  el;
const key = () => `lessons2:${S.me}:${lang}`; // "lessons2": progress restarted for everyone (old one had a bug)
const done = () => {
  try {
    return JSON.parse(localStorage[key()] || "[]");
  } catch {
    return [];
  }
};
// a lesson opens only after the one before it is completed
const unlocked = (d, i) => i === 0 || d.includes(i - 1) || d.includes(i);
const markDone = (i) => {
  const d = done();
  if (!d.includes(i)) d.push(i);
  try {
    localStorage[key()] = JSON.stringify(d);
  } catch {}
};
const langSel = () =>
  `<select data-lang>${LANGS.map((l) => `<option${l === lang ? " selected" : ""}>${l}</option>`).join("")}</select>`;

export function lessonInit() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("lessons:"))
    .forEach((k) => localStorage.removeItem(k)); // wipe old progress
  el = $("#v-lesson");
  el.onclick = (e) => {
    const o = e.target.closest("[data-l]");
    if (o && o.classList.contains("locked")) {
      shake(o);
      return toast(`🔒 Finish lesson ${+o.dataset.l} first`);
    }
    if (o) return open(+o.dataset.l);
    if (e.target.closest("[data-back]")) return list();
    if (e.target.closest("[data-next]")) return open(cur + 1);
  };
  el.onchange = (e) => {
    if (!e.target.matches("[data-lang]")) return;
    lang = e.target.value;
    preload();
    cur === null ? list() : open(cur);
  };
}
export function lessonShow() {
  preload(); // warm up the runtimes so the first Run is faster
  if (cur === null) list();
}

function list() {
  cur = null;
  const d = done(),
    pct = Math.round((d.length / LESSONS.length) * 100);
  el.innerHTML = `<div class="card"><h2>📚 Lessons</h2>
    <p class="mut">Learn a concept, write code, then Check your answer. ${d.length}/${LESSONS.length} completed in ${esc(lang)}.</p>
    ${langSel()}
    <div class="prog"><i style="width:${pct}%"></i></div></div>
    <div class="lessons">${LESSONS.map(
      (
        l,
        i,
      ) => `<button class="lc ghost${unlocked(d, i) ? "" : " locked"}" data-l="${i}"${unlocked(d, i) ? "" : ' aria-disabled="true"'}>
        <span class="lic">${unlocked(d, i) ? l.icon : "🔒"}</span>
        <span><b>${i + 1}. ${esc(l.title)}</b><br><span class="mut">${d.includes(i) ? "✅ Completed" : unlocked(d, i) ? "Ready to learn" : "🔒 Finish lesson " + i + " first"}</span></span>
      </button>`,
    ).join("")}</div>`;
}

function open(i) {
  if (i >= LESSONS.length || !unlocked(done(), i)) return list();
  cur = i;
  const L = LESSONS[i];
  el.innerHTML = `<div class="card">
      <div class="row"><button class="ghost" data-back style="flex:0 0 auto">← Back</button>${langSel()}</div>
      <h2>${L.icon} ${i + 1}. ${esc(L.title)}</h2>
      <p>${esc(L.text)}</p>
      <div class="mut">Example (${esc(lang)}):</div>
      <pre class="out ex">${esc(build(lang, L.body[lang], L.top ? L.top[lang] : ""))}</pre></div>
    <div class="card"><b>🎯 Task</b><p>${esc(L.task)}</p>
      <textarea id="ls-code" class="code" spellcheck="false"></textarea>
      <div class="row"><button id="ls-run" class="ghost">▶ Run</button><button id="ls-check">✔ Check</button></div>
      <pre id="ls-out" class="out">Output appears here.</pre>
      <div id="ls-msg"></div></div>`;
  const ta = $("#ls-code");
  ta.value = starter(lang);
  editor(ta);
  $("#ls-run").onclick = () =>
    runInto($("#ls-run"), $("#ls-out"), lang, ta.value);
  $("#ls-check").onclick = check;
}

async function check() {
  const ok = await checkInto(
    $("#ls-check"),
    $("#ls-out"),
    $("#ls-msg"),
    lang,
    $("#ls-code").value,
    LESSONS[cur].expect,
  );
  if (!ok) return;
  markDone(cur);
  $("#ls-msg").insertAdjacentHTML(
    "beforeend",
    cur + 1 < LESSONS.length
      ? "<button data-next>Next lesson →</button>"
      : `<p class="mut">🎉 You finished every lesson in ${esc(lang)}! Try another language or head to the Lobby.</p>`,
  );
}

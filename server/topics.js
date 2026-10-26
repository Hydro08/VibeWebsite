// topics.js — the AI picks the battle topic, but from the SAME list as the Practice area
// (public/js/data/tasks.js). Add a task there and it shows up in battles automatically.
const fs = require("fs"),
  path = require("path");
const { ai, parse } = require("./ai");

const FILE = path.join(__dirname, "..", "public", "js", "data", "tasks.js");
// only used if tasks.js can't be read: a copy of the Practice topics, so the pool stays the same
const BACKUP = [
  "Hello World",
  "FizzBuzz",
  "Palindrome check",
  "Prime numbers",
  "Reverse a string",
  "Factorial",
  "Count vowels",
  "Fibonacci",
  "Sum 1 to N",
  "Even or odd",
  "Sum of digits",
  "Find the maximum",
  "Countdown",
  "Multiplication table",
  "Power of two",
  "Celsius to Fahrenheit",
  "Leap year",
  "Count words",
  "Uppercase",
  "GCD",
  "Binary",
  "Star triangle",
  "Sort numbers",
  "Average",
];
let last = null;

function list() {
  try {
    const src = fs.readFileSync(FILE, "utf8");
    const t = [...src.matchAll(/\btopic:\s*"([^"]+)"/g)].map((m) => m[1]);
    if (t.length) return t;
  } catch {}
  return BACKUP;
}
const shuffle = (a) =>
  a
    .map((x) => [Math.random(), x])
    .sort((p, q) => p[0] - q[0])
    .map((x) => x[1]);

// AI chooses 1 topic out of a random shortlist (so every match is different).
// If the AI is down or answers with something not in the list, the first shortlist item is used,
// which is already random, so the game never waits or breaks.
async function topic() {
  const all = list();
  const pool = all.length > 1 ? all.filter((t) => t !== last) : all; // never the same twice in a row
  const options = shuffle(pool).slice(0, 6);
  const j = parse(
    (await ai(
      `You are picking the topic for a 3-minute beginner coding battle between two players. Choose exactly ONE topic from this list: ${JSON.stringify(options)}. Pick the one that would make the most fun, interesting battle. Reply ONLY JSON: {"topic":"<one item copied exactly from the list>"}`,
    )) || "",
  );
  const want = String((j && j.topic) || "")
    .trim()
    .toLowerCase();
  const hit = options.find((t) => t.toLowerCase() === want);
  return (last = hit || options[0]);
}

module.exports = { topic };

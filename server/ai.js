const KEY = process.env.ANTHROPIC_API_KEY,
  MODEL = process.env.MODEL || "claude-sonnet-5-5";
const GKEY = process.env.GEMINI_API_KEY,
  GMODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK = [
  'Print "Hello World"',
  "Reverse a string",
  "FizzBuzz 1 to 30",
  "Check if a number is prime",
  "Count the vowels in a word",
  "Sum of 1 to N",
  "Find the largest number in a list",
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function callAI(prompt, ms) {
  const signal = AbortSignal.timeout(ms);
  try {
    if (GKEY) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GMODEL}:generateContent`,
        {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": GKEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }, // every caller asks for JSON
          }),
        },
      );
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          r.status + " " + JSON.stringify(d.error || d).slice(0, 250),
        );
      return d.candidates[0].content.parts.map((p) => p.text || "").join("");
    }
    if (!KEY) return null;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    console.log("RAW:", r.status, JSON.stringify(d).slice(0, 300));
    if (!r.ok)
      throw new Error(
        r.status + " " + JSON.stringify(d.error || d).slice(0, 250),
      );
    return d.content[0].text;
  } catch (e) {
    console.log("AI error:", e.message);
    return null;
  }
}
// slow calls (judge, rating) get one retry; quick ones (topics) don't, so the game never waits long
async function ai(prompt, ms = 8000) {
  const r = await callAI(prompt, ms);
  return r ?? (ms >= 15000 ? await callAI(prompt, ms) : null);
}
// runs once at startup so you know right away whether the AI key and model work
async function selfTest() {
  if (!GKEY && !KEY)
    return console.log(
      "⚠️  No GEMINI_API_KEY or ANTHROPIC_API_KEY set: topics use a built-in list and the judge only counts lines.",
    );
  const name = GKEY ? `Gemini (${GMODEL})` : `Claude (${MODEL})`;
  const r = parse(
    (await callAI('Reply ONLY with this JSON: {"ok":true}', 10000)) || "",
  );
  console.log(
    r && r.ok
      ? `✅ AI ready: ${name}`
      : `❌ AI is NOT working (${name}). See the "AI error:" line above: wrong model name, no quota, or a bad key.`,
  );
}
const parse = (t) => {
  try {
    return JSON.parse(t.match(/[\[{][\s\S]*[\]}]/)[0]);
  } catch {
    return null;
  }
};

async function topic() {
  const a = parse(
    (await ai(
      'Give 5 different tiny beginner coding challenge topics (solvable in 3 minutes, no user input, fun, e.g. "Printing Hello World"). Reply ONLY a JSON array of 5 short strings.',
    )) || "",
  );
  return pick(Array.isArray(a) && a.length ? a : FALLBACK);
}
module.exports = { ai, parse, topic, pick, selfTest };

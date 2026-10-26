const crypto = require("crypto"),
  fs = require("fs"),
  path = require("path");
const DATA = path.join(__dirname, "..", "data"); // users + login sessions live here
fs.mkdirSync(DATA, { recursive: true });
const FILE = path.join(DATA, "users.json");
const SFILE = path.join(DATA, "sessions.json");
let users = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : {};
const save = () => fs.writeFileSync(FILE, JSON.stringify(users));

// backfill missing fields on old accounts
let dirty = false;
for (const k in users) {
  const x = users[k];
  if (!x.at) {
    x.at = Date.now();
    dirty = true;
  }
  for (const f of ["w", "l", "d", "streak", "best"]) {
    if (typeof x[f] !== "number") {
      x[f] = 0;
      dirty = true;
    }
    if (typeof x.xp !== "number") {
      x.xp = x.w * 50 + x.d * 20 + x.l * 10;
      dirty = true;
    }
  }
}
if (dirty) save();

// "remember me" tokens are saved to disk so they survive a server restart
const rem = fs.existsSync(SFILE) ? JSON.parse(fs.readFileSync(SFILE)) : {};
for (const t in rem) if (!users[rem[t]]) delete rem[t];
const saveRem = () => fs.writeFileSync(SFILE, JSON.stringify(rem));
const sess = { ...rem };
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString("hex");

const xpInfo = (xp) => {
  const level = 1 + Math.floor(Math.sqrt(xp / 40));
  return { xp, level, base: 40 * (level - 1) ** 2, next: 40 * level ** 2 };
};
const REWARD = { lesson: 30, practice: 20 };
const handler = (signup) => (req, res) => {
  const u = String(req.body.username || "")
      .trim()
      .toLowerCase(),
    p = String(req.body.password || "");
  if (!/^[a-z0-9_]{3,16}$/.test(u) || p.length < 4)
    return res.status(400).json({
      error:
        "Username: 3-16 letters/numbers/_ · Password: at least 4 characters",
    });
  if (signup) {
    if (users[u])
      return res.status(400).json({ error: "Username already taken" });
    const s = crypto.randomBytes(8).toString("hex");
    users[u] = {
      s,
      h: hash(p, s),
      w: 0,
      l: 0,
      d: 0,
      streak: 0,
      best: 0,
      at: Date.now(),
    };
    save();
  } else if (!users[u] || users[u].h !== hash(p, users[u].s))
    return res.status(401).json({ error: "Wrong username or password" });
  const t = crypto.randomBytes(16).toString("hex");
  sess[t] = u;
  if (req.body.remember) {
    rem[t] = u;
    saveRem();
  }
  res.json({ token: t, username: u });
};

exports.routes = (app) => {
  app.post("/api/signup", handler(true));
  app.post("/api/login", handler(false));
  app.post("/api/logout", (req, res) => {
    const t = req.headers.authorization;
    delete sess[t];
    if (rem[t]) {
      delete rem[t];
      saveRem();
    }
    res.json({ ok: true });
  });
  app.post("/api/password", (req, res) => {
    const cur = req.headers.authorization,
      u = sess[cur];
    if (!u) return res.status(401).json({ error: "auth" });
    const x = users[u],
      o = String(req.body.old || ""),
      n = String(req.body.next || "");
    if (x.h !== hash(o, x.s))
      return res.status(400).json({ error: "Current password is wrong" });
    if (n.length < 4)
      return res
        .status(400)
        .json({ error: "New password: at least 4 characters" });
    x.s = crypto.randomBytes(8).toString("hex");
    x.h = hash(n, x.s);
    save();
    // sign out other devices
    for (const t in sess)
      if (sess[t] === u && t !== cur) {
        delete sess[t];
        delete rem[t];
      }
    saveRem();
    res.json({ ok: true });
  });
  // change username: once every 24 hours
  app.post("/api/username", (req, res) => {
    const cur = req.headers.authorization,
      u = sess[cur];
    if (!u) return res.status(401).json({ error: "auth" });
    const x = users[u],
      n = String(req.body.name || "")
        .trim()
        .toLowerCase();
    const wait = (x.nameAt || 0) + 864e5 - Date.now();
    if (wait > 0) {
      const h = Math.floor(wait / 36e5),
        m = Math.floor((wait % 36e5) / 6e4),
        s = (v, w) => v + " " + w + (v === 1 ? "" : "s");
      return res.status(429).json({
        error: `You can change your username again in ${h ? s(h, "hour") + " " + s(m, "minute") : s(m || 1, "minute")}.`,
        nameAt: x.nameAt,
      });
    }
    if (!/^[a-z0-9_]{3,16}$/.test(n))
      return res
        .status(400)
        .json({ error: "Username: 3-16 letters, numbers or _" });
    if (n === u)
      return res.status(400).json({ error: "That is already your username" });
    if (users[n])
      return res.status(400).json({ error: "Username already taken" });
    users[n] = x;
    delete users[u];
    x.nameAt = Date.now();
    for (const t in sess) if (sess[t] === u) sess[t] = n; // keep every device signed in
    for (const t in rem) if (rem[t] === u) rem[t] = n;
    save();
    saveRem();
    res.json({ username: n, nameAt: x.nameAt });
  });
  app.post("/api/xp", (req, res) => {
    const u = sess[req.headers.authorization];
    if (!u) return res.status(401).json({ error: "auth" });
    const key = String(req.body.key || ""),
      m = /^(lesson|practice):[\w +#./:-]{1,60}$/.exec(key);
    if (!m) return res.status(400).json({ error: "bad key" });
    const x = users[u];
    x.done = x.done || {};
    const before = xpInfo(x.xp || 0).level;
    let gained = 0;
    if (!x.done[key] && Object.keys(x.done).length < 2000) {
      x.done[key] = 1;
      gained = REWARD[m[1]];
      x.xp = (x.xp || 0) + gained;
      save();
    }
    const now = xpInfo(x.xp || 0);
    res.json({ gained, ...now, up: now.level > before });
  });
  app.get("/api/me", (req, res) => {
    const u = sess[req.headers.authorization];
    if (!u) return res.status(401).json({ error: "auth" });
    const x = users[u],
      fav = Object.entries(x.langs || {}).sort((a, b) => b[1] - a[1])[0];
    res.json({
      username: u,
      joined: x.at || null,
      w: x.w || 0,
      l: x.l || 0,
      d: x.d || 0,
      streak: x.streak || 0,
      best: x.best || 0,
      last: x.last || null,
      fav: fav ? fav[0] : null,
      ...xpInfo(x.xp || 0), // flat: xp, level, base, next (main.js and profile.js read it this way)
      nameAt: x.nameAt || null,
    });
  });
  app.get("/api/leaderboard", (req, res) => {
    if (!sess[req.headers.authorization])
      return res.status(401).json({ error: "auth" });
    const by =
      { best: "best", wins: "w", streak: "streak", xp: "xp" }[req.query.by] ||
      "best";
    const rows = Object.entries(users)
      .map(([u, x]) => ({
        u,
        v: x[by] || 0,
        w: x.w || 0,
        m: (x.w || 0) + (x.l || 0) + (x.d || 0),
      }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v || b.w - a.w)
      .slice(0, 5); // top 5 only
    res.json({ rows });
  });
};
exports.userOf = (token) => sess[token];
exports.record = (u, outcome, lang) => {
  // outcome: "w" | "l" | "d"
  const x = users[u];
  if (!x) return;
  x[outcome] = (x[outcome] || 0) + 1;
  x.streak = outcome === "w" ? (x.streak || 0) + 1 : 0;
  x.best = Math.max(x.best || 0, x.streak);
  x.last = Date.now();
  if (lang) {
    x.langs = x.langs || {};
    x.langs[lang] = (x.langs[lang] || 0) + 1;
  }
  x.xp = (x.xp || 0) + ({ w: 50, d: 20, l: 10 }[outcome] || 0);
  save();
};

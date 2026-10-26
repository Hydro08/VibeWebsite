https://battlecoders.onrender.com/
try this!

# Battle of the Coders

Two coders, one random topic, one AI judge. Also has Practice, Freedom (mini VS Code), Lessons and Solo levels.

## Run

```
npm install
npm start          # or: npm run dev  (auto-restart)
```

Copy `.env.example` to `.env` and fill in your keys (`GEMINI_API_KEY`, `GEMINI_MODEL`, optional `ANTHROPIC_API_KEY`, `PORT`).

## Folder structure

```
BattleCoder/
├─ server.js              entry point: boots express + socket.io
├─ server/                backend
│  ├─ auth.js             signup / login / XP / leaderboard routes
│  ├─ game.js             battle rooms (socket.io)
│  ├─ ai.js               AI calls (Gemini / Claude)
│  ├─ rate.js             /api/rate: AI rates a solution
│  └─ topics.js           picks the battle topic from public/js/data/tasks.js
├─ data/                  runtime data (users.json, sessions.json). git-ignored
└─ public/                frontend (served as static files)
   ├─ index.html
   ├─ css/style.css
   └─ js/
      ├─ main.js          entry: tabs, home screen
      ├─ core/            util.js, auth.js, bg.js (black hole background), logo.js
      ├─ run/             run.js (runner + terminal-style input), worker.js (Python/Lua/JS/TS),
      │                   check.js (compare output with the expected answer)
      ├─ editor/          highlight.js (syntax colours, themes, line numbers)
      ├─ data/            tasks.js (practice tasks), levels.js (solo levels)
      └─ views/           one file per screen: practice, freedom, lesson, lobby, solo, battle, profile
```

Add a practice task in `public/js/data/tasks.js`: it also shows up in battles automatically.

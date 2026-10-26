// Run: npm i express socket.io && GEMINI_API_KEY=... node server.js
require("dotenv").config();
const express = require("express"),
  http = require("http"),
  path = require("path");
const { Server } = require("socket.io");
const auth = require("./server/auth");

const app = express(),
  srv = http.createServer(app),
  io = new Server(srv);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
auth.routes(app);
require("./server/rate").routes(app, auth);
require("./server/game")(io, auth);

const PORT = process.env.PORT || 3000;
srv.listen(PORT, () => {
  console.log("Battle of the Coders on http://localhost:" + PORT);
  require("./server/ai").selfTest();
});

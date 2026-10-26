const SNIPS = [
  'print("Hello World")',
  'console.log("Hi")',
  "for i in range(10):",
  "def fib(n):",
  "#include <stdio.h>",
  'std::cout << "Hi";',
  "return 0;",
  "while (true) {}",
  "const x = 42;",
  "() => {}",
  "</>",
  "{ }",
  "if (x > 0) {",
  "import numpy as np",
  "git commit -m 'win'",
  "npm install",
  "SELECT * FROM users;",
  "0101 1100",
  "x ** 2",
  'System.out.println("Hi");',
  "func main() {",
  "fn main() {}",
  "public static void main",
  "O(n log n)",
  "sudo rm -rf bugs",
  "// TODO: win",
  "fib(n-1) + fib(n-2)",
  "while x < 10:",
  "int main() {",
  "Console.WriteLine();",
  ";",
  "<img />",
];
const COLORS = ["#a78bfa", "#67e8f9", "#818cf8", "#5eead4", "#c4b5fd"];

// ================= where the black hole sits on each tab =================
// x / y = centre as a fraction of the screen (0,0 = top-left, 1,1 = bottom-right)
// s     = size of the hole as a fraction of the screen's short side (the disk is ~4x bigger)
// Change these numbers to move / resize it. It glides between spots by itself.
const VIEW = {
  home: { x: 0.14, y: 0.8, s: 0.085 }, // bottom-left
  practice: { x: 0.5, y: 0.13, s: 0.075 }, // on top of the page
  lobby: { x: 0.84, y: 0.2, s: 0.135 }, // Arena: top-right, bigger
  lesson: { x: 0.5, y: 0.12, s: 0.07 }, // on top of the page
  profile: { x: 0.86, y: 0.8, s: 0.09 }, // bottom-right
};
let want = "home",
  cam = null; // current (animated) position
export function bgFocus(tab) {
  if (VIEW[tab]) want = tab;
}
function stepCam(dt) {
  const t = VIEW[want];
  if (!cam) return void (cam = { ...t }); // first frame: no animation
  const k = 1 - Math.exp(-dt * 2.6);
  cam.x += (t.x - cam.x) * k;
  cam.y += (t.y - cam.y) * k;
  cam.s += (t.s - cam.s) * k;
}
// pixel position + radius of the hole for a W x H screen
function place(W, H) {
  const m = Math.min(W, H),
    boost = W < 700 ? 1.3 : 1; // a bit bigger on phones
  return { x: cam.x * W, y: cam.y * H, r: Math.max(30, cam.s * m * boost) };
}
// On phones the browser bar slides in/out while you scroll and fires "resize" with a new
// innerHeight. Rebuilding the WebGL canvas on every one of those events stalled the GPU
// exactly while scrolling -> the fixed nav lagged, dropped down and snapped back.
// So: only rebuild when the WIDTH changes (rotation / real resize) or the height changes a lot.
function needsResize(W, H) {
  if (!W) return true; // first call
  return (
    Math.abs(innerWidth - W) > 1 ||
    Math.abs(innerHeight - H) > Math.max(160, H * 0.2)
  );
}
function onResize(fn) {
  let t = 0;
  addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(fn, 150); // wait until the resizing stops
  });
  addEventListener("orientationchange", () => setTimeout(fn, 300));
}
const PHONE = matchMedia("(pointer: coarse)").matches;
let scrolling = 0;
addEventListener(
  "scroll",
  () => {
    scrolling = performance.now();
  },
  { passive: true, capture: true },
);
function loop(render) {
  let last = 0,
    lastDraw = 0;
  const f = (now) => {
    requestAnimationFrame(f);
    if (document.hidden || document.body.classList.contains("inroom")) {
      last = now;
      return;
    }
    // phones: 30fps max, and 20fps while the page is being scrolled, so the GPU
    // stays free for the compositor (nav / scrolling) instead of the shader
    const gap = PHONE ? (now - scrolling < 250 ? 50 : 33) : 0;
    if (now - lastDraw < gap) return;
    lastDraw = now;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    stepCam(dt);
    render(now / 1000, dt);
  };
  requestAnimationFrame(f);
}

// ================= WebGL shader: lensed stars + accretion disk + photon ring =================
const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}";
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec2 uC;
uniform float uR;
uniform float uTime;
uniform float uSin;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 stars(vec2 uv){
  vec3 col = vec3(0.0);
  for (int L = 0; L < 2; L++) {
    float s = (L == 0) ? 14.0 : 26.0;
    vec2 g = uv * s + float(L) * 17.3;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id);
    float h2 = hash(id + 7.7);
    if (h > 0.90) {
      vec2 o = (vec2(h2, hash(id + 3.1)) - 0.5) * 0.6;
      float d = length(f - o);
      float tw = 0.65 + 0.35 * sin(uTime * (0.8 + h * 2.5) + h * 50.0);
      float sz = (L == 0) ? 0.11 : 0.07;
      col += mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.8), h2) * smoothstep(sz, 0.0, d) * tw * (0.5 + (h - 0.9) * 8.0);
    }
  }
  return col;
}
// glowing gas: rd = distance from the hole (in hole radii), beam = doppler brightening
vec3 diskCol(float rd, float ang, float beam){
  float edgeIn = smoothstep(1.4, 1.75, rd);
  float edgeOut = 1.0 - smoothstep(3.1, 4.4, rd);
  float om = 1.7 / pow(rd, 1.5);                 // inner gas spins faster
  float a = ang + uTime * om;
  float n = fbm(vec2(cos(a), sin(a)) * rd * 1.9 + rd * 0.7);
  float heat = pow(1.45 / rd, 2.2);
  float I = edgeIn * edgeOut * heat * (0.3 + 1.4 * n) * beam;
  vec3 c = mix(vec3(0.42, 0.24, 0.95), vec3(0.30, 0.88, 1.0), smoothstep(3.1, 1.6, rd));
  c = mix(c, vec3(1.0), smoothstep(2.0, 1.45, rd) * 0.75);
  return c * I;
}
void main(){
  vec2 px = gl_FragCoord.xy - uC;
  vec2 p = px / uR;
  float r = length(p);

  // gravitational lensing: the sky behind is bent around the hole
  vec2 src = px * (1.0 - 1.35 / max(r * r, 0.0001));
  vec2 sp = (uC + src) / uRes.y;
  vec3 col = vec3(0.022, 0.022, 0.045);
  col += stars(sp + vec2(uTime * 0.002, 0.0));
  col += vec3(0.05, 0.03, 0.10) * smoothstep(0.35, 0.95, fbm(sp * 3.0)) * 0.7;
  col += vec3(0.45, 0.35, 1.0) * exp(-max(r - 1.0, 0.0) * 1.1) * 0.12;

  // the disk seen from the side (flattened by uSin)
  vec2 d = vec2(p.x, p.y / uSin);
  float rd = length(d);
  float ang = atan(d.y, d.x);
  float beam = 1.0 + 0.8 * clamp(-d.x / max(rd, 0.001), -1.0, 1.0);
  vec3 disk = diskCol(rd, ang, beam);
  float behind = (r < 1.0 && p.y > 0.0) ? 1.0 : 0.0; // the hole hides the far side
  if (r < 1.0) col = vec3(0.0);
  col += disk * (1.0 - behind);

  // light from the far side of the disk bent over / under the hole
  float sec = smoothstep(1.0, 1.06, r) * (1.0 - smoothstep(1.5, 2.5, r));
  float w = 0.35 + 0.65 * pow(abs(p.y) / max(r, 0.001), 2.0);
  col += diskCol(1.45 + (r - 1.0) * 2.4, atan(p.y, p.x), beam) * sec * w * 0.8;

  // photon ring
  col += vec3(0.8, 0.9, 1.0) * exp(-pow((r - 1.035) * 16.0, 2.0)) * 1.2;
  col += vec3(0.55, 0.4, 1.0) * exp(-pow((r - 1.12) * 7.0, 2.0)) * 0.35;

  col = vec3(1.0) - exp(-col * 1.5);
  float v = 1.0 - 0.35 * pow(length(gl_FragCoord.xy / uRes - 0.5) * 1.4, 2.0);
  gl_FragColor = vec4(col * v, 1.0);
}`;

function blackHoleGL(box) {
  const cv = document.createElement("canvas");
  const gl = cv.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
  });
  if (!gl) return false;
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = mk(gl.VERTEX_SHADER, VERT),
    fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return false;
  const pr = gl.createProgram();
  gl.attachShader(pr, vs);
  gl.attachShader(pr, fs);
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(pr, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(pr, n);
  const uRes = U("uRes"),
    uC = U("uC"),
    uR = U("uR"),
    uTime = U("uTime"),
    uSin = U("uSin");
  box.append(cv);
  let W = 0,
    H = 0,
    q = 0.8;
  const size = () => {
    if (!needsResize(W, H)) return; // phone URL bar sliding: do NOT rebuild the canvas
    W = innerWidth;
    H = innerHeight;
    q = W * H > 1.6e6 ? 0.6 : 0.8; // render smaller on big screens, it is a soft glow anyway
    cv.width = Math.round(W * q);
    cv.height = Math.round(H * q);
    gl.viewport(0, 0, cv.width, cv.height);
  };
  size();
  onResize(size);
  loop((t) => {
    const P = place(W, H);
    gl.uniform2f(uRes, cv.width, cv.height);
    gl.uniform2f(uC, P.x * q, (H - P.y) * q); // WebGL's y goes up
    gl.uniform1f(uR, P.r * q);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uSin, 0.3); // how flat the disk looks (lower = more edge-on)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });
  return true;
}

// ================= fallback (no WebGL): the old 2D canvas version =================
function blackHole2D(box) {
  const cv = document.createElement("canvas"),
    g = cv.getContext("2d");
  box.append(cv);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0,
    H = 0,
    dpr = 1,
    cx = 0,
    cy = 0,
    R = 0;
  const stars = Array.from({ length: 170 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: 0.3 + Math.random() * 0.7,
    p: Math.random() * 6.28,
  }));
  const disk = Array.from({ length: 520 }, () => {
    const r = 1.35 + Math.pow(Math.random(), 1.7) * 2.6;
    return {
      r,
      a: Math.random() * 6.28,
      w: 0.9 / Math.pow(r, 1.5),
      s: 0.6 + Math.random() * 1.3,
      j: (Math.random() - 0.5) * 0.12,
    };
  });
  const size = () => {
    if (!needsResize(W, H)) return;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#06060c";
    g.fillRect(0, 0, W, H);
  };
  size();
  onResize(size);
  const col = (t, al) =>
    `hsla(${265 - (1 - t) * 85},${80 + 15 * (1 - t)}%,${55 + 35 * (1 - t)}%,${al})`;
  const plot = (d, front) => {
    const rr = d.r * R,
      x = cx + Math.cos(d.a) * rr,
      y = cy + Math.sin(d.a) * rr * 0.28 + d.j * R;
    if (Math.sin(d.a) > 0 !== front) return;
    const near = 1 - (d.r - 1.35) / 2.6;
    g.fillStyle = col(near, 0.25 + 0.6 * near);
    g.fillRect(x, y, d.s, d.s);
  };
  loop((t, dt) => {
    const P = place(W, H);
    cx = P.x;
    cy = P.y;
    R = P.r;
    g.fillStyle = "rgba(6,6,12,0.22)";
    g.fillRect(0, 0, W, H);
    for (const s of stars) {
      const tw = 0.45 + 0.55 * Math.sin(t * s.z * 1.6 + s.p);
      g.fillStyle = `rgba(220,225,255,${0.12 + 0.5 * tw * s.z})`;
      g.fillRect(s.x * W, s.y * H, s.z * 1.7, s.z * 1.7);
    }
    let gr = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 4.2);
    gr.addColorStop(0, "rgba(167,139,250,0.30)");
    gr.addColorStop(0.35, "rgba(103,232,249,0.08)");
    gr.addColorStop(1, "rgba(6,6,12,0)");
    g.fillStyle = gr;
    g.fillRect(cx - R * 4.4, cy - R * 4.4, R * 8.8, R * 8.8);
    for (const d of disk) {
      if (!still) d.a += d.w * dt;
      plot(d, false);
    }
    gr = g.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.25);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(0.62, "rgba(0,0,0,1)");
    gr.addColorStop(0.7, "rgba(190,230,255,0.9)");
    gr.addColorStop(0.82, "rgba(139,92,246,0.35)");
    gr.addColorStop(1, "rgba(139,92,246,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, R * 1.25, 0, 6.2832);
    g.fill();
    for (const d of disk) plot(d, true);
  });
}

// ---------- mouse glow: only on the empty background, never over cards / buttons / editors ----------
const OVER =
  ".card,nav,button,input,textarea,select,pre,.pane,.rr,.lr,.pc,.node,.lc,.task,.vsc,.hl,.top,.chat,#ov,#modal,.toast,.path .node,.stats,.logo,label,a";
function mouseGlow(box) {
  if (!matchMedia("(pointer: fine)").matches) return; // phones / tablets: no mouse
  const gl = document.createElement("div");
  gl.id = "glow";
  box.append(gl);
  let x = -999,
    y = -999,
    raf = 0;
  const draw = () => {
    raf = 0;
    gl.style.transform = `translate3d(${x}px,${y}px,0)`;
  };
  addEventListener(
    "pointermove",
    (e) => {
      const onBg =
        !document.body.classList.contains("inroom") &&
        !(e.target instanceof Element && e.target.closest(OVER));
      gl.classList.toggle("on", onBg);
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(draw);
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => gl.classList.remove("on"));
  document.addEventListener("mouseleave", () => gl.classList.remove("on"));
}

export function bgInit() {
  if (document.getElementById("bg")) return;
  const box = document.createElement("div");
  box.id = "bg";
  document.body.prepend(box);
  if (!blackHoleGL(box)) blackHole2D(box);
  mouseGlow(box);
  const spawn = () => {
    if (document.hidden || box.childElementCount > 32) return;
    const s = document.createElement("span"),
      dur = 12 + Math.random() * 14;
    s.textContent = SNIPS[(Math.random() * SNIPS.length) | 0];
    s.style.left = Math.random() * 90 + "%";
    s.style.fontSize = 13 + Math.random() * 12 + "px";
    s.style.color = COLORS[(Math.random() * COLORS.length) | 0];
    s.style.animationDuration = dur + "s";
    s.style.setProperty("--dx", ((Math.random() * 120 - 60) | 0) + "px");
    s.style.setProperty("--r", ((Math.random() * 30 - 15) | 0) + "deg");
    box.append(s);
    setTimeout(() => s.remove(), dur * 2000);
  };
  for (let i = 0; i < 14; i++) setTimeout(spawn, i * 400);
  setInterval(spawn, 900);
}

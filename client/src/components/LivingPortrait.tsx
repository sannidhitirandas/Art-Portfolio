// @ts-nocheck  (engine ported from the standalone page; kept loose on purpose)
import { useEffect, useRef } from "react";
import "./LivingHero.css";

/**
 * Living portrait. Separately made pictures of the same face, each with a different gaze.
 * Only one picture is on screen at a time (70ms crossfade at most). The code picks which one
 * to show and moves the skin on a soft WebGL sheet; it never composites or fakes eyes.
 *
 * The pictures live in client/public/portrait (g0..g11 and r2, all .webp).
 */
const PORTRAIT_BASE = "/portrait/";

export default function LivingPortrait() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    const cleanups: Array<() => void> = [];
    const listen = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

  const FILES = 17;
  // Calibrated against the replacement portrait exports. Angles use the cursor convention:
  // 0 = right, 90 = up, 180 = left, 270 = down.
  const GAZE = [
    {n: 'g10', a: 0},     // right
    {n: 'g4', a: 45},     // up-right
    {n: 'g2', a: 90},     // up
    {n: 'g6', a: 135},    // up-left
    {n: 'g1', a: 180},    // left
    {n: 'g11', a: 205},   // left, slightly down
    {n: 'g8', a: 235},    // down-left
    {n: 'g3', a: 270},    // down
    {n: 'g7', a: 315}     // down-right
  ];
  const REST = 'g0', CLOSED = 'g5', DOWN = 'g3';
  const gazeFor = (dx, dy) => {
    // vertical distance counts less than horizontal: her head sits tall on the page, so a cursor to the
    // lower right of her would otherwise read as "straight down" and she would never glance sideways
    const ang = (Math.atan2(-dy * .4, dx) * 180 / Math.PI + 360) % 360;
    let best = GAZE[0], bd = 999;
    for (const g of GAZE) { const d = Math.abs(((ang - g.a + 540) % 360) - 180); if (d < bd) { bd = d; best = g; } }
    return best.n;
  };

  const smallScreen = matchMedia('(max-width: 700px)').matches;
  const OVER = 1.7, N = smallScreen ? 48 : 72, M = N + 1, SPAN = OVER / N, ORIGIN = .5 - OVER / 2;
  const WOBBLE = 2.3 * 2 * Math.PI, REACH = .085 / SPAN, C = REACH * WOBBLE, GAMMA = 2 * .14 * WOBBLE, NU = .2 * C;

  const wrap = wrapRef.current, canvas = canvasRef.current, fallback = fallbackRef.current;
  const gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: !smallScreen, powerPreference: 'low-power'});
  if (!gl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VS = `attribute vec2 a, d; attribute float s; varying vec2 vUv; varying float vS;
    uniform vec2 lean; uniform float overS;
    void main(){ vUv = a; vS = s; vec2 p = a + d + lean; gl_Position = vec4(vec2(p.x-.5, .5-p.y)*2./overS, 0., 1.); }`;
  // the soft vignette lets the picture's own purple backdrop melt into the page
  const FS = `precision highp float; varying vec2 vUv; varying float vS;
    uniform sampler2D faceA, faceB; uniform float fade;
    void main(){
      if(vUv.x<0.||vUv.y<0.||vUv.x>1.||vUv.y>1.){ gl_FragColor = vec4(0.); return; }
      float len = length((vUv - vec2(.5,.47)) * vec2(1.2,1.));
      float m = (1. - smoothstep(.34, .62, len)) * smoothstep(0., .07, vUv.y) * smoothstep(0., .06, vUv.x) * smoothstep(1., .94, vUv.x) * smoothstep(1., .9, vUv.y);
      vec3 c = mix(texture2D(faceA,vUv), texture2D(faceB,vUv), fade).rgb;
      gl_FragColor = vec4(c*vS*m, m);
    }`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr); gl.useProgram(pr);
  const U = {};
  for (const n of ['lean', 'faceA', 'faceB', 'fade', 'overS']) U[n] = gl.getUniformLocation(pr, n);
  gl.uniform1f(U.overS, OVER); gl.uniform1i(U.faceA, 0); gl.uniform1i(U.faceB, 1);

  // ---- the sheet: a damped wave equation on the displacement of each node ----
  const count = M * M, ux = new Float32Array(count), uy = new Float32Array(count), vx = new Float32Array(count), vy = new Float32Array(count);
  const rest = new Float32Array(count * 2), dyn = new Float32Array(count * 3);
  const sx = new Float32Array(count), sy = new Float32Array(count);
  for (let j = 0, k = 0; j < M; j++) for (let i = 0; i < M; i++) { rest[k++] = ORIGIN + i * SPAN; rest[k++] = ORIGIN + j * SPAN; }
  const idx = new Uint16Array(N * N * 6);
  for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * M + i, b = a + 1, c = a + M, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, rest, gl.STATIC_DRAW);
  const aa = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(aa); gl.vertexAttribPointer(aa, 2, gl.FLOAT, false, 0, 0);
  const dynBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW);
  const ad = gl.getAttribLocation(pr, 'd'), as = gl.getAttribLocation(pr, 's');
  gl.enableVertexAttribArray(ad); gl.vertexAttribPointer(ad, 2, gl.FLOAT, false, 12, 0);
  gl.enableVertexAttribArray(as); gl.vertexAttribPointer(as, 1, gl.FLOAT, false, 12, 8);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);

  // The sheet must never fold over itself: every frame each row and column is forced back
  // into order with a minimum gap between neighbours, so the picture can squash but never cross.
  const GAP = SPAN * .34, lineA = new Float32Array(M), lineB = new Float32Array(M), lineP = new Float32Array(M);
  function order(start, stride, field, base) {
    for (let i = 0; i < M; i++) { const k = start + i * stride; lineP[i] = base[k] + field[k]; }
    lineA[0] = lineP[0]; for (let i = 1; i < M; i++) lineA[i] = Math.max(lineP[i], lineA[i - 1] + GAP);
    lineB[N] = lineP[N]; for (let i = N - 1; i >= 0; i--) lineB[i] = Math.min(lineP[i], lineB[i + 1] - GAP);
    for (let i = 0; i < M; i++) { const k = start + i * stride; field[k] = (lineA[i] + lineB[i]) / 2 - base[k]; }
  }
  const restX = new Float32Array(count), restY = new Float32Array(count);
  for (let k = 0; k < count; k++) { restX[k] = rest[k * 2]; restY[k] = rest[k * 2 + 1]; }
  function untangle() {
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < M; j++) order(j * M, 1, sx, restX);
      for (let i = 0; i < M; i++) order(i, M, sy, restY);
    }
  }
  const H = 1 / 240; let simLeft = 0;   // fixed physics step whatever the frame rate
  function step(dt) {
    const c2 = C * C, wo2 = WOBBLE * WOBBLE;
    for (let j = 1; j < N; j++) for (let i = 1; i < N; i++) {
      const k = j * M + i, l = k - 1, r = k + 1, t = k - M, b = k + M;
      const lx = ux[l] + ux[r] + ux[t] + ux[b] - 4 * ux[k], ly = uy[l] + uy[r] + uy[t] + uy[b] - 4 * uy[k];
      const lvx = vx[l] + vx[r] + vx[t] + vx[b] - 4 * vx[k], lvy = vy[l] + vy[r] + vy[t] + vy[b] - 4 * vy[k];
      vx[k] += (c2 * lx - wo2 * ux[k] - GAMMA * vx[k] + NU * lvx) * dt;
      vy[k] += (c2 * ly - wo2 * uy[k] - GAMMA * vy[k] + NU * lvy) * dt;
    }
    for (let k = 0; k < count; k++) { ux[k] += vx[k] * dt; uy[k] += vy[k] * dt; }
  }
  function poke(u, v, dx, dy, radius = .09) {
    for (let k = 0; k < count; k++) {
      const ax = rest[k * 2] - u, ay = rest[k * 2 + 1] - v, w = Math.exp(-(ax * ax + ay * ay) / (radius * radius));
      vx[k] += dx * w; vy[k] += dy * w;
    }
  }

  // ---- pictures ----
  const tex = {};
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const load = name => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = PORTRAIT_BASE + name + '.webp'; });
  function upload(name, img) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    tex[name] = t;
  }

  // ---- state ----
  const EYE = [.51, .34];               // where her eyes sit in the picture
  let ready = false, visible = true, last = performance.now(), tStart = 0;
  let pu = .5, pv = .5, onHead = false, lastX = 0, lastY = 0;
  let awake = false, awakeAt = 0, lastInput = 0, nextIdle = 30000 + Math.random() * 15000;
  let nextBlink = 0, blinkUntil = 0, scrollUntil = 0, lastScroll = scrollY;
  let faceA = REST, faceB = REST, fadeT = 0, fadeMs = 1;
  let leanX = 0, leanY = 0, lvX = 0, lvY = 0, wantLean = [0, 0];
  let act = null, actI = 0, actT = 0, rotation = [];

  // one picture on screen at a time, crossfading at most 70ms
  function show(n, now) {
    if (!tex[n] || n === faceB) return;
    faceA = (now - fadeT) / fadeMs > .5 ? faceB : faceA; faceB = n; fadeT = now; fadeMs = 70;
  }

  // idle acts: whole-picture sequences built from the gaze pictures
  const ACTS = {
    shifty: [['g1', 520], ['g9', 620], ['g1', 420], ['g9', 300], [REST, 300]],
    roll: [['g1', 200], ['g6', 120], ['g2', 160], ['g4', 120], ['g9', 160], ['r2', 260], [REST, 400]],
    doze: [[DOWN, 700, [.006, .006]], [CLOSED, 900, [.014, .014]], [CLOSED, 2800, [.03, .03]], [DOWN, 300, [.01, .01], [.5, .5, 0, -.9, .3]], [REST, 500]],
    peek: [['g8', 600], ['g1', 500], ['g2', 700], [REST, 400]]
  };
  const ROTATION = ['shifty', 'roll', 'peek', 'doze'];
  function startAct(name, now) { act = ACTS[name]; actI = -1; advance(now); }
  function endAct() { act = null; wantLean = [0, 0]; }
  function advance(now) {
    actI++; if (!act || actI >= act.length) { endAct(); return; }
    actT = now; const s = act[actI]; wantLean = s[2] || [0, 0]; if (s[3]) poke(...s[3]);
  }

  // ---- input ----
  const toUv = (x, y) => { const r = canvas.getBoundingClientRect(); return [((x - r.left) / r.width - .5) * OVER + .5, ((y - r.top) / r.height - .5) * OVER + .5]; };
  const solid = (u, v) => { const a = (u - .52) / .4, b = (v - .55) / .5; return a * a + b * b < 1; };
  function wake(now) {
    lastInput = now; nextIdle = 30000 + Math.random() * 15000;
    if (!awake) { awake = true; awakeAt = now; nextBlink = now + 1800; }
  }
  listen(window, 'pointermove', (e) => {
    const now = performance.now(), dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    [pu, pv] = toUv(e.clientX, e.clientY);
    wake(now); if (act) endAct();
    onHead = solid(pu, pv);
    if (onHead && !reduced) poke(pu, pv, dx * .00035, dy * .00035, .07);
  });
  // A tap has no pointermove on many touch browsers. Set the gaze on touch-down as well.
  listen(wrap, 'pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const now = performance.now();
    [pu, pv] = toUv(e.clientX, e.clientY);
    lastX = e.clientX; lastY = e.clientY;
    wake(now); if (act) endAct();
    onHead = solid(pu, pv);
  });
  // when the cursor leaves the page she goes back to looking at the visitor. The target must be her own
  // eye position: the old value sat below her eyes, so she looked down every time the cursor left.
  const lookForward = () => { pu = EYE[0]; pv = EYE[1]; };
  listen(document.documentElement, 'mouseleave', lookForward);
  listen(document.documentElement, 'pointerleave', (e) => { if (e.pointerType !== 'touch') lookForward(); });
  listen(document, 'mouseleave', lookForward);
  listen(window, 'blur', lookForward);
  listen(window, 'scroll', () => { const n = performance.now(); if (Math.abs(scrollY - lastScroll) > 2) { scrollUntil = n + 500; lastScroll = scrollY; } wake(n); }, {passive: true});
  const contact = document.querySelector('.lh-contact');
  if (contact) listen(contact, 'pointerenter', () => poke(.5, .6, 0, -.6, .1));

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, {threshold: 0}); io.observe(canvas);
  const ro = new ResizeObserver(() => { const r = Math.min(devicePixelRatio || 1, smallScreen ? 1.25 : 1.75), b = canvas.getBoundingClientRect(); canvas.width = Math.max(1, b.width * r); canvas.height = Math.max(1, b.height * r); gl.viewport(0, 0, canvas.width, canvas.height); }); ro.observe(canvas);

  // ---- frame ----
  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.04, (now - last) / 1000); last = now;
    if (!ready || !visible) return;

    // idle acts only start after a long quiet spell, and any input ends them
    if (act) { if (now - actT > act[actI][1]) advance(now); }
    else if (!reduced && awake && now - lastInput > nextIdle) {
      if (!rotation.length) rotation = [...ROTATION];
      startAct(rotation.shift(), now); lastInput = now; nextIdle = 30000 + Math.random() * 15000;
    }

    // which picture
    let n;
    if (!awake) n = CLOSED;                                    // asleep until the first move
    else if (act) n = act[actI][0];
    else if (now - awakeAt < 110) n = DOWN;                    // half-open on the way up
    else if (now < blinkUntil) n = CLOSED;
    else {
      if (now > nextBlink) { blinkUntil = now + 95; nextBlink = now + 2200 + Math.random() * 3400; }
      const t = now < scrollUntil ? [0, 1] : [pu - EYE[0], pv - EYE[1]];
      n = Math.hypot(t[0], t[1]) < .13 ? REST : gazeFor(t[0], t[1]);
    }
    show(n, now);

    // the head leans toward the pull or the cursor
    const tx = (awake && !reduced ? (pu - .5) * .012 : 0) + wantLean[0] + (reduced ? 0 : Math.sin(now * .0009) * .0015);
    const ty = (awake && !reduced ? (pv - .46) * .008 : 0) + wantLean[1] + (reduced ? 0 : Math.sin(now * .0013) * .0022);
    lvX += ((tx - leanX) * 70 - lvX * 8) * dt; lvY += ((ty - leanY) * 70 - lvY * 8) * dt;
    leanX += lvX * dt; leanY += lvY * dt;

    // skin
    simLeft += dt; let steps = 0;
    while (simLeft >= H && steps < 9) { step(H); simLeft -= H; steps++; }
    if (steps === 9) simLeft = 0;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const k = j * M + i, edge = i === 0 || j === 0 || i === N || j === N;
      sx[k] = edge ? ux[k] : (ux[k] * 4 + ux[k - 1] + ux[k + 1] + ux[k - M] + ux[k + M]) / 8;
      sy[k] = edge ? uy[k] : (uy[k] * 4 + uy[k - 1] + uy[k + 1] + uy[k - M] + uy[k + M]) / 8;
    }
    untangle();
    for (let k = 0, o = 0; k < count; k++) {
      dyn[o++] = sx[k]; dyn[o++] = sy[k];
      const r = k % M, c = k / M | 0; let s = 1;
      if (r > 0 && r < N && c > 0 && c < N) s = Math.max(.86, Math.min(1.16, 1 - ((sx[k + 1] - sx[k - 1]) + (sy[k + M] - sy[k - M])) * 1.8));
      dyn[o++] = s;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[faceA] || tex[REST]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[faceB] || tex[REST]);
    gl.uniform1f(U.fade, Math.min(1, (now - fadeT) / fadeMs));
    gl.uniform2f(U.lean, leanX, leanY);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
  }

  (async () => {
    const base = await load(REST); if (!base || disposed) return;
    upload(REST, base);
    const first = await Promise.all([CLOSED, DOWN].map(async n => { const i = await load(n); if (i) upload(n, i); }));
    fallback.style.visibility = 'hidden';
    if (disposed) return;
    ready = true; tStart = performance.now(); raf = requestAnimationFrame(frame);
    const names = ['r2']; for (let i = 0; i < FILES; i++) { const n = 'g' + i; if (!tex[n]) names.push(n); }
    await Promise.all(names.map(async n => { const i = await load(n); if (i && !disposed) upload(n, i); }));
  })();

    cleanups.push(() => { io.disconnect(); ro.disconnect(); });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach(fn => fn());
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className="lh-portrait" ref={wrapRef}>
      <div className="lh-portrait__inner">
        <img
          ref={fallbackRef}
          src={PORTRAIT_BASE + "g0.webp"}
          alt="Sunny, a smiling illustrated young woman with long dark hair and a lilac blouse"
          draggable={false}
        />
        <canvas ref={canvasRef} className="lh-portrait__gl" aria-hidden="true" />
      </div>
    </div>
  );
}

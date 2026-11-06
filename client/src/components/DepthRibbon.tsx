import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./DepthRibbon.css";
import {
  buildPath,
  basis,
  cardFrame,
  clamp,
  focusPose,
  lerp3,
  len,
  mod,
  mul,
  add,
  overviewPose,
  project,
  ridePose,
  sample,
  sequence,
  smooth,
  sub,
  type CardFrame,
  type PathKind,
  type Vec3,
} from "./depthRibbonMath";

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

export type DepthRibbonItem = {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
};

export type DepthRibbonHandle = {
  /** Push the camera along the path by a number of cards. */
  travel: (cards: number) => void;
  /** Bring a card close (by item index). */
  focus: (index: number) => void;
  /** Resume riding. */
  release: () => void;
  /** Pull back to show the whole path. */
  reveal: () => void;
};

export type DepthRibbonProps = {
  items?: DepthRibbonItem[];
  count?: number;
  path?: PathKind;
  tour?: "cycle" | "ride" | "overview";
  interval?: number;
  speed?: number;
  cardSize?: number;
  aspect?: number;
  radius?: number;
  offset?: number;
  fov?: number;
  fog?: number;
  thread?: number;
  shadow?: number;
  accentColor?: string;
  backgroundColor?: string;
  focusOnClick?: boolean;
  holdToReveal?: boolean;
  captions?: boolean;
  interactive?: boolean;
  draggable?: boolean;
  wheel?: boolean;
  pauseOnHover?: boolean;
  seed?: number;
  paused?: boolean;
  dpr?: number;
  ariaLabel?: string;
  onFocusChange?: (item: DepthRibbonItem | null, index: number) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const DEFAULTS = {
  count: 72,
  path: "loop" as PathKind,
  tour: "cycle" as "cycle" | "ride" | "overview",
  interval: 9,
  speed: 0.6,
  cardSize: 0.72,
  aspect: 1,
  radius: 0.12,
  offset: 1,
  fov: 60,
  fog: 1,
  thread: 0.3,
  shadow: 0.5,
  accentColor: "#B19EEF",
  backgroundColor: "transparent",
  focusOnClick: true,
  holdToReveal: true,
  captions: true,
  interactive: true,
  draggable: true,
  wheel: true,
  pauseOnHover: true,
  seed: 0,
  paused: false,
  dpr: 2,
  ariaLabel:
    "Depth ribbon gallery. A camera rides along a ribbon of artwork. Drag or scroll to travel, click a piece to open it, press and hold to see the whole ribbon, Escape to ride on.",
};

const SPRITE_H = 384;
const MAX_CARDS = 240;
const TRANSITION = 3.2; // seconds for a dive / pull-back
const OVERVIEW_HOLD = 2.6;
const FRICTION = 0.92;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let img = imageCache.get(src);
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = src;
      imageCache.set(src, img);
    }
    if (img.complete) {
      resolve(img.naturalWidth > 0 ? img : null);
      return;
    }
    img.addEventListener("load", () => resolve(img!), { once: true });
    img.addEventListener("error", () => resolve(null), { once: true });
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeSprite(img: HTMLImageElement, aspect: number): HTMLCanvasElement {
  const H = SPRITE_H;
  const W = Math.max(2, Math.round(H * aspect));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const ir = img.naturalWidth / img.naturalHeight;
  const r = W / H;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > r) {
    sw = sh * r;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / r;
    sy = (img.naturalHeight - sh) / 2;
  }
  g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return cv;
}

function makeShadow(W: number, H: number, pad: number, radius: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = W + pad * 2;
  cv.height = H + pad * 2;
  const g = cv.getContext("2d")!;
  // a soft edge from stacked, slightly growing rounded rectangles (works everywhere)
  const layers = 26;
  const spread = H * 0.2;
  g.fillStyle = "rgba(0,0,0,0.035)";
  for (let i = 0; i < layers; i++) {
    const grow = (i / (layers - 1)) * spread - spread * 0.25;
    roundRectPath(g, pad - grow, pad - grow, W + grow * 2, H + grow * 2, radius + Math.max(0, grow));
    g.fill();
  }
  return cv;
}

type Quad = [number, number, number, number, number, number, number, number];

function inQuad(q: Quad, x: number, y: number) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const ax = q[i * 2];
    const ay = q[i * 2 + 1];
    const bx = q[((i + 1) % 4) * 2];
    const by = q[((i + 1) % 4) * 2 + 1];
    const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cr !== 0) {
      const s = cr > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

type Phase = "overview" | "dive" | "ride" | "pull";

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

const DepthRibbon = forwardRef<DepthRibbonHandle, DepthRibbonProps>(
  function DepthRibbon(props, ref) {
    const defined = Object.fromEntries(
      Object.entries(props).filter(([, v]) => v !== undefined),
    ) as DepthRibbonProps;
    const p = { ...DEFAULTS, ...defined };

    const items = useMemo(() => props.items ?? [], [props.items]);
    const cards = clamp(Math.round(p.count), 4, MAX_CARDS);

    /* ---- static layout: path, spacing, card frames, image order ---- */
    const layout = useMemo(() => {
      const table = buildPath(p.path);
      const spacing = table.length / cards;
      const frames: CardFrame[] = [];
      for (let i = 0; i < cards; i++) frames.push(cardFrame(table, i * spacing));
      const seq = sequence(items.length, cards, Math.round(p.seed));
      // thread: a fine polyline along the path
      const thread: Vec3[] = [];
      const steps = cards * 2;
      for (let i = 0; i <= steps; i++) thread.push(sample(table, (i / steps) * table.length).p);
      return { table, spacing, frames, seq, thread };
    }, [p.path, cards, items.length, p.seed]);

    const rootRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const [openItem, setOpenItem] = useState(-1); // item shown in the overlay
    const [overlayShown, setOverlayShown] = useState(false);

    const live = useRef({ p, items, layout, cards });
    live.current = { p, items, layout, cards };
    const cb = useRef(props.onFocusChange);
    cb.current = props.onFocusChange;

    const sprites = useRef(new Map<number, HTMLCanvasElement>());

    const sim = useRef({
      p: 0, // camera position along the path, in cards
      vel: 0,
      target: null as number | null,
      mLin: 0, // 0 = whole path, 1 = riding
      phase: "overview" as Phase,
      phaseT: 0,
      hold: false,
      revealT: 0,
      orbit: 0,
      yaw: 0,
      f: 0, // 0..1 focus fly-in
      focusCard: -1,
      focusLast: 0,
      hoverCard: -1,
      rideF: 1,
      dragging: false,
      inView: true,
      hits: [] as { card: number; q: Quad }[],
      lift: new Float32Array(MAX_CARDS),
      overlayOn: false,
      down: null as null | {
        x: number;
        y: number;
        lx: number;
        ly: number;
        t: number;
        lt: number;
        moved: number;
        type: string;
      },
      holdTimer: 0,
    });

    /* ---- actions ---- */
    const actions = useMemo(() => {
      const s = sim.current;
      const doFocus = (card: number) => {
        const { layout: l, items: it } = live.current;
        const c = mod(Math.round(card), l.frames.length);
        s.focusCard = c;
        s.focusLast = c;
        s.vel = 0;
        s.target = null;
        s.hold = false;
        s.revealT = 0;
        const itemIdx = l.seq[c];
        setOpenItem(itemIdx);
        cb.current?.(itemIdx >= 0 ? (it[itemIdx] ?? null) : null, itemIdx);
      };
      const release = () => {
        if (s.focusCard < 0 && !s.overlayOn) return;
        s.focusCard = -1;
        s.overlayOn = false;
        setOverlayShown(false);
        setOpenItem(-1);
        if (live.current.p.tour !== "overview") {
          s.phase = "dive";
          s.phaseT = 0;
        }
        cb.current?.(null, -1);
      };
      const diveBackIn = () => {
        if (live.current.p.tour === "overview") return;
        if (s.phase === "overview" || s.phase === "pull") {
          s.phase = "dive";
          s.phaseT = 0;
        }
        s.revealT = 0;
      };
      const travel = (n: number) => {
        s.target = (s.target ?? s.p) + n;
        s.vel = 0;
      };
      return { doFocus, release, diveBackIn, travel };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        travel: (n: number) => {
          if (sim.current.focusCard >= 0) actions.release();
          actions.diveBackIn();
          actions.travel(n);
        },
        focus: (index: number) => {
          const { layout: l } = live.current;
          let best = -1;
          let bestD = Infinity;
          l.seq.forEach((it, c) => {
            if (it !== index) return;
            const half = l.frames.length / 2;
            const d = Math.abs(mod(c - sim.current.p + half, l.frames.length) - half);
            if (d < bestD) {
              bestD = d;
              best = c;
            }
          });
          if (best >= 0) actions.doFocus(best);
        },
        release: actions.release,
        reveal: () => {
          if (sim.current.focusCard >= 0) actions.release();
          sim.current.revealT = TRANSITION + 1.8;
        },
      }),
      [actions],
    );

    /* ---- load images into small sprites, nearest-first ---- */
    useEffect(() => {
      let alive = true;
      const { aspect } = live.current.p;
      sprites.current.clear();
      const order: number[] = [];
      for (const it of layout.seq) if (it >= 0 && !order.includes(it)) order.push(it);
      let next = 0;
      const worker = async () => {
        while (alive && next < order.length) {
          const idx = order[next++];
          const src = items[idx]?.src;
          if (!src) continue;
          const img = await loadImage(src);
          if (!alive || !img) continue;
          sprites.current.set(idx, makeSprite(img, aspect));
        }
      };
      for (let i = 0; i < 4; i++) worker();
      return () => {
        alive = false;
      };
    }, [items, layout.seq, p.aspect]);

    /* ---- main loop ---- */
    useEffect(() => {
      const root = rootRef.current;
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      if (!root || !stage || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const s = sim.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

      let w = 0;
      let h = 0;
      let dprEff = 1;
      const resize = () => {
        const r = stage.getBoundingClientRect();
        w = r.width;
        h = r.height;
        dprEff = Math.min(window.devicePixelRatio || 1, live.current.p.dpr);
        canvas.width = Math.max(1, Math.round(w * dprEff));
        canvas.height = Math.max(1, Math.round(h * dprEff));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      const io = new IntersectionObserver(([e]) => (s.inView = e.isIntersecting), {
        threshold: 0.01,
      });
      io.observe(root);

      // shadow sprite (rebuilt if the card shape changes)
      let shadowKey = "";
      let shadowCv: HTMLCanvasElement | null = null;
      let shadowPad = 0;

      let last = performance.now();
      let raf = 0;

      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!s.inView || w < 2 || h < 2) return;

        const { p: c, layout: l, cards: n } = live.current;
        const calm = reduce.matches;
        const frozen = c.paused || calm;
        const spacing = l.spacing;
        const cardH = c.cardSize * spacing;
        const cardW = cardH * c.aspect;

        /* ---- tour state machine: how far we are into the ride (mLin) ---- */
        let mDir = 0;
        const focused = s.focusCard >= 0;
        if (!focused && !frozen) {
          if (s.hold || s.revealT > 0) {
            mDir = -1;
            if (s.revealT > 0) s.revealT = Math.max(0, s.revealT - dt);
            if (s.revealT === 0 && !s.hold && c.tour !== "overview") {
              s.phase = "dive";
              s.phaseT = 0;
            }
          } else if (c.tour === "overview") {
            mDir = -1;
          } else if (c.tour === "ride") {
            mDir = 1;
          } else {
            s.phaseT += dt;
            if (s.phase === "overview") {
              mDir = -1;
              if (s.phaseT > OVERVIEW_HOLD) {
                s.phase = "dive";
                s.phaseT = 0;
              }
            } else if (s.phase === "dive") {
              mDir = 1;
              if (s.mLin >= 1) {
                s.phase = "ride";
                s.phaseT = 0;
              }
            } else if (s.phase === "ride") {
              mDir = 1;
              if (s.phaseT >= Math.max(1, c.interval)) {
                s.phase = "pull";
                s.phaseT = 0;
              }
            } else {
              mDir = -1;
              if (s.mLin <= 0) {
                s.phase = "overview";
                s.phaseT = 0;
              }
            }
          }
        }
        s.mLin = clamp(s.mLin + (mDir * dt) / TRANSITION, 0, 1);

        /* ---- riding ---- */
        const hovering = s.hoverCard >= 0 && c.pauseOnHover;
        const rideTarget = hovering || s.dragging || s.hold || focused || s.revealT > 0 ? 0 : 1;
        s.rideF += (rideTarget - s.rideF) * Math.min(1, dt * 4);
        if (!frozen && !focused && !s.dragging) s.p += c.speed * s.rideF * dt;

        if (s.target !== null) {
          const diff = s.target - s.p;
          s.p += diff * Math.min(1, dt * 6);
          if (Math.abs(diff) < 0.002) {
            s.p = s.target;
            s.target = null;
          }
        } else if (!s.dragging) {
          s.p += s.vel * dt;
          s.vel *= Math.pow(FRICTION, dt * 60);
          if (Math.abs(s.vel) < 0.002) s.vel = 0;
        }
        // keep the numbers small; shift the glide target by the same amount
        if (s.p < 0 || s.p >= n) {
          const shift = Math.floor(s.p / n) * n;
          s.p -= shift;
          if (s.target !== null) s.target -= shift;
        }

        if (!frozen) s.orbit += dt * 0.12;
        s.f += ((focused ? 1 : 0) - s.f) * Math.min(1, dt * 3.2);
        if (!focused && s.f < 0.002) s.f = 0;

        /* ---- open the artwork once the camera has arrived ---- */
        if (focused && s.f > 0.82 && !s.overlayOn) {
          s.overlayOn = true;
          setOverlayShown(true);
        }

        /* ---- camera ---- */
        const aspectRatio = w / h;
        const ov = overviewPose(l.table.extent + cardW * 0.6, s.orbit + s.yaw, c.fov, aspectRatio);
        const rd = ridePose(l.table, spacing, s.p, c.offset);
        const e = smooth(s.mLin);
        let pos = lerp3(ov.pos, rd.pos, e);
        let tgt = lerp3(ov.target, rd.target, e);
        const F = smooth(s.f);
        if (F > 0) {
          const fp = focusPose(l.frames[s.focusLast] ?? l.frames[0], cardH, c.fov);
          pos = lerp3(pos, fp.pos, F);
          tgt = lerp3(tgt, fp.target, F);
        }
        const cam = basis(pos, tgt);
        const focal = h / 2 / Math.tan((c.fov * Math.PI) / 360);
        const dRef = Math.max(1.5, len(sub(tgt, pos)));

        if (contentRef.current) contentRef.current.style.opacity = String(clamp(1 - F * 1.4, 0, 1));

        /* ---- shadow sprite ---- */
        const Hs = SPRITE_H;
        const Ws = Math.max(2, Math.round(Hs * c.aspect));
        const rad = c.radius * Math.min(Ws, Hs) * 0.5;
        const sk = `${Ws}|${Hs}|${rad.toFixed(1)}`;
        if (sk !== shadowKey) {
          shadowKey = sk;
          shadowPad = Math.round(Hs * 0.3);
          shadowCv = makeShadow(Ws, Hs, shadowPad, rad);
        }

        /* ---- project every card ---- */
        type Item = { card: number; q: Quad; dist: number; z: number };
        const vis: Item[] = [];
        for (let i = 0; i < n; i++) {
          const fr = l.frames[i];
          s.lift[i] += ((i === s.hoverCard && c.pauseOnHover ? 1 : 0) - s.lift[i]) * Math.min(1, dt * 10);
          const ctr = add(fr.p, mul(fr.n, s.lift[i] * 0.22 * cardH));
          const hw = cardW / 2;
          const hh = cardH / 2;
          const tl = add(sub(ctr, mul(fr.x, hw)), mul(fr.a, hh));
          const tr = add(add(ctr, mul(fr.x, hw)), mul(fr.a, hh));
          const br = sub(add(ctr, mul(fr.x, hw)), mul(fr.a, hh));
          const bl = sub(sub(ctr, mul(fr.x, hw)), mul(fr.a, hh));
          const a = project(cam, tl, focal, w / 2, h / 2);
          const b = project(cam, tr, focal, w / 2, h / 2);
          const d = project(cam, bl, focal, w / 2, h / 2);
          const r = project(cam, br, focal, w / 2, h / 2);
          if (!a || !b || !d || !r) continue;
          const minX = Math.min(a.x, b.x, d.x, r.x);
          const maxX = Math.max(a.x, b.x, d.x, r.x);
          const minY = Math.min(a.y, b.y, d.y, r.y);
          const maxY = Math.max(a.y, b.y, d.y, r.y);
          if (maxX < -40 || minX > w + 40 || maxY < -40 || minY > h + 40) continue;
          // skip degenerate or enormous quads (a card right at the lens)
          if (
            !Number.isFinite(minX + maxX + minY + maxY) ||
            maxX - minX > w * 3 ||
            maxY - minY > h * 3
          )
            continue;
          // far too close / too big to be useful (and costly to paint)
          if (Math.min(a.z, b.z, d.z, r.z) < 0.6) continue;
          if (maxX - minX > w * 3 || maxY - minY > h * 3) continue;
          vis.push({
            card: i,
            q: [a.x, a.y, b.x, b.y, r.x, r.y, d.x, d.y],
            dist: len(sub(ctr, pos)),
            z: (a.z + b.z + d.z + r.z) / 4,
          });
        }
        vis.sort((x, y) => y.dist - x.dist); // far → near

        const fogAlpha = (dist: number) => {
          if (c.fog <= 0) return 1;
          const t = (dist - dRef * 0.6) / (dRef * 2.2);
          return Math.pow(clamp(1 - c.fog * t, 0, 1), 1.3);
        };

        /* ---- draw ---- */
        ctx.setTransform(dprEff, 0, 0, dprEff, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // the fine thread running through the cards
        if (c.thread > 0.001) {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = c.accentColor;
          let prev: { x: number; y: number; z: number } | null = null;
          for (let i = 0; i < l.thread.length; i++) {
            const pt = project(cam, l.thread[i], focal, w / 2, h / 2);
            const sane =
              !!pt && pt.z > 0.6 && Math.abs(pt.x - w / 2) < w * 4 && Math.abs(pt.y - h / 2) < h * 4;
            if (!sane) {
              prev = null;
              continue;
            }
            if (pt && prev) {
              const dist = len(sub(l.thread[i], pos));
              ctx.globalAlpha = c.thread * fogAlpha(dist) * (1 - F * 0.8);
              if (ctx.globalAlpha > 0.01) {
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(pt.x, pt.y);
                ctx.stroke();
              }
            }
            prev = pt;
          }
        }

        s.hits.length = 0;
        for (const v of vis) {
          const [tlx, tly, trx, try_, brx, bry, blx, bly] = v.q;
          const itemIdx = l.seq[v.card];
          const sprite = itemIdx >= 0 ? sprites.current.get(itemIdx) : undefined;

          let alpha = fogAlpha(v.dist);
          if (focused && v.card !== s.focusCard) alpha *= 1 - 0.8 * F;
          if (v.card === s.focusCard) alpha = Math.max(alpha, F);
          if (alpha < 0.01) continue;

          // Cards are double-sided: seen from behind, the picture is flipped so it
          // still reads the right way round (a touch dimmer).
          const det = (trx - tlx) * (bly - tly) - (try_ - tly) * (blx - tlx);
          const back = det < 0;
          if (back) alpha *= 0.82;
          const ox = back ? trx : tlx;
          const oy = back ? try_ : tly;
          const sx = ((back ? tlx : trx) - ox) / Ws;
          const sy = ((back ? tly : try_) - oy) / Ws;
          const kx = ((back ? brx : blx) - ox) / Hs;
          const ky = ((back ? bry : bly) - oy) / Hs;
          // a card seen exactly edge-on has nothing to draw (and a non-invertible matrix)
          if (Math.abs(sx * ky - sy * kx) < 2e-4) continue;

          ctx.save();
          ctx.setTransform(dprEff * sx, dprEff * sy, dprEff * kx, dprEff * ky, dprEff * ox, dprEff * oy);

          if (c.shadow > 0.01 && shadowCv) {
            ctx.globalAlpha = clamp(c.shadow * 0.85 * alpha, 0, 1);
            ctx.drawImage(shadowCv, -shadowPad, -shadowPad + Hs * 0.06);
          }

          ctx.globalAlpha = alpha;
          roundRectPath(ctx, 0, 0, Ws, Hs, rad);
          ctx.clip();
          if (sprite) {
            ctx.drawImage(sprite, 0, 0);
          } else {
            const g = ctx.createLinearGradient(0, 0, Ws, Hs);
            g.addColorStop(0, "#5a3d66");
            g.addColorStop(1, "#30213a");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, Ws, Hs);
          }
          ctx.restore();
          if (alpha > 0.12) s.hits.push({ card: v.card, q: v.q });
        }
        ctx.globalAlpha = 1;
        s.hits.reverse(); // nearest first for hit-testing

        // cursor hint
        stage.style.cursor =
          s.hoverCard >= 0 && c.interactive && c.focusOnClick
            ? "pointer"
            : c.interactive && c.draggable
              ? "grab"
              : "default";
      };

      raf = requestAnimationFrame(tick);

      // wheel: native listener so it can be non-passive
      const onWheel = (e: WheelEvent) => {
        const { p: c } = live.current;
        if (!c.interactive || !c.wheel) return;
        e.preventDefault();
        let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (e.deltaMode === 1) d *= 16;
        if (s.focusCard >= 0 || s.overlayOn) actions.release();
        actions.diveBackIn();
        s.target = null;
        s.vel = clamp(s.vel + (d / 100) * 5, -30, 30);
      };
      root.addEventListener("wheel", onWheel, { passive: false });

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        root.removeEventListener("wheel", onWheel);
        window.clearTimeout(s.holdTimer);
      };
    }, [actions]);

    /* ---- pointer ---- */
    const local = (e: React.PointerEvent) => {
      const r = stageRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hitTest = (x: number, y: number) => {
      for (const h of sim.current.hits) if (inQuad(h.q, x, y)) return h.card;
      return -1;
    };

    const onPointerDown = (e: React.PointerEvent) => {
      const c = live.current.p;
      if (!c.interactive || e.button > 0) return;
      const s = sim.current;
      const pt = local(e);
      const now = performance.now();
      s.down = { x: pt.x, y: pt.y, lx: pt.x, ly: pt.y, t: now, lt: now, moved: 0, type: e.pointerType };
      stageRef.current?.setPointerCapture(e.pointerId);
      window.clearTimeout(s.holdTimer);
      if (c.holdToReveal && s.focusCard < 0) {
        s.holdTimer = window.setTimeout(() => {
          if (s.down && s.down.moved < 6) s.hold = true;
        }, 260);
      }
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const c = live.current.p;
      if (!c.interactive) return;
      const s = sim.current;
      const pt = local(e);
      const d = s.down;
      if (!d) {
        s.hoverCard = e.pointerType === "touch" ? -1 : hitTest(pt.x, pt.y);
        return;
      }
      const dx = pt.x - d.lx;
      const dy = pt.y - d.ly;
      d.moved = Math.max(d.moved, Math.hypot(pt.x - d.x, pt.y - d.y));
      d.lx = pt.x;
      d.ly = pt.y;
      if (s.hold) {
        s.yaw += dx * 0.007; // turn the whole path while holding
        return;
      }
      if (d.moved < 6 || !c.draggable || s.focusCard >= 0) return;
      window.clearTimeout(s.holdTimer);
      if (!s.dragging) {
        s.dragging = true;
        s.target = null;
        actions.diveBackIn();
      }
      const now = performance.now();
      const dtS = Math.max(0.004, (now - d.lt) / 1000);
      const axis = d.type === "touch" ? dx : dy; // vertical with a mouse, sideways on touch
      const cardsMoved = -axis / 70;
      s.p += cardsMoved;
      s.vel = clamp(s.vel * 0.6 + (cardsMoved / dtS) * 0.4, -30, 30);
      d.lt = now;
    };

    const onPointerUp = (e: React.PointerEvent) => {
      const c = live.current.p;
      const s = sim.current;
      window.clearTimeout(s.holdTimer);
      const d = s.down;
      s.down = null;
      if (stageRef.current?.hasPointerCapture(e.pointerId)) {
        stageRef.current.releasePointerCapture(e.pointerId);
      }
      if (!d) return;
      if (s.hold) {
        s.hold = false;
        actions.diveBackIn();
        return;
      }
      if (s.dragging) {
        s.dragging = false;
        if (performance.now() - d.lt > 90) s.vel = 0;
        return;
      }
      if (d.moved < 6 && performance.now() - d.t < 450) {
        if (s.focusCard >= 0) {
          actions.release(); // click again to ride on
          return;
        }
        if (!c.focusOnClick) return;
        const pt = local(e);
        const hit = hitTest(pt.x, pt.y);
        if (hit >= 0) actions.doFocus(hit);
      }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (!live.current.p.interactive) return;
      const s = sim.current;
      const total = live.current.cards;
      if (e.key === "Escape") {
        e.preventDefault();
        actions.release();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (s.focusCard >= 0) actions.doFocus(s.focusCard + 1);
        else {
          actions.diveBackIn();
          actions.travel(1);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (s.focusCard >= 0) actions.doFocus(s.focusCard - 1 + total);
        else {
          actions.diveBackIn();
          actions.travel(-1);
        }
      }
    };

    /* ---- overlay content ---- */
    const open = openItem >= 0 ? items[openItem] : undefined;
    const hasBg = p.backgroundColor && p.backgroundColor !== "transparent";
    const rootStyle: CSSProperties = {
      ...(hasBg ? { background: p.backgroundColor } : null),
      ...props.style,
    };

    return (
      <div
        ref={rootRef}
        className={`dr${props.className ? ` ${props.className}` : ""}`}
        style={rootStyle}
        tabIndex={p.interactive ? 0 : -1}
        role="group"
        aria-roledescription="carousel"
        aria-label={p.ariaLabel}
        onKeyDown={onKeyDown}
        onPointerLeave={() => {
          sim.current.hoverCard = -1;
        }}
      >
        <div
          ref={stageRef}
          className="dr__stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="dr__canvas" aria-hidden="true" />
        </div>

        {props.children && (
          <div ref={contentRef} className="dr__content">
            {props.children}
          </div>
        )}

        {/* the opened artwork */}
        <div
          className={`dr__open${overlayShown && open ? " is-on" : ""}`}
          role="dialog"
          aria-modal="false"
          aria-label={open?.title ?? open?.alt ?? "Artwork"}
          aria-hidden={!(overlayShown && open)}
          onClick={() => actions.release()}
        >
          {open && (
            <figure className="dr__figure">
              <img src={open.src} alt={open.alt} draggable={false} />

            </figure>
          )}
          <button
            type="button"
            className="dr__close"
            aria-label="Close artwork and ride on"
            onClick={(e) => {
              e.stopPropagation();
              actions.release();
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  },
);

export default DepthRibbon;

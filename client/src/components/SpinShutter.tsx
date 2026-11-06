import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import "./SpinShutter.css";

import { spinShutterArtworks } from "../data/SpinShutter";
import {
  TAU,
  artFor,
  clamp,
  computeFit,
  mod,
  project,
  slotOffset,
  solveRot,
  type Fit,
  type Layout,
} from "./spinShutterMath";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Shape used by the data file (data/SpinShutter.ts). */
export type SpinArtwork = {
  id: string;
  title: string;
  note: string;
  image: string | null;
  alt: string;
};

export type SpinShutterItem = {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  href?: string;
};

export type SpinShutterHandle = {
  next: () => void;
  previous: () => void;
  show: (index: number) => void;
  release: () => void;
  replay: () => void;
};

export type SpinShutterProps = {
  items?: SpinShutterItem[];
  count?: number;
  startIndex?: number;
  aspect?: number;
  size?: number;
  radius?: number;
  tilt?: number;
  roll?: number;
  distance?: number;
  scale?: number;
  cluster?: number;
  spread?: number;
  speed?: number;
  aperture?: number;
  haze?: number;
  shadow?: number;
  intro?: boolean;
  pauseOnHover?: boolean;
  draggable?: boolean;
  wheel?: boolean;
  captions?: boolean;
  /** Clicking a card opens that artwork full size (default true). */
  openOnClick?: boolean;
  backgroundColor?: string;
  paused?: boolean;
  dpr?: number;
  ariaLabel?: string;
  onFocusChange?: (item: SpinShutterItem, index: number) => void;
  onSelect?: (item: SpinShutterItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
};

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                   */
/* -------------------------------------------------------------------------- */

const BUILT_IN_ITEMS: SpinShutterItem[] = spinShutterArtworks.map((a) => ({
  src: a.image ?? "",
  alt: a.alt,
  title: a.title,
  subtitle: a.note,
}));

const DEFAULTS = {
  count: 0,
  startIndex: 0,
  aspect: 1,
  size: 0.38,
  radius: 14,
  tilt: 14,
  roll: -24,
  distance: 3.2,
  scale: 1,
  cluster: 1,
  spread: 0.6,
  speed: 1.2,
  aperture: 0.45,
  haze: 0.3,
  shadow: 0.35,
  intro: true,
  pauseOnHover: true,
  draggable: true,
  wheel: true,
  captions: true,
  openOnClick: true,
  backgroundColor: "transparent",
  paused: false,
  dpr: 2,
  ariaLabel:
    "Photo orbit. Drag to spin it, use the arrow keys to browse, Space to pause and Enter to open the photo in focus.",
};

const MAX_CARDS = 48;
const MAX_ITEMS = 64;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const imageCache = new Map<string, HTMLImageElement>();

function getImage(src: string): HTMLImageElement | null {
  if (!src) return null;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;
    img.decode?.().catch(() => {});
    imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function parseColor(css: string): [number, number, number, number] | null {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  } catch {
    return null;
  }
}

const luminance = ([r, g, b]: number[]) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const r = w / h;
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
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* ---- pre-rendered sprites (keeps every frame cheap) ---- */

const SPR_H = 360; // base sprite height (px)
const BLUR_H = 200; // blurred sprites are smaller — blur hides the detail
const BLUR_STEP = 0.015; // blur levels, as a fraction of card height
const MAX_LEVEL = 6;
const PAD = 0.3; // padding around blurred sprites, fraction of BLUR_H
const MAX_BLURRED = 150;

function makeBase(img: HTMLImageElement, aspect: number, rr: number) {
  const H = SPR_H;
  const W = Math.round(H * aspect);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  roundRectPath(g, 0, 0, W, H, rr * H);
  g.clip();
  drawCover(g, img, 0, 0, W, H);
  return cv;
}

function makeBlurred(base: HTMLCanvasElement, level: number) {
  const H = BLUR_H;
  const W = Math.round((H * base.width) / base.height);
  const P = Math.round(PAD * H);
  const cv = document.createElement("canvas");
  cv.width = W + P * 2;
  cv.height = H + P * 2;
  const g = cv.getContext("2d")!;
  g.filter = `blur(${(level * BLUR_STEP * H).toFixed(1)}px)`;
  g.drawImage(base, P, P, W, H);
  return cv;
}

const SHADOW_H = 128;
const SHADOW_M = 0.3;

function makeShadow(aspect: number, rr: number) {
  const H = SHADOW_H;
  const W = Math.round(H * aspect);
  const M = Math.round(SHADOW_M * H);
  const cv = document.createElement("canvas");
  cv.width = W + M * 2;
  cv.height = H + M * 2;
  const g = cv.getContext("2d")!;
  g.filter = `blur(${(0.1 * H).toFixed(1)}px)`;
  g.fillStyle = "#000";
  roundRectPath(g, M, M, W, H, rr * H);
  g.fill();
  return cv;
}

type Hit = { art: number; x: number; y: number; w: number; h: number; z: number };

/* -------------------------------------------------------------------------- */
/*  Orbit component                                                            */
/* -------------------------------------------------------------------------- */

export const SpinShutter = forwardRef<SpinShutterHandle, SpinShutterProps>(
  function SpinShutter(props, ref) {
    // Drop undefined values so they don't override defaults.
    const defined = Object.fromEntries(
      Object.entries(props).filter(([, v]) => v !== undefined),
    ) as SpinShutterProps;
    const p = { ...DEFAULTS, ...defined };

    const items = useMemo(
      () => (props.items ?? BUILT_IN_ITEMS).slice(0, MAX_ITEMS),
      [props.items],
    );
    const photos = items.length;
    const cards = clamp(
      Math.round(p.count > 0 ? p.count : Math.min(photos, MAX_CARDS)),
      1,
      MAX_CARDS,
    );
    const layout: Layout = {
      count: cards,
      cluster: Math.max(1, Math.round(p.cluster)),
      spread: clamp(p.spread, 0.05, 1),
      photos: Math.max(1, photos),
    };

    const rootRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [focusArt, setFocusArt] = useState(0);
    const [openArt, setOpenArt] = useState(-1); // artwork shown full size

    // Latest values for the animation loop & event handlers.
    const live = useRef({ p, items, layout });
    live.current = { p, items, layout };
    const cbs = useRef({
      onFocusChange: props.onFocusChange,
      onSelect: props.onSelect,
    });
    cbs.current = {
      onFocusChange: props.onFocusChange,
      onSelect: props.onSelect,
    };

    const sim = useRef({
      rot: 0,
      vel: 0,
      target: null as number | null,
      pendingArt: null as number | null,
      dragging: false,
      hovered: false,
      held: false,
      userPaused: false,
      modal: false, // an artwork is open: hold the spin
      inView: true,
      intro: 1,
      w: 0,
      h: 0,
      spinFactor: 1,
      tiltOff: 0,
      wheelAcc: 0,
      wheelT: 0,
      wheelStep: 0,
      hoverArt: null as number | null,
      frontArt: 0,
      lastFocus: -1,
      dark: true,
      fit: null as Fit | null,
      fitKey: "",
      hits: [] as Hit[],
      ready: false,
    });

    /* ---- imperative API ---- */
    const api = useMemo(() => {
      const s = sim.current;
      const show = (index: number) => {
        const { layout: l } = live.current;
        if (l.photos < 1) return;
        const art = mod(Math.round(index), l.photos);
        s.target = solveRot(art, s.rot, l);
        s.pendingArt = art;
        s.held = true;
        s.vel = 0;
      };
      const base = () => s.pendingArt ?? s.frontArt;
      return {
        show,
        next: () => show(base() + 1),
        previous: () => show(base() - 1),
        release: () => {
          s.held = false;
          s.pendingArt = null;
        },
        replay: () => {
          const { p: pp, layout: l } = live.current;
          s.rot = solveRot(clamp(Math.round(pp.startIndex), 0, l.photos - 1), 0, l);
          s.target = null;
          s.pendingArt = null;
          s.vel = 0;
          s.held = false;
          s.intro = 0;
        },
      } satisfies SpinShutterHandle;
    }, []);
    useImperativeHandle(ref, () => api, [api]);

    const open = (art: number) => {
      const { items: list } = live.current;
      const item = list[art];
      if (!item) return;
      cbs.current.onSelect?.(item, art);
      if (live.current.p.openOnClick) {
        if (!item.src) return;
        sim.current.modal = true;
        api.show(art); // bring it to the front while it is open
        setOpenArt(art);
        return;
      }
      if (item.href) window.location.assign(item.href);
    };

    const closeOpen = () => {
      sim.current.modal = false;
      setOpenArt(-1);
      api.release();
    };

    /* ---- prop sync ---- */
    useEffect(() => {
      sim.current.userPaused = p.paused;
    }, [p.paused]);

    /* ---- main effect: size, observers, wheel, draw loop ---- */
    useEffect(() => {
      const stage = stageRef.current;
      const canvas = canvasRef.current;
      const root = rootRef.current;
      if (!stage || !canvas || !root) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const s = sim.current;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      const supportsFilter = "filter" in ctx;

      // start position
      {
        const { p: pp, layout: l } = live.current;
        s.rot = solveRot(clamp(Math.round(pp.startIndex), 0, l.photos - 1), 0, l);
        s.intro = pp.intro && !reduce.matches ? 0 : 1;
        s.userPaused = pp.paused;
      }

      let dprEff = 1;
      const resize = () => {
        const r = stage.getBoundingClientRect();
        s.w = r.width;
        s.h = r.height;
        dprEff = Math.min(window.devicePixelRatio || 1, live.current.p.dpr);
        canvas.width = Math.max(1, Math.round(r.width * dprEff));
        canvas.height = Math.max(1, Math.round(r.height * dprEff));
        s.fitKey = "";
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(stage);

      const io = new IntersectionObserver(
        ([e]) => {
          s.inView = e.isIntersecting;
        },
        { threshold: 0.02 },
      );
      io.observe(stage);

      const onWheel = (e: WheelEvent) => {
        const { p: pp } = live.current;
        if (!pp.wheel) return;
        e.preventDefault();
        const now = performance.now();
        if (now - s.wheelT > 160) s.wheelAcc = 0;
        s.wheelT = now;
        if (now - s.wheelStep < 260) return;
        let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (e.deltaMode === 1) d *= 16;
        s.wheelAcc += d;
        if (Math.abs(s.wheelAcc) >= 50) {
          if (s.wheelAcc > 0) api.next();
          else api.previous();
          s.wheelAcc = 0;
          s.wheelStep = now;
        }
      };
      stage.addEventListener("wheel", onWheel, { passive: false });

      const sprites = {
        key: "",
        base: new Map<number, HTMLCanvasElement>(),
        blurred: new Map<string, HTMLCanvasElement>(),
        shadow: null as HTMLCanvasElement | null,
      };

      let last = performance.now();
      let raf = 0;

      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!s.inView || s.w < 2 || s.h < 2) return;

        const { p: c, items: list, layout: l } = live.current;
        const calm = reduce.matches;

        /* tone (light / dark background) */
        if (!s.ready) {
          const bg =
            c.backgroundColor && c.backgroundColor !== "transparent"
              ? parseColor(c.backgroundColor)
              : null;
          if (bg && bg[3] > 0.5) s.dark = luminance(bg) < 0.5;
          else {
            const txt = parseColor(getComputedStyle(root).color);
            s.dark = txt ? luminance(txt) > 0.5 : true;
          }
          s.ready = true;
        }

        /* ---- motion ---- */
        if (s.intro < 1) s.intro = Math.min(1, s.intro + dt / 1.8);

        const slowTo = c.pauseOnHover && s.hovered ? 0 : 1;
        s.spinFactor += (slowTo - s.spinFactor) * Math.min(1, dt * 4);

        if (s.target !== null) {
          const diff = s.target - s.rot;
          s.rot += diff * Math.min(1, dt * 6);
          if (Math.abs(diff) < 0.0006) {
            s.rot = s.target;
            s.target = null;
          }
          s.vel = 0;
        } else if (!s.dragging) {
          s.rot += s.vel * dt;
          s.vel *= Math.pow(0.04, dt);
          const hold = s.held || s.userPaused || calm || s.intro < 1 || s.modal;
          if (!hold) s.rot += ((c.speed * TAU) / 60) * dt * s.spinFactor;
        }

        if (!s.dragging) s.tiltOff += (0 - s.tiltOff) * Math.min(1, dt * 6);

        /* ---- camera + fit ---- */
        const tilt = clamp(c.tilt + s.tiltOff, 0, 80);
        const cam = { tilt, distance: Math.max(1.2, c.distance), roll: c.roll };
        const key = [s.w, s.h, c.tilt, c.distance, c.roll, c.size, c.aspect, c.scale].join("|");
        if (key !== s.fitKey || !s.fit) {
          s.fit = computeFit(
            s.w,
            s.h,
            { tilt: c.tilt, distance: cam.distance, roll: c.roll },
            c.size,
            c.aspect,
            c.scale,
          );
          s.fitKey = key;
        }
        const fit = s.fit;
        const tiltRad = (tilt * Math.PI) / 180;
        const focus = cam.distance - Math.cos(tiltRad);
        const cx = s.w / 2 + fit.ox;
        const cy = s.h / 2 + fit.oy;
        const ease = 1 - Math.pow(1 - s.intro, 3);
        const fontFamily = '"Cormorant Garamond", Georgia, serif';
        const sizeFactor = Math.min(s.w, s.h) / 640;
        const frontCardH = (c.size * fit.S) / focus;

        /* ---- gather cards ---- */
        type Draw = {
          art: number;
          x: number;
          y: number;
          w: number;
          h: number;
          depth: number;
        };
        const draws: Draw[] = [];
        let frontCos = -2;
        let front = 0;

        for (let i = 0; i < l.count; i++) {
          const off = slotOffset(i, s.rot, l);
          const finalAngle = s.rot + off;
          const art = artFor(i, finalAngle, l);
          const angle = s.rot + off * ease + (1 - ease) * -TAU * 0.75;
          const q = project(angle, cam);
          draws.push({
            art,
            x: cx + q.x * fit.S,
            y: cy + q.y * fit.S,
            w: c.size * c.aspect * fit.S * q.k,
            h: c.size * fit.S * q.k,
            depth: q.depth,
          });
          const cosA = Math.cos(finalAngle);
          if (cosA > frontCos) {
            frontCos = cosA;
            front = art;
          }
        }
        s.frontArt = front;
        if (s.pendingArt !== null && s.target === null) s.pendingArt = null;

        /* focus (hover wins over front) */
        const focusIdx = s.hoverArt ?? front;
        if (focusIdx !== s.lastFocus) {
          s.lastFocus = focusIdx;
          setFocusArt(focusIdx);
          const item = list[focusIdx];
          if (item) cbs.current.onFocusChange?.(item, focusIdx);
        }

        /* ---- draw (far → near) ---- */
        draws.sort((a, b) => b.depth - a.depth);
        ctx.setTransform(dprEff, 0, 0, dprEff, 0, 0);
        ctx.clearRect(0, 0, s.w, s.h);
        s.hits.length = 0;

        // Sprites depend on card shape; rebuild only if that changes.
        const rrRatio = c.radius / frontCardH;
        const spriteKey = `${c.aspect}|${rrRatio.toFixed(2)}`;
        if (spriteKey !== sprites.key) {
          sprites.key = spriteKey;
          sprites.base.clear();
          sprites.blurred.clear();
          sprites.shadow = null;
        }
        if (!sprites.shadow) sprites.shadow = makeShadow(c.aspect, rrRatio);
        let built = 0; // limit sprite builds per frame to avoid hitches

        for (const d of draws) {
          const far = clamp((d.depth - focus) / 2, 0, 1);
          const blur = c.aperture * 47 * sizeFactor * ((d.depth - focus) / d.depth);
          const alpha = clamp(1 - c.haze * far * 1.3, 0.08, 1) * clamp(ease * 3, 0, 1);
          const near = 1 - far;
          const rel = d.h / frontCardH;
          const x0 = d.x - d.w / 2;
          const y0 = d.y - d.h / 2;

          // soft shadow (one cached sprite, scaled)
          if (c.shadow > 0.001) {
            const sh = sprites.shadow;
            const k = d.h / SHADOW_H;
            const m = SHADOW_M * SHADOW_H * k;
            ctx.globalAlpha = alpha * clamp(c.shadow * 0.9 * (0.35 + 0.65 * near), 0, 1);
            ctx.drawImage(sh, x0 - m, y0 - m + d.h * 0.07, sh.width * k, sh.height * k);
          }

          ctx.globalAlpha = alpha;
          const item = list[d.art];
          const img = item ? getImage(item.src) : null;
          let base = img ? sprites.base.get(d.art) : undefined;
          if (img && !base && built < 3) {
            base = makeBase(img, c.aspect, rrRatio);
            sprites.base.set(d.art, base);
            built++;
          }

          if (base) {
            let level = 0;
            if (supportsFilter) {
              level = clamp(Math.round(blur / d.h / BLUR_STEP), 0, MAX_LEVEL);
            }
            let bl: HTMLCanvasElement | undefined;
            if (level > 0) {
              const bk = `${d.art}:${level}`;
              bl = sprites.blurred.get(bk);
              if (bl) {
                // refresh LRU order
                sprites.blurred.delete(bk);
                sprites.blurred.set(bk, bl);
              } else if (built < 3) {
                bl = makeBlurred(base, level);
                sprites.blurred.set(bk, bl);
                built++;
                if (sprites.blurred.size > MAX_BLURRED) {
                  const oldest = sprites.blurred.keys().next().value;
                  if (oldest !== undefined) sprites.blurred.delete(oldest);
                }
              }
            }
            if (bl) {
              const k = d.h / BLUR_H;
              const P = Math.round(PAD * BLUR_H) * k;
              ctx.drawImage(bl, x0 - P, y0 - P, bl.width * k, bl.height * k);
            } else {
              ctx.drawImage(base, x0, y0, d.w, d.h);
            }
          } else {
            // placeholder (no image yet / no image file)
            const r = c.radius * rel;
            roundRectPath(ctx, x0, y0, d.w, d.h, r);
            const g = ctx.createLinearGradient(x0, y0, x0 + d.w, y0 + d.h);
            if (s.dark) {
              g.addColorStop(0, "#5a3d66");
              g.addColorStop(1, "#30213a");
            } else {
              g.addColorStop(0, "#f3dbe8");
              g.addColorStop(1, "#d9c6ea");
            }
            ctx.fillStyle = g;
            ctx.fill();
            ctx.fillStyle = s.dark ? "#f3bbd2" : "#5a3d66";
            ctx.font = `300 ${Math.round(d.h * 0.3)}px ${fontFamily}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            }

          s.hits.push({ art: d.art, x: x0, y: y0, w: d.w, h: d.h, z: d.depth });
        }
        ctx.globalAlpha = 1;
        // nearest first for hit-testing
        s.hits.reverse();
      };

      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        stage.removeEventListener("wheel", onWheel);
      };
    }, [api]);

    // Re-detect tone when the background changes.
    useEffect(() => {
      sim.current.ready = false;
    }, [p.backgroundColor]);

    // Restart from the start card when the photo set or card count changes.
    const firstRun = useRef(true);
    useEffect(() => {
      if (firstRun.current) {
        firstRun.current = false;
        return;
      }
      api.replay();
      sim.current.lastFocus = -1;
    }, [items, cards, layout.cluster, api]);

    /* ---- pointer handling ---- */
    const down = useRef<{
      x: number;
      y: number;
      lx: number;
      ly: number;
      t: number;
      lt: number;
      moved: number;
    } | null>(null);

    const local = (e: React.PointerEvent) => {
      const r = stageRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const hitTest = (x: number, y: number) =>
      sim.current.hits.find(
        (h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h,
      ) ?? null;

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button > 0) return;
      const pt = local(e);
      const now = performance.now();
      down.current = {
        x: pt.x,
        y: pt.y,
        lx: pt.x,
        ly: pt.y,
        t: now,
        lt: now,
        moved: 0,
      };
      stageRef.current?.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
      const s = sim.current;
      const pt = local(e);
      const d = down.current;

      if (!d) {
        if (e.pointerType !== "touch") {
          const hit = hitTest(pt.x, pt.y);
          s.hoverArt = hit ? hit.art : null;
        }
        return;
      }

      const { p: c } = live.current;
      const dx = pt.x - d.lx;
      const dy = pt.y - d.ly;
      d.moved = Math.hypot(pt.x - d.x, pt.y - d.y);
      if (!c.draggable || d.moved < 5) return;

      const now = performance.now();
      const dtS = Math.max(0.001, (now - d.lt) / 1000);
      if (!s.dragging) {
        s.dragging = true;
        s.target = null;
        s.pendingArt = null;
        s.held = false;
        s.vel = 0;
      }

      // Split the drag into "along the orbit" (spins) and "across" (tilts).
      const r = (c.roll * Math.PI) / 180;
      const along = dx * Math.cos(r) + dy * Math.sin(r);
      const across = -dx * Math.sin(r) + dy * Math.cos(r);
      const focus = Math.max(1.2, c.distance) - 1;
      const dAngle = s.fit ? (along * focus) / s.fit.S : along * 0.006;
      s.rot += dAngle;
      s.vel = clamp(dAngle / dtS, -8, 8);
      s.tiltOff = clamp(s.tiltOff + across * 0.18, -c.tilt, 45);

      d.lx = pt.x;
      d.ly = pt.y;
      d.lt = now;
    };

    const endPointer = (e: React.PointerEvent) => {
      const s = sim.current;
      const d = down.current;
      down.current = null;
      if (stageRef.current?.hasPointerCapture(e.pointerId)) {
        stageRef.current.releasePointerCapture(e.pointerId);
      }
      if (!d) return;

      if (s.dragging) {
        s.dragging = false;
        if (performance.now() - d.lt > 90) s.vel = 0;
        return;
      }
      if (d.moved < 5 && performance.now() - d.t < 600) {
        const pt = local(e);
        const hit = hitTest(pt.x, pt.y);
        if (!hit) return;
        if (live.current.p.openOnClick) open(hit.art);
        else if (hit.art === s.frontArt && s.target === null) open(hit.art);
        else api.show(hit.art);
      }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      const s = sim.current;
      if (openArt >= 0) {
        // while an artwork is open: Esc closes, arrows flip through the collection
        const total = live.current.items.length;
        if (e.key === "Escape") {
          e.preventDefault();
          closeOpen();
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          const nextArt = mod(openArt + 1, total);
          api.show(nextArt);
          setOpenArt(nextArt);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          const prevArt = mod(openArt - 1, total);
          api.show(prevArt);
          setOpenArt(prevArt);
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        api.next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        api.previous();
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        s.userPaused = !s.userPaused;
      } else if (e.key === "Enter") {
        e.preventDefault();
        open(s.hoverArt ?? s.frontArt);
      }
    };

    /* ---- caption ---- */
    const item = items[focusArt] ?? items[0];
    const openItem = openArt >= 0 ? items[openArt] : undefined;
    const showCaption = p.captions && !!item && (!!item.title || !!item.subtitle);

    const bg = p.backgroundColor;
    const hasBg = !!bg && bg !== "transparent";
    const rootStyle: CSSProperties = {
      ...(hasBg ? { background: bg } : null),
      ...props.style,
    };

    if (photos === 0) return null;

    return (
      <div
        ref={rootRef}
        className={`spin-orbit${props.className ? ` ${props.className}` : ""}`}
        style={rootStyle}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={p.ariaLabel}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && !sim.current.hovered)
            api.release();
        }}
      >
        <div
          ref={stageRef}
          className={`spin-orbit__stage${p.draggable ? " is-draggable" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") sim.current.hovered = true;
          }}
          onPointerLeave={() => {
            const s = sim.current;
            s.hovered = false;
            s.hoverArt = null;
            if (!down.current) api.release();
          }}
        >
          <canvas ref={canvasRef} className="spin-orbit__canvas" aria-hidden="true" />
        </div>

        <div className="spin-orbit__caption" aria-live="polite">
          {showCaption && (
            <>
              {item.title && <h3>{item.title}</h3>}
              {item.subtitle && <p>{item.subtitle}</p>}
            </>
          )}
        </div>

        {/* the opened artwork */}
        <div
          className={`spin-orbit__open${openArt >= 0 ? " is-on" : ""}`}
          role="dialog"
          aria-modal="false"
          aria-label={openItem?.title ?? openItem?.alt ?? "Artwork"}
          aria-hidden={openArt < 0}
          onClick={closeOpen}
        >
          {openItem && (
            <figure className="spin-orbit__figure">
              <img src={openItem.src} alt={openItem.alt} draggable={false} />
              {p.captions && (openItem.title || openItem.subtitle) && (
                <figcaption>
                  {openItem.title && <strong>{openItem.title}</strong>}
                  {openItem.subtitle && <span>{openItem.subtitle}</span>}
                </figcaption>
              )}
            </figure>
          )}
          <button
            type="button"
            className="spin-orbit__close"
            aria-label="Close artwork"
            onClick={(e) => {
              e.stopPropagation();
              closeOpen();
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  },
);

/* -------------------------------------------------------------------------- */
/*  Sunny's section (heading + orbit). Home.tsx imports this as the default.   */
/* -------------------------------------------------------------------------- */

export const SpinShutterSection = forwardRef<SpinShutterHandle, SpinShutterProps>(
  function SpinShutterSection(props, ref) {
    return (
      <section className="spin-shutter" aria-label="Spin Shutter art collection">
        <div className="spin-shutter__heading">
          <p>THE ART COLLECTION</p>
          <h2>
            Behind the <em>shutter.</em>
          </h2>
        </div>
        <SpinShutter
          ref={ref}
          count={20}
          dpr={1.5}
          size={0.44}
          aspect={3 / 4}
          className="spin-shutter__orbit"
          {...props}
        />
      </section>
    );
  },
);

export default SpinShutterSection;

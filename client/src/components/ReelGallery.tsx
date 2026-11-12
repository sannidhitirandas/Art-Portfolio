import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ReelRowData } from "../data/reelGallery";
import "./ReelGallery.css";

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

export type ReelGalleryProps = {
  /** Image URLs spread across the reels. */
  images?: string[];
  /**
   * Number of stacked reels.
   * (For the existing pages this can also be the `buildReelRows()` result —
   * each reel then uses its own tile order.)
   */
  rows?: number | ReelRowData[];
  rowHeight?: number;
  rowGap?: number;
  itemGap?: number;
  maxAspect?: number;
  minAspect?: number;
  maxFps?: number;
  tilt?: number;
  arch?: number;
  speed?: number;
  speedVariance?: number;
  alternate?: boolean;
  autoScroll?: number;
  inertia?: number;
  damping?: number;
  dragSensitivity?: number;
  wheelSensitivity?: number;
  radius?: number;
  grayscale?: number;
  focusRadius?: number;
  focusStrength?: number;
  brightness?: number;
  dpr?: number;
  fade?: number;
  dim?: number;
  taper?: number;
  backgroundColor?: string;
  interactive?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  ariaLabel?: string;
};

const DEFAULTS = {
  rowHeight: 92,
  rowGap: 20,
  itemGap: 16,
  maxAspect: 2,
  minAspect: 0.6,
  maxFps: 60,
  tilt: 7,
  arch: 48,
  speed: 1,
  speedVariance: 0.55,
  autoScroll: 26,
  inertia: 0.92,
  damping: 0.1,
  dragSensitivity: 1.6,
  wheelSensitivity: 1,
  radius: 10,
  grayscale: 0.55,
  focusRadius: 210,
  focusStrength: 0.85,
  brightness: 1,
  dpr: 1.25,
  fade: 0.12,
  dim: 0.35,
  taper: 0.12,
  backgroundColor: "transparent",
  interactive: true,
  paused: false,
  ariaLabel: "Scrolling reels of artwork. Drag, scroll or use the arrow keys to move them.",
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Deterministic 0–1 pseudo-random from an integer. */
const hash01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PLACEHOLDER_ASPECTS = [0.8, 1.35, 1, 1.7, 0.7, 1.15, 1.5, 0.9];

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

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
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
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

type Sprite = { color: HTMLCanvasElement; gray: HTMLCanvasElement; aspect: number };

function makeSprite(img: HTMLImageElement, aspect: number, H: number): Sprite {
  const W = Math.max(2, Math.round(H * aspect));
  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const cg = color.getContext("2d")!;
  drawCover(cg, img, W, H);

  const gray = document.createElement("canvas");
  gray.width = W;
  gray.height = H;
  const gg = gray.getContext("2d", { willReadFrequently: true })!;
  if (typeof (gg as { filter?: unknown }).filter === "string") {
    gg.filter = "grayscale(1)";
    gg.drawImage(color, 0, 0);
  } else {
    gg.drawImage(color, 0, 0);
    const data = gg.getImageData(0, 0, W, H);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      px[i] = px[i + 1] = px[i + 2] = l;
    }
    gg.putImageData(data, 0, 0);
  }
  return { color, gray, aspect };
}

type Plate = { src: string | null; w: number; x: number; sprite: Sprite | null; idx: number };
type Reel = {
  plates: Plate[];
  len: number; // loop length (px, unscaled)
  target: number;
  disp: number;
  factor: number; // speed multiplier from speedVariance
  sign: 1 | -1; // direction multiplier (alternate)
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ReelGallery(props: ReelGalleryProps) {
  const defined = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined),
  ) as ReelGalleryProps;
  const legacy = Array.isArray(props.rows);
  const p = {
    ...DEFAULTS,
    // The existing pages pass pre-built rows; give them a larger, roomier look.
    ...(legacy ? { rowHeight: 118, rowGap: 22, alternate: true } : { alternate: false }),
    ...defined,
  } as typeof DEFAULTS & ReelGalleryProps & { alternate: boolean };

  /* ---- which image goes on which reel ---- */
  const plan = useMemo(() => {
    const rowsProp = props.rows;
    let seqs: (string | null)[][];
    if (Array.isArray(rowsProp)) {
      seqs = rowsProp.map((r) => r.tiles.map((t) => t.image));
    } else {
      const count = clamp(Math.round(rowsProp ?? 6), 1, 12);
      const list = (props.images ?? []).filter(Boolean);
      if (list.length === 0) {
        seqs = Array.from({ length: count }, () => Array<string | null>(10).fill(null));
      } else {
        seqs = Array.from({ length: count }, (_, r) => {
          const start = (r * Math.ceil(list.length / count) + r * 2) % list.length;
          const out: (string | null)[] = [];
          while (out.length < Math.max(12, list.length)) {
            out.push(list[(start + out.length) % list.length]);
          }
          return out;
        });
      }
    }
    const unique = Array.from(new Set(seqs.flat().filter((s): s is string => !!s)));
    return { seqs, unique, key: JSON.stringify(seqs) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.rows, props.images]);

  const rowCount = plan.seqs.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({ p, plan });
  live.current = { p, plan };

  const input = useRef({
    pushX: 0, // pending input (px) to distribute this frame
    vel: 0, // glide velocity (px/s)
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    px: -9999,
    py: -9999,
    inside: false,
  });

  /* ---- main effect ---- */
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const inp = input.current;

    let w = 0;
    let h = 0;
    let dprEff = 1;
    let inView = false;
    let alive = true;

    const resize = () => {
      const r = root.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const mobile = window.matchMedia("(max-width: 700px)").matches;
      dprEff = Math.min(window.devicePixelRatio || 1, live.current.p.dpr, mobile ? 1 : 1.5);
      canvas.width = Math.max(1, Math.round(w * dprEff));
      canvas.height = Math.max(1, Math.round(h * dprEff));
      // Existing sprites are scaled to the new canvas size; don't force full-image reloads.
    };

    /* sprites + reel layout */
    let reels: Reel[] = [];
    let builtFor = "";
    let loaded = false;
    let fadeIn = 0;
    const images = new Map<string, HTMLImageElement>();
    const imageAspects = new Map<string, number>();
    const sprites = new Map<string, Sprite>();

    const spriteH = () =>
      Math.max(32, Math.round(live.current.p.rowHeight * 1.05 * dprEff));

    const buildLayout = () => {
      const { p: c, plan: pl } = live.current;
      const H = spriteH();
      const key = `${pl.key}|${c.rowHeight}|${c.itemGap}|${c.minAspect}|${c.maxAspect}|${H}`;
      if (key === builtFor) return;
      builtFor = key;

      const prev = reels;
      reels = pl.seqs.map((seq, r) => {
        let cum = 0;
        let ph = 0;
        const plates: Plate[] = seq.map((src, i) => {
          let sprite: Sprite | null = null;
          let aspect = PLACEHOLDER_ASPECTS[(i + r * 3) % PLACEHOLDER_ASPECTS.length];
          const img = src ? images.get(src) : undefined;
          const nat = src ? imageAspects.get(src) : undefined;
          if (src && nat) {
            aspect = clamp(nat, c.minAspect, c.maxAspect);
            const sk = `${src}|${aspect.toFixed(3)}`;
            sprite = sprites.get(sk) ?? null;
            if (!sprite && img) {
              sprite = makeSprite(img, aspect, H);
              sprites.set(sk, sprite);
              // Keep the small canvas sprite, not the full-resolution decoded image.
              images.delete(src);
              imageCache.delete(src);
            }
          } else {
            aspect = clamp(aspect, c.minAspect, c.maxAspect);
          }
          const pw = c.rowHeight * aspect;
          const plate: Plate = { src, w: pw, x: cum + pw / 2, sprite, idx: i };
          cum += pw + c.itemGap;
          ph = cum;
          return plate;
        });
        return {
          plates,
          len: Math.max(1, ph),
          target: prev[r]?.target ?? r * 137,
          disp: prev[r]?.disp ?? r * 137,
          factor: 1 + (hash01(r + 1) - 0.5) * c.speedVariance * 1.2,
          sign: (c.alternate && r % 2 === 1 ? -1 : 1) as 1 | -1,
        };
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    // Progressive, concurrency-limited loading lets the first reels appear before
    // the full artwork set has downloaded, especially on mobile connections.
    let loadStarted = false;
    const startLoad = async () => {
      if (loadStarted || !alive) return;
      loadStarted = true;
      loaded = false;
      const list = live.current.plan.unique;
      let next = 0;
      const mobile = window.matchMedia("(max-width: 700px)").matches;
      const workerCount = Math.min(list.length, mobile ? 2 : 4);
      // Keep the canvas from remaining blank if a large first image is slow.
      const fallbackTimer = window.setTimeout(() => {
        if (alive) {
          loaded = true;
          builtFor = "";
        }
      }, 2200);
      const worker = async () => {
        while (alive && next < list.length) {
          const src = list[next++];
          const img = await loadImage(src);
          if (!alive) return;
          if (img) {
            images.set(src, img);
            imageAspects.set(src, img.naturalWidth / img.naturalHeight);
          }
          loaded = true;
          builtFor = "";
        }
      };
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
      window.clearTimeout(fallbackTimer);
      if (alive) {
        loaded = true;
        builtFor = "";
      }
    };

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        if (inView) startLoad();
      },
      { threshold: 0.01 },
    );
    io.observe(root);

    /* ---- draw loop ---- */
    let last = performance.now();
    let lastDraw = 0;
    let raf = 0;
    let spotX = -9999;
    let spotY = -9999;
    let spotA = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const c = live.current.p;
      if (!inView || w < 2 || h < 2 || !loaded) return;
      if (now - lastDraw < 1000 / clamp(c.maxFps, 10, 144) - 2) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      lastDraw = now;

      if (builtFor === "" || !reels.length) buildLayout();
      if (!reels.length) return;
      const calm = reduce.matches;

      /* ---- motion ---- */
      const n = reels.length;
      const mid = (n - 1) / 2;
      const glide = inp.dragging || calm ? 0 : inp.vel;
      if (!inp.dragging) inp.vel *= Math.pow(clamp(c.inertia, 0, 0.999), dt * 60);
      if (calm) inp.vel = 0;
      const catchUp = 1 - Math.pow(1 - clamp(c.damping, 0.01, 1), dt * 60);
      const push = inp.pushX;
      inp.pushX = 0;

      for (const reel of reels) {
        const move = (push + glide * dt) * c.speed * reel.factor * reel.sign;
        reel.target += move;
        if (!c.paused && !calm) {
          reel.target -= c.autoScroll * c.speed * reel.factor * reel.sign * dt;
        }
        reel.disp += (reel.target - reel.disp) * catchUp;
      }

      /* ---- spotlight ---- */
      if (spotA < 0.02 && inp.inside) {
        spotX = inp.px; // snap on entry so the light doesn't sweep in from afar
        spotY = inp.py;
      }
      spotX += (inp.px - spotX) * Math.min(1, dt * 14);
      spotY += (inp.py - spotY) * Math.min(1, dt * 14);
      spotA += ((inp.inside ? 1 : 0) - spotA) * Math.min(1, dt * 6);
      fadeIn = Math.min(1, fadeIn + dt / 0.9);

      /* ---- render ---- */
      ctx.setTransform(dprEff, 0, 0, dprEff, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const th = (c.tilt * Math.PI) / 180;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);
      const ext = Math.max(w, h) * 1.5;
      const halfW = w / 2;
      const fontFamily = '"DM Sans", system-ui, sans-serif';

      for (let r = 0; r < n; r++) {
        const reel = reels[r];
        const norm = mid === 0 ? 0 : Math.abs(r - mid) / mid;
        const sc = 1 - c.taper * norm;
        const rowAlpha = clamp(1 - c.dim * norm, 0, 1) * fadeIn;
        const yRow = (r - mid) * (c.rowHeight + c.rowGap);
        const Ls = reel.len * sc;
        const ph = c.rowHeight * sc;

        for (const plate of reel.plates) {
          const pw = plate.w * sc;
          const start = mod(plate.x * sc + reel.disp * sc + ext / 2, Ls) - ext / 2;

          for (let x = start; x < ext / 2 + pw; x += Ls) {
            const u = x / halfW;
            const y = yRow - c.arch * (1 - u * u);
            const phi = Math.atan((2 * c.arch * u) / halfW);

            // screen position of the plate centre (for culling + spotlight)
            const X = cx + x * cosT - y * sinT;
            const Y = cy + x * sinT + y * cosT;
            const reach = pw + ph;
            if (X < -reach || X > w + reach || Y < -reach || Y > h + reach) continue;

            const dist = Math.hypot(X - spotX, Y - spotY);
            let t = clamp(1 - dist / Math.max(1, c.focusRadius), 0, 1) * spotA;
            t = t * t * (3 - 2 * t);
            const lit = clamp(c.focusStrength, 0, 1) * t;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(th);
            ctx.translate(x, y);
            ctx.rotate(phi);
            roundRectPath(ctx, -pw / 2, -ph / 2, pw, ph, c.radius * sc);
            ctx.clip();
            ctx.translate(-pw / 2, -ph / 2);

            const sp = plate.sprite;
            if (sp) {
              ctx.globalAlpha = rowAlpha;
              ctx.drawImage(sp.color, 0, 0, pw, ph);
              const g = clamp(c.grayscale, 0, 1) * (1 - lit);
              if (g > 0.01) {
                ctx.globalAlpha = rowAlpha * g;
                ctx.drawImage(sp.gray, 0, 0, pw, ph);
              }
              // overall light: plates rest a little dimmer, the spotlight restores it
              const L = c.brightness * (1 - 0.28 * (1 - lit));
              if (L < 0.995) {
                ctx.globalAlpha = rowAlpha * (1 - L);
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, pw, ph);
              } else if (L > 1.005) {
                ctx.globalAlpha = rowAlpha * clamp((L - 1) * 0.5, 0, 0.6);
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, pw, ph);
              }
            } else {
              // open space for work that hasn't been added yet
              ctx.globalAlpha = rowAlpha;
              ctx.fillStyle = "rgba(255,244,248,0.05)";
              ctx.fillRect(0, 0, pw, ph);
              ctx.strokeStyle = "rgba(243,187,210,0.3)";
              ctx.lineWidth = 1;
              ctx.strokeRect(0.5, 0.5, pw - 1, ph - 1);
              ctx.fillStyle = "rgba(243,187,210,0.65)";
              ctx.font = `500 ${Math.max(7, Math.round(ph * 0.075))}px ${fontFamily}`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(" ", pw / 2, ph / 2);
            }
            ctx.restore();
          }
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
    // Rebuild the effect only when the set of images/reels changes.
  }, [plan.key]);

  /* ---- pointer / wheel / keys ---- */
  const local = (e: React.PointerEvent | React.WheelEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const axis = () => {
    const th = (live.current.p.tilt * Math.PI) / 180;
    return { c: Math.cos(th), s: Math.sin(th) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!p.interactive || e.button > 0) return;
    const pt = local(e);
    const inp = input.current;
    inp.dragging = true;
    inp.vel = 0;
    inp.lastX = pt.x;
    inp.lastY = pt.y;
    inp.lastT = performance.now();
    rootRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const inp = input.current;
    const pt = local(e);
    if (e.pointerType !== "touch" || inp.dragging) {
      inp.px = pt.x;
      inp.py = pt.y;
      inp.inside = true;
    }
    if (!inp.dragging || !p.interactive) return;
    const a = axis();
    const dx = pt.x - inp.lastX;
    const dy = pt.y - inp.lastY;
    const along = (dx * a.c + dy * a.s) * live.current.p.dragSensitivity;
    const now = performance.now();
    const dtS = Math.max(0.004, (now - inp.lastT) / 1000);
    inp.pushX += along;
    inp.vel = inp.vel * 0.6 + (along / dtS) * 0.4;
    inp.lastX = pt.x;
    inp.lastY = pt.y;
    inp.lastT = now;
  };

  const endDrag = (e: React.PointerEvent) => {
    const inp = input.current;
    if (!inp.dragging) return;
    inp.dragging = false;
    if (performance.now() - inp.lastT > 90) inp.vel = 0;
    inp.vel = clamp(inp.vel, -4000, 4000);
    if (rootRef.current?.hasPointerCapture(e.pointerId)) {
      rootRef.current.releasePointerCapture(e.pointerId);
    }
    if (e.pointerType === "touch") input.current.inside = false;
  };

  // The wheel nudges the reels; the page still scrolls normally.
  const onWheel = (e: React.WheelEvent) => {
    if (!p.interactive) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? d * 16 : d;
    input.current.pushX -= px * live.current.p.wheelSensitivity * 0.8;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!p.interactive) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      input.current.pushX -= 240;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      input.current.pushX += 240;
    }
  };

  /* ---- sizing ---- */
  const autoHeight = Math.round(
    rowCount * (p.rowHeight + p.rowGap) + 110 + Math.abs(p.tilt) * 10 + p.arch * 0.6,
  );
  const fadePct = clamp(p.fade, 0, 0.5) * 100;
  const mask =
    fadePct > 0
      ? `linear-gradient(90deg, transparent 0, #000 ${fadePct}%, #000 ${100 - fadePct}%, transparent 100%)`
      : undefined;
  const hasBg = !!p.backgroundColor && p.backgroundColor !== "transparent";

  const rootStyle: CSSProperties = {
    height: autoHeight,
    ...(hasBg ? { background: p.backgroundColor } : null),
    ...props.style,
  };

  return (
    <div
      ref={rootRef}
      className={`reel-gallery${p.interactive ? " is-interactive" : ""}${
        props.className ? ` ${props.className}` : ""
      }`}
      style={rootStyle}
      role="group"
      aria-roledescription="carousel"
      aria-label={p.ariaLabel}
      tabIndex={p.interactive ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        if (!input.current.dragging) input.current.inside = false;
      }}
      onPointerEnter={() => {
        input.current.inside = true;
      }}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <canvas
        ref={canvasRef}
        className="reel-gallery__canvas"
        aria-hidden="true"
        style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
      />
      {props.children && <div className="reel-gallery__content">{props.children}</div>}
    </div>
  );
}

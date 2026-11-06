import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import "./GradientCarousel.css";

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

export type GradientCarouselProps = {
  /** Image URLs. Dominant colours of each one tint the background glow. */
  images?: string[];
  className?: string;
  /** Rotation of cards away from the centre (degrees). */
  maxRotationDegrees?: number;
  /** How far cards sink back on the Z axis (px). */
  maxDepthPx?: number;
  /** Scale of cards away from the centre (0–1). */
  minScale?: number;
  /** Gap between neighbouring cards (px). */
  cardGap?: number;
  /** Velocity decay (0.5–0.99). Lower = more friction. */
  frictionFactor?: number;
  /** Wheel multiplier (0.1–2). */
  wheelSensitivity?: number;
  /** Drag multiplier (0.5–2). */
  dragSensitivity?: number;
  /** Blur of the background glow (px). */
  backgroundBlur?: number;
  /** Radius of the glow circles (0–1). */
  gradientSize?: number;
  /** Strength of the glow (0–1). */
  gradientIntensity?: number;
  enableKeyboard?: boolean;
  onCardChange?: (index: number) => void;
  /** Card width / height. */
  cardAspectRatio?: number;
  initialIndex?: number;
  /** Wrap around: after the last card comes the first. */
  loop?: boolean;
  /** Slow self-scroll in cards per second (negative reverses, 0 turns it off). */
  autoScroll?: number;
  /** Hold still while the pointer is over the carousel. */
  pauseOnHover?: boolean;
  ariaLabel?: string;
};

const DEFAULTS = {
  maxRotationDegrees: 28,
  maxDepthPx: 140,
  minScale: 0.92,
  cardGap: 28,
  frictionFactor: 0.9,
  wheelSensitivity: 0.6,
  dragSensitivity: 1,
  backgroundBlur: 24,
  gradientSize: 0.65,
  gradientIntensity: 0.7,
  enableKeyboard: true,
  cardAspectRatio: 0.8,
  initialIndex: 0,
  loop: true,
  autoScroll: 0.15,
  pauseOnHover: false,
  ariaLabel:
    "Artwork carousel. Drag, scroll, or use the left and right arrow keys to browse.",
};

const PLACEHOLDER_COUNT = 12;
const RENDER_RANGE = 4; // cards drawn each side of the centre
const GLOW_RANGE = 2; // glow layers kept each side of the centre

/* -------------------------------------------------------------------------- */
/*  Colour helpers                                                             */
/* -------------------------------------------------------------------------- */

type RGB = [number, number, number];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mod = (n: number, m: number) => ((n % m) + m) % m;
/** Shortest signed distance on a ring of `n` cards. */
const wrapDelta = (d: number, n: number) => mod(d + n / 2, n) - n / 2;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** A pleasant palette for cards without a usable image. */
function fallbackPalette(i: number): RGB[] {
  const h = (i * 0.137 + 0.82) % 1;
  return [
    hslToRgb(h, 0.65, 0.55),
    hslToRgb((h + 0.08) % 1, 0.6, 0.5),
    hslToRgb((h + 0.55) % 1, 0.55, 0.5),
  ];
}

/** Pick up to three vivid, distinct colours from an image. */
function extractPalette(img: HTMLImageElement): RGB[] | null {
  try {
    const S = 28;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, S, S);
    const px = ctx.getImageData(0, 0, S, S).data;

    const buckets = new Map<number, { r: number; g: number; b: number; w: number }>();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      let w = l < 0.1 || l > 0.94 ? 0.05 : 0.15 + s * s * 1.6;
      if (s < 0.12) w *= 0.3;
      const key = (Math.floor(h * 12) % 12) * 3 + (l < 0.35 ? 0 : l < 0.65 ? 1 : 2);
      const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0 };
      b.r += px[i] * w;
      b.g += px[i + 1] * w;
      b.b += px[i + 2] * w;
      b.w += w;
      buckets.set(key, b);
    }
    const sorted = [...buckets.entries()].sort((a, b) => b[1].w - a[1].w);
    if (sorted.length === 0) return null;

    const picked: { key: number; rgb: RGB }[] = [];
    const avg = (b: { r: number; g: number; b: number; w: number }): RGB => [
      Math.round(b.r / b.w),
      Math.round(b.g / b.w),
      Math.round(b.b / b.w),
    ];
    const hueDist = (a: number, b: number) => {
      const d = Math.abs(Math.floor(a / 3) - Math.floor(b / 3));
      return Math.min(d, 12 - d);
    };
    for (const [key, b] of sorted) {
      if (picked.length >= 3) break;
      if (picked.some((p) => hueDist(p.key, key) <= 1)) continue;
      picked.push({ key, rgb: avg(b) });
    }
    for (const [key, b] of sorted) {
      if (picked.length >= 3) break;
      if (!picked.some((p) => p.key === key)) picked.push({ key, rgb: avg(b) });
    }
    while (picked.length < 3) picked.push(picked[picked.length - 1]);

    // Make them glow: a little more saturated, kept in a mid lightness range.
    return picked.map(({ rgb }) => {
      const [h, s, l] = rgbToHsl(...rgb);
      return hslToRgb(h, clamp(s * 1.15 + 0.05, 0, 1), clamp(l, 0.32, 0.68));
    });
  } catch {
    return null; // cross-origin image without CORS
  }
}

const paletteCache = new Map<string, RGB[]>();
const loading = new Map<string, Promise<RGB[] | null>>();

function getPalette(src: string): Promise<RGB[] | null> {
  const cached = paletteCache.get(src);
  if (cached) return Promise.resolve(cached);
  let p = loading.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        const pal = extractPalette(img);
        if (pal) paletteCache.set(src, pal);
        resolve(pal);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    loading.set(src, p);
  }
  return p;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function GradientCarousel(props: GradientCarouselProps) {
  const defined = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined),
  ) as GradientCarouselProps;
  const p = { ...DEFAULTS, ...defined };

  const images = props.images ?? [];
  const count = images.length > 0 ? images.length : PLACEHOLDER_COUNT;
  const startIndex = clamp(Math.round(p.initialIndex), 0, count - 1);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<number, HTMLDivElement>());
  const glowRefs = useRef(new Map<number, HTMLDivElement>());

  const [center, setCenter] = useState(startIndex);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [palVersion, setPalVersion] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());

  const live = useRef({ p, count, images });
  live.current = { p, count, images };
  const onChange = useRef(props.onCardChange);
  onChange.current = props.onCardChange;

  const sim = useRef({
    pos: startIndex,
    vel: 0,
    target: null as number | null,
    dragging: false,
    moved: 0,
    lastX: 0,
    lastT: 0,
    downX: 0,
    center: startIndex,
    inView: true,
    hovered: false,
    lastInteract: -1e9, // when the person last touched it (ms)
    drift: 0, // 0–1 ease-in of the self-scroll
    dir: 1,
  });

  /* ---- card geometry ---- */
  const cardH = Math.round(Math.min(size.h * 0.74, (size.w * 0.78) / p.cardAspectRatio));
  const cardW = Math.round(cardH * p.cardAspectRatio);
  const step = cardW + p.cardGap;
  const geo = useRef({ cardW, cardH, step });
  geo.current = { cardW, cardH, step };

  /* ---- apply the 3D transforms (no React re-render per frame) ---- */
  const applyFrame = useCallback(() => {
    const s = sim.current;
    const { p: c } = live.current;
    const { step: st } = geo.current;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rot = calm ? 0 : c.maxRotationDegrees;
    const depth = calm ? c.maxDepthPx * 0.3 : c.maxDepthPx;

    const n = live.current.count;
    const ring = c.loop && n > 1;
    const delta = (i: number) => (ring ? wrapDelta(i - s.pos, n) : i - s.pos);

    cardRefs.current.forEach((el, i) => {
      const d = delta(i);
      const ad = Math.abs(d);
      const a = clamp(d, -1, 1);
      const t = Math.min(ad, 1);
      const eased = t * t * (3 - 2 * t);
      const x = d * st * (1 - 0.0 * t);
      const z = -depth * eased;
      const sc = 1 - (1 - c.minScale) * eased;
      el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(
        1,
      )}px) rotateY(${(-a * rot * (0.4 + 0.6 * eased)).toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      el.style.opacity = String(clamp(1 - 0.28 * t - Math.max(0, ad - 2) * 0.5, 0, 1));
      el.style.zIndex = String(100 - Math.round(ad * 10));
      el.style.pointerEvents = ad > 2.6 ? "none" : "auto";
    });

    glowRefs.current.forEach((el, i) => {
      el.style.opacity = String(clamp(1 - Math.abs(delta(i)), 0, 1) * c.gradientIntensity);
    });
  }, []);

  useLayoutEffect(() => {
    applyFrame();
  }, [applyFrame, center, size, p.maxRotationDegrees, p.maxDepthPx, p.minScale, p.cardGap, palVersion]);

  /* ---- measure ---- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- keep palettes for the cards near the centre ---- */
  useEffect(() => {
    let alive = true;
    for (let k = center - GLOW_RANGE - 1; k <= center + GLOW_RANGE + 1; k++) {
      const i = p.loop ? mod(k, count) : k;
      const src = images[i];
      if (!src || paletteCache.has(src)) continue;
      getPalette(src).then(() => {
        if (alive) setPalVersion((v) => v + 1);
      });
    }
    return () => {
      alive = false;
    };
  }, [center, images, count, p.loop]);

  /* ---- navigation ---- */
  /** Glide to a card, taking the shortest way round when looping. */
  const goTo = useCallback((index: number) => {
    const s = sim.current;
    const { p: c, count: n } = live.current;
    s.lastInteract = performance.now();
    const base = Math.round(s.target ?? s.pos);
    if (c.loop && n > 1) s.target = base + wrapDelta(Math.round(index) - base, n);
    else s.target = clamp(Math.round(index), 0, n - 1);
    s.vel = 0;
  }, []);

  /** Move by a number of cards (keyboard). */
  const stepBy = useCallback((delta: number) => {
    const s = sim.current;
    const { p: c, count: n } = live.current;
    s.lastInteract = performance.now();
    const base = Math.round(s.target ?? s.pos);
    s.target = c.loop ? base + delta : clamp(base + delta, 0, n - 1);
    s.vel = 0;
  }, []);

  /* ---- animation loop ---- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const s = sim.current;
    const io = new IntersectionObserver(([e]) => (s.inView = e.isIntersecting), {
      threshold: 0.01,
    });
    io.observe(root);

    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!s.inView) return;
      const { p: c, count: n } = live.current;
      const maxPos = n - 1;
      const friction = clamp(c.frictionFactor, 0.5, 0.99);
      let moving = false;

      if (s.target !== null) {
        const diff = s.target - s.pos;
        s.pos += diff * Math.min(1, dt * 7);
        if (Math.abs(diff) < 0.0008) {
          s.pos = s.target;
          s.target = null;
        }
        moving = true;
      } else if (!s.dragging) {
        if (Math.abs(s.vel) > 0.001) {
          s.pos += s.vel * dt;
          s.vel *= Math.pow(friction, dt * 60);
          moving = true;
        }
        // slow self-scroll once things have been left alone for a moment
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const drifting =
          c.autoScroll !== 0 &&
          !calm &&
          Math.abs(s.vel) < 0.08 &&
          now - s.lastInteract > 1500 &&
          !(c.pauseOnHover && s.hovered);
        s.drift += ((drifting ? 1 : 0) - s.drift) * Math.min(1, dt * 2);
        if (s.drift > 0.01) {
          if (!c.loop) {
            // bounce between the first and last card
            if (s.pos >= maxPos) s.dir = -1;
            else if (s.pos <= 0) s.dir = 1;
          }
          s.pos += c.autoScroll * s.dir * s.drift * dt;
          moving = true;
        }
        // settle on the nearest card once the glide slows down
        const calmness = s.drift > 0.01 || drifting ? 0 : clamp(1 - Math.abs(s.vel) / 0.6, 0, 1);
        const off = Math.round(s.pos) - s.pos;
        if (Math.abs(off) > 0.0005 && calmness > 0) {
          s.pos += off * calmness * Math.min(1, dt * 8);
          moving = true;
        }
        // soft stop at both ends (only when not looping)
        if (!c.loop) {
          if (s.pos < 0) {
            s.pos += (0 - s.pos) * Math.min(1, dt * 10);
            s.vel = 0;
            moving = true;
          } else if (s.pos > maxPos) {
            s.pos += (maxPos - s.pos) * Math.min(1, dt * 10);
            s.vel = 0;
            moving = true;
          }
        }
      } else {
        moving = true;
      }

      // keep the numbers small when looping (the picture doesn't change)
      if (c.loop && (s.pos < 0 || s.pos >= n)) {
        const shift = Math.floor(s.pos / n) * n;
        s.pos -= shift;
        if (s.target !== null) s.target -= shift;
      }

      if (moving) {
        applyFrame();
        const nearest = c.loop ? mod(Math.round(s.pos), n) : clamp(Math.round(s.pos), 0, maxPos);
        if (nearest !== s.center) {
          s.center = nearest;
          setCenter(nearest);
          onChange.current?.(nearest);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [applyFrame]);

  /* ---- wheel (native, so it can be non-passive) ---- */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      const s = sim.current;
      const { p: c, count: n } = live.current;
      let d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      if (d === 0) return;
      // at either end, let the page scroll on
      if (!c.loop && ((d < 0 && s.pos <= 0.02) || (d > 0 && s.pos >= n - 1.02))) return;
      e.preventDefault();
      s.target = null;
      s.lastInteract = performance.now();
      const friction = clamp(c.frictionFactor, 0.5, 0.99);
      const perCard = -60 * Math.log(friction); // velocity that glides ~1 card
      s.vel = clamp(s.vel + (d / 100) * c.wheelSensitivity * perCard, -14, 14);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  /* ---- drag / click ---- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button > 0) return;
    const s = sim.current;
    s.dragging = true;
    s.target = null;
    s.vel = 0;
    s.moved = 0;
    s.lastInteract = performance.now();
    s.lastX = e.clientX;
    s.downX = e.clientX;
    s.lastT = performance.now();
    stageRef.current?.setPointerCapture(e.pointerId);
    rootRef.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = sim.current;
    if (!s.dragging) return;
    const { p: c, count: n } = live.current;
    const dx = e.clientX - s.lastX;
    s.moved = Math.max(s.moved, Math.abs(e.clientX - s.downX));
    if (s.moved < 5) return;
    const now = performance.now();
    const dtS = Math.max(0.004, (now - s.lastT) / 1000);
    const outside = !c.loop && (s.pos < 0 || s.pos > n - 1);
    const dPos = (-dx / geo.current.step) * c.dragSensitivity * (outside ? 0.35 : 1);
    s.pos += dPos;
    s.vel = s.vel * 0.6 + (dPos / dtS) * 0.4;
    s.lastX = e.clientX;
    s.lastT = now;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false;
    if (stageRef.current?.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }
    if (s.moved < 5) {
      // a click: bring a side card to the centre
      const card = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
      if (card) goTo(Number(card.dataset.index));
      return;
    }
    s.lastInteract = performance.now();
    if (performance.now() - s.lastT > 90) s.vel = 0;
    s.vel = clamp(s.vel, -14, 14);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!p.enableKeyboard) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepBy(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(count - 1);
    }
  };

  /* ---- what to render ---- */
  const cardIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = center - RENDER_RANGE; i <= center + RENDER_RANGE; i++) {
      if (p.loop) {
        const w = mod(i, count);
        if (!out.includes(w)) out.push(w);
      } else if (i >= 0 && i < count) out.push(i);
    }
    return out;
  }, [center, count, p.loop]);

  const glowIndexes = useMemo(() => {
    const out: number[] = [];
    for (let i = center - GLOW_RANGE; i <= center + GLOW_RANGE; i++) {
      if (p.loop) {
        const w = mod(i, count);
        if (!out.includes(w)) out.push(w);
      } else if (i >= 0 && i < count) out.push(i);
    }
    return out;
  }, [center, count, p.loop]);

  const glowBackground = (i: number) => {
    const src = images[i];
    const pal = (src && paletteCache.get(src)) || fallbackPalette(i);
    const a = clamp(p.gradientSize, 0.05, 1) * 72;
    const rgb = (c: RGB) => `${c[0]}, ${c[1]}, ${c[2]}`;
    return [
      `radial-gradient(circle at 24% 32%, rgba(${rgb(pal[0])}, 1) 0%, transparent ${a}%)`,
      `radial-gradient(circle at 76% 26%, rgba(${rgb(pal[1])}, 0.9) 0%, transparent ${a}%)`,
      `radial-gradient(circle at 52% 86%, rgba(${rgb(pal[2])}, 0.85) 0%, transparent ${a}%)`,
    ].join(", ");
  };

  const rootStyle: CSSProperties = {};

  return (
    <div
      ref={rootRef}
      className={`gc${props.className ? ` ${props.className}` : ""}`}
      style={rootStyle}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label={p.ariaLabel}
      onKeyDown={onKeyDown}
      onPointerEnter={() => {
        sim.current.hovered = true;
      }}
      onPointerLeave={() => {
        sim.current.hovered = false;
      }}
    >
      {/* colour glow taken from the artwork in focus */}
      <div className="gc__bg" aria-hidden="true">
        {glowIndexes.map((i) => (
          <div
            key={i}
            className="gc__glow"
            ref={(el) => {
              if (el) glowRefs.current.set(i, el);
              else glowRefs.current.delete(i);
            }}
            style={{
              background: glowBackground(i),
              filter: `blur(${Math.max(0, p.backgroundBlur)}px)`,
            }}
          />
        ))}
      </div>

      <div
        ref={stageRef}
        className="gc__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {cardIndexes.map((i) => {
          const src = images[i];
          const showImage = !!src && !failed.has(i);
          return (
            <div
              key={i}
              className="gc__card"
              data-index={i}
              ref={(el) => {
                if (el) cardRefs.current.set(i, el);
                else cardRefs.current.delete(i);
              }}
              style={{ width: cardW, height: cardH }}
              aria-hidden={i !== center}
            >
              {showImage && (
                <img
                  src={src}
                  alt="Artwork"
                  draggable={false}
                  decoding="async"
                  onError={() =>
                    setFailed((prev) => {
                      const next = new Set(prev);
                      next.add(i);
                      return next;
                    })
                  }
                />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

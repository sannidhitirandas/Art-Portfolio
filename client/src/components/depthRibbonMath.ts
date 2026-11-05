/**
 * Geometry for the Depth Ribbon: closed 3D paths, equal-spacing along them,
 * and a tiny look-at camera. No DOM here, so it is easy to test.
 */

export type Vec3 = [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const UP: Vec3 = [0, 1, 0];
export const TAU = Math.PI * 2;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const smooth = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export type PathKind = "loop" | "knot" | "wave";

function rawPath(kind: PathKind, t: number): Vec3 {
  const a = t * TAU;
  if (kind === "knot") {
    const x = Math.sin(a) + 2 * Math.sin(2 * a);
    const y = Math.cos(a) - 2 * Math.cos(2 * a);
    const z = -Math.sin(3 * a);
    return [x, z * 1.3, y];
  }
  if (kind === "wave") return [Math.cos(a), Math.sin(5 * a) * 0.2, Math.sin(a)];
  return [Math.cos(a), Math.sin(a) * 0.14, Math.sin(a) * Math.cos(a) * 1.15];
}

export type PathTable = {
  pts: Vec3[];
  cum: number[];
  length: number;
  extent: number;
};

const SAMPLES = 1600;
const TARGET_EXTENT = 10;

export function buildPath(kind: PathKind): PathTable {
  const raw: Vec3[] = [];
  for (let i = 0; i < SAMPLES; i++) raw.push(rawPath(kind, i / SAMPLES));
  const c = raw.reduce<Vec3>((s, p) => add(s, p), [0, 0, 0]);
  const centre = mul(c, 1 / raw.length);
  let maxR = 0;
  for (const p of raw) maxR = Math.max(maxR, len(sub(p, centre)));
  const k = TARGET_EXTENT / (maxR || 1);
  const pts = raw.map((p) => mul(sub(p, centre), k));
  const cum: number[] = [0];
  for (let i = 1; i <= SAMPLES; i++) {
    cum.push(cum[i - 1] + len(sub(pts[i % SAMPLES], pts[i - 1])));
  }
  return { pts, cum, length: cum[SAMPLES], extent: TARGET_EXTENT };
}

export function sample(table: PathTable, s: number): { p: Vec3; t: Vec3 } {
  const { pts, cum, length } = table;
  const n = pts.length;
  const x = mod(s, length);
  let lo = 0;
  let hi = n;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= x) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[(lo + 1) % n];
  const seg = cum[lo + 1] - cum[lo] || 1;
  const f = (x - cum[lo]) / seg;
  return { p: lerp3(a, b, f), t: norm(sub(b, a)) };
}

export type CardFrame = {
  p: Vec3;
  x: Vec3;
  a: Vec3;
  n: Vec3;
  side: Vec3;
  t: Vec3;
};

export const CARD_YAW = 0.95;

export function cardFrame(table: PathTable, s: number): CardFrame {
  const { p, t } = sample(table, s);
  let side = cross(t, UP);
  if (len(side) < 1e-4) side = [1, 0, 0];
  side = norm(side);
  const a = norm(cross(side, t));
  const c = Math.cos(CARD_YAW);
  const sn = Math.sin(CARD_YAW);
  const x = norm(add(mul(t, c), mul(side, sn)));
  const n = norm(sub(mul(side, c), mul(t, sn)));
  return { p, x, a, n, side, t };
}

export type Camera = {
  pos: Vec3;
  target: Vec3;
  r: Vec3;
  u: Vec3;
  f: Vec3;
};

export function basis(pos: Vec3, target: Vec3): Camera {
  const f = norm(sub(target, pos));
  let r = cross(f, UP);
  if (len(r) < 1e-4) r = [1, 0, 0];
  r = norm(r);
  const u = cross(r, f);
  return { pos, target, r, u, f };
}

export function project(
  cam: Camera,
  p: Vec3,
  focal: number,
  cx: number,
  cy: number,
): { x: number; y: number; z: number } | null {
  const v = sub(p, cam.pos);
  const z = dot(v, cam.f);
  if (z < 0.15) return null;
  const x = dot(v, cam.r);
  const y = dot(v, cam.u);
  return { x: cx + (x / z) * focal, y: cy - (y / z) * focal, z };
}

export function ridePose(
  table: PathTable,
  spacing: number,
  card: number,
  offset: number,
): { pos: Vec3; target: Vec3 } {
  const s = card * spacing;
  const { p, t } = sample(table, s);
  let side = cross(t, UP);
  if (len(side) < 1e-4) side = [1, 0, 0];
  side = norm(side);
  const pos = add(
    add(p, mul(side, offset * 2.0 * spacing)),
    add(mul(UP, offset * 1.4 * spacing), mul(t, -1.2 * spacing)),
  );
  const target = sample(table, s + 5 * spacing).p;
  return { pos, target };
}

export function overviewPose(
  extent: number,
  yaw: number,
  fovDeg: number,
  aspect: number,
): { pos: Vec3; target: Vec3 } {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanMin = Math.min(tanV, tanV * aspect);
  const dist = (extent * 0.9) / tanMin;
  const elev = 0.62;
  const pos: Vec3 = [
    Math.sin(yaw) * Math.cos(elev) * dist,
    Math.sin(elev) * dist,
    Math.cos(yaw) * Math.cos(elev) * dist,
  ];
  return { pos, target: [0, 0, 0] };
}

export function focusPose(
  frame: CardFrame,
  cardH: number,
  fovDeg: number,
): { pos: Vec3; target: Vec3 } {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const dist = cardH / 0.58 / (2 * tanV);
  return { pos: add(frame.p, mul(frame.n, dist)), target: frame.p };
}

export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function sequence(itemCount: number, cards: number, seed: number): number[] {
  if (itemCount <= 0) return Array.from({ length: cards }, () => -1);
  const out: number[] = [];
  let pass = 0;
  while (out.length < cards) {
    const rand = rng(seed * 7919 + pass * 104729 + 17);
    const order = Array.from({ length: itemCount }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (out.length && itemCount > 1 && order[0] === out[out.length - 1]) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    out.push(...order);
    pass++;
  }
  out.length = cards;
  if (cards > 2 && itemCount > 1 && out[0] === out[cards - 1]) {
    [out[cards - 1], out[cards - 2]] = [out[cards - 2], out[cards - 1]];
  }
  return out;
}

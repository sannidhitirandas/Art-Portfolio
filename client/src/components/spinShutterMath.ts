/**
 * Pure geometry for the Spin Shutter orbit (no DOM, easy to test).
 *
 * World: cards sit on a circle of radius 1 in the XZ plane. Angle 0 is the
 * front of the orbit (closest to the camera). The camera looks at the centre
 * from `distance` radii away, raised by `tilt` degrees.
 */

export const TAU = Math.PI * 2;

export const mod = (n: number, m: number) => ((n % m) + m) % m;
export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export type Layout = {
  count: number;
  cluster: number;
  spread: number;
  photos: number;
};

export function slotOffset(i: number, rot: number, l: Layout): number {
  const c = Math.max(1, Math.round(l.cluster));
  const groups = Math.ceil(l.count / c);
  const g = Math.floor(i / c);
  const k = i % c;
  const inGroup = Math.min(c, l.count - g * c);
  const groupAngle = (g * TAU) / groups;
  if (c === 1) return groupAngle;
  const fan = 0.65 + 0.35 * Math.abs(Math.sin(groupAngle + rot));
  const step = (TAU / l.count) * l.spread * fan;
  return groupAngle + (k - (inGroup - 1) / 2) * step;
}

export const needsSwap = (l: Layout) => l.photos > l.count;

export function artFor(i: number, angle: number, l: Layout): number {
  if (!needsSwap(l)) return mod(-i, l.photos);
  const lap = Math.floor((angle + Math.PI) / TAU);
  return mod(-i + l.count * lap, l.photos);
}

export function solveRot(photo: number, rot: number, l: Layout): number {
  const swap = needsSwap(l);
  const centerLap = Math.round(rot / TAU);
  const range = swap ? l.photos + 2 : 2;
  let best = rot;
  let bestDist = Infinity;

  for (let i = 0; i < l.count; i++) {
    for (let lap = centerLap - range; lap <= centerLap + range; lap++) {
      const shown = swap ? mod(-i + l.count * lap, l.photos) : mod(-i, l.photos);
      if (shown !== photo) continue;
      let r = TAU * lap - slotOffset(i, rot, l);
      for (let k = 0; k < 3; k++) r = TAU * lap - slotOffset(i, r, l);
      const d = Math.abs(r - rot);
      if (d < bestDist) {
        bestDist = d;
        best = r;
      }
    }
  }
  return best;
}

export type Camera = {
  tilt: number;
  distance: number;
  roll: number;
};

export function project(angle: number, cam: Camera) {
  const t = (cam.tilt * Math.PI) / 180;
  const x = Math.sin(angle);
  const z = Math.cos(angle);
  const depth = cam.distance - z * Math.cos(t);
  const px = x / depth;
  const py = (z * Math.sin(t)) / depth;
  const r = (cam.roll * Math.PI) / 180;
  return {
    x: px * Math.cos(r) - py * Math.sin(r),
    y: px * Math.sin(r) + py * Math.cos(r),
    depth,
    k: 1 / depth,
  };
}

export type Fit = { S: number; ox: number; oy: number; focus: number };

export function computeFit(
  w: number,
  h: number,
  cam: Camera,
  size: number,
  aspect: number,
  scale: number,
): Fit {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const steps = 120;
  for (let a = 0; a < steps; a++) {
    const q = project((a * TAU) / steps, cam);
    const hw = (size * aspect * q.k) / 2;
    const hh = (size * q.k) / 2;
    minX = Math.min(minX, q.x - hw);
    maxX = Math.max(maxX, q.x + hw);
    minY = Math.min(minY, q.y - hh);
    maxY = Math.max(maxY, q.y + hh);
  }
  const pad = 0.9;
  const S =
    Math.min((w * pad) / (maxX - minX), (h * pad) / (maxY - minY)) *
    Math.max(0.1, scale);
  return {
    S,
    ox: (-(minX + maxX) / 2) * S,
    oy: (-(minY + maxY) / 2) * S,
    focus: cam.distance - Math.cos((cam.tilt * Math.PI) / 180),
  };
}

#!/usr/bin/env python3
"""
Extract a 64-frame circular head-rotation ring (+ a neutral centre frame)
from a character video, for the canvas cursor-tracking hero.

    python3 scripts/extract_frames.py                      # public/character.mp4 -> public/frames/
    python3 scripts/extract_frames.py --input other.mp4
    python3 scripts/extract_frames.py --cover-watermark    # remove a small bottom-right "Veo" mark

How it works
  1. Inspect the video (fps, frame count, size, duration).
  2. Measure head movement per frame: dense optical flow between consecutive
     frames, median over the inner face box, integrated into a displacement
     path. The displacement direction is where the head is looking
     (screen coordinates, y down, same convention as atan2(dy, dx) in the page).
  3. For each of 64 compass angles (5.625 deg apart) pick the most extreme
     video frame whose head direction matches. Report any direction the video
     does not actually cover (nothing is invented or blended).
  4. Pick the neutral "looking at the camera" frame -> center.webp.
  5. Sample the flat background colour and write frames/meta.json.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

RING = 64
STEP = 360.0 / RING
ANALYSIS_W = 480
DIRS = {
    "right": 0, "lower-right": 45, "down": 90, "lower-left": 135,
    "left": 180, "upper-left": 225, "up": 270, "upper-right": 315,
}


def ang_diff(a: float, b: float) -> float:
    return abs((a - b + 180.0) % 360.0 - 180.0)


def pair(s: str) -> tuple[float, ...]:
    return tuple(float(v) for v in s.split(","))


def detect_face(gray: np.ndarray):
    """Normalised (x, y, w, h) of the largest frontal face, or None."""
    try:
        path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        if not path.exists():  # some OpenCV builds ship without the cascade files
            return None
        cascade = cv2.CascadeClassifier(str(path))
        if cascade.empty():
            return None
        h, w = gray.shape
        faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(w // 10, w // 10))
        if len(faces) == 0:
            return None
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        return x / w, y / h, fw / w, fh / h
    except Exception:
        return None


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    # works in this standalone project (public/) and when dropped into a client/ + server/ project
    pub = root / "client" / "public" if (root / "client" / "public").exists() else root / "public"
    ap.add_argument("--input", default=str(pub / "character.mp4"))
    ap.add_argument("--out", default=str(pub / "frames"))
    ap.add_argument("--face-center", type=pair, help="override face centre as normalised x,y (e.g. 0.5,0.42)")
    ap.add_argument("--face-box", type=pair, help="override face box as normalised x,y,w,h")
    ap.add_argument("--max-width", type=int, default=1280, help="downscale output frames wider than this")
    ap.add_argument("--quality", type=int, default=86, help="WebP quality 1-100")
    ap.add_argument("--no-loop-correct", action="store_true",
                    help="do not assume the clip ends back at the neutral pose")
    ap.add_argument("--cover-watermark", action="store_true",
                    help="paint out a small corner watermark (e.g. Veo, bottom-right) with the surrounding background")
    ap.add_argument("--demo", action="store_true", help="mark meta.json as placeholder demo motion")
    args = ap.parse_args()

    src = Path(args.input)
    if not src.exists():
        print(f"error: {src} not found. Put your Google Flow video at public/character.mp4 "
              f"(or run `npm run demo` for placeholder motion).", file=sys.stderr)
        return 1

    # ---- 1. inspect + analysis pass ---------------------------------------
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        print(f"error: OpenCV could not open {src}", file=sys.stderr)
        return 1
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    grays: list[np.ndarray] = []
    full_w = full_h = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        full_h, full_w = frame.shape[:2]
        g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        s = ANALYSIS_W / g.shape[1]
        grays.append(cv2.resize(g, (ANALYSIS_W, int(round(g.shape[0] * s))), interpolation=cv2.INTER_AREA))
    cap.release()
    n = len(grays)
    if n < 16:
        print(f"error: only {n} frames decoded - need a longer clip.", file=sys.stderr)
        return 1
    print(f"video   : {src.name}  {full_w}x{full_h}  {fps:.2f} fps  {n} frames  {n / fps:.2f}s")

    # ---- 2. head movement path -------------------------------------------
    ah, aw = grays[0].shape
    if args.face_box:
        fx, fy, fw, fh = args.face_box
        source = "--face-box"
    else:
        det = detect_face(grays[0])
        if det:
            fx, fy, fw, fh = det
            source = "Haar face detector"
        else:
            fx, fy, fw, fh = 0.37, 0.2, 0.26, 0.5
            source = "default box (not auto-detected; pass --face-box / --face-center if the centre looks off)"
    face_cx, face_cy = (fx + fw / 2, fy + fh / 2)
    if args.face_center:
        face_cx, face_cy = args.face_center
        source += " + --face-center"
    # inner box: eyes / nose / mouth, not hair or neck
    ix0, ix1 = int((fx + fw * 0.15) * aw), int((fx + fw * 0.85) * aw)
    iy0, iy1 = int((fy + fh * 0.15) * ah), int((fy + fh * 0.85) * ah)
    print(f"face    : centre ({face_cx:.3f}, {face_cy:.3f})  via {source}")

    disp = np.zeros((n, 2), dtype=np.float64)
    for i in range(1, n):
        flow = cv2.calcOpticalFlowFarneback(grays[i - 1], grays[i], None, 0.5, 4, 25, 4, 7, 1.5, 0)
        patch = flow[iy0:iy1, ix0:ix1]
        disp[i] = disp[i - 1] + (np.median(patch[..., 0]), np.median(patch[..., 1]))
    disp /= aw  # fraction of frame width, resolution independent

    if not args.no_loop_correct:
        residual = disp[-1].copy()
        disp -= np.outer(np.linspace(0, 1, n), residual)  # remove integration drift
        print(f"drift   : removed {np.hypot(*residual) * 100:.2f}% of frame width (clip assumed to end neutral)")

    mags = np.hypot(disp[:, 0], disp[:, 1])
    angles = (np.degrees(np.arctan2(disp[:, 1], disp[:, 0])) + 360.0) % 360.0
    peak = float(np.percentile(mags, 97))
    if peak < 0.004:
        print("error: no meaningful head movement detected in the video.", file=sys.stderr)
        return 1

    # ---- 3. choose the 64-frame ring --------------------------------------
    usable = mags >= 0.2 * peak
    ring: list[dict] = []
    for k in range(RING):
        target = k * STEP
        cand = [i for i in range(n) if usable[i] and ang_diff(angles[i], target) <= 12.0]
        if cand:
            pick = max(cand, key=lambda i: mags[i])
        else:
            pick = min((i for i in range(n) if usable[i]), key=lambda i: ang_diff(angles[i], target))
        ring.append({"index": k, "srcFrame": int(pick), "targetAngle": round(target, 2),
                     "measuredAngle": round(float(angles[pick]), 2),
                     "error": round(ang_diff(angles[pick], target), 2),
                     "magnitude": round(float(mags[pick] / peak), 3)})

    # ---- 4. neutral centre frame ------------------------------------------
    tail = range(int(n * 0.8), n)
    center = min(tail, key=lambda i: mags[i])
    if mags[center] > 0.15 * peak:
        center = int(np.argmin(mags))

    # ---- write frames ------------------------------------------------------
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    wanted = {r["srcFrame"] for r in ring} | {center}
    scale = min(1.0, args.max_width / full_w)
    out_w, out_h = int(round(full_w * scale)), int(round(full_h * scale))
    cap = cv2.VideoCapture(str(src))
    cache: dict[int, np.ndarray] = {}
    for i in range(n):
        ok, frame = cap.read()
        if not ok:
            break
        if i in wanted:
            cache[i] = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_AREA) if scale < 1 else frame
    cap.release()
    if args.cover_watermark:
        for i, im in cache.items():
            h, w = im.shape[:2]
            mask = np.zeros((h, w), np.uint8)
            mask[int(h * 0.88):, int(w * 0.90):] = 255
            cache[i] = cv2.inpaint(im, mask, 5, cv2.INPAINT_TELEA)

    def save(img: np.ndarray, name: str) -> None:
        cv2.imwrite(str(out / name), img, [cv2.IMWRITE_WEBP_QUALITY, args.quality])

    for r in ring:
        save(cache[r["srcFrame"]], f"frame_{r['index']:03d}.webp")
    save(cache[center], "center.webp")

    # ---- 5. background colour ---------------------------------------------
    img = cache[center]
    # sample above the shoulders: top corners + left/right edges at 30% height
    p = max(8, out_w // 60)
    my = int(out_h * 0.30)
    corners = np.concatenate([c.reshape(-1, 3) for c in (
        img[:p, :p], img[:p, -p:], img[my:my + p, :p], img[my:my + p, -p:])])
    b, g, r_ = (int(round(v)) for v in np.median(corners, axis=0))
    bg = f"#{r_:02x}{g:02x}{b:02x}"
    spread = float(np.max(np.std(corners, axis=0)))

    gaps = [r for r in ring if r["error"] > 12.0]
    meta = {
        "version": 1, "demo": bool(args.demo),
        "width": out_w, "height": out_h, "count": RING, "angleStep": STEP,
        "face": {"x": round(face_cx, 4), "y": round(face_cy, 4)},
        "bg": bg, "centerSrcFrame": int(center),
        "source": {"file": src.name, "fps": fps, "frames": n, "duration": round(n / fps, 3)},
        "gapCount": len(gaps), "frames": ring,
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))

    # ---- report ------------------------------------------------------------
    print(f"output  : {RING} ring frames + center.webp  {out_w}x{out_h}  -> {out}")
    print(f"centre  : source frame {center}")
    print(f"bg      : {bg}  (corner spread {spread:.1f}{'  - NOT flat, seams may show' if spread > 12 else ''})")
    print("coverage (best-matching frame per compass direction):")
    for name, a in DIRS.items():
        r = ring[int(round(a / STEP)) % RING]
        flag = "ok " if r["error"] <= 12 else "GAP"
        print(f"   {flag} {name:<12} target {a:>3}  measured {r['measuredAngle']:>6.1f}  "
              f"amplitude {r['magnitude'] * 100:>3.0f}%")
    if gaps:
        print(f"warning : {len(gaps)}/{RING} ring angles are not covered by the video; the nearest recorded "
              f"pose is used there. Re-generate the video with a clearer pass through those directions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

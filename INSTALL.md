# Cursor-tracking portrait for sunnyart-fixed

Folders in this zip mirror your project. Copy them over it (say yes to overwrite Home.tsx).

| File | What it is |
|---|---|
| `client/src/components/CursorFace.tsx` + `.css` | the canvas renderer (one frame at a time, no ghosting, no CSS 3D) |
| `client/src/components/CustomCursor.tsx` | glowing dot + trailing ring (only active once frames exist) |
| `client/src/components/PortraitHero.tsx` | uses the new portrait, or your old `InteractivePortrait` if no frames exist |
| `client/src/pages/Home.tsx` | only 2 lines changed: import + `<PortraitHero />` instead of `<InteractivePortrait />` |
| `scripts/extract_frames.py` | video -> 64 head-direction frames + centre frame |

Nothing else is touched. Until `client/public/frames/` exists, your site looks exactly as before.

## 1. Preview it (optional, 1 minute)
Copy `preview-frames/frames` to `client/public/frames`, then `npm run dev:static`.
You get placeholder motion made from a still photo, so you can see the tracking work.
Delete `client/public/frames` to go back to your old portrait.

## 2. Use your real video
1. Put the Google Flow video at `client/public/character.mp4`
2. `pip install opencv-python numpy` (once)
3. `python scripts/extract_frames.py --cover-watermark`

`--cover-watermark` paints out the small "Veo" mark in the bottom-right corner.
The script prints a coverage report; any `GAP` line is a direction the video never looked in.
If the face centre is off, add `--face-center 0.5,0.42`.

Delete `client/public/character.mp4` before deploying if you don't want to ship it (the site only uses `frames/`).

## Undo
Delete `client/public/frames`, or restore Home.tsx's `<InteractivePortrait />` line.

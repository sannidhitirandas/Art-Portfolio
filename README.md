# Sunny’s Interactive Art Portfolio

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

## Run locally

Install dependencies with `npm install` (or `pnpm install`). On Windows, start the static React/Vite site with `npm run dev:static` and open `http://localhost:3000`. The `dev` and `start` scripts set `NODE_ENV` through a small Node helper so they work in Windows PowerShell as well as macOS/Linux.

Validate types with `npm run check`, run the pose-mapping tests with `npx vitest run client/src/components/InteractivePortrait.test.ts`, and create the deployable static build with `npm run build:static`.

## Personalize the portfolio

Edit the hero copy, starter biography, placeholder email, and artwork entries in `client/src/data/portfolio.ts`. The gallery cards are intentionally empty and are not represented as Sunny’s finished work. To add real artwork later, upload the file to project storage and set its stable `/manus-storage/<key>` address, title, and accurate alt text on an `artwork` entry. This static portfolio has no public upload form or admin account. Replace `hello@yourstudio.com` before sharing the contact link.

## Portrait source and pose coverage

The supplied source is an 8-second, 1280×720 H.264 clip at 24 fps. All 192 authentic video frames are available as twelve 960×540 sprite atlases in project storage; the canvas eases through those real in-between frames as it follows the cursor, rather than snapping between stills or crossfading faces. The original video and seven representative stills are also stored as durable project assets and referenced in `client/src/components/InteractivePortrait.tsx`. The clip includes a forward-facing pose, an upward/right eye glance, rightward turns, a downward glance, and leftward/downward turns, but not nine distinct compass poses. Missing directions still use the nearest available part of the recorded movement. No blended or generated face frames are used.

OpenCV (`cv2`) was not installed in the available environment, so `ffprobe` and FFmpeg were used for metadata inspection and offline extraction. For fuller directional tracking, provide additional real frames or a new consistently framed portrait video with clear front, up, upper-right, right, lower-right, down, lower-left, left, and upper-left views.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

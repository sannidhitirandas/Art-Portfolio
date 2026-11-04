# TODO — Sunny’s Interactive Art Portfolio

## 1. Source-video portrait and cursor tracking — complete

- [x] The video character must be the main visual and use the supplied video as its source. Do not replace it with a generated face or another character.
- [x] First inspect the video’s duration, frame rate, dimensions and available directional poses. Extract usable frames and identify available center, up, upper-right, right, lower-right, down, lower-left, left and upper-left poses; do not invent missing directions.
- [x] Preserve original aspect ratio; do not stretch the video or crop the face or hair. Blend naturally into the dark-purple site where possible; if the video background is not transparent, do not pretend it is.
- [x] Render preloaded source frames on an HTML canvas. Track the pointer relative to the face center across the whole browser window, including all four corners and edges; map direction to the closest available frame and use the center-facing frame near the face center.
- [x] Smooth changes to avoid flicker and sudden jumps. Do not merely play the video continuously and claim cursor tracking; do not seek repeatedly with `video.currentTime` in the pointer handler; do not fake head rotation with CSS 3D transforms; do not blend overlapping faces into ghosted/doubled features.
- [x] The character remains visually stable; the surrounding website never rotates, tilts or moves with the cursor. If a direction is absent, use the nearest available source frame and explain the limitation. If the video lacks enough variation, implement the best working version and explain additional assets needed.

## 2. Responsive visual design and hero content — complete

- [x] The first screen fills the browser viewport and adapts to desktop, tablet and mobile. The face remains clear and large, centrally or slightly toward the right.
- [x] Use the premium, artistic, immersive, personal, elegant, slightly dreamy, creative and modern digital-art-exhibition direction. Use deep plum `#21152B`, dark purple `#30213A`, blush pink `#F3BBD2`, soft lavender `#DAB6F4` and warm off-white `#FFF4F8`.
- [x] Use elegant typography, generous negative space, subtle transitions and refined details. Avoid generic corporate templates, excessive gradients, clutter and distracting animations.
- [x] Place a compact, elegant introduction in the upper-left with enough edge padding; it must never cover the face. Use blush pink and lavender accents with warm off-white body text and a subtle load fade-in.
- [x] Display the exact text: “HELLO, I’M”; “Sunny.”; “Artist • Dreamer • Creator”; “I turn little thoughts and feelings into art, one sketch at a time.” Optional: “A little corner of my imagination.”
- [x] Add an elegant blush-pink “EXPLORE MY ART ↗” button beneath the introduction. It smoothly scrolls to the gallery and uses a subtle, not exaggerated, hover effect.

## 3. Navigation and portfolio sections — complete

- [x] Add minimal navigation near the top with SUNNY, MY ART, ABOUT and CONTACT. Keep it unobtrusive and readable against the dark background; smooth-scroll to sections where appropriate; ensure it does not overlap the introduction or character.
- [x] Create a responsive My Art gallery for later sketches, illustrations, paintings and digital artwork. Use neutral placeholders only where necessary; never present invented artwork as the owner’s.
- [x] Create a short, editable About biography section and a simple Contact section with an email placeholder the owner can replace. Keep every section consistent with the purple-and-pink theme.
- [x] Support the approved “Portfolio Asset Storage” power-up as future-ready artwork storage without representing placeholders as real work.

## 4. Accessibility, responsiveness and resilience — complete

- [x] Support desktop mouse tracking and provide a sensible static or touch-friendly mobile fallback.
- [x] Respect reduced-motion preferences, reserve layout space to prevent shifts while frames load, preload important frames, and display a graceful fallback if frame extraction or frame loading fails.
- [x] Keep text readable against the background, preserve stable aspect ratio and avoid unnecessary dependencies.

## 5. Maintainable implementation and handoff — complete

- [x] Use a clean, maintainable, locally runnable and deployable web implementation; React and Vite are preferred, with HTML, CSS and JavaScript for the website and cursor tracking. Use an HTML canvas to render extracted frames; use Python and OpenCV for offline extraction if supported.
- [x] Work with the existing project if available; do not unnecessarily rebuild or delete working files. Actually process the uploaded video and integrate resulting assets whenever possible; do not leave the implementation unfinished by merely providing a script.
- [x] Run the project and verify the production build succeeds. Check asset paths, imports and syntax; confirm the uploaded video is actually used; check cursor mapping at corners and edges; verify introduction placement, navigation and Explore My Art scrolling; and review for browser console errors.
- [x] Explain source-video pose limitations and any additional assets needed for complete directional tracking.
- [x] Deliver a working full-screen interactive portrait with the compact upper-left introduction and the dark-purple/blush-pink art portfolio experience—not merely a design description or screenshot.

## 6. Follow-up: smooth cursor-driven portrait motion — complete

- [x] “The rotation should be smooth, the face should move smoothly”: cursor-driven head/face changes must visibly use continuous intermediate frames from the supplied 24 fps video instead of snapping between seven stills. Keep the motion responsive and face features clear, with no ghosting or doubled-face crossfades, and keep the surrounding page still.

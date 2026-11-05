import type { DepthRibbonItem } from "../components/DepthRibbon";

/**
 * The 57 artworks for the Depth Ribbon.
 * Put the files in  client/public/ribbon-artworks/  named
 * artwork-01.jpg … artwork-57.jpg  (or change the path / extension below).
 * Tip: ~1400px on the long side is plenty and keeps the page fast.
 */
export const depthRibbonItems: DepthRibbonItem[] = Array.from(
  { length: 57 },
  (_, index) => {
    const number = index + 1;
    const id = String(number).padStart(2, "0");
    return {
      src: `/depth ribbon artworks/artwork-${id}.jpg`,
      alt: `Sunny's artwork ${number}`,
      title: `Artwork ${number}`,
      subtitle: "A little piece of my imagination",
    };
  }
);

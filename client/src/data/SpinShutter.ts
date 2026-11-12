import type { SpinArtwork } from "../components/SpinShutter";
export const spinShutterArtworks: SpinArtwork[] = Array.from(
  { length: 60 },
  (_, index) => {
    const number = index + 1;
    const id = String(number).padStart(2, "0");
    return {
      id,
      title: "",
      note: "A little bit of everything I am.",
      image: `/optimized-artworks-v2/spinshutter artworks/artwork-${id}.webp`,
      alt: "Artwork from Sunny's collection",
    };
  }
);

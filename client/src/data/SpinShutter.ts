import type { SpinArtwork } from "../components/SpinShutter";
export const spinShutterArtworks: SpinArtwork[] = Array.from(
  { length: 60 },
  (_, index) => {
    const number = index + 1;
    const id = String(number).padStart(2, "0");
    return {
      id,
      title: "",
      note: "A little piece of my imagination",
      image: `/spinshutter artworks/artwork-${id}.jpg`,
      alt: "Artwork from Sunny's collection",
    };
  }
);

import type { SpinArtwork } from "../components/SpinShutter";
export const spinShutterArtworks: SpinArtwork[] = Array.from({ length: 60 }, (_, index) => {
  const number = index + 1;
  const id = String(number).padStart(2, "0");
  return { id, title: `Artwork ${number}`, note: "A little piece of my imagination", image: `/spin-artworks%201/artwork-${id}.jpg`, alt: `Sunny's Spin Shutter artwork ${number}` };
});

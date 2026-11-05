/**
 * The 40 coloured artworks for the Gradient Carousel.
 * Put the files in  client/public/gradient-artworks/  named
 * artwork-01.jpg … artwork-40.jpg  (or change the path / extension below).
 */
export const gradientArtworks: string[] = Array.from({ length: 40 }, (_, index) => {
  const id = String(index + 1).padStart(2, "0");
  return `/gradient-artworks/artwork-${id}.jpg`;
});

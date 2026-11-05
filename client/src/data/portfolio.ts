export const portfolioCopy = {
  greeting: "HELLO, I'M",
  name: "Sunny.",
  role: "Artist • Dreamer • Creator",
  introduction:
    "I turn little thoughts and feelings into art, one sketch at a time.",
  imaginationNote: "A little corner of my imagination.",
  biography:
    "I’m Sunny, and I make art inspired by small moments, gentle colors, and the feelings that are hard to put into words. This portfolio is a little home for what I’m making and what I’m still discovering.",
  email: "hello@yourstudio.com",
};
export type Artwork = {
  id: string;
  title: string;
  note: string;
  image: string | null;
  alt: string;
  format: "portrait" | "landscape";
};
export const artwork: Artwork[] = Array.from({ length: 36 }, (_, index) => {
  const number = index + 1;
  const id = String(number).padStart(2, "0");
  return {
    id,
    title: `Artwork ${number}`,
    note: "A little piece of my imagination",
    image: `/gallery artworks/artwork-${id}.jpg`,
    alt: `Sunny's artwork ${number}`,
    format: "portrait" as const,
  };
});

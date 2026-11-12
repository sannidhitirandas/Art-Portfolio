export const portfolioCopy = {
  greeting: "HELLO, I'M",
  name: "Sunny.",
  role: "Artist • Dreamer • Creator",
  introduction:
    "I turn little thoughts and feelings into art, one sketch at a time.",
  imaginationNote: "A little corner of my imagination.",
  biography:
    "I'm Sunny, an artist who finds creativity in words, lines, and colours. I love turning meaningful lyrics into visual art — one of my biggest creative passions. I also enjoy sketching anime-inspired characters in ink and creating colourful illustrations. Each style lets me express a different part of my imagination. This portfolio brings all those little worlds together — a collection of the things I love creating.",
  email: "sannidhitirandas@gmail.com",
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
    image: `/optimized-artworks-v2/gallery artworks/artwork-${id}.webp`,
    alt: `Sunny's artwork ${number}`,
    format: "portrait" as const,
  };
});

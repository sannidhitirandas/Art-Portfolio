import type { Artwork } from "./portfolio";
export type ReelTile = { key: string; title: string; note: string; image: string | null; alt: string; format: "portrait" | "landscape"; label: string };
export type ReelRowData = { id: string; direction: 1 | -1; tiles: ReelTile[] };
export function hasRealArtwork(artworks: Artwork[]): boolean { return artworks.some(item => Boolean(item.image)); }
export function buildReelRows(artworks: Artwork[], rowCount = 5, tilesPerRow = 36): ReelRowData[] {
  if (!artworks.length) return [];
  const categories = [
    ["01","02","03","04","05","06","09","25","26","27","28","29","30"],
    ["13","14","15","16","17","18"],
    ["10","19","20","21","22","23","24"],
    ["07","08","11","12","31","32","33","34","35","36"],
  ];
  const groups = categories.map(ids => artworks.filter(item => ids.includes(item.id)));
  const mixed: Artwork[] = [], positions = groups.map(() => 0);
  while (groups.some((group, index) => positions[index] < group.length)) groups.forEach((group, index) => { if (positions[index] < group.length) mixed.push(group[positions[index]++]); });
  artworks.forEach(item => { if (!mixed.some(existing => existing.id === item.id)) mixed.push(item); });
  return Array.from({ length: rowCount }, (_, rowIndex) => ({
    id: `reel-row-${rowIndex + 1}`, direction: (rowIndex % 2 === 0 ? 1 : -1) as 1 | -1,
    tiles: Array.from({ length: tilesPerRow }, (_, tileIndex) => {
      const item = mixed[(tileIndex + rowIndex * 9) % mixed.length];
      return { key: `row-${rowIndex}-art-${tileIndex}`, title: item.title, note: item.note, image: item.image || null, alt: item.alt, format: item.format, label: item.id };
    }),
  }));
}

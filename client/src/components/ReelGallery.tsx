import type { ReelRowData, ReelTile } from "../data/reelGallery";
import "./ReelGallery.css";

function Tile({ tile }: { tile: ReelTile }) {
  return (
    <figure className={`reel-tile reel-tile--${tile.format}`}>
      {tile.image ? (
        <img className="reel-tile__image" src={tile.image} alt={tile.alt} loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="reel-tile__placeholder">
          <span className="reel-tile__index">{tile.label}</span>
          <span className="reel-tile__ring" aria-hidden="true" />
          <span className="reel-tile__label">YOUR ART GOES HERE</span>
        </div>
      )}
      {tile.image && <figcaption className="reel-tile__caption"><span>{tile.title}</span><span>{tile.label}</span></figcaption>}
    </figure>
  );
}

function Row({ row }: { row: ReelRowData }) {
  const direction = row.direction === 1 ? "left" : "right";
  return (
    <div className="reel-row">
      <div className={`reel-row__track reel-row__track--${direction}`}>
        {[0, 1].map(copy => (
          <div className="reel-row__sequence" key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {row.tiles.map(tile => <Tile key={`${copy}-${tile.key}`} tile={tile} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReelGallery({ rows }: { rows: ReelRowData[] }) {
  return <div className="reel-gallery"><div className="reel-gallery__stage">{rows.map(row => <Row key={row.id} row={row} />)}</div></div>;
}

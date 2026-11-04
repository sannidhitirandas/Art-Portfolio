import { useState } from "react";
import "./SpinShutter.css";
import { spinShutterArtworks } from "../data/SpinShutter";

export type SpinArtwork = { id: string; title: string; note: string; image: string | null; alt: string };

export default function SpinShutter() {
  const [active, setActive] = useState(0);
  const artwork = spinShutterArtworks[active];
  const move = (direction: number) => setActive(current => (current + direction + spinShutterArtworks.length) % spinShutterArtworks.length);
  return (
    <div className="spin-shutter">
      <div className="spin-shutter__heading"><p>THE ART COLLECTION · 60 PIECES</p><h3>Behind the <em>shutter.</em></h3></div>
      <div className="spin-stage">
        <button className="spin-arrow" onClick={() => move(-1)} aria-label="Previous artwork">←</button>
        <div className="spin-object" key={active}>
          {Array.from({ length: 6 }, (_, index) => (
            <div className="spin-panel" key={index} style={{ "--panel": index, "--rotation": `${index * 60}deg` } as React.CSSProperties}>
              <div className="spin-panel__inner">{artwork.image ? <img src={artwork.image} alt={artwork.alt} /> : <span>{artwork.id}</span>}</div>
            </div>
          ))}
        </div>
        <button className="spin-arrow" onClick={() => move(1)} aria-label="Next artwork">→</button>
      </div>
      <div className="spin-info"><span>{artwork.id} / 60</span><h4>{artwork.title}</h4><p>{artwork.note}</p></div>
      <div className="spin-progress"><span style={{ width: `${((active + 1) / 60) * 100}%` }} /></div>
    </div>
  );
}

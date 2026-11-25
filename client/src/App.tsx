import { useEffect } from "react";
import Home from "./pages/Home";
import { playWebsiteClickSound } from "./lib/artworkSounds";

export default function App() {
  useEffect(() => {
    const handleWebsiteClick = () => playWebsiteClickSound();
    document.addEventListener("click", handleWebsiteClick);

    const backgroundMusic = new Audio("/sounds/background-music.mp3");
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.35;
    backgroundMusic.preload = "auto";

    // Request playback immediately when the page loads. Browsers may still
    // block audible autoplay according to the visitor's autoplay settings.
    void backgroundMusic.play().catch((error) => {
      console.warn("Browser blocked background music autoplay:", error);
    });

    return () => {
      document.removeEventListener("click", handleWebsiteClick);
      backgroundMusic.pause();
      backgroundMusic.src = "";
    };
  }, []);

  return <Home />;
}

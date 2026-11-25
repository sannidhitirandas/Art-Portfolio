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

    let musicStarted = false;

    const startBackgroundMusic = () => {
      if (musicStarted) return;

      void backgroundMusic.play().then(() => {
        musicStarted = true;
        removeStartListeners();
      }).catch((error) => {
        // Browsers commonly reject audible autoplay until a user gesture.
        console.info("Background music is waiting for the first user interaction:", error);
      });
    };

    const removeStartListeners = () => {
      document.removeEventListener("pointerdown", startBackgroundMusic, true);
      document.removeEventListener("keydown", startBackgroundMusic, true);
      document.removeEventListener("touchstart", startBackgroundMusic, true);
    };

    // Try immediately. If autoplay is blocked, retry during the first
    // trusted interaction so playback begins without a separate music button.
    startBackgroundMusic();
    document.addEventListener("pointerdown", startBackgroundMusic, true);
    document.addEventListener("keydown", startBackgroundMusic, true);
    document.addEventListener("touchstart", startBackgroundMusic, true);

    return () => {
      document.removeEventListener("click", handleWebsiteClick);
      removeStartListeners();
      backgroundMusic.pause();
      backgroundMusic.src = "";
    };
  }, []);

  return <Home />;
}

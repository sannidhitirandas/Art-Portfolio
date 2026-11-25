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
    backgroundMusic.autoplay = true;

    let musicStarted = false;

    const removeStartListeners = () => {
      document.removeEventListener("pointerdown", startBackgroundMusic, true);
      document.removeEventListener("keydown", startBackgroundMusic, true);
      document.removeEventListener("touchstart", startBackgroundMusic, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", startBackgroundMusic);
    };

    const startBackgroundMusic = () => {
      if (musicStarted) return;

      // Attempt playback as soon as the app loads. Browsers may reject
      // audible autoplay until the visitor interacts with the page.
      void backgroundMusic.play().then(() => {
        musicStarted = true;
        removeStartListeners();
      }).catch(() => {
        // Keep trying on page visibility and on the first touch, pointer,
        // or keyboard interaction. No dedicated music-button click needed.
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") startBackgroundMusic();
    };

    // Start immediately on page load, then retry when the browser is ready
    // or the visitor returns to the tab / interacts in any normal way.
    startBackgroundMusic();
    backgroundMusic.addEventListener("canplay", startBackgroundMusic, { once: true });
    document.addEventListener("pointerdown", startBackgroundMusic, true);
    document.addEventListener("keydown", startBackgroundMusic, true);
    document.addEventListener("touchstart", startBackgroundMusic, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", startBackgroundMusic);

    return () => {
      document.removeEventListener("click", handleWebsiteClick);
      removeStartListeners();
      backgroundMusic.pause();
      backgroundMusic.src = "";
    };
  }, []);

  return <Home />;
}

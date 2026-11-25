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

    const startBackgroundMusic = () => {
      void backgroundMusic.play().then(() => {
        window.removeEventListener("pointerdown", startBackgroundMusic);
        window.removeEventListener("keydown", startBackgroundMusic);
      }).catch((error) => {
        console.warn("Background music could not start:", error);
      });
    };

    window.addEventListener("pointerdown", startBackgroundMusic);
    window.addEventListener("keydown", startBackgroundMusic);

    return () => {
      document.removeEventListener("click", handleWebsiteClick);
      window.removeEventListener("pointerdown", startBackgroundMusic);
      window.removeEventListener("keydown", startBackgroundMusic);
      backgroundMusic.pause();
      backgroundMusic.src = "";
    };
  }, []);

  return <Home />;
}

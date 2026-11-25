import { useEffect } from "react";
import Home from "./pages/Home";
import { playWebsiteClickSound } from "./lib/artworkSounds";

export default function App() {
  useEffect(() => {
    const handleWebsiteClick = () => playWebsiteClickSound();
    document.addEventListener("click", handleWebsiteClick);
    return () => document.removeEventListener("click", handleWebsiteClick);
  }, []);

  return <Home />;
}

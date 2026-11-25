const swipeSound = typeof Audio !== "undefined" ? new Audio("/sounds/artwork-swipe.mp3") : null;
const clickSound = typeof Audio !== "undefined"
  ? new Audio("https://raw.githubusercontent.com/sannidhitirandas/Art-Portfolio/95994fdd8cbc6f6487db2e00e1db6e26a5ff396a/client/public/sounds/artwork-click.mp3")
  : null;

export function playArtworkSwipeSound() {
  if (!swipeSound) return;
  swipeSound.pause();
  swipeSound.currentTime = 0;
  const playback = swipeSound.play();
  if (playback) {
    void playback.catch((error: unknown) => {
      console.warn("Artwork swipe sound could not play:", error);
    });
  }
}

export function playWebsiteClickSound() {
  if (!clickSound) return;
  clickSound.pause();
  clickSound.currentTime = 0;
  const playback = clickSound.play();
  if (playback) {
    void playback.catch((error: unknown) => {
      console.warn("Website click sound could not play:", error);
    });
  }
}

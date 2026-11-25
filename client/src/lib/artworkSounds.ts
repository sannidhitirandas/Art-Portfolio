const swipeSound = typeof Audio !== "undefined" ? new Audio("/sounds/artwork-swipe.mp3") : null;

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

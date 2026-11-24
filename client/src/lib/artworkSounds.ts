const soundCache = new Map<string, HTMLAudioElement>();

function playArtworkSound(path: string) {
  if (typeof Audio === "undefined") return;

  let audio = soundCache.get(path);
  if (!audio) {
    audio = new Audio(path);
    audio.preload = "auto";
    soundCache.set(path, audio);
  }

  audio.pause();
  audio.currentTime = 0;
  const playback = audio.play();
  if (playback) {
    void playback.catch((error: unknown) => {
      console.warn(`Artwork sound could not play from ${path}:`, error);
    });
  }
}

export function playArtworkClickSound() {
  playArtworkSound("/sounds/artwork-click.mp3");
}

export function playArtworkSwipeSound() {
  playArtworkSound("/sounds/artwork-swipe.mp3");
}

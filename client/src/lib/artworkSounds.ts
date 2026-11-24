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
  void audio.play().catch(() => {
    // Playback can be blocked by browser settings; the gallery still works normally.
  });
}

export function playArtworkClickSound() {
  playArtworkSound("/sounds/artwork-click.mp3");
}

export function playArtworkSwipeSound() {
  playArtworkSound("/sounds/artwork-swipe.mp3");
}

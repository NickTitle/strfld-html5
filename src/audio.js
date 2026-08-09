const BROADCAST_TRACKS = Object.fromEntries(
  Array.from({ length: 11 }, (_, index) => {
    const song = ((index + 1) % 10) + 1;
    return [`broadcast${index + 1}`, [`./assets/songs/${song}.mp3`, { loop: true, volume: 0 }]];
  })
);

const TRACKS = Object.freeze({
  engine: ["./assets/sfx/engine3.mp3", { loop: true, volume: 0 }],
  static: ["./assets/sfx/static.mp3", { loop: true, volume: 0 }],
  power: ["./assets/sfx/button.mp3", { loop: false, volume: 1 }],
  ...BROADCAST_TRACKS
});

export class AudioController {
  constructor(audioFactory = (url) => new Audio(url)) {
    this.audioFactory = audioFactory;
    this.sounds = new Map();
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    for (const [name, [url, options]] of Object.entries(TRACKS)) {
      const sound = this.audioFactory(url);
      sound.loop = options.loop;
      sound.volume = options.volume;
      this.sounds.set(name, sound);
    }
    this.unlocked = true;
  }

  setLoopVolume(name, volume) {
    if (!this.unlocked) return;
    const sound = this.sounds.get(name);
    sound.volume = Math.max(0, Math.min(1, volume));
    if (sound.paused) sound.play().catch(() => {});
  }

  play(name) {
    if (!this.unlocked) return;
    const sound = this.sounds.get(name);
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}

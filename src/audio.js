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
  found: ["./assets/sfx/found_planet.mp3", { loop: false, volume: 1 }],
  engineOff: ["./assets/sfx/engine_turn_off.mp3", { loop: false, volume: 1 }],
  finale: ["./assets/songs/game_end.mp3", { loop: false, volume: 1 }],
  ...BROADCAST_TRACKS
});

export class AudioController {
  constructor(
    audioFactory = (url) => new Audio(url),
    audioContextFactory = () => {
      const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      return AudioContext ? new AudioContext() : null;
    }
  ) {
    this.audioFactory = audioFactory;
    this.audioContextFactory = audioContextFactory;
    this.context = null;
    this.sounds = new Map();
    this.gains = new Map();
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      this.context = this.audioContextFactory();
    } catch {
      this.context = null;
    }
    const resume = this.context?.resume?.();
    resume?.catch?.(() => {});
    for (const [name, [url, options]] of Object.entries(TRACKS)) {
      const sound = this.audioFactory(url);
      sound.loop = options.loop;
      if (this.context) {
        // Mobile Safari does not reliably honor HTMLMediaElement.volume.
        // Keep elements at unity and apply the source gain through Web Audio.
        const source = this.context.createMediaElementSource(sound);
        const gain = this.context.createGain();
        sound.volume = 1;
        gain.gain.value = options.volume;
        source.connect(gain);
        gain.connect(this.context.destination);
        this.gains.set(name, gain);
      } else {
        sound.volume = options.volume;
      }
      this.sounds.set(name, sound);
      if (sound.loop) sound.play().catch(() => {});
    }
    this.unlocked = true;
  }

  setLoopVolume(name, volume) {
    if (!this.unlocked) return;
    const sound = this.sounds.get(name);
    const outputVolume = Math.max(0, Math.min(1, volume));
    const gain = this.gains.get(name);
    if (gain) gain.gain.value = outputVolume;
    else sound.volume = outputVolume;
    if (sound.paused) sound.play().catch(() => {});
  }

  play(name) {
    if (!this.unlocked) return;
    const sound = this.sounds.get(name);
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}

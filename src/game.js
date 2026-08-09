import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_SIZE } from "./constants.js";
import { EMPTY_INPUT } from "./input.js";
import { SeededRandom } from "./random.js";

const STAR_COUNT = 150;
const MAX_SPEED = 4;
const ACCELERATION_PER_FRAME = 0.03;
const ACTIVE_DAMPING_PER_FRAME = 0.993;
const PASSIVE_DAMPING_PER_FRAME = 0.995;
const ARTIFACT_COUNT = 11;
const BROADCAST_RANGE = 8;

function frameFactor(seconds) {
  return seconds * 60;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class Game {
  constructor({ seed = 0x2013, audio = null } = {}) {
    this.random = new SeededRandom(seed);
    this.audio = audio;
    this.state = "title";
    this.titleFade = 1;
    this.elapsed = 0;
    this.radioOffset = 0;
    this.ship = {
      x: WORLD_SIZE / 2 + this.random.integer(100),
      y: WORLD_SIZE / 2 + this.random.integer(100),
      vx: 0,
      vy: 0,
      angle: 0,
      engineVolume: 0
    };
    this.stars = Array.from({ length: STAR_COUNT }, () => this.createStar());
    this.artifacts = Array.from({ length: ARTIFACT_COUNT }, (_, index) => this.createArtifact(index));
    this.radio = {
      activeArtifact: null,
      receptionVolume: 0,
      showSonar: false,
      sonarBearing: 0,
      staticVolume: 0
    };
  }

  createStar() {
    const star = {
      x: this.random.next() * VIEW_WIDTH,
      y: this.random.next() * VIEW_HEIGHT,
      z: this.random.integer(25) / 10 + 1,
      size: (this.random.integer(150) + 1) / 10 + 0.5,
      rotation: this.random.integer(90),
      spin: (this.random.integer(2) === 0 ? -1 : 1) * this.random.integer(100) / 500
    };
    this.randomizeStarColor(star);
    return star;
  }

  randomizeStarAppearance(star) {
    star.z = this.random.integer(25) / 10 + 1;
    star.size = (this.random.integer(150) + 1) / 10 + 0.5;
    star.rotation = this.random.integer(90);
    this.randomizeStarColor(star);
  }

  randomizeStarColor(star) {
    star.color = "rgba(255, 255, 255, 0.4)";
    if (star.z < 1.1 && star.size < 13) {
      const digits = Array.from({ length: 6 }, () => this.random.integer(15).toString(16));
      star.color = `#${digits.join("")}55`;
    }
  }

  randomColor(alpha = "ff") {
    const digits = Array.from({ length: 6 }, () => this.random.integer(15).toString(16));
    return `#${digits.join("")}${alpha}`;
  }

  createArtifact(index) {
    const count = index + 1;
    const color = this.randomColor();
    const towerColor = this.randomColor();
    const minimumSize = 150 + this.random.integer(25);
    const maximumSize = 400 + this.random.integer(25);
    return {
      id: count,
      color,
      towerColor,
      rotationDirection: -1,
      size: maximumSize - minimumSize,
      shutdownFrames: 150 + this.random.integer(60),
      rotation: this.random.integer(90),
      frequency: this.random.integer(275),
      x: this.random.integer(WORLD_SIZE),
      y: this.random.integer(WORLD_SIZE),
      audioName: `broadcast${count}`,
      song: (count % 10) + 1,
      broadcastVolume: 0,
      found: false,
      turnedOff: false,
      visibleOnMap: false
    };
  }

  update(seconds, input = EMPTY_INPUT) {
    const frames = frameFactor(seconds);
    this.elapsed += seconds;

    if (this.state === "title") {
      if (this.titleFade === 0 && input.advance) {
        this.state = "playing";
        this.updatePlaying(frames, EMPTY_INPUT);
        this.ship.x += this.ship.vx * frames;
        this.ship.y += this.ship.vy * frames;
        this.updateStars(frames);
        this.updateRadio();
        this.audio?.setLoopVolume("engine", this.ship.engineVolume);
        return;
      }

      const damping = PASSIVE_DAMPING_PER_FRAME ** frames;
      if (Math.abs(this.ship.vx) > 0.05) this.ship.vx *= damping;
      if (Math.abs(this.ship.vy) > 0.05) this.ship.vy *= damping;
      this.updateStars(frames);
      this.ship.angle = 52;
      this.applyThrust(frames);
      this.titleFade = Math.max(0, this.titleFade - frames / 255);
      if (this.titleFade < 1e-12) this.titleFade = 0;
      this.audio?.setLoopVolume("engine", this.ship.engineVolume);
      return;
    }

    this.updatePlaying(frames, input);
    this.ship.x += this.ship.vx * frames;
    this.ship.y += this.ship.vy * frames;
    this.updateStars(frames);
    this.updateRadio();
    this.audio?.setLoopVolume("engine", this.ship.engineVolume);
  }

  updatePlaying(frames, input) {
    if (input.left) this.ship.angle = (this.ship.angle - 2 * frames + 360) % 360;
    else if (input.right) this.ship.angle = (this.ship.angle + 2 * frames) % 360;

    if (input.thrust) {
      this.applyThrust(frames);
      const damping = ACTIVE_DAMPING_PER_FRAME ** frames;
      this.ship.vx *= damping;
      this.ship.vy *= damping;
      this.ship.engineVolume = Math.min(1, this.ship.engineVolume + 0.025 * frames);
    } else {
      const damping = PASSIVE_DAMPING_PER_FRAME ** frames;
      if (Math.abs(this.ship.vx) > 0.05) this.ship.vx *= damping;
      if (Math.abs(this.ship.vy) > 0.05) this.ship.vy *= damping;
      this.ship.angle = (this.ship.angle + (this.ship.vy > 0 ? -0.1 : 0.1) * frames + 360) % 360;
      this.ship.engineVolume = this.ship.engineVolume > 0.05
        ? this.ship.engineVolume * (0.95 ** frames)
        : 0;
    }

    const oldOffset = this.radioOffset;
    if (input.tuneDown) this.radioOffset = Math.max(0, this.radioOffset - 0.5 * frames);
    if (input.tuneUp) this.radioOffset = Math.min(275, this.radioOffset + 0.5 * frames);
    if (oldOffset === 0 && this.radioOffset > 0) this.audio?.play("power");
    if (oldOffset > 0 && this.radioOffset === 0) this.audio?.play("power");
  }

  applyThrust(frames) {
    const radians = this.ship.angle * Math.PI / 180;
    this.ship.vx = clamp(
      this.ship.vx + ACCELERATION_PER_FRAME * Math.sin(radians) * frames,
      -MAX_SPEED,
      MAX_SPEED
    );
    this.ship.vy = clamp(
      this.ship.vy - ACCELERATION_PER_FRAME * Math.cos(radians) * frames,
      -MAX_SPEED,
      MAX_SPEED
    );
  }

  updateStars(frames) {
    for (const star of this.stars) {
      star.x -= this.ship.vx * star.z * frames;
      star.y -= this.ship.vy * star.z * frames;
      star.rotation += star.spin * frames;

      if (star.x < 0 || star.x > VIEW_WIDTH) {
        star.x = ((star.x % VIEW_WIDTH) + VIEW_WIDTH) % VIEW_WIDTH;
        star.y = this.random.next() * VIEW_HEIGHT;
        this.randomizeStarAppearance(star);
      }
      if (star.y < 0 || star.y > VIEW_HEIGHT) {
        star.y = ((star.y % VIEW_HEIGHT) + VIEW_HEIGHT) % VIEW_HEIGHT;
        star.x = this.random.next() * VIEW_WIDTH;
        this.randomizeStarAppearance(star);
      }
    }
  }

  updateRadio() {
    for (const artifact of this.artifacts) {
      artifact.broadcastVolume = 0;
      artifact.visibleOnMap = false;
    }

    if (this.radioOffset === 0) {
      this.radio.activeArtifact = null;
      this.radio.receptionVolume = 0;
      this.radio.showSonar = false;
      this.radio.staticVolume = 0;
      this.updateRadioAudio();
      return;
    }

    const selected = [];
    for (const artifact of this.artifacts) {
      const closeness = Math.abs(this.radioOffset - artifact.frequency);
      if (closeness < BROADCAST_RANGE && selected.length < 2 && !artifact.turnedOff) {
        selected.push({
          artifact,
          distance: Math.hypot(this.ship.x - artifact.x, this.ship.y - artifact.y),
          strength: BROADCAST_RANGE - closeness
        });
      }
    }
    selected.sort((left, right) => left.strength - right.strength);

    if (selected.length === 0) {
      this.radio.showSonar = false;
      this.radio.staticVolume = 0.75;
      this.updateRadioAudio();
      return;
    }

    this.radio.showSonar = true;
    this.radio.activeArtifact = null;
    for (const [index, signal] of selected.entries()) {
      const signalComponent = 0.6 * signal.strength / BROADCAST_RANGE;
      const distanceComponent = 0.45 - 0.45 * signal.distance / WORLD_SIZE;
      const volume = Math.min(1, signalComponent + distanceComponent);
      signal.artifact.broadcastVolume = index === 0 ? volume : volume * (0.2 ** index);

      if (index === 0) {
        if (signal.artifact.found) signal.artifact.broadcastVolume = 0;
        signal.artifact.visibleOnMap = true;
        this.radio.receptionVolume = volume;
        this.radio.sonarBearing = Math.atan2(
          this.ship.y - signal.artifact.y,
          this.ship.x - signal.artifact.x
        ) * 180 / Math.PI;
        if (signal.distance < VIEW_HEIGHT / 2 && signal.distance < VIEW_WIDTH / 2) {
          this.radio.activeArtifact = signal.artifact;
          this.radio.staticVolume = 0;
        } else {
          this.radio.staticVolume = (1 - volume) * 0.75;
        }
      }
    }
    this.updateRadioAudio();
  }

  updateRadioAudio() {
    this.audio?.setLoopVolume("static", this.radio.staticVolume);
    for (const artifact of this.artifacts) {
      this.audio?.setLoopVolume(artifact.audioName, artifact.broadcastVolume);
    }
  }
}

export const PHYSICS = Object.freeze({
  accelerationPerFrame: ACCELERATION_PER_FRAME,
  activeDampingPerFrame: ACTIVE_DAMPING_PER_FRAME,
  passiveDampingPerFrame: PASSIVE_DAMPING_PER_FRAME,
  maxSpeed: MAX_SPEED,
  starCount: STAR_COUNT,
  artifactCount: ARTIFACT_COUNT,
  broadcastRange: BROADCAST_RANGE
});

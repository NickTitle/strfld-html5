import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_SIZE } from "./constants.js";
import { EMPTY_INPUT } from "./input.js";
import { SeededRandom } from "./random.js";

const STAR_COUNT = 150;
const MAX_SPEED = 4;
const ACCELERATION_PER_FRAME = 0.03;
const ACTIVE_DAMPING_PER_FRAME = 0.993;
const PASSIVE_DAMPING_PER_FRAME = 0.995;

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
}

export const PHYSICS = Object.freeze({
  accelerationPerFrame: ACCELERATION_PER_FRAME,
  activeDampingPerFrame: ACTIVE_DAMPING_PER_FRAME,
  passiveDampingPerFrame: PASSIVE_DAMPING_PER_FRAME,
  maxSpeed: MAX_SPEED,
  starCount: STAR_COUNT
});

import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_SIZE } from "./constants.js";
import { EMPTY_INPUT } from "./input.js";
import { SeededRandom } from "./random.js";
import { ARTIFACT_CUES, RADIO_CUES, STORY } from "./story.js";

const STAR_COUNT = 150;
const MAX_SPEED = 4;
const ACCELERATION_PER_FRAME = 0.03;
const ACTIVE_DAMPING_PER_FRAME = 0.993;
const PASSIVE_DAMPING_PER_FRAME = 0.995;
const ARTIFACT_COUNT = 11;
const BROADCAST_RANGE = 8;
const ARTIFACT_DRAW_DISTANCE = VIEW_WIDTH * 1.5;
const MINIMAP_SIZE = 100;
const STORY_DEBOUNCE_SECONDS = 1;

function frameFactor(seconds) {
  return seconds * 60;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToHundredth(value) {
  const magnitude = Math.abs(value);
  return Math.sign(value) * Math.round((magnitude + Number.EPSILON * magnitude) * 100) / 100;
}

export class Game {
  constructor({ seed = 0x2013, audio = null } = {}) {
    this.random = new SeededRandom(seed);
    this.audio = audio;
    this.state = "title";
    this.titleFade = 1;
    this.elapsed = 0;
    this.radioOffset = 0;
    this.story = {
      started: false,
      index: 0,
      text: "",
      paused: true,
      lastAdvanceAt: 0,
      ending: false
    };
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
    this.minimap = {
      cycle: 0,
      showShip: true
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
      shutdownRemaining: null,
      rotation: this.random.integer(90),
      frequency: this.random.integer(275),
      x: this.random.integer(WORLD_SIZE),
      y: this.random.integer(WORLD_SIZE),
      audioName: `broadcast${count}`,
      song: (count % 10) + 1,
      broadcastVolume: 0,
      found: false,
      turnedOff: false,
      visibleOnMap: false,
      shouldDraw: false,
      flickerDraw: true
    };
  }

  update(seconds, input = EMPTY_INPUT) {
    const frames = frameFactor(seconds);
    this.elapsed += seconds;

    if (this.state === "title") {
      if (this.titleFade === 0 && (input.advanceHeld || input.advance)) {
        this.state = "playing";
        this.startStory();
        this.updatePlaying(frames, EMPTY_INPUT);
        this.updateArtifacts(frames);
        this.ship.x += this.ship.vx * frames;
        this.ship.y += this.ship.vy * frames;
        this.updateStars(frames);
        this.updateMinimap(frames);
        this.updateRadio();
        this.audio?.setLoopVolume("engine", this.ship.engineVolume);
        return;
      }

      const damping = PASSIVE_DAMPING_PER_FRAME ** frames;
      if (Math.abs(this.ship.vx) > 0.05) this.ship.vx *= damping;
      if (Math.abs(this.ship.vy) > 0.05) this.ship.vy *= damping;
      this.updateStars(frames);
      this.updateArtifacts(frames);
      this.updateMinimap(frames);
      this.ship.angle = 52;
      this.applyThrust(frames);
      this.titleFade = Math.max(0, this.titleFade - frames / 255);
      if (this.titleFade < 1e-12) this.titleFade = 0;
      this.audio?.setLoopVolume("engine", this.ship.engineVolume);
      return;
    }

    this.updatePlaying(frames, input);
    this.updateArtifacts(frames);
    this.ship.x += this.ship.vx * frames;
    this.ship.y += this.ship.vy * frames;
    this.updateStars(frames);
    this.updateMinimap(frames);
    this.updateRadio();
    this.audio?.setLoopVolume("engine", this.ship.engineVolume);
  }

  updatePlaying(frames, input) {
    const pausedForStory = this.story.started && this.story.paused;
    const storyIndexAtStart = this.story.index;
    const advanceHeld = input.advanceHeld || input.advance;

    if (pausedForStory && advanceHeld) {
      if (ARTIFACT_CUES.has(storyIndexAtStart)) {
        if (this.canAdvanceStory() && this.radio.activeArtifact) {
          this.radio.activeArtifact.found = true;
        }
      } else if (storyIndexAtStart !== 3) {
        this.advanceStory();
      }
    } else if (!pausedForStory && advanceHeld && this.radio.activeArtifact) {
      this.radio.activeArtifact.found = true;
    }

    this.updateShipMotion(frames, pausedForStory ? EMPTY_INPUT : input);
    this.updateRadioTuning(frames, input, pausedForStory);
  }

  updateShipMotion(frames, input) {
    if (input.left) this.ship.angle = (this.ship.angle - 2 * frames + 360) % 360;
    else if (input.right) this.ship.angle = (this.ship.angle + 2 * frames) % 360;

    if (input.thrust) {
      this.applyThrust(frames);
      const damping = ACTIVE_DAMPING_PER_FRAME ** frames;
      this.ship.vx *= damping;
      this.ship.vy *= damping;
      this.ship.engineVolume = Math.min(1, this.ship.engineVolume + 0.025 * frames);
    } else {
      this.ship.engineVolume = this.ship.engineVolume > 0.05
        ? this.ship.engineVolume * (0.95 ** frames)
        : 0;
      if (this.radio.activeArtifact && !input.left && !input.right) {
        this.adjustForOrbit(frames, this.radio.activeArtifact);
      } else {
        const damping = PASSIVE_DAMPING_PER_FRAME ** frames;
        if (Math.abs(this.ship.vx) > 0.05) this.ship.vx *= damping;
        if (Math.abs(this.ship.vy) > 0.05) this.ship.vy *= damping;
        this.ship.angle = (this.ship.angle + (this.ship.vy > 0 ? -0.1 : 0.1) * frames + 360) % 360;
      }
    }
  }

  updateRadioTuning(frames, input, pausedForStory) {
    const oldOffset = this.radioOffset;
    if (pausedForStory) {
      if ((this.story.index === 3 || this.story.index === 4) && input.tuneUp) {
        if (this.story.index === 3) this.advanceStory();
        this.radioOffset = Math.min(275, this.radioOffset + 0.5 * frames);
      }
    } else {
      if (input.tuneDown) this.radioOffset = Math.max(0, this.radioOffset - 0.5 * frames);
      if (input.tuneUp) this.radioOffset = Math.min(275, this.radioOffset + 0.5 * frames);
      if (this.story.started && this.story.index === STORY.length - 1 && input.tuneDown && this.radioOffset === 0) {
        this.advanceStory();
        this.story.text = "";
      }
    }
    if (oldOffset === 0 && this.radioOffset > 0) this.audio?.play("power");
    if (oldOffset > 0 && this.radioOffset === 0) this.audio?.play("power");
  }

  adjustForOrbit(frames, artifact) {
    if (Math.abs(this.ship.vx) > 2) this.ship.vx *= 0.9 ** frames;
    if (Math.abs(this.ship.vy) > 2) this.ship.vy *= 0.9 ** frames;
    const distance = Math.hypot(artifact.x - this.ship.x, artifact.y - this.ship.y);
    const scalar = 0.03 * Math.min(distance / (VIEW_HEIGHT / 3), 1) * frames;
    this.ship.vx += this.ship.x > artifact.x ? -scalar : scalar;
    this.ship.vy += this.ship.y > artifact.y ? -scalar : scalar;
    let motionAngle = Math.atan2(this.ship.vy, this.ship.vx) * 180 / Math.PI;
    if (motionAngle < 0) motionAngle += 360;
    this.ship.angle = motionAngle + 90;
  }

  startStory() {
    this.story.started = true;
    this.story.index = 0;
    this.story.text = STORY[0].text;
    this.story.paused = STORY[0].paused;
    this.story.lastAdvanceAt = this.elapsed;
  }

  canAdvanceStory() {
    return this.elapsed - this.story.lastAdvanceAt >= STORY_DEBOUNCE_SECONDS - 1e-12;
  }

  advanceStory() {
    if (!this.story.started || !this.canAdvanceStory()) return false;
    this.story.lastAdvanceAt = this.elapsed;
    if (this.story.index === STORY.length - 1) {
      this.story.ending = true;
      this.state = "fadeOut";
      return true;
    }
    this.story.index += 1;
    this.story.text = STORY[this.story.index].text;
    this.story.paused = STORY[this.story.index].paused;
    return true;
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

  updateArtifacts(frames) {
    for (const artifact of this.artifacts) {
      artifact.shouldDraw = Math.abs(artifact.x - this.ship.x) < ARTIFACT_DRAW_DISTANCE
        && Math.abs(artifact.y - this.ship.y) < VIEW_HEIGHT * 1.5;
      if (artifact.shouldDraw) {
        if (artifact.found && !artifact.turnedOff) {
          artifact.towerColor = this.randomColor();
          artifact.color = this.randomColor();
          if (artifact.shutdownRemaining === null) {
            artifact.shutdownRemaining = artifact.shutdownFrames;
            this.audio?.play("found");
          }
          artifact.shutdownRemaining -= frames;
          if (artifact.shutdownRemaining <= 0) {
            artifact.shutdownRemaining = 0;
            artifact.turnedOff = true;
            artifact.flickerDraw = true;
            artifact.color = this.randomGrey();
            artifact.towerColor = this.randomGrey();
            this.audio?.play("engineOff");
            if (this.story.started) this.advanceStory();
            continue;
          }
          const flickerBand = Math.trunc((Math.trunc(artifact.shutdownRemaining / 2) % 10) / 6);
          if (flickerBand === 1) artifact.flickerDraw = !artifact.flickerDraw;
        }
        artifact.rotation = (artifact.rotation + 0.015 * artifact.rotationDirection * frames + 360) % 360;
      }
    }
  }

  randomGrey() {
    const value = `${this.random.integer(15).toString(16)}${this.random.integer(15).toString(16)}`;
    return `#${value}${value}${value}ff`;
  }

  updateMinimap(frames) {
    if (this.minimap.cycle >= 60) {
      this.minimap.showShip = !this.minimap.showShip;
      this.minimap.cycle = 0;
    } else {
      this.minimap.cycle += frames;
    }
  }

  mapToMinimap(x, y) {
    return {
      x: roundToHundredth(x / WORLD_SIZE * MINIMAP_SIZE),
      y: roundToHundredth(y / WORLD_SIZE * MINIMAP_SIZE)
    };
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
    if (!(this.story.started && this.story.paused)) this.radio.activeArtifact = null;
    for (const [index, signal] of selected.entries()) {
      const signalComponent = 0.6 * signal.strength / BROADCAST_RANGE;
      const distanceComponent = 0.45 - 0.45 * signal.distance / WORLD_SIZE;
      const volume = Math.min(1, signalComponent + distanceComponent);
      signal.artifact.broadcastVolume = index === 0 ? volume : volume * (0.2 ** index);

      if (index === 0) {
        if (this.story.started && this.story.index === 4 && volume > 0.5) this.advanceStory();
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
          if (this.story.started && RADIO_CUES.has(this.story.index)) {
            this.advanceStory();
            this.audio?.play("engineOff");
          }
        } else {
          this.radio.staticVolume = (1 - volume) * 0.75;
          if (!(this.story.started && this.story.paused)) this.radio.activeArtifact = null;
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
  broadcastRange: BROADCAST_RANGE,
  artifactDrawDistance: ARTIFACT_DRAW_DISTANCE,
  minimapSize: MINIMAP_SIZE
});

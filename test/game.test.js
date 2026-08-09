import assert from "node:assert/strict";
import test from "node:test";

import { COLORS, FIXED_STEP_SECONDS } from "../src/constants.js";
import { Game, PHYSICS } from "../src/game.js";
import { EMPTY_INPUT } from "../src/input.js";
import { SeededRandom } from "../src/random.js";
import { ARTIFACT_CUES, RADIO_CUES, STORY } from "../src/story.js";

function advance(game, frames, input = EMPTY_INPUT) {
  for (let frame = 0; frame < frames; frame += 1) {
    game.update(FIXED_STEP_SECONDS, input);
  }
}

function recordingAudio() {
  const events = [];
  return {
    events,
    play(name) { events.push({ type: "play", name }); },
    setLoopVolume(name, volume) { events.push({ type: "volume", name, volume }); }
  };
}

test("same seed and inputs produce the same simulation", () => {
  const left = new Game({ seed: 42 });
  const right = new Game({ seed: 42 });
  left.state = right.state = "playing";

  const input = { ...EMPTY_INPUT, right: true, thrust: true, tuneUp: true };
  advance(left, 240, input);
  advance(right, 240, input);

  assert.deepEqual(left, right);
});

test("initial state preserves original world and star configuration", () => {
  const game = new Game({ seed: 1 });

  assert.equal(game.state, "title");
  assert.equal(game.stars.length, 150);
  assert.equal(game.artifacts.length, 11);
  assert.equal(game.particles.length, 200);
  assert.equal(game.secondaryParticles.length, 100);
  assert.equal(game.sonar.bars.length, 10);
  assert.equal(PHYSICS.starCount, 150);
  assert.equal(PHYSICS.artifactCount, 11);
  assert.equal(PHYSICS.particleCount, 200);
  assert.equal(PHYSICS.secondaryParticleCount, 100);
  assert.equal(PHYSICS.sonarBarCount, 10);
  assert.ok(game.ship.x >= 10_000 && game.ship.x < 10_100);
  assert.ok(game.ship.y >= 10_000 && game.ship.y < 10_100);
  assert.deepEqual(game.artifacts.map((artifact) => artifact.song), [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2]);
  for (const artifact of game.artifacts) {
    assert.ok(artifact.frequency >= 0 && artifact.frequency < 275);
    assert.ok(artifact.x >= 0 && artifact.x < 20_000);
    assert.ok(artifact.y >= 0 && artifact.y < 20_000);
  }
});

test("title fades before accepting space", () => {
  const game = new Game({ seed: 2 });
  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, advance: true });
  assert.equal(game.state, "title");

  advance(game, 254);
  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, advance: true });
  assert.equal(game.state, "playing");
});

test("title fly-by changes velocity and stars without moving world position", () => {
  const game = new Game({ seed: 21 });
  const start = { x: game.ship.x, y: game.ship.y };
  const star = game.stars[0];
  const starStart = { x: star.x, y: star.y };
  const particleStart = structuredClone(game.particles[0]);

  game.update(FIXED_STEP_SECONDS, EMPTY_INPUT);
  assert.deepEqual({ x: game.ship.x, y: game.ship.y }, start);
  assert.deepEqual({ x: star.x, y: star.y }, starStart);
  assert.notEqual(game.ship.vx, 0);
  assert.notEqual(game.ship.vy, 0);
  assert.deepEqual(game.particles[0], particleStart);

  game.update(FIXED_STEP_SECONDS, EMPTY_INPUT);
  assert.deepEqual({ x: game.ship.x, y: game.ship.y }, start);
  assert.notDeepEqual({ x: star.x, y: star.y }, starStart);
});

test("thrust follows original acceleration, damping, and speed cap", () => {
  const game = new Game({ seed: 3 });
  game.state = "playing";
  game.ship.angle = 90;

  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, thrust: true });
  assert.ok(Math.abs(game.ship.vx - 0.03 * 0.993) < 1e-12);
  assert.ok(Math.abs(game.ship.vy) < 1e-12);

  advance(game, 10_000, { ...EMPTY_INPUT, thrust: true });
  assert.ok(game.ship.vx <= PHYSICS.maxSpeed);
  assert.ok(game.ship.vx > 3);
});

test("radio tuning remains bounded to the original 0..275 dial", () => {
  const game = new Game({ seed: 4 });
  game.state = "playing";

  advance(game, 1_000, { ...EMPTY_INPUT, tuneUp: true });
  assert.equal(game.radioOffset, 275);

  advance(game, 1_000, { ...EMPTY_INPUT, tuneDown: true });
  assert.equal(game.radioOffset, 0);
});

test("stars move opposite ship velocity with depth-scaled parallax", () => {
  const game = new Game({ seed: 5 });
  game.state = "playing";
  const star = game.stars[0];
  star.x = 320;
  star.y = 240;
  star.z = 2.5;
  game.ship.vx = 1;
  game.ship.vy = -0.5;

  game.update(FIXED_STEP_SECONDS, EMPTY_INPUT);

  const dampedX = 0.995;
  const dampedY = -0.5 * 0.995;
  assert.ok(Math.abs(star.x - (320 - dampedX * 2.5)) < 1e-12);
  assert.ok(Math.abs(star.y - (240 - dampedY * 2.5)) < 1e-12);
});

test("stars regenerate visual traits after crossing a boundary", () => {
  const game = new Game({ seed: 6 });
  game.state = "playing";
  const star = game.stars[0];
  star.x = 639;
  star.y = 240;
  star.z = 3.4;
  star.size = 15.5;
  star.rotation = 89;
  star.color = "sentinel";
  game.ship.vx = -4;
  game.ship.vy = 0;

  game.update(FIXED_STEP_SECONDS, EMPTY_INPUT);

  assert.ok(star.x >= 0 && star.x <= 640);
  assert.ok(star.y >= 0 && star.y < 480);
  assert.ok(star.z >= 1 && star.z <= 3.4);
  assert.ok(star.size >= 0.6 && star.size <= 15.5);
  assert.ok(star.rotation >= 0 && star.rotation < 90);
  assert.notEqual(star.color, "sentinel");
});

test("radio preserves original first-two and weaker-signal precedence", () => {
  const game = new Game({ seed: 7 });
  game.state = "playing";
  game.radioOffset = 100;
  game.ship.x = 10_000;
  game.ship.y = 10_000;

  const [first, second, third] = game.artifacts;
  Object.assign(first, { frequency: 99, x: 11_000, y: 10_000 });
  Object.assign(second, { frequency: 106, x: 10_500, y: 10_000 });
  Object.assign(third, { frequency: 100, x: 10_010, y: 10_000 });

  game.updateRadio();

  assert.equal(game.radio.showSonar, true);
  assert.equal(game.radio.activeArtifact, null);
  assert.equal(second.visibleOnMap, true);
  assert.equal(first.visibleOnMap, false);
  assert.equal(third.visibleOnMap, false);
  assert.equal(third.broadcastVolume, 0);
  assert.ok(Math.abs(second.broadcastVolume - 0.58875) < 1e-12);
  assert.ok(Math.abs(first.broadcastVolume - 0.1905) < 1e-12);
  assert.ok(Math.abs(game.radio.staticVolume - 0.3084375) < 1e-12);
  assert.equal(game.radio.sonarBearing, 180);
  assert.ok(game.sonar.bars.every((bar) => bar.nextAngle === 180));
  assert.ok(Math.abs(game.sonar.countdownMax - (200 - 0.58875)) < 1e-12);
  const randomState = game.random.state;
  game.updateRadio();
  assert.equal(game.random.state, randomState);
});

test("sonar resets on the source cadence and preserves damped bar motion", () => {
  const game = new Game({ seed: 17 });
  const bar = game.sonar.bars[0];
  bar.nextAngle = -45;

  game.updateSonar(1);
  assert.deepEqual(
    { x: bar.x, y: bar.y, width: bar.width, alpha: bar.alpha, speed: bar.speed, angle: bar.angle },
    { x: 320, y: 245, width: 2, alpha: 255, speed: 5, angle: -45 }
  );
  assert.equal(game.sonar.countdown, 60);

  game.updateSonar(1);
  assert.ok(Math.abs(bar.y - 249.85) < 1e-12);
  assert.equal(bar.width, 2.5);
  assert.equal(bar.alpha, 250);
  assert.equal(bar.speed, 4.85);
  assert.equal(game.sonar.countdown, 59);

  game.sonar.countdown = 1;
  game.sonar.countdownMax = 199.25;
  bar.nextAngle = 123;
  game.updateSonar(1);
  assert.equal(bar.angle, 123);
  assert.equal(game.sonar.countdown, 199.25);
});

test("both particle banks follow source lifecycle while only thrust controls strength", () => {
  const game = new Game({ seed: 18 });
  assert.equal(game.particles.every((particle) => particle.color === COLORS.transparent), true);
  assert.equal(game.secondaryParticles.every((particle) => particle.color === COLORS.transparent), true);

  const particle = game.particles[0];
  game.particles = [particle];
  game.secondaryParticles = [];
  Object.assign(particle, {
    x: 320,
    y: 245,
    xVelocity: 2,
    yVelocity: 3,
    cycles: 0,
    maxCycles: 100,
    yScalar: 0.5
  });

  game.updateParticles(20, false, false);
  assert.equal(particle.x, 360);
  assert.equal(particle.y, 305);
  assert.ok(Math.abs(particle.xVelocity - 2 * 0.9 ** 20) < 1e-12);
  assert.equal(particle.cycles, 20);
  assert.equal(particle.color, COLORS.white);
  game.updateParticles(20, false, false);
  assert.equal(particle.color, COLORS.yellow);
  game.updateParticles(20, false, false);
  assert.equal(particle.color, COLORS.orange);

  Object.assign(particle, { cycles: 0, maxCycles: 1, yScalar: 0.5 });
  game.ship.engineVolume = 0.4;
  game.ship.angle = 37;
  game.updateParticles(1, true, false);
  assert.equal(particle.yScalar, 0.4);
  assert.equal(particle.x, 320);
  assert.equal(particle.y, 245);
  assert.equal(particle.cycles, 0);
  assert.equal(particle.angle, 37);
  assert.ok(particle.maxCycles >= 0.4 && particle.maxCycles <= 32);

  particle.maxCycles = 1;
  particle.yScalar = 0.21;
  game.updateParticles(1, false, false);
  assert.equal(particle.yScalar, 0.2);
});

test("particle constructor banks and reset consume RNG in source order", () => {
  const game = new Game({ seed: 18 });
  assert.deepEqual(
    [game.particles[0], game.particles[199], game.secondaryParticles[0], game.secondaryParticles[99]].map((particle) => ({
      xVelocity: particle.xVelocity,
      yVelocity: particle.yVelocity,
      size: particle.size
    })),
    [
      { xVelocity: 2.1293291454203427, yVelocity: 2, size: 1 },
      { xVelocity: 1.089288176735863, yVelocity: 3, size: 2 },
      { xVelocity: -0.43720478122122586, yVelocity: 3, size: 1 },
      { xVelocity: 1.6271947431378067, yVelocity: 3, size: 1 }
    ]
  );

  const particle = game.particles[0];
  game.particles = [particle];
  game.secondaryParticles = [];
  Object.assign(particle, { cycles: 0, maxCycles: 1, yScalar: 0.5 });
  game.ship.engineVolume = 0.4;
  game.ship.angle = 27;
  game.random.state = 0x12345678;
  const expected = new SeededRandom(0x12345678);
  const xVelocity = (expected.integer(30) / 10 - 1.4) * 0.4;
  const yVelocity = expected.integer(2) + 0.8;
  const maxCycles = (expected.integer(80) + 1) * 0.4;

  game.updateParticles(1, true, false);

  assert.deepEqual(
    { xVelocity: particle.xVelocity, yVelocity: particle.yVelocity, maxCycles: particle.maxCycles, angle: particle.angle },
    { xVelocity, yVelocity, maxCycles, angle: 27 }
  );
  assert.equal(game.random.state, expected.state);
});

test("radio off, static, proximity, and turned-off behavior match source", () => {
  const game = new Game({ seed: 8 });
  game.state = "playing";
  const artifact = game.artifacts[0];
  artifact.frequency = 50;
  artifact.x = game.ship.x + 100;
  artifact.y = game.ship.y;
  for (const other of game.artifacts.slice(1)) other.frequency = 200;

  game.radioOffset = 50;
  game.updateRadio();
  assert.equal(game.radio.activeArtifact, artifact);
  assert.equal(game.radio.staticVolume, 0);
  assert.equal(artifact.visibleOnMap, true);

  artifact.turnedOff = true;
  game.updateRadio();
  assert.equal(game.radio.showSonar, false);
  assert.equal(game.radio.staticVolume, 0.75);
  assert.equal(game.radio.activeArtifact, artifact);

  game.radioOffset = 0;
  game.updateRadio();
  assert.equal(game.radio.staticVolume, 0);
  assert.equal(game.radio.showSonar, false);
  assert.equal(game.radio.activeArtifact, null);
});

test("artifact update and draw gates preserve the source rectangle and radius", () => {
  const game = new Game({ seed: 9 });
  game.state = "playing";
  const [inside, xEdge, yEdge] = game.artifacts;
  Object.assign(inside, { x: game.ship.x + 959, y: game.ship.y + 719, rotation: 10 });
  Object.assign(xEdge, { x: game.ship.x + 960, y: game.ship.y, rotation: 20 });
  Object.assign(yEdge, { x: game.ship.x, y: game.ship.y + 720, rotation: 30 });

  game.updateArtifacts(1);

  assert.equal(inside.shouldDraw, true);
  assert.ok(Math.abs(inside.rotation - 9.985) < 1e-12);
  assert.equal(xEdge.shouldDraw, false);
  assert.equal(xEdge.rotation, 20);
  assert.equal(yEdge.shouldDraw, false);
  assert.equal(yEdge.rotation, 30);
  assert.ok(Math.hypot(inside.x - game.ship.x, inside.y - game.ship.y) > PHYSICS.artifactDrawDistance);
  assert.ok(Math.hypot(xEdge.x - game.ship.x, xEdge.y - game.ship.y) === PHYSICS.artifactDrawDistance);
});

test("minimap maps world coordinates and blinks the ship on the source cadence", () => {
  const game = new Game({ seed: 10 });
  assert.deepEqual(game.mapToMinimap(0, 0), { x: 0, y: 0 });
  assert.deepEqual(game.mapToMinimap(10_000, 5_000), { x: 50, y: 25 });
  assert.deepEqual(game.mapToMinimap(19_999, 12_345), { x: 100, y: 61.73 });
  assert.deepEqual(game.mapToMinimap(-1, -12_345), { x: -0.01, y: -61.73 });

  for (let frame = 0; frame < 60; frame += 1) game.updateMinimap(1);
  assert.equal(game.minimap.showShip, true);
  assert.equal(game.minimap.cycle, 60);
  game.updateMinimap(1);
  assert.equal(game.minimap.showShip, false);
  assert.equal(game.minimap.cycle, 0);
});

test("story inventory and cue gates match the original 61-entry script", () => {
  assert.equal(STORY.length, 61);
  assert.deepEqual(STORY[0], { text: "It's all gone; it must be.", paused: true });
  assert.deepEqual(STORY[60], { text: "( turn the radio off with ' , ' )", paused: false });
  assert.deepEqual([...RADIO_CUES], [8, 15, 20, 23, 27, 31, 34, 38, 43, 49, 55]);
  assert.deepEqual([...ARTIFACT_CUES], [12, 18, 22, 25, 29, 33, 37, 41, 46, 52, 57]);
});

test("story debounce, radio startup gate, and paused controls follow source order", () => {
  const game = new Game({ seed: 13 });
  game.state = "playing";
  game.startStory();
  game.ship.angle = 10;

  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, advance: true, left: true, thrust: true, tuneUp: true });
  assert.equal(game.story.index, 0);
  assert.ok(Math.abs(game.ship.angle - 10.1) < 1e-12);
  assert.equal(game.radioOffset, 0);

  game.elapsed = 2;
  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, advance: true });
  assert.equal(game.story.index, 1);

  Object.assign(game.story, { index: 3, text: STORY[3].text, paused: true, lastAdvanceAt: 0 });
  game.elapsed = 3;
  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, tuneUp: true });
  assert.equal(game.story.index, 4);
  assert.equal(game.radioOffset, 0.5);
});

test("close tuned radio cues advance story and begin source orbit motion", () => {
  const audio = recordingAudio();
  const game = new Game({ seed: 14, audio });
  game.state = "playing";
  game.startStory();
  Object.assign(game.story, { index: 8, text: STORY[8].text, paused: false, lastAdvanceAt: 0 });
  game.elapsed = 2;
  game.ship.x = 10_000;
  game.ship.y = 10_000;
  game.ship.vx = 3;
  game.ship.vy = 0;
  const target = game.artifacts[0];
  Object.assign(target, { frequency: 50, x: 10_160, y: 10_000 });
  for (const artifact of game.artifacts.slice(1)) artifact.frequency = 200;
  game.radioOffset = 50;

  game.updateRadio();
  assert.equal(game.radio.activeArtifact, target);
  assert.equal(game.story.index, 9);
  assert.equal(game.story.paused, true);
  assert.ok(audio.events.some((event) => event.type === "play" && event.name === "engineOff"));

  game.updateShipMotion(1, EMPTY_INPUT);
  assert.ok(Math.abs(game.ship.vx - 2.73) < 1e-12);
  assert.ok(Math.abs(game.ship.vy - 0.03) < 1e-12);
  assert.ok(Math.abs(game.ship.angle - (Math.atan2(0.03, 2.73) * 180 / Math.PI + 90)) < 1e-12);
});

test("artifact shutdown is update-gated, flickers, greys out, and advances its story cue", () => {
  const audio = recordingAudio();
  const game = new Game({ seed: 15, audio });
  game.state = "playing";
  game.startStory();
  Object.assign(game.story, { index: 12, text: STORY[12].text, paused: true, lastAdvanceAt: -2 });
  const target = game.artifacts[0];
  Object.assign(target, {
    x: game.ship.x + 100,
    y: game.ship.y,
    frequency: 50,
    shutdownFrames: 3,
    shutdownRemaining: null
  });
  for (const artifact of game.artifacts.slice(1)) artifact.frequency = 200;
  game.radioOffset = 50;
  game.radio.activeArtifact = target;

  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, advance: true });
  assert.equal(target.found, true);
  assert.equal(target.shutdownRemaining, 2);
  assert.equal(audio.events.filter((event) => event.type === "play" && event.name === "found").length, 1);

  advance(game, 2);
  assert.equal(target.turnedOff, true);
  assert.equal(target.shutdownRemaining, 0);
  assert.equal(target.flickerDraw, true);
  assert.match(target.color, /^#([0-9a-e]{2})\1\1ff$/);
  assert.match(target.towerColor, /^#([0-9a-e]{2})\1\1ff$/);
  assert.equal(game.story.index, 13);
  assert.equal(audio.events.filter((event) => event.type === "play" && event.name === "engineOff").length, 1);

  const gated = game.artifacts[1];
  Object.assign(gated, {
    found: true,
    turnedOff: false,
    shutdownFrames: 20,
    shutdownRemaining: 15,
    flickerDraw: true,
    x: game.ship.x + PHYSICS.artifactDrawDistance,
    y: game.ship.y
  });
  game.updateArtifacts(1);
  assert.equal(gated.shutdownRemaining, 15);
  gated.x = game.ship.x;
  game.updateArtifacts(1);
  assert.equal(gated.shutdownRemaining, 14);
  assert.equal(gated.flickerDraw, false);
});

test("the final radio-off story gate hands off to the pending fade-out state", () => {
  const game = new Game({ seed: 16 });
  game.state = "playing";
  game.startStory();
  Object.assign(game.story, {
    index: STORY.length - 1,
    text: STORY.at(-1).text,
    paused: false,
    lastAdvanceAt: -2
  });
  game.radioOffset = 0.5;

  game.update(FIXED_STEP_SECONDS, { ...EMPTY_INPUT, tuneDown: true });

  assert.equal(game.radioOffset, 0);
  assert.equal(game.story.ending, true);
  assert.equal(game.story.text, "");
  assert.equal(game.state, "fadeOut");
  assert.ok(Math.abs(game.finale.opacity - 0.5 / 255) < 1e-12);
});

test("finale preserves source fade, delay, audio, flyby, and blackout timing", () => {
  const audio = recordingAudio();
  const game = new Game({ seed: 22, audio });
  game.state = "fadeOut";
  game.story.started = true;
  game.story.paused = false;

  advance(game, 510);
  assert.equal(game.state, "fadeOut");
  assert.equal(game.finale.opacity, 1);
  assert.equal(audio.events.some((event) => event.type === "play" && event.name === "finale"), false);

  advance(game, 1);
  assert.equal(game.state, "finalePause");
  assert.equal(game.story.paused, true);
  assert.equal(game.finale.revealAt, game.finale.startedAt + PHYSICS.finaleRevealDelaySeconds);
  assert.equal(game.finale.blackAt, game.finale.startedAt + PHYSICS.finaleBlackDelaySeconds);
  assert.equal(audio.events.filter((event) => event.type === "play" && event.name === "finale").length, 1);

  advance(game, 1_499);
  assert.equal(game.state, "finalePause");
  advance(game, 1);
  assert.equal(game.state, "finale");
  assert.equal(game.finale.opacity, 1);

  const primary = game.particles[0];
  const secondary = game.secondaryParticles[0];
  game.particles = [primary];
  game.secondaryParticles = [secondary];
  Object.assign(primary, { cycles: 0, maxCycles: 1, yScalar: 0.2 });
  Object.assign(secondary, { cycles: 0, maxCycles: 1, yScalar: 0.2 });
  game.ship.angle = 10;
  game.ship.vx = 0;
  game.ship.vy = 0;
  advance(game, 1);
  assert.equal(primary.yScalar, 1);
  assert.equal(secondary.yScalar, 1);
  assert.equal(primary.angle, 10);
  assert.equal(secondary.angle, 10);
  assert.equal(game.ship.angle, 52);
  assert.ok(Math.abs(game.ship.vx - 0.03 * Math.sin(52 * Math.PI / 180)) < 1e-12);
  assert.ok(Math.abs(game.ship.vy + 0.03 * Math.cos(52 * Math.PI / 180)) < 1e-12);
  assert.ok(Math.abs(game.finale.opacity - (1 - 0.3 / 255)) < 1e-12);

  advance(game, 849);
  assert.ok(game.finale.opacity < 1e-12);
  assert.equal(game.state, "finale");
  game.finale.opacity = 0;
  game.elapsed = game.finale.blackAt;
  game.updateFinaleState(1);
  assert.equal(game.state, "finale");
  game.elapsed += 1 / 60;
  game.updateFinaleState(1);
  assert.equal(game.state, "ended");
  assert.equal(game.finale.opacity, 1);
  assert.equal(audio.events.filter((event) => event.type === "play" && event.name === "finale").length, 1);
});

test("browser finale deadlines use an injected monotonic wall clock", () => {
  let now = 100;
  const game = new Game({ seed: 25, now: () => now });
  game.state = "fadeOut";
  game.finale.opacity = 1;
  game.updateFinaleState(1);
  assert.equal(game.state, "finalePause");
  assert.equal(game.finale.revealAt, 125);
  assert.equal(game.finale.blackAt, 173);

  game.elapsed = 10_000;
  game.updateFinaleState(1);
  assert.equal(game.state, "finalePause");
  now = 125;
  game.updateFinaleState(1);
  assert.equal(game.state, "finale");
  game.finale.opacity = 0;
  now = 173;
  game.updateFinaleState(1);
  assert.equal(game.state, "finale");
  now = 173.001;
  game.updateFinaleState(1);
  assert.equal(game.state, "ended");
});

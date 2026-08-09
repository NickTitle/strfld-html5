import assert from "node:assert/strict";
import test from "node:test";

import { FIXED_STEP_SECONDS } from "../src/constants.js";
import { Game, PHYSICS } from "../src/game.js";
import { EMPTY_INPUT } from "../src/input.js";

function advance(game, frames, input = EMPTY_INPUT) {
  for (let frame = 0; frame < frames; frame += 1) {
    game.update(FIXED_STEP_SECONDS, input);
  }
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
  assert.equal(PHYSICS.starCount, 150);
  assert.equal(PHYSICS.artifactCount, 11);
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

  game.update(FIXED_STEP_SECONDS, EMPTY_INPUT);
  assert.deepEqual({ x: game.ship.x, y: game.ship.y }, start);
  assert.deepEqual({ x: star.x, y: star.y }, starStart);
  assert.notEqual(game.ship.vx, 0);
  assert.notEqual(game.ship.vy, 0);

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
});

test("radio off, static, proximity, and turned-off behavior match source", () => {
  const game = new Game({ seed: 8 });
  game.state = "playing";
  const artifact = game.artifacts[0];
  artifact.frequency = 50;
  artifact.x = game.ship.x + 100;
  artifact.y = game.ship.y;

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

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
  assert.equal(PHYSICS.starCount, 150);
  assert.ok(game.ship.x >= 10_000 && game.ship.x < 10_100);
  assert.ok(game.ship.y >= 10_000 && game.ship.y < 10_100);
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

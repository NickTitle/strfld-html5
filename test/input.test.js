import assert from "node:assert/strict";
import test from "node:test";

import { FIXED_STEP_SECONDS } from "../src/constants.js";
import { Game } from "../src/game.js";
import { KeyboardInput } from "../src/input.js";
import { STORY } from "../src/story.js";

function fakeTarget() {
  const handlers = new Map();
  return {
    addEventListener(type, handler) { handlers.set(type, handler); },
    dispatch(type, code) {
      handlers.get(type)?.({ code, preventDefault() {} });
    }
  };
}

test("keyboard snapshots preserve held Space after its press edge is consumed", () => {
  const target = fakeTarget();
  const input = new KeyboardInput(target);

  target.dispatch("keydown", "Space");
  assert.deepEqual(input.snapshot(), {
    left: false,
    right: false,
    thrust: false,
    tuneDown: false,
    tuneUp: false,
    advance: true,
    advanceHeld: true
  });
  assert.deepEqual(input.snapshot(), {
    left: false,
    right: false,
    thrust: false,
    tuneDown: false,
    tuneUp: false,
    advance: false,
    advanceHeld: true
  });

  target.dispatch("keyup", "Space");
  assert.equal(input.snapshot().advanceHeld, false);
});

test("held Space crosses ordinary and artifact story debounce gates", () => {
  const target = fakeTarget();
  const input = new KeyboardInput(target);
  const game = new Game({ seed: 18 });
  game.state = "playing";
  game.startStory();
  game.elapsed = 0.9;

  target.dispatch("keydown", "Space");
  game.update(FIXED_STEP_SECONDS, input.snapshot());
  assert.equal(game.story.index, 0);
  for (let frame = 0; frame < 5; frame += 1) game.update(FIXED_STEP_SECONDS, input.snapshot());
  assert.equal(game.story.index, 1);
  for (let frame = 0; frame < 60; frame += 1) game.update(FIXED_STEP_SECONDS, input.snapshot());
  assert.equal(game.story.index, 2);

  const artifact = game.artifacts[0];
  Object.assign(artifact, {
    x: game.ship.x + 100,
    y: game.ship.y,
    frequency: 50,
    shutdownFrames: 200,
    shutdownRemaining: null
  });
  for (const other of game.artifacts.slice(1)) other.frequency = 200;
  Object.assign(game.story, {
    index: 12,
    text: STORY[12].text,
    paused: true,
    lastAdvanceAt: game.elapsed
  });
  game.radioOffset = 50;
  game.radio.activeArtifact = artifact;
  game.elapsed += 0.9;

  game.update(FIXED_STEP_SECONDS, input.snapshot());
  assert.equal(artifact.found, false);
  for (let frame = 0; frame < 5; frame += 1) game.update(FIXED_STEP_SECONDS, input.snapshot());
  assert.equal(artifact.found, true);
  assert.equal(artifact.shutdownRemaining, 199);
});

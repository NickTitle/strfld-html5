import assert from "node:assert/strict";
import test from "node:test";

import { FIXED_STEP_SECONDS } from "../src/constants.js";
import { Game } from "../src/game.js";
import { KeyboardInput, supportsTouchControls } from "../src/input.js";
import { STORY } from "../src/story.js";

function fakeTarget() {
  const handlers = new Map();
  return {
    addEventListener(type, handler) {
      const listeners = handlers.get(type) ?? [];
      listeners.push(handler);
      handlers.set(type, listeners);
    },
    dispatch(type, details = {}) {
      const event = typeof details === "string" ? { code: details } : details;
      for (const handler of handlers.get(type) ?? []) {
        handler({ preventDefault() {}, ...event });
      }
    }
  };
}

function fakeControls(actions) {
  const buttons = actions.map((action) => {
    const target = fakeTarget();
    return {
      dataset: { control: action },
      addEventListener: target.addEventListener,
      dispatch: target.dispatch,
      setPointerCapture() {}
    };
  });
  return {
    querySelectorAll() { return buttons; },
    button(action) { return buttons.find((button) => button.dataset.control === action); }
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

test("touch controls expose the six PICO-8 actions with held and edge semantics", () => {
  const target = fakeTarget();
  const actions = ["left", "right", "thrust", "advance", "tuneUp", "tuneDown"];
  const controls = fakeControls(actions);
  const input = new KeyboardInput(target, controls);

  actions.forEach((action, index) => {
    controls.button(action).dispatch("pointerdown", { pointerId: index + 1, pointerType: "touch" });
  });
  assert.deepEqual(input.snapshot(), {
    left: true,
    right: true,
    thrust: true,
    tuneDown: true,
    tuneUp: true,
    advance: true,
    advanceHeld: true
  });
  assert.equal(input.snapshot().advance, false);
  assert.equal(input.snapshot().advanceHeld, true);

  actions.forEach((action, index) => {
    controls.button(action).dispatch("pointerup", { pointerId: index + 1 });
  });
  assert.deepEqual(input.snapshot(), {
    left: false,
    right: false,
    thrust: false,
    tuneDown: false,
    tuneUp: false,
    advance: false,
    advanceHeld: false
  });
});

test("touch cancellation and keyboard overlap cannot leave a stuck input", () => {
  const target = fakeTarget();
  const controls = fakeControls(["left", "thrust"]);
  const input = new KeyboardInput(target, controls);

  target.dispatch("keydown", "ArrowLeft");
  controls.button("left").dispatch("pointerdown", { pointerId: 1, pointerType: "touch" });
  controls.button("thrust").dispatch("pointerdown", { pointerId: 2, pointerType: "touch" });
  controls.button("left").dispatch("pointercancel", { pointerId: 1 });
  assert.equal(input.snapshot().left, true);
  assert.equal(input.snapshot().thrust, true);

  target.dispatch("keyup", "ArrowLeft");
  target.dispatch("pointercancel", { pointerId: 2 });
  assert.equal(input.snapshot().left, false);
  assert.equal(input.snapshot().thrust, false);

  controls.button("left").dispatch("pointerdown", { pointerId: 3, pointerType: "touch" });
  target.dispatch("blur");
  assert.equal(input.snapshot().left, false);
});

test("touch controls are enabled only for coarse pointers or touch-capable devices", () => {
  assert.equal(supportsTouchControls({ maxTouchPoints: 0, matchMedia: () => ({ matches: false }) }), false);
  assert.equal(supportsTouchControls({ maxTouchPoints: 1, matchMedia: () => ({ matches: false }) }), true);
  assert.equal(supportsTouchControls({ maxTouchPoints: 0, matchMedia: () => ({ matches: true }) }), true);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  configureControlMode,
  KEYBOARD_INSTRUCTIONS,
  TOUCH_INSTRUCTIONS
} from "../src/control-mode.js";

function fixture() {
  const toggles = [];
  return {
    controls: { hidden: null },
    instructions: { textContent: "stale" },
    root: { classList: { toggle: (...args) => toggles.push(args) } },
    toggles
  };
}

test("the shared control-mode decision configures keyboard controls and copy", () => {
  const { root, controls, instructions, toggles } = fixture();
  const activeControls = configureControlMode({
    root,
    controls,
    instructions,
    touchCapable: false
  });

  assert.equal(activeControls, null);
  assert.equal(controls.hidden, true);
  assert.equal(instructions.textContent, KEYBOARD_INSTRUCTIONS);
  assert.deepEqual(toggles, [["touch-controls-enabled", false]]);
});

test("the shared control-mode decision configures touch controls and exact virtual-button copy", () => {
  const { root, controls, instructions, toggles } = fixture();
  const activeControls = configureControlMode({
    root,
    controls,
    instructions,
    touchCapable: true
  });

  assert.equal(activeControls, controls);
  assert.equal(controls.hidden, false);
  assert.equal(instructions.textContent, TOUCH_INSTRUCTIONS);
  assert.equal(instructions.textContent, "◀/▶ rotate, ▲ thrust, ▼ advance/interact, O tune up, X tune down.");
  assert.deepEqual(toggles, [["touch-controls-enabled", true]]);
});

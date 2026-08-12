export const KEYBOARD_INSTRUCTIONS =
  "Arrow keys steer and thrust. Comma and period tune the radio. Space advances the story.";

export const TOUCH_INSTRUCTIONS =
  "◀/▶ rotate, ▲ thrust, ▼ advance/interact, O tune up, X tune down.";

export function configureControlMode({ root, controls, instructions, touchCapable }) {
  root?.classList.toggle("touch-controls-enabled", touchCapable);
  if (controls) controls.hidden = !touchCapable;
  if (instructions) {
    instructions.textContent = touchCapable ? TOUCH_INSTRUCTIONS : KEYBOARD_INSTRUCTIONS;
  }
  return touchCapable ? controls : null;
}

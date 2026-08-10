const KEYBOARD_ACTIONS = new Map([
  ["ArrowLeft", "left"],
  ["ArrowRight", "right"],
  ["ArrowUp", "thrust"],
  ["Comma", "tuneDown"],
  ["Period", "tuneUp"],
  ["Space", "advance"]
]);

const TOUCH_ACTIONS = new Set([
  "left",
  "right",
  "thrust",
  "tuneDown",
  "tuneUp",
  "advance"
]);

export function supportsTouchControls({ matchMedia, maxTouchPoints } = {}) {
  const media = matchMedia ?? globalThis.matchMedia;
  const touches = maxTouchPoints ?? globalThis.navigator?.maxTouchPoints ?? 0;
  return touches > 0 || Boolean(media?.("(pointer: coarse)").matches);
}

export class KeyboardInput {
  constructor(target = window, controls = null) {
    this.keyboardDown = new Set();
    this.keyboardPressed = new Set();
    this.pointerActions = new Map();
    this.pointerPressed = new Set();

    target.addEventListener("keydown", (event) => {
      const action = KEYBOARD_ACTIONS.get(event.code);
      if (!action) return;
      event.preventDefault();
      if (!this.keyboardDown.has(action)) this.keyboardPressed.add(action);
      this.keyboardDown.add(action);
    });

    target.addEventListener("keyup", (event) => {
      const action = KEYBOARD_ACTIONS.get(event.code);
      if (!action) return;
      event.preventDefault();
      this.keyboardDown.delete(action);
    });

    target.addEventListener("blur", () => {
      this.clear();
    });

    target.addEventListener("pointerup", (event) => this.releasePointer(event.pointerId));
    target.addEventListener("pointercancel", (event) => this.releasePointer(event.pointerId));

    if (controls) this.bindTouchControls(controls);
  }

  bindTouchControls(controls) {
    for (const button of controls.querySelectorAll("[data-control]")) {
      const action = button.dataset.control;
      if (!TOUCH_ACTIONS.has(action)) continue;

      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        if (![...this.pointerActions.values()].includes(action)) {
          this.pointerPressed.add(action);
        }
        this.pointerActions.set(event.pointerId, action);
        button.setPointerCapture?.(event.pointerId);
      });

      const release = (event) => {
        event.preventDefault();
        this.releasePointer(event.pointerId);
      };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    }
  }

  releasePointer(pointerId) {
    this.pointerActions.delete(pointerId);
  }

  clear() {
    this.keyboardDown.clear();
    this.keyboardPressed.clear();
    this.pointerActions.clear();
    this.pointerPressed.clear();
  }

  isDown(action) {
    return this.keyboardDown.has(action) || [...this.pointerActions.values()].includes(action);
  }

  snapshot() {
    const state = Object.freeze({
      left: this.isDown("left"),
      right: this.isDown("right"),
      thrust: this.isDown("thrust"),
      tuneDown: this.isDown("tuneDown"),
      tuneUp: this.isDown("tuneUp"),
      advance: this.keyboardPressed.has("advance") || this.pointerPressed.has("advance"),
      advanceHeld: this.isDown("advance")
    });
    this.keyboardPressed.clear();
    this.pointerPressed.clear();
    return state;
  }
}

export const EMPTY_INPUT = Object.freeze({
  left: false,
  right: false,
  thrust: false,
  tuneDown: false,
  tuneUp: false,
  advance: false,
  advanceHeld: false
});

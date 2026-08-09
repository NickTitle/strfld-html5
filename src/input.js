const CONTROL_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Comma",
  "Period",
  "Space"
]);

export class KeyboardInput {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();

    target.addEventListener("keydown", (event) => {
      if (!CONTROL_CODES.has(event.code)) return;
      event.preventDefault();
      if (!this.down.has(event.code)) this.pressed.add(event.code);
      this.down.add(event.code);
    });

    target.addEventListener("keyup", (event) => {
      if (!CONTROL_CODES.has(event.code)) return;
      event.preventDefault();
      this.down.delete(event.code);
    });

    target.addEventListener("blur", () => {
      this.down.clear();
      this.pressed.clear();
    });
  }

  snapshot() {
    const state = Object.freeze({
      left: this.down.has("ArrowLeft"),
      right: this.down.has("ArrowRight"),
      thrust: this.down.has("ArrowUp"),
      tuneDown: this.down.has("Comma"),
      tuneUp: this.down.has("Period"),
      advance: this.pressed.has("Space")
    });
    this.pressed.clear();
    return state;
  }
}

export const EMPTY_INPUT = Object.freeze({
  left: false,
  right: false,
  thrust: false,
  tuneDown: false,
  tuneUp: false,
  advance: false
});

import { AudioController } from "./audio.js";
import { FIXED_STEP_SECONDS } from "./constants.js";
import { Game } from "./game.js";
import { KeyboardInput, supportsTouchControls } from "./input.js";
import { CanvasRenderer } from "./renderer.js";

export function startGame({ canvas, controls = null, requestFrame = requestAnimationFrame } = {}) {
  const audio = new AudioController();
  const game = new Game({ audio, now: () => performance.now() / 1000 });
  const input = new KeyboardInput(window, controls);
  const renderer = new CanvasRenderer(canvas);
  let previousTime = performance.now();
  let accumulator = 0;

  const unlockAudio = () => audio.unlock();
  canvas.addEventListener("pointerdown", unlockAudio, { once: true });
  controls?.addEventListener("pointerdown", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
  canvas.focus();

  function frame(time) {
    accumulator += Math.min((time - previousTime) / 1000, 0.25);
    previousTime = time;

    while (accumulator >= FIXED_STEP_SECONDS) {
      game.update(FIXED_STEP_SECONDS, input.snapshot());
      accumulator -= FIXED_STEP_SECONDS;
    }

    renderer.draw(game);
    requestFrame(frame);
  }

  requestFrame(frame);
  return game;
}

const canvas = document.querySelector("#game");
const controls = document.querySelector("#touch-controls");
const touchCapable = supportsTouchControls();
document.documentElement.classList.toggle("touch-controls-enabled", touchCapable);
if (controls) controls.hidden = !touchCapable;
if (canvas) startGame({ canvas, controls: touchCapable ? controls : null });

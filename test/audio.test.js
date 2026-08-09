import assert from "node:assert/strict";
import test from "node:test";

import { AudioController } from "../src/audio.js";

function fakeAudio(url) {
  return {
    url,
    loop: false,
    paused: true,
    currentTime: 12,
    volume: 1,
    playCalls: 0,
    play() {
      this.paused = false;
      this.playCalls += 1;
      return Promise.resolve();
    }
  };
}

test("audio resources are created only after a browser unlock gesture", () => {
  const created = [];
  const audio = new AudioController((url) => {
    const sound = fakeAudio(url);
    created.push(sound);
    return sound;
  });

  audio.setLoopVolume("engine", 1);
  assert.equal(created.length, 0);

  audio.unlock();
  audio.unlock();
  assert.equal(created.length, 3);
  assert.equal(created.find((sound) => sound.url.endsWith("engine3.mp3")).loop, true);
});

test("loop volume clamps and one-shots restart from the beginning", () => {
  const sounds = new Map();
  const audio = new AudioController((url) => {
    const sound = fakeAudio(url);
    sounds.set(url, sound);
    return sound;
  });
  audio.unlock();

  audio.setLoopVolume("engine", 2);
  const engine = sounds.get("./assets/sfx/engine3.mp3");
  assert.equal(engine.volume, 1);
  assert.equal(engine.playCalls, 1);

  audio.play("power");
  const power = sounds.get("./assets/sfx/button.mp3");
  assert.equal(power.currentTime, 0);
  assert.equal(power.playCalls, 1);
});

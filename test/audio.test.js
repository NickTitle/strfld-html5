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
  assert.equal(created.length, 17);
  assert.equal(created.find((sound) => sound.url.endsWith("engine3.mp3")).loop, true);
  assert.deepEqual(
    created.filter((sound) => sound.url.includes("/songs/")).map((sound) => sound.url.split("/").at(-1)),
    ["game_end.mp3", "2.mp3", "3.mp3", "4.mp3", "5.mp3", "6.mp3", "7.mp3", "8.mp3", "9.mp3", "10.mp3", "1.mp3", "2.mp3"]
  );
  assert.equal(created.filter((sound) => sound.loop).length, 13);
  assert.ok(created.filter((sound) => sound.loop).every((sound) => sound.playCalls === 1));
  assert.equal(created.find((sound) => sound.url.endsWith("button.mp3")).playCalls, 0);
  assert.equal(created.find((sound) => sound.url.endsWith("found_planet.mp3")).playCalls, 0);
  assert.equal(created.find((sound) => sound.url.endsWith("engine_turn_off.mp3")).playCalls, 0);
  assert.equal(created.find((sound) => sound.url.endsWith("game_end.mp3")).playCalls, 0);
  assert.notEqual(audio.sounds.get("broadcast1"), audio.sounds.get("broadcast11"));
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

  audio.play("finale");
  const finale = sounds.get("./assets/songs/game_end.mp3");
  assert.equal(finale.currentTime, 0);
  assert.equal(finale.playCalls, 1);
});

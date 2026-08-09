import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { STORY } from "../src/story.js";

const expectedStory = JSON.parse(readFileSync(new URL("./fixtures/story.json", import.meta.url)));

test("every story text and pause flag matches the source fixture", () => {
  assert.deepEqual(STORY.map(({ text, paused }) => [text, paused]), expectedStory);
});

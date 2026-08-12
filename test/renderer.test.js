import assert from "node:assert/strict";
import test from "node:test";

import { COLORS } from "../src/constants.js";
import { Game } from "../src/game.js";
import { SeededRandom } from "../src/random.js";
import { CanvasRenderer, layoutStoryHud } from "../src/renderer.js";
import { STORY } from "../src/story.js";

function recordingContext() {
  const operations = [];
  return {
    operations,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    imageSmoothingEnabled: true,
    save() { operations.push({ type: "save" }); },
    restore() { operations.push({ type: "restore" }); },
    translate(x, y) { operations.push({ type: "translate", x, y }); },
    rotate(angle) { operations.push({ type: "rotate", angle }); },
    beginPath() {},
    moveTo(x, y) { operations.push({ type: "moveTo", x, y }); },
    lineTo(x, y) { operations.push({ type: "lineTo", x, y }); },
    closePath() {},
    arc() {},
    stroke() {},
    font: "",
    measureText(text) {
      return {
        width: String(text).length * 10,
        actualBoundingBoxAscent: 12,
        actualBoundingBoxDescent: 4
      };
    },
    fillText(text, x, y) { operations.push({ type: "fillText", text, x, y, color: this.fillStyle }); },
    strokeRect() {},
    fill() {
      operations.push({ type: "fill", color: this.fillStyle });
    },
    fillRect(x, y, width, height) {
      operations.push({ type: "fillRect", color: this.fillStyle, x, y, width, height });
    }
  };
}

test("every story and paused prompt line stays inside the 640x480 display bounds", () => {
  const context = recordingContext();

  for (const story of STORY) {
    const layout = layoutStoryHud(context, story.text, story.paused);
    assert.ok(layout.lines.length >= 1, story.text);
    assert.equal(
      layout.lines.map((line) => line.text).join(" ").replaceAll(/\s+/g, " "),
      story.text.replaceAll(/\s+/g, " "),
      story.text
    );
    for (const line of layout.lines) {
      assert.ok(line.bounds.left >= 0, story.text);
      assert.ok(line.bounds.top >= 0, story.text);
      assert.ok(line.bounds.right <= 632, story.text);
      assert.ok(line.bounds.bottom <= 476, story.text);
    }
    if (layout.prompt) {
      assert.ok(layout.prompt.bounds.left >= 0, story.text);
      assert.ok(layout.prompt.bounds.top >= 0, story.text);
      assert.ok(layout.prompt.bounds.right <= 640, story.text);
      assert.ok(layout.prompt.bounds.bottom <= layout.panel.y - 4, story.text);
    }
  }
});

test("renderer preserves star, artifact, ship, star, HUD order and minimap offsets", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });
  const game = new Game({ seed: 11 });
  game.state = "playing";
  game.titleFade = 0;
  game.stars = [
    { x: 1, y: 1, z: 1, size: 1, rotation: 0, color: "shallow-star" },
    { x: 2, y: 2, z: 2, size: 1, rotation: 0, color: "deep-star" }
  ];
  game.ship.x = 10_000;
  game.ship.y = 10_000;
  game.minimap.showShip = true;
  game.radio.showSonar = true;
  game.sonar.bars = [{ x: 320, y: 250, width: 3, alpha: 128, angle: 10 }];
  game.particles = [{ x: 321, y: 247, size: 2, angle: 10, color: "particle-color" }];
  game.secondaryParticles = [{ x: 320, y: 245, size: 2, angle: 0, color: "secondary-particle" }];
  game.artifacts = [{
    x: 10_100,
    y: 10_000,
    size: 200,
    rotation: 0,
    color: "artifact-color",
    towerColor: "tower-color",
    flickerDraw: true,
    visibleOnMap: true
  }];

  renderer.draw(game);

  const indexOf = (color) => context.operations.findIndex((operation) => operation.color === color);
  assert.ok(indexOf("shallow-star") < indexOf("artifact-color"));
  const sonarColor = `rgba(99, 173, 208, ${Math.round(128) / 255})`;
  assert.ok(indexOf("artifact-color") < indexOf(sonarColor));
  assert.ok(indexOf(sonarColor) < indexOf("particle-color"));
  assert.ok(indexOf("particle-color") < indexOf(COLORS.shipOrange));
  assert.equal(indexOf("secondary-particle"), -1);
  assert.ok(indexOf(COLORS.shipOrange) < indexOf("deep-star"));
  assert.ok(indexOf("deep-star") < indexOf(COLORS.grillGrey));

  const shipMarker = context.operations.find((operation) =>
    operation.color === COLORS.white && operation.x === 62 && operation.y === 62
  );
  const artifactMarker = context.operations.find((operation) =>
    operation.color === "artifact-color" && operation.x === 60.5 && operation.y === 60
  );
  assert.deepEqual(shipMarker, {
    type: "fillRect", color: COLORS.white, x: 62, y: 62, width: 3, height: 3
  });
  assert.deepEqual(artifactMarker, {
    type: "fillRect", color: "artifact-color", x: 60.5, y: 60, width: 3, height: 3
  });
  assert.ok(context.operations.some((operation) =>
    operation.type === "fillRect"
      && operation.color === sonarColor
      && operation.x === -1.5
      && operation.y === 5
      && operation.width === 3
      && operation.height === 4
  ));
  assert.ok(context.operations.some((operation) =>
    operation.type === "fillRect"
      && operation.color === "particle-color"
      && operation.x === 0
      && operation.y === 1
      && operation.width === 2
      && operation.height === 2
  ));
});

test("artifact geometry preserves Ruby integer division for odd sizes", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });

  renderer.drawArtifact({
    x: 10_100,
    y: 10_000,
    size: 253,
    rotation: 0,
    color: "artifact-color",
    towerColor: "tower-color"
  }, { x: 10_000, y: 10_000 });

  assert.deepEqual(context.operations.slice(1, 3), [
    { type: "translate", x: 420, y: 240 },
    { type: "rotate", angle: 0 }
  ]);
  assert.deepEqual(
    context.operations.filter((operation) => operation.type === "moveTo").slice(0, 3),
    [
      { type: "moveTo", x: -126, y: -63 },
      { type: "moveTo", x: -63, y: -101 },
      { type: "moveTo", x: 64, y: -101 }
    ]
  );
  assert.ok(context.operations.some((operation) =>
    operation.type === "fillRect"
      && operation.color === COLORS.radioGrey
      && operation.x === -71
      && operation.y === -115
      && operation.width === 42
      && operation.height === 15
  ));
  assert.ok(context.operations.some((operation) =>
    operation.type === "fillRect"
      && operation.color === "tower-color"
      && operation.x === -43
      && operation.y === -112
      && operation.width === 7
      && operation.height === 12
  ));
});

test("renderer enforces strict artifact radius and flicker suppression", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });
  const game = new Game({ seed: 12 });
  game.state = "playing";
  game.titleFade = 0;
  game.stars = [];
  game.ship.x = 10_000;
  game.ship.y = 10_000;
  game.artifacts = [
    { x: 10_960, y: 10_000, size: 200, rotation: 0, color: "at-boundary", towerColor: "tower", flickerDraw: true, visibleOnMap: false },
    { x: 10_100, y: 10_000, size: 200, rotation: 0, color: "flicker-hidden", towerColor: "tower", flickerDraw: false, visibleOnMap: false },
    { x: 10_959.99, y: 10_000, size: 200, rotation: 0, color: "inside", towerColor: "tower", flickerDraw: true, visibleOnMap: false }
  ];

  renderer.draw(game);

  assert.equal(context.operations.some((operation) => operation.color === "at-boundary"), false);
  assert.equal(context.operations.some((operation) => operation.color === "flicker-hidden"), false);
  assert.equal(context.operations.some((operation) => operation.color === "inside"), true);
});

test("particle geometry preserves Ruby integer division for odd sizes", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });

  renderer.drawParticle({ x: 320, y: 245, size: 3, angle: 0, color: "particle" });

  assert.ok(context.operations.some((operation) =>
    operation.type === "fillRect"
      && operation.color === "particle"
      && operation.x === -1
      && operation.y === -1
      && operation.width === 2
      && operation.height === 2
  ));
});

test("radio preserves the source chassis, grill, octagonal controls, and dial rotations", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });

  renderer.drawRadio(137.5, 0.5);

  assert.ok(context.operations.some((operation) =>
    operation.type === "fillRect"
      && operation.color === COLORS.white
      && operation.x === 11
      && operation.y === 412
      && operation.width === 128
      && operation.height === 68
  ));
  assert.equal(context.operations.filter((operation) =>
    operation.type === "fillRect"
      && (operation.color === COLORS.radioGrey || operation.color === COLORS.darkGrey)
      && operation.width === 2
      && operation.height === 2
  ).length, 240);
  assert.ok(context.operations.some((operation) =>
    operation.type === "moveTo" && operation.x === 10 && operation.y === 413
  ));
  assert.ok(context.operations.some((operation) =>
    operation.type === "fill" && operation.color === `rgba(255, 255, 204, ${128 / 255})`
  ));
  assert.ok(context.operations.some((operation) =>
    operation.type === "rotate" && operation.angle === Math.PI / 2
  ));
  assert.ok(context.operations.some((operation) =>
    operation.type === "rotate" && operation.angle === Math.PI / 4
  ));
  assert.ok(context.operations.some((operation) =>
    operation.type === "rotate" && operation.angle === 2 * Math.PI
  ));
});

test("visible sonar consumes one shared-RNG spread sample per draw", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });
  const game = new Game({ seed: 20 });
  game.state = "playing";
  game.titleFade = 0;
  game.stars = [];
  game.artifacts = [];
  game.particles = [];
  game.radio.showSonar = true;
  game.sonar.bars = Array.from({ length: 10 }, () => ({
    x: 320,
    y: 250,
    width: 3,
    alpha: 128,
    angle: 15
  }));

  const expected = new SeededRandom(1);
  expected.state = game.random.state;
  for (let index = 0; index < 10; index += 1) expected.integer(60);
  renderer.draw(game);
  assert.equal(game.random.state, expected.state);

  for (let index = 0; index < 10; index += 1) expected.integer(60);
  renderer.draw(game);
  assert.equal(game.random.state, expected.state);
});

test("finale renders offset primary ship then offset secondary ship below deep stars", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });
  const game = new Game({ seed: 23 });
  game.state = "finale";
  game.finale.opacity = 0;
  game.radio.showSonar = false;
  game.artifacts = [];
  game.stars = [{ x: 2, y: 2, z: 2, size: 1, rotation: 0, color: "deep-star" }];
  game.particles = [{ x: 320, y: 245, size: 2, angle: 52, color: "primary-particle" }];
  game.secondaryParticles = [{ x: 320, y: 245, size: 2, angle: 52, color: "secondary-particle" }];
  game.ship.angle = 52;

  renderer.draw(game);

  const indexOf = (color) => context.operations.findIndex((operation) => operation.color === color);
  assert.ok(indexOf("primary-particle") < indexOf(COLORS.shipOrange));
  assert.ok(indexOf(COLORS.shipOrange) < indexOf("secondary-particle"));
  assert.ok(indexOf("secondary-particle") < indexOf(COLORS.shipPeach));
  assert.ok(indexOf(COLORS.shipPeach) < indexOf("deep-star"));
  assert.equal(indexOf(COLORS.grillGrey), -1);
  assert.ok(context.operations.some((operation) => operation.type === "translate" && operation.x === 25 && operation.y === 25));
  assert.ok(context.operations.some((operation) => operation.type === "translate" && operation.x === -25 && operation.y === -25));
  assert.ok(context.operations.some((operation) => operation.type === "moveTo" && operation.x === -6 && operation.y === -21));
  assert.ok(context.operations.some((operation) => operation.type === "moveTo" && operation.x === -5 && operation.y === -20));
  assert.ok(context.operations.some((operation) => operation.type === "moveTo" && operation.x === -0.25 && operation.y === -21));
});

test("finale overlay uses the source-rounded opacity and covers the HUD", () => {
  const context = recordingContext();
  const renderer = new CanvasRenderer({ getContext: () => context });
  const game = new Game({ seed: 24 });
  game.state = "finalePause";
  game.finale.opacity = 128.4 / 255;
  game.stars = [];
  game.artifacts = [];
  game.particles = [];
  game.secondaryParticles = [];
  game.radio.showSonar = false;

  renderer.draw(game);

  assert.deepEqual(context.operations.at(-1), {
    type: "fillRect",
    color: `rgba(0, 0, 0, ${128 / 255})`,
    x: 0,
    y: 0,
    width: 640,
    height: 480
  });
  assert.equal(context.operations.some((operation) => operation.color === COLORS.grillGrey), false);
});

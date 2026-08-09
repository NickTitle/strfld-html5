import assert from "node:assert/strict";
import test from "node:test";

import { COLORS } from "../src/constants.js";
import { Game } from "../src/game.js";
import { CanvasRenderer } from "../src/renderer.js";

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
    fillText() {},
    strokeRect() {},
    fill() {
      operations.push({ type: "fill", color: this.fillStyle });
    },
    fillRect(x, y, width, height) {
      operations.push({ type: "fillRect", color: this.fillStyle, x, y, width, height });
    }
  };
}

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
  assert.ok(indexOf("artifact-color") < indexOf(COLORS.shipOrange));
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

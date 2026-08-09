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
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
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

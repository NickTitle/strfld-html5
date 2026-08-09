import { COLORS, VIEW_HEIGHT, VIEW_WIDTH } from "./constants.js";

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.context.imageSmoothingEnabled = false;
  }

  draw(game) {
    const context = this.context;
    context.fillStyle = COLORS.space;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    for (const star of game.stars) {
      if (star.z <= 1.75) this.drawStar(star);
    }
    if (game.state === "playing") {
      for (const artifact of game.artifacts) {
        if (artifact.flickerDraw && Math.hypot(artifact.x - game.ship.x, artifact.y - game.ship.y) < VIEW_WIDTH * 1.5) {
          this.drawArtifact(artifact, game.ship);
        }
      }
    }
    this.drawShip(game.ship);
    for (const star of game.stars) {
      if (star.z > 1.75) this.drawStar(star);
    }

    if (game.state === "title") {
      context.fillStyle = COLORS.white;
      context.font = "80px 'Starfield Pixel', monospace";
      context.fillText("Starfield", 18, 115);
      if (game.titleFade === 0) {
        context.font = "18px 'Starfield Pixel', monospace";
        context.fillText("Press SPACE to begin", 225, 190);
      }
    } else {
      context.fillStyle = "rgba(255, 255, 255, 0.73)";
      context.fillRect(0, 460, VIEW_WIDTH, 20);
      context.fillStyle = COLORS.darkGrey;
      context.font = "18px 'Starfield Pixel', monospace";
      context.fillText("It's all gone; it must be.", 150, 478);
      this.drawMinimap(game);
      this.drawRadio(game.radioOffset);
    }

    if (game.titleFade > 0) {
      context.fillStyle = `rgba(0, 0, 0, ${game.titleFade})`;
      context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
  }

  drawStar(star) {
    const context = this.context;
    context.save();
    context.translate(star.x, star.y);
    context.rotate(star.rotation * Math.PI / 180);
    context.fillStyle = COLORS.starBorder;
    context.fillRect(-star.size / 2 - 1, -star.size / 2 - 1, star.size + 2, star.size + 2);
    context.fillStyle = star.color;
    context.fillRect(-star.size / 2, -star.size / 2, star.size, star.size);
    context.restore();
  }

  drawShip(ship) {
    const context = this.context;
    context.save();
    context.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 5);
    context.rotate(ship.angle * Math.PI / 180);
    context.fillStyle = COLORS.black;
    context.beginPath();
    context.moveTo(0, -25);
    context.lineTo(-16, 20);
    context.lineTo(0, 14);
    context.lineTo(16, 20);
    context.closePath();
    context.fill();
    context.fillStyle = COLORS.shipOrange;
    context.beginPath();
    context.moveTo(0, -22);
    context.lineTo(-13, 17);
    context.lineTo(0, 11);
    context.lineTo(13, 17);
    context.closePath();
    context.fill();
    context.fillStyle = COLORS.darkGrey;
    context.fillRect(-5, -18, 10, 5);
    context.fillStyle = COLORS.patchBrown;
    context.fillRect(-12, 2, 4, 4);
    context.fillStyle = COLORS.patchGreen;
    context.fillRect(9, 6, 4, 5);
    context.restore();
  }

  fillPolygon(points, color) {
    const context = this.context;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (const point of points.slice(1)) context.lineTo(point[0], point[1]);
    context.closePath();
    context.fill();
  }

  drawOctagon(x, y, size, color) {
    this.fillPolygon([
      [x, y + size / 4],
      [x + size / 4, y],
      [x + size * 3 / 4, y],
      [x + size, y + size / 4],
      [x + size, y + size * 3 / 4],
      [x + size * 3 / 4, y + size],
      [x + size / 4, y + size],
      [x, y + size * 3 / 4]
    ], color);
  }

  drawArtifact(artifact, ship) {
    const context = this.context;
    const size = artifact.size;
    const left = -size / 2;
    const top = -size / 2;
    context.save();
    context.translate(
      VIEW_WIDTH / 2 + artifact.x - ship.x,
      VIEW_HEIGHT / 2 + artifact.y - ship.y
    );
    context.rotate(artifact.rotation * Math.PI / 180);
    this.drawOctagon(left, top, size, artifact.color);

    const tower = artifact.towerColor;
    this.fillPolygon([
      [left + size / 4, top + size / 10],
      [left + size / 4 + size / 10, top + size / 10],
      [left + size / 2, top - size * 3 / 4]
    ], tower);
    this.fillPolygon([
      [left + size * 3 / 4, top + size / 10],
      [left + size * 3 / 4 - size / 10, top + size / 10],
      [left + size / 2, top - size * 3 / 4]
    ], tower);
    this.fillPolygon([
      [left + 0.34 * size, top - 0.12 * size],
      [left + 0.36 * size, top - 0.14 * size],
      [left + 0.6 * size, top - 0.21 * size],
      [left + 0.62 * size, top - 0.19 * size]
    ], tower);
    this.fillPolygon([
      [left + 0.34 * size, top - 0.21 * size],
      [left + 0.36 * size, top - 0.19 * size],
      [left + 0.62 * size, top - 0.12 * size],
      [left + 0.64 * size, top - 0.14 * size]
    ], tower);
    this.fillPolygon([
      [left + 0.38 * size, top - 0.32 * size],
      [left + 0.4 * size, top - 0.34 * size],
      [left + 0.58 * size, top - 0.38 * size],
      [left + 0.6 * size, top - 0.4 * size]
    ], tower);
    this.fillPolygon([
      [left + 0.41 * size, top - 0.38 * size],
      [left + 0.4 * size, top - 0.4 * size],
      [left + 0.59 * size, top - 0.32 * size],
      [left + 0.61 * size, top - 0.34 * size]
    ], tower);

    const houseX = left + size * 7 / 32;
    const houseY = top + size * 3 / 64;
    const houseWidth = size / 6;
    const houseHeight = size / 16;
    const roof = size / 32;
    context.fillStyle = COLORS.radioGrey;
    context.fillRect(houseX, houseY, houseWidth, houseHeight);
    this.fillPolygon([
      [houseX - roof, houseY],
      [houseX + houseWidth + roof, houseY],
      [houseX + houseWidth, houseY - roof * 1.5],
      [houseX, houseY - roof * 1.5]
    ], COLORS.darkGrey);
    context.fillStyle = tower;
    context.fillRect(houseX + houseWidth - 2 * roof, houseY + houseHeight / 4, roof, houseHeight * 3 / 4);
    context.fillStyle = COLORS.black;
    context.fillRect(houseX + roof, houseY + houseHeight / 4, roof, houseHeight / 4);
    this.drawOctagon(left + size / 2 - size / 10, top - size * 3 / 4 - size / 10, size / 5, artifact.color);
    context.restore();
  }

  drawMinimap(game) {
    const context = this.context;
    const offset = 10;
    const size = 100;
    const frame = 2;
    context.fillStyle = COLORS.grillGrey;
    context.fillRect(offset, offset, size + 2 * frame, size + 2 * frame);
    context.fillStyle = COLORS.black;
    context.fillRect(offset + frame, offset + frame, size, size);

    if (game.minimap.showShip) {
      const ship = game.mapToMinimap(game.ship.x, game.ship.y);
      context.fillStyle = COLORS.white;
      context.fillRect(offset + frame + ship.x, offset + frame + ship.y, 3, 3);
    }
    for (const artifact of game.artifacts) {
      if (!artifact.visibleOnMap) continue;
      const marker = game.mapToMinimap(artifact.x, artifact.y);
      context.fillStyle = artifact.color;
      context.fillRect(offset + marker.x, offset + marker.y, 3, 3);
    }
  }

  drawRadio(offset) {
    const context = this.context;
    context.fillStyle = COLORS.white;
    context.fillRect(10, 405, 130, 75);
    context.strokeStyle = COLORS.frameBlue;
    context.lineWidth = 4;
    context.strokeRect(12, 407, 126, 73);
    context.fillStyle = COLORS.darkGrey;
    context.beginPath();
    context.arc(105, 440, 20, Math.PI, 2 * Math.PI);
    context.fill();
    context.strokeStyle = COLORS.dialOrange;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(105, 440);
    const angle = Math.PI + offset / 275 * Math.PI;
    context.lineTo(105 + Math.cos(angle) * 17, 440 + Math.sin(angle) * 17);
    context.stroke();
  }
}

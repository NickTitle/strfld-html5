import { COLORS, VIEW_HEIGHT, VIEW_WIDTH } from "./constants.js";

function integerDivide(dividend, divisor) {
  return Math.trunc(dividend / divisor);
}

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
    if (game.state === "playing" || game.state === "fadeOut") {
      for (const artifact of game.artifacts) {
        if (artifact.flickerDraw && Math.hypot(artifact.x - game.ship.x, artifact.y - game.ship.y) < VIEW_WIDTH * 1.5) {
          this.drawArtifact(artifact, game.ship);
        }
      }
    }
    this.drawShipSystems(game);
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
      context.fillText(game.story.text, 150, 478);
      if (game.story.started && game.story.paused) {
        context.fillStyle = "rgba(255, 255, 255, 0.73)";
        context.fillRect(560, 440, 80, 20);
        context.fillStyle = COLORS.darkGrey;
        context.fillText("*SPACE*", 570, 458);
      }
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

  drawShipSystems(game) {
    if (game.radio.showSonar) {
      for (const bar of game.sonar.bars) this.drawSonarBar(bar);
    }
    for (const particle of game.particles) this.drawParticle(particle);
    this.drawShip(game.ship);
  }

  drawSonarBar(bar) {
    if (bar.alpha < 0.05) return;
    const context = this.context;
    context.save();
    context.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 5);
    context.rotate(bar.drawAngle * Math.PI / 180);
    context.fillStyle = `rgba(99, 173, 208, ${Math.round(bar.alpha) / 255})`;
    context.fillRect(
      bar.x - VIEW_WIDTH / 2 - bar.width / 2,
      bar.y - (VIEW_HEIGHT / 2 + 5),
      bar.width,
      4
    );
    context.restore();
  }

  drawParticle(particle) {
    const context = this.context;
    const halfSize = integerDivide(particle.size, 2);
    context.save();
    context.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 5);
    context.rotate(particle.angle * Math.PI / 180);
    context.fillStyle = particle.color;
    context.fillRect(
      particle.x - VIEW_WIDTH / 2 - halfSize,
      particle.y - (VIEW_HEIGHT / 2 + 5) - halfSize,
      halfSize * 2,
      halfSize * 2
    );
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
    const quarter = integerDivide(size, 4);
    const threeQuarters = integerDivide(size * 3, 4);
    this.fillPolygon([
      [x, y + quarter],
      [x + quarter, y],
      [x + threeQuarters, y],
      [x + size, y + quarter],
      [x + size, y + threeQuarters],
      [x + threeQuarters, y + size],
      [x + quarter, y + size],
      [x, y + threeQuarters]
    ], color);
  }

  drawArtifact(artifact, ship) {
    const context = this.context;
    const size = artifact.size;
    const half = integerDivide(size, 2);
    const quarter = integerDivide(size, 4);
    const tenth = integerDivide(size, 10);
    const threeQuarters = integerDivide(size * 3, 4);
    const left = -half;
    const top = -half;
    context.save();
    context.translate(
      VIEW_WIDTH / 2 + artifact.x - ship.x,
      VIEW_HEIGHT / 2 + artifact.y - ship.y
    );
    context.rotate(artifact.rotation * Math.PI / 180);
    this.drawOctagon(left, top, size, artifact.color);

    const tower = artifact.towerColor;
    this.fillPolygon([
      [left + quarter, top + tenth],
      [left + quarter + tenth, top + tenth],
      [left + half, top - threeQuarters]
    ], tower);
    this.fillPolygon([
      [left + size - quarter, top + tenth],
      [left + size - (quarter + tenth), top + tenth],
      [left + size - half, top - threeQuarters]
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

    const houseX = left + integerDivide(size * 7, 32);
    const houseY = top + integerDivide(size * 3, 64);
    const houseWidth = integerDivide(size, 6);
    const houseHeight = integerDivide(size, 16);
    const roof = integerDivide(size, 32);
    const roofHeight = integerDivide(roof * 3, 2);
    const houseQuarter = integerDivide(houseHeight, 4);
    const houseHalf = integerDivide(houseHeight, 2);
    context.fillStyle = COLORS.radioGrey;
    context.fillRect(houseX, houseY, houseWidth, houseHeight);
    this.fillPolygon([
      [houseX - roof, houseY],
      [houseX + houseWidth + roof, houseY],
      [houseX + houseWidth, houseY - roofHeight],
      [houseX, houseY - roofHeight]
    ], COLORS.darkGrey);
    context.fillStyle = tower;
    context.fillRect(
      houseX + houseWidth - 2 * roof,
      houseY + houseQuarter,
      roof,
      houseHeight - houseQuarter
    );
    context.fillStyle = COLORS.black;
    context.fillRect(houseX + roof, houseY + houseQuarter, roof, houseHalf - houseQuarter);
    this.drawOctagon(
      left + size - half - tenth,
      top - threeQuarters - tenth,
      integerDivide(size, 5),
      artifact.color
    );
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

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
    } else if (game.state === "playing" || game.state === "fadeOut") {
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
      this.drawRadio(game.radioOffset, game.radio.receptionVolume);
    }

    const fadeOpacity = game.state === "title" ? game.titleFade : game.finale.opacity;
    if (fadeOpacity > 0) {
      context.fillStyle = `rgba(0, 0, 0, ${Math.round(fadeOpacity * 255) / 255})`;
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
      for (const bar of game.sonar.bars) this.drawSonarBar(bar, game.random);
    }
    if (["finalePause", "finale", "ended"].includes(game.state)) {
      this.context.save();
      this.context.translate(25, 25);
      for (const particle of game.particles) this.drawParticle(particle);
      this.drawShip(game.ship);
      this.context.restore();

      this.context.save();
      this.context.translate(-25, -25);
      for (const particle of game.secondaryParticles) this.drawParticle(particle);
      this.drawSecondShip(game.ship);
      this.context.restore();
      return;
    }
    for (const particle of game.particles) this.drawParticle(particle);
    this.drawShip(game.ship);
  }

  drawSonarBar(bar, random) {
    if (bar.alpha < 0.05) return;
    const context = this.context;
    context.save();
    context.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 5);
    const drawAngle = bar.angle + random.integer(60) - 30 + 90;
    context.rotate(drawAngle * Math.PI / 180);
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
    this.fillPolygon([[-6, -21], [-14, -13], [-16, 5], [-5, 0]], COLORS.black);
    this.fillPolygon([[6, -21], [14, -13], [16, 5], [5, 0]], COLORS.black);
    this.fillPolygon([[-6, -21], [6, -21], [5, 0], [-5, 0]], COLORS.black);
    this.fillPolygon([[-6, -19], [-12, -12], [-14, 3], [-5, -2]], COLORS.shipOrange);
    this.fillPolygon([[-6, -19], [6, -19], [5, -2], [-5, -2]], COLORS.shipOrange);
    this.fillPolygon([[6, -19], [12, -12], [14, 3], [5, -2]], COLORS.shipOrange);
    this.fillPolygon([[-7, -19], [7, -19], [4, -14], [-4, -14]], COLORS.black);
    this.fillPolygon([[-6, -19], [6, -19], [4, -15], [-4, -15]], COLORS.darkGrey);
    this.fillPolygon([[-13, -11], [-8, -10], [-8, -5], [-15, -5]], COLORS.black);
    this.fillPolygon([[-12, -10], [-9, -9], [-9, -6], [-13, -6]], COLORS.patchBrown);
    this.fillPolygon([[14, -7], [11, -6], [11, -1], [15, 1]], COLORS.black);
    this.fillPolygon([[13, -6], [12, -5], [12, -2], [14, 0]], COLORS.patchGreen);
    context.restore();
  }

  drawSecondShip(ship) {
    const context = this.context;
    context.save();
    context.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 5);
    context.rotate(ship.angle * Math.PI / 180);
    this.fillPolygon([[-5, -20], [-3, -22], [3, -22], [5, -20]], COLORS.black);
    this.fillPolygon([[-7, -12], [-5, -20], [5, -20], [7, -12]], COLORS.black);
    this.fillPolygon([[-3, -22], [0, -27], [3, -22]], COLORS.black);
    this.fillPolygon([[-3, -19], [0, -21], [0, -21], [3, -19]], COLORS.shipPeach);
    this.fillPolygon([[-5, -14], [-3, -19], [3, -19], [5, -14]], COLORS.shipPeach);
    this.fillPolygon([[-0.25, -21], [0, -26], [0.25, -21]], COLORS.white);
    this.fillPolygon([[-6, -12], [-4, 3], [4, 3], [6, -12]], COLORS.black);
    this.fillPolygon([[-5, -14], [-2, 1], [2, 1], [5, -14]], COLORS.shipPeach);
    this.fillPolygon([[-5, -5], [-7, -2], [-7, 4], [-4, 0]], COLORS.black);
    this.fillPolygon([[-3, -6], [-6, -2], [-6, 3], [-2, -2]], COLORS.shipPeach);
    this.fillPolygon([[5, -5], [7, -2], [7, 4], [4, 0]], COLORS.black);
    this.fillPolygon([[3, -6], [6, -2], [6, 3], [2, -2]], COLORS.shipPeach);
    this.drawOctagon(-2, -17, 4, COLORS.black);
    this.drawOctagon(-1, -16, 2, COLORS.darkGrey);
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

  drawRadio(offset, receptionVolume = 0) {
    const context = this.context;

    // White chassis and its angled top shoulder.
    context.fillStyle = COLORS.white;
    context.fillRect(11, 412, 128, 68);
    this.fillPolygon([[11, 412], [17, 407], [132, 407], [139, 412]], COLORS.white);

    // Perforated speaker grill. Ruby integer division makes each nominal
    // three-pixel dot a two-pixel square.
    for (let column = 0; column < 20; column += 1) {
      for (let row = 0; row < 12; row += 1) {
        context.fillStyle = column >= 2 && column <= 8 && row >= 2 && row <= 8
          ? COLORS.darkGrey
          : COLORS.radioGrey;
        context.fillRect(18 + 6 * column, 414 + 6 * row, 2, 2);
      }
    }

    // Open-bottom blue frame from the original five quads.
    const frame = COLORS.frameBlue;
    this.fillPolygon([[10, 413], [14, 413], [14, 480], [10, 480]], frame);
    this.fillPolygon([[10, 413], [18, 405], [18, 409], [14, 413]], frame);
    this.fillPolygon([[18, 405], [132, 405], [132, 409], [18, 409]], frame);
    this.fillPolygon([[132, 405], [140, 413], [136, 413], [132, 409]], frame);
    this.fillPolygon([[136, 413], [140, 413], [140, 480], [136, 480]], frame);

    // Dial base and reception face.
    this.drawOctagon(85, 420, 40, COLORS.darkGrey);
    this.drawOctagon(87, 422, 36, COLORS.white);
    const receptionColor = offset === 0
      ? COLORS.radioGrey
      : receptionVolume > 0
        ? `rgba(255, 255, 204, ${Math.round(receptionVolume * 255) / 255})`
        : COLORS.white;
    this.drawOctagon(87, 422, 36, receptionColor);

    const mark = COLORS.darkGrey;
    context.fillStyle = mark;
    context.fillRect(90, 438, 5, 1);
    context.fillRect(92, 433, 1, 1);
    this.fillPolygon([[95, 429], [96, 428], [97, 429], [96, 430]], mark);
    context.fillRect(100, 427, 1, 1);
    context.fillRect(105, 424, 1, 6);
    context.fillRect(109, 427, 1, 1);
    this.fillPolygon([[115, 429], [114, 428], [113, 429], [114, 430]], mark);
    context.fillRect(117, 433, 1, 1);
    context.fillRect(115, 438, 5, 1);

    // Main tuner and its fixed indicator.
    context.save();
    context.translate(105, 439);
    context.rotate(offset / 275 * Math.PI);
    context.translate(-105, -439);
    this.drawOctagon(98, 432, 14, COLORS.darkGrey);
    this.drawOctagon(99, 433, 12, COLORS.white);
    this.drawOctagon(91, 437, 3, COLORS.dialOrange);
    context.restore();
    context.fillStyle = COLORS.darkGrey;
    context.fillRect(101, 450, 9, 1);
    context.fillStyle = COLORS.dialOrange;
    context.fillRect(104, 449, 3, 1);

    // Power and tuning knobs.
    this.drawRadioKnob(94, offset > 0 ? Math.PI / 4 : 0, 1);
    this.drawRadioKnob(109, offset / 275 * 4 * Math.PI, -1);
  }

  drawRadioKnob(x, angle, indicatorOffset) {
    const context = this.context;
    const y = 465;
    context.save();
    context.translate(x + 4, y + 4);
    context.rotate(angle);
    context.translate(-(x + 4), -(y + 4));
    this.drawOctagon(x - 1, y - 1, 10, COLORS.darkGrey);
    this.drawOctagon(x, y, 8, COLORS.white);
    this.drawOctagon(x + indicatorOffset, y + (indicatorOffset < 0 ? 3 : 0), 2, COLORS.dialOrange);
    context.restore();
  }
}

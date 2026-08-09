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

    for (const star of game.stars) this.drawStar(star);
    this.drawShip(game.ship);

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
    context.strokeStyle = "#ff7735";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(105, 440);
    const angle = Math.PI + offset / 275 * Math.PI;
    context.lineTo(105 + Math.cos(angle) * 17, 440 + Math.sin(angle) * 17);
    context.stroke();
  }
}

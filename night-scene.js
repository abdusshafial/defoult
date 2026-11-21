"use strict";

function initNightScene(canvas) {
  const surface = canvas.getContext("2d");
  if (!surface) return { start() {}, stop() {} };
  const backdrop = document.createElement("canvas");
  const paint = backdrop.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let width, height, ratio, origin, frame, running = false;

  function path(ctx, color, draw) {
    ctx.beginPath();
    draw(ctx);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function stroke(ctx, color, weight, draw) {
    ctx.beginPath();
    draw(ctx);
    ctx.lineWidth = weight;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, color, angle = 0) {
    path(ctx, color, (p) => p.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2));
  }

  function glow(ctx, x, y, radius, color, transparent) {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, color);
    light.addColorStop(1, transparent);
    ellipse(ctx, x, y, radius, radius, light);
  }

  function tree(ctx, reach, ground, lean) {
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.scale(lean, lean);
    ctx.fillStyle = "#0b1828";
    path(ctx, "#091524", (p) => {
      p.moveTo(-reach - 95, ground);
      p.bezierCurveTo(-reach - 12, ground - 32, -reach - 10, 95, -reach - 44, 23);
      p.bezierCurveTo(-reach - 60, -20, -reach - 71, -67, -reach - 48, -99);
      p.bezierCurveTo(-reach - 28, -48, -reach - 7, -20, -reach + 22, -20);
      p.bezierCurveTo(-reach + 107, -23, -41, -13, 29, -8);
      p.bezierCurveTo(19, 3, -38, 12, -reach + 88, 13);
      p.bezierCurveTo(-reach + 36, 16, -reach + 21, 49, -reach + 40, 99);
      p.bezierCurveTo(-reach + 68, ground - 55, -reach + 49, ground - 23, -reach + 98, ground);
      p.closePath();
    });
    stroke(ctx, "#23354b", 2, (p) => {
      p.moveTo(-reach + 9, ground - 24);
      p.bezierCurveTo(-reach + 29, 112, -reach - 13, 67, -reach + 20, 27);
      p.bezierCurveTo(-reach + 44, 2, -67, 6, 16, -5);
    });
    stroke(ctx, "#14253a", 8, (p) => {
      p.moveTo(-reach + 20, -13);
      p.bezierCurveTo(-reach + 55, -26, -reach + 51, -75, -reach + 99, -89);
      p.moveTo(-56, 6);
      p.quadraticCurveTo(-19, -21, 39, -28);
    });
    for (let i = 0; i < 12; i += 1) {
      const x = -reach - 40 + (i * (reach + 65)) / 11;
      const y = -42 - Math.sin(i * .65) * 28 - (i < 4 ? 26 : 0);
      ellipse(ctx, x, y, 35 - (i > 7 ? 10 : 0), 14 + (i % 4) * 5, i % 3 === 0 ? "#172a40" : "#0c1c30", -.14);
      if (i % 2 === 0) ellipse(ctx, x + 5, y - 11, 23, 12, "#192b43", -.2);
    }
    ctx.restore();
  }

  function drawBackdrop() {
    const mobile = width < 736;
    const floorY = mobile ? Math.min(height * .59, 425) : height * .78;
    const sky = paint.createLinearGradient(0, 0, width * .18, height);
    sky.addColorStop(0, "#081323");
    sky.addColorStop(.56, "#162b45");
    sky.addColorStop(.8, "#263c56");
    sky.addColorStop(1, "#0c1829");
    paint.fillStyle = sky;
    paint.fillRect(0, 0, width, height);
    glow(paint, width * .23, height * .42, Math.min(570, width * .55), "#455d7f58", "#455d7f00");
    let seed = 17159;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < Math.min(195, width * .23); i += 1) {
      const x = random() * width;
      const y = random() * floorY * .88;
      const r = random() * .9 + .35;
      ellipse(paint, x, y, r, r, i % 7 === 0 ? "#e6edf7db" : "#a1b6d56d");
      if (r > 1.1 && i % 12 === 0) glow(paint, x, y, 5, "#bae2f887", "#bae2f800");
    }

    const mx = width * (mobile ? .19 : .20);
    const my = mobile ? 105 : Math.max(95, height * .176);
    const r = Math.max(23, Math.min(47, width * (mobile ? .077 : .041)));
    glow(paint, mx, my, r * 4.1, "#92bfe66c", "#92bfe600");
    glow(paint, mx, my, r * 1.43, "#f4e9cd88", "#f4e9cd00");
    const moon = paint.createRadialGradient(mx - r * .28, my - r * .32, 0, mx, my, r);
    moon.addColorStop(0, "#fff6db");
    moon.addColorStop(.75, "#e9e5cf");
    moon.addColorStop(1, "#d0d9d6");
    ellipse(paint, mx, my, r, r, moon);
    for (let i = 0; i < 19; i += 1) {
      const a = random() * 6.28;
      const d = random() * r * .72;
      const spot = random() * r * .13 + .5;
      ellipse(paint, mx + Math.cos(a) * d, my + Math.sin(a) * d, spot, spot * .7, i % 2 ? "#a0aeb431" : "#f9e9c659", a);
    }

    for (let layer = 0; layer < 3; layer += 1) {
      const y = floorY - (3 - layer) * (mobile ? 17 : 27);
      const hue = ["#263d57", "#1c324a", "#12273e"][layer];
      path(paint, hue, (p) => {
        p.moveTo(0, y);
        for (let x = 0; x < width + 26; x += 26) {
          const h = y + Math.sin(x * (layer + 2) / 270 + layer) * (24 + layer * 7)
            + Math.cos(x / 49 + layer) * (6 + layer * 4);
          p.lineTo(x, h);
        }
        p.lineTo(width, height);
        p.lineTo(0, height);
        p.closePath();
      });
    }
    for (let i = 0; i < width / 12; i += 1) {
      const x = i * 12 + random() * 10;
      const y = floorY + 4 + Math.sin(x * .015) * 11;
      const h = random() * 40 + 17;
      path(paint, random() > .46 ? "#132740" : "#112236", (p) => {
        p.moveTo(x - h * .26, y);
        p.lineTo(x, y - h);
        p.lineTo(x + h * .29, y);
        p.closePath();
      });
    }
    path(paint, "#0a192b", (p) => {
      p.moveTo(0, floorY + 22);
      p.bezierCurveTo(width * .22, floorY + 45, width * .31, floorY - 28, width * .55, floorY + 20);
      p.bezierCurveTo(width * .69, floorY + 52, width * .88, floorY + 31, width, floorY + 67);
      p.lineTo(width, height);
      p.lineTo(0, height);
      p.closePath();
    });
    for (let i = 0; i < 65; i += 1) {
      const x = random() * width * .61;
      const y = floorY + random() * Math.max(30, height - floorY);
      const h = random() * 14 + 4;
      stroke(paint, i % 2 ? "#263b4c" : "#1b2d3d", 1, (p) => {
        p.moveTo(x, y); p.quadraticCurveTo(x - 3, y - h * .7, x - 6, y - h);
        p.moveTo(x, y); p.quadraticCurveTo(x + 2, y - h * .44, x + 5, y - h * .7);
      });
    }
    const scale = mobile ? .86 : 1.18;
    tree(paint, Math.min(width * .30, 345) / scale, (floorY - origin.y + 52) / scale, scale);
  }

  function swing(time) {
    surface.save();
    surface.translate(origin.x, origin.y);
    surface.scale(origin.scale, origin.scale);
    const angle = reduced.matches ? -.09 : Math.sin(time * .00148) * .26;
    surface.rotate(angle);
    const seat = origin.length / origin.scale;
    [-15, 17].forEach((x) => {
      stroke(surface, "#182135", 3.6, (p) => { p.moveTo(x, -3); p.lineTo(x, seat + 3); });
      stroke(surface, "#a1a8af", 1.45, (p) => { p.moveTo(x, -3); p.lineTo(x, seat + 3); });
    });
    surface.translate(0, seat);
    const legMotion = reduced.matches ? 0 : Math.cos(time * .00148) * 5;
    stroke(surface, "#172234", 7, (p) => {
      p.moveTo(5, -7); p.lineTo(28, -3); p.lineTo(39, 13 + legMotion);
    });
    stroke(surface, "#617594", 8, (p) => {
      p.moveTo(3, -7); p.lineTo(27, 1); p.lineTo(36, 19 + legMotion);
    });
    stroke(surface, "#b7ab9d", 5, (p) => {
      p.moveTo(36, 19 + legMotion); p.lineTo(45, 19 + legMotion);
      p.moveTo(39, 13 + legMotion); p.lineTo(46, 12 + legMotion);
    });
    ellipse(surface, 1, -22, 14, 22, "#405e7f", .19);
    ellipse(surface, -4, -26, 10, 19, "#6281a1", .19);
    stroke(surface, "#273f5b", 7, (p) => {
      p.moveTo(4, -36); p.lineTo(16, -25); p.lineTo(17, -44);
    });
    stroke(surface, "#c8a799", 4.5, (p) => {
      p.moveTo(17, -44); p.lineTo(17, -48);
      p.moveTo(-15, -41); p.lineTo(-15, -45);
    });
    ellipse(surface, 8, -50, 9, 11, "#cdac9b", -.23);
    ellipse(surface, -1, -51, 3.1, 3.8, "#af8f89");
    path(surface, "#20283d", (p) => {
      p.moveTo(17, -53);
      p.bezierCurveTo(20, -66, 4, -68, -2, -60);
      p.quadraticCurveTo(-6, -52, -1, -49);
      p.lineTo(3, -55);
      p.quadraticCurveTo(10, -55, 13, -60);
      p.lineTo(17, -53);
    });
    surface.fillStyle = "#654e4d";
    surface.fillRect(-27, -2, 59, 7);
    surface.fillStyle = "#ba9779";
    surface.fillRect(-26, -3, 57, 2);
    surface.restore();
  }

  function resize() {
    if (!running) return;
    const bounds = canvas.getBoundingClientRect();
    width = Math.round(bounds.width);
    height = Math.round(bounds.height);
    if (!width || !height) return;
    const mobile = width < 736;
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = backdrop.width = width * ratio;
    canvas.height = backdrop.height = height * ratio;
    surface.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    origin = {
      x: width * (mobile ? .27 : .33),
      y: mobile ? 191 : Math.min(290, height * .32),
      scale: mobile ? .84 : 1.16,
      length: mobile ? 124 : Math.min(240, height * .307)
    };
    drawBackdrop();
    if (reduced.matches) draw(0);
  }

  function draw(time) {
    if (!running || !origin) return;
    surface.drawImage(backdrop, 0, 0, width, height);
    swing(time);
    if (!reduced.matches) frame = requestAnimationFrame(draw);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  reduced.addEventListener("change", () => {
    if (!running) return;
    cancelAnimationFrame(frame);
    draw(0);
  });
  return {
    start() {
      if (running) return;
      running = true;
      resize();
      if (!reduced.matches) frame = requestAnimationFrame(draw);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    }
  };
}

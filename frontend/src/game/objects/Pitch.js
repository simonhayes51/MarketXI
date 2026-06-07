export default class Pitch {
  constructor(scene) {
    this.scene = scene;
    this.draw();
  }

  draw() {
    const scene = this.scene;
    const W = scene.PITCH_WIDTH;
    const H = scene.PITCH_HEIGHT;
    const cx = W / 2;
    const cy = H / 2;

    // Outer background (crowd area)
    const outerGfx = scene.add.graphics().setDepth(-2);
    outerGfx.fillStyle(0x1a1a2e, 1);
    outerGfx.fillRect(-200, -200, W + 400, H + 400);

    // Crowd strips at top and bottom (Sensible Soccer style)
    this.drawCrowd(scene, W, H, outerGfx);

    const gfx = scene.add.graphics().setDepth(0);

    // Grass stripes — 6 horizontal bands alternating two greens
    const stripeCount = 6;
    const stripeH = H / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      gfx.fillStyle(i % 2 === 0 ? 0x28a828 : 0x32c232, 1);
      gfx.fillRect(0, i * stripeH, W, stripeH);
    }

    // Subtle penalty box fill (slightly darker green)
    const penW = 165;
    const penH = 250;
    const penTop = cy - penH / 2;
    gfx.fillStyle(0x248824, 0.35);
    gfx.fillRect(0, penTop, penW, penH);
    gfx.fillRect(W - penW, penTop, penW, penH);

    // White pitch border
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.strokeRect(10, 10, W - 20, H - 20);

    // Halfway line
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.lineBetween(cx, 10, cx, H - 10);

    // Center circle
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.strokeCircle(cx, cy, 70);

    // Center spot
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(cx, cy, 4);

    // Home penalty area (left)
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.strokeRect(10, penTop, penW, penH);

    // Away penalty area (right)
    gfx.strokeRect(W - 10 - penW, penTop, penW, penH);

    // Home 6-yard box
    const sixW = 60;
    const sixH = 120;
    const sixTop = cy - sixH / 2;
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.strokeRect(10, sixTop, sixW, sixH);

    // Away 6-yard box
    gfx.strokeRect(W - 10 - sixW, sixTop, sixW, sixH);

    // Goals with posts and net outline
    const goalH = scene.GOAL_HEIGHT;
    const goalTop = cy - goalH / 2;
    const goalDepth = 28;

    // Home goal (left side)
    // Net area fill
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillRect(-goalDepth, goalTop, goalDepth, goalH);
    // Goal posts (thick white lines)
    gfx.lineStyle(4, 0xffffff, 1);
    gfx.lineBetween(10, goalTop, 10, goalTop + goalH);          // front bar
    gfx.lineBetween(10, goalTop, 10 - goalDepth, goalTop);       // top post
    gfx.lineBetween(10, goalTop + goalH, 10 - goalDepth, goalTop + goalH); // bottom post
    gfx.lineBetween(10 - goalDepth, goalTop, 10 - goalDepth, goalTop + goalH); // back line
    // Net grid lines
    gfx.lineStyle(1, 0xffffff, 0.4);
    for (let y = goalTop; y <= goalTop + goalH; y += 10) {
      gfx.lineBetween(-goalDepth, y, 10, y);
    }
    for (let x = -goalDepth; x <= 10; x += 7) {
      gfx.lineBetween(x, goalTop, x, goalTop + goalH);
    }

    // Away goal (right side)
    gfx.fillStyle(0xffffff, 0.08);
    gfx.fillRect(W, goalTop, goalDepth, goalH);
    gfx.lineStyle(4, 0xffffff, 1);
    gfx.lineBetween(W - 10, goalTop, W - 10, goalTop + goalH);
    gfx.lineBetween(W - 10, goalTop, W - 10 + goalDepth, goalTop);
    gfx.lineBetween(W - 10, goalTop + goalH, W - 10 + goalDepth, goalTop + goalH);
    gfx.lineBetween(W - 10 + goalDepth, goalTop, W - 10 + goalDepth, goalTop + goalH);
    gfx.lineStyle(1, 0xffffff, 0.4);
    for (let y = goalTop; y <= goalTop + goalH; y += 10) {
      gfx.lineBetween(W - 10, y, W + goalDepth, y);
    }
    for (let x = W - 10; x <= W + goalDepth; x += 7) {
      gfx.lineBetween(x, goalTop, x, goalTop + goalH);
    }

    // Penalty spots
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(10 + 120, cy, 4);
    gfx.fillCircle(W - 10 - 120, cy, 4);

    // Corner arcs
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.beginPath();
    gfx.arc(10, 10, 20, 0, Math.PI / 2, false);
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(W - 10, 10, 20, Math.PI / 2, Math.PI, false);
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(10, H - 10, 20, -Math.PI / 2, 0, false);
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(W - 10, H - 10, 20, Math.PI, 3 * Math.PI / 2, false);
    gfx.strokePath();

    // Penalty arc (home)
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.beginPath();
    gfx.arc(10 + 120, cy, 70, -0.9, 0.9, false);
    gfx.strokePath();

    // Penalty arc (away)
    gfx.beginPath();
    gfx.arc(W - 10 - 120, cy, 70, Math.PI - 0.9, Math.PI + 0.9, false);
    gfx.strokePath();
  }

  drawCrowd(scene, W, H, gfx) {
    // Sensible Soccer style: dense, colorful crowd rows at top and bottom edges
    const crowdColors = [
      0xcc2222, 0x2255cc, 0x228833, 0xcc8822, 0x882288,
      0xdd4444, 0x4477ee, 0x44aa55, 0xeeaa33, 0xaa44cc,
      0xaa1111, 0x113399, 0x115522, 0xaa6611, 0x661188,
    ];
    const blockW = 5;
    const blockH = 7;
    const crowdRows = 10;
    const crowdAreaH = crowdRows * blockH;

    // Top crowd strip
    for (let row = 0; row < crowdRows; row++) {
      const brightness = 0.6 + (row / crowdRows) * 0.4; // darker at back, brighter at front
      for (let col = 0; col < Math.floor((W + 400) / blockW); col++) {
        const ci = (col * 3 + row * 7) % crowdColors.length;
        const color = crowdColors[ci];
        const x = -200 + col * blockW + (row % 2 === 0 ? blockW / 2 : 0);
        const y = -200 + row * blockH;
        gfx.fillStyle(color, brightness);
        gfx.fillRect(x, y, blockW - 1, blockH - 1);
      }
    }

    // Bottom crowd strip
    for (let row = 0; row < crowdRows; row++) {
      const brightness = 0.6 + (row / crowdRows) * 0.4;
      for (let col = 0; col < Math.floor((W + 400) / blockW); col++) {
        const ci = (col * 5 + row * 3 + 4) % crowdColors.length;
        const color = crowdColors[ci];
        const x = -200 + col * blockW + (row % 2 === 0 ? 0 : blockW / 2);
        const y = H + 10 + row * blockH;
        gfx.fillStyle(color, brightness);
        gfx.fillRect(x, y, blockW - 1, blockH - 1);
      }
    }

    // Side crowd (left and right) — thinner
    const sideCrowdRows = 6;
    for (let row = 0; row < sideCrowdRows; row++) {
      const brightness = 0.55 + (row / sideCrowdRows) * 0.35;
      for (let col = 0; col < Math.floor((H + 200) / blockW); col++) {
        const ci = (col * 2 + row * 11) % crowdColors.length;
        const color = crowdColors[ci];
        const x = -200 + row * blockH;
        const y = -100 + col * blockW + (row % 2 === 0 ? blockW / 2 : 0);
        gfx.fillStyle(color, brightness);
        gfx.fillRect(x, y, blockH - 1, blockW - 1);
      }
    }
    for (let row = 0; row < sideCrowdRows; row++) {
      const brightness = 0.55 + (row / sideCrowdRows) * 0.35;
      for (let col = 0; col < Math.floor((H + 200) / blockW); col++) {
        const ci = (col * 4 + row * 9 + 2) % crowdColors.length;
        const color = crowdColors[ci];
        const x = W + 10 + row * blockH;
        const y = -100 + col * blockW + (row % 2 === 0 ? 0 : blockW / 2);
        gfx.fillStyle(color, brightness);
        gfx.fillRect(x, y, blockH - 1, blockW - 1);
      }
    }
  }
}

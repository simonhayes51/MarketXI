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

    const gfx = scene.add.graphics().setDepth(0);

    // Pitch base - alternating stripes
    const stripeCount = 14;
    const stripeW = W / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      gfx.fillStyle(i % 2 === 0 ? 0x2d8a2d : 0x308e30, 1);
      gfx.fillRect(i * stripeW, 0, stripeW, H);
    }

    // Pitch border
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.strokeRect(10, 10, W - 20, H - 20);

    // Halfway line
    gfx.lineStyle(2, 0xffffff, 0.9);
    gfx.lineBetween(cx, 10, cx, H - 10);

    // Center circle
    gfx.lineStyle(2, 0xffffff, 0.9);
    gfx.strokeCircle(cx, cy, 70);

    // Center spot
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(cx, cy, 4);

    // Home penalty area (left)
    const penW = 165;
    const penH = 250;
    const penTop = cy - penH / 2;
    gfx.lineStyle(2, 0xffffff, 0.9);
    gfx.strokeRect(10, penTop, penW, penH);

    // Away penalty area (right)
    gfx.strokeRect(W - 10 - penW, penTop, penW, penH);

    // Home 6-yard box
    const sixW = 60;
    const sixH = 120;
    const sixTop = cy - sixH / 2;
    gfx.lineStyle(2, 0xffffff, 0.8);
    gfx.strokeRect(10, sixTop, sixW, sixH);

    // Away 6-yard box
    gfx.strokeRect(W - 10 - sixW, sixTop, sixW, sixH);

    // Home goal
    const goalH = scene.GOAL_HEIGHT;
    const goalTop = cy - goalH / 2;
    gfx.lineStyle(4, 0xffffff, 1);
    // Goal posts
    gfx.lineBetween(10, goalTop, 10, goalTop + goalH);
    // Goal net area
    gfx.fillStyle(0xffffff, 0.1);
    gfx.fillRect(0, goalTop, 10, goalH);
    gfx.lineStyle(1, 0xffffff, 0.4);
    // Net lines
    for (let y = goalTop; y < goalTop + goalH; y += 10) {
      gfx.lineBetween(0, y, 10, y);
    }
    for (let x = 0; x <= 10; x += 5) {
      gfx.lineBetween(x, goalTop, x, goalTop + goalH);
    }

    // Away goal
    gfx.lineStyle(4, 0xffffff, 1);
    gfx.lineBetween(W - 10, goalTop, W - 10, goalTop + goalH);
    gfx.fillStyle(0xffffff, 0.1);
    gfx.fillRect(W - 10, goalTop, 10, goalH);
    gfx.lineStyle(1, 0xffffff, 0.4);
    for (let y = goalTop; y < goalTop + goalH; y += 10) {
      gfx.lineBetween(W - 10, y, W, y);
    }
    for (let x = W - 10; x <= W; x += 5) {
      gfx.lineBetween(x, goalTop, x, goalTop + goalH);
    }

    // Penalty spots
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(10 + 120, cy, 4); // home penalty spot
    gfx.fillCircle(W - 10 - 120, cy, 4); // away penalty spot

    // Corner arcs
    gfx.lineStyle(2, 0xffffff, 0.8);
    gfx.beginPath();
    gfx.arc(10, 10, 20, 0, Math.PI / 2, false); // top-left
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(W - 10, 10, 20, Math.PI / 2, Math.PI, false); // top-right
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(10, H - 10, 20, -Math.PI / 2, 0, false); // bottom-left
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(W - 10, H - 10, 20, Math.PI, 3 * Math.PI / 2, false); // bottom-right
    gfx.strokePath();

    // Penalty arc (home)
    gfx.beginPath();
    gfx.arc(10 + 120, cy, 70, -0.9, 0.9, false);
    gfx.strokePath();

    // Penalty arc (away)
    gfx.beginPath();
    gfx.arc(W - 10 - 120, cy, 70, Math.PI - 0.9, Math.PI + 0.9, false);
    gfx.strokePath();

    // Crowd/boundary background
    const outerGfx = scene.add.graphics().setDepth(-1);
    outerGfx.fillStyle(0x1a1a1a, 1);
    outerGfx.fillRect(-100, -100, W + 200, H + 200);

    // Crowd effect (simple colored blocks around pitch)
    this.drawCrowd(scene, W, H, outerGfx);
  }

  drawCrowd(scene, W, H, gfx) {
    const crowdColors = [0x8b0000, 0x00008b, 0x006400, 0x8b4513, 0x4b0082];
    const crowdSize = 6;
    const crowdRows = 6;

    // Top crowd
    for (let row = 0; row < crowdRows; row++) {
      for (let col = 0; col < Math.floor((W + 200) / crowdSize); col++) {
        const color = crowdColors[(col + row) % crowdColors.length];
        const x = -100 + col * crowdSize + (row % 2) * (crowdSize / 2);
        const y = -100 + row * crowdSize;
        gfx.fillStyle(color, 0.8);
        gfx.fillRect(x, y, crowdSize - 1, crowdSize - 1);
      }
    }

    // Bottom crowd
    for (let row = 0; row < crowdRows; row++) {
      for (let col = 0; col < Math.floor((W + 200) / crowdSize); col++) {
        const color = crowdColors[(col + row + 2) % crowdColors.length];
        const x = -100 + col * crowdSize + (row % 2) * (crowdSize / 2);
        const y = H + 10 + row * crowdSize;
        gfx.fillStyle(color, 0.8);
        gfx.fillRect(x, y, crowdSize - 1, crowdSize - 1);
      }
    }
  }
}

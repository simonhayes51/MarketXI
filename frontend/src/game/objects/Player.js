export default class Player {
  constructor(scene, x, y, side, teamData, number, role = 'midfielder') {
    this.scene = scene;
    this.side = side;
    this.teamData = teamData;
    this.number = number;
    this.role = role;
    this.isControlled = false;

    this.speed        = 155 + Math.random() * 35;
    this.stamina      = 1.0;
    this.staminaDrain = 0.00004;

    this.homeX = x;
    this.homeY = y;

    const primaryColor = Phaser.Display.Color.HexStringToColor(
      teamData.primaryColor.replace('#', '')
    ).color;

    const secondaryColor = Phaser.Display.Color.HexStringToColor(
      teamData.secondaryColor.replace('#', '')
    ).color;

    // Draw player circle
    // Away team: inverted (secondary fill, primary border) so they're always visually distinct
    const fillColor   = side === 'home' ? primaryColor   : secondaryColor;
    const borderColor = side === 'home' ? secondaryColor : primaryColor;

    const key = `player_${side}_${teamData.shortName}_${number}`;
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Slightly larger circle for away team so you can tell them apart at a glance
    gfx.fillStyle(fillColor, 1);
    gfx.fillCircle(11, 11, 11);
    gfx.lineStyle(3, borderColor, 1);
    gfx.strokeCircle(11, 11, 11);

    // Away team: add a small cross/dot in primary color to distinguish
    if (side === 'away') {
      gfx.fillStyle(primaryColor, 1);
      gfx.fillCircle(11, 11, 4);
    }

    gfx.generateTexture(key, 22, 22);
    gfx.destroy();

    this.sprite = scene.physics.add.sprite(x, y, key)
      .setCircle(9, 2, 2)
      .setCollideWorldBounds(true)
      .setDragX(280)
      .setDragY(280)
      .setDepth(10);

    // Jersey number
    this.numberText = scene.add.text(x, y - 16, `${number}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: side === 'home' ? '#ffffff' : '#000000',
      stroke: side === 'home' ? '#000000' : '#ffffff',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);

    // Controlled-player indicator: bright yellow arrow above sprite
    this.selectionArrow = scene.add.triangle(
      x, y - 26,
      -7, 0, 7, 0, 0, -9,
      0xffff00, 1
    ).setDepth(12).setVisible(false);

    // Ball-possession indicator: small white circle on player
    this.possessionDot = scene.add.circle(x + 9, y - 9, 4, 0xffffff, 1)
      .setDepth(13).setVisible(false);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get vx() { return this.sprite.body?.velocity.x || 0; }
  get vy() { return this.sprite.body?.velocity.y || 0; }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
    this.homeX = x;
    this.homeY = y;
  }

  setControlled(controlled) {
    this.isControlled = controlled;
    this.selectionArrow.setVisible(controlled);
    this.sprite.setScale(controlled ? 1.15 : 1.0);
  }

  setPossession(hasBall) {
    this.possessionDot.setVisible(hasBall);
  }

  setVelocity(vx, vy) {
    if (this.sprite.body) this.sprite.body.setVelocity(vx, vy);
  }

  update(delta, ball) {
    const sx = this.sprite.x;
    const sy = this.sprite.y;

    this.numberText.setPosition(sx, sy - 16);
    this.selectionArrow.setPosition(sx, sy - 27);
    this.possessionDot.setPosition(sx + 9, sy - 9);

    // Stamina
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > 10) {
      this.stamina = Math.max(0.5, this.stamina - this.staminaDrain * delta);
    }

    // Clamp within pitch
    const px = Phaser.Math.Clamp(sx, 6, this.scene.PITCH_WIDTH  - 6);
    const py = Phaser.Math.Clamp(sy, 6, this.scene.PITCH_HEIGHT - 6);
    if (px !== sx || py !== sy) {
      this.sprite.setPosition(px, py);
      if (this.sprite.body) this.sprite.body.setVelocity(0, 0);
    }
  }

  moveTo(tx, ty, speedMultiplier = 1.0) {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      if (this.sprite.body) this.sprite.body.setVelocity(0, 0);
      return false;
    }

    const s = this.speed * this.stamina * speedMultiplier;
    if (this.sprite.body) {
      this.sprite.body.setVelocity((dx / dist) * s, (dy / dist) * s);
    }
    return true;
  }

  destroy() {
    this.sprite.destroy();
    this.numberText.destroy();
    this.selectionArrow.destroy();
    this.possessionDot.destroy();
  }
}

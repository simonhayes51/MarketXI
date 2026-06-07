export default class Player {
  constructor(scene, x, y, side, teamData, number, role = 'midfielder', textureKey = null) {
    this.scene = scene;
    this.side = side;
    this.teamData = teamData;
    this.number = number;
    this.role = role;
    this.isControlled = false;
    this.speed = 155 + Math.random() * 35;
    this.stamina = 1.0;
    this.staminaDrain = 0.00004;
    this.homeX = x;
    this.homeY = y;

    const key = textureKey || `player_${side}`;

    this.sprite = scene.physics.add.sprite(x, y, key)
      .setCollideWorldBounds(true)
      .setDragX(260)
      .setDragY(260)
      .setDepth(10);

    // Set physics body size (smaller than sprite visual for better feel)
    this.sprite.setBodySize(14, 18, true);

    // Jersey number
    this.numberText = scene.add.text(x, y, `${number}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(11);

    // Selection indicator: pre-generated 'arrow' texture above player
    this.selectionArrow = scene.add.image(x, y - 22, 'arrow')
      .setDepth(12).setVisible(false);

    // Possession dot (small white circle on player)
    this.possessionDot = scene.add.circle(x, y, 3, 0xffffff, 1)
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
    this.sprite.setScale(controlled ? 1.1 : 1.0);
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
    this.numberText.setPosition(sx, sy);
    this.selectionArrow.setPosition(sx, sy - 22);
    this.possessionDot.setPosition(sx + 8, sy - 8);

    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > 10) this.stamina = Math.max(0.5, this.stamina - this.staminaDrain * delta);

    // Clamp within pitch
    const px = Phaser.Math.Clamp(sx, 6, this.scene.PITCH_WIDTH - 6);
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
    if (this.sprite.body) this.sprite.body.setVelocity((dx / dist) * s, (dy / dist) * s);
    return true;
  }

  destroy() {
    this.sprite.destroy();
    this.numberText.destroy();
    this.selectionArrow.destroy();
    this.possessionDot.destroy();
  }
}

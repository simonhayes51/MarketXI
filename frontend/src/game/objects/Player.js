export default class Player {
  constructor(scene, x, y, side, teamData, number, role = 'midfielder') {
    this.scene = scene;
    this.side = side;
    this.teamData = teamData;
    this.number = number;
    this.role = role; // defender, midfielder, forward, goalkeeper
    this.isControlled = false;

    // Player stats
    this.speed = 150 + Math.random() * 40;
    this.stamina = 1.0;
    this.staminaDrain = 0.00005;

    // State
    this.state = 'idle'; // idle, moving, dribbling, celebrating
    this.aiState = 'position'; // position, press, support, attack
    this.homeX = x;
    this.homeY = y;
    this.targetX = x;
    this.targetY = y;

    // Create sprite
    const color = Phaser.Display.Color.HexStringToColor(
      teamData.primaryColor.replace('#', '')
    ).color;
    const borderColor = Phaser.Display.Color.HexStringToColor(
      teamData.secondaryColor.replace('#', '')
    ).color;

    // Create circular player sprite
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color, 1);
    gfx.fillCircle(10, 10, 10);
    gfx.lineStyle(2.5, borderColor, 1);
    gfx.strokeCircle(10, 10, 10);
    gfx.generateTexture(`player_${side}_${number}`, 20, 20);
    gfx.destroy();

    this.sprite = scene.physics.add.sprite(x, y, `player_${side}_${number}`)
      .setCircle(8, 2, 2)
      .setCollideWorldBounds(true)
      .setDragX(300)
      .setDragY(300)
      .setDepth(10);

    // Jersey number text
    this.numberText = scene.add.text(x, y - 14, `${number}`, {
      fontFamily: 'monospace',
      fontSize: '9px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);

    // Selection indicator (arrow above controlled player)
    this.selectionArrow = scene.add.triangle(
      x, y - 22,
      -6, 0, 6, 0, 0, -8,
      side === 'home' ? 0xffffff : 0xffffff
    ).setDepth(12).setVisible(false);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get vx() { return this.sprite.body?.velocity.x || 0; }
  get vy() { return this.sprite.body?.velocity.y || 0; }
  set vx(v) { if (this.sprite.body) this.sprite.body.velocity.x = v; }
  set vy(v) { if (this.sprite.body) this.sprite.body.velocity.y = v; }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
    this.homeX = x;
    this.homeY = y;
  }

  setControlled(controlled) {
    this.isControlled = controlled;
    this.selectionArrow.setVisible(controlled);
    if (controlled) {
      // Highlight controlled player
      this.sprite.setAlpha(1.0);
      this.sprite.setScale(1.1);
    } else {
      this.sprite.setAlpha(0.95);
      this.sprite.setScale(1.0);
    }
  }

  setVelocity(vx, vy) {
    this.sprite.body.setVelocity(vx, vy);
  }

  update(delta, ball) {
    // Sync text positions with sprite
    this.numberText.setPosition(this.sprite.x, this.sprite.y - 14);
    this.selectionArrow.setPosition(this.sprite.x, this.sprite.y - 24);

    // Stamina drain when moving
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 10) {
      this.stamina = Math.max(0.5, this.stamina - this.staminaDrain * delta);
    }

    // Keep within pitch bounds
    const px = Phaser.Math.Clamp(this.sprite.x, 5, this.scene.PITCH_WIDTH - 5);
    const py = Phaser.Math.Clamp(this.sprite.y, 5, this.scene.PITCH_HEIGHT - 5);
    if (px !== this.sprite.x || py !== this.sprite.y) {
      this.sprite.setPosition(px, py);
      this.sprite.body.setVelocity(0, 0);
    }
  }

  moveTo(tx, ty, speedMultiplier = 1.0) {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      this.sprite.body.setVelocity(0, 0);
      return false; // reached
    }

    const spd = this.speed * this.stamina * speedMultiplier;
    this.sprite.body.setVelocity(
      (dx / dist) * spd,
      (dy / dist) * spd
    );
    return true; // still moving
  }

  destroy() {
    this.sprite.destroy();
    this.numberText.destroy();
    this.selectionArrow.destroy();
  }
}

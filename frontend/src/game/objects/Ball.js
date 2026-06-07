export default class Ball {
  constructor(scene, x, y) {
    this.scene = scene;
    this.lastTouched = null;
    this.isShotOnGoal = false;

    // Create ball graphic
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Ball body
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(8, 8, 8);

    // Pentagon patches (black)
    gfx.fillStyle(0x111111, 1);
    gfx.fillTriangle(8, 2, 4, 7, 12, 7);
    gfx.fillTriangle(2, 11, 7, 15, 5, 6);
    gfx.fillTriangle(14, 11, 9, 15, 11, 6);

    gfx.generateTexture('ball_tex', 16, 16);
    gfx.destroy();

    // Shadow
    this.shadow = scene.add.ellipse(x, y + 4, 14, 6, 0x000000, 0.3).setDepth(4);

    this.sprite = scene.physics.add.sprite(x, y, 'ball_tex')
      .setCircle(7, 1, 1)
      .setCollideWorldBounds(false)
      .setDragX(120)
      .setDragY(120)
      .setBounce(0.5)
      .setDepth(5);

    // Spin tracking for curl effect
    this.spin = 0;
    this.spinDecay = 0.98;
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  getSpeed() {
    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    return Math.sqrt(vx * vx + vy * vy);
  }

  setVelocity(vx, vy) {
    this.sprite.body.setVelocity(vx, vy);
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  kick(vx, vy, spin = 0) {
    this.sprite.body.setVelocity(vx, vy);
    this.spin = spin;
    this.isShotOnGoal = false;
    this.scene.cameras.main.flash(30, 255, 255, 255, false);
  }

  reset(x, y) {
    this.sprite.setPosition(x, y);
    this.sprite.body.setVelocity(0, 0);
    this.spin = 0;
    this.lastTouched = null;
    this.isShotOnGoal = false;
  }

  update(delta) {
    // Apply curl/spin
    if (Math.abs(this.spin) > 0.5) {
      const speed = this.getSpeed();
      if (speed > 20) {
        // Spin perpendicular to velocity
        const vx = this.sprite.body.velocity.x;
        const vy = this.sprite.body.velocity.y;
        const len = Math.sqrt(vx * vx + vy * vy);
        const perpX = -vy / len;
        const perpY = vx / len;
        const curlForce = this.spin * speed * 0.003;
        this.sprite.body.setVelocity(
          vx + perpX * curlForce,
          vy + perpY * curlForce
        );
      }
      this.spin *= this.spinDecay;
    }

    // Rotate sprite to show ball spinning
    const speed = this.getSpeed();
    this.sprite.rotation += speed * 0.003;

    // Sync shadow
    this.shadow.setPosition(this.sprite.x + 3, this.sprite.y + 6);
    this.shadow.setAlpha(0.2 + Math.min(speed / 500, 0.2));

    // Extra friction when very slow (stop the ball)
    if (speed < 5) {
      this.sprite.body.setVelocity(0, 0);
    }

    // Apply additional friction manually for a better feel
    if (speed > 5) {
      const friction = 0.97;
      const vx = this.sprite.body.velocity.x;
      const vy = this.sprite.body.velocity.y;
      this.sprite.body.setVelocity(vx * friction, vy * friction);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

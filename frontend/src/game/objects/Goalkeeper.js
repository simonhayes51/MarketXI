import Player from './Player.js';

export default class Goalkeeper extends Player {
  constructor(scene, x, y, side, teamData, number) {
    super(scene, x, y, side, teamData, number, 'goalkeeper', `gk_${side}`);

    this.homeX = x;
    this.homeY = y;
    this.speed = 150;
    this.diveRange = 220;   // react to shots from further away
    this.saveRadius = 30;
    this.divingState = false;
    this.diveTarget = null;
    this.diveCooldown = 0;
  }

  update(delta, ball) {
    super.update(delta, ball);
    if (this.diveCooldown > 0) this.diveCooldown -= delta;
    this.doGKAI(ball, delta);
  }

  doGKAI(ball, delta) {
    const scene = this.scene;
    const bx = ball.x;
    const by = ball.y;
    const distToBall = Phaser.Math.Distance.Between(this.x, this.y, bx, by);

    const isHome = this.side === 'home';
    const goalLineX  = isHome ? scene.HOME_GOAL_X + 18 : scene.AWAY_GOAL_X - 18;
    const goalCenterY = scene.PITCH_HEIGHT / 2;
    const ballVx = ball.sprite.body.velocity.x;
    const ballVy = ball.sprite.body.velocity.y;
    const ballSpeed = Math.sqrt(ballVx * ballVx + ballVy * ballVy);

    // Ball heading toward THIS goal (no half constraint — react from anywhere)
    const headingToGoal = isHome ? ballVx < -60 : ballVx > 60;
    const shotOnGoal = headingToGoal && ballSpeed > 80 && !scene.ballPossessor;

    // ── Diving state ──────────────────────────────────────────────────────
    if (this.divingState) {
      if (this.diveTarget) {
        const reached = !this.moveTo(this.diveTarget.x, this.diveTarget.y, 2.0);
        if (reached || distToBall < this.saveRadius) {
          this.divingState = false;
          this.diveTarget = null;
          this.diveCooldown = 900;

          // Parry into open space
          if (distToBall < this.saveRadius + 15 && !scene.ballPossessor) {
            scene.releasePossession();
            const clearX = isHome ? scene.PITCH_WIDTH * 0.45 : scene.PITCH_WIDTH * 0.55;
            const angle = Phaser.Math.Angle.Between(
              this.x, this.y,
              clearX, goalCenterY + (Math.random() - 0.5) * 160
            );
            ball.kick(Math.cos(angle) * 280, Math.sin(angle) * 280);
            ball.lastTouched = this;
          }
        }
      }
      return;
    }

    // ── Decide to dive ────────────────────────────────────────────────────
    if (shotOnGoal && distToBall < this.diveRange && this.diveCooldown <= 0) {
      // Predict where the ball will cross the goal line
      const timeToLine = Math.abs((goalLineX - bx) / (ballVx || 1));
      const predictedY = by + ballVy * timeToLine;
      const clampedY = Phaser.Math.Clamp(predictedY, scene.GOAL_TOP - 10, scene.GOAL_BOTTOM + 10);

      this.divingState = true;
      this.diveTarget = { x: goalLineX, y: clampedY };
      return;
    }

    // ── Pickup loose ball near goal ───────────────────────────────────────
    if (!scene.ballPossessor && distToBall < 36 && this.diveCooldown <= 0) {
      scene.setBallPossessor(this);
      // GK immediately clears up the field
      this.time = scene.time; // ensure we have scene reference
      scene.time.delayedCall(400, () => {
        if (scene.ballPossessor !== this) return;
        scene.releasePossession();
        const clearX = isHome ? scene.PITCH_WIDTH * 0.5 : scene.PITCH_WIDTH * 0.5;
        const angle = Phaser.Math.Angle.Between(
          this.x, this.y,
          clearX, goalCenterY + (Math.random() - 0.5) * 200
        );
        ball.kick(Math.cos(angle) * 380, Math.sin(angle) * 380);
        ball.lastTouched = this;
      });
      return;
    }

    // ── Normal positioning: hug goal line, track ball Y ───────────────────
    const trackRange = scene.GOAL_HEIGHT / 2 * 0.85;
    const targetY = Phaser.Math.Clamp(by, goalCenterY - trackRange, goalCenterY + trackRange);
    const targetX = goalLineX;

    if (Math.abs(this.x - targetX) > 6 || Math.abs(this.y - targetY) > 5) {
      this.moveTo(targetX, targetY, 0.9);
    } else {
      if (this.sprite.body) this.sprite.body.setVelocity(0, 0);
    }
  }
}

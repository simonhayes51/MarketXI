import Player from './Player.js';

export default class Goalkeeper extends Player {
  constructor(scene, x, y, side, teamData, number) {
    super(scene, x, y, side, teamData, number, 'goalkeeper', `gk_${side}`);

    this.homeX = x;
    this.homeY = y;
    this.speed = 130;
    this.diveRange = 100;
    this.saveRadius = 25;
    this.divingState = false;
    this.diveTarget = null;
    this.diveCooldown = 0;
  }

  update(delta, ball) {
    super.update(delta, ball);

    if (this.diveCooldown > 0) {
      this.diveCooldown -= delta;
    }

    // Goalkeeper AI logic
    this.doGKAI(ball, delta);
  }

  doGKAI(ball, delta) {
    const scene = this.scene;
    const bx = ball.x;
    const by = ball.y;
    const distToBall = Phaser.Math.Distance.Between(this.x, this.y, bx, by);

    const isHomeSide = this.side === 'home';
    const goalLineX = isHomeSide ? scene.HOME_GOAL_X + 15 : scene.AWAY_GOAL_X - 15;
    const goalCenterY = scene.PITCH_HEIGHT / 2;

    // Determine if ball is heading toward goal
    const ballVx = ball.sprite.body.velocity.x;
    const ballVy = ball.sprite.body.velocity.y;
    const ballHeadingToGoal = isHomeSide
      ? ballVx < -30 && bx < scene.PITCH_WIDTH / 2
      : ballVx > 30 && bx > scene.PITCH_WIDTH / 2;

    if (this.divingState) {
      // Continue dive
      if (this.diveTarget) {
        const reached = !this.moveTo(this.diveTarget.x, this.diveTarget.y, 1.5);
        if (reached || distToBall < this.saveRadius) {
          this.divingState = false;
          this.diveTarget = null;
          this.diveCooldown = 1500;

          // Parry ball away
          if (distToBall < this.saveRadius + 10) {
            const parryX = isHomeSide ? 150 : scene.PITCH_WIDTH - 150;
            const angle = Phaser.Math.Angle.Between(this.x, this.y, parryX, goalCenterY);
            ball.kick(Math.cos(angle) * 200, Math.sin(angle) * 200);
          }
        }
      }
      return;
    }

    // Dive if shot is coming and close enough
    if (ballHeadingToGoal && distToBall < this.diveRange && this.diveCooldown <= 0) {
      // Predict ball position
      const timeToGoal = Math.abs((goalLineX - bx) / (ballVx || 1));
      const predictedY = by + ballVy * timeToGoal;
      const clampedY = Phaser.Math.Clamp(predictedY, scene.GOAL_TOP, scene.GOAL_BOTTOM);

      this.divingState = true;
      this.diveTarget = { x: goalLineX, y: clampedY };
      return;
    }

    // Normal positioning: stay on goal line, track ball Y
    const trackRange = scene.GOAL_HEIGHT / 2 * 0.9;
    const targetY = Phaser.Math.Clamp(
      by,
      goalCenterY - trackRange,
      goalCenterY + trackRange
    );

    const targetX = goalLineX;

    // Only move if significantly off position
    if (Math.abs(this.x - targetX) > 8 || Math.abs(this.y - targetY) > 8) {
      this.moveTo(targetX, targetY, 0.85);
    } else {
      this.sprite.body.setVelocity(0, 0);
    }
  }
}

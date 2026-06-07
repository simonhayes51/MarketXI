// MatchPhysics: utility functions for ball/player physics calculations
export default class MatchPhysics {
  constructor(scene) {
    this.scene = scene;
  }

  // Calculate shot trajectory with optional curl
  calcShotVelocity(fromX, fromY, toX, toY, power, curl = 0) {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const speed = 150 + power * 500;

    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: curl * 120,
    };
  }

  // Calculate pass velocity - linear with friction compensation
  calcPassVelocity(fromX, fromY, toX, toY) {
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);

    // Compensate for friction (ball loses ~15% speed per 100px)
    const baseSpeed = 220;
    const frictionComp = 1 + dist * 0.0005;
    const speed = Math.min(baseSpeed * frictionComp, 380);

    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }

  // Predict ball position after N milliseconds
  predictBallPos(ball, ms) {
    const vx = ball.sprite.body.velocity.x;
    const vy = ball.sprite.body.velocity.y;
    const friction = 0.97; // per frame at 60fps
    const frames = ms / (1000 / 60);
    const frictionFactor = Math.pow(friction, frames);

    // Approximate with exponential decay
    const dx = vx * (1 - frictionFactor) / (1 - friction + 0.001);
    const dy = vy * (1 - frictionFactor) / (1 - friction + 0.001);

    return {
      x: ball.x + dx / 60,
      y: ball.y + dy / 60,
    };
  }

  // Check if position is within shooting range and angle
  isGoodShootingPosition(playerX, playerY, side, pitchW, pitchH) {
    const goalX = side === 'home' ? pitchW - 10 : 10;
    const goalY = pitchH / 2;
    const dist = Phaser.Math.Distance.Between(playerX, playerY, goalX, goalY);
    const angle = Math.abs(Phaser.Math.Angle.Between(playerX, playerY, goalX, goalY));

    return dist < 280 && (angle < 1.2 || angle > Math.PI - 1.2);
  }

  // Apply heading (for corners/crosses)
  calcHeadingVelocity(fromX, fromY, toX, toY) {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const speed = 180 + Math.random() * 60;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }

  // Calculate offside (simplified - last defender position)
  isOffside(player, defenders, ballX) {
    if (defenders.length < 2) return false;

    // Sort defenders by X position
    const sorted = [...defenders].sort((a, b) =>
      player.side === 'home' ? b.x - a.x : a.x - b.x
    );

    // Second defender is offside line
    const offsideLine = sorted[1]?.x || 0;

    if (player.side === 'home') {
      return player.x > offsideLine && player.x > ballX;
    } else {
      return player.x < offsideLine && player.x < ballX;
    }
  }
}

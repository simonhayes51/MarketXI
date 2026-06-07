// AI Controller - state machine for away team players
export default class AIController {
  constructor(scene, difficulty = 'medium') {
    this.scene = scene;
    this.difficulty = difficulty;

    // Difficulty parameters
    const params = {
      easy: {
        reactionDelay: 800,
        passingAccuracy: 0.6,
        shootingAccuracy: 0.5,
        pressDistance: 120,
        passFrequency: 0.4,
        shootFrequency: 0.3,
        speed: 0.75,
      },
      medium: {
        reactionDelay: 400,
        passingAccuracy: 0.78,
        shootingAccuracy: 0.68,
        pressDistance: 180,
        passFrequency: 0.55,
        shootFrequency: 0.5,
        speed: 0.90,
      },
      hard: {
        reactionDelay: 150,
        passingAccuracy: 0.92,
        shootingAccuracy: 0.82,
        pressDistance: 250,
        passFrequency: 0.70,
        shootFrequency: 0.65,
        speed: 1.05,
      },
    };

    this.params = params[difficulty] || params.medium;

    // State per player: Map<player, {state, timer, target}>
    this.playerStates = new Map();

    // Update timer
    this.updateInterval = this.params.reactionDelay;
    this.timeSinceUpdate = 0;
  }

  update(awayPlayers, homePlayers, ball, delta) {
    this.timeSinceUpdate += delta;

    // Only recalculate AI at set intervals (simulates reaction delay)
    if (this.timeSinceUpdate < this.updateInterval) {
      // Still move players toward their last target
      awayPlayers.forEach((player, idx) => {
        if (idx === 0) return; // GK handled separately
        this.executeMoveToTarget(player);
      });
      return;
    }

    this.timeSinceUpdate = 0;

    const ballX = ball.x;
    const ballY = ball.y;
    const ballVx = ball.sprite.body.velocity.x;
    const ballVy = ball.sprite.body.velocity.y;
    const ballSpeed = ball.getSpeed();

    // Determine overall team state
    const ballInAwayhalf = ballX > this.scene.PITCH_WIDTH / 2;
    const teamInAttack = ballInAwayhalf;

    // Find nearest away player to ball
    let nearestPlayer = null;
    let nearestDist = Infinity;

    awayPlayers.forEach((p, idx) => {
      if (idx === 0) return; // Skip GK
      const d = Phaser.Math.Distance.Between(p.x, p.y, ballX, ballY);
      if (d < nearestDist) {
        nearestDist = d;
        nearestPlayer = p;
      }
    });

    const ballCarrier = ball.lastTouched;
    const awayHasBall = ballCarrier && ballCarrier.side === 'away';

    awayPlayers.forEach((player, idx) => {
      if (idx === 0) return; // GK handled separately

      const dist = Phaser.Math.Distance.Between(player.x, player.y, ballX, ballY);

      // State machine
      if (awayHasBall) {
        // Away team has possession
        if (player === nearestPlayer || player === ballCarrier) {
          // Ball carrier: try to pass, shoot, or dribble
          this.handleBallCarrier(player, ball, awayPlayers, homePlayers);
        } else {
          // Support runners - make intelligent runs
          this.handleSupportRun(player, idx, ball, teamInAttack);
        }
      } else {
        // Defending/pressing
        if (player === nearestPlayer) {
          // Nearest player presses ball
          this.pressPlayer(player, ballX, ballY, homePlayers);
        } else {
          // Others take defensive positions
          this.handleDefensivePosition(player, idx, ball, homePlayers, teamInAttack);
        }
      }
    });
  }

  handleBallCarrier(player, ball, awayPlayers, homePlayers) {
    const scene = this.scene;
    const bx = ball.x;
    const by = ball.y;
    const distToGoal = Math.abs(player.x - scene.HOME_GOAL_X);

    // Move toward ball to take possession
    if (Phaser.Math.Distance.Between(player.x, player.y, bx, by) > 30) {
      this.setTarget(player, bx, by);
      return;
    }

    // Has ball! Decide: shoot, pass, or dribble
    const rand = Math.random();

    // Check if in shooting range
    if (distToGoal < 280) {
      if (rand < this.params.shootFrequency) {
        this.aiShoot(player, ball);
        return;
      }
    }

    // Try to pass
    if (rand < this.params.passFrequency) {
      const target = this.findBestPassTarget(player, awayPlayers);
      if (target) {
        this.aiPass(player, ball, target);
        return;
      }
    }

    // Dribble toward goal
    const goalX = scene.HOME_GOAL_X;
    const goalY = scene.PITCH_HEIGHT / 2;
    const dribbleAngle = Phaser.Math.Angle.Between(player.x, player.y, goalX, goalY);
    const dribbleX = player.x + Math.cos(dribbleAngle) * 60;
    const dribbleY = player.y + Math.sin(dribbleAngle) * 60;
    this.setTarget(player, dribbleX, dribbleY);

    // Push ball with player movement
    if (Phaser.Math.Distance.Between(player.x, player.y, bx, by) < 25) {
      ball.kick(
        Math.cos(dribbleAngle) * 90 + (Math.random() - 0.5) * 20,
        Math.sin(dribbleAngle) * 90 + (Math.random() - 0.5) * 20
      );
    }
  }

  handleSupportRun(player, idx, ball, teamInAttack) {
    const scene = this.scene;
    const role = player.role;

    // Calculate support position based on role
    let targetX, targetY;

    if (teamInAttack) {
      // Move into attacking positions
      if (role === 'forward') {
        // Make run toward goal
        targetX = scene.HOME_GOAL_X + 100 + (idx % 3) * 60;
        targetY = scene.PITCH_HEIGHT * (0.25 + (idx % 4) * 0.15);
      } else if (role === 'midfielder') {
        // Support in midfield
        targetX = scene.PITCH_WIDTH * 0.35 + (idx % 2) * 80;
        targetY = scene.PITCH_HEIGHT * (0.2 + (idx % 5) * 0.16);
      } else {
        // Defenders hold midfield
        targetX = scene.PITCH_WIDTH * 0.55;
        targetY = scene.PITCH_HEIGHT * (0.3 + (idx % 3) * 0.2);
      }
    } else {
      // Defensive shape
      if (role === 'defender') {
        targetX = scene.PITCH_WIDTH * 0.72;
        targetY = scene.PITCH_HEIGHT * (0.2 + (idx % 4) * 0.2);
      } else if (role === 'midfielder') {
        targetX = scene.PITCH_WIDTH * 0.60;
        targetY = scene.PITCH_HEIGHT * (0.25 + (idx % 3) * 0.25);
      } else {
        // Forwards track back a little
        targetX = scene.PITCH_WIDTH * 0.55;
        targetY = scene.PITCH_HEIGHT * (0.3 + (idx % 2) * 0.4);
      }
    }

    // Add some randomness to prevent robots
    targetX += (Math.random() - 0.5) * 30;
    targetY += (Math.random() - 0.5) * 30;
    targetY = Phaser.Math.Clamp(targetY, 20, scene.PITCH_HEIGHT - 20);

    this.setTarget(player, targetX, targetY);
  }

  pressPlayer(player, ballX, ballY, homePlayers) {
    // Move toward ball to win possession
    this.setTarget(player, ballX + (Math.random() - 0.5) * 10, ballY + (Math.random() - 0.5) * 10);
  }

  handleDefensivePosition(player, idx, ball, homePlayers, ballInAwayhalf) {
    const scene = this.scene;
    const ballX = ball.x;
    const ballY = ball.y;
    const role = player.role;

    // Defensive positions (mirrored from home side)
    let targetX, targetY;

    // Track ball Y position with some lag
    const trackY = ballY * 0.6 + scene.PITCH_HEIGHT * 0.5 * 0.4;

    if (role === 'defender') {
      // Stay back and protect goal
      targetX = scene.PITCH_WIDTH * 0.68 + (ballInAwayhalf ? 0.08 : 0) * scene.PITCH_WIDTH;
      targetY = trackY + (idx - 2) * 70;
    } else if (role === 'midfielder') {
      // Press in midfield
      targetX = Phaser.Math.Clamp(ballX + 100, scene.PITCH_WIDTH * 0.52, scene.PITCH_WIDTH * 0.72);
      targetY = trackY + (idx - 5) * 60;
    } else {
      // Forwards press high
      targetX = Phaser.Math.Clamp(ballX + 50, scene.PITCH_WIDTH * 0.45, scene.PITCH_WIDTH * 0.65);
      targetY = trackY + (idx - 8) * 80;
    }

    targetY = Phaser.Math.Clamp(targetY, 20, scene.PITCH_HEIGHT - 20);
    this.setTarget(player, targetX, targetY);
  }

  aiShoot(player, ball) {
    const scene = this.scene;
    const goalX = scene.HOME_GOAL_X;
    const accuracy = this.params.shootingAccuracy;

    // Aim at goal with accuracy variance
    const spread = (1 - accuracy) * 80;
    const goalY = scene.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * (scene.GOAL_HEIGHT + spread);

    const angle = Phaser.Math.Angle.Between(player.x, player.y, goalX, goalY);
    const power = 0.6 + Math.random() * 0.4;
    const shotSpeed = 200 + power * 380;

    ball.kick(
      Math.cos(angle) * shotSpeed,
      Math.sin(angle) * shotSpeed
    );
    ball.lastTouched = player;
    ball.isShotOnGoal = true;
  }

  aiPass(player, ball, target) {
    const accuracy = this.params.passingAccuracy;
    const spread = (1 - accuracy) * 60;

    const targetX = target.x + (Math.random() - 0.5) * spread;
    const targetY = target.y + (Math.random() - 0.5) * spread;

    const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
    const passSpeed = 240 + Math.random() * 60;

    ball.kick(
      Math.cos(angle) * passSpeed,
      Math.sin(angle) * passSpeed
    );
    ball.lastTouched = player;
  }

  findBestPassTarget(player, teammates) {
    let best = null;
    let bestScore = -Infinity;

    teammates.forEach(t => {
      if (t === player) return;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y);
      if (dist < 30 || dist > 350) return;

      // Prefer players ahead (toward home goal = lower X)
      const progress = player.x - t.x; // lower X = further toward home goal
      const score = progress * 0.6 - dist * 0.15 + Math.random() * 25;

      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    });

    return best;
  }

  setTarget(player, x, y) {
    const state = this.playerStates.get(player) || {};
    state.targetX = x;
    state.targetY = y;
    this.playerStates.set(player, state);
    player.moveTo(x, y, this.params.speed);
  }

  executeMoveToTarget(player) {
    const state = this.playerStates.get(player);
    if (state && state.targetX !== undefined) {
      player.moveTo(state.targetX, state.targetY, this.params.speed);
    }
  }
}

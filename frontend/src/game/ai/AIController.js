export default class AIController {
  constructor(scene, difficulty = 'medium') {
    this.scene = scene;
    this.difficulty = difficulty;

    const params = {
      easy: {
        reactionDelay:    650,
        passingAccuracy:  0.58,
        shootingAccuracy: 0.48,
        passFrequency:    0.38,
        shootFrequency:   0.28,
        speed:            0.80,
        tackleRange:      26,
        pressRadius:      160,
      },
      medium: {
        reactionDelay:    320,
        passingAccuracy:  0.78,
        shootingAccuracy: 0.70,
        passFrequency:    0.58,
        shootFrequency:   0.52,
        speed:            0.95,
        tackleRange:      36,
        pressRadius:      220,
      },
      hard: {
        reactionDelay:    120,
        passingAccuracy:  0.93,
        shootingAccuracy: 0.86,
        passFrequency:    0.75,
        shootFrequency:   0.68,
        speed:            1.08,
        tackleRange:      44,
        pressRadius:      300,
      },
    };

    this.params = params[difficulty] || params.medium;
    this.playerStates = new Map();

    this.updateInterval   = this.params.reactionDelay;
    this.timeSinceUpdate  = 0;

    // Per-player decision cooldown so they don't spam pass/shoot
    this.decisionTimers = new Map();
  }

  update(awayPlayers, homePlayers, ball, delta) {
    const scene = this.scene;

    // Tick decision timers
    awayPlayers.forEach(p => {
      const t = (this.decisionTimers.get(p) || 0) - delta;
      this.decisionTimers.set(p, Math.max(0, t));
    });

    this.timeSinceUpdate += delta;

    // Always move players toward their targets each frame
    awayPlayers.forEach((p, idx) => {
      if (idx === 0) return;
      this.executeMoveToTarget(p);
    });

    // Recalculate decisions at difficulty-gated intervals
    if (this.timeSinceUpdate < this.updateInterval) return;
    this.timeSinceUpdate = 0;

    const ballX  = ball.x;
    const ballY  = ball.y;
    const possessor = scene.ballPossessor;

    // Try to pick up loose ball
    if (!possessor) {
      let nearest = null;
      let minDist = Infinity;
      awayPlayers.forEach((p, idx) => {
        if (idx === 0) return;
        const d = Phaser.Math.Distance.Between(p.x, p.y, ballX, ballY);
        if (d < minDist) { minDist = d; nearest = p; }
      });
      if (nearest && minDist < this.params.tackleRange + 6) {
        scene.setBallPossessor(nearest);
      }
    }

    // Attempt tackle on home possessor
    if (possessor && possessor.side === 'home') {
      awayPlayers.forEach((p, idx) => {
        if (idx === 0) return;
        const d = Phaser.Math.Distance.Between(p.x, p.y, possessor.x, possessor.y);
        if (d < this.params.tackleRange && scene.tackleCooldown <= 0) {
          scene.releasePossession();
          ball.kick((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160);
          ball.lastTouched = p;
          scene.tackleCooldown = 500;
        }
      });
    }

    // Determine if away team has possession
    const awayHasPossession = possessor?.side === 'away';
    const ballInAwayhalf    = ballX > scene.PITCH_WIDTH / 2;

    // Update GK separately
    this.updateGoalkeeper(awayPlayers[0], ball, homePlayers);

    // Update outfield players
    awayPlayers.forEach((player, idx) => {
      if (idx === 0) return;

      if (scene.ballPossessor === player) {
        // This player has the ball
        if (this.decisionTimers.get(player) <= 0) {
          this.handleBallCarrier(player, ball, awayPlayers, homePlayers);
          this.decisionTimers.set(player, this.params.reactionDelay);
        }
        // Always dribble toward goal while holding
        this.dribbleTowardGoal(player, ball);
      } else if (awayHasPossession) {
        this.handleSupportRun(player, idx, ball, true);
      } else {
        const distToBall = Phaser.Math.Distance.Between(player.x, player.y, ballX, ballY);
        const isNearest = this.isNearestAwayToBall(player, awayPlayers, ballX, ballY);
        // Nearest player presses; second-nearest closes off passing lane; rest hold shape
        if (isNearest && distToBall < this.params.pressRadius) {
          this.setTarget(player, ballX, ballY);
        } else if (this.isSecondNearestAwayToBall(player, awayPlayers, ballX, ballY)) {
          // Close off space between ball and goal
          const tx = (ballX + scene.AWAY_GOAL_X) / 2 + (Math.random() - 0.5) * 40;
          const ty = ballY + (Math.random() - 0.5) * 55;
          this.setTarget(player, tx, ty);
        } else {
          this.handleDefensivePosition(player, idx, ball, ballInAwayhalf);
        }
      }
    });
  }

  handleBallCarrier(player, ball, awayPlayers, homePlayers) {
    const scene = this.scene;
    const distToGoal = Math.abs(player.x - scene.HOME_GOAL_X);

    // Shoot if in range
    if (distToGoal < 300 && Math.random() < this.params.shootFrequency) {
      this.aiShoot(player, ball);
      return;
    }

    // Pass if good option exists
    if (Math.random() < this.params.passFrequency) {
      const target = this.findBestPassTarget(player, awayPlayers);
      if (target) {
        this.aiPass(player, ball, target);
        return;
      }
    }
    // Otherwise keep dribbling (handled by dribbleTowardGoal each frame)
  }

  dribbleTowardGoal(player, ball) {
    const scene = this.scene;
    if (scene.ballPossessor !== player) return;

    // Move toward goal — the ball follows automatically via updateBallWithPossessor
    const goalX = scene.HOME_GOAL_X;
    const goalY = scene.PITCH_HEIGHT / 2;
    const angle = Phaser.Math.Angle.Between(player.x, player.y, goalX, goalY);

    // Slight randomness to avoid perfectly straight line
    const jitterX = goalX + (Math.random() - 0.5) * 60;
    const jitterY = goalY + (Math.random() - 0.5) * 80;
    this.setTarget(player, jitterX, jitterY);
  }

  handleSupportRun(player, idx, ball, teamInAttack) {
    const scene = this.scene;
    const role = player.role;
    let tx, ty;

    if (teamInAttack) {
      if (role === 'forward') {
        tx = scene.HOME_GOAL_X + 80 + ((idx % 3) * 55);
        ty = scene.PITCH_HEIGHT * (0.25 + (idx % 4) * 0.16);
      } else if (role === 'midfielder') {
        tx = scene.PITCH_WIDTH * 0.38 + ((idx % 2) * 90);
        ty = scene.PITCH_HEIGHT * (0.22 + (idx % 5) * 0.14);
      } else {
        tx = scene.PITCH_WIDTH * 0.56;
        ty = scene.PITCH_HEIGHT * (0.28 + (idx % 3) * 0.22);
      }
    } else {
      if (role === 'defender') {
        tx = scene.PITCH_WIDTH * 0.70;
        ty = scene.PITCH_HEIGHT * (0.22 + (idx % 4) * 0.19);
      } else if (role === 'midfielder') {
        tx = scene.PITCH_WIDTH * 0.60;
        ty = scene.PITCH_HEIGHT * (0.28 + (idx % 3) * 0.22);
      } else {
        tx = scene.PITCH_WIDTH * 0.54;
        ty = scene.PITCH_HEIGHT * (0.32 + (idx % 2) * 0.36);
      }
    }

    tx += (Math.random() - 0.5) * 30;
    ty  = Phaser.Math.Clamp(ty + (Math.random() - 0.5) * 30, 20, scene.PITCH_HEIGHT - 20);
    this.setTarget(player, tx, ty);
  }

  handleDefensivePosition(player, idx, ball, ballInAwayhalf) {
    const scene = this.scene;
    const trackY = ball.y * 0.55 + scene.PITCH_HEIGHT * 0.5 * 0.45;
    const role = player.role;
    let tx, ty;

    if (role === 'defender') {
      tx = scene.PITCH_WIDTH * 0.70 + (ballInAwayhalf ? scene.PITCH_WIDTH * 0.06 : 0);
      ty = trackY + (idx - 2) * 68;
    } else if (role === 'midfielder') {
      tx = Phaser.Math.Clamp(ball.x + 90, scene.PITCH_WIDTH * 0.52, scene.PITCH_WIDTH * 0.74);
      ty = trackY + (idx - 5) * 58;
    } else {
      tx = Phaser.Math.Clamp(ball.x + 50, scene.PITCH_WIDTH * 0.46, scene.PITCH_WIDTH * 0.64);
      ty = trackY + (idx - 8) * 75;
    }

    ty = Phaser.Math.Clamp(ty, 20, scene.PITCH_HEIGHT - 20);
    this.setTarget(player, tx, ty);
  }

  updateGoalkeeper(gk, ball, homePlayers) {
    if (!gk) return;
    const scene = this.scene;
    const bx = ball.x;
    const by = ball.y;

    const homeGoalX = scene.HOME_GOAL_X + 28;
    const distToGoal = Math.abs(bx - scene.PITCH_WIDTH);

    if (bx > scene.PITCH_WIDTH * 0.6) {
      // Ball is far — stay on line, track Y
      const targetY = Phaser.Math.Clamp(by, scene.GOAL_TOP + 10, scene.GOAL_BOTTOM - 10);
      gk.moveTo(homeGoalX, targetY, this.params.speed * 0.9);
    } else {
      // Ball is close — come off line a bit
      const targetX = Phaser.Math.Clamp(homeGoalX + (scene.PITCH_WIDTH / 2 - bx) * 0.06, homeGoalX - 10, homeGoalX + 50);
      const targetY = Phaser.Math.Clamp(by, scene.GOAL_TOP + 8, scene.GOAL_BOTTOM - 8);
      gk.moveTo(targetX, targetY, this.params.speed * 1.0);

      // GK saves: if ball is heading toward goal, kick it away
      const ballVx = ball.sprite.body.velocity.x;
      if (ballVx < -80 && scene.ballPossessor === null) {
        const distBallToGK = Phaser.Math.Distance.Between(gk.x, gk.y, bx, by);
        if (distBallToGK < 40) {
          const clearAngle = Phaser.Math.Angle.Between(gk.x, gk.y, scene.PITCH_WIDTH * 0.6, by + (Math.random() - 0.5) * 120);
          ball.kick(Math.cos(clearAngle) * 380, Math.sin(clearAngle) * 380);
          ball.lastTouched = gk;
        }
      }
    }
  }

  aiShoot(player, ball) {
    const scene = this.scene;
    scene.releasePossession();

    const acc = this.params.shootingAccuracy;
    const spread = (1 - acc) * 85;
    const goalY = scene.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * (scene.GOAL_HEIGHT + spread);
    const angle = Phaser.Math.Angle.Between(player.x, player.y, scene.HOME_GOAL_X, goalY);
    const power = 0.60 + Math.random() * 0.40;

    ball.kick(Math.cos(angle) * (280 + power * 380), Math.sin(angle) * (280 + power * 380));
    ball.lastTouched = player;
    ball.isShotOnGoal = true;
  }

  aiPass(player, ball, target) {
    const scene = this.scene;
    scene.releasePossession();

    const acc = this.params.passingAccuracy;
    const spread = (1 - acc) * 55;
    const tx = target.x + (Math.random() - 0.5) * spread;
    const ty = target.y + (Math.random() - 0.5) * spread;
    const dist = Phaser.Math.Distance.Between(player.x, player.y, tx, ty);
    const angle = Phaser.Math.Angle.Between(player.x, player.y, tx, ty);
    const spd = Phaser.Math.Clamp(160 + dist * 0.75, 200, 360);

    ball.kick(Math.cos(angle) * spd, Math.sin(angle) * spd);
    ball.lastTouched = player;
  }

  findBestPassTarget(player, teammates) {
    let best = null;
    let bestScore = -Infinity;

    teammates.forEach(t => {
      if (t === player) return;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y);
      if (dist < 35 || dist > 380) return;
      const progress = player.x - t.x; // lower X = toward home goal
      const score = progress * 0.55 - dist * 0.12 + Math.random() * 22;
      if (score > bestScore) { bestScore = score; best = t; }
    });

    return best;
  }

  isNearestAwayToBall(player, awayPlayers, bx, by) {
    let minDist = Infinity;
    let nearest = null;
    awayPlayers.forEach((p, idx) => {
      if (idx === 0) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, bx, by);
      if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest === player;
  }

  isSecondNearestAwayToBall(player, awayPlayers, bx, by) {
    const sorted = awayPlayers
      .filter((_, i) => i !== 0)
      .map(p => ({ p, d: Phaser.Math.Distance.Between(p.x, p.y, bx, by) }))
      .sort((a, b) => a.d - b.d);
    return sorted.length >= 2 && sorted[1].p === player;
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
    if (state?.targetX !== undefined) {
      player.moveTo(state.targetX, state.targetY, this.params.speed);
    }
  }
}

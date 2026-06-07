import Player from '../objects/Player.js';
import Ball from '../objects/Ball.js';
import Goalkeeper from '../objects/Goalkeeper.js';
import Pitch from '../objects/Pitch.js';
import AIController from '../ai/AIController.js';
import { setupControls } from '../utils/controls.js';

// Formation positions (normalized 0-1 relative to pitch half)
const FORMATION_433 = [
  // Defenders
  { x: 0.15, y: 0.25, role: 'defender' },
  { x: 0.15, y: 0.45, role: 'defender' },
  { x: 0.15, y: 0.65, role: 'defender' },
  { x: 0.15, y: 0.80, role: 'defender' },
  // Midfielders
  { x: 0.40, y: 0.20, role: 'midfielder' },
  { x: 0.40, y: 0.50, role: 'midfielder' },
  { x: 0.40, y: 0.80, role: 'midfielder' },
  // Forwards
  { x: 0.70, y: 0.25, role: 'forward' },
  { x: 0.70, y: 0.50, role: 'forward' },
  { x: 0.70, y: 0.75, role: 'forward' },
];

export default class MatchScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MatchScene' });
  }

  init(data) {
    this.matchConfig = data || {};
    this.homeTeam = data?.homeTeam || { primaryColor: '#FF2222', secondaryColor: '#FFFFFF', name: 'Home', shortName: 'HME', rating: 75 };
    this.awayTeam = data?.awayTeam || { primaryColor: '#2244FF', secondaryColor: '#FFFFFF', name: 'Away', shortName: 'AWY', rating: 75 };
    this.matchDuration = (data?.matchDuration || 5) * 60; // convert minutes to seconds
    this.vsAI = data?.vsAI !== false;
    this.difficulty = data?.difficulty || 'medium';
  }

  create() {
    // Pitch dimensions
    this.PITCH_WIDTH = 1050;
    this.PITCH_HEIGHT = 680;
    this.PITCH_X = 0;
    this.PITCH_Y = 0;

    // Goal dimensions
    this.GOAL_WIDTH = 120;
    this.GOAL_HEIGHT = 80;
    this.GOAL_DEPTH = 20;

    // Goal line positions
    this.HOME_GOAL_X = this.PITCH_X + 10;
    this.AWAY_GOAL_X = this.PITCH_X + this.PITCH_WIDTH - 10;
    this.GOAL_TOP = this.PITCH_Y + this.PITCH_HEIGHT / 2 - this.GOAL_HEIGHT / 2;
    this.GOAL_BOTTOM = this.PITCH_Y + this.PITCH_HEIGHT / 2 + this.GOAL_HEIGHT / 2;

    // Penalty area
    this.HOME_PENALTY_RIGHT = this.PITCH_X + 165;
    this.AWAY_PENALTY_LEFT = this.PITCH_X + this.PITCH_WIDTH - 165;
    this.PENALTY_TOP = this.PITCH_Y + this.PITCH_HEIGHT / 2 - 125;
    this.PENALTY_BOTTOM = this.PITCH_Y + this.PITCH_HEIGHT / 2 + 125;

    // Game state
    this.score = { home: 0, away: 0 };
    this.timeRemaining = this.matchDuration;
    this.gamePhase = 'kickoff'; // kickoff, playing, goal, halftime, fulltime, paused
    this.halfTime = false;
    this.lastGoalBy = null;
    this.shootPower = 0;
    this.isCharging = false;
    this.shootChargeTime = 0;
    this.controlledPlayer = null;
    this.controlledTeam = 'home';

    // Physics world bounds
    this.physics.world.setBounds(
      this.PITCH_X, this.PITCH_Y,
      this.PITCH_WIDTH, this.PITCH_HEIGHT
    );

    // Camera setup
    this.cameras.main.setBounds(
      this.PITCH_X, this.PITCH_Y,
      this.PITCH_WIDTH, this.PITCH_HEIGHT
    );
    this.cameras.main.setZoom(0.75);
    this.cameras.main.centerOn(this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);

    // Create pitch
    this.pitch = new Pitch(this);

    // Create physics groups
    this.homePlayers = this.physics.add.group();
    this.awayPlayers = this.physics.add.group();

    // Create ball
    this.ball = new Ball(this, this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);

    // Create players
    this.homePlayerList = [];
    this.awayPlayerList = [];

    // Home goalkeeper
    const homeGK = new Goalkeeper(this, this.HOME_GOAL_X + 25, this.PITCH_HEIGHT / 2, 'home', this.homeTeam, 1);
    this.homePlayerList.push(homeGK);
    this.homePlayers.add(homeGK.sprite);

    // Away goalkeeper
    const awayGK = new Goalkeeper(this, this.AWAY_GOAL_X - 25, this.PITCH_HEIGHT / 2, 'away', this.awayTeam, 1);
    this.awayPlayerList.push(awayGK);
    this.awayPlayers.add(awayGK.sprite);

    // Home outfield players
    FORMATION_433.forEach((pos, i) => {
      const px = this.PITCH_X + pos.x * (this.PITCH_WIDTH / 2);
      const py = this.PITCH_Y + pos.y * this.PITCH_HEIGHT;
      const p = new Player(this, px, py, 'home', this.homeTeam, i + 2, pos.role);
      this.homePlayerList.push(p);
      this.homePlayers.add(p.sprite);
    });

    // Away outfield players (mirrored)
    FORMATION_433.forEach((pos, i) => {
      const px = this.PITCH_X + this.PITCH_WIDTH - pos.x * (this.PITCH_WIDTH / 2);
      const py = this.PITCH_Y + pos.y * this.PITCH_HEIGHT;
      const p = new Player(this, px, py, 'away', this.awayTeam, i + 2, pos.role);
      this.awayPlayerList.push(p);
      this.awayPlayers.add(p.sprite);
    });

    // Set initial controlled player (nearest to ball = center forward)
    this.controlledPlayer = this.homePlayerList[7]; // center forward
    if (this.controlledPlayer) {
      this.controlledPlayer.setControlled(true);
    }

    // AI Controller
    this.aiController = new AIController(this, this.difficulty);

    // Ball physics collisions - use overlap instead of collider for softer feel
    this.homePlayerList.forEach(p => {
      this.physics.add.overlap(p.sprite, this.ball.sprite, () => {
        this.handleBallContact(p);
      });
    });

    this.awayPlayerList.forEach(p => {
      this.physics.add.overlap(p.sprite, this.ball.sprite, () => {
        this.handleBallContact(p);
      });
    });

    // Setup keyboard controls
    this.controls = setupControls(this);

    // Setup mobile controls
    this.setupMobileControls();

    // HUD elements (rendered in scene, React HUD overlay also used)
    this.setupHUD();

    // Camera follows ball
    this.cameras.main.startFollow(this.ball.sprite, true, 0.1, 0.1);

    // Kickoff sequence
    this.startKickoff(true);

    // Event emitter for React HUD
    this.events.emit('scoreUpdate', this.score);
    this.events.emit('timeUpdate', this.timeRemaining);

    // Timer
    this.matchTimer = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    });
  }

  tickTimer() {
    if (this.gamePhase !== 'playing') return;

    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    this.events.emit('timeUpdate', this.timeRemaining);
    this.updateTimerDisplay();

    if (this.timeRemaining <= 0) {
      if (!this.halfTime) {
        this.halfTime = true;
        this.startHalfTime();
      } else {
        this.endMatch();
      }
    }
  }

  startKickoff(isFirstHalf) {
    this.gamePhase = 'kickoff';

    // Reset ball to center
    this.ball.reset(this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);

    // Reset players to formation positions
    this.resetPlayersToFormation();

    // Show kickoff message
    this.showMessage('KICK OFF!', 2000, () => {
      this.gamePhase = 'playing';
    });
  }

  startHalfTime() {
    this.gamePhase = 'halftime';
    this.timeRemaining = this.matchDuration;
    this.showMessage('HALF TIME!', 3000, () => {
      // Swap sides
      this.swapSides();
      this.startKickoff(false);
    });
  }

  endMatch() {
    this.gamePhase = 'fulltime';
    this.matchTimer.remove();

    const homeScore = this.score.home;
    const awayScore = this.score.away;
    let resultText = 'DRAW!';
    if (homeScore > awayScore) resultText = `${this.homeTeam.shortName} WIN!`;
    if (awayScore > homeScore) resultText = `${this.awayTeam.shortName} WIN!`;

    this.showMessage(`FULL TIME!\n${homeScore} - ${awayScore}\n${resultText}`, 0);

    // Notify React parent
    this.events.emit('matchEnd', {
      score: this.score,
      homeTeam: this.homeTeam,
      awayTeam: this.awayTeam,
    });
  }

  resetPlayersToFormation() {
    // Reset home goalkeeper
    const homeGK = this.homePlayerList[0];
    if (homeGK) homeGK.setPosition(this.HOME_GOAL_X + 25, this.PITCH_HEIGHT / 2);

    // Reset away goalkeeper
    const awayGK = this.awayPlayerList[0];
    if (awayGK) awayGK.setPosition(this.AWAY_GOAL_X - 25, this.PITCH_HEIGHT / 2);

    // Reset outfield players
    FORMATION_433.forEach((pos, i) => {
      const homeP = this.homePlayerList[i + 1];
      if (homeP) {
        homeP.setPosition(
          this.PITCH_X + pos.x * (this.PITCH_WIDTH / 2),
          this.PITCH_Y + pos.y * this.PITCH_HEIGHT
        );
      }

      const awayP = this.awayPlayerList[i + 1];
      if (awayP) {
        awayP.setPosition(
          this.PITCH_X + this.PITCH_WIDTH - pos.x * (this.PITCH_WIDTH / 2),
          this.PITCH_Y + pos.y * this.PITCH_HEIGHT
        );
      }
    });
  }

  swapSides() {
    // Mirror all player positions
    [...this.homePlayerList, ...this.awayPlayerList].forEach(p => {
      const newX = this.PITCH_WIDTH - p.x;
      const newY = p.y;
      p.setPosition(newX, newY);
    });
  }

  handleBallContact(player) {
    if (this.gamePhase !== 'playing') return;

    const ball = this.ball;
    const playerSide = player.side;

    // Track who last touched the ball
    ball.lastTouched = player;

    // If AI player touches ball
    if (this.vsAI && playerSide === 'away') {
      return; // AI handles its own ball interaction via AIController
    }

    // Deflect ball naturally based on player velocity
    const pvx = player.sprite.body.velocity.x;
    const pvy = player.sprite.body.velocity.y;

    // Slightly push ball in player movement direction if they're moving
    const speed = Math.sqrt(pvx * pvx + pvy * pvy);
    if (speed > 20) {
      const nx = pvx / speed;
      const ny = pvy / speed;
      const currentSpeed = ball.getSpeed();
      const blendedSpeed = Math.max(currentSpeed, 80) * 0.7 + speed * 0.3;
      ball.setVelocity(
        nx * blendedSpeed + ball.sprite.body.velocity.x * 0.3,
        ny * blendedSpeed + ball.sprite.body.velocity.y * 0.3
      );
    }
  }

  update(time, delta) {
    if (this.gamePhase === 'fulltime') return;

    const dt = delta / 1000;

    // Update ball
    this.ball.update(delta);

    // Check ball bounds (throw-ins, goal kicks, corners)
    this.checkBallBounds();

    // Check for goals
    this.checkGoal();

    // Update all players
    this.homePlayerList.forEach(p => p.update(delta, this.ball));
    this.awayPlayerList.forEach(p => p.update(delta, this.ball));

    // Handle player input
    if (this.gamePhase === 'playing' || this.gamePhase === 'kickoff') {
      this.handleInput(delta);
    }

    // AI update
    if (this.vsAI && this.gamePhase === 'playing') {
      this.aiController.update(
        this.awayPlayerList,
        this.homePlayerList,
        this.ball,
        delta
      );
    }

    // Auto-switch controlled player to nearest ball carrier
    if (this.gamePhase === 'playing') {
      this.autoSwitchPlayer();
    }

    // Update HUD
    if (this.hudScoreText) {
      this.hudScoreText.setText(`${this.score.home} - ${this.score.away}`);
    }

    // Update mobile joystick
    this.updateMobileControls();
  }

  handleInput(delta) {
    const ctrl = this.controls;
    const player = this.controlledPlayer;
    if (!player) return;

    let vx = 0;
    let vy = 0;
    const speed = player.speed || 180;

    // Movement
    if (ctrl.left.isDown || ctrl.a_key.isDown) vx -= speed;
    if (ctrl.right.isDown || ctrl.d_key.isDown) vx += speed;
    if (ctrl.up.isDown || ctrl.w_key.isDown) vy -= speed;
    if (ctrl.down.isDown || ctrl.s_key.isDown) vy += speed;

    // Mobile joystick override
    if (this.mobileJoystick && this.mobileJoystick.active) {
      vx = this.mobileJoystick.dx * speed;
      vy = this.mobileJoystick.dy * speed;
    }

    // Diagonal speed normalization
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    player.sprite.body.setVelocity(vx, vy);
    player.vx = vx;
    player.vy = vy;

    // Check if player is near ball for actions
    const nearBall = this.isNearBall(player, 40);

    // Pass (A key)
    if (Phaser.Input.Keyboard.JustDown(ctrl.pass_key) || this.mobileBtnPass) {
      if (nearBall) {
        this.doPass(player);
      }
      this.mobileBtnPass = false;
    }

    // Shoot (S key - hold to charge)
    if (ctrl.shoot_key.isDown) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.shootChargeTime = 0;
        this.showShootPowerBar();
      }
      this.shootChargeTime += delta;
      this.shootPower = Math.min(this.shootChargeTime / 800, 1.0);
      this.updateShootPowerBar(this.shootPower);
    } else if (this.isCharging) {
      this.isCharging = false;
      this.hideShootPowerBar();
      if (nearBall || this.distanceToBall(player) < 60) {
        this.doShoot(player, this.shootPower);
      }
      this.shootPower = 0;
      this.shootChargeTime = 0;
    }

    // Mobile shoot button
    if (this.mobileBtnShoot) {
      if (nearBall) {
        this.doShoot(player, 0.85);
      }
      this.mobileBtnShoot = false;
    }

    // Through ball (D key)
    if (Phaser.Input.Keyboard.JustDown(ctrl.through_key) || this.mobileBtnThrough) {
      if (nearBall) {
        this.doThroughBall(player);
      }
      this.mobileBtnThrough = false;
    }

    // Slide tackle (Space)
    if (Phaser.Input.Keyboard.JustDown(ctrl.tackle_key)) {
      this.doTackle(player);
    }

    // Switch player (Tab)
    if (Phaser.Input.Keyboard.JustDown(ctrl.switch_key)) {
      this.manualSwitchPlayer();
    }
  }

  isNearBall(player, range) {
    return this.distanceToBall(player) < range;
  }

  distanceToBall(player) {
    return Phaser.Math.Distance.Between(
      player.x, player.y,
      this.ball.x, this.ball.y
    );
  }

  doPass(player) {
    // Find nearest teammate in good direction
    const teammates = player.side === 'home' ? this.homePlayerList : this.awayPlayerList;
    const target = this.findBestPassTarget(player, teammates);
    if (!target) return;

    const angle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
    const passSpeed = 280 + Math.random() * 40;

    this.ball.kick(
      Math.cos(angle) * passSpeed,
      Math.sin(angle) * passSpeed
    );
    this.ball.lastTouched = player;

    // Camera flash
    this.cameras.main.flash(50, 255, 255, 255, false, null, null);
  }

  doThroughBall(player) {
    // Through ball toward attacking space ahead of a forward
    const teammates = player.side === 'home' ? this.homePlayerList : this.awayPlayerList;
    const forwards = teammates.filter(p => p !== player && p.role === 'forward');
    const target = forwards.length > 0 ? forwards[0] : this.findBestPassTarget(player, teammates);

    if (!target) return;

    // Aim toward where target is running
    const lead = player.side === 'home' ? 80 : -80;
    const targetX = target.x + lead;
    const targetY = target.y;

    const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
    this.ball.kick(
      Math.cos(angle) * 320,
      Math.sin(angle) * 320
    );
    this.ball.lastTouched = player;
  }

  doShoot(player, power) {
    // Shoot toward goal
    const goalX = player.side === 'home' ? this.AWAY_GOAL_X : this.HOME_GOAL_X;
    const goalY = this.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * (this.GOAL_HEIGHT * 0.7);

    const angle = Phaser.Math.Angle.Between(player.x, player.y, goalX, goalY);
    const shotSpeed = 200 + power * 450;

    // Add slight curl
    const curlX = (Math.random() - 0.5) * 60;
    const curlY = (Math.random() - 0.5) * 40;

    this.ball.kick(
      Math.cos(angle) * shotSpeed + curlX,
      Math.sin(angle) * shotSpeed + curlY
    );
    this.ball.lastTouched = player;
    this.ball.isShotOnGoal = true;

    this.cameras.main.shake(150, 0.005);
  }

  doTackle(player) {
    // Slide tackle - push toward ball with speed burst
    const angle = Phaser.Math.Angle.Between(player.x, player.y, this.ball.x, this.ball.y);
    const tackleSpeed = 280;

    player.sprite.body.setVelocity(
      Math.cos(angle) * tackleSpeed,
      Math.sin(angle) * tackleSpeed
    );

    // If close to ball, kick it away
    if (this.distanceToBall(player) < 35) {
      this.ball.kick(
        Math.cos(angle) * 200 + (Math.random() - 0.5) * 100,
        Math.sin(angle) * 200 + (Math.random() - 0.5) * 100
      );
      this.ball.lastTouched = player;
    }

    // Brief stun after tackle
    this.time.delayedCall(300, () => {
      player.sprite.body.setVelocity(0, 0);
    });
  }

  findBestPassTarget(player, teammates) {
    let bestTarget = null;
    let bestScore = -Infinity;

    teammates.forEach(t => {
      if (t === player) return;

      const dist = Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y);
      if (dist < 30) return; // Too close

      // Score based on distance and forward progress
      const forwardProgress = player.side === 'home' ? (t.x - player.x) : (player.x - t.x);
      const score = forwardProgress * 0.5 - dist * 0.1 + Math.random() * 20;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = t;
      }
    });

    return bestTarget;
  }

  autoSwitchPlayer() {
    if (!this.controlledPlayer) return;

    // Switch to nearest home player to the ball
    const ballX = this.ball.x;
    const ballY = this.ball.y;

    // Only auto-switch if current player is far from ball AND another player is much closer
    const currentDist = this.distanceToBall(this.controlledPlayer);
    if (currentDist < 120) return; // Current player is reasonably close

    let nearest = null;
    let minDist = Infinity;

    this.homePlayerList.forEach(p => {
      if (p === this.homePlayerList[0]) return; // Skip GK from auto-switch
      const d = Phaser.Math.Distance.Between(p.x, p.y, ballX, ballY);
      if (d < minDist) {
        minDist = d;
        nearest = p;
      }
    });

    if (nearest && minDist < currentDist * 0.5) {
      this.setControlledPlayer(nearest);
    }
  }

  manualSwitchPlayer() {
    // Cycle through home players
    const idx = this.homePlayerList.indexOf(this.controlledPlayer);
    const next = (idx + 1) % this.homePlayerList.length;
    this.setControlledPlayer(this.homePlayerList[next]);
  }

  setControlledPlayer(player) {
    if (this.controlledPlayer) {
      this.controlledPlayer.setControlled(false);
    }
    this.controlledPlayer = player;
    if (player) {
      player.setControlled(true);
    }
  }

  checkBallBounds() {
    const ball = this.ball;
    const bx = ball.x;
    const by = ball.y;

    // Top/bottom boundary - throw in
    if (by <= this.PITCH_Y + 5) {
      ball.setPosition(bx, this.PITCH_Y + 10);
      ball.setVelocity(ball.sprite.body.velocity.x * 0.5, Math.abs(ball.sprite.body.velocity.y) * 0.8);
      if (this.gamePhase === 'playing') this.doThrowIn(bx, this.PITCH_Y + 10);
    }

    if (by >= this.PITCH_Y + this.PITCH_HEIGHT - 5) {
      ball.setPosition(bx, this.PITCH_Y + this.PITCH_HEIGHT - 10);
      ball.setVelocity(ball.sprite.body.velocity.x * 0.5, -Math.abs(ball.sprite.body.velocity.y) * 0.8);
      if (this.gamePhase === 'playing') this.doThrowIn(bx, this.PITCH_Y + this.PITCH_HEIGHT - 10);
    }

    // Left/right boundary - corner or goal kick
    if (bx <= this.PITCH_X + 5) {
      ball.setPosition(this.PITCH_X + 10, by);
      ball.setVelocity(Math.abs(ball.sprite.body.velocity.x) * 0.8, ball.sprite.body.velocity.y * 0.5);

      // Check if it's not a goal
      if (by < this.GOAL_TOP || by > this.GOAL_BOTTOM) {
        if (this.gamePhase === 'playing') {
          const wasLastTouchedAway = ball.lastTouched && ball.lastTouched.side === 'away';
          if (wasLastTouchedAway) {
            this.doCorner('home');
          } else {
            this.doGoalKick('home');
          }
        }
      }
    }

    if (bx >= this.PITCH_X + this.PITCH_WIDTH - 5) {
      ball.setPosition(this.PITCH_X + this.PITCH_WIDTH - 10, by);
      ball.setVelocity(-Math.abs(ball.sprite.body.velocity.x) * 0.8, ball.sprite.body.velocity.y * 0.5);

      if (by < this.GOAL_TOP || by > this.GOAL_BOTTOM) {
        if (this.gamePhase === 'playing') {
          const wasLastTouchedHome = ball.lastTouched && ball.lastTouched.side === 'home';
          if (wasLastTouchedHome) {
            this.doCorner('away');
          } else {
            this.doGoalKick('away');
          }
        }
      }
    }
  }

  checkGoal() {
    if (this.gamePhase !== 'playing') return;

    const ball = this.ball;
    const bx = ball.x;
    const by = ball.y;

    // Home goal (left side)
    if (
      bx <= this.HOME_GOAL_X + 5 &&
      by >= this.GOAL_TOP &&
      by <= this.GOAL_BOTTOM
    ) {
      this.scoreGoal('away');
      return;
    }

    // Away goal (right side)
    if (
      bx >= this.AWAY_GOAL_X - 5 &&
      by >= this.GOAL_TOP &&
      by <= this.GOAL_BOTTOM
    ) {
      this.scoreGoal('home');
    }
  }

  scoreGoal(team) {
    this.gamePhase = 'goal';
    this.score[team]++;

    this.events.emit('scoreUpdate', { ...this.score });

    // Camera effect
    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(200, 255, 215, 0);

    // Goal visual
    this.showMessage(`GOAL!\n${this.homeTeam.shortName} ${this.score.home} - ${this.score.away} ${this.awayTeam.shortName}`, 3000, () => {
      this.startKickoff(false);
    });

    // Update score display
    if (this.hudScoreText) {
      this.hudScoreText.setText(`${this.score.home} - ${this.score.away}`);
      this.hudScoreText.setStyle({ fill: '#ffd700' });
      this.time.delayedCall(500, () => {
        if (this.hudScoreText) this.hudScoreText.setStyle({ fill: '#ffffff' });
      });
    }
  }

  doThrowIn(x, y) {
    // Simple throw-in: nearest team player throws ball in
    const nearestHome = this.getNearestPlayer(this.homePlayerList, x, y);
    const nearestAway = this.getNearestPlayer(this.awayPlayerList, x, y);

    const dh = Phaser.Math.Distance.Between(nearestHome.x, nearestHome.y, x, y);
    const da = Phaser.Math.Distance.Between(nearestAway.x, nearestAway.y, x, y);

    const thrower = dh < da ? nearestHome : nearestAway;

    // Throw ball to teammate
    const teammates = thrower.side === 'home' ? this.homePlayerList : this.awayPlayerList;
    const target = this.findBestPassTarget(thrower, teammates);

    if (target) {
      const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
      this.time.delayedCall(500, () => {
        this.ball.kick(Math.cos(angle) * 220, Math.sin(angle) * 220);
        this.ball.lastTouched = thrower;
      });
    }
  }

  doCorner(teamSide) {
    // Ball goes to corner
    const cornerX = teamSide === 'home' ? this.PITCH_X + 5 : this.PITCH_X + this.PITCH_WIDTH - 5;
    const cornerY = this.ball.y < this.PITCH_HEIGHT / 2 ? this.PITCH_Y + 5 : this.PITCH_Y + this.PITCH_HEIGHT - 5;

    this.ball.reset(cornerX, cornerY);
    this.showMessage('CORNER!', 1000, () => {
      // Kick toward goal area
      const goalX = teamSide === 'home' ? this.AWAY_GOAL_X : this.HOME_GOAL_X;
      const goalY = this.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * 100;
      const angle = Phaser.Math.Angle.Between(cornerX, cornerY, goalX, goalY);
      this.ball.kick(Math.cos(angle) * 300, Math.sin(angle) * 300);
    });
  }

  doGoalKick(teamSide) {
    // GK gets ball
    const gk = teamSide === 'home' ? this.homePlayerList[0] : this.awayPlayerList[0];
    const gkX = teamSide === 'home' ? this.HOME_GOAL_X + 30 : this.AWAY_GOAL_X - 30;

    this.ball.reset(gkX, this.PITCH_HEIGHT / 2);
    this.showMessage('GOAL KICK', 1000, () => {
      // GK kicks long
      const targetX = teamSide === 'home' ? this.PITCH_WIDTH * 0.6 : this.PITCH_WIDTH * 0.4;
      const targetY = this.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * 150;
      const angle = Phaser.Math.Angle.Between(gkX, this.PITCH_HEIGHT / 2, targetX, targetY);
      this.ball.kick(Math.cos(angle) * 350, Math.sin(angle) * 350);
    });
  }

  getNearestPlayer(players, x, y) {
    let nearest = players[0];
    let minDist = Infinity;
    players.forEach(p => {
      const d = Phaser.Math.Distance.Between(p.x, p.y, x, y);
      if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest;
  }

  showMessage(text, duration, callback) {
    if (this.messageText) this.messageText.destroy();

    this.messageText = this.add.text(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      text,
      {
        fontFamily: 'monospace',
        fontSize: '28px',
        fill: '#ffd700',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    if (duration > 0) {
      this.time.delayedCall(duration, () => {
        if (this.messageText) {
          this.messageText.destroy();
          this.messageText = null;
        }
        if (callback) callback();
      });
    }
  }

  setupHUD() {
    // Score display (in-scene)
    this.hudScoreText = this.add.text(
      this.PITCH_WIDTH / 2, 20,
      `${this.score.home} - ${this.score.away}`,
      {
        fontFamily: 'monospace',
        fontSize: '22px',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(500);

    // Timer display
    this.hudTimerText = this.add.text(
      this.PITCH_WIDTH / 2, 48,
      this.formatTime(this.timeRemaining),
      {
        fontFamily: 'monospace',
        fontSize: '16px',
        fill: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 3,
      }
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(500);

    // Shoot power bar
    this.powerBarBg = this.add.rectangle(
      this.PITCH_WIDTH / 2, this.cameras.main.height - 20,
      200, 12, 0x333333
    ).setScrollFactor(0).setDepth(500).setVisible(false);

    this.powerBarFill = this.add.rectangle(
      this.PITCH_WIDTH / 2 - 100, this.cameras.main.height - 20,
      0, 12, 0xff4444
    ).setScrollFactor(0).setDepth(501).setVisible(false).setOrigin(0, 0.5);

    this.powerBarLabel = this.add.text(
      this.PITCH_WIDTH / 2, this.cameras.main.height - 36,
      'POWER',
      { fontFamily: 'monospace', fontSize: '10px', fill: '#ffffff' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(502).setVisible(false);
  }

  updateTimerDisplay() {
    if (this.hudTimerText) {
      this.hudTimerText.setText(this.formatTime(this.timeRemaining));
      if (this.timeRemaining < 30) {
        this.hudTimerText.setStyle({ fill: '#ff4444' });
      }
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  showShootPowerBar() {
    if (this.powerBarBg) this.powerBarBg.setVisible(true);
    if (this.powerBarFill) this.powerBarFill.setVisible(true);
    if (this.powerBarLabel) this.powerBarLabel.setVisible(true);
  }

  hideShootPowerBar() {
    if (this.powerBarBg) this.powerBarBg.setVisible(false);
    if (this.powerBarFill) this.powerBarFill.setVisible(false);
    if (this.powerBarLabel) this.powerBarLabel.setVisible(false);
  }

  updateShootPowerBar(power) {
    if (this.powerBarFill) {
      this.powerBarFill.setSize(200 * power, 12);
      const color = power < 0.5 ? 0x44ff44 : power < 0.8 ? 0xffaa00 : 0xff2222;
      this.powerBarFill.setFillStyle(color);
    }
  }

  setupMobileControls() {
    // Virtual joystick
    this.mobileJoystick = {
      active: false,
      startX: 0,
      startY: 0,
      dx: 0,
      dy: 0,
      pointerId: -1,
    };

    this.mobileBtnPass = false;
    this.mobileBtnShoot = false;
    this.mobileBtnThrough = false;

    const W = this.scale.width;
    const H = this.scale.height;

    // Joystick base (left side)
    this.joystickBase = this.add.circle(100, H - 120, 60, 0x000000, 0.4)
      .setScrollFactor(0).setDepth(600).setInteractive();
    this.joystickThumb = this.add.circle(100, H - 120, 28, 0xffffff, 0.6)
      .setScrollFactor(0).setDepth(601);

    // Action buttons (right side)
    const btnStyle = { fontFamily: 'monospace', fontSize: '11px', fill: '#ffffff' };

    // Pass button
    const passBtn = this.add.circle(W - 150, H - 80, 35, 0x00aa00, 0.8)
      .setScrollFactor(0).setDepth(600).setInteractive();
    this.add.text(W - 150, H - 80, 'PASS', btnStyle).setOrigin(0.5).setScrollFactor(0).setDepth(601);
    passBtn.on('pointerdown', () => { this.mobileBtnPass = true; });

    // Shoot button
    const shootBtn = this.add.circle(W - 80, H - 140, 35, 0xcc0000, 0.8)
      .setScrollFactor(0).setDepth(600).setInteractive();
    this.add.text(W - 80, H - 140, 'SHOOT', btnStyle).setOrigin(0.5).setScrollFactor(0).setDepth(601);
    shootBtn.on('pointerdown', () => { this.mobileBtnShoot = true; });

    // Through ball button
    const throughBtn = this.add.circle(W - 80, H - 60, 35, 0x0044cc, 0.8)
      .setScrollFactor(0).setDepth(600).setInteractive();
    this.add.text(W - 80, H - 60, 'THRU', btnStyle).setOrigin(0.5).setScrollFactor(0).setDepth(601);
    throughBtn.on('pointerdown', () => { this.mobileBtnThrough = true; });

    // Handle pointer events for joystick
    this.input.on('pointerdown', (pointer) => {
      if (pointer.x < W / 2 && !this.mobileJoystick.active) {
        this.mobileJoystick.active = true;
        this.mobileJoystick.pointerId = pointer.id;
        this.mobileJoystick.startX = pointer.x;
        this.mobileJoystick.startY = pointer.y;
        this.joystickBase.setPosition(pointer.x, pointer.y);
        this.joystickThumb.setPosition(pointer.x, pointer.y);
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (this.mobileJoystick.active && pointer.id === this.mobileJoystick.pointerId) {
        const dx = pointer.x - this.mobileJoystick.startX;
        const dy = pointer.y - this.mobileJoystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 50;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        this.mobileJoystick.dx = (clampedDist / maxDist) * Math.cos(angle);
        this.mobileJoystick.dy = (clampedDist / maxDist) * Math.sin(angle);

        this.joystickThumb.setPosition(
          this.mobileJoystick.startX + Math.cos(angle) * clampedDist,
          this.mobileJoystick.startY + Math.sin(angle) * clampedDist
        );
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (this.mobileJoystick.active && pointer.id === this.mobileJoystick.pointerId) {
        this.mobileJoystick.active = false;
        this.mobileJoystick.dx = 0;
        this.mobileJoystick.dy = 0;
        this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
      }
    });
  }

  updateMobileControls() {
    // Keep joystick in scroll-corrected position
    // (already using setScrollFactor(0) so this is automatic)
  }

  shutdown() {
    if (this.matchTimer) this.matchTimer.remove();
  }
}

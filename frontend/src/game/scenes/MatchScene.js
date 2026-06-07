import Player from '../objects/Player.js';
import Ball from '../objects/Ball.js';
import Goalkeeper from '../objects/Goalkeeper.js';
import Pitch from '../objects/Pitch.js';
import AIController from '../ai/AIController.js';
import { setupControls } from '../utils/controls.js';

const FORMATION_433 = [
  { x: 0.15, y: 0.25, role: 'defender' },
  { x: 0.15, y: 0.42, role: 'defender' },
  { x: 0.15, y: 0.58, role: 'defender' },
  { x: 0.15, y: 0.75, role: 'defender' },
  { x: 0.38, y: 0.20, role: 'midfielder' },
  { x: 0.38, y: 0.50, role: 'midfielder' },
  { x: 0.38, y: 0.80, role: 'midfielder' },
  { x: 0.65, y: 0.28, role: 'forward' },
  { x: 0.65, y: 0.50, role: 'forward' },
  { x: 0.65, y: 0.72, role: 'forward' },
];

export default class MatchScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MatchScene' });
  }

  init(data) {
    this.matchConfig = data || {};
    this.homeTeam = data?.homeTeam || { primaryColor: '#EF0107', secondaryColor: '#FFFFFF', name: 'Home', shortName: 'HME', rating: 75 };
    this.awayTeam = data?.awayTeam || { primaryColor: '#034694', secondaryColor: '#FFFFFF', name: 'Away', shortName: 'AWY', rating: 75 };
    this.matchDuration = (data?.matchDuration || 5) * 60;
    this.vsAI = data?.vsAI !== false;
    this.difficulty = data?.difficulty || 'medium';
  }

  create() {
    this.PITCH_WIDTH  = 1050;
    this.PITCH_HEIGHT = 680;
    this.PITCH_X      = 0;
    this.PITCH_Y      = 0;

    this.GOAL_HEIGHT  = 90;
    this.GOAL_DEPTH   = 24;

    this.HOME_GOAL_X  = this.PITCH_X + 8;
    this.AWAY_GOAL_X  = this.PITCH_X + this.PITCH_WIDTH - 8;
    this.GOAL_TOP     = this.PITCH_HEIGHT / 2 - this.GOAL_HEIGHT / 2;
    this.GOAL_BOTTOM  = this.PITCH_HEIGHT / 2 + this.GOAL_HEIGHT / 2;

    this.HOME_PENALTY_RIGHT = this.PITCH_X + 165;
    this.AWAY_PENALTY_LEFT  = this.PITCH_X + this.PITCH_WIDTH - 165;
    this.PENALTY_TOP        = this.PITCH_HEIGHT / 2 - 130;
    this.PENALTY_BOTTOM     = this.PITCH_HEIGHT / 2 + 130;

    // Game state
    this.score          = { home: 0, away: 0 };
    this.timeRemaining  = this.matchDuration;
    this.gamePhase      = 'kickoff';
    this.halfTime       = false;
    this.shootPower     = 0;
    this.isCharging     = false;
    this.shootChargeTime = 0;
    this.controlledPlayer = null;

    // POSSESSION — the fundamental mechanic
    // When set, the ball follows this player each frame
    this.ballPossessor = null;

    // Cooldowns to prevent instant re-tackle or possession flicker
    this.tackleCooldown = 0;
    this.possessionGracePeriod = 0; // frames after a kick before pickup allowed

    this.physics.world.setBounds(
      this.PITCH_X, this.PITCH_Y,
      this.PITCH_WIDTH, this.PITCH_HEIGHT
    );

    this.cameras.main.setBounds(
      this.PITCH_X, this.PITCH_Y,
      this.PITCH_WIDTH, this.PITCH_HEIGHT
    );
    this.cameras.main.setZoom(0.78);
    this.cameras.main.centerOn(this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);

    this.pitch = new Pitch(this);

    this.homePlayers = this.physics.add.group();
    this.awayPlayers = this.physics.add.group();

    this.ball = new Ball(this, this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);

    this.homePlayerList = [];
    this.awayPlayerList = [];

    // Goalkeepers
    const homeGK = new Goalkeeper(this, this.HOME_GOAL_X + 28, this.PITCH_HEIGHT / 2, 'home', this.homeTeam, 1);
    this.homePlayerList.push(homeGK);
    this.homePlayers.add(homeGK.sprite);

    const awayGK = new Goalkeeper(this, this.AWAY_GOAL_X - 28, this.PITCH_HEIGHT / 2, 'away', this.awayTeam, 1);
    this.awayPlayerList.push(awayGK);
    this.awayPlayers.add(awayGK.sprite);

    // Outfield players
    FORMATION_433.forEach((pos, i) => {
      const hx = this.PITCH_X + pos.x * (this.PITCH_WIDTH / 2);
      const hy = this.PITCH_Y + pos.y * this.PITCH_HEIGHT;
      const hp = new Player(this, hx, hy, 'home', this.homeTeam, i + 2, pos.role);
      this.homePlayerList.push(hp);
      this.homePlayers.add(hp.sprite);

      const ax = this.PITCH_X + this.PITCH_WIDTH - pos.x * (this.PITCH_WIDTH / 2);
      const ay = this.PITCH_Y + pos.y * this.PITCH_HEIGHT;
      const ap = new Player(this, ax, ay, 'away', this.awayTeam, i + 2, pos.role);
      this.awayPlayerList.push(ap);
      this.awayPlayers.add(ap.sprite);
    });

    // Ball overlap detection (for loose ball pickup)
    [...this.homePlayerList, ...this.awayPlayerList].forEach(p => {
      this.physics.add.overlap(p.sprite, this.ball.sprite, () => {
        this.handleBallContact(p);
      });
    });

    this.controls = setupControls(this);
    this.setupMobileControls();
    this.setupHUD();

    this.cameras.main.startFollow(this.ball.sprite, true, 0.08, 0.08);

    this.aiController = new AIController(this, this.difficulty);

    // Start match
    this.startKickoff(true);

    // Timer event (1s ticks)
    this.matchTimer = this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    });
  }

  // ─── POSSESSION ──────────────────────────────────────────────────────────

  setBallPossessor(player) {
    if (this.ballPossessor && this.ballPossessor !== player) {
      // Visual: old possessor loses indicator
    }
    this.ballPossessor = player;
    if (player) {
      this.ball.lastTouched = player;
      // Stop ball physics so it doesn't drift while held
      this.ball.sprite.body.setVelocity(0, 0);
    }
  }

  releasePossession() {
    this.ballPossessor = null;
    // Brief grace period before ball can be picked up again (prevents instant re-possession after kick)
    this.possessionGracePeriod = 250;
  }

  updateBallWithPossessor() {
    const p = this.ballPossessor;
    if (!p) return;

    const vx = p.sprite.body.velocity.x;
    const vy = p.sprite.body.velocity.y;
    const spd = Math.sqrt(vx * vx + vy * vy);

    let bx, by;
    if (spd > 20) {
      const nx = vx / spd;
      const ny = vy / spd;
      bx = p.x + nx * 15;
      by = p.y + ny * 15;
    } else {
      bx = p.x;
      by = p.y + 10;
    }

    this.ball.sprite.setPosition(bx, by);
    this.ball.sprite.body.setVelocity(0, 0);
    this.ball.shadow.setPosition(bx + 3, by + 6);
  }

  handleBallContact(player) {
    if (this.gamePhase !== 'playing' && this.gamePhase !== 'kickoff') return;
    if (this.possessionGracePeriod > 0) return;

    // Already possessing — ignore
    if (this.ballPossessor === player) return;

    if (!this.ballPossessor) {
      // Loose ball — pick it up
      this.setBallPossessor(player);
      // Auto-switch to that player if it's home team
      if (player.side === 'home' && player !== this.homePlayerList[0]) {
        this.setControlledPlayer(player);
      }
      return;
    }

    if (this.ballPossessor.side === player.side) return; // Teammate already has it

    // Opponent has ball — attempt tackle on contact
    if (this.tackleCooldown <= 0) {
      const pDist = Phaser.Math.Distance.Between(
        player.x, player.y,
        this.ballPossessor.x, this.ballPossessor.y
      );
      if (pDist < 28) {
        // Dispossess
        const wasHome = this.ballPossessor.side === 'home';
        this.releasePossession();
        const ang = Phaser.Math.Angle.Between(
          wasHome ? this.homePlayerList[0].x : this.awayPlayerList[0].x,
          this.PITCH_HEIGHT / 2,
          this.ball.x, this.ball.y
        );
        this.ball.kick(
          (Math.random() - 0.5) * 120,
          (Math.random() - 0.5) * 120
        );
        this.ball.lastTouched = player;
        this.tackleCooldown = 400;
      }
    }
  }

  // ─── MATCH FLOW ──────────────────────────────────────────────────────────

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
    this.ballPossessor = null;
    this.ball.reset(this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);
    this.resetPlayersToFormation();

    this.showMessage(isFirstHalf ? 'KICK OFF!' : 'SECOND HALF!', 2000, () => {
      this.gamePhase = 'playing';
      // Give the home center forward possession at kickoff
      const cf = this.homePlayerList[9];
      if (cf) {
        cf.sprite.setPosition(this.PITCH_WIDTH / 2 - 20, this.PITCH_HEIGHT / 2);
        this.setBallPossessor(cf);
        this.setControlledPlayer(cf);
      }
    });
  }

  startHalfTime() {
    this.gamePhase = 'halftime';
    this.ballPossessor = null;
    this.timeRemaining = this.matchDuration;
    this.showMessage('HALF TIME!', 3000, () => {
      this.startKickoff(false);
    });
  }

  endMatch() {
    this.gamePhase = 'fulltime';
    this.ballPossessor = null;
    if (this.matchTimer) this.matchTimer.remove();

    const h = this.score.home;
    const a = this.score.away;
    const result = h > a ? `${this.homeTeam.shortName} WIN!` : a > h ? `${this.awayTeam.shortName} WIN!` : 'DRAW!';
    this.showMessage(`FULL TIME!\n${h} - ${a}\n${result}`, 0);
    this.events.emit('matchEnd', { score: this.score, homeTeam: this.homeTeam, awayTeam: this.awayTeam });
  }

  resetPlayersToFormation() {
    const homeGK = this.homePlayerList[0];
    if (homeGK) homeGK.sprite.setPosition(this.HOME_GOAL_X + 28, this.PITCH_HEIGHT / 2);

    const awayGK = this.awayPlayerList[0];
    if (awayGK) awayGK.sprite.setPosition(this.AWAY_GOAL_X - 28, this.PITCH_HEIGHT / 2);

    FORMATION_433.forEach((pos, i) => {
      const hp = this.homePlayerList[i + 1];
      if (hp) hp.sprite.setPosition(
        this.PITCH_X + pos.x * (this.PITCH_WIDTH / 2),
        this.PITCH_Y + pos.y * this.PITCH_HEIGHT
      );

      const ap = this.awayPlayerList[i + 1];
      if (ap) ap.sprite.setPosition(
        this.PITCH_X + this.PITCH_WIDTH - pos.x * (this.PITCH_WIDTH / 2),
        this.PITCH_Y + pos.y * this.PITCH_HEIGHT
      );
    });

    // Stop all velocities
    [...this.homePlayerList, ...this.awayPlayerList].forEach(p => {
      p.sprite.body.setVelocity(0, 0);
    });
  }

  scoreGoal(team) {
    if (this.gamePhase !== 'playing') return;
    this.gamePhase = 'goal';
    this.ballPossessor = null;
    this.score[team]++;

    this.events.emit('scoreUpdate', { ...this.score });
    this.cameras.main.shake(500, 0.022);
    this.cameras.main.flash(300, 255, 215, 0);

    const h = this.score.home;
    const a = this.score.away;
    this.showMessage(
      `⚽ GOAL!\n${this.homeTeam.shortName} ${h} - ${a} ${this.awayTeam.shortName}`,
      3200,
      () => this.startKickoff(false)
    );

    if (this.hudScoreText) {
      this.hudScoreText.setText(`${h} - ${a}`);
      this.hudScoreText.setStyle({ color: '#ffd700' });
      this.time.delayedCall(800, () => {
        if (this.hudScoreText) this.hudScoreText.setStyle({ color: '#ffffff' });
      });
    }
  }

  // ─── UPDATE LOOP ─────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.gamePhase === 'fulltime') return;

    // Tick cooldowns
    if (this.tackleCooldown > 0) this.tackleCooldown -= delta;
    if (this.possessionGracePeriod > 0) this.possessionGracePeriod -= delta;

    // Ball: follow possessor or run own physics
    if (this.ballPossessor) {
      this.updateBallWithPossessor();
    } else {
      this.ball.update(delta);
    }

    // Player updates
    [...this.homePlayerList, ...this.awayPlayerList].forEach(p => p.update(delta, this.ball));

    if (this.gamePhase === 'playing' || this.gamePhase === 'kickoff') {
      this.handleInput(delta);
    }

    if (this.vsAI && this.gamePhase === 'playing') {
      this.aiController.update(this.awayPlayerList, this.homePlayerList, this.ball, delta);
    }

    if (this.gamePhase === 'playing') {
      this.autoSwitchPlayer();
      this.checkBallBounds();
      this.checkGoal();
    }

    // Sync HUD score
    if (this.hudScoreText) {
      this.hudScoreText.setText(`${this.score.home} - ${this.score.away}`);
    }
  }

  // ─── INPUT ────────────────────────────────────────────────────────────────

  handleInput(delta) {
    const ctrl = this.controls;
    const player = this.controlledPlayer;
    if (!player) return;

    // ── Movement ──
    let vx = 0;
    let vy = 0;
    const spd = (player.speed || 170) * (player.stamina || 1);

    if (ctrl.left.isDown)  vx -= spd;
    if (ctrl.right.isDown) vx += spd;
    if (ctrl.up.isDown)    vy -= spd;
    if (ctrl.down.isDown)  vy += spd;

    // Mobile joystick override
    if (this.mobileJoystick?.active) {
      vx = this.mobileJoystick.dx * spd;
      vy = this.mobileJoystick.dy * spd;
    }

    // Diagonal normalise
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    player.sprite.body.setVelocity(vx, vy);

    // ── Actions ──
    const hasBall = this.ballPossessor === player;

    // Pass (Z)
    if (Phaser.Input.Keyboard.JustDown(ctrl.pass_key) || this.mobileBtnPass) {
      this.mobileBtnPass = false;
      if (hasBall) this.doPass(player);
    }

    // Shoot (X — hold to charge, release to shoot)
    if (ctrl.shoot_key.isDown || this.mobileShootHeld) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.shootChargeTime = 0;
        this.showShootPowerBar();
      }
      this.shootChargeTime += delta;
      this.shootPower = Math.min(this.shootChargeTime / 900, 1.0);
      this.updateShootPowerBar(this.shootPower);
    } else if (this.isCharging) {
      this.isCharging = false;
      this.hideShootPowerBar();
      if (hasBall) {
        this.doShoot(player, this.shootPower);
      }
      this.shootPower = 0;
      this.shootChargeTime = 0;
    }

    // Mobile shoot button (tap = instant shot)
    if (this.mobileBtnShoot) {
      this.mobileBtnShoot = false;
      if (hasBall) this.doShoot(player, 0.85);
    }

    // Through ball (C)
    if (Phaser.Input.Keyboard.JustDown(ctrl.through_key) || this.mobileBtnThrough) {
      this.mobileBtnThrough = false;
      if (hasBall) this.doThroughBall(player);
    }

    // Tackle (Space)
    if (Phaser.Input.Keyboard.JustDown(ctrl.tackle_key)) {
      this.doTackle(player);
    }

    // Switch player (Tab)
    if (Phaser.Input.Keyboard.JustDown(ctrl.switch_key)) {
      this.manualSwitchPlayer();
    }
  }

  // ─── ACTIONS ─────────────────────────────────────────────────────────────

  doPass(player) {
    this.releasePossession();

    const teammates = player.side === 'home' ? this.homePlayerList : this.awayPlayerList;
    const target = this.findBestPassTarget(player, teammates);
    if (!target) return;

    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Proportional pass speed — short passes = softer
    const passSpd = Phaser.Math.Clamp(150 + dist * 0.75, 200, 380);

    this.ball.kick(Math.cos(angle) * passSpd, Math.sin(angle) * passSpd);
    this.ball.lastTouched = player;

    this.cameras.main.flash(35, 255, 255, 255, false);
  }

  doThroughBall(player) {
    this.releasePossession();

    const teammates = player.side === 'home' ? this.homePlayerList : this.awayPlayerList;
    const forwards = teammates.filter(p => p !== player && (p.role === 'forward' || p.role === 'midfielder'));

    // Pick the one furthest forward
    let target = forwards.reduce((best, p) => {
      const prog = player.side === 'home' ? p.x : -p.x;
      const bestProg = player.side === 'home' ? best.x : -best.x;
      return prog > bestProg ? p : best;
    }, forwards[0] || this.findBestPassTarget(player, teammates));

    if (!target) return;

    // Lead the target — send ball into space ahead of them
    const lead = player.side === 'home' ? 90 : -90;
    const targetX = target.x + lead;
    const targetY = target.y + (Math.random() - 0.5) * 30;

    const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);
    this.ball.kick(Math.cos(angle) * 350, Math.sin(angle) * 350);
    this.ball.lastTouched = player;
  }

  doShoot(player, power) {
    this.releasePossession();

    const goalX = player.side === 'home' ? this.AWAY_GOAL_X : this.HOME_GOAL_X;
    // Aim anywhere in the goal mouth with slight inaccuracy at max power
    const spread = power > 0.85 ? 20 : 8;
    const goalY = this.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * (this.GOAL_HEIGHT * 0.7);

    const angle = Phaser.Math.Angle.Between(player.x, player.y, goalX, goalY);
    const shotSpd = 280 + power * 480;

    // Slight curl on powerful shots
    const curlX = power > 0.6 ? (Math.random() - 0.5) * 55 : 0;
    const curlY = power > 0.6 ? (Math.random() - 0.5) * 35 : 0;

    this.ball.kick(
      Math.cos(angle) * shotSpd + curlX,
      Math.sin(angle) * shotSpd + curlY
    );
    this.ball.lastTouched = player;
    this.ball.isShotOnGoal = true;

    this.cameras.main.shake(120, 0.005);
  }

  doTackle(player) {
    if (this.tackleCooldown > 0) return;

    const opponents = player.side === 'home' ? this.awayPlayerList : this.homePlayerList;

    // Find nearest opponent
    let nearest = null;
    let minDist = Infinity;
    opponents.forEach(op => {
      const d = Phaser.Math.Distance.Between(player.x, player.y, op.x, op.y);
      if (d < minDist) { minDist = d; nearest = op; }
    });

    // Lunge toward nearest opponent / ball
    const targetX = nearest ? nearest.x : this.ball.x;
    const targetY = nearest ? nearest.y : this.ball.y;
    const angle = Phaser.Math.Angle.Between(player.x, player.y, targetX, targetY);

    player.sprite.body.setVelocity(
      Math.cos(angle) * 320,
      Math.sin(angle) * 320
    );

    // Attempt dispossession if close enough
    if (nearest && minDist < 40 && this.ballPossessor === nearest) {
      this.releasePossession();
      this.ball.kick(
        Math.cos(angle) * 180 + (Math.random() - 0.5) * 100,
        Math.sin(angle) * 180 + (Math.random() - 0.5) * 100
      );
      this.ball.lastTouched = player;
    }

    this.tackleCooldown = 500;
    this.time.delayedCall(320, () => {
      if (player.sprite?.body) player.sprite.body.setVelocity(0, 0);
    });
  }

  // ─── PLAYER SWITCHING ────────────────────────────────────────────────────

  autoSwitchPlayer() {
    if (!this.controlledPlayer) return;

    // If home player has possession, switch to them immediately
    if (this.ballPossessor?.side === 'home' && this.ballPossessor !== this.controlledPlayer) {
      // Only auto-switch if not GK
      if (this.ballPossessor !== this.homePlayerList[0]) {
        this.setControlledPlayer(this.ballPossessor);
        return;
      }
    }

    // Ball is loose — switch to nearest home outfield player
    if (!this.ballPossessor || this.ballPossessor.side === 'away') {
      const ballX = this.ball.x;
      const ballY = this.ball.y;
      let nearest = null;
      let minDist = Infinity;

      this.homePlayerList.forEach((p, idx) => {
        if (idx === 0) return; // skip GK
        const d = Phaser.Math.Distance.Between(p.x, p.y, ballX, ballY);
        if (d < minDist) { minDist = d; nearest = p; }
      });

      if (nearest) {
        const currentDist = Phaser.Math.Distance.Between(
          this.controlledPlayer.x, this.controlledPlayer.y, ballX, ballY
        );
        // Switch if nearest is clearly closer (not just marginally)
        if (minDist < currentDist - 50 && nearest !== this.controlledPlayer) {
          this.setControlledPlayer(nearest);
        }
      }
    }
  }

  manualSwitchPlayer() {
    const players = this.homePlayerList.filter((_, i) => i !== 0); // exclude GK
    const idx = players.indexOf(this.controlledPlayer);
    const next = players[(idx + 1) % players.length];
    this.setControlledPlayer(next);
  }

  setControlledPlayer(player) {
    if (this.controlledPlayer) this.controlledPlayer.setControlled(false);
    this.controlledPlayer = player;
    if (player) player.setControlled(true);
  }

  // ─── PASS TARGETING ──────────────────────────────────────────────────────

  findBestPassTarget(player, teammates) {
    let best = null;
    let bestScore = -Infinity;

    teammates.forEach(t => {
      if (t === player) return;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, t.x, t.y);
      if (dist < 40 || dist > 420) return;

      // Prefer forward progress + open space
      const progress = player.side === 'home' ? (t.x - player.x) : (player.x - t.x);
      const score = progress * 0.5 - dist * 0.08 + (Math.random() * 15);

      if (score > bestScore) { bestScore = score; best = t; }
    });

    // Fall back to any teammate
    if (!best) {
      teammates.forEach(t => {
        if (t !== player) best = t;
      });
    }

    return best;
  }

  // ─── BALL BOUNDS ─────────────────────────────────────────────────────────

  checkBallBounds() {
    if (this.ballPossessor) return; // Possessor handles it
    const ball = this.ball;
    const bx = ball.x;
    const by = ball.y;

    // Top/bottom — throw in
    if (by <= this.PITCH_Y + 4) {
      ball.setPosition(bx, this.PITCH_Y + 12);
      ball.sprite.body.setVelocity(ball.sprite.body.velocity.x * 0.5, Math.abs(ball.sprite.body.velocity.y) * 0.6);
      this.doThrowIn(bx, this.PITCH_Y + 12, 'top');
    } else if (by >= this.PITCH_Y + this.PITCH_HEIGHT - 4) {
      ball.setPosition(bx, this.PITCH_Y + this.PITCH_HEIGHT - 12);
      ball.sprite.body.setVelocity(ball.sprite.body.velocity.x * 0.5, -Math.abs(ball.sprite.body.velocity.y) * 0.6);
      this.doThrowIn(bx, this.PITCH_Y + this.PITCH_HEIGHT - 12, 'bottom');
    }

    // Left boundary — home goal or corner/goal kick
    if (bx <= this.PITCH_X + 4) {
      if (by >= this.GOAL_TOP && by <= this.GOAL_BOTTOM) return; // Let checkGoal handle
      ball.setPosition(this.PITCH_X + 12, by);
      ball.sprite.body.setVelocity(Math.abs(ball.sprite.body.velocity.x) * 0.6, ball.sprite.body.velocity.y * 0.5);
      const lastHome = ball.lastTouched?.side === 'home';
      lastHome ? this.doGoalKick('home') : this.doCorner('home');
    }

    // Right boundary — away goal or corner/goal kick
    if (bx >= this.PITCH_X + this.PITCH_WIDTH - 4) {
      if (by >= this.GOAL_TOP && by <= this.GOAL_BOTTOM) return;
      ball.setPosition(this.PITCH_X + this.PITCH_WIDTH - 12, by);
      ball.sprite.body.setVelocity(-Math.abs(ball.sprite.body.velocity.x) * 0.6, ball.sprite.body.velocity.y * 0.5);
      const lastAway = ball.lastTouched?.side === 'away';
      lastAway ? this.doGoalKick('away') : this.doCorner('away');
    }
  }

  checkGoal() {
    if (this.gamePhase !== 'playing') return;
    const ball = this.ball;
    const bx = ball.x;
    const by = ball.y;

    if (bx <= this.HOME_GOAL_X + 2 && by >= this.GOAL_TOP && by <= this.GOAL_BOTTOM) {
      this.scoreGoal('away');
    } else if (bx >= this.AWAY_GOAL_X - 2 && by >= this.GOAL_TOP && by <= this.GOAL_BOTTOM) {
      this.scoreGoal('home');
    }
  }

  // ─── SET PIECES ──────────────────────────────────────────────────────────

  doThrowIn(x, y, side) {
    this.time.delayedCall(400, () => {
      if (this.gamePhase !== 'playing') return;
      // Nearest home or away player takes throw
      const all = [...this.homePlayerList, ...this.awayPlayerList];
      const nearest = all.reduce((a, b) => {
        const da = Phaser.Math.Distance.Between(a.x, a.y, x, y);
        const db = Phaser.Math.Distance.Between(b.x, b.y, x, y);
        return da < db ? a : b;
      });
      const team = nearest.side === 'home' ? this.homePlayerList : this.awayPlayerList;
      const target = this.findBestPassTarget(nearest, team);
      if (target) {
        const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
        this.ball.kick(Math.cos(angle) * 230, Math.sin(angle) * 230);
        this.ball.lastTouched = nearest;
      }
    });
  }

  doCorner(teamSide) {
    const cornerX = teamSide === 'home' ? this.PITCH_X + 6 : this.PITCH_X + this.PITCH_WIDTH - 6;
    const cornerY = this.ball.y < this.PITCH_HEIGHT / 2 ? this.PITCH_Y + 6 : this.PITCH_Y + this.PITCH_HEIGHT - 6;
    this.ball.reset(cornerX, cornerY);
    this.showMessage('CORNER!', 900, () => {
      if (this.gamePhase !== 'playing') return;
      const goalX = teamSide === 'home' ? this.AWAY_GOAL_X - 30 : this.HOME_GOAL_X + 30;
      const goalY = this.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * 120;
      const angle = Phaser.Math.Angle.Between(cornerX, cornerY, goalX, goalY);
      this.ball.kick(Math.cos(angle) * 310, Math.sin(angle) * 310);
    });
  }

  doGoalKick(teamSide) {
    const gkX = teamSide === 'home' ? this.HOME_GOAL_X + 35 : this.AWAY_GOAL_X - 35;
    this.ball.reset(gkX, this.PITCH_HEIGHT / 2);
    this.showMessage('GOAL KICK', 900, () => {
      if (this.gamePhase !== 'playing') return;
      const targetX = teamSide === 'home' ? this.PITCH_WIDTH * 0.55 : this.PITCH_WIDTH * 0.45;
      const targetY = this.PITCH_HEIGHT / 2 + (Math.random() - 0.5) * 180;
      const angle = Phaser.Math.Angle.Between(gkX, this.PITCH_HEIGHT / 2, targetX, targetY);
      this.ball.kick(Math.cos(angle) * 360, Math.sin(angle) * 360);
    });
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────

  setupHUD() {
    const cx = this.PITCH_WIDTH / 2;

    this.hudScoreText = this.add.text(cx, 18, `${this.score.home} - ${this.score.away}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(500);

    this.hudTimerText = this.add.text(cx, 48, this.formatTime(this.timeRemaining), {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(500);

    // Controls hint
    this.add.text(8, this.cameras.main.height - 8,
      'ARROWS: move  Z: pass  X: shoot(hold)  C: through  SPACE: tackle  TAB: switch',
      { fontFamily: 'monospace', fontSize: '8px', color: '#888888' }
    ).setOrigin(0, 1).setScrollFactor(0).setDepth(500);

    // Power bar
    const ph = this.cameras.main.height;
    this.powerBarBg = this.add.rectangle(cx, ph - 20, 200, 13, 0x222222)
      .setScrollFactor(0).setDepth(500).setVisible(false);
    this.powerBarFill = this.add.rectangle(cx - 100, ph - 20, 0, 13, 0xff4444)
      .setScrollFactor(0).setDepth(501).setVisible(false).setOrigin(0, 0.5);
    this.powerBarLabel = this.add.text(cx, ph - 36, 'POWER', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(502).setVisible(false);
  }

  updateTimerDisplay() {
    if (!this.hudTimerText) return;
    this.hudTimerText.setText(this.formatTime(this.timeRemaining));
    if (this.timeRemaining < 30) this.hudTimerText.setStyle({ color: '#ff4444' });
  }

  formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  showShootPowerBar() {
    this.powerBarBg?.setVisible(true);
    this.powerBarFill?.setVisible(true);
    this.powerBarLabel?.setVisible(true);
  }

  hideShootPowerBar() {
    this.powerBarBg?.setVisible(false);
    this.powerBarFill?.setVisible(false);
    this.powerBarLabel?.setVisible(false);
  }

  updateShootPowerBar(power) {
    if (!this.powerBarFill) return;
    this.powerBarFill.setSize(200 * power, 13);
    const col = power < 0.5 ? 0x44cc44 : power < 0.8 ? 0xffaa00 : 0xff2222;
    this.powerBarFill.setFillStyle(col);
  }

  showMessage(text, duration, callback) {
    if (this.messageText) this.messageText.destroy();

    this.messageText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      text,
      {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
        backgroundColor: '#00000066',
        padding: { x: 18, y: 10 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

    if (duration > 0) {
      this.time.delayedCall(duration, () => {
        this.messageText?.destroy();
        this.messageText = null;
        callback?.();
      });
    }
  }

  // ─── MOBILE CONTROLS ─────────────────────────────────────────────────────

  setupMobileControls() {
    this.mobileJoystick   = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, pointerId: -1 };
    this.mobileBtnPass    = false;
    this.mobileBtnShoot   = false;
    this.mobileBtnThrough = false;
    this.mobileShootHeld  = false;

    const W = this.scale.width;
    const H = this.scale.height;

    // Joystick
    this.joystickBase  = this.add.circle(100, H - 110, 55, 0x000000, 0.35).setScrollFactor(0).setDepth(600);
    this.joystickThumb = this.add.circle(100, H - 110, 26, 0xffffff, 0.55).setScrollFactor(0).setDepth(601);

    // Action buttons
    const btnText = { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' };

    const passBtn = this.add.circle(W - 150, H - 75, 34, 0x007700, 0.85).setScrollFactor(0).setDepth(600).setInteractive();
    this.add.text(W - 150, H - 75, 'PASS\n(Z)', btnText).setOrigin(0.5).setScrollFactor(0).setDepth(601);
    passBtn.on('pointerdown', () => { this.mobileBtnPass = true; });

    const shootBtn = this.add.circle(W - 75, H - 140, 34, 0xaa0000, 0.85).setScrollFactor(0).setDepth(600).setInteractive();
    this.add.text(W - 75, H - 140, 'SHOOT\n(X)', btnText).setOrigin(0.5).setScrollFactor(0).setDepth(601);
    shootBtn.on('pointerdown', () => { this.mobileShootHeld = true; });
    shootBtn.on('pointerup',   () => { this.mobileBtnShoot = true; this.mobileShootHeld = false; });

    const thrBtn = this.add.circle(W - 75, H - 58, 34, 0x003399, 0.85).setScrollFactor(0).setDepth(600).setInteractive();
    this.add.text(W - 75, H - 58, 'THRU\n(C)', btnText).setOrigin(0.5).setScrollFactor(0).setDepth(601);
    thrBtn.on('pointerdown', () => { this.mobileBtnThrough = true; });

    // Joystick pointer handling
    this.input.on('pointerdown', (ptr) => {
      if (ptr.x < W / 2 && !this.mobileJoystick.active) {
        this.mobileJoystick.active = true;
        this.mobileJoystick.pointerId = ptr.id;
        this.mobileJoystick.startX = ptr.x;
        this.mobileJoystick.startY = ptr.y;
        this.joystickBase.setPosition(ptr.x, ptr.y);
        this.joystickThumb.setPosition(ptr.x, ptr.y);
      }
    });

    this.input.on('pointermove', (ptr) => {
      if (this.mobileJoystick.active && ptr.id === this.mobileJoystick.pointerId) {
        const dx   = ptr.x - this.mobileJoystick.startX;
        const dy   = ptr.y - this.mobileJoystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const max  = 48;
        const clamped = Math.min(dist, max);
        const angle   = Math.atan2(dy, dx);
        this.mobileJoystick.dx = (clamped / max) * Math.cos(angle);
        this.mobileJoystick.dy = (clamped / max) * Math.sin(angle);
        this.joystickThumb.setPosition(
          this.mobileJoystick.startX + Math.cos(angle) * clamped,
          this.mobileJoystick.startY + Math.sin(angle) * clamped
        );
      }
    });

    this.input.on('pointerup', (ptr) => {
      if (ptr.id === this.mobileJoystick.pointerId) {
        this.mobileJoystick.active = false;
        this.mobileJoystick.dx = 0;
        this.mobileJoystick.dy = 0;
        this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
      }
    });
  }

  shutdown() {
    if (this.matchTimer) this.matchTimer.remove();
  }
}

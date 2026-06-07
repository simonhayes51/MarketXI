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

  preload() {
    // Original Sensible World of Soccer audio (converted from RAW → WAV)
    this.load.audio('kick',     '/sounds/kick.wav');
    this.load.audio('whistle',  '/sounds/whistle.wav');
    this.load.audio('goal',     '/sounds/goal.wav');
    this.load.audio('cheer',    '/sounds/cheer.wav');
    this.load.audio('goalkick', '/sounds/goalkick.wav');
    this.load.audio('crowd',    '/sounds/crowd.wav');
    this.load.audio('bounce',   '/sounds/bounce.wav');
  }

  init(data) {
    const cfg = (data && data.homeTeam) ? data : (window.__MATCH_CONFIG__ || {});
    this.homeTeam = cfg.homeTeam || { primaryColor: '#EF0107', secondaryColor: '#FFFFFF', name: 'Arsenal', shortName: 'ARS', rating: 85 };
    this.awayTeam = cfg.awayTeam || { primaryColor: '#034694', secondaryColor: '#FFFFFF', name: 'Chelsea', shortName: 'CHE', rating: 82 };
    this.matchDuration = (cfg.matchDuration || 5) * 60;
    this.vsAI = cfg.vsAI !== false;
    this.difficulty = cfg.difficulty || 'medium';
  }

  generateTeamTextures() {
    const teams = [
      { team: this.homeTeam, side: 'home' },
      { team: this.awayTeam, side: 'away' },
    ];

    teams.forEach(({ team, side }) => {
      const parseHex = (hex) => {
        const h = (hex || '#888888').replace('#', '');
        return parseInt(h, 16);
      };

      const primary = parseHex(team.primaryColor);
      const secondary = parseHex(team.secondaryColor);

      const fill   = side === 'home' ? primary   : secondary;
      const border = side === 'home' ? secondary : primary;
      const dot    = side === 'home' ? secondary : primary;

      // Top-down humanoid player sprite (22×28 px, SS-inspired)
      const pg = this.make.graphics({ add: false });
      // Dark hair circle (depth cue behind head)
      pg.fillStyle(0x1a1000, 1);
      pg.fillCircle(11, 7, 6);
      // Face / head (skin tone)
      pg.fillStyle(0xf0b880, 1);
      pg.fillCircle(11, 6, 5);
      // Shoulders — wide ellipse in kit colour
      pg.fillStyle(fill, 1);
      pg.fillEllipse(11, 16, 20, 10);
      // Lower torso / hips
      pg.fillEllipse(11, 23, 15, 11);
      // Shoulder outline in secondary colour
      pg.lineStyle(2, border, 1);
      pg.strokeEllipse(11, 16, 20, 10);
      // Team badge dot (chest)
      pg.fillStyle(dot, 1);
      pg.fillCircle(11, 15, 3);
      // Shorts / legs (dark navy, two small ovals)
      pg.fillStyle(0x1a1a3a, 0.85);
      pg.fillEllipse(8, 26, 9, 6);
      pg.fillEllipse(14, 26, 9, 6);
      pg.generateTexture(`player_${side}`, 22, 28);
      pg.destroy();

      // Goalkeeper — lime-green kit with white gloves
      const gkG = this.make.graphics({ add: false });
      gkG.fillStyle(0x1a1000, 1);
      gkG.fillCircle(11, 7, 6);
      gkG.fillStyle(0xf0b880, 1);
      gkG.fillCircle(11, 6, 5);
      gkG.fillStyle(0x88dd00, 1); // bright lime green
      gkG.fillEllipse(11, 16, 20, 10);
      gkG.fillEllipse(11, 23, 15, 11);
      gkG.lineStyle(2, 0x000000, 1);
      gkG.strokeEllipse(11, 16, 20, 10);
      // White gloves on each side
      gkG.fillStyle(0xffffff, 1);
      gkG.fillCircle(2, 16, 4);
      gkG.fillCircle(20, 16, 4);
      gkG.fillStyle(0x1a1a3a, 0.85);
      gkG.fillEllipse(8, 26, 9, 6);
      gkG.fillEllipse(14, 26, 9, 6);
      gkG.generateTexture(`gk_${side}`, 22, 28);
      gkG.destroy();
    });

    // Ball texture
    const bg = this.make.graphics({ add: false });
    bg.fillStyle(0xffffff, 1);
    bg.fillCircle(8, 8, 8);
    bg.fillStyle(0x222222, 1);
    bg.fillTriangle(8, 2, 3, 8, 13, 8);
    bg.fillTriangle(2, 11, 7, 16, 4, 6);
    bg.fillTriangle(14, 11, 9, 16, 12, 6);
    bg.generateTexture('ball', 16, 16);
    bg.destroy();

    // Selection arrow texture (yellow downward pointing)
    const ag = this.make.graphics({ add: false });
    ag.fillStyle(0xffff00, 1);
    ag.fillTriangle(8, 14, 0, 0, 16, 0);
    ag.generateTexture('arrow', 16, 14);
    ag.destroy();
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
    this.shootPower        = 0;
    this.isCharging        = false;
    this.shootChargeTime   = 0;
    this.controlledPlayer  = null;
    this.autoSwitchCooldown = 0;
    // After-touch: steer ball briefly after a shot (signature Sensible Soccer mechanic)
    this.afterTouchActive   = false;
    this.afterTouchDuration = 0;

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
    const zoom = window.innerWidth < 600 ? 1.0 : 1.5;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(this.PITCH_WIDTH / 2, this.PITCH_HEIGHT / 2);

    // Generate all textures FIRST before creating any game objects
    this.generateTeamTextures();

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

    this.cameras.main.startFollow(this.ball.sprite, true, 0.1, 0.1);

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

    // Ambient crowd chant (looping, low volume) — original SWOS audio
    try {
      this.crowdSound = this.sound.add('crowd', { loop: true, volume: 0.22 });
      this.crowdSound.play();
    } catch (e) { /* audio blocked — user must interact first */ }
  }

  // ─── SOUND ────────────────────────────────────────────────────────────────

  playSound(key, volume = 0.8) {
    try {
      if (this.sound.get(key)) this.sound.play(key, { volume });
    } catch (e) { /* ignore audio errors */ }
  }

  // ─── POSSESSION ──────────────────────────────────────────────────────────

  setBallPossessor(player) {
    // Clear dot on previous possessor
    if (this.ballPossessor && this.ballPossessor !== player) {
      this.ballPossessor.setPossession?.(false);
    }
    this.ballPossessor = player;
    if (player) {
      this.ball.lastTouched = player;
      this.ball.sprite.body.setVelocity(0, 0);
      player.setPossession?.(true);
    }
  }

  releasePossession() {
    if (this.ballPossessor) {
      this.ballPossessor.setPossession?.(false);
    }
    this.ballPossessor = null;
    this.possessionGracePeriod = 280;
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

    // Use body.reset() so the physics body position stays in sync with the sprite
    // (setPosition alone can desync the body, breaking future overlaps/collisions)
    this.ball.sprite.body.reset(bx, by);
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

    this.playSound('whistle', 0.9);
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
    this.playSound('goal', 1.0);
    this.time.delayedCall(800, () => this.playSound('cheer', 0.8));

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
    if (this.tackleCooldown > 0)        this.tackleCooldown -= delta;
    if (this.possessionGracePeriod > 0) this.possessionGracePeriod -= delta;
    if (this.autoSwitchCooldown > 0)    this.autoSwitchCooldown -= delta;

    // Ball: follow possessor or run own physics
    if (this.ballPossessor) {
      this.afterTouchActive = false; // can't steer when someone holds it
      this.updateBallWithPossessor();
    } else {
      this.ball.update(delta);
      // After-touch — steer the ball briefly after a shot (SS signature mechanic)
      if (this.afterTouchActive) {
        this.afterTouchDuration -= delta;
        if (this.afterTouchDuration <= 0) {
          this.afterTouchActive = false;
        } else {
          this.applyAfterTouch(delta);
        }
      }
    }

    // Player updates
    [...this.homePlayerList, ...this.awayPlayerList].forEach(p => p.update(delta, this.ball));

    // Proximity-based possession — don't rely solely on physics overlap
    // Any player within 20px of a loose ball gets it
    if (!this.ballPossessor && this.possessionGracePeriod <= 0) {
      const bx = this.ball.x;
      const by = this.ball.y;
      let closestPlayer = null;
      let closestDist   = 22; // pickup radius

      const allPlayers = [...this.homePlayerList, ...this.awayPlayerList];
      allPlayers.forEach(p => {
        const d = Phaser.Math.Distance.Between(p.x, p.y, bx, by);
        if (d < closestDist) { closestDist = d; closestPlayer = p; }
      });

      if (closestPlayer) {
        this.setBallPossessor(closestPlayer);
        if (closestPlayer.side === 'home' && closestPlayer !== this.homePlayerList[0]) {
          this.setControlledPlayer(closestPlayer);
        }
      }
    }

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

    const gi = window.__GAME_INPUT__ || {};

    // ── Movement ──
    let vx = 0;
    let vy = 0;
    const spd = (player.speed || 170) * (player.stamina || 1);

    if (ctrl.left.isDown)  vx -= spd;
    if (ctrl.right.isDown) vx += spd;
    if (ctrl.up.isDown)    vy -= spd;
    if (ctrl.down.isDown)  vy += spd;

    // Mobile joystick overrides keyboard when active
    if (gi.jActive) {
      vx = gi.jx * spd;
      vy = gi.jy * spd;
    }

    // Diagonal normalise
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }

    player.sprite.body.setVelocity(vx, vy);

    // ── Actions ──
    const hasBall = this.ballPossessor === player;
    const distToBall = Phaser.Math.Distance.Between(player.x, player.y, this.ball.x, this.ball.y);
    const canAct = hasBall || (distToBall < 35 && this.possessionGracePeriod <= 0 &&
      (!this.ballPossessor || this.ballPossessor.side === 'home'));

    // Pass (Z / mobile)
    if (Phaser.Input.Keyboard.JustDown(ctrl.pass_key) || gi.pass) {
      if (gi) gi.pass = false;
      if (canAct) {
        if (!hasBall) this.setBallPossessor(player);
        this.doPass(player);
      }
    }

    // Shoot (X — hold to charge, release to shoot)
    if (ctrl.shoot_key.isDown || gi.shootHeld) {
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
      if (canAct) {
        if (!hasBall) this.setBallPossessor(player);
        this.doShoot(player, this.shootPower);
      }
      this.shootPower = 0;
      this.shootChargeTime = 0;
    }

    // Mobile tap-shoot (released without holding = one-shot at ~0.8 power)
    if (gi.shoot) {
      if (gi) gi.shoot = false;
      if (canAct) {
        if (!hasBall) this.setBallPossessor(player);
        this.doShoot(player, 0.80);
      }
    }

    // Through ball (C / mobile)
    if (Phaser.Input.Keyboard.JustDown(ctrl.through_key) || gi.through) {
      if (gi) gi.through = false;
      if (canAct) {
        if (!hasBall) this.setBallPossessor(player);
        this.doThroughBall(player);
      }
    }

    // Tackle (Space / mobile)
    if (Phaser.Input.Keyboard.JustDown(ctrl.tackle_key) || gi.tackle) {
      if (gi) gi.tackle = false;
      this.doTackle(player);
    }

    // Switch player (Tab / mobile)
    if (Phaser.Input.Keyboard.JustDown(ctrl.switch_key) || gi.switchPlayer) {
      if (gi) gi.switchPlayer = false;
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

    const passSpd = Phaser.Math.Clamp(150 + dist * 0.75, 200, 380);

    this.ball.kick(Math.cos(angle) * passSpd, Math.sin(angle) * passSpd);
    this.ball.lastTouched = player;
    this.playSound('kick', 0.65);
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
    this.playSound('kick', 0.6);
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
    this.playSound('kick', 1.0);

    // After-touch steering window (SS signature mechanic)
    this.afterTouchActive   = true;
    this.afterTouchDuration = 700;

    this.cameras.main.shake(120, 0.005);
  }

  applyAfterTouch(delta) {
    const gi   = window.__GAME_INPUT__ || {};
    const ctrl = this.controls;

    let fx = 0, fy = 0;
    const force = 360; // steering force (pixels/sec²)

    if (ctrl.left.isDown)  fx -= force;
    if (ctrl.right.isDown) fx += force;
    if (ctrl.up.isDown)    fy -= force;
    if (ctrl.down.isDown)  fy += force;

    if (gi.jActive) {
      if (Math.abs(gi.jx) > 0.2) fx = gi.jx * force;
      if (Math.abs(gi.jy) > 0.2) fy = gi.jy * force;
    }

    if ((fx !== 0 || fy !== 0) && this.ball.sprite.body) {
      const fade = this.afterTouchDuration / 700; // weakens as time expires
      this.ball.sprite.body.velocity.x += fx * fade * (delta / 1000);
      this.ball.sprite.body.velocity.y += fy * fade * (delta / 1000);
    }
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

    // If a home outfield player just gained possession, switch to them immediately
    if (this.ballPossessor?.side === 'home' && this.ballPossessor !== this.homePlayerList[0]) {
      if (this.ballPossessor !== this.controlledPlayer) {
        this.setControlledPlayer(this.ballPossessor);
        this.autoSwitchCooldown = 600;
      }
      return;
    }

    // Ball is loose or away team has it — switch to nearest home outfield player,
    // but use a cooldown so the selection doesn't thrash every frame.
    if (this.autoSwitchCooldown > 0) return;

    const ballX = this.ball.x;
    const ballY = this.ball.y;
    let nearest = null;
    let minDist = Infinity;

    this.homePlayerList.forEach((p, idx) => {
      if (idx === 0) return; // skip GK
      const d = Phaser.Math.Distance.Between(p.x, p.y, ballX, ballY);
      if (d < minDist) { minDist = d; nearest = p; }
    });

    if (nearest && nearest !== this.controlledPlayer) {
      this.setControlledPlayer(nearest);
      this.autoSwitchCooldown = 800;
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
    this.playSound('goalkick', 0.7);
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
  // Controls are handled by the React MobileControls overlay in PhaserGame.jsx.
  // They communicate via window.__GAME_INPUT__ which handleInput() reads.
  setupMobileControls() {
    // No-op — kept so call site doesn't break
  }

  shutdown() {
    if (this.matchTimer) this.matchTimer.remove();
  }
}

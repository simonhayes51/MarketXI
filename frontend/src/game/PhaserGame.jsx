import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HUD from '../components/HUD.jsx';

export default function PhaserGame({ homeTeam, awayTeam, matchDuration, vsAI, difficulty }) {
  const gameContainerRef = useRef(null);
  const gameRef = useRef(null);
  const navigate = useNavigate();
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [timeRemaining, setTimeRemaining] = useState((matchDuration || 5) * 60);
  const [matchOver, setMatchOver] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  useEffect(() => {
    window.__MATCH_CONFIG__ = {
      homeTeam: homeTeam || { primaryColor: '#EF0107', secondaryColor: '#FFFFFF', name: 'Arsenal', shortName: 'ARS', rating: 85 },
      awayTeam: awayTeam || { primaryColor: '#034694', secondaryColor: '#FFFFFF', name: 'Chelsea', shortName: 'CHE', rating: 82 },
      matchDuration: matchDuration || 5,
      vsAI: vsAI !== false,
      difficulty: difficulty || 'medium',
    };

    // Mobile controls communicate via this global — init before Phaser starts
    window.__GAME_INPUT__ = {
      jx: 0, jy: 0, jActive: false,
      pass: false, shoot: false, shootHeld: false,
      through: false, tackle: false, switchPlayer: false,
    };

    let game = null;

    const initPhaser = async () => {
      const Phaser = await import('phaser');
      const { default: MatchScene } = await import('./scenes/MatchScene.js');

      const config = {
        type: Phaser.AUTO,
        parent: gameContainerRef.current,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#1a6b1a',
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 0 }, debug: false },
        },
        scene: [MatchScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: { pixelArt: true, antialias: false },
      };

      game = new Phaser.Game(config);
      gameRef.current = game;

      const waitForScene = setInterval(() => {
        const scene = game.scene.getScene('MatchScene');
        if (scene && scene.sys.isActive()) {
          clearInterval(waitForScene);
          scene.events.on('scoreUpdate', (s) => setScore({ ...s }));
          scene.events.on('timeUpdate', (t) => setTimeRemaining(t));
          scene.events.on('matchEnd', (r) => { setMatchOver(true); setMatchResult(r); });
        }
      }, 200);
    };

    initPhaser();

    const handleResize = () => {
      if (gameRef.current) {
        gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
      window.__GAME_INPUT__ = null;
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#000',
    }}>
      <div
        ref={gameContainerRef}
        style={{ width: '100%', height: '100%' }}
        id="phaser-game"
      />

      <HUD
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        score={score}
        timeRemaining={timeRemaining}
        totalTime={(matchDuration || 5) * 60}
      />

      {matchOver && matchResult && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          fontFamily: 'Press Start 2P',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '16px', letterSpacing: '4px' }}>
            FULL TIME
          </div>
          <div style={{ fontSize: '3rem', color: '#ffd700', marginBottom: '16px', letterSpacing: '8px' }}>
            {matchResult.score.home} - {matchResult.score.away}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fff', marginBottom: '40px', letterSpacing: '3px' }}>
            {matchResult.score.home > matchResult.score.away
              ? `${homeTeam?.shortName || 'HOME'} WIN!`
              : matchResult.score.away > matchResult.score.home
                ? `${awayTeam?.shortName || 'AWAY'} WIN!`
                : 'DRAW!'
            }
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button className="pixel-btn" style={{ fontSize: '0.5rem' }} onClick={() => navigate('/select')}>
              PLAY AGAIN
            </button>
            <button className="pixel-btn" style={{ fontSize: '0.5rem' }} onClick={() => navigate('/')}>
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      <MobileControls />
      <ControlsReminder />
    </div>
  );
}

// ─── Mobile Controls (React HTML overlay) ───────────────────────────────────
// Uses window.__GAME_INPUT__ to pass state into Phaser's handleInput()
// This sidesteps the zoom/scrollFactor off-screen bug entirely.

function MobileControls() {
  const [show, setShow] = useState(false);
  const joystickAreaRef = useRef(null);
  const joystickBaseRef = useRef(null);
  const joystickThumbRef = useRef(null);
  const jsState = useRef({ active: false, id: -1, sx: 0, sy: 0 });

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setShow(isTouchDevice);
  }, []);

  useEffect(() => {
    if (!show) return;

    const area = joystickAreaRef.current;
    const base = joystickBaseRef.current;
    const thumb = joystickThumbRef.current;
    const MAX_R = 48;

    const onStart = (e) => {
      e.preventDefault();
      const js = jsState.current;
      if (js.active) return;
      const t = e.changedTouches[0];
      js.active = true;
      js.id = t.identifier;
      js.sx = t.clientX;
      js.sy = t.clientY;

      const bsz = 96;
      const tsz = 46;
      base.style.cssText = `
        position:fixed;display:block;pointer-events:none;border-radius:50%;
        width:${bsz}px;height:${bsz}px;
        left:${t.clientX - bsz / 2}px;top:${t.clientY - bsz / 2}px;
        background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.35);
      `;
      thumb.style.cssText = `
        position:fixed;display:block;pointer-events:none;border-radius:50%;
        width:${tsz}px;height:${tsz}px;
        left:${t.clientX - tsz / 2}px;top:${t.clientY - tsz / 2}px;
        background:rgba(255,255,255,0.55);
      `;

      if (window.__GAME_INPUT__) window.__GAME_INPUT__.jActive = true;
    };

    const onMove = (e) => {
      e.preventDefault();
      const js = jsState.current;
      if (!js.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== js.id) continue;
        const dx = t.clientX - js.sx;
        const dy = t.clientY - js.sy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const c = Math.min(d, MAX_R);
        const a = Math.atan2(dy, dx);
        const tsz = 46;
        thumb.style.left = (js.sx + Math.cos(a) * c - tsz / 2) + 'px';
        thumb.style.top  = (js.sy + Math.sin(a) * c - tsz / 2) + 'px';
        if (window.__GAME_INPUT__) {
          window.__GAME_INPUT__.jx = (c / MAX_R) * Math.cos(a);
          window.__GAME_INPUT__.jy = (c / MAX_R) * Math.sin(a);
        }
      }
    };

    const onEnd = (e) => {
      e.preventDefault();
      const js = jsState.current;
      for (const t of e.changedTouches) {
        if (t.identifier !== js.id) continue;
        js.active = false;
        base.style.display = 'none';
        thumb.style.display = 'none';
        if (window.__GAME_INPUT__) {
          window.__GAME_INPUT__.jx = 0;
          window.__GAME_INPUT__.jy = 0;
          window.__GAME_INPUT__.jActive = false;
        }
      }
    };

    area.addEventListener('touchstart',  onStart, { passive: false });
    area.addEventListener('touchmove',   onMove,  { passive: false });
    area.addEventListener('touchend',    onEnd,   { passive: false });
    area.addEventListener('touchcancel', onEnd,   { passive: false });

    return () => {
      area.removeEventListener('touchstart',  onStart);
      area.removeEventListener('touchmove',   onMove);
      area.removeEventListener('touchend',    onEnd);
      area.removeEventListener('touchcancel', onEnd);
    };
  }, [show]);

  const setGI = useCallback((key, val) => {
    if (window.__GAME_INPUT__) window.__GAME_INPUT__[key] = val;
  }, []);

  if (!show) return null;

  const btn = (label, sub, bg, onDown, onUp) => ({
    label, sub, bg, onDown, onUp,
  });

  const btnStyle = (bg) => ({
    width: 62,
    height: 62,
    borderRadius: '50%',
    background: bg,
    border: '2px solid rgba(255,255,255,0.5)',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    lineHeight: 1.25,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    opacity: 0.88,
    flexShrink: 0,
  });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none' }}>
      {/* Joystick area — bottom-left 45% × 45% of screen */}
      <div
        ref={joystickAreaRef}
        style={{ position: 'absolute', left: 0, bottom: 0, width: '45%', height: '45%', pointerEvents: 'all' }}
      />
      {/* Joystick visuals (positioned via JS) */}
      <div ref={joystickBaseRef} style={{ display: 'none' }} />
      <div ref={joystickThumbRef} style={{ display: 'none' }} />

      {/* Action buttons — bottom-right, raised above browser nav bar */}
      <div style={{
        position: 'absolute',
        right: 14,
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'all',
      }}>
        {/* Row: Switch + Tackle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={btnStyle('rgba(90,90,90,0.85)')}
            onTouchStart={(e) => { e.preventDefault(); setGI('switchPlayer', true); }}
          >
            <span>TAB</span>
            <span style={{ fontSize: 8, opacity: 0.8 }}>SWITCH</span>
          </div>
          <div
            style={btnStyle('rgba(160,120,0,0.85)')}
            onTouchStart={(e) => { e.preventDefault(); setGI('tackle', true); }}
          >
            <span>SPC</span>
            <span style={{ fontSize: 8, opacity: 0.8 }}>TACKLE</span>
          </div>
        </div>

        {/* Row: Through + Pass */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={btnStyle('rgba(0,55,200,0.85)')}
            onTouchStart={(e) => { e.preventDefault(); setGI('through', true); }}
          >
            <span>C</span>
            <span style={{ fontSize: 8, opacity: 0.8 }}>THRU</span>
          </div>
          <div
            style={btnStyle('rgba(0,130,0,0.85)')}
            onTouchStart={(e) => { e.preventDefault(); setGI('pass', true); }}
          >
            <span>Z</span>
            <span style={{ fontSize: 8, opacity: 0.8 }}>PASS</span>
          </div>
        </div>

        {/* Shoot — wider, hold to charge */}
        <div
          style={{ ...btnStyle('rgba(190,0,0,0.85)'), width: 132, borderRadius: 32 }}
          onTouchStart={(e) => { e.preventDefault(); setGI('shootHeld', true); }}
          onTouchEnd={(e) => { e.preventDefault(); setGI('shootHeld', false); setGI('shoot', true); }}
        >
          <span>X — SHOOT</span>
          <span style={{ fontSize: 7, opacity: 0.7 }}>HOLD TO CHARGE</span>
        </div>
      </div>
    </div>
  );
}

// ─── Controls reminder (desktop) ─────────────────────────────────────────────

function ControlsReminder() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.85)',
      border: '2px solid #ffd700',
      padding: '20px 30px',
      textAlign: 'center',
      fontFamily: 'Press Start 2P',
      zIndex: 150,
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: '0.55rem', color: '#ffd700', marginBottom: '16px', letterSpacing: '2px' }}>
        CONTROLS
      </div>
      <div style={{ fontSize: '0.38rem', color: '#aaa', lineHeight: 2.2 }}>
        <div>ARROWS — MOVE PLAYER</div>
        <div>Z — PASS</div>
        <div>X (hold) — SHOOT</div>
        <div>C — THROUGH BALL</div>
        <div>SPACE — TACKLE</div>
        <div>TAB — SWITCH PLAYER</div>
      </div>
      <div style={{ fontSize: '0.3rem', color: 'rgba(255,255,255,0.3)', marginTop: '12px' }}>
        FADES IN 5 SECONDS
      </div>
    </div>
  );
}

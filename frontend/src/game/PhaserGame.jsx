import React, { useEffect, useRef, useState } from 'react';
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
    // Store config globally so MatchScene can read it
    window.__MATCH_CONFIG__ = {
      homeTeam: homeTeam || { primaryColor: '#EF0107', secondaryColor: '#FFFFFF', name: 'Arsenal', shortName: 'ARS', rating: 85 },
      awayTeam: awayTeam || { primaryColor: '#034694', secondaryColor: '#FFFFFF', name: 'Chelsea', shortName: 'CHE', rating: 82 },
      matchDuration: matchDuration || 5,
      vsAI: vsAI !== false,
      difficulty: difficulty || 'medium',
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

      // Wait for MatchScene to be active, then wire events
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
      {/* Phaser canvas container */}
      <div
        ref={gameContainerRef}
        style={{ width: '100%', height: '100%' }}
        id="phaser-game"
      />

      {/* React HUD overlay */}
      <HUD
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        score={score}
        timeRemaining={timeRemaining}
        totalTime={(matchDuration || 5) * 60}
      />

      {/* Match over screen */}
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
            <button
              className="pixel-btn"
              style={{ fontSize: '0.5rem' }}
              onClick={() => navigate('/select')}
            >
              PLAY AGAIN
            </button>
            <button
              className="pixel-btn"
              style={{ fontSize: '0.5rem' }}
              onClick={() => navigate('/')}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Controls reminder overlay (fades after 5s) */}
      <ControlsReminder />
    </div>
  );
}

function ControlsReminder() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
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
      animation: 'fadeIn 0.3s ease',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: '0.55rem', color: '#ffd700', marginBottom: '16px', letterSpacing: '2px' }}>
        CONTROLS
      </div>
      <div style={{ fontSize: '0.38rem', color: '#aaa', lineHeight: 2.2 }}>
        <div>ARROWS - MOVE PLAYER</div>
        <div>Z - PASS</div>
        <div>X (hold) - SHOOT</div>
        <div>C - THROUGH BALL</div>
        <div>SPACE - TACKLE</div>
        <div>TAB - SWITCH PLAYER</div>
      </div>
      <div style={{ fontSize: '0.3rem', color: 'rgba(255,255,255,0.3)', marginTop: '12px' }}>
        FADES IN 5 SECONDS
      </div>
    </div>
  );
}

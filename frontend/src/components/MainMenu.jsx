import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MainMenu() {
  const navigate = useNavigate();
  const [activeBtn, setActiveBtn] = useState(null);

  const buttons = [
    { id: 'kick', label: 'KICK OFF', action: () => navigate('/select?mode=ai') },
    { id: 'online', label: 'ONLINE MATCH', action: () => navigate('/lobby') },
    { id: 'local', label: 'LOCAL MULTIPLAYER', action: () => navigate('/select?mode=local') },
    { id: 'lead', label: 'LEADERBOARD', action: () => navigate('/leaderboard') },
  ];

  return (
    <div className="screen-container" style={{ background: '#0a0a0a' }}>
      <div className="scanlines" />
      <div className="pitch-bg" />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.6)',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: '0.6rem',
            color: '#ffd700',
            letterSpacing: '8px',
            opacity: 0.8,
          }}>
            ★ ★ ★
          </span>
        </div>

        <h1
          className="title-glow fade-in"
          style={{
            fontSize: 'clamp(1.2rem, 3vw, 2.2rem)',
            color: '#ffd700',
            lineHeight: 1.4,
            marginBottom: '12px',
            letterSpacing: '4px',
          }}
        >
          MARKETXI
        </h1>
        <h2
          className="fade-in"
          style={{
            fontSize: 'clamp(0.5rem, 1.5vw, 0.9rem)',
            color: '#fff',
            letterSpacing: '6px',
            marginBottom: '60px',
            opacity: 0.9,
            animationDelay: '0.1s',
          }}
        >
          FOOTBALL
        </h2>

        {/* Menu buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          alignItems: 'center',
        }}>
          {buttons.map((btn, i) => (
            <button
              key={btn.id}
              className="pixel-btn fade-in"
              style={{
                animationDelay: `${0.1 + i * 0.1}s`,
                minWidth: '280px',
                fontSize: btn.label.length > 14 ? '0.5rem' : '0.65rem',
              }}
              onMouseEnter={() => setActiveBtn(btn.id)}
              onMouseLeave={() => setActiveBtn(null)}
              onClick={btn.action}
            >
              {activeBtn === btn.id ? '► ' : '  '}{btn.label}
            </button>
          ))}
        </div>

        {/* Version */}
        <div style={{
          position: 'absolute',
          bottom: '-80px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.35rem',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '2px',
          whiteSpace: 'nowrap',
        }}>
          V1.0.0 © 2024 MARKETXI
        </div>
      </div>

      {/* Corner decorations */}
      <div style={{
        position: 'absolute', top: '20px', left: '20px',
        fontSize: '0.35rem', color: 'rgba(255,215,0,0.4)', letterSpacing: '2px',
      }}>INSERT COIN</div>

      <div style={{
        position: 'absolute', bottom: '20px', right: '20px',
        fontSize: '0.35rem', color: 'rgba(255,215,0,0.4)',
      }}>
        HI-SCORE 00000
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';

export default function HUD({ homeTeam, awayTeam, score, timeRemaining, totalTime, onPause }) {
  const [scoreFlash, setScoreFlash] = useState(false);
  const prevScore = React.useRef(score);

  useEffect(() => {
    if (score.home !== prevScore.current.home || score.away !== prevScore.current.away) {
      setScoreFlash(true);
      prevScore.current = score;
      const t = setTimeout(() => setScoreFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [score]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timePercent = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 100;

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 100,
      fontFamily: 'Press Start 2P',
    }}>
      {/* Top HUD bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
      }}>
        {/* Home team */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
        }}>
          <div style={{
            width: 16, height: 16,
            background: homeTeam?.primaryColor || '#FF0000',
            border: '2px solid rgba(255,255,255,0.5)',
          }} />
          <span style={{
            fontSize: '0.55rem',
            color: '#fff',
            textShadow: '0 0 8px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
          }}>
            {homeTeam?.shortName || 'HME'}
          </span>
        </div>

        {/* Score & Time */}
        <div style={{ textAlign: 'center', flex: 2 }}>
          <div
            className={scoreFlash ? 'score-flash' : ''}
            style={{
              fontSize: '1.2rem',
              color: '#ffd700',
              textShadow: '0 0 10px rgba(255,215,0,0.7), 0 2px 4px rgba(0,0,0,0.8)',
              letterSpacing: '6px',
              lineHeight: 1,
            }}
          >
            {score.home} : {score.away}
          </div>
          <div style={{
            fontSize: '0.45rem',
            color: timeRemaining < 30 ? '#ff4444' : '#aaa',
            marginTop: '4px',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}>
            {formatTime(timeRemaining)}
          </div>

          {/* Time bar */}
          <div style={{
            width: '120px',
            height: '4px',
            background: 'rgba(255,255,255,0.2)',
            margin: '4px auto 0',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${timePercent}%`,
              height: '100%',
              background: timePercent < 20 ? '#ff4444' : '#ffd700',
              transition: 'width 0.5s linear',
            }} />
          </div>
        </div>

        {/* Away team */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          justifyContent: 'flex-end',
        }}>
          <span style={{
            fontSize: '0.55rem',
            color: '#fff',
            textShadow: '0 0 8px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
          }}>
            {awayTeam?.shortName || 'AWY'}
          </span>
          <div style={{
            width: 16, height: 16,
            background: awayTeam?.primaryColor || '#0000FF',
            border: '2px solid rgba(255,255,255,0.5)',
          }} />
        </div>
      </div>

      {/* Controls hint - bottom left */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        fontSize: '0.28rem',
        color: 'rgba(255,255,255,0.4)',
        lineHeight: 1.8,
        background: 'rgba(0,0,0,0.5)',
        padding: '6px 8px',
        pointerEvents: 'none',
      }}>
        <div>ARROWS/WASD: MOVE</div>
        <div>A: PASS · S: SHOOT</div>
        <div>D: THROUGH BALL</div>
        <div>SPACE: TACKLE · TAB: SWITCH</div>
      </div>

      {/* Pause button */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          pointerEvents: 'all',
          cursor: 'pointer',
        }}
      >
      </div>
    </div>
  );
}

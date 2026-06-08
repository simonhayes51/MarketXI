import React, { useEffect, useRef, useState } from 'react';

export default function HUD({ homeTeam, awayTeam, score, timeRemaining, totalTime }) {
  const [scoreFlash, setScoreFlash] = useState(false);
  const prevScore = React.useRef({ home: 0, away: 0 });
  const powerBarRef = useRef(null);
  const powerFillRef = useRef(null);

  // Score flash on goal
  useEffect(() => {
    if (score.home !== prevScore.current.home || score.away !== prevScore.current.away) {
      setScoreFlash(true);
      prevScore.current = { ...score };
      const t = setTimeout(() => setScoreFlash(false), 1500);
      return () => clearTimeout(t);
    }
  }, [score]);

  // Power bar — poll window.__GAME_STATE__ at 60fps, direct DOM manipulation to avoid re-renders
  useEffect(() => {
    let raf;
    const tick = () => {
      const gs = window.__GAME_STATE__;
      const bar = powerBarRef.current;
      const fill = powerFillRef.current;
      if (bar && fill && gs) {
        bar.style.opacity = gs.isCharging ? '1' : '0';
        fill.style.width = `${(gs.powerCharge || 0) * 100}%`;
        const p = gs.powerCharge || 0;
        fill.style.background = p < 0.5 ? '#44dd44' : p < 0.8 ? '#ffaa00' : '#ff2222';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const timePercent = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 100;
  const urgent = timeRemaining < 60;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 100, fontFamily: 'monospace' }}>

      {/* SWOS-style top bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        background: '#111',
        borderBottom: '2px solid #333',
        padding: '0',
        display: 'flex',
        alignItems: 'stretch',
        height: 52,
      }}>
        {/* Home team */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 10, flex: 1,
        }}>
          <div style={{
            width: 18, height: 28,
            background: homeTeam?.primaryColor || '#EF0107',
            border: `2px solid ${homeTeam?.secondaryColor || '#fff'}`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: '#fff', letterSpacing: 2, fontWeight: 'bold' }}>
            {homeTeam?.shortName || 'HME'}
          </span>
        </div>

        {/* Score + Timer center */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1.5, gap: 2 }}>
          <div style={{
            fontSize: scoreFlash ? 22 : 20,
            color: scoreFlash ? '#fff' : '#ffd700',
            letterSpacing: 10,
            fontWeight: 'bold',
            lineHeight: 1,
            transition: 'font-size 0.1s',
          }}>
            {score.home}&nbsp;&nbsp;{score.away}
          </div>
          <div style={{ fontSize: 9, color: urgent ? '#ff5555' : '#aaa', letterSpacing: 2 }}>
            {formatTime(timeRemaining)}
          </div>
          {/* Time remaining bar */}
          <div style={{ width: 80, height: 3, background: '#333' }}>
            <div style={{
              width: `${timePercent}%`,
              height: '100%',
              background: timePercent < 25 ? '#ff4444' : '#ffd700',
              transition: 'width 1s linear',
            }} />
          </div>
        </div>

        {/* Away team */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, paddingRight: 10, flex: 1, justifyContent: 'flex-end',
        }}>
          <span style={{ fontSize: 12, color: '#fff', letterSpacing: 2, fontWeight: 'bold' }}>
            {awayTeam?.shortName || 'AWY'}
          </span>
          <div style={{
            width: 18, height: 28,
            background: awayTeam?.primaryColor || '#034694',
            border: `2px solid ${awayTeam?.secondaryColor || '#fff'}`,
            flexShrink: 0,
          }} />
        </div>
      </div>

      {/* Shoot power bar — centered, above mobile controls */}
      <div ref={powerBarRef} style={{
        position: 'absolute',
        bottom: 'calc(200px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: 0,
        transition: 'opacity 0.1s',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 9, color: '#fff', letterSpacing: 2, marginBottom: 4, fontFamily: 'monospace' }}>POWER</div>
        <div style={{ width: 160, height: 12, background: '#222', border: '1px solid #555' }}>
          <div ref={powerFillRef} style={{ width: '0%', height: '100%', background: '#44dd44', transition: 'none' }} />
        </div>
      </div>
    </div>
  );
}

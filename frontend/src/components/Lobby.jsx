import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Lobby({ gameConfig, setGameConfig }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('waiting'); // waiting, found, connected
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState('create'); // create, join
  const [opponent, setOpponent] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Generate a random room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleCreateRoom = () => {
    setStatus('waiting');
    // In a real app, connect to socket server
    // For demo, simulate after 3 seconds
    timerRef.current = setTimeout(() => {
      setOpponent({ username: 'Player2', elo: 1000 });
      setStatus('found');
      startCountdown();
    }, 3000);
  };

  const handleJoinRoom = () => {
    if (joinCode.length < 4) return;
    setStatus('waiting');
    timerRef.current = setTimeout(() => {
      setOpponent({ username: 'Host', elo: 1050 });
      setStatus('found');
      startCountdown();
    }, 1500);
  };

  const startCountdown = () => {
    let count = 5;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        navigate('/game');
      }
    }, 1000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0a1a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div className="scanlines" />

      <div style={{
        background: 'rgba(0,0,0,0.8)',
        border: '3px solid #ffd700',
        padding: '40px',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '0.8rem', color: '#ffd700', marginBottom: '30px', letterSpacing: '3px' }}>
          ONLINE LOBBY
        </h1>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '30px', border: '2px solid rgba(255,255,255,0.2)' }}>
          {['create', 'join'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setStatus('idle'); }}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '0.45rem',
                fontFamily: 'Press Start 2P',
                background: mode === m ? '#ffd700' : 'transparent',
                color: mode === m ? '#000' : '#ffd700',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '2px',
              }}
            >
              {m === 'create' ? 'CREATE ROOM' : 'JOIN ROOM'}
            </button>
          ))}
        </div>

        {mode === 'create' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', letterSpacing: '2px' }}>
                YOUR ROOM CODE
              </div>
              <div
                onClick={copyRoomCode}
                style={{
                  fontSize: '2rem',
                  color: '#ffd700',
                  letterSpacing: '8px',
                  background: 'rgba(255,215,0,0.1)',
                  border: '2px solid #ffd700',
                  padding: '16px',
                  cursor: 'pointer',
                  fontFamily: 'Press Start 2P',
                }}
                title="Click to copy"
              >
                {roomCode}
              </div>
              <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>
                CLICK TO COPY
              </div>
            </div>

            {status === 'waiting' && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.45rem', color: '#aaa', marginBottom: '8px' }}>
                  WAITING FOR OPPONENT...
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  justifyContent: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8,
                      background: '#ffd700',
                      borderRadius: '50%',
                      animation: `pulse 1s ${i * 0.3}s ease-in-out infinite alternate`,
                    }} />
                  ))}
                </div>
                <style>{`
                  @keyframes pulse { from { opacity: 0.2; } to { opacity: 1; } }
                `}</style>
              </div>
            )}

            {status === 'idle' && (
              <button className="pixel-btn" onClick={handleCreateRoom} style={{ fontSize: '0.5rem', width: '100%' }}>
                START WAITING
              </button>
            )}
          </div>
        )}

        {mode === 'join' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', letterSpacing: '2px' }}>
                ENTER ROOM CODE
              </div>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="XXXXXX"
                style={{
                  fontFamily: 'Press Start 2P',
                  fontSize: '1.2rem',
                  background: 'rgba(0,0,0,0.6)',
                  border: '2px solid #ffd700',
                  color: '#ffd700',
                  padding: '12px',
                  width: '100%',
                  textAlign: 'center',
                  letterSpacing: '6px',
                  outline: 'none',
                }}
                maxLength={6}
              />
            </div>
            <button
              className="pixel-btn"
              onClick={handleJoinRoom}
              disabled={joinCode.length < 4 || status === 'waiting'}
              style={{
                fontSize: '0.5rem',
                width: '100%',
                opacity: joinCode.length < 4 ? 0.5 : 1,
              }}
            >
              {status === 'waiting' ? 'CONNECTING...' : 'JOIN GAME'}
            </button>
          </div>
        )}

        {/* Opponent found */}
        {status === 'found' && opponent && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: 'rgba(0,255,0,0.1)',
            border: '2px solid #00ff00',
          }}>
            <div style={{ fontSize: '0.45rem', color: '#00ff00', marginBottom: '8px' }}>
              OPPONENT FOUND!
            </div>
            <div style={{ fontSize: '0.6rem', color: '#fff', marginBottom: '4px' }}>
              {opponent.username}
            </div>
            <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.5)' }}>
              ELO: {opponent.elo}
            </div>
            {countdown !== null && (
              <div style={{
                fontSize: '1.5rem',
                color: '#ffd700',
                marginTop: '12px',
                fontFamily: 'Press Start 2P',
              }}>
                {countdown}
              </div>
            )}
          </div>
        )}

        {/* Match settings */}
        <div style={{
          marginTop: '24px',
          padding: '12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', letterSpacing: '2px' }}>
            MATCH SETTINGS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.4rem', color: '#aaa' }}>
            <span>Duration:</span>
            <span style={{ color: '#ffd700' }}>{gameConfig.matchDuration} mins</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.4rem', color: '#aaa', marginTop: '4px' }}>
            <span>Mode:</span>
            <span style={{ color: '#ffd700' }}>ONLINE</span>
          </div>
        </div>

        <button
          className="pixel-btn"
          style={{ marginTop: '20px', fontSize: '0.4rem', padding: '8px 16px' }}
          onClick={() => navigate('/')}
        >
          ← MAIN MENU
        </button>
      </div>
    </div>
  );
}

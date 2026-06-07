import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PREMIER_LEAGUE_TEAMS, CHAMPIONSHIP_TEAMS, ALL_TEAMS } from '../game/utils/teamsData.js';

export default function TeamSelect({ gameConfig, setGameConfig }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'ai';

  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [activePanel, setActivePanel] = useState('home');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [duration, setDuration] = useState(5);

  const filteredTeams = leagueFilter === 'all'
    ? ALL_TEAMS
    : leagueFilter === 'pl'
      ? PREMIER_LEAGUE_TEAMS
      : CHAMPIONSHIP_TEAMS;

  const handleTeamSelect = (team) => {
    if (activePanel === 'home') {
      setHomeTeam(team);
      setActivePanel('away');
    } else {
      if (team.id !== homeTeam?.id) {
        setAwayTeam(team);
      }
    }
  };

  const handleConfirm = () => {
    if (!homeTeam || !awayTeam) return;
    setGameConfig(prev => ({
      ...prev,
      homeTeam,
      awayTeam,
      matchDuration: duration,
      vsAI: mode === 'ai',
    }));
    if (mode === 'online') {
      navigate('/lobby');
    } else {
      navigate('/game');
    }
  };

  const ColorBadge = ({ color, size = 20 }) => (
    <div style={{
      width: size, height: size,
      background: color,
      border: '2px solid rgba(255,255,255,0.4)',
      display: 'inline-block',
      flexShrink: 0,
    }} />
  );

  const TeamCard = ({ team, selected, onClick }) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        cursor: 'pointer',
        background: selected ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.03)',
        border: selected ? '2px solid #ffd700' : '2px solid rgba(255,255,255,0.1)',
        marginBottom: '4px',
        transition: 'all 0.1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <div style={{ display: 'flex', gap: '3px' }}>
        <ColorBadge color={team.primaryColor} />
        <ColorBadge color={team.secondaryColor} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.5rem', color: selected ? '#ffd700' : '#fff' }}>{team.name}</div>
        <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
          {team.league} · RTG {team.rating}
        </div>
      </div>
      {selected && <span style={{ color: '#ffd700', fontSize: '0.5rem' }}>✓</span>}
    </div>
  );

  const TeamDisplay = ({ team, label }) => (
    <div style={{
      padding: '16px',
      background: 'rgba(0,0,0,0.5)',
      border: '2px solid rgba(255,255,255,0.2)',
      textAlign: 'center',
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    }}>
      <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>{label}</div>
      {team ? (
        <>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: 40, height: 40, background: team.primaryColor, border: '3px solid rgba(255,255,255,0.3)' }} />
            <div style={{ width: 40, height: 40, background: team.secondaryColor, border: '3px solid rgba(255,255,255,0.3)' }} />
          </div>
          <div style={{ fontSize: '0.6rem', color: '#ffd700' }}>{team.name}</div>
          <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.5)' }}>Rating: {team.rating}</div>
        </>
      ) : (
        <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)' }}>SELECT TEAM</div>
      )}
    </div>
  );

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0a1a0a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(0,0,0,0.6)',
        borderBottom: '2px solid #ffd700',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <button
          className="pixel-btn"
          style={{ fontSize: '0.4rem', padding: '8px 12px' }}
          onClick={() => navigate('/')}
        >
          ← BACK
        </button>
        <h1 style={{ fontSize: '0.8rem', color: '#ffd700', flex: 1, textAlign: 'center' }}>
          SELECT TEAMS
        </h1>
        <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)' }}>
          MODE: {mode === 'ai' ? 'VS CPU' : mode === 'local' ? '2 PLAYER' : 'ONLINE'}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 300px 1fr',
        gap: '16px',
        padding: '16px',
        overflow: 'hidden',
      }}>
        {/* Home Team Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
          <div style={{
            padding: '8px',
            background: activePanel === 'home' ? 'rgba(255,100,100,0.2)' : 'rgba(0,0,0,0.3)',
            border: `2px solid ${activePanel === 'home' ? '#ff4444' : 'rgba(255,255,255,0.2)'}`,
            textAlign: 'center',
            fontSize: '0.55rem',
            color: activePanel === 'home' ? '#ff8888' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }} onClick={() => setActivePanel('home')}>
            HOME TEAM {activePanel === 'home' ? '◄ SELECT' : ''}
          </div>
          <TeamDisplay team={homeTeam} label="HOME" />
        </div>

        {/* Center */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          {/* VS */}
          <div style={{
            fontSize: '1.5rem',
            color: '#ffd700',
            textShadow: '0 0 20px rgba(255,215,0,0.5)',
            fontFamily: 'Press Start 2P',
            margin: '8px 0',
          }}>VS</div>

          {/* Duration */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', letterSpacing: '2px' }}>
              MATCH LENGTH
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              {[3, 5, 10].map(d => (
                <button
                  key={d}
                  className="pixel-btn"
                  style={{
                    fontSize: '0.45rem',
                    padding: '8px 10px',
                    background: duration === d ? '#ffd700' : 'rgba(0,0,0,0.6)',
                    color: duration === d ? '#000' : '#ffd700',
                  }}
                  onClick={() => setDuration(d)}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* League filter */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', letterSpacing: '2px' }}>
              FILTER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { key: 'all', label: 'ALL TEAMS' },
                { key: 'pl', label: 'PREMIER LEAGUE' },
                { key: 'ch', label: 'CHAMPIONSHIP' },
              ].map(f => (
                <button
                  key={f.key}
                  className="pixel-btn"
                  style={{
                    fontSize: '0.35rem',
                    padding: '6px 8px',
                    background: leagueFilter === f.key ? 'rgba(255,215,0,0.3)' : 'rgba(0,0,0,0.6)',
                    color: leagueFilter === f.key ? '#ffd700' : 'rgba(255,255,255,0.5)',
                    border: leagueFilter === f.key ? '2px solid #ffd700' : '2px solid rgba(255,255,255,0.2)',
                  }}
                  onClick={() => setLeagueFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm */}
          <button
            className="pixel-btn"
            style={{
              marginTop: 'auto',
              width: '100%',
              fontSize: '0.55rem',
              padding: '14px',
              opacity: homeTeam && awayTeam ? 1 : 0.4,
              cursor: homeTeam && awayTeam ? 'pointer' : 'not-allowed',
              background: homeTeam && awayTeam ? 'rgba(0,200,0,0.2)' : 'rgba(0,0,0,0.4)',
              borderColor: homeTeam && awayTeam ? '#00ff00' : 'rgba(255,255,255,0.2)',
              color: homeTeam && awayTeam ? '#00ff00' : 'rgba(255,255,255,0.3)',
            }}
            onClick={handleConfirm}
            disabled={!homeTeam || !awayTeam}
          >
            KICK OFF!
          </button>
        </div>

        {/* Away Team Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
          <div style={{
            padding: '8px',
            background: activePanel === 'away' ? 'rgba(100,100,255,0.2)' : 'rgba(0,0,0,0.3)',
            border: `2px solid ${activePanel === 'away' ? '#4444ff' : 'rgba(255,255,255,0.2)'}`,
            textAlign: 'center',
            fontSize: '0.55rem',
            color: activePanel === 'away' ? '#8888ff' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
          }} onClick={() => setActivePanel('away')}>
            AWAY TEAM {activePanel === 'away' ? '◄ SELECT' : ''}
          </div>
          <TeamDisplay team={awayTeam} label="AWAY" />
        </div>
      </div>

      {/* Team List */}
      <div style={{
        height: '35vh',
        padding: '0 16px 16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: '0.4rem',
          color: 'rgba(255,255,255,0.4)',
          marginBottom: '8px',
          letterSpacing: '2px',
          textAlign: 'center',
        }}>
          CLICK TEAM TO SELECT FOR {activePanel === 'home' ? 'HOME' : 'AWAY'}
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '4px',
          alignContent: 'start',
        }}>
          {filteredTeams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              selected={
                (activePanel === 'home' && homeTeam?.id === team.id) ||
                (activePanel === 'away' && awayTeam?.id === team.id)
              }
              onClick={() => handleTeamSelect(team)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

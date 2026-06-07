import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainMenu from './components/MainMenu.jsx';
import TeamSelect from './components/TeamSelect.jsx';
import Lobby from './components/Lobby.jsx';
import PhaserGame from './game/PhaserGame.jsx';

export default function App() {
  const [gameConfig, setGameConfig] = useState({
    homeTeam: null,
    awayTeam: null,
    matchDuration: 5,
    vsAI: true,
    difficulty: 'medium',
  });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route
          path="/select"
          element={<TeamSelect gameConfig={gameConfig} setGameConfig={setGameConfig} />}
        />
        <Route path="/lobby" element={<Lobby gameConfig={gameConfig} setGameConfig={setGameConfig} />} />
        <Route
          path="/game"
          element={
            gameConfig.homeTeam && gameConfig.awayTeam ? (
              <PhaserGame
                homeTeam={gameConfig.homeTeam}
                awayTeam={gameConfig.awayTeam}
                matchDuration={gameConfig.matchDuration}
                vsAI={gameConfig.vsAI}
                difficulty={gameConfig.difficulty}
              />
            ) : (
              <Navigate to="/select" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

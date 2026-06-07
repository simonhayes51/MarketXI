-- MarketXI Football Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DROP EXISTING TABLES (for clean re-run in development)
-- ============================================================
DROP TABLE IF EXISTS match_players CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  username        VARCHAR(30) UNIQUE NOT NULL,
  password_hash   VARCHAR(255),
  google_id       VARCHAR(255) UNIQUE,
  elo_rating      INTEGER NOT NULL DEFAULT 1000,
  wins            INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  goals_scored    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_elo ON users(elo_rating DESC);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  short_name      CHAR(3) NOT NULL,
  league          VARCHAR(50) NOT NULL,
  primary_color   CHAR(7) NOT NULL DEFAULT '#FF0000',
  secondary_color CHAR(7) NOT NULL DEFAULT '#FFFFFF',
  rating          INTEGER NOT NULL DEFAULT 70
);

CREATE INDEX idx_teams_league ON teams(league);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE matches (
  id                SERIAL PRIMARY KEY,
  home_team_id      INTEGER NOT NULL REFERENCES teams(id),
  away_team_id      INTEGER NOT NULL REFERENCES teams(id),
  home_score        INTEGER NOT NULL DEFAULT 0,
  away_score        INTEGER NOT NULL DEFAULT 0,
  duration_minutes  INTEGER NOT NULL DEFAULT 5,
  home_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  away_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  winner_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  played_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_home_user ON matches(home_user_id);
CREATE INDEX idx_matches_away_user ON matches(away_user_id);
CREATE INDEX idx_matches_played_at ON matches(played_at DESC);

-- ============================================================
-- MATCH PLAYERS (player statistics per match)
-- ============================================================
CREATE TABLE match_players (
  id        SERIAL PRIMARY KEY,
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  team_id   INTEGER NOT NULL REFERENCES teams(id),
  side      VARCHAR(4) NOT NULL CHECK (side IN ('home', 'away')),
  goals     INTEGER NOT NULL DEFAULT 0,
  assists   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_match_players_match ON match_players(match_id);
CREATE INDEX idx_match_players_user ON match_players(user_id);

-- ============================================================
-- UPDATED AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: PREMIER LEAGUE TEAMS (20 teams)
-- ============================================================
INSERT INTO teams (name, short_name, league, primary_color, secondary_color, rating) VALUES
  ('Arsenal',         'ARS', 'Premier League', '#EF0107', '#FFFFFF', 85),
  ('Aston Villa',     'AVL', 'Premier League', '#670E36', '#95BFE5', 78),
  ('Bournemouth',     'BOU', 'Premier League', '#DA291C', '#000000', 72),
  ('Brentford',       'BRE', 'Premier League', '#E30613', '#FFFFFF', 74),
  ('Brighton',        'BHA', 'Premier League', '#0057B8', '#FFFFFF', 76),
  ('Chelsea',         'CHE', 'Premier League', '#034694', '#FFFFFF', 82),
  ('Crystal Palace',  'CRY', 'Premier League', '#C4122E', '#0055A5', 73),
  ('Everton',         'EVE', 'Premier League', '#003399', '#FFFFFF', 70),
  ('Fulham',          'FUL', 'Premier League', '#FFFFFF', '#000000', 74),
  ('Ipswich',         'IPS', 'Premier League', '#0044AA', '#FFFFFF', 68),
  ('Leicester',       'LEI', 'Premier League', '#003090', '#FDBE11', 71),
  ('Liverpool',       'LIV', 'Premier League', '#C8102E', '#FFFFFF', 88),
  ('Man City',        'MCI', 'Premier League', '#6CABDD', '#FFFFFF', 90),
  ('Man United',      'MUN', 'Premier League', '#DA291C', '#FFFFFF', 80),
  ('Newcastle',       'NEW', 'Premier League', '#241F20', '#FFFFFF', 82),
  ('Nottm Forest',    'NFO', 'Premier League', '#DD0000', '#FFFFFF', 74),
  ('Southampton',     'SOU', 'Premier League', '#D71920', '#FFFFFF', 65),
  ('Spurs',           'TOT', 'Premier League', '#FFFFFF', '#132257', 79),
  ('West Ham',        'WHU', 'Premier League', '#7A263A', '#1BB1E7', 76),
  ('Wolves',          'WOL', 'Premier League', '#FDB913', '#231F20', 72);

-- ============================================================
-- SEED: CHAMPIONSHIP TEAMS (24 teams)
-- ============================================================
INSERT INTO teams (name, short_name, league, primary_color, secondary_color, rating) VALUES
  ('Leeds United',    'LEE', 'Championship', '#FFFFFF', '#1D428A', 74),
  ('Sheffield Utd',   'SHU', 'Championship', '#EE2737', '#000000', 72),
  ('Sunderland',      'SUN', 'Championship', '#EB172B', '#FFFFFF', 70),
  ('Burnley',         'BUR', 'Championship', '#6C1D45', '#99D6EA', 71),
  ('Middlesbrough',   'MID', 'Championship', '#EE3124', '#FFFFFF', 70),
  ('Norwich City',    'NOR', 'Championship', '#00A650', '#FFF200', 69),
  ('Preston NE',      'PNE', 'Championship', '#FFFFFF', '#004B9B', 66),
  ('Millwall',        'MIL', 'Championship', '#001D5E', '#FFFFFF', 67),
  ('Coventry City',   'COV', 'Championship', '#1B6EC2', '#FFFFFF', 68),
  ('Hull City',       'HUL', 'Championship', '#F18A00', '#000000', 67),
  ('Watford',         'WAT', 'Championship', '#FBEE23', '#ED2127', 69),
  ('West Brom',       'WBA', 'Championship', '#122F67', '#FFFFFF', 70),
  ('Cardiff City',    'CAR', 'Championship', '#0070B5', '#FFFFFF', 66),
  ('Stoke City',      'STK', 'Championship', '#E03A3E', '#FFFFFF', 67),
  ('QPR',             'QPR', 'Championship', '#1D5BA4', '#FFFFFF', 66),
  ('Blackburn',       'BLK', 'Championship', '#009EE0', '#FFFFFF', 68),
  ('Derby County',    'DER', 'Championship', '#FFFFFF', '#000000', 65),
  ('Plymouth',        'PLY', 'Championship', '#007B5E', '#FFFFFF', 64),
  ('Swansea City',    'SWA', 'Championship', '#FFFFFF', '#000000', 66),
  ('Bristol City',    'BRS', 'Championship', '#E3000B', '#FFFFFF', 65),
  ('Sheffield Wed',   'SHW', 'Championship', '#003893', '#FFFFFF', 66),
  ('Oxford Utd',      'OXF', 'Championship', '#FFD200', '#000000', 62),
  ('Luton Town',      'LUT', 'Championship', '#F78F1E', '#FFFFFF', 67),
  ('Portsmouth',      'POM', 'Championship', '#003087', '#FFFFFF', 65);

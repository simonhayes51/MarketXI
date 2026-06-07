# MarketXI Football

A browser-based football game inspired by Sensible Soccer 97/98, built with React, Phaser 3, Node.js, and PostgreSQL.

## Features
- Fully playable football with 11v11 AI
- Online multiplayer via Socket.io
- Team selection (Premier League + Championship)
- JWT authentication (email/password + Google OAuth)
- ELO leaderboard
- Mobile virtual controls

## Setup

### Backend
```bash
cd backend
cp .env.example .env
# Fill in DB credentials and JWT secret
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database
```bash
psql -U postgres -f backend/db/schema.sql
```

### Docker
```bash
docker-compose up
```

## Controls
- **Arrow keys / WASD**: Move player
- **A**: Pass
- **S**: Shoot (hold to charge)
- **D**: Through ball
- **Space**: Slide tackle
- **Tab**: Switch player

const { query } = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// In-memory state (use Redis in production)
const matchmakingQueue = []; // { socket, user, teamId, queuedAt }
const activeRooms = new Map(); // roomCode -> { hostSocket, guestSocket, state, matchData }
const socketToRoom = new Map(); // socketId -> roomCode

function setupMatchmaking(io) {
  io.on('connection', (socket) => {
    let authenticatedUser = null;

    // Authenticate socket with JWT
    socket.on('authenticate', (token) => {
      try {
        authenticatedUser = jwt.verify(token, JWT_SECRET);
        socket.emit('authenticated', { userId: authenticatedUser.id });
        console.log(`Socket authenticated: ${authenticatedUser.username}`);
      } catch {
        socket.emit('auth_error', { error: 'Invalid token' });
      }
    });

    // Join matchmaking queue
    socket.on('join_queue', (data) => {
      const { teamId } = data || {};

      // Remove from queue if already there
      const existingIdx = matchmakingQueue.findIndex(e => e.socket.id === socket.id);
      if (existingIdx !== -1) matchmakingQueue.splice(existingIdx, 1);

      // Add to queue
      matchmakingQueue.push({
        socket,
        user: authenticatedUser,
        teamId: teamId || null,
        queuedAt: Date.now(),
      });

      socket.emit('queue_joined', {
        position: matchmakingQueue.length,
        estimatedWait: matchmakingQueue.length * 15,
      });

      console.log(`Queue size: ${matchmakingQueue.length}`);

      // Try to pair players
      if (matchmakingQueue.length >= 2) {
        const player1 = matchmakingQueue.shift();
        const player2 = matchmakingQueue.shift();
        createMatch(player1, player2, io);
      }
    });

    // Leave queue
    socket.on('leave_queue', () => {
      const idx = matchmakingQueue.findIndex(e => e.socket.id === socket.id);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
        socket.emit('queue_left');
      }
    });

    // Create/join a private room
    socket.on('create_room', (data) => {
      const roomCode = generateRoomCode();
      const room = {
        hostSocket: socket,
        guestSocket: null,
        hostUser: authenticatedUser,
        guestUser: null,
        state: 'waiting',
        matchData: {
          homeTeamId: data?.teamId || null,
          awayTeamId: null,
          duration: data?.duration || 5,
        },
        gameState: null,
        createdAt: Date.now(),
      };

      activeRooms.set(roomCode, room);
      socketToRoom.set(socket.id, roomCode);
      socket.join(roomCode);

      socket.emit('room_created', { roomCode });
      console.log(`Room created: ${roomCode}`);
    });

    // Join a room by code
    socket.on('join_room', (data) => {
      const { roomCode, teamId } = data || {};

      if (!roomCode) {
        return socket.emit('room_error', { error: 'Room code required' });
      }

      const room = activeRooms.get(roomCode.toUpperCase());

      if (!room) {
        return socket.emit('room_error', { error: 'Room not found' });
      }

      if (room.state !== 'waiting') {
        return socket.emit('room_error', { error: 'Room is full or game already started' });
      }

      // Join room
      room.guestSocket = socket;
      room.guestUser = authenticatedUser;
      room.matchData.awayTeamId = teamId || null;
      room.state = 'ready';

      socketToRoom.set(socket.id, roomCode.toUpperCase());
      socket.join(roomCode.toUpperCase());

      // Notify both players
      io.to(roomCode.toUpperCase()).emit('match_starting', {
        roomCode: roomCode.toUpperCase(),
        host: {
          userId: room.hostUser?.id,
          username: room.hostUser?.username || 'Player 1',
        },
        guest: {
          userId: authenticatedUser?.id,
          username: authenticatedUser?.username || 'Player 2',
        },
        matchData: room.matchData,
      });

      console.log(`Room ${roomCode} ready — starting match`);

      // Start countdown
      let countdown = 3;
      const countdownInterval = setInterval(() => {
        io.to(roomCode.toUpperCase()).emit('countdown', { count: countdown });
        countdown--;
        if (countdown < 0) {
          clearInterval(countdownInterval);
          room.state = 'playing';
          io.to(roomCode.toUpperCase()).emit('match_start', {
            homeTeamId: room.matchData.homeTeamId,
            awayTeamId: room.matchData.awayTeamId,
            duration: room.matchData.duration,
          });
        }
      }, 1000);
    });

    // Receive player input (from client) — validate and broadcast to opponent
    socket.on('player_input', (data) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = activeRooms.get(roomCode);
      if (!room || room.state !== 'playing') return;

      // Determine if this is host or guest
      const isHost = room.hostSocket.id === socket.id;
      const side = isHost ? 'home' : 'away';

      // Broadcast to the opponent
      const opponentSocket = isHost ? room.guestSocket : room.hostSocket;
      if (opponentSocket) {
        opponentSocket.emit('opponent_input', {
          side,
          input: data,
          timestamp: Date.now(),
        });
      }
    });

    // Broadcast game state (authoritative updates)
    socket.on('game_state', (state) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = activeRooms.get(roomCode);
      if (!room) return;

      // Only host broadcasts authoritative state
      if (room.hostSocket.id !== socket.id) return;

      room.gameState = state;
      socket.to(roomCode).emit('game_state_update', state);
    });

    // Goal scored
    socket.on('goal_scored', (data) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = activeRooms.get(roomCode);
      if (!room) return;

      // Broadcast to whole room
      io.to(roomCode).emit('goal_event', {
        ...data,
        timestamp: Date.now(),
      });
    });

    // Match ended
    socket.on('match_end', async (data) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = activeRooms.get(roomCode);
      if (!room) return;

      room.state = 'ended';

      // Save match to database if users are authenticated
      try {
        if (room.hostUser && room.guestUser && room.matchData.homeTeamId && room.matchData.awayTeamId) {
          const homeScore = data.homeScore || 0;
          const awayScore = data.awayScore || 0;
          let winnerId = null;
          if (homeScore > awayScore) winnerId = room.hostUser.id;
          if (awayScore > homeScore) winnerId = room.guestUser.id;

          await query(
            `INSERT INTO matches (home_team_id, away_team_id, home_score, away_score, duration_minutes, home_user_id, away_user_id, winner_id, played_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              room.matchData.homeTeamId,
              room.matchData.awayTeamId,
              homeScore,
              awayScore,
              room.matchData.duration || 5,
              room.hostUser.id,
              room.guestUser.id,
              winnerId,
            ]
          );

          console.log(`Match saved: ${room.hostUser.username} ${homeScore}-${awayScore} ${room.guestUser.username}`);
        }
      } catch (err) {
        console.error('Failed to save online match:', err.message);
      }

      // Notify both players
      io.to(roomCode).emit('match_result', data);

      // Cleanup room after delay
      setTimeout(() => {
        activeRooms.delete(roomCode);
        if (room.hostSocket) socketToRoom.delete(room.hostSocket.id);
        if (room.guestSocket) socketToRoom.delete(room.guestSocket.id);
      }, 30000);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Remove from queue
      const queueIdx = matchmakingQueue.findIndex(e => e.socket.id === socket.id);
      if (queueIdx !== -1) matchmakingQueue.splice(queueIdx, 1);

      // Notify room partner
      const roomCode = socketToRoom.get(socket.id);
      if (roomCode) {
        const room = activeRooms.get(roomCode);
        if (room && room.state === 'playing') {
          socket.to(roomCode).emit('opponent_disconnected');
        }
        socketToRoom.delete(socket.id);
      }
    });
  });
}

function createMatch(player1, player2, io) {
  const roomCode = generateRoomCode();

  const room = {
    hostSocket: player1.socket,
    guestSocket: player2.socket,
    hostUser: player1.user,
    guestUser: player2.user,
    state: 'playing',
    matchData: {
      homeTeamId: player1.teamId,
      awayTeamId: player2.teamId,
      duration: 5,
    },
    gameState: null,
    createdAt: Date.now(),
  };

  activeRooms.set(roomCode, room);
  socketToRoom.set(player1.socket.id, roomCode);
  socketToRoom.set(player2.socket.id, roomCode);

  player1.socket.join(roomCode);
  player2.socket.join(roomCode);

  // Notify both players
  player1.socket.emit('match_found', {
    roomCode,
    side: 'home',
    opponent: { username: player2.user?.username || 'Opponent' },
  });

  player2.socket.emit('match_found', {
    roomCode,
    side: 'away',
    opponent: { username: player1.user?.username || 'Opponent' },
  });

  console.log(`Match created: ${roomCode} (${player1.user?.username} vs ${player2.user?.username})`);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = { setupMatchmaking };

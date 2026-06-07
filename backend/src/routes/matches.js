const express = require('express');
const { query, getClient } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/matches — recent matches (optionally for a user)
router.get('/', optionalAuth, async (req, res) => {
  const { userId, limit = 20, offset = 0 } = req.query;

  try {
    let sql, params;

    if (userId) {
      sql = `
        SELECT m.*,
          ht.name AS home_team_name, ht.primary_color AS home_color,
          at.name AS away_team_name, at.primary_color AS away_color
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        WHERE m.home_user_id = $1 OR m.away_user_id = $1
        ORDER BY m.played_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset];
    } else {
      sql = `
        SELECT m.*,
          ht.name AS home_team_name, ht.primary_color AS home_color,
          at.name AS away_team_name, at.primary_color AS away_color
        FROM matches m
        JOIN teams ht ON m.home_team_id = ht.id
        JOIN teams at ON m.away_team_id = at.id
        ORDER BY m.played_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [limit, offset];
    }

    const result = await query(sql, params);
    res.json({ matches: result.rows });
  } catch (err) {
    console.error('Get matches error:', err.message);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// GET /api/matches/:id — get a specific match
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const matchResult = await query(
      `SELECT m.*,
        ht.name AS home_team_name, ht.primary_color AS home_color,
        at.name AS away_team_name, at.primary_color AS away_color
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       WHERE m.id = $1`,
      [id]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const playersResult = await query(
      `SELECT mp.*, u.username, t.name AS team_name
       FROM match_players mp
       LEFT JOIN users u ON mp.user_id = u.id
       JOIN teams t ON mp.team_id = t.id
       WHERE mp.match_id = $1`,
      [id]
    );

    res.json({
      match: matchResult.rows[0],
      players: playersResult.rows,
    });
  } catch (err) {
    console.error('Get match error:', err.message);
    res.status(500).json({ error: 'Failed to get match' });
  }
});

// POST /api/matches — save a match result
router.post('/', optionalAuth, async (req, res) => {
  const {
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    durationMinutes,
    homeUserId,
    awayUserId,
  } = req.body;

  if (!homeTeamId || !awayTeamId || homeScore == null || awayScore == null) {
    return res.status(400).json({ error: 'homeTeamId, awayTeamId, homeScore, awayScore required' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Determine winner
    let winnerId = null;
    if (homeScore > awayScore && homeUserId) winnerId = homeUserId;
    if (awayScore > homeScore && awayUserId) winnerId = awayUserId;

    // Insert match
    const matchResult = await client.query(
      `INSERT INTO matches (home_team_id, away_team_id, home_score, away_score, duration_minutes, home_user_id, away_user_id, winner_id, played_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [homeTeamId, awayTeamId, homeScore, awayScore, durationMinutes || 5, homeUserId || null, awayUserId || null, winnerId]
    );

    const match = matchResult.rows[0];

    // Update ELO ratings if both users are present
    if (homeUserId && awayUserId) {
      const homeUser = await client.query('SELECT elo_rating FROM users WHERE id = $1', [homeUserId]);
      const awayUser = await client.query('SELECT elo_rating FROM users WHERE id = $1', [awayUserId]);

      if (homeUser.rows.length > 0 && awayUser.rows.length > 0) {
        const { newHomeElo, newAwayElo } = calculateElo(
          homeUser.rows[0].elo_rating,
          awayUser.rows[0].elo_rating,
          homeScore,
          awayScore
        );

        // Update home user
        await client.query(
          `UPDATE users SET
            elo_rating = $1,
            wins = wins + $2,
            losses = losses + $3,
            goals_scored = goals_scored + $4
          WHERE id = $5`,
          [
            newHomeElo,
            homeScore > awayScore ? 1 : 0,
            homeScore < awayScore ? 1 : 0,
            homeScore,
            homeUserId,
          ]
        );

        // Update away user
        await client.query(
          `UPDATE users SET
            elo_rating = $1,
            wins = wins + $2,
            losses = losses + $3,
            goals_scored = goals_scored + $4
          WHERE id = $5`,
          [
            newAwayElo,
            awayScore > homeScore ? 1 : 0,
            awayScore < homeScore ? 1 : 0,
            awayScore,
            awayUserId,
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ match });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save match error:', err.message);
    res.status(500).json({ error: 'Failed to save match' });
  } finally {
    client.release();
  }
});

// ELO calculation (standard chess-style)
function calculateElo(homeRating, awayRating, homeScore, awayScore) {
  const K = 32;
  const expectedHome = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
  const expectedAway = 1 - expectedHome;

  let actualHome, actualAway;
  if (homeScore > awayScore) {
    actualHome = 1; actualAway = 0;
  } else if (awayScore > homeScore) {
    actualHome = 0; actualAway = 1;
  } else {
    actualHome = 0.5; actualAway = 0.5;
  }

  const newHomeElo = Math.round(homeRating + K * (actualHome - expectedHome));
  const newAwayElo = Math.round(awayRating + K * (actualAway - expectedAway));

  return { newHomeElo, newAwayElo };
}

module.exports = router;

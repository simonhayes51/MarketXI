const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/leaderboard — top 100 players by ELO
router.get('/', async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;

  try {
    const result = await query(
      `SELECT
        id,
        username,
        elo_rating,
        wins,
        losses,
        goals_scored,
        (wins + losses) AS total_games,
        CASE WHEN (wins + losses) > 0
          THEN ROUND(wins::numeric / (wins + losses) * 100, 1)
          ELSE 0
        END AS win_percentage,
        RANK() OVER (ORDER BY elo_rating DESC) AS rank,
        created_at
       FROM users
       WHERE (wins + losses) > 0
       ORDER BY elo_rating DESC
       LIMIT $1 OFFSET $2`,
      [Math.min(Number(limit), 100), Number(offset)]
    );

    // Also get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM users WHERE (wins + losses) > 0'
    );

    res.json({
      leaderboard: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/leaderboard/user/:id — get a user's rank
router.get('/user/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT
        id,
        username,
        elo_rating,
        wins,
        losses,
        goals_scored,
        (wins + losses) AS total_games,
        RANK() OVER (ORDER BY elo_rating DESC) AS rank
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ player: result.rows[0] });
  } catch (err) {
    console.error('Get user rank error:', err.message);
    res.status(500).json({ error: 'Failed to get user rank' });
  }
});

module.exports = router;

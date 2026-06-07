const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/teams — list all teams (optionally filtered by league)
router.get('/', async (req, res) => {
  try {
    const { league } = req.query;

    let sql = 'SELECT * FROM teams ORDER BY league, rating DESC';
    let params = [];

    if (league) {
      sql = 'SELECT * FROM teams WHERE league = $1 ORDER BY rating DESC';
      params = [league];
    }

    const result = await query(sql, params);
    res.json({ teams: result.rows });
  } catch (err) {
    console.error('Get teams error:', err.message);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

// GET /api/teams/:id — get a single team
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: 'Invalid team ID' });
  }

  try {
    const result = await query('SELECT * FROM teams WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ team: result.rows[0] });
  } catch (err) {
    console.error('Get team error:', err.message);
    res.status(500).json({ error: 'Failed to get team' });
  }
});

module.exports = router;

import express from 'express';
import requireAuth from './../middleware/requireAuth';
import * as leaderboardController from './../controllers/leaderboardController';

const router = express.Router();

router.get('/', requireAuth, leaderboardController.getLeaderboard);

export default router;

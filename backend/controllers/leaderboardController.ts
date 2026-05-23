import type { Response } from 'express';
import type { AuthRequest } from '../middleware/requireAuth.ts';
import { debug } from '../utils/debug';
import { ScoreModel } from '../models/Score';

const PAGE_MIN = 1;
const PAGE_MAX = 1000;
const LIMIT_MIN = 5;
const LIMIT_MAX = 50;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type LeaderboardEntry = {
  username: string;
  score: number;
  display_name: string;
  _id: string;
};

type LeaderboardResponse = {
  items: LeaderboardEntry[];
  page: number;
  totalPages: number;
  totalCount: number;
};

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const pageParam = Number(req.query.page);
  const limitParam = Number(req.query.limit);
  const page = Number.isFinite(pageParam) ? clamp(Math.trunc(pageParam), PAGE_MIN, PAGE_MAX) : PAGE_MIN;
  const limit = Number.isFinite(limitParam) ? clamp(Math.trunc(limitParam), LIMIT_MIN, LIMIT_MAX) : LIMIT_MIN;

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter = search
    ? {
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { display_name: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  debug('[leaderboard] getLeaderboard', { userId: req.user!.id, page, limit, search });
  try {
    const totalCount = await ScoreModel.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const skip = (page - 1) * limit;

    const scores = await ScoreModel.find(filter)
      .sort({ score: -1, username: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = scores.map((score) => ({
      username: score.username,
      score: score.score ?? 0,
      display_name: score.display_name ?? '',
      _id: String(score._id),
    }));

    const payload: LeaderboardResponse = {
      items,
      page,
      totalPages,
      totalCount,
    };

    debug('[leaderboard] returning', { totalCount, page, totalPages });
    return res.json(payload);
  } catch (err) {
    console.error('[leaderboard] failed to fetch', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { debug } from '../utils/debug';
import { UserModel } from '../models/User';
import { ScoreModel } from '../models/Score';

interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
};

const buildUserResponse = (user: { _id: unknown; username: string; display_name?: string }, score: number) => ({
  id: String(user._id),
  username: user.username,
  display_name: user.display_name ?? '',
  score,
});

export const signup = async (req: Request, res: Response) => {
  console.log('auth register attempted');
  try {
    const { username, display_name, password } = req.body as {
      username?: string;
      display_name?: string;
      password?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const trimmedUsername = username.trim();
    const trimmedDisplay = typeof display_name === 'string' ? display_name.trim() : '';

    debug('[auth] signup attempt', { username: trimmedUsername });
    const existing = await UserModel.findOne({ username: trimmedUsername }).lean();
    if (existing) return res.status(409).json({ error: 'Username taken' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
      username: trimmedUsername,
      display_name: trimmedDisplay,
      password: hashedPassword,
    });

    await ScoreModel.create({
      userId: user._id,
      username: user.username,
      display_name: user.display_name ?? '',
      score: 0,
    });

    debug('[auth] signup success', { username: user.username, id: String(user._id) });

    const token = jwt.sign({ id: String(user._id), username: user.username }, getJwtSecret(), { expiresIn: '7d' });
    res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.status(201).json(buildUserResponse(user, 0));
  } catch (err: any) {
    console.error('SIGNUP CRASH:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const trimmedUsername = username.trim();
    debug('[auth] login attempt', { username: trimmedUsername });

    const user = await UserModel.findOne({ username: trimmedUsername }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const scoreDoc = await ScoreModel.findOne({ userId: user._id }).lean();
    const score = scoreDoc?.score ?? 0;

    debug('[auth] login success', { username: user.username, id: String(user._id) });
    const token = jwt.sign({ id: String(user._id), username: user.username }, getJwtSecret(), { expiresIn: '7d' });
    res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.json(buildUserResponse(user, score));
  } catch (err: any) {
    console.error('LOGIN CRASH:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const logout = (req: Request, res: Response) => {
  debug('[auth] logout');
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ ok: true });
};

export const me = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  console.log('[auth] me', { userId });
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const scoreDoc = await ScoreModel.findOne({ userId: user._id }).lean();
  const score = scoreDoc?.score ?? 0;

  return res.json(buildUserResponse(user, score));
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { display_name, newPassword, currentPassword } = req.body as {
    display_name?: string;
    newPassword?: string;
    currentPassword?: string;
  };

  if (typeof display_name !== 'string' && !newPassword) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  debug('[auth] updateProfile', { userId });
  try {
    const user = await UserModel.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates: { display_name?: string; password?: string } = {};

    if (typeof display_name === 'string') {
      const trimmedDisplay = display_name.trim();
      if (trimmedDisplay !== user.display_name) {
        if (trimmedDisplay.length < 2 || trimmedDisplay.length > 30) {
          return res.status(400).json({ error: 'Username must be 2-30 characters' });
        }

        const existing = await UserModel.findOne({ display_name: trimmedDisplay }).lean();
        if (existing && String(existing._id) !== String(user._id)) {
          return res.status(409).json({ error: 'Display name taken' });
        }
        user.display_name = trimmedDisplay;
        updates.display_name = trimmedDisplay;
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      updates.password = hashedPassword;
    }

    if (Object.keys(updates).length > 0) {
      await user.save();

      if (updates.display_name) {
        await ScoreModel.updateOne(
          { userId: user._id },
          { $set: { display_name: updates.display_name, username: user.username } },
          { upsert: true },
        );
      }
    }

    const scoreDoc = await ScoreModel.findOne({ userId: user._id }).lean();
    const score = scoreDoc?.score ?? 0;

    const token = jwt.sign({ id: String(user._id), username: user.username }, getJwtSecret(), { expiresIn: '7d' });
    res.cookie('token', token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.json(buildUserResponse(user, score));
  } catch (err: any) {
    console.error('[profile] update failed', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const submitScore = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { score } = req.body as { score?: unknown };
  if (typeof score !== 'number' || score < 0 || !Number.isFinite(score) || score > 99999) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  const intScore = Math.trunc(score);

  try {
    const doc = await ScoreModel.findOneAndUpdate(
      { userId },
      { $max: { score: intScore } },
      { upsert: true, new: true },
    );
    return res.json({ score: doc!.score });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to submit score' });
  }
};
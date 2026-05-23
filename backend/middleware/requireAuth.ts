import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const payload = jwt.verify(token, secret) as { id: string; username: string };

    req.user = payload;

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export default requireAuth;
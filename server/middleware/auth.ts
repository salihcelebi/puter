import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { kv } from '../db/kv.js';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }

  const user = await kv.get(`users:${decoded.id}`);
  if (!user) {
    return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
  }

  if (!user.aktif_mi) {
    return res.status(403).json({ error: 'Account is deactivated', code: 'ACCOUNT_INACTIVE' });
  }

  req.user = user;
  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', code: 'NO_TOKEN' });
    }

    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }

    const user = await kv.get(`users:${decoded.id}`);
    if (!user) {
      return res.status(401).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    if (!user.aktif_mi) {
      return res.status(403).json({ error: 'Account is deactivated', code: 'ACCOUNT_INACTIVE' });
    }

    if (user.rol !== 'admin') {
      return res.status(403).json({ error: 'Admin access required', code: 'NOT_ADMIN' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};

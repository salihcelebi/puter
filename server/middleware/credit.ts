import { Response, NextFunction } from 'express';
import { kv } from '../db/kv.js';
import { AuthRequest } from './auth.js';

export const checkCredit = (cost: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Yetkisiz', code: 'UNAUTHORIZED' });
      }
      const user = await kv.get(`users:${req.user.id}`);
      const remaining = Number(user?.toplam_kredi || 0) - Number(user?.kullanilan_kredi || 0);
      if (remaining < cost) {
        return res.status(402).json({ error: 'Yetersiz kredi', code: 'INSUFFICIENT_CREDIT' });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Kredi kontrolü başarısız', code: 'CREDIT_CHECK_FAILED' });
    }
  };
};

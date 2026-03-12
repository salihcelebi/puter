import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { kv } from '../db/kv.js';

export interface AuthRequest extends Request {
  user?: any;
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

// DELILX: resolveUserPermissions backend_strict modunda rol ve kullanıcı izinlerini tek yerde birleştirir.
export function resolveUserPermissions(user: any): Record<string, boolean> {
  const merged: Record<string, boolean> = {};
  if (user?.rol === 'admin') {
    merged.access_admin = true;
    merged.manage_users = true;
    merged.manage_credits = true;
    merged.use_chat = true;
    merged.use_image = true;
    merged.use_video = true;
    merged.use_photo_to_video = true;
    merged.use_tts = true;
    merged.use_music = true;
  }
  if (user?.permissions && typeof user.permissions === 'object') {
    for (const [k, v] of Object.entries(user.permissions)) {
      merged[String(k).toLowerCase()] = Boolean(v);
    }
  }
  return merged;
}

export function hasPermission(user: any, permissionName: string): boolean {
  const permissions = resolveUserPermissions(user);
  return Boolean(permissions[permissionName.toLowerCase()]);
}

// DELILX: requirePermission middleware'i admin ve ai aksiyonlarında backend tarafında gerçek izin kontrolü yapar.
export const requirePermission = (permissionName: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return requireAuth(req, res, () => requirePermission(permissionName)(req, res, next));
    }

    const strictRoleEnforcement = String(process.env.ENV_ROLE_ENFORCEMENT_MODE || '').toLowerCase() === 'backend_strict';
    const requireAiPermissionChecks = envBool('ENV_REQUIRE_PERMISSION_CHECK_ON_ALL_AI_ACTIONS', false);
    const requireAdminPermissionChecks = envBool('ENV_REQUIRE_PERMISSION_CHECK_ON_ADMIN_ACTIONS', false);

    if (!strictRoleEnforcement) return next();

    const isAdminPath = req.path.startsWith('/admin') || req.baseUrl.includes('/admin');
    const isAiPath = req.path.startsWith('/ai') || req.baseUrl.includes('/ai');

    if (isAdminPath && !requireAdminPermissionChecks) return next();
    if (isAiPath && !requireAiPermissionChecks) return next();

    if (hasPermission(req.user, permissionName)) return next();

    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok', code: 'PERMISSION_DENIED' });
  };
};

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

    if (envBool('ENV_BLOCK_ADMIN_API_FOR_NON_ADMINS', true) && user.rol !== 'admin') {
      return res.status(403).json({ error: 'Admin access required', code: 'NOT_ADMIN' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Internal server error during auth' });
  }
};

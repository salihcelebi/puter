import express from 'express';
import { kv } from '../db/kv.js';
import { requireAdmin, requirePermission, AuthRequest } from '../middleware/auth.js';
import {
  grantMePuterWritePermissions,
  revokeMePuterWritePermissions,
  updateUserPermissions,
  ME_PUTER_PERMISSION_KEYS,
  normalizePermissionPatch,
} from '../services/permissionService.js';

const router = express.Router();

const ADMIN_PERMISSION_KEYS = ['access_admin', 'manage_users', 'manage_credits', 'manage_billing'];

router.patch(
  '/admin/users/:userId/permissions',
  requireAdmin,
  requirePermission('manage_users'),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body || {};

      if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
        return res.status(400).json({
          error: 'permissions nesnesi zorunludur',
          code: 'INVALID_PERMISSIONS_PAYLOAD',
        });
      }

      const updatedUser = await updateUserPermissions(userId, permissions);

      return res.status(200).json({
        ok: true,
        message: 'Kullanıcı izinleri güncellendi',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          rol: updatedUser.rol,
          permissions: updatedUser.permissions,
        },
      });
    } catch (error: any) {
      if (error?.message === 'USER_NOT_FOUND' || error?.statusCode === 404) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
      }

      console.error('Admin permissions patch error:', error);
      return res.status(500).json({ error: 'İzin güncelleme sırasında sunucu hatası oluştu', code: 'ADMIN_PERMISSION_UPDATE_FAILED' });
    }
  }
);

router.patch('/admin/users/:userId/access', requireAdmin, requirePermission('manage_users'), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { rol, permissions, toplam_kredi, muhasebe_notu } = req.body || {};

    const user = await kv.get(`users:${userId}`);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
    }

    if (rol !== undefined && rol !== 'admin' && rol !== 'user') {
      return res.status(400).json({ error: 'rol user/admin olmalı', code: 'INVALID_ROLE' });
    }

    if (user.is_system_user && rol === 'user' && user.rol === 'admin') {
      return res.status(403).json({ error: 'Sistem admin rolü düşürülemez', code: 'SYSTEM_USER_ROLE_PROTECTED' });
    }

    const nextPermissions = permissions && typeof permissions === 'object' && !Array.isArray(permissions)
      ? {
          ...(user.permissions && typeof user.permissions === 'object' ? normalizePermissionPatch(user.permissions) : {}),
          ...normalizePermissionPatch(permissions),
        }
      : user.permissions || {};

    const updated = {
      ...user,
      rol: rol ?? user.rol,
      permissions: nextPermissions,
      toplam_kredi: typeof toplam_kredi === 'number' && Number.isFinite(toplam_kredi) ? Math.max(0, toplam_kredi) : user.toplam_kredi,
      son_kredi_dusumu: typeof toplam_kredi === 'number' ? Number(user.toplam_kredi || 0) - Math.max(0, toplam_kredi) : user.son_kredi_dusumu || 0,
      ic_maliyet: user.ic_maliyet || 0,
      owner_kaynagi: user.owner_kaynagi || 'me.puter',
      muhasebe_notu: typeof muhasebe_notu === 'string' ? muhasebe_notu : (user.muhasebe_notu || ''),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`users:${userId}`, updated);
    if (updated.email) await kv.set(`userByEmail:${String(updated.email)}`, updated.id);

    return res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Admin access update error:', error);
    return res.status(500).json({ error: 'Erişim bilgileri güncellenemedi', code: 'ADMIN_ACCESS_UPDATE_FAILED' });
  }
});

router.post('/admin/users/bulk-access', requireAdmin, requirePermission('manage_users'), async (req: AuthRequest, res) => {
  try {
    const { userIds, rol, permissions } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds zorunludur', code: 'INVALID_USER_IDS' });
    }
    if (rol !== undefined && rol !== 'admin' && rol !== 'user') {
      return res.status(400).json({ error: 'rol user/admin olmalı', code: 'INVALID_ROLE' });
    }

    const patch = permissions && typeof permissions === 'object' && !Array.isArray(permissions)
      ? normalizePermissionPatch(permissions)
      : null;

    const results: Array<{ userId: string; status: string; reason?: string }> = [];

    for (const userId of userIds) {
      const user = await kv.get(`users:${String(userId)}`);
      if (!user) {
        results.push({ userId: String(userId), status: 'skipped', reason: 'USER_NOT_FOUND' });
        continue;
      }
      if (user.is_system_user && rol === 'user' && user.rol === 'admin') {
        results.push({ userId: String(userId), status: 'skipped', reason: 'SYSTEM_USER_ROLE_PROTECTED' });
        continue;
      }

      const nextPermissions = patch
        ? { ...(user.permissions && typeof user.permissions === 'object' ? normalizePermissionPatch(user.permissions) : {}), ...patch }
        : user.permissions;

      const next = {
        ...user,
        rol: rol ?? user.rol,
        permissions: nextPermissions,
        updated_at: new Date().toISOString(),
      };

      await kv.set(`users:${next.id}`, next);
      results.push({ userId: String(userId), status: 'updated' });
    }

    return res.json({ success: true, results });
  } catch (error) {
    console.error('Bulk access update error:', error);
    return res.status(500).json({ error: 'Toplu güncelleme başarısız', code: 'ADMIN_BULK_ACCESS_UPDATE_FAILED' });
  }
});

router.post(
  '/admin/users/:userId/permissions/me-puter/grant',
  requireAdmin,
  requirePermission('manage_users'),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const updatedUser = await grantMePuterWritePermissions(userId);

      return res.status(200).json({
        ok: true,
        message: 'me.puter izinleri açıldı',
        granted_permissions: ME_PUTER_PERMISSION_KEYS,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          rol: updatedUser.rol,
          permissions: updatedUser.permissions,
        },
      });
    } catch (error: any) {
      if (error?.message === 'USER_NOT_FOUND' || error?.statusCode === 404) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
      }

      console.error('Grant me.puter permissions error:', error);
      return res.status(500).json({ error: 'me.puter izinleri açılırken sunucu hatası oluştu', code: 'GRANT_ME_PUTER_PERMISSIONS_FAILED' });
    }
  }
);

router.post(
  '/admin/users/:userId/permissions/me-puter/revoke',
  requireAdmin,
  requirePermission('manage_users'),
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const updatedUser = await revokeMePuterWritePermissions(userId);

      return res.status(200).json({
        ok: true,
        message: 'me.puter izinleri kapatıldı',
        revoked_permissions: ME_PUTER_PERMISSION_KEYS,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          rol: updatedUser.rol,
          permissions: updatedUser.permissions,
        },
      });
    } catch (error: any) {
      if (error?.message === 'USER_NOT_FOUND' || error?.statusCode === 404) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' });
      }

      console.error('Revoke me.puter permissions error:', error);
      return res.status(500).json({ error: 'me.puter izinleri kapatılırken sunucu hatası oluştu', code: 'REVOKE_ME_PUTER_PERMISSIONS_FAILED' });
    }
  }
);

router.get('/admin/permissions/meta', requireAdmin, requirePermission('manage_users'), (_req, res) => {
  return res.json({
    aiPermissions: ME_PUTER_PERMISSION_KEYS,
    adminPermissions: ADMIN_PERMISSION_KEYS,
  });
});

export default router;

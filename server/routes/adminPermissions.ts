import express from 'express';
import { requireAdmin, requirePermission, AuthRequest } from '../middleware/auth.js';
import {
  grantMePuterWritePermissions,
  revokeMePuterWritePermissions,
  updateUserPermissions,
  ME_PUTER_PERMISSION_KEYS,
} from '../services/permissionService.js';

const router = express.Router();

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
        return res.status(404).json({
          error: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND',
        });
      }

      console.error('Admin permissions patch error:', error);
      return res.status(500).json({
        error: 'İzin güncelleme sırasında sunucu hatası oluştu',
        code: 'ADMIN_PERMISSION_UPDATE_FAILED',
      });
    }
  }
);

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
        return res.status(404).json({
          error: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND',
        });
      }

      console.error('Grant me.puter permissions error:', error);
      return res.status(500).json({
        error: 'me.puter izinleri açılırken sunucu hatası oluştu',
        code: 'GRANT_ME_PUTER_PERMISSIONS_FAILED',
      });
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
        return res.status(404).json({
          error: 'Kullanıcı bulunamadı',
          code: 'USER_NOT_FOUND',
        });
      }

      console.error('Revoke me.puter permissions error:', error);
      return res.status(500).json({
        error: 'me.puter izinleri kapatılırken sunucu hatası oluştu',
        code: 'REVOKE_ME_PUTER_PERMISSIONS_FAILED',
      });
    }
  }
);

export default router;

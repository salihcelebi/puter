import { kv } from '../db/kv.js';

export const ME_PUTER_PERMISSION_KEYS = [
  'use_chat',
  'use_image',
  'use_video',
  'use_photo_to_video',
  'use_tts',
  'use_music',
] as const;

export type MePuterPermissionKey = typeof ME_PUTER_PERMISSION_KEYS[number];
export type PermissionPatch = Partial<Record<MePuterPermissionKey | string, boolean>>;

export function normalizePermissionPatch(input: Record<string, any> = {}): Record<string, boolean> {
  const normalized: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(input)) {
    normalized[String(key).trim().toLowerCase()] = Boolean(value);
  }

  return normalized;
}

export async function getUserOrThrow(userId: string) {
  const user = await kv.get(`users:${userId}`);
  if (!user) {
    const error = new Error('USER_NOT_FOUND');
    (error as any).statusCode = 404;
    throw error;
  }

  return user;
}

export async function updateUserPermissions(userId: string, patch: PermissionPatch) {
  const user = await getUserOrThrow(userId);

  const currentPermissions =
    user?.permissions && typeof user.permissions === 'object'
      ? normalizePermissionPatch(user.permissions)
      : {};

  const nextPermissions = {
    ...currentPermissions,
    ...normalizePermissionPatch(patch as Record<string, any>),
  };

  const updatedUser = {
    ...user,
    permissions: nextPermissions,
    updated_at: new Date().toISOString(),
  };

  await kv.set(`users:${userId}`, updatedUser);

  if (user?.email) {
    await kv.set(`userByEmail:${String(user.email)}`, userId);
  }

  return updatedUser;
}

export async function grantMePuterWritePermissions(userId: string) {
  const grantPatch: Record<string, boolean> = {};

  for (const key of ME_PUTER_PERMISSION_KEYS) {
    grantPatch[key] = true;
  }

  return updateUserPermissions(userId, grantPatch);
}

export async function revokeMePuterWritePermissions(userId: string) {
  const revokePatch: Record<string, boolean> = {};

  for (const key of ME_PUTER_PERMISSION_KEYS) {
    revokePatch[key] = false;
  }

  return updateUserPermissions(userId, revokePatch);
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { kv } from '../db/kv.js';

const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters.');
  }

  return jwtSecret;
};

export interface User {
  id: string;
  email: string;
  kullanici_adi: string;
  gorunen_ad: string;
  sifre_hash?: string;
  google_id?: string;
  auth_provider: 'local' | 'google';
  aktif_mi: boolean;
  rol: 'user' | 'admin';
  toplam_kredi: number;
  kullanilan_kredi: number;
  olusturma_tarihi: string;
  son_giris_tarihi: string;
  permissions?: Record<string, boolean>;
  permission_summary?: string;
  is_system_user?: boolean;
  is_seeded?: boolean;
  is_new_user?: boolean;
  notes?: string;
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (value) return value;
  }
  return undefined;
}

function collectPermissions(prefix: string) {
  const permissions: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(`${prefix}_CAN_`)) continue;
    const permissionName = key.replace(`${prefix}_CAN_`, '').toLowerCase();
    permissions[permissionName] = parseBool(value, false);
  }
  return permissions;
}

function getPasswordHashConfig() {
  return {
    mustHashOnBoot: parseBool(process.env.ENV_PASSWORDS_MUST_BE_HASHED_ON_BOOT, true),
    strategy: (process.env.ENV_PASSWORD_HASH_STRATEGY || 'bcrypt').trim().toLowerCase(),
    rounds: parseNumber(process.env.ENV_PASSWORD_HASH_ROUNDS, 12),
  };
}

async function hashPasswordOnBoot(plainTextPassword: string) {
  const cfg = getPasswordHashConfig();
  if (!cfg.mustHashOnBoot) return plainTextPassword;
  if (cfg.strategy !== 'bcrypt') {
    throw new Error(`ENV_PASSWORD_HASH_STRATEGY desteklenmiyor: ${cfg.strategy}`);
  }
  // DELILX: PASSWORD HASH ON BOOT adımı plaintext parolayı kalıcı kayda yazmadan hashlemeyi zorunlu uygular.
  return bcrypt.hash(plainTextPassword, Math.max(4, Math.floor(cfg.rounds)));
}

function toSafeUser(user: User) {
  const { sifre_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export const authService = {
  async findUserByEmail(email: string): Promise<User | null> {
    const userId = await kv.get(`userByEmail:${email}`);
    if (!userId) return null;
    return await kv.get(`users:${userId}`);
  },

  async findUserByUsername(username: string): Promise<User | null> {
    const userId = await kv.get(`userByUsername:${username}`);
    if (!userId) return null;
    return await kv.get(`users:${userId}`);
  },


  async findUserByGoogleId(googleId: string): Promise<User | null> {
    const userId = await kv.get(`userByGoogleId:${googleId}`);
    if (!userId) return null;
    return await kv.get(`users:${userId}`);
  },

  async createUser(data: Partial<User>): Promise<User> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const user: User = {
      id,
      email: data.email!,
      kullanici_adi: data.kullanici_adi || data.email!.split('@')[0],
      gorunen_ad: data.gorunen_ad || data.email!.split('@')[0],
      sifre_hash: data.sifre_hash,
      google_id: data.google_id,
      auth_provider: data.auth_provider || 'local',
      aktif_mi: true,
      rol: 'user',
      toplam_kredi: data.toplam_kredi !== undefined ? data.toplam_kredi : 100,
      kullanilan_kredi: 0,
      olusturma_tarihi: now,
      son_giris_tarihi: now,
    };

    await kv.set(`users:${id}`, user);
    await kv.set(`userByEmail:${user.email}`, id);
    if (user.kullanici_adi) {
      await kv.set(`userByUsername:${user.kullanici_adi}`, id);
    }
    if (user.google_id) {
      await kv.set(`userByGoogleId:${user.google_id}`, id);
    }

    return user;
  },


  async linkGoogleIdentity(userId: string, googleId: string, displayName?: string): Promise<User | null> {
    const user = await kv.get(`users:${userId}`);
    if (!user) return null;

    user.google_id = googleId;
    user.auth_provider = 'google';
    if (displayName && !user.gorunen_ad) {
      user.gorunen_ad = displayName;
    }

    await kv.set(`users:${userId}`, user);
    await kv.set(`userByGoogleId:${googleId}`, userId);
    return user;
  },

  async updateLastLogin(userId: string): Promise<void> {
    const user = await kv.get(`users:${userId}`);
    if (user) {
      user.son_giris_tarihi = new Date().toISOString();
      await kv.set(`users:${userId}`, user);
    }
  },

  generateToken(user: User): string {
    return jwt.sign({ id: user.id, email: user.email, rol: user.rol }, getJwtSecret(), { expiresIn: '7d' });
  },

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, getJwtSecret());
    } catch (e) {
      return null;
    }
  },

  async ensureAdminFromEnv() {
    return this.ensureSystemUsersFromEnv();
  },

  // DELILX: ENV USERS bloğu boot sırasında admin ve test_user kayıtlarını idempotent upsert eder.
  async ensureSystemUsersFromEnv() {
    const usersEnabled = parseBool(process.env.ENV_USERS_ENABLED, true);
    const syncOnBoot = parseBool(process.env.ENV_USERS_SYNC_ON_BOOT, true);
    if (!usersEnabled || !syncOnBoot) {
      console.log('[ENV USERS] sync skipped (ENV_USERS_ENABLED/ENV_USERS_SYNC_ON_BOOT false)');
      return;
    }

    const adminUsername = pickEnv('ADMIN_USERNAME');
    const adminPassword = pickEnv('ADMIN_PASSWORD');
    const adminEmail = pickEnv('ADMIN_EMAIL') || `${adminUsername || 'admin'}@local.admin`;

    const testUsername = pickEnv('TEST_USER_USERNAME', 'ENV_TEST_USER_USERNAME');
    const testPassword = pickEnv('TEST_USER_PASSWORD', 'ENV_TEST_USER_PASSWORD');
    const testEmail = pickEnv('TEST_USER_EMAIL', 'ENV_TEST_USER_EMAIL') || `${testUsername || 'test_user'}@local.user`;

    const specs: Array<{ key: 'admin' | 'test_user'; username?: string; password?: string; email?: string; role: 'admin' | 'user'; displayName: string; credit: number; envPrefix: string; }> = [
      {
        key: 'admin',
        username: adminUsername,
        password: adminPassword,
        email: adminEmail,
        role: 'admin',
        displayName: 'Sistem Yöneticisi',
        credit: 999999,
        envPrefix: 'ENV_ADMIN',
      },
      {
        key: 'test_user',
        username: testUsername,
        password: testPassword,
        email: testEmail,
        role: 'user',
        displayName: 'Test Kullanıcısı',
        credit: parseNumber(process.env.ENV_TEST_USER_DEFAULT_CREDITS, 0),
        envPrefix: 'ENV_TEST_USER',
      },
    ];

    for (const spec of specs) {
      if (!spec.username || !spec.password) {
        if (spec.key === 'admin') {
          throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required.');
        }
        continue;
      }
      try {
        await this.upsertSystemUserFromEnv(spec);
        console.log(`[ENV USERS] ${spec.key} upsert ok (${spec.username})`);
      } catch (error) {
        console.error(`[ENV USERS] ${spec.key} upsert fail (${spec.username})`, error);
        throw error;
      }
    }
  },

  // DELILX: USER UPSERT adımı username/email indexlerini koruyarak tekrar çalıştırılabilir güvenli güncelleme yapar.
  async upsertSystemUserFromEnv(spec: {
    key: 'admin' | 'test_user';
    username: string;
    password: string;
    email: string;
    role: 'admin' | 'user';
    displayName: string;
    credit: number;
    envPrefix: string;
  }) {
    const now = new Date().toISOString();
    const existingByUsername = await this.findUserByUsername(spec.username);
    const existingByEmail = await this.findUserByEmail(spec.email);
    const existing = existingByUsername || existingByEmail;

    const permissions = collectPermissions(spec.envPrefix);
    const passwordHash = await hashPasswordOnBoot(spec.password);
    console.log(`[PASSWORD HASH ON BOOT] ${spec.key} hash on boot ok`);

    const userPayload: User = {
      ...(existing || {} as User),
      id: existing?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      email: spec.email,
      kullanici_adi: spec.username,
      gorunen_ad: existing?.gorunen_ad || spec.displayName,
      sifre_hash: passwordHash,
      auth_provider: 'local',
      aktif_mi: parseBool(process.env[`${spec.envPrefix}_STATUS`] ? process.env[`${spec.envPrefix}_STATUS`] === 'active' ? 'true' : 'false' : undefined, true),
      rol: spec.role,
      toplam_kredi: existing?.toplam_kredi ?? spec.credit,
      kullanilan_kredi: existing?.kullanilan_kredi ?? 0,
      olusturma_tarihi: existing?.olusturma_tarihi || now,
      son_giris_tarihi: existing?.son_giris_tarihi || now,
      permissions,
      permission_summary: pickEnv(`${spec.envPrefix}_PERMISSION_SUMMARY`) || existing?.permission_summary,
      is_system_user: parseBool(process.env[`${spec.envPrefix}_IS_SYSTEM_USER`], true),
      is_seeded: parseBool(process.env[`${spec.envPrefix}_IS_SEEDED`], true),
      is_new_user: parseBool(process.env[`${spec.envPrefix}_IS_NEW_USER`], false),
      notes: pickEnv(`${spec.envPrefix}_NOTES`) || existing?.notes,
    };

    await kv.set(`users:${userPayload.id}`, userPayload);
    await kv.set(`userByEmail:${userPayload.email}`, userPayload.id);
    await kv.set(`userByUsername:${userPayload.kullanici_adi}`, userPayload.id);

    if (existing && existing.email !== userPayload.email) {
      await kv.delete(`userByEmail:${existing.email}`);
    }
    if (existing && existing.kullanici_adi !== userPayload.kullanici_adi) {
      await kv.delete(`userByUsername:${existing.kullanici_adi}`);
    }

    return userPayload;
  },

  toSafeUser,
};

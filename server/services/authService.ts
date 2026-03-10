import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { kv } from '../db/kv.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-prod';

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
      rol: data.rol || 'user',
      toplam_kredi: data.toplam_kredi !== undefined ? data.toplam_kredi : 100, // Initial free credits
      kullanilan_kredi: 0,
      olusturma_tarihi: now,
      son_giris_tarihi: now,
    };

    await kv.set(`users:${id}`, user);
    await kv.set(`userByEmail:${user.email}`, id);
    if (user.kullanici_adi) {
      await kv.set(`userByUsername:${user.kullanici_adi}`, id);
    }

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
    return jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  },

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return null;
    }
  },

  async ensureDefaultAdmin() {
    const adminUser = await this.findUserByUsername('admin');
    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const sifre_hash = await bcrypt.hash('admin', salt);
      
      await this.createUser({
        email: 'admin@nisai.site',
        kullanici_adi: 'admin',
        gorunen_ad: 'Sistem Yöneticisi',
        sifre_hash,
        auth_provider: 'local',
        rol: 'admin',
        toplam_kredi: 999999,
      });
      console.log('Default admin user created (admin / admin)');
    }
  }
};

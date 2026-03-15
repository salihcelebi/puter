/*
█████████████████████████████████████████████
1) BU DOSYA, SUNUCU TARAFINDAKİ ANA KİMLİK DOĞRULAMA VE YETKİLENDİRME MIDDLEWARE KATMANIDIR.
2) AuthRequest ARAYÜZÜ, EXPRESS REQUEST NESNESİNE user ALANINI EKLEYEREK TİP GÜVENLİĞİ SAĞLAR.
3) envBool YARDIMCI FONKSİYONU, ENV DEĞERLERİNİ GÜVENLİ ŞEKİLDE BOOLEAN'A ÇEVİRİR.
4) resolveUserPermissions FONKSİYONU, ROL VE KULLANICI BAZLI İZİNLERİ TEK BİR MERKEZDE BİRLEŞTİRİR.
5) admin ROLÜ İÇİN access_admin, manage_users, manage_credits VE BENZERİ YÜKSEK İZİNLER OTOMATİK TANIMLANIR.
6) user.permissions NESNESİ VARSA, BU NESNEDEKİ DEĞERLER DE MERGED YAPIYA EKLENİR.
7) TÜM PERMISSION ANAHTARLARI lowercase YAPILARAK TUTARLI KONTROL SAĞLANIR.
8) BU DOSYA, “ROL + KİŞİSEL İZİN” HİBRİT YETKİ MODELİ KULLANIR.
9) authService BAĞLANTISI SAYESİNDE KİMLİK DOĞRULAMA MANTIĞI TEK BAŞINA BU DOSYAYA GÖMÜLMEZ.
10) kv BAĞLANTISI, GEREKTİĞİNDE KULLANICIYI SUNUCU VERİTABANINDAN OKUMAK İÇİN KULLANILIR.
11) requireAuth BENZERİ MIDDLEWARE'LAR, GİRİŞ YAPMAMIŞ KULLANICILARI ERKEN AŞAMADA ENGELLEMEK İÇİN TASARLANIR.
12) requireAdmin AKIŞI, SADECE ADMIN ROLÜ VEYA EŞDEĞER İZNİ OLANLARI KORUNAN ALANLARA SOKAR.
13) requirePermission, BELİRLİ BİR İŞLEM İZNİNİN VARLIĞINI KONTROL ETMEK İÇİN İNCE AYARLI BİR KAPI GÖRÜR.
14) BU DOSYA, ADMIN PANELİ VE ÖZELLİK BAZLI ERİŞİM KONTROLÜNÜN ANA DAYANAĞIDIR.
15) use_image, use_video, use_chat, use_tts GİBİ PERMISSION'LAR ÖZELLİK KİLİTLEME İÇİN KULLANILIR.
16) backend_strict TARZI MODLARLA İZİN ÇÖZÜMLEME DAVRANIŞI DAHA SIKI HALE GETİRİLEBİLİR.
17) MIDDLEWARE DÜZEYİNDE YAPILAN KONTROL, ROUTE DOSYALARININ DAHA TEMİZ KALMASINI SAĞLAR.
18) USER NESNESİ req.user İÇİNE YAZILDIĞI İÇİN SONRAKİ TÜM ROUTE'LAR AYNI KULLANICI BAĞLAMINI PAYLAŞIR.
19) BU DOSYA, SADECE “GİRİŞ YAPMIŞ MI?” SORUSUNU DEĞİL, “NEYİ YAPABİLİR?” SORUSUNU DA ÇÖZER.
20) AUTH HATALARININ ERKEN DÖNÜLMESİ, DAHA İLERİ KODUN BOŞA ÇALIŞMASINI ENGELLER.
21) ADMIN, BILLING, AI VE USER ROUTE'LARI BU DOSYANIN DAVRANIŞINA DOĞRUDAN BAĞLIDIR.
22) DOSYADAKİ YAPI, FRONTEND İLE BACKEND ARASINDA SABİT BİR ERİŞİM SÖZLEŞMESİ KURAR.
23) GÜVENLİK AÇISINDAN EN KRİTİK KATMANLARDAN BİRİ BU DOSYADIR; ÇÜNKÜ ERİŞİM KARARI BURADA VERİLİR.
24) YANLIŞ BİR İZİN ÇÖZÜMLEMESİ, HEM FAZLA YETKİ HEM DE GEREKSİZ ENGEL ÜRETEBİLİR; BU NEDENLE DOSYA MERKEZİ ÖNEMDEDİR.
25) KISACA: BU DOSYA, PROJENİN KİMLİK DOĞRULAMA SONRASI YETKİ HARİTASINI ÇIKARAN ANA GÜVENLİK KAPISIDIR.
█████████████████████████████████████████████
*/
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
    merged.manage_billing = true;
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


async function resolveUserFromTokenPayload(decoded: any) {
  const userId = decoded?.id ? String(decoded.id) : '';
  if (userId) {
    const byId = await kv.get(`users:${userId}`);
    if (byId) return byId;
  }

  const email = decoded?.email ? String(decoded.email) : '';
  if (email) {
    const fallbackUserId = await kv.get(`userByEmail:${email}`);
    if (fallbackUserId) {
      const byEmail = await kv.get(`users:${fallbackUserId}`);
      if (byEmail) return byEmail;
    }
  }

  return null;
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

  // DELILX: stale token durumunda email index fallback ile gerçek kullanıcı kaydını güvenli şekilde bulur.
  const user = await resolveUserFromTokenPayload(decoded);
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

    // DELILX: admin doğrulamasında id uyuşmazlığında email tabanlı fallback ile user lookup sürekliliği korunur.
    const user = await resolveUserFromTokenPayload(decoded);
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

import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authService } from '../services/authService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Cookie options for security
const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('none' as 'none') : ('lax' as 'lax'),
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};


const googleOauthStateCookie = 'google_oauth_state';
const googleStateCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('none' as 'none') : ('lax' as 'lax'),
  maxAge: 10 * 60 * 1000,
};

const getGoogleConfig = (req: any) => {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const configuredRedirectUri = (process.env.GOOGLE_REDIRECT_URI || '').trim();

  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol || (isProd ? 'https' : 'http');
  const host = req.get('host');
  const fallbackRedirectUri = `${proto}://${host}/api/auth/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri: configuredRedirectUri || fallbackRedirectUri,
  };
};

const normalizeUsername = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || `google_user_${Date.now()}`;

const buildUniqueUsername = async (base: string) => {
  const normalizedBase = normalizeUsername(base);

  const firstHit = await authService.findUserByUsername(normalizedBase);
  if (!firstHit) return normalizedBase;

  for (let i = 0; i < 10; i += 1) {
    const candidate = `${normalizedBase}_${Math.random().toString(36).slice(2, 6)}`;
    const existing = await authService.findUserByUsername(candidate);
    if (!existing) return candidate;
  }

  return `${normalizedBase}_${Date.now()}`;
};

const sendAuthError = (res: any, status: number, message: string, code?: string) => {
  return res.status(status).json({
    success: false,
    error: message,
    ...(code ? { code } : {}),
  });
};

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, kullanici_adi, gorunen_ad } = req.body;

    if (!email || !password) {
      return sendAuthError(res, 400, 'Email and password are required', 'VALIDATION_ERROR');
    }

    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return sendAuthError(res, 400, 'Email already in use', 'EMAIL_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const sifre_hash = await bcrypt.hash(password, salt);

    const user = await authService.createUser({
      email,
      sifre_hash,
      kullanici_adi,
      gorunen_ad,
      auth_provider: 'local'
    });

    const token = authService.generateToken(user);
    res.cookie('token', token, cookieOptions);

    const safeUser = authService.toSafeUser(user);
    return res.status(201).json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Register error:', error);
    return sendAuthError(res, 500, 'Internal server error', 'REGISTER_ERROR');
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return sendAuthError(res, 400, 'Kullanıcı adı/E-posta ve şifre gereklidir', 'VALIDATION_ERROR');
    }

    let user = await authService.findUserByEmail(identifier);
    if (!user) {
      user = await authService.findUserByUsername(identifier);
    }

    if (!user || !user.sifre_hash) {
      return sendAuthError(res, 401, 'Geçersiz kimlik bilgileri', 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.sifre_hash);
    if (!isMatch) {
      return sendAuthError(res, 401, 'Geçersiz kimlik bilgileri', 'INVALID_CREDENTIALS');
    }

    if (!user.aktif_mi) {
      return sendAuthError(res, 403, 'Hesabınız devre dışı bırakılmış', 'ACCOUNT_DISABLED');
    }

    await authService.updateLastLogin(user.id);

    const token = authService.generateToken(user);
    res.cookie('token', token, cookieOptions);

    const safeUser = authService.toSafeUser(user);
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    return sendAuthError(res, 500, 'Sunucu hatası', 'LOGIN_ERROR');
  }
});

authRouter.post('/logout', (req, res) => {
  try {
    res.clearCookie('token');
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return sendAuthError(res, 500, 'Sunucu hatası', 'LOGOUT_ERROR');
  }
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  try {
    const safeUser = authService.toSafeUser(req.user);
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Me error:', error);
    return sendAuthError(res, 500, 'Sunucu hatası', 'ME_ERROR');
  }
});

// Google OAuth endpoints
authRouter.get('/google/url', (req, res) => {
  const { clientId, redirectUri } = getGoogleConfig(req);

  if (!clientId) {
    return sendAuthError(res, 500, 'Google OAuth yapılandırması eksik', 'GOOGLE_OAUTH_CONFIG_ERROR');
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(googleOauthStateCookie, state, googleStateCookieOptions);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  return res.json({
    success: true,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const stateCookie = req.cookies?.[googleOauthStateCookie];

    if (!code || !state || !stateCookie || stateCookie !== state) {
      return res.redirect('/giris?error=oauth_state_invalid');
    }

    res.clearCookie(googleOauthStateCookie);

    const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
    if (!clientId || !clientSecret) {
      return res.redirect('/giris?error=oauth_config');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error('Google token exchange failed', tokenResponse.status, await tokenResponse.text());
      return res.redirect('/giris?error=oauth_token_failed');
    }

    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) {
      return res.redirect('/giris?error=oauth_token_missing');
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });

    if (!profileResponse.ok) {
      console.error('Google profile fetch failed', profileResponse.status, await profileResponse.text());
      return res.redirect('/giris?error=oauth_profile_failed');
    }

    const profile = await profileResponse.json() as {
      sub?: string;
      email?: string;
      name?: string;
      email_verified?: boolean;
    };

    if (!profile.sub || !profile.email || profile.email_verified === false) {
      return res.redirect('/giris?error=oauth_profile_invalid');
    }

    let user = await authService.findUserByGoogleId(profile.sub);
    if (!user) {
      user = await authService.findUserByEmail(profile.email);
      if (user) {
        user = await authService.linkGoogleIdentity(user.id, profile.sub, profile.name || undefined);
      }
    }

    if (!user) {
      const usernameBase = profile.email.split('@')[0] || profile.name || 'google_user';
      const uniqueUsername = await buildUniqueUsername(usernameBase);
      user = await authService.createUser({
        email: profile.email,
        kullanici_adi: uniqueUsername,
        gorunen_ad: profile.name || uniqueUsername,
        auth_provider: 'google',
        google_id: profile.sub,
      });
    }

    if (!user?.aktif_mi) {
      return sendAuthError(res, 403, 'Account is deactivated', 'ACCOUNT_DISABLED');
    }

    await authService.updateLastLogin(user.id);

    const token = authService.generateToken(user);
    res.cookie('token', token, cookieOptions);

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.redirect('/giris?error=oauth_failed');
  }
});

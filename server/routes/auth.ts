import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authService } from '../services/authService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Cookie options for security
const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as const,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

    const { sifre_hash: _, ...safeUser } = user;
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

    const { sifre_hash: _, ...safeUser } = user;
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
    const { sifre_hash: _, ...safeUser } = req.user;
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Me error:', error);
    return sendAuthError(res, 500, 'Sunucu hatası', 'ME_ERROR');
  }
});

// Mock Google OAuth endpoints
authRouter.get('/google/url', (req, res) => {
  // In a real app, this would return the Google OAuth URL
  return res.json({ success: true, url: '/api/auth/google/callback?code=mock_code' });
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    // Mock Google OAuth callback
    const mockEmail = 'google_user@example.com';
    let user = await authService.findUserByEmail(mockEmail);

    if (!user) {
      user = await authService.createUser({
        email: mockEmail,
        kullanici_adi: 'google_user',
        gorunen_ad: 'Google User',
        auth_provider: 'google',
        google_id: 'mock_google_id_123'
      });
    }

    if (!user.aktif_mi) {
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

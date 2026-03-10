import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authService } from '../services/authService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Cookie options for security
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, kullanici_adi, gorunen_ad } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
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
    res.status(201).json({ user: safeUser });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı/E-posta ve şifre gereklidir' });
    }

    let user = await authService.findUserByEmail(identifier);
    if (!user) {
      user = await authService.findUserByUsername(identifier);
    }

    if (!user || !user.sifre_hash) {
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });
    }

    const isMatch = await bcrypt.compare(password, user.sifre_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });
    }

    if (!user.aktif_mi) {
      return res.status(403).json({ error: 'Hesabınız devre dışı bırakılmış' });
    }

    await authService.updateLastLogin(user.id);

    const token = authService.generateToken(user);
    res.cookie('token', token, cookieOptions);

    const { sifre_hash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const { sifre_hash: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Mock Google OAuth endpoints
authRouter.get('/google/url', (req, res) => {
  // In a real app, this would return the Google OAuth URL
  res.json({ url: '/api/auth/google/callback?code=mock_code' });
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    // Mock Google OAuth callback
    // In a real app, you would exchange the code for tokens and get user info
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
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    await authService.updateLastLogin(user.id);

    const token = authService.generateToken(user);
    res.cookie('token', token, cookieOptions);

    // Redirect to frontend dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect('/giris?error=oauth_failed');
  }
});

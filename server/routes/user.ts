import { Router } from 'express';
import { kv } from '../db/kv.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const userRouter = Router();

userRouter.use(requireAuth);

// Get user profile
userRouter.get('/profile', async (req: AuthRequest, res) => {
  try {
    const user = await kv.get(`users:${req.user.id}`);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    
    // Remove sensitive data
    const { sifre_hash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Get user assets
userRouter.get('/assets', async (req: AuthRequest, res) => {
  try {
    const allAssets = await kv.list('assets:');
    const userAssets = allAssets
      .map(item => item.value)
      .filter(asset => asset.kullanici_id === req.user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
    res.json(userAssets);
  } catch (error) {
    res.status(500).json({ error: 'Varlıklar alınamadı' });
  }
});

// Delete an asset
userRouter.delete('/assets/:id', async (req: AuthRequest, res) => {
  try {
    const assetId = req.params.id;
    const asset = await kv.get(`assets:${assetId}`);
    
    if (!asset || asset.kullanici_id !== req.user.id) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }
    
    await kv.delete(`assets:${assetId}`);
    // In a real app, also delete from fileSystem
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Varlık silinemedi' });
  }
});

// Download an asset
userRouter.get('/assets/:id/download', async (req: AuthRequest, res) => {
  try {
    const assetId = req.params.id;
    const asset = await kv.get(`assets:${assetId}`);
    
    if (!asset || asset.kullanici_id !== req.user.id) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }
    
    // In a real app, you would read the file from the file system and stream it
    // For this mock, we'll just send a success response or a mock file
    // res.download(asset.fs_path, asset.dosya_adi);
    
    res.json({ success: true, message: 'İndirme işlemi simüle edildi', url: asset.fs_path });
  } catch (error) {
    res.status(500).json({ error: 'Varlık indirilemedi' });
  }
});

// Get user usage history
userRouter.get('/usage', async (req: AuthRequest, res) => {
  try {
    const allUsage = await kv.list('usage:');
    const userUsage = allUsage
      .map(item => item.value)
      .filter(usage => usage.kullanici_id === req.user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
    res.json(userUsage);
  } catch (error) {
    res.status(500).json({ error: 'Kullanım geçmişi alınamadı' });
  }
});

// Get user credit history
userRouter.get('/credits', async (req: AuthRequest, res) => {
  try {
    const allLedger = await kv.list('creditLedger:');
    const userLedger = allLedger
      .map(item => item.value)
      .filter(entry => entry.kullanici_id === req.user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
    res.json(userLedger);
  } catch (error) {
    res.status(500).json({ error: 'Kredi geçmişi alınamadı' });
  }
});

// Get user dashboard summary
userRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const user = await kv.get(`users:${userId}`);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const allUsage = await kv.list('usage:');
    const userUsage = allUsage
      .map(item => item.value)
      .filter(usage => usage.kullanici_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const allAssets = await kv.list('assets:');
    const userAssets = allAssets
      .map(item => item.value)
      .filter(asset => asset.kullanici_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const allPayments = await kv.list('payments:');
    const userPayments = allPayments
      .map(item => item.value)
      .filter(payment => payment.kullanici_id === userId && payment.durum === 'success');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Calculate metrics
    const todayUsedCredit = userUsage
      .filter(u => new Date(u.created_at) >= today && u.durum === 'completed')
      .reduce((sum, u) => sum + (u.kredi_maliyeti || 0), 0);

    const thisMonthSpending = userPayments
      .filter(p => new Date(p.created_at) >= firstDayOfMonth)
      .reduce((sum, p) => sum + (p.tutar_tl || 0), 0);

    const totalGenerations = userUsage.filter(u => u.durum === 'completed').length;
    const activeTasks = userUsage.filter(u => u.durum === 'started' || u.durum === 'processing').length;
    
    const lastUsedModel = userUsage.length > 0 ? (userUsage[0].detaylar?.modelId || userUsage[0].modul) : '-';

    // Chart Data - Last 7 Days Usage
    const last7DaysUsage = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayUsage = userUsage.filter(u => u.created_at.startsWith(dateStr) && u.durum === 'completed');
      const creditUsed = dayUsage.reduce((sum, u) => sum + (u.kredi_maliyeti || 0), 0);
      
      last7DaysUsage.push({
        date: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        fullDate: dateStr,
        credits: creditUsed
      });
    }

    // Chart Data - Tool Based Usage
    const toolUsageMap = new Map();
    userUsage.forEach(u => {
      if (u.durum === 'completed') {
        const current = toolUsageMap.get(u.modul) || 0;
        toolUsageMap.set(u.modul, current + (u.kredi_maliyeti || 0));
      }
    });
    
    const toolUsage = Array.from(toolUsageMap.entries()).map(([name, value]) => ({ name, value }));

    res.json({
      metrics: {
        remainingCredit: Math.max(0, user.toplam_kredi - (user.kullanilan_kredi || 0)),
        todayUsedCredit,
        thisMonthSpending,
        totalGenerations,
        activeTasks,
        lastUsedModel
      },
      recentActivity: userUsage.slice(0, 5),
      recentAssets: userAssets.slice(0, 4),
      charts: {
        last7DaysUsage,
        toolUsage
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Dashboard verileri alınamadı' });
  }
});

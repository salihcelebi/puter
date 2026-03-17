/*
█████████████████████████████████████████████
1) BU DOSYA, GİRİŞ YAPMIŞ KULLANICININ KENDİ HESABINA AİT VERİLERLE İLGİLİ ROUTE'LARI YÖNETİR.
2) userRouter, EXPRESS ROUTER ÜZERİNDEN TANIMLANIR VE DOSYANIN BAŞINDA requireAuth İLE KORUNUR.
3) YANİ BU DOSYADAKİ TÜM ENDPOINT'LER SADECE OTURUMLU KULLANICI TARAFINDAN ÇAĞRILABİLİR.
4) kv MODÜLÜ, KULLANICI KAYDI VE ASSET METADATA'SI GİBİ VERİLERİ OKUMAK İÇİN KULLANILIR.
5) fileSystem MODÜLÜ, KULLANICIYA AİT DOSYALARIN GEREKTİĞİNDE DISKTEN SİLİNMESİ VEYA YÖNETİLMESİ İÇİN KULLANILIR.
6) GET /profile ENDPOINT'I, KULLANICININ KENDİ PROFİL VERİSİNİ DÖNDÜRÜR.
7) PROFİL DÖNÜLÜRKEN sifre_hash ALANI AYIKLANIR; BÖYLECE HASSAS VERİ İSTEMCİYE GİTMEZ.
8) GET /assets ENDPOINT'I, TÜM ASSET'LER ARASINDAN YALNIZCA OTURUMLU KULLANICIYA AİT OLANLARI FİLTRELER.
9) ASSET LİSTESİ, created_at DEĞERİNE GÖRE YENİDEN ESKİYE SIRALANIR.
10) DELETE /assets/:id ENDPOINT'I, BELİRLİ BİR VARLIĞI KULLANICI TARAFINDAN SİLMEYİ AMAÇLAR.
11) BU AKIŞTA ÖNCE ASSET METADATA'SI BULUNUR, SONRA SAHİPLİK DOĞRULANIR.
12) GEREKİRSE DOSYANIN KENDİSİ fileSystem ÜZERİNDEN DISKTEN KALDIRILIR.
13) DAHA SONRA KV TARAFINDAKİ ASSET KAYDI DA TEMİZLENİR; YANİ METADATA VE DOSYA BERABER YÖNETİLİR.
14) BU DOSYA, “KENDİ HESABIM” VE “KENDİ ÜRETTİĞİM VARLIKLAR” MANTIĞININ ANA SUNUCU KATMANIDIR.
15) requireAuth KULLANIMI SAYESİNDE BAŞKA KULLANICININ PROFİL VE VARLIK VERİSİNE ERİŞİM ENGELLENİR.
16) ASSET FİLTRELEMEDE kullanici_id KONTROLÜ TEMEL SAHİPLİK KORUMASIDIR.
17) HATA OLURSA 404 VE 500 GİBİ STATÜLERLE AÇIK JSON RESPONSE DÖNÜLÜR.
18) DOSYA, FRONTEND'DEKİ PROFILE SAYFASI VE KULLANICI VARLIK LİSTESİ İÇİN TEMEL KAYNAKTIR.
19) BU YAPI, KULLANICIYA KENDİ VERİSİ ÜZERİNDE OKUMA VE TEMİZLEME YETKİSİ VERİR.
20) AYNI ZAMANDA DİĞER KULLANICILARIN VERİLERİNE SIÇRAMAYI ENGELLEYEN BİR GÜVENLİK SINIRI OLUŞTURUR.
21) DOSYA İÇİNDEKİ AYIKLAMA VE SAHİPLİK KONTROLÜ, GİZLİLİK AÇISINDAN ÇOK ÖNEMLİDİR.
22) ASSET YÖNETİMİ KV VE FS MODÜLLERİNİN BİRLİKTE ÇALIŞTIĞI NET BİR ÖRNEKTİR.
23) BU DOSYA BOZULURSA PROFİL, KULLANICI ASSET LİSTESİ VE KULLANICI SİLME AKIŞLARI ETKİLENİR.
24) KAPSAMI ADMIN DOSYASINDAN DAR OLSA DA SON KULLANICI DENEYİMİ AÇISINDAN DOĞRUDAN GÖRÜNEN KRİTİK BİR ALANDIR.
25) KISACA: BU DOSYA, OTURUMLU KULLANICININ KENDİ PROFİLİ VE KENDİ VARLIKLARI ÜZERİNDEKİ SUNUCU İŞLEMLERİNİ YÖNETİR.
█████████████████████████████████████████████
*/
import { Router } from 'express';
import { kv } from '../db/kv.js';
import { fileSystem } from '../db/fs.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get('/profile', async (req: AuthRequest, res) => {
  try {
    const user = await kv.get(`users:${req.user.id}`);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const { sifre_hash, ...safeUser } = user;
    res.json(safeUser);
  } catch {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

userRouter.get('/assets', async (req: AuthRequest, res) => {
  try {
    const allAssets = await kv.list('assets:');
    const userAssets = allAssets
      .map((item) => item.value)
      .filter((asset) => asset.kullanici_id === req.user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(userAssets);
  } catch {
    res.status(500).json({ error: 'Varlıklar alınamadı' });
  }
});

userRouter.delete('/assets/:id', async (req: AuthRequest, res) => {
  try {
    const assetId = req.params.id;
    const asset = await kv.get(`assets:${assetId}`);

    if (!asset || asset.kullanici_id !== req.user.id) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }

    // Part 3: delete persisted file while keeping historical job relation consistent.
    try {
      await fileSystem.delete(asset.fs_path);
    } catch {
      // file already removed is tolerated.
    }

    await kv.delete(`assets:${assetId}`);

    const jobs = await kv.list('aiJob:');
    for (const item of jobs) {
      if (item.value?.outputAssetId === assetId) {
        await kv.set(item.key, {
          ...item.value,
          outputUrl: null,
          outputAssetId: null,
          metadata: {
            ...(item.value.metadata || {}),
            deletedOutputAssetId: assetId,
          },
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Varlık silinemedi' });
  }
});

userRouter.get('/assets/:id/download', async (req: AuthRequest, res) => {
  try {
    const assetId = req.params.id;
    const asset = await kv.get(`assets:${assetId}`);

    if (!asset || asset.kullanici_id !== req.user.id) {
      return res.status(404).json({ error: 'Varlık bulunamadı' });
    }

    // Part 3: download now streams the real persisted file.
    const file = await fileSystem.read(asset.fs_path);
    res.setHeader('Content-Disposition', `attachment; filename="${asset.dosya_adi}"`);
    res.setHeader('Content-Type', asset.tur === 'video' ? 'video/mp4' : asset.tur === 'audio' ? 'audio/mpeg' : 'image/png');
    return res.send(file);
  } catch {
    res.status(500).json({ error: 'Varlık indirilemedi' });
  }
});

userRouter.get('/usage', async (req: AuthRequest, res) => {
  try {
    const allUsage = await kv.list('usage:');
    const userUsage = allUsage
      .map((item) => item.value)
      .filter((usage) => usage.kullanici_id === req.user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(userUsage);
  } catch {
    res.status(500).json({ error: 'Kullanım geçmişi alınamadı' });
  }
});

userRouter.get('/credits', async (req: AuthRequest, res) => {
  try {
    const allLedger = await kv.list('creditLedger:');
    const userLedger = allLedger
      .map((item) => item.value)
      .filter((entry) => String(entry.kullanici_id || entry.userId || '') === String(req.user.id))
      .map((entry) => ({
        ...entry,
        id: String(entry.id || ''),
        created_at: String(entry.created_at || entry.createdAt || new Date().toISOString()),
        miktar: Number(entry.miktar ?? entry.amount ?? 0),
        onceki_bakiye: Number(entry.onceki_bakiye ?? entry.beforeBalance ?? 0),
        sonraki_bakiye: Number(entry.sonraki_bakiye ?? entry.afterBalance ?? 0),
        aciklama: String(entry.aciklama || entry.reason || 'Kredi işlemi'),
        islem_tipi: String(entry.islem_tipi || 'adjustment'),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(userLedger);
  } catch {
    res.status(500).json({ error: 'Kredi geçmişi alınamadı' });
  }
});

userRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const userId = req.user.id;
    const user = await kv.get(`users:${userId}`);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const allUsage = await kv.list('usage:');
    const userUsage = allUsage
      .map((item) => item.value)
      .filter((usage) => usage.kullanici_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const allAssets = await kv.list('assets:');
    const userAssets = allAssets
      .map((item) => item.value)
      .filter((asset) => asset.kullanici_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const allPayments = await kv.list('payments:');
    const userPayments = allPayments
      .map((item) => item.value)
      .filter((payment) => payment.kullanici_id === userId && payment.durum === 'success');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayUsedCredit = userUsage
      .filter((u) => new Date(u.created_at) >= today && (u.durum === 'completed' || u.durum === 'success'))
      .reduce((sum, u) => sum + Number(u.kredi_maliyeti || 0), 0);

    const thisMonthSpending = userPayments
      .filter((p) => new Date(p.created_at) >= firstDayOfMonth)
      .reduce((sum, p) => sum + (p.tutar_tl || 0), 0);

    const totalGenerations = userUsage.filter((u) => u.durum === 'completed' || u.durum === 'success').length;
    const activeTasks = userUsage.filter((u) => u.durum === 'started' || u.durum === 'processing' || u.status === 'queued').length;
    const lastUsedModel = userUsage.length > 0 ? (userUsage[0].detaylar?.modelId || userUsage[0].modul) : '-';

    const last7DaysUsage = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayUsage = userUsage.filter((u) => u.created_at.startsWith(dateStr) && (u.durum === 'completed' || u.durum === 'success'));
      const creditUsed = dayUsage.reduce((sum, u) => sum + Number(u.kredi_maliyeti || 0), 0);

      last7DaysUsage.push({
        date: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        fullDate: dateStr,
        credits: creditUsed,
      });
    }

    const toolUsageMap = new Map<string, number>();
    userUsage.forEach((u) => {
      if (u.durum === 'completed' || u.durum === 'success') {
        const current = toolUsageMap.get(u.modul) || 0;
        toolUsageMap.set(u.modul, current + Number(u.kredi_maliyeti || 0));
      }
    });

    const toolUsage = Array.from(toolUsageMap.entries()).map(([name, value]) => ({ name, value }));

    res.json({
      metrics: {
        remainingCredit: Math.max(0, Number(user.toplam_kredi || 0) - Number(user.kullanilan_kredi || 0)),
        todayUsedCredit,
        thisMonthSpending,
        totalGenerations,
        activeTasks,
        lastUsedModel,
      },
      recentActivity: userUsage.slice(0, 5),
      recentAssets: userAssets.slice(0, 4),
      charts: {
        last7DaysUsage,
        toolUsage,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Dashboard verileri alınamadı' });
  }
});

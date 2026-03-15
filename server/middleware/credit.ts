/*
█████████████████████████████████████████████
1) BU DOSYA, KULLANICININ BELİRLİ BİR İŞLEM İÇİN YETERLİ KREDİSİ OLUP OLMADIĞINI KONTROL EDEN MIDDLEWARE DOSYASIDIR.
2) checkCredit FONKSİYONU, MALİYETİ PARAMETRE OLARAK ALIP BUNA GÖRE MIDDLEWARE ÜRETİR.
3) AuthRequest KULLANIMI, req.user.id DEĞERİNE GÜVENLİ ERİŞİM SAĞLAR.
4) KULLANICI OTURUMU YOKSA 401 UNAUTHORIZED DÖNÜLÜR.
5) kv MODÜLÜNDEN users:{id} ANAHTARI OKUNARAK KULLANICI KREDİ VERİSİ GETİRİLİR.
6) remaining DEĞERİ, toplam_kredi EKSİ kullanilan_kredi HESABIYLA BULUNUR.
7) KALAN KREDİ MALİYETTEN AZSA 402 INSUFFICIENT_CREDIT DÖNÜLÜR.
8) YETERLİ KREDİ VARSA next() ÇAĞRILARAK İŞLEMİN DEVAM ETMESİ SAĞLANIR.
9) BEKLENMEDİK HATA OLURSA 500 CREDIT_CHECK_FAILED DÖNÜLÜR.
10) KISACA: BU DOSYA, MALİYETLİ İŞLEMLERDEN ÖNCE SUNUCU TARAFINDA BAKİYE KAPI KONTROLÜ YAPAR.
█████████████████████████████████████████████
*/
import { Response, NextFunction } from 'express';
import { kv } from '../db/kv.js';
import { AuthRequest } from './auth.js';

export const checkCredit = (cost: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Yetkisiz', code: 'UNAUTHORIZED' });
      }
      const user = await kv.get(`users:${req.user.id}`);
      const remaining = Number(user?.toplam_kredi || 0) - Number(user?.kullanilan_kredi || 0);
      if (remaining < cost) {
        return res.status(402).json({ error: 'Yetersiz kredi', code: 'INSUFFICIENT_CREDIT' });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Kredi kontrolü başarısız', code: 'CREDIT_CHECK_FAILED' });
    }
  };
};

/*
█████████████████████████████████████████████
1) BU DOSYA, ŞU AN İÇİN ÇOK KÜÇÜK BİR API ROUTER SKELETON DOSYASIDIR.
2) express İTHAL EDİLEREK KÜÇÜK BİR ROUTER OLUŞTURULMUŞTUR.
3) const router = express.Router() SATIRI, DOSYANIN ASIL GÖREVİNİN ALT ROUTE TAŞIMAK OLDUĞUNU GÖSTERİR.
4) ŞU ANDA TANIMLI TEK ENDPOINT GET /health ROTASIDIR.
5) BU ENDPOINT, { status: 'ok' } JSON YANITI DÖNMEKTEDİR.
6) DOSYA ŞU HALİYLE TAM BİR API MODÜLÜ DEĞİL, GENİŞLETİLMEYE HAZIR TEMEL BİR KABUK GİBİDİR.
7) “API routes skeleton” YORUMU DA DOSYANIN BİLİNÇLİ OLARAK İSKELET HALDE BIRAKILDIĞINI GÖSTERİR.
8) KÜÇÜK OLMASINA RAĞMEN SAĞLIK KONTROLÜ İÇİN İŞE YARAR BİR TEST KAPISI SAĞLAR.
9) İLERİDE BAŞKA SUB-ROUTE'LAR VEYA FRONTEND MOCK API UÇLARI BURAYA EKLENEBİLİR.
10) KISACA: BU DOSYA, ŞU AN İÇİN SADECE /health YANITI VEREN MİNİMAL BİR EXPRESS API SKELETON'IDIR.
█████████████████████████████████████████████
*/

// API routes skeleton
import express from 'express';
const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

export default router;

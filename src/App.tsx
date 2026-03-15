// ===============================
// src/App.tsx
// Bu route güncellemesi, katalog başlangıcını ve sohbet alt yolunu ayırır.
// ===============================
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/*
█████████████████████████████████████████████
1) BU DOSYA, FRONTEND UYGULAMANIN ANA ROUTER VE SAYFA BAĞLAMA DOSYASIDIR.
2) BrowserRouter, Routes, Route VE Navigate KULLANILDIĞI İÇİN TÜM SAYFA GEÇİŞLERİ BURADAN TANIMLANIR.
3) AuthProvider, TÜM UYGULAMAYI KİMLİK DOĞRULAMA BAĞLAMIYLA SARMALAYARAK HER SAYFANIN KULLANICI BİLGİSİNE ERİŞMESİNİ SAĞLAR.
4) Toaster BİLEŞENİ, GLOBAL TOAST BİLDİRİMLERİ İÇİN KÖK DÜZEYDE EKLENMİŞTİR.
5) Layout BİLEŞENİ, ORTAK UYGULAMA KABUĞU OLARAK ANA İÇ ROUTE'LARI BARINDIRIR.
6) /giris, /kayit VE /sifremi-unuttum GİBİ PUBLIC AUTH SAYFALARI BURADA DOĞRUDAN TANIMLANMIŞTIR.
7) /dashboard ROTALI ANA PANO SAYFASI, GİRİŞ SONRASI MERKEZİ EKRAN OLARAK KULLANILIR.
8) /varliklar, /odeme-paketleri, /odeme-yap/:packageId, /hesap, /kullanim-gecmisi VE /kredi-gecmisi GİBİ HESAP ODAKLI EKRANLAR BURADA BAĞLANMIŞTIR.
9) /sohbet VE /sohbet/konus ROTALARI, CHAT İLE İLGİLİ İKİ AYRI SAYFAYI BARINDIRIR.
10) /gorsel, /video VE /tts ROTALARI, AI ÜRETİM SAYFALARINI DOĞRUDAN SUNAR.
11) /muzik ROUTE'U ProtectedRoute İLE KORUNDUĞU İÇİN SADECE OTURUMLU KULLANICIYA AÇIKTIR.
12) ADMIN ALANI İÇİN AYRI BİR ROUTE GRUBU TANIMLANMIŞTIR.
13) /admin, /admin/ozet, /admin/kullanicilar, /admin/modeller, /admin/fiyatlandirma, /admin/loglar VE /admin/odeme-yonetimi ROTALARI requireAdmin KORUMASIYLA ÇALIŞIR.
14) ProtectedRoute BİLEŞENİ, BU DOSYADA HEM NORMAL KULLANICI KORUMASI HEM DE ADMIN KORUMASI İÇİN YENİDEN KULLANILIR.
15) index ROUTE'U /dashboard'A YÖNLENDİRME YAPARAK UYGULAMANIN VARSAYILAN GİRİŞ AKIŞINI BELİRLER.
16) NAVIGATE KULLANIMI, BOŞ VEYA İKİNCİL YOLLARDA TEMİZ YÖNLENDİRME DAVRANIŞI SAĞLAR.
17) BU DOSYA, FRONTEND TARAFINDA “HANGİ URL HANGİ SAYFAYA GİDER?” SORUSUNUN TEK CEVABIDIR.
18) AUTH VE ADMIN GÜVENLİĞİ ROUTE KATMANINDA GÖRÜNÜR KILINDIĞI İÇİN MİMARİYİ ANLAMAYI KOLAYLAŞTIRIR.
19) AI, BILLING, PROFILE VE ADMIN SAYFALARININ AYNI ÇATI ALTINDA BAĞLANMASI BU DOSYAYI ÇOK MERKEZİ HALE GETİRİR.
20) BURADAKİ BİR YANLIŞ ROUTE TANIMI, SAYFANIN KENDİSİ SAĞLAM OLSA BİLE KULLANICIYI YANLIŞ EKRANA GÖTÜREBİLİR.
21) DOSYA, UYGULAMANIN URL HARİTASIYLA YETKİ HARİTASINI AYNI YERDE BİRLEŞTİRİR.
22) REACT UYGULAMASINDAKİ SAYFA SINIRLARINI VE KORUMA KAPILARINI EN NET GÖSTEREN DOSYA BURASIDIR.
23) AI SAYFALARININ AYRI AYRI ROUTE OLARAK YER ALMASI, ÜRÜNÜN ÇOK MODÜLLÜ YAPISINI YANSITIR.
24) ADMIN SAYFALARININ AYRI AYRI TANIMLANMASI, YÖNETİM PANELİNİN DE TEK SAYFA DEĞİL ÇOKLU ALT EKRAN OLDUĞUNU GÖSTERİR.
25) KISACA: BU DOSYA, FRONTEND'İN ANA NAVİGASYON, AUTH BAĞLAMI VE ROLE DAYALI SAYFA ERİŞİM MERKEZİDİR.
█████████████████████████████████████████████
*/



import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Billing from './pages/Billing';
import Checkout from './pages/Checkout';
import Account from './pages/Account';
import UsageHistory from './pages/UsageHistory';
import CreditHistory from './pages/CreditHistory';
import Chat from './pages/AI/Chat';
import Chat1 from './pages/AI/Chat1';
import Image from './pages/AI/image';
import VideoGen from './pages/AI/VideoGen';
import TTS from './pages/AI/TTS';
import Music from './pages/AI/Music';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminModels from './pages/Admin/AdminModels';
import AdminLogs from './pages/Admin/AdminLogs';
import AdminPayments from './pages/Admin/AdminPayments';
import AdminPricing from './pages/Admin/AdminPricing';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Router>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route path="/kayit" element={<Register />} />
          <Route path="/sifremi-unuttum" element={<ForgotPassword />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="varliklar" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
            <Route path="odeme-paketleri" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="odeme-yap/:packageId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="hesap" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="kullanim-gecmisi" element={<ProtectedRoute><UsageHistory /></ProtectedRoute>} />
            <Route path="kredi-gecmisi" element={<ProtectedRoute><CreditHistory /></ProtectedRoute>} />

            <Route path="sohbet" element={<Chat1 />} />
            <Route path="sohbet/konus" element={<Chat />} />
            <Route path="gorsel" element={<Image />} />
            <Route path="video" element={<VideoGen />} />
            <Route path="tts" element={<TTS />} />
            <Route path="muzik" element={<ProtectedRoute><Music /></ProtectedRoute>} />

            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Navigate to="/admin/ozet" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/ozet"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/kullanicilar"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/modeller"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminModels />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/fiyatlandirma"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPricing />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/loglar"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/odeme-yonetimi"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPayments />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

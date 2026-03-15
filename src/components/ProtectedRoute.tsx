/*
█████████████████████████████████████████████
1) BU DOSYA, KORUMALI SAYFALARA ERİŞİMİ DENETLEYEN ROUTE KAPISI BİLEŞENİDİR.
2) children VE requireAdmin PROP'LARINI ALIR.
3) useAuth() İLE user VE loading DURUMUNU OKUR.
4) useLocation() KULLANILDIĞI İÇİN GİRİŞE YÖNLENDİRMEDE GELİNEN SAYFA BİLGİSİ state.from İÇİNDE KORUNABİLİR.
5) loading TRUE İKEN TAM SAYFA ORTALANMIŞ BİR SPINNER GÖSTERİR.
6) KULLANICI YOKSA /giris SAYFASINA Navigate İLE YÖNLENDİRME YAPAR.
7) BU YÖNLENDİRMEDE replace KULLANILDIĞI İÇİN TARAYICI GEÇMİŞİ TEMİZ TUTULUR.
8) requireAdmin TRUE İSE VE user.rol ADMIN DEĞİLSE YİNE /giris SAYFASINA GÖNDERİR.
9) TÜM KONTROLLER GEÇERSE children DOĞRUDAN RENDER EDİLİR.
10) BU BİLEŞEN SAYESİNDE APP.tsx İÇİNDEKİ ROUTE TANIMLARI TEMİZ KALIR VE GÜVENLİK KURALI TEK YERDE TOPLANIR.
11) NORMAL KULLANICI KORUMASI İLE ADMIN KORUMASINI AYNI DOSYADA BİRLEŞTİRMESİ, KOD TEKRARINI AZALTIR.
12) KISACA: BU DOSYA, OTURUM YOKSA GİRİŞE, ADMIN YETKİSİ YOKSA YİNE GİRİŞE YÖNLENDİREN ANA FRONTEND ERİŞİM KAPISIDIR.
█████████████████████████████████████████████
*/

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/giris" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.rol !== 'admin') {
    return <Navigate to="/giris" replace />;
  }

  return <>{children}</>;
}

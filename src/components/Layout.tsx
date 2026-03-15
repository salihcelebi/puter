/*
█████████████████████████████████████████████
1) BU DOSYA, UYGULAMANIN ORTAK ANA KABUK VE YAN MENÜ LAYOUT BİLEŞENİDİR.
2) Outlet KULLANILDIĞI İÇİN İÇ SAYFALAR BU BİLEŞENİN ORTASINA YERLEŞTİRİLİR.
3) useAuth() İLE user VE logout FONKSİYONU ALINIR; YANİ LAYOUT KULLANICI BAĞLAMINI DOĞRUDAN KULLANIR.
4) useNavigate() İLE ÇIKIŞ SONRASI KULLANICI /giris SAYFASINA YÖNLENDİRİLİR.
5) isSidebarOpen STATE'I, MOBİL VE DAR EKRANLARDA MENÜNÜN AÇILIP KAPANMASINI YÖNETİR.
6) handleLogout() FONKSİYONU, logout SONRASI ROUTER YÖNLENDİRMESİNİ YAPAR.
7) closeSidebar() YARDIMCISI, MENÜ TIKLAMALARINDA YAN PANELİ KAPATMAK İÇİN KULLANILIR.
8) lucide-react İKONLARI KULLANILDIĞI İÇİN DASHBOARD, GÖRSEL, VIDEO, SOHBET, AYAR, KREDİ VE DİĞER MENÜLER İKONLU SUNULUR.
9) DOSYA, KULLANICI VE ADMIN MENÜLERİNİ TEK ÇATI ALTINDA TAŞIYAN ANA GEZİNME YAPISIDIR.
10) Outlet SAYESİNDE AYNI LAYOUT İÇİNDE ÇOK SAYIDA SAYFA ORTAK GÖRÜNÜMÜ PAYLAŞIR.
11) BU BİLEŞEN, APP ROUTER İLE SAYFA BİLEŞENLERİ ARASINDA GÖRSEL İSKELET GÖREVİ GÖRÜR.
12) KISACA: BU DOSYA, SOL MENÜ, ÇIKIŞ AKIŞI, MOBİL MENÜ KONTROLÜ VE İÇ SAYFA YERLEŞİMİNİ YÖNETEN ANA UYGULAMA LAYOUT'UDUR.
█████████████████████████████████████████████
*/


import { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Image as ImageIcon, Video, MessageSquare, Settings, CreditCard, Folder, Users, Shield, Activity, LogOut, Menu, X, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/giris');
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600">NISAI.SITE</h1>
          <button onClick={closeSidebar} className="lg:hidden text-zinc-500 hover:text-zinc-700">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-4">Ana Menü</div>
          <Link to="/dashboard" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>
          <Link to="/sohbet" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <MessageSquare size={18} />
            <span>Sohbet</span>
          </Link>
          <Link to="/gorsel" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <ImageIcon size={18} />
            <span>Görsel Üretim</span>
          </Link>
          <Link to="/video" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <Video size={18} />
            <span>Video Üretim</span>
          </Link>
          <Link to="/tts" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <MessageSquare size={18} />
            <span>Seslendirme (TTS)</span>
          </Link>

          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-6">Hesap & Varlıklar</div>
          <Link to="/varliklar" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <Folder size={18} />
            <span>Varlıklarım</span>
          </Link>
          <Link to="/odeme-paketleri" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <CreditCard size={18} />
            <span>Kredi Satın Al</span>
          </Link>
          <Link to="/hesap" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <Settings size={18} />
            <span>Hesabım</span>
          </Link>
          <Link to="/kullanim-gecmisi" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <Activity size={18} />
            <span>Kullanım Geçmişi</span>
          </Link>
          <Link to="/kredi-gecmisi" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
            <CreditCard size={18} />
            <span>Kredi Geçmişi</span>
          </Link>

          {user?.rol === 'admin' && (
            <>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-6">Yönetim (Admin)</div>
              <Link to="/admin/ozet" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
                <Activity size={18} />
                <span>Özet</span>
              </Link>
              <Link to="/admin/kullanicilar" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
                <Users size={18} />
                <span>Kullanıcılar</span>
              </Link>
              <Link to="/admin/odeme-yonetimi" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
                <CreditCard size={18} />
                <span>Ödemeler</span>
              </Link>
              <Link to="/admin/modeller" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
                <Shield size={18} />
                <span>Modeller</span>
              </Link>
              <Link to="/admin/fiyatlandirma" onClick={closeSidebar} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700">
                <DollarSign size={18} />
                <span>Fiyatlandırma</span>
              </Link>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase shrink-0">
              {user?.gorunen_ad?.charAt(0) || 'G'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.gorunen_ad || 'Misafir'}</div>
              <div className="text-xs text-zinc-500">{user ? `${user.toplam_kredi - (user.kullanilan_kredi || 0)} Kredi` : 'Giriş yaparak kredi kullanın'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <header className="bg-white border-b border-zinc-200 h-16 shrink-0 flex items-center px-4 md:px-8 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-medium hidden sm:block">NISAI Platform</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <span className="text-xs sm:text-sm font-medium bg-zinc-100 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                  <span className="hidden sm:inline">Bakiye: </span>{user.toplam_kredi - (user.kullanilan_kredi || 0)} <span className="hidden sm:inline">Kredi</span>
                </span>
                <button onClick={handleLogout} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 p-2 sm:p-0">
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Çıkış Yap</span>
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/giris')} className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-700 px-2 sm:px-3 py-1 rounded-full bg-indigo-50">
                Giriş Yap
              </button>
            )}
          </div>
        </header>
        <div className="p-4 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

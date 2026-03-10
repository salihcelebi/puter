import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { User, Shield, Key, Package, CreditCard, Activity, Mail, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Account() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      toast.error('Profil bilgileri alınamadı');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Hesap Ayarları</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Menü */}
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-black text-white rounded-xl font-medium">
            <User className="w-5 h-5" />
            Profil
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-50 rounded-xl font-medium transition-colors">
            <Shield className="w-5 h-5" />
            Güvenlik
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-50 rounded-xl font-medium transition-colors">
            <Package className="w-5 h-5" />
            Paket Bilgisi
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-50 rounded-xl font-medium transition-colors">
            <Activity className="w-5 h-5" />
            API & Kullanım
          </button>
        </div>

        {/* İçerik Alanı */}
        <div className="md:col-span-2 space-y-6">
          {/* Profil Kartı */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              Kişisel Bilgiler
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Görünen Ad</label>
                <input 
                  type="text" 
                  defaultValue={profile?.gorunen_ad || ''}
                  className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Kullanıcı Adı</label>
                <input 
                  type="text" 
                  defaultValue={profile?.kullanici_adi || ''}
                  disabled
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">E-posta</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <input 
                    type="email" 
                    defaultValue={profile?.email || ''}
                    disabled
                    className="w-full sm:flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 cursor-not-allowed"
                  />
                  {profile?.auth_provider === 'google' && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Google ile Bağlı
                    </span>
                  )}
                </div>
              </div>
              <div className="pt-4">
                <button className="px-6 py-2 bg-black text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors">
                  Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          </div>

          {/* Güvenlik Kartı */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-zinc-400" />
              Şifre Güncelleme
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Mevcut Şifre</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Yeni Şifre</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="pt-4">
                <button className="px-6 py-2 bg-black text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors">
                  Şifreyi Güncelle
                </button>
              </div>
            </div>
          </div>

          {/* Hesap Bilgileri */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-zinc-400" />
              Hesap Özeti
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-sm text-zinc-500 mb-1">Kayıt Tarihi</p>
                <p className="font-medium text-zinc-900">
                  {profile?.olusturma_tarihi ? format(new Date(profile.olusturma_tarihi), 'd MMM yyyy', { locale: tr }) : '-'}
                </p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-sm text-zinc-500 mb-1">Son Giriş</p>
                <p className="font-medium text-zinc-900">
                  {profile?.son_giris_tarihi ? format(new Date(profile.son_giris_tarihi), 'd MMM yyyy HH:mm', { locale: tr }) : '-'}
                </p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-sm text-zinc-500 mb-1">Kalan Kredi</p>
                <p className="font-medium text-zinc-900 text-xl">
                  {(profile?.toplam_kredi || 0) - (profile?.kullanilan_kredi || 0)}
                </p>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-sm text-zinc-500 mb-1">Rol</p>
                <p className="font-medium text-zinc-900 capitalize">
                  {profile?.rol || 'Kullanıcı'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

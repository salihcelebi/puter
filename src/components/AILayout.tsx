import React from 'react';
import { useAuth } from '../context/AuthContext';

interface AILayoutProps {
  title: string;
  breadcrumb: string;
  children: React.ReactNode;
  usageCount: number;
  settings: React.ReactNode;
  recentItems: React.ReactNode;
}

export default function AILayout({ title, breadcrumb, children, usageCount, settings, recentItems }: AILayoutProps) {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="text-xs md:text-sm text-zinc-500 mt-1">{breadcrumb}</p>
        </div>
        
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 md:p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4 md:gap-6 shrink-0">
        {/* Kullanım Özeti */}
        <div className="bg-[#1e293b] text-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h3 className="font-semibold text-sm">Kullanım Özeti</h3>
          </div>
          <div className="p-3 md:p-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Kullanım:</span>
              <span className="font-medium">{usageCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-slate-400">Kalan Kredi:</span>
              <span className="font-medium text-emerald-400">{user ? user.toplam_kredi - user.kullanilan_kredi : 0}</span>
            </div>
          </div>
        </div>

        {/* Ayarlar */}
        <div className="bg-[#1e293b] text-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h3 className="font-semibold text-sm">Ayarlar</h3>
          </div>
          <div className="p-3 md:p-4 text-sm text-slate-300 space-y-2">
            {settings}
          </div>
        </div>

        {/* Son İşlemler */}
        <div className="bg-[#1e293b] text-white rounded-xl shadow-sm overflow-hidden flex-1 min-h-[150px] md:min-h-[200px]">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h3 className="font-semibold text-sm">Son İşlemler</h3>
          </div>
          <div className="p-3 md:p-4 text-sm text-slate-400 flex items-center justify-center h-full min-h-[100px] md:min-h-[150px]">
            {recentItems || 'Henüz bir işlem yok'}
          </div>
        </div>
      </div>
    </div>
  );
}

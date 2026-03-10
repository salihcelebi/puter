import React from 'react';
import { Users, CreditCard, BarChart3, Settings, AlertTriangle, FileText } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Admin Paneli</h1>
          <p className="text-zinc-500">Sistem Durumu: Aktif</p>
        </div>
        <div className="flex items-center gap-4">
          <Settings className="text-zinc-400" />
          <button className="bg-zinc-900 text-white px-4 py-2 rounded-lg">Yönetim</button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { title: 'Toplam Kullanıcı', value: '1,204', icon: Users },
          { title: 'Günlük Ciro', value: '₺12,450', icon: CreditCard },
          { title: 'Günlük Kredi Tüketimi', value: '45,000', icon: BarChart3 },
          { title: 'Bekleyen Ödeme', value: '12', icon: AlertTriangle },
        ].map((stat) => (
          <div key={stat.title} className="p-6 bg-white rounded-xl border border-zinc-200 shadow-sm">
            <h3 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
              <stat.icon size={16} /> {stat.title}
            </h3>
            <p className="text-3xl font-bold mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-bold mb-4">Son Yönetim Aktiviteleri</h3>
        <ul className="space-y-4">
          <li className="flex items-center gap-4 p-4 bg-zinc-50 rounded-lg">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <p className="text-sm">Yeni kullanıcı kaydı: salihcelebi@gmail.com</p>
            <span className="ml-auto text-xs text-zinc-400">10 dk önce</span>
          </li>
          <li className="flex items-center gap-4 p-4 bg-zinc-50 rounded-lg">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <p className="text-sm">Başarısız ödeme: #PAY-9982</p>
            <span className="ml-auto text-xs text-zinc-400">1 saat önce</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

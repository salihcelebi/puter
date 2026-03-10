import React from 'react';
import { Search, Bell, User, Zap, MessageSquare, Image, Video, Mic, Music, CreditCard } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

const data = [
  { name: 'Pzt', kredi: 400 },
  { name: 'Sal', kredi: 300 },
  { name: 'Çar', kredi: 600 },
  { name: 'Per', kredi: 800 },
  { name: 'Cum', kredi: 500 },
  { name: 'Cmt', kredi: 700 },
  { name: 'Paz', kredi: 900 },
];

export default function UserDashboard() {
  return (
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 bg-zinc-50 min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-900 tracking-tight">Dashboard</h1>
          <p className="text-sm md:text-base text-zinc-600">Hoş geldin, Salih!</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Search className="text-zinc-400 cursor-pointer hover:text-zinc-600 shrink-0" />
          <Bell className="text-zinc-400 cursor-pointer hover:text-zinc-600 shrink-0" />
          <User className="text-zinc-400 cursor-pointer hover:text-zinc-600 shrink-0" />
          <button className="bg-emerald-600 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition shrink-0 whitespace-nowrap ml-auto md:ml-0">
            <Zap size={18} /> Hızlı İşlem
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {[
          { title: 'Kalan Kredi', value: '1,250' },
          { title: 'Bugün Kullanılan', value: '45' },
          { title: 'Bu Ay Harcama', value: '₺450.00' },
        ].map((stat) => (
          <div key={stat.title} className="p-4 md:p-6 bg-white rounded-2xl border border-zinc-100 shadow-md">
            <h3 className="text-xs md:text-sm font-medium text-zinc-500">{stat.title}</h3>
            <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2 text-zinc-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        {[
          { name: 'Sohbet', icon: MessageSquare, path: '/sohbet' },
          { name: 'Görsel Üret', icon: Image, path: '/gorsel' },
          { name: 'Video Üret', icon: Video, path: '/video' },
          { name: 'Foto/Video', icon: Video, path: '/fotograftan-video' },
          { name: 'Seslendirme', icon: Mic, path: '/tts' },
          { name: 'Müzik', icon: Music, path: '/muzik' },
          { name: 'Kredi Al', icon: CreditCard, path: '/odeme-paketleri' },
        ].map((action) => (
          <Link key={action.name} to={action.path} className="p-4 md:p-6 bg-white border border-zinc-100 rounded-2xl flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 hover:shadow-lg hover:border-emerald-200 transition cursor-pointer text-center md:text-left">
            <action.icon className="text-emerald-600 size-6 md:size-6 shrink-0" />
            <span className="font-semibold text-zinc-900 text-xs md:text-base">{action.name}</span>
          </Link>
        ))}
      </div>

      <div className="bg-white p-4 md:p-8 rounded-2xl border border-zinc-100 shadow-md h-64 md:h-80">
        <h3 className="text-base md:text-lg font-semibold mb-4 md:mb-6 text-zinc-900">Kredi Kullanımı (Son 7 Gün)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
            <YAxis stroke="#a1a1aa" fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="kredi" stroke="#059669" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ===============================
// src/components/AIStudioHeader.tsx
// Bu üst bileşen, katalog ve sohbet sayfalarına ortak ürün başlığını verir.
// ===============================
import { Link, NavLink } from 'react-router-dom';

type AIStudioHeaderProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

const NAV_ITEMS = [
  { label: 'Sohbet', to: '/sohbet' },
  { label: 'Görsel Üretim', to: '/gorsel' },
  { label: 'Video', to: '/video' },
  { label: 'Ses (TTS)', to: '/tts' },
];

function navClass(active: boolean) {
  return [
    'rounded-full border px-4 py-2 text-sm font-semibold transition',
    active
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
      : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.05] hover:text-white',
  ].join(' ');
}

export default function AIStudioHeader({ searchValue = '', onSearchChange }: AIStudioHeaderProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#060913] text-white shadow-[0_20px_80px_-40px_rgba(16,185,129,0.35)]">
      <div className="flex flex-col gap-4 border-b border-white/5 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex items-center gap-3">
          <Link to="/sohbet" className="font-black tracking-tight text-3xl md:text-4xl">
            NISAI
          </Link>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
            AI katalog
          </span>
        </div>

        {typeof onSearchChange === 'function' && (
          <div className="relative w-full max-w-xl">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Özellik, kullanım, avantaj veya model ara..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-emerald-400/40 focus:bg-white/[0.06]"
            />
          </div>
        )}

        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 md:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Sistem çevrimiçi
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-5 py-4 md:px-7">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

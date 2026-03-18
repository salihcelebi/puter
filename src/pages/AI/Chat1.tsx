import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_CHATALL_BASE_URL = 'https://chatall.puter.work';
const CHAT_MODEL_SESSION_KEY = 'nisai:selected-chat-model';

type ChatProviderProfile = {
  provider: string;
  allowedOptions: string[];
  blockedOptions: string[];
  requiredOptions: string[];
  multimodal: boolean;
  tools: boolean;
  stream: boolean;
  web_search: boolean;
  not?: string;
};

type ChatModelPrice = {
  durum: string;
  veri: {
    currency: string | null;
    input: number | null;
    output: number | null;
    tokens: number | null;
  } | null;
};

export type ChatRegistryModel = {
  displayName: string;
  provider: string;
  model: string;
  modelKimligi: string;
  aliases?: string[];
  modalities?: string[];
  tool_call?: boolean | null;
  context?: number | null;
  max_tokens?: number | null;
  knowledge?: unknown;
  price?: ChatModelPrice;
  not?: string;
  profil: ChatProviderProfile;
};

type SortKey = 'provider_asc' | 'name_asc' | 'context_desc' | 'output_desc';
type FilterMode = 'all' | 'tools' | 'web' | 'reasoning';

function getChatallBaseUrl() {
  if (typeof window === 'undefined') return DEFAULT_CHATALL_BASE_URL;

  const fromWindow = (window as typeof window & { __CHATALL_BASE_URL__?: string }).__CHATALL_BASE_URL__;
  if (typeof fromWindow === 'string' && fromWindow.trim()) return fromWindow.trim().replace(/\/$/, '');

  const fromStorage = window.localStorage.getItem('nisai:chatall-base-url');
  if (typeof fromStorage === 'string' && fromStorage.trim()) return fromStorage.trim().replace(/\/$/, '');

  return DEFAULT_CHATALL_BASE_URL;
}

function buildWorkerUrl(path: string) {
  return `${getChatallBaseUrl()}${path}`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error('Worker boş yanıt döndü.');

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Worker JSON dönmedi. İlk içerik: ${raw.slice(0, 180)}`);
  }

  let parsed: T;
  try {
    parsed = JSON.parse(raw) as T;
  } catch {
    throw new Error('Worker geçerli JSON döndürmedi.');
  }

  if (!response.ok) throw new Error('Worker isteği başarısız oldu.');
  return parsed;
}

async function fetchChatModelRegistry(): Promise<ChatRegistryModel[]> {
  const response = await fetch(buildWorkerUrl('/api/chat/model-kaynagi/model-registrysi'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      puterBaglami: 'me',
    }),
  });

  return readJsonResponse<ChatRegistryModel[]>(response);
}

function isReasoningModel(model: ChatRegistryModel) {
  const bag = [
    model.displayName,
    model.model,
    model.modelKimligi,
    model.not,
    model.profil?.not,
    ...(model.aliases || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr');

  return ['reason', 'reasoning', 'deep', 'research', 'o3', 'o4'].some((item) => bag.includes(item));
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatPrice(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`;
}

function sortModels(items: ChatRegistryModel[], sort: SortKey) {
  const cloned = [...items];

  switch (sort) {
    case 'name_asc':
      return cloned.sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'));
    case 'context_desc':
      return cloned.sort((a, b) => (b.context ?? 0) - (a.context ?? 0));
    case 'output_desc':
      return cloned.sort((a, b) => (b.max_tokens ?? 0) - (a.max_tokens ?? 0));
    case 'provider_asc':
    default:
      return cloned.sort((a, b) => {
        const left = `${a.provider} ${a.displayName}`;
        const right = `${b.provider} ${b.displayName}`;
        return left.localeCompare(right, 'tr');
      });
  }
}

export default function Chat1() {
  const navigate = useNavigate();
  const [models, setModels] = useState<ChatRegistryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortKey>('provider_asc');

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError('');
        const next = await fetchChatModelRegistry();
        if (!mounted) return;
        setModels(next);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Model listesi yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredModels = useMemo(() => {
    let next = [...models];

    if (filterMode === 'tools') next = next.filter((item) => item.profil?.tools === true);
    if (filterMode === 'web') next = next.filter((item) => item.profil?.web_search === true);
    if (filterMode === 'reasoning') next = next.filter(isReasoningModel);

    const q = search.trim().toLocaleLowerCase('tr');
    if (q) {
      next = next.filter((item) => {
        const bag = [
          item.displayName,
          item.provider,
          item.model,
          item.modelKimligi,
          item.not,
          item.profil?.not,
          ...(item.aliases || []),
          ...(item.modalities || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr');

        return bag.includes(q);
      });
    }

    return sortModels(next, sort);
  }, [filterMode, models, search, sort]);

  const openChat = (model: ChatRegistryModel) => {
    sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(model));
    navigate(`/sohbet/konus?model=${encodeURIComponent(model.modelKimligi)}`, {
      state: { selectedModel: model },
    });
  };

  return (
    <div className="min-h-screen bg-[#0b1020] px-4 py-6 text-white md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                CHATALL MODEL KATALOĞU
              </div>
              <h1 className="text-3xl font-black tracking-tight">Sohbet modelleri</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/70 md:text-base">
                Bu sayfa artık dış model worker yerine doğrudan <code className="rounded bg-black/30 px-1.5 py-0.5">chatall.js</code>
                {' '}içindeki model registry rotasını kullanır.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px] lg:max-w-[460px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Model, provider, alias veya özellik ara"
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cyan-400/50"
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="provider_asc">Sağlayıcıya göre</option>
                <option value="name_asc">Ada göre</option>
                <option value="context_desc">Context büyükten küçüğe</option>
                <option value="output_desc">Çıktı limiti büyükten küçüğe</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'tools', label: 'Tools açık' },
              { key: 'web', label: 'Web search açık' },
              { key: 'reasoning', label: 'Reasoning odaklı' },
            ].map((item) => {
              const active = filterMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilterMode(item.key as FilterMode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-cyan-400 text-slate-950'
                      : 'border border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-white/65">
          <span>{loading ? 'Yükleniyor…' : `${filteredModels.length} / ${models.length} model`}</span>
          <span>{error ? 'Kaynakta hata var' : getChatallBaseUrl()}</span>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        {!error && !loading && filteredModels.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/65">
            Aramana uyan model bulunamadı.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading &&
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-4 h-7 w-3/4 rounded bg-white/10" />
                <div className="mt-4 h-20 rounded bg-white/10" />
                <div className="mt-4 h-10 rounded bg-white/10" />
              </div>
            ))}

          {!loading &&
            filteredModels.map((model) => {
              const price = model.price?.veri;
              return (
                <button
                  key={model.modelKimligi}
                  type="button"
                  onClick={() => openChat(model)}
                  className="group rounded-3xl border border-white/10 bg-gradient-to-br from-[#101a34] to-[#0d1324] p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/80">{model.provider}</div>
                      <h2 className="mt-2 text-xl font-black leading-tight text-white">{model.displayName}</h2>
                      <p className="mt-2 break-all text-xs text-white/40">{model.modelKimligi}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                      {model.profil?.web_search ? 'WEB' : model.profil?.tools ? 'TOOLS' : 'CHAT'}
                    </span>
                  </div>

                  <p className="mt-4 min-h-[48px] text-sm text-white/72">
                    {model.not || model.profil?.not || 'Bu model için ek not bulunmuyor.'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/45">Context</div>
                      <div className="mt-1 font-semibold">{formatNumber(model.context)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/45">Max output</div>
                      <div className="mt-1 font-semibold">{formatNumber(model.max_tokens)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/45">Input fiyatı</div>
                      <div className="mt-1 font-semibold">{formatPrice(price?.input)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="text-white/45">Output fiyatı</div>
                      <div className="mt-1 font-semibold">{formatPrice(price?.output)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-3 py-1 ${model.profil?.tools ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/8 text-white/55'}`}>
                      Tools: {model.profil?.tools ? 'Açık' : 'Kapalı'}
                    </span>
                    <span className={`rounded-full px-3 py-1 ${model.profil?.stream ? 'bg-violet-400/15 text-violet-200' : 'bg-white/8 text-white/55'}`}>
                      Stream: {model.profil?.stream ? 'Açık' : 'Kapalı'}
                    </span>
                    <span className={`rounded-full px-3 py-1 ${model.profil?.web_search ? 'bg-cyan-400/15 text-cyan-200' : 'bg-white/8 text-white/55'}`}>
                      Web search: {model.profil?.web_search ? 'Açık' : 'Kapalı'}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm font-semibold text-cyan-200 transition group-hover:text-cyan-100">
                    <span>Bu modelle sohbete başla</span>
                    <span>→</span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

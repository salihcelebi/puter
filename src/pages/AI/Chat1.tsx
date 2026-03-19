import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MODEL_WORKER_BASE_URL = 'https://models.puter.work';
const CHAT_MODEL_SESSION_KEY = 'nisai:selected-chat-model';

type SortKey =
  | 'company_asc'
  | 'name_asc'
  | 'input_price_asc'
  | 'speed_desc'
  | 'speed_asc'
  | 'params_desc';

type WorkerEnvelope<T> = {
  ok: boolean;
  code?: string;
  data?: T;
  error?: {
    message?: string;
  } | null;
  meta?: Record<string, unknown> | null;
};

type ModelCatalogItem = {
  id: string;
  company: string;
  provider: string;
  modelName: string;
  modelId: string;
  categoryRaw: string;
  badges: string[];
  parameters: string;
  speedLabel: string;
  speedScore: number;
  prices: {
    input: number | null;
    output: number | null;
    image: number | null;
  };
  traits: string[];
  standoutFeature: string;
  useCase: string;
  rivalAdvantage: string;
  sourceUrl: string;
  style: {
    brandKey: string;
    accent: string;
  };
};

type ModelCatalogPayload = {
  items: ModelCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  facets: {
    companies: string[];
    badges: string[];
    categories: string[];
  };
  source: {
    type: string;
    totalModels: number;
    sourceUrl: string;
  };
  filters: {
    search: string;
    company: string;
    badge: string;
    category: string;
    sort: SortKey;
    modelId: string;
  };
};

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2"></circle>
      <path d="M16 16l4.2 4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function FilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function parseParameterScore(parameters: string) {
  if (!parameters) return 0;
  const normalized = parameters.replace(/,/g, '.').toUpperCase();
  const match = normalized.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return 0;

  if (normalized.includes('T')) return numeric * 1_000_000;
  if (normalized.includes('B')) return numeric * 1_000;
  if (normalized.includes('M')) return numeric;
  return numeric;
}

function containsAny(value: string, list: string[]) {
  const lower = value.toLocaleLowerCase('tr');
  return list.some((item) => lower.includes(item));
}

function modelBag(model: ModelCatalogItem) {
  return [
    model.provider,
    model.company,
    model.modelName,
    model.modelId,
    model.categoryRaw,
    model.parameters,
    model.speedLabel,
    model.standoutFeature,
    model.useCase,
    model.rivalAdvantage,
    ...model.badges,
    ...model.traits,
  ]
    .join(' ')
    .toLocaleLowerCase('tr');
}

function isReasoningModel(model: ModelCatalogItem) {
  return containsAny(modelBag(model), ['reasoning', 'muhakeme', 'analiz', 'strateji', 'deep', 'derin']);
}

function isWebModel(model: ModelCatalogItem) {
  return containsAny(modelBag(model), ['arama', 'search', 'web', 'araştırma', 'güncel', 'internet']);
}

function extractTags(model: ModelCatalogItem) {
  const tags: string[] = [];

  for (const item of model.traits) {
    const clean = String(item || '').trim();
    if (clean && !tags.includes(clean)) tags.push(clean);
    if (tags.length === 3) break;
  }

  if (tags.length < 3) {
    for (const item of model.badges) {
      const clean = String(item || '').trim();
      if (clean && !tags.includes(clean)) tags.push(clean);
      if (tags.length === 3) break;
    }
  }

  return tags.slice(0, 3);
}

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: value < 10 ? 2 : 0, maximumFractionDigits: 2 })}¢`;
}

function normalizeBaseUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function parseResponse(response: Response) {
  const text = await response.text();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  if (/<!doctype|<html/i.test(text)) {
    throw new Error('Worker JSON yerine HTML döndürdü. URL veya route hatalı olabilir.');
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Beklenen içerik tipi JSON değil: ${contentType || 'bilinmiyor'}`);
  }

  try {
    return JSON.parse(text) as WorkerEnvelope<ModelCatalogPayload>;
  } catch {
    throw new Error('Worker geçerli JSON döndürmedi.');
  }
}

async function requestCatalogFrom(baseUrl: string) {
  const endpoints = ['/models', '/'];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const url = new URL(`${normalizeBaseUrl(baseUrl)}${endpoint}`);
      url.searchParams.set('badge', 'CHAT');
      url.searchParams.set('limit', '250');
      url.searchParams.set('sort', 'company_asc');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const json = await parseResponse(response);
      if (!response.ok || !json?.ok || !json?.data?.items) {
        throw new Error(json?.error?.message || `Model kataloğu alınamadı (${response.status}).`);
      }

      return json.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Bilinmeyen katalog hatası');
    }
  }

  throw lastError || new Error('Model worker ulaşılamıyor.');
}

function sortItems(items: ModelCatalogItem[], sort: SortKey) {
  const cloned = [...items];

  switch (sort) {
    case 'input_price_asc':
      return cloned.sort((a, b) => (a.prices.input ?? Number.MAX_SAFE_INTEGER) - (b.prices.input ?? Number.MAX_SAFE_INTEGER));
    case 'speed_desc':
      return cloned.sort((a, b) => b.speedScore - a.speedScore);
    case 'speed_asc':
      return cloned.sort((a, b) => a.speedScore - b.speedScore);
    case 'name_asc':
      return cloned.sort((a, b) => a.modelName.localeCompare(b.modelName, 'tr'));
    case 'params_desc':
      return cloned.sort((a, b) => parseParameterScore(b.parameters) - parseParameterScore(a.parameters));
    case 'company_asc':
    default:
      return cloned.sort((a, b) => `${a.provider} ${a.modelName}`.localeCompare(`${b.provider} ${b.modelName}`, 'tr'));
  }
}

async function fetchModels(): Promise<ModelCatalogPayload> {
  return requestCatalogFrom(MODEL_WORKER_BASE_URL);
}

export default function Chat1() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [catalog, setCatalog] = useState<ModelCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>('company_asc');
  const [filterMode, setFilterMode] = useState<'all' | 'reasoning' | 'web'>('all');

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await fetchModels();
        if (!mounted) return;
        setCatalog(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Model kataloğu yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const visibleModels = useMemo(() => {
    const base = catalog?.items ?? [];
    let next = [...base];

    if (filterMode === 'reasoning') {
      next = next.filter(isReasoningModel);
    }

    if (filterMode === 'web') {
      next = next.filter(isWebModel);
    }

    next = sortItems(next, sort);

    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return next;

    return next.filter((model) => modelBag(model).includes(q));
  }, [catalog, filterMode, search, sort]);

  const totalCount = visibleModels.length;

  const openChat = (model: ModelCatalogItem) => {
    sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(model));
    navigate(`/sohbet/konus?model=${encodeURIComponent(model.modelId)}`, {
      state: { selectedModel: model },
    });
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #eef2f7;
          --card: #ffffff;
          --text: #1f2a44;
          --muted: #73809b;
          --line: #dfe6f1;
          --blue: #4f8fe6;
          --blue-soft: #eef5ff;
          --pill: #f2f5fa;
          --shadow: 0 12px 30px rgba(24, 39, 75, 0.08);
        }

        * { box-sizing: border-box; }

        .chat1-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #f7f9fc 0%, var(--bg) 100%);
          padding: 24px;
          color: var(--text);
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .shell {
          max-width: 1320px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(220, 228, 239, 0.9);
          border-radius: 28px;
          backdrop-filter: blur(12px);
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .topbar {
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid var(--line);
        }

        .brand {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .status {
          padding: 10px 14px;
          border-radius: 999px;
          background: #ebf6ee;
          color: #2f7a50;
          font-size: 13px;
          font-weight: 700;
        }

        .toolbar {
          padding: 20px 24px 12px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
        }

        .searchbox {
          height: 50px;
          border: 1px solid var(--line);
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          background: #fff;
          color: #8ea0bf;
        }

        .searchbox input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text);
          font-size: 15px;
        }

        .button-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ghost-btn,
        .primary-btn,
        .menu-btn,
        .chat-btn {
          border: none;
          cursor: pointer;
          transition: 0.16s ease;
        }

        .ghost-btn,
        .menu-btn {
          height: 44px;
          padding: 0 16px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid var(--line);
          color: var(--text);
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .primary-btn {
          height: 44px;
          padding: 0 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, #62a1f1 0%, #4f8fe6 100%);
          color: #fff;
          font-weight: 800;
        }

        .filters {
          padding: 0 24px 18px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          position: relative;
        }

        .chip {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--text);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .chip.active {
          background: var(--blue-soft);
          border-color: #bdd4fa;
          color: #2459a8;
        }

        .menu-wrap { position: relative; }

        .dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 280px;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 18px;
          box-shadow: var(--shadow);
          padding: 10px;
          z-index: 20;
        }

        .dropdown button {
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          padding: 12px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          cursor: pointer;
        }

        .dropdown button:hover { background: #f5f8fc; }

        .content {
          padding: 0 24px 24px;
        }

        .count {
          color: var(--muted);
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 16px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .card {
          background: var(--card);
          border: 1px solid #e8edf5;
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 6px 16px rgba(29, 46, 80, 0.05);
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 220px;
        }

        .provider {
          color: var(--muted);
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 800;
        }

        .title {
          font-size: 21px;
          line-height: 1.2;
          font-weight: 800;
          margin: 0;
        }

        .meta {
          display: grid;
          gap: 8px;
          color: #4f5d79;
          font-size: 13px;
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--pill);
          color: #5d6983;
          font-size: 12px;
          font-weight: 700;
        }

        .tag.primary {
          background: #4f8fe6;
          color: #fff;
        }

        .card-footer {
          margin-top: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .model-id {
          color: var(--muted);
          font-size: 12px;
          word-break: break-word;
        }

        .chat-btn {
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: #111;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .state {
          min-height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: rgba(255,255,255,0.55);
          border: 1px dashed var(--line);
          border-radius: 22px;
          color: var(--muted);
          padding: 24px;
        }

        @media (max-width: 1100px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 760px) {
          .chat1-page { padding: 12px; }
          .topbar, .toolbar, .filters, .content { padding-left: 16px; padding-right: 16px; }
          .toolbar { grid-template-columns: 1fr; }
          .grid { grid-template-columns: 1fr; }
          .button-row { width: 100%; }
          .menu-wrap { width: 100%; }
          .menu-btn { width: 100%; justify-content: center; }
          .dropdown { width: 100%; }
        }
      `}</style>

      <div className="chat1-page">
        <div className="shell">
          <header className="topbar">
            <div className="brand">NISAI CHAT MODELLERİ</div>
            <div className="status">models.puter.work bağlı</div>
          </header>

          <section className="toolbar">
            <label className="searchbox" aria-label="Model ara">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="text"
                placeholder="Model adı, sağlayıcı, kullanım alanı veya avantaj ara..."
              />
            </label>

            <div className="button-row">
              <button className="primary-btn" type="button" onClick={() => { setFilterMode('all'); setSort('company_asc'); setSearch(''); }}>
                Sıfırla
              </button>

              <div className="menu-wrap" ref={dropdownRef}>
                <button className="menu-btn" type="button" onClick={() => setMenuOpen((prev) => !prev)}>
                  <FilterIcon />
                  Gelişmiş sıralama
                  <ChevronDownIcon />
                </button>

                {menuOpen && (
                  <div className="dropdown">
                    <button type="button" onClick={() => { setSort('company_asc'); setMenuOpen(false); }}>Sağlayıcıya göre</button>
                    <button type="button" onClick={() => { setSort('name_asc'); setMenuOpen(false); }}>Ada göre</button>
                    <button type="button" onClick={() => { setSort('input_price_asc'); setMenuOpen(false); }}>En düşük giriş maliyeti</button>
                    <button type="button" onClick={() => { setSort('speed_desc'); setMenuOpen(false); }}>En hızlı</button>
                    <button type="button" onClick={() => { setSort('speed_asc'); setMenuOpen(false); }}>En yavaş</button>
                    <button type="button" onClick={() => { setSort('params_desc'); setMenuOpen(false); }}>En büyük parametre</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="filters">
            <button className={`chip ${filterMode === 'all' ? 'active' : ''}`} type="button" onClick={() => setFilterMode('all')}>
              Tümü
            </button>
            <button className={`chip ${filterMode === 'reasoning' ? 'active' : ''}`} type="button" onClick={() => setFilterMode('reasoning')}>
              Reasoning
            </button>
            <button className={`chip ${filterMode === 'web' ? 'active' : ''}`} type="button" onClick={() => setFilterMode('web')}>
              Web / Güncel
            </button>
            <button className={`chip ${sort === 'input_price_asc' ? 'active' : ''}`} type="button" onClick={() => setSort('input_price_asc')}>
              En ucuz giriş
            </button>
            <button className={`chip ${sort === 'speed_desc' ? 'active' : ''}`} type="button" onClick={() => setSort('speed_desc')}>
              En hızlı
            </button>
          </section>

          <section className="content">
            <p className="count">Gösterilen model: {totalCount}</p>

            {loading ? (
              <div className="state">Model kataloğu yükleniyor...</div>
            ) : error ? (
              <div className="state">{error}</div>
            ) : visibleModels.length === 0 ? (
              <div className="state">Aramana uyan model bulunamadı.</div>
            ) : (
              <div className="grid">
                {visibleModels.map((model) => {
                  const tags = extractTags(model);
                  return (
                    <article className="card" key={model.id}>
                      <div className="provider">{model.provider || model.company}</div>
                      <h3 className="title">{model.modelName}</h3>

                      <div className="meta">
                        <div><strong>Kategori:</strong> {model.categoryRaw || '—'}</div>
                        <div><strong>Hız:</strong> {model.speedLabel || '—'}</div>
                        <div><strong>Input:</strong> {formatMoney(model.prices.input)} · <strong>Output:</strong> {formatMoney(model.prices.output)}</div>
                        <div><strong>Kullanım:</strong> {model.useCase || '—'}</div>
                      </div>

                      <div className="tag-row">
                        <span className="tag primary">{model.parameters || 'Parametre yok'}</span>
                        {tags.map((tag) => (
                          <span className="tag" key={`${model.id}_${tag}`}>{tag}</span>
                        ))}
                      </div>

                      <div className="card-footer">
                        <div className="model-id">{model.modelId}</div>
                        <button className="chat-btn" type="button" onClick={() => openChat(model)}>
                          Sohbeti Aç
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

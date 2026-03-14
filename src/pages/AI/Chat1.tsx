import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MODEL_WORKER_URL = 'https://models-worker.puter.work/models';
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
  code: string;
  data: T;
  error?: {
    message?: string;
  } | null;
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="#97A2BA" strokeWidth="2"></circle>
      <path d="M16 16l4.2 4.2" stroke="#97A2BA" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function FilterCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.22)"></circle>
      <path d="M8.8 12.1l2.1 2.2 4.3-4.8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

function GridLightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" fill="#cdd5e6"></rect>
      <rect x="13" y="4" width="7" height="7" rx="1.5" fill="#dfe5f1"></rect>
      <rect x="4" y="13" width="7" height="7" rx="1.5" fill="#dfe5f1"></rect>
      <rect x="13" y="13" width="7" height="7" rx="1.5" fill="#cdd5e6"></rect>
    </svg>
  );
}

function GridDarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#aeb8ce"></rect>
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#d5dced"></rect>
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#d5dced"></rect>
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#aeb8ce"></rect>
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="5" cy="12" r="2.2" fill="white"></circle>
      <circle cx="12" cy="12" r="2.2" fill="white"></circle>
      <circle cx="19" cy="12" r="2.2" fill="white"></circle>
    </svg>
  );
}

function ChevronDownWhite() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

function ReasoningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#c1c9db" strokeWidth="2"></circle>
      <path d="M12 7.4v5.1l3.1 1.8" stroke="#9eabc4" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function WebIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="#c1c9db" strokeWidth="2"></circle>
      <path d="M3.5 12h17" stroke="#c1c9db" strokeWidth="2"></path>
      <path d="M12 3.7c2.3 2.3 3.5 5.2 3.5 8.3s-1.2 6-3.5 8.3c-2.3-2.3-3.5-5.2-3.5-8.3s1.2-6 3.5-8.3z" stroke="#9eabc4" strokeWidth="2"></path>
    </svg>
  );
}

function FastSlowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="#c1c9db" strokeWidth="2"></circle>
      <path d="M12 8v4l3 2" stroke="#9eabc4" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function SlowFastIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="#c1c9db" strokeWidth="2"></circle>
      <path d="M12 16v-4L9 10" stroke="#9eabc4" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v16M8 8c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4 1.8-4 4 1.8 4 4 4 4-1.8 4-4" stroke="#a4afc6" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function ProviderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7" r="3.5" stroke="#c1c9db" strokeWidth="2"></circle>
      <path d="M5 19c1.6-2.8 4-4.2 7-4.2s5.4 1.4 7 4.2" stroke="#9eabc4" strokeWidth="2" strokeLinecap="round"></path>
    </svg>
  );
}

function NameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 17L10.5 5h1.3L17 17M7.2 12.2h7.5" stroke="#a4afc6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

function ParamsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="#a4afc6" strokeWidth="2" strokeLinecap="round"></path>
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

function isReasoningModel(model: ModelCatalogItem) {
  const bag = [
    model.categoryRaw,
    model.standoutFeature,
    model.useCase,
    model.rivalAdvantage,
    ...model.badges,
    ...model.traits,
  ].join(' ');
  return containsAny(bag, ['reasoning', 'muhakeme', 'analiz', 'strateji', 'deep', 'derin']);
}

function isWebModel(model: ModelCatalogItem) {
  const bag = [
    model.categoryRaw,
    model.standoutFeature,
    model.useCase,
    model.rivalAdvantage,
    ...model.badges,
    ...model.traits,
  ].join(' ');
  return containsAny(bag, ['arama', 'search', 'web', 'araştırma', 'güncel', 'internet']);
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
      return cloned.sort((a, b) => a.provider.localeCompare(b.provider, 'tr'));
  }
}

async function fetchModels(): Promise<ModelCatalogPayload> {
  const url = new URL(MODEL_WORKER_URL);
  url.searchParams.set('badge', 'CHAT');
  url.searchParams.set('limit', '250');
  url.searchParams.set('sort', 'company_asc');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const json = (await response.json()) as WorkerEnvelope<ModelCatalogPayload>;

  if (!response.ok || !json?.ok) {
    throw new Error(json?.error?.message || 'Model kataloğu yüklenemedi.');
  }

  return json.data;
}

export default function Chat1() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [catalog, setCatalog] = useState<ModelCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(true);
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
      next = next.sort((a, b) => Number(isReasoningModel(b)) - Number(isReasoningModel(a))).filter(isReasoningModel);
    }

    if (filterMode === 'web') {
      next = next.filter(isWebModel);
    }

    next = sortItems(next, sort);

    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return next;

    return next.filter((model) => {
      const bag = [
        model.provider,
        model.company,
        model.modelName,
        model.modelId,
        ...extractTags(model),
      ]
        .join(' ')
        .toLocaleLowerCase('tr');

      return bag.includes(q);
    });
  }, [catalog, filterMode, search, sort]);

  const totalCount = catalog?.total ?? 0;

  const openChat = (model: ModelCatalogItem) => {
    sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(model));
    navigate(`/sohbet/konus?model=${encodeURIComponent(model.modelId)}`, {
      state: { selectedModel: model },
    });
  };

  const setPriceFilter = () => {
    setFilterMode('all');
    setSort('input_price_asc');
  };

  const setSpeedFilter = () => {
    setFilterMode('all');
    setSort('speed_desc');
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #eef0f5;
          --shell: #f6f7fb;
          --card: #ffffff;
          --line: #e4e8f0;
          --line-2: #dfe4ee;
          --text: #2a3553;
          --muted: #8e98af;
          --blue: #5a97ea;
          --blue-2: #7fb1f2;
          --blue-soft: #edf4ff;
          --pill: #eef2f8;
          --green-bg: #e8f4ee;
          --green: #3f8e72;
          --shadow: 0 6px 18px rgba(33, 52, 88, 0.04);
          --radius-xl: 22px;
          --radius-lg: 18px;
          --radius-md: 14px;
          --radius-sm: 12px;
        }

        * { box-sizing: border-box; }

        .chat1-page {
          margin: 0;
          min-height: 100vh;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: linear-gradient(180deg, #f0f1f5 0%, #eceef3 100%);
          color: var(--text);
          padding: 52px 28px;
        }

        .app {
          max-width: 1190px;
          margin: 0 auto;
          background: var(--shell);
          border: 1px solid #e5e9f1;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .topbar {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 22px;
          background: rgba(255,255,255,0.5);
          border-bottom: 1px solid var(--line);
        }

        .brand {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: 0.3px;
          color: #2b3552;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: 10px;
          flex: 1;
          justify-content: center;
        }

        .nav a {
          text-decoration: none;
          color: #46506b;
          font-size: 16px;
          font-weight: 600;
          padding: 12px 16px;
          border-radius: 999px;
        }

        .nav a.active {
          color: #314b85;
          background: #edf3ff;
          box-shadow: inset 0 0 0 1px #dce7fb;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          padding: 12px 18px;
          font-weight: 700;
          color: var(--green);
          background: var(--green-bg);
          font-size: 14px;
          white-space: nowrap;
        }

        .status::before {
          content: "";
          width: 11px;
          height: 11px;
          border-radius: 999px;
          background: #2e9b84;
          box-shadow: 0 0 0 3px rgba(46, 155, 132, 0.12);
        }

        .search-row,
        .filter-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 22px;
          border-bottom: 1px solid var(--line);
          background: rgba(255,255,255,0.28);
        }

        .filter-button {
          flex: 0 0 202px;
          height: 44px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(180deg, #62a1f1 0%, #4f8fe6 100%);
          color: white;
          font-size: 17px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          box-shadow: 0 8px 18px rgba(85, 145, 233, 0.2);
          cursor: pointer;
        }

        .filter-button svg,
        .menu-button svg,
        .search-box svg,
        .quick-item svg,
        .dropdown-item svg {
          flex: 0 0 auto;
        }

        .search-box {
          flex: 1;
          height: 46px;
          border: 1px solid var(--line-2);
          border-radius: 999px;
          background: #f8f9fc;
          display: flex;
          align-items: center;
          padding: 0 18px 0 20px;
          gap: 14px;
        }

        .search-box input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 16px;
          color: var(--text);
        }

        .search-box input::placeholder {
          color: #a0a8bb;
          font-weight: 500;
        }

        .filter-surface {
          position: relative;
          width: 100%;
          min-height: 58px;
          border: 1px solid var(--line-2);
          border-radius: 17px;
          background: rgba(255,255,255,0.52);
          display: flex;
          align-items: center;
          padding: 8px 12px;
          gap: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }

        .quick-item,
        .menu-button {
          height: 40px;
          border: none;
          background: transparent;
          color: #4c5877;
          font-size: 17px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          border-radius: 12px;
          cursor: pointer;
        }

        .quick-divider {
          width: 1px;
          height: 28px;
          background: var(--line-2);
          margin: 0 6px;
        }

        .menu-button {
          margin-left: auto;
          background: linear-gradient(180deg, #62a1f1 0%, #4f8fe6 100%);
          color: white;
          padding: 0 18px;
          border-radius: 999px;
          box-shadow: 0 8px 18px rgba(85, 145, 233, 0.18);
        }

        .dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 18px;
          width: 290px;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: 0 18px 44px rgba(35, 52, 84, 0.14);
          padding: 10px 0;
          display: none;
          z-index: 20;
        }

        .dropdown.open { display: block; }

        .dropdown-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 16px;
          background: transparent;
          border: none;
          text-align: left;
          color: #4c5877;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }

        .dropdown-item:hover {
          background: #f6f8fc;
        }

        .dropdown-divider {
          height: 1px;
          background: var(--line);
          margin: 8px 16px;
        }

        .content {
          padding: 18px 22px 28px;
        }

        .count {
          color: #8c95ab;
          font-size: 16px;
          font-weight: 600;
          margin: 8px 0 18px 8px;
          letter-spacing: 0.2px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .model-card {
          position: relative;
          background: var(--card);
          border: 1px solid #e8ebf2;
          border-radius: 20px;
          min-height: 162px;
          padding: 20px 18px 18px 18px;
          box-shadow: 0 6px 14px rgba(43, 61, 99, 0.03);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .model-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(43, 61, 99, 0.08);
          border-color: #dbe3f0;
        }

        .provider {
          color: #8c96b0;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .model-name {
          font-size: 21px;
          line-height: 1.2;
          font-weight: 500;
          color: #283452;
          margin: 0 0 18px;
          letter-spacing: -0.02em;
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          row-gap: 8px;
          width: calc(100% - 112px);
          max-width: calc(100% - 112px);
        }

        .chat-link {
          position: absolute;
          right: 18px;
          bottom: 18px;
          z-index: 3;
          min-width: 92px;
          height: 32px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #ffffff;
          text-decoration: none;
          text-transform: uppercase;
          background: #111111;
          border-radius: 999px;
          white-space: nowrap;
          border: none;
          cursor: pointer;
        }

        .chat-link:hover {
          color: #ffffff;
          background: #000000;
        }

        .tag {
          height: 30px;
          padding: 0 14px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          color: #818ba3;
          background: #eff2f7;
          white-space: nowrap;
        }

        .tag.primary {
          background: linear-gradient(180deg, #8ab6f3 0%, #73a5ef 100%);
          color: white;
        }

        .state-card {
          min-height: 162px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          line-height: 1.6;
          color: #6d7892;
          font-size: 15px;
        }

        .hidden { display: none !important; }

        @media (max-width: 1100px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .nav { gap: 4px; }
          .nav a { padding: 10px 12px; font-size: 15px; }
        }

        @media (max-width: 820px) {
          .chat1-page { padding: 20px 12px; }
          .topbar,
          .search-row,
          .filter-row,
          .content { padding-left: 14px; padding-right: 14px; }
          .topbar {
            height: auto;
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
            padding-top: 16px;
            padding-bottom: 16px;
          }
          .nav {
            width: 100%;
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          .search-row { flex-direction: column; align-items: stretch; }
          .filter-button { flex: none; width: 100%; }
          .filter-row { padding-top: 14px; padding-bottom: 14px; }
          .filter-surface {
            overflow-x: auto;
            overflow-y: visible;
          }
          .grid { grid-template-columns: 1fr; }
          .dropdown {
            right: 8px;
            width: min(290px, calc(100vw - 56px));
          }
        }
      `}</style>

      <div className="chat1-page">
        <div className="app">
          <header className="topbar">
            <div className="brand">NISAI</div>

            <nav className="nav" aria-label="Ana menü">
              <a href="#" className="active">Sohbet</a>
              <a href="#">Görsel Üretim</a>
              <a href="#">Video</a>
              <a href="#">Ses (TTS)</a>
            </nav>

            <div className="status">Sistem çevrimiçi</div>
          </header>

          <section className="search-row">
            <button className="filter-button" type="button" onClick={() => {
              setFilterMode('all');
              setSort('company_asc');
              setSearch('');
            }}>
              <FilterCheckIcon />
              Hızlı Filtreler
              <ArrowRightIcon />
            </button>

            <label className="search-box" aria-label="Model ara">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="text"
                placeholder="Özellik, kullanım, avantaj veya model ara..."
              />
              <SearchIcon />
            </label>
          </section>

          <section className="filter-row">
            <div ref={dropdownRef} className="filter-surface">
              <button className="quick-item" type="button" onClick={setPriceFilter}>
                <GridLightIcon />
                Fiyata Göre Filtrele
              </button>

              <div className="quick-divider"></div>

              <button className="quick-item" type="button" onClick={setSpeedFilter}>
                <GridDarkIcon />
                Hıza Göre Filtrele
              </button>

              <div className="quick-divider"></div>

              <button
                className="menu-button"
                type="button"
                aria-expanded={menuOpen}
                aria-controls="advancedDropdown"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <DotsIcon />
                Gelişmiş Filtreler
                <ChevronDownWhite />
              </button>

              <div id="advancedDropdown" className={`dropdown ${menuOpen ? 'open' : ''}`} role="menu">
                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('reasoning');
                  setMenuOpen(false);
                }}>
                  <ReasoningIcon />
                  Muhakeme Gücüne Göre
                </button>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('web');
                  setMenuOpen(false);
                }}>
                  <WebIcon />
                  İnternette Arama Yeteneğine Göre
                </button>

                <div className="dropdown-divider"></div>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('all');
                  setSort('speed_desc');
                  setMenuOpen(false);
                }}>
                  <FastSlowIcon />
                  Hızlıdan Yavaşa
                </button>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('all');
                  setSort('speed_asc');
                  setMenuOpen(false);
                }}>
                  <SlowFastIcon />
                  Yavaştan Hızlıya
                </button>

                <div className="dropdown-divider"></div>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('all');
                  setSort('input_price_asc');
                  setMenuOpen(false);
                }}>
                  <PriceIcon />
                  Fiyata Göre
                </button>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('all');
                  setSort('company_asc');
                  setMenuOpen(false);
                }}>
                  <ProviderIcon />
                  Sağlayıcı Firmaya Göre
                </button>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('all');
                  setSort('name_asc');
                  setMenuOpen(false);
                }}>
                  <NameIcon />
                  Ada Göre
                </button>

                <div className="dropdown-divider"></div>

                <button className="dropdown-item" type="button" onClick={() => {
                  setFilterMode('all');
                  setSort('params_desc');
                  setMenuOpen(false);
                }}>
                  <ParamsIcon />
                  Parametre Sayısına Göre
                </button>
              </div>
            </div>
          </section>

          <main className="content">
            <div className="count">
              {loading
                ? 'Yükleniyor...'
                : error
                ? '0 / 0 model'
                : `${visibleModels.length} / ${totalCount} model`}
            </div>

            <section className="grid">
              {loading &&
                Array.from({ length: 9 }).map((_, index) => (
                  <article key={index} className="model-card" aria-hidden="true">
                    <div className="provider">YÜKLENİYOR</div>
                    <h3 className="model-name">Model yükleniyor...</h3>
                    <div className="tag-row">
                      <span className="tag primary">Yükleniyor</span>
                      <span className="tag">Yükleniyor</span>
                      <span className="tag">Yükleniyor</span>
                    </div>
                  </article>
                ))}

              {!loading && error && (
                <article className="model-card state-card">
                  {error}
                </article>
              )}

              {!loading && !error && visibleModels.length === 0 && (
                <article className="model-card state-card">
                  Aramana uygun model bulunamadı.
                </article>
              )}

              {!loading && !error && visibleModels.map((model) => {
                const tags = extractTags(model);

                return (
                  <article key={model.modelId} className="model-card" data-provider={model.provider} data-name={model.modelName}>
                    <div className="provider">{(model.provider || model.company).toUpperCase()}</div>
                    <h3 className="model-name">{model.modelName}</h3>

                    <div className="tag-row">
                      {tags.map((tag, index) => (
                        <span key={`${model.modelId}-${tag}-${index}`} className={`tag ${index === 0 ? 'primary' : ''}`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <button type="button" className="chat-link" onClick={() => openChat(model)}>
                      SOHBET ET
                    </button>
                  </article>
                );
              })}
            </section>
          </main>
        </div>
      </div>
    </>
  );
}

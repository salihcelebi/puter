// ===============================
// src/pages/AI/Chat1.tsx
// Bu ekran, açılışta yalnızca chat modellerini worker üzerinden gösterir.
// ===============================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIStudioHeader from '../../components/AIStudioHeader';
import {
  fetchModelCatalog,
  formatCredits,
  formatUsd,
  ModelCatalogItem,
  ModelCatalogPayload,
  priceToCredits,
} from '../../lib/aiWorkers';

const CHAT_MODEL_SESSION_KEY = 'nisai:selected-chat-model';

type SectionTab = 'ozet' | 'filtreleme' | 'kredi' | 'kullanim' | 'fark';
type AudienceFilter = 'all' | 'agency' | 'student' | 'enterprise';
type FeatureFilter = 'all' | 'multimodal' | 'reasoning' | 'search' | 'speed';

const SECTION_TABS: Array<{ key: SectionTab; label: string }> = [
  { key: 'ozet', label: 'Model Özeti' },
  { key: 'filtreleme', label: 'Filtreleme' },
  { key: 'kredi', label: 'Kredi Mantığı' },
  { key: 'kullanim', label: 'Kullanım Alanları' },
  { key: 'fark', label: 'Farklar' },
];

function containsAny(haystack: string, needles: string[]) {
  const normalized = haystack.toLocaleLowerCase('tr');
  return needles.some((needle) => normalized.includes(needle));
}

function filterByAudience(item: ModelCatalogItem, audience: AudienceFilter) {
  if (audience === 'all') return true;

  const source = `${item.useCase} ${item.rivalAdvantage} ${item.standoutFeature}`.toLocaleLowerCase('tr');

  if (audience === 'agency') {
    return containsAny(source, ['ajans', 'medya', 'içerik', 'reklam', 'kampanya', 'müşteri']);
  }

  if (audience === 'student') {
    return containsAny(source, ['öğrenci', 'eğitim', 'akademik', 'özet', 'öğren', 'araştırma']);
  }

  return containsAny(source, ['kurumsal', 'enterprise', 'şirket', 'aws', 'compliance', 'ekip']);
}

function filterByFeature(item: ModelCatalogItem, feature: FeatureFilter) {
  if (feature === 'all') return true;

  const source = `${item.categoryRaw} ${item.badges.join(' ')} ${item.traits.join(' ')} ${item.useCase}`.toLocaleLowerCase('tr');

  if (feature === 'multimodal') return containsAny(source, ['multimodal', 'görsel', 'vision']);
  if (feature === 'reasoning') return containsAny(source, ['reasoning', 'muhakeme', 'analiz', 'düşünce']);
  if (feature === 'search') return containsAny(source, ['search', 'arama', 'araştırma', 'deep research']);
  return item.speedScore >= 78;
}

function sortCatalog(items: ModelCatalogItem[], sort: string) {
  const cloned = [...items];

  switch (sort) {
    case 'input_price_asc':
      return cloned.sort((a, b) => (a.prices.input ?? Number.MAX_SAFE_INTEGER) - (b.prices.input ?? Number.MAX_SAFE_INTEGER));
    case 'input_price_desc':
      return cloned.sort((a, b) => (b.prices.input ?? -1) - (a.prices.input ?? -1));
    case 'speed_desc':
      return cloned.sort((a, b) => b.speedScore - a.speedScore);
    case 'name_asc':
      return cloned.sort((a, b) => a.modelName.localeCompare(b.modelName, 'tr'));
    default:
      return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
  }
}

function findCheapestModel(items: ModelCatalogItem[]) {
  return [...items]
    .filter((item) => item.prices.input !== null)
    .sort((a, b) => (a.prices.input ?? Number.MAX_SAFE_INTEGER) - (b.prices.input ?? Number.MAX_SAFE_INTEGER))[0] ?? null;
}

function findFastestModel(items: ModelCatalogItem[]) {
  return [...items].sort((a, b) => b.speedScore - a.speedScore)[0] ?? null;
}

function buildInsightCopy(activeTab: SectionTab, activeModel: ModelCatalogItem | null, total: number) {
  if (!activeModel) {
    return {
      title: 'Chat katalogu hazırlanıyor',
      body: 'Sadece sohbet odaklı worker modelleri yüklenir; boş, hata ve filtre durumları görünür tutulur.',
    };
  }

  if (activeTab === 'filtreleme') {
    return {
      title: 'Tekli filtre mantığı',
      body: `Bu ekran worker’dan yalnızca CHAT rozetli kayıtları alır. Ardından arama, sektör ve hız katmanı katalog üstünde uygulanır. Toplam görünür sonuç: ${total}.`,
    };
  }

  if (activeTab === 'kredi') {
    return {
      title: 'Kredi mantığı',
      body: `${activeModel.modelName} için girdi maliyeti ${formatCredits(activeModel.prices.input)} ve ${formatUsd(activeModel.prices.input)} seviyesinde gösterilir. Çıktı maliyeti de aynı kartta ayrı görünür.`,
    };
  }

  if (activeTab === 'kullanim') {
    return {
      title: 'Kullanım alanı',
      body: activeModel.useCase || 'Bu model için kullanım özeti worker verisinden gelir.',
    };
  }

  return {
    title: `${activeModel.company} • ${activeModel.modelName}`,
    body: activeModel.rivalAdvantage || activeModel.standoutFeature || 'Karşılaştırma özeti hazır.',
  };
}

export default function Chat1() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<ModelCatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('ALL');
  const [feature, setFeature] = useState<FeatureFilter>('all');
  const [audience, setAudience] = useState<AudienceFilter>('all');
  const [sort, setSort] = useState('speed_desc');
  const [sectionTab, setSectionTab] = useState<SectionTab>('ozet');
  const [previewModelId, setPreviewModelId] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetchModelCatalog({
          badge: 'CHAT',
          limit: 250,
          sort: 'company_asc',
        });

        if (!mounted) return;

        setCatalog(data);
        setPreviewModelId(data.items[0]?.modelId ?? '');
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Model kataloğu yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredModels = useMemo(() => {
    if (!catalog) return [];

    const base = catalog.items.filter((item) => {
      const matchesSearch =
        !search ||
        [item.company, item.provider, item.modelName, item.modelId, item.useCase, item.rivalAdvantage, item.standoutFeature, ...item.traits]
          .join(' ')
          .toLocaleLowerCase('tr')
          .includes(search.toLocaleLowerCase('tr'));

      const matchesCompany = company === 'ALL' ? true : item.company === company;

      return matchesSearch && matchesCompany && filterByAudience(item, audience) && filterByFeature(item, feature);
    });

    return sortCatalog(base, sort);
  }, [catalog, search, company, audience, feature, sort]);

  const previewModel =
    filteredModels.find((item) => item.modelId === previewModelId) ??
    filteredModels[0] ??
    null;

  const stats = useMemo(() => {
    const cheapest = findCheapestModel(filteredModels);
    const fastest = findFastestModel(filteredModels);

    return {
      total: filteredModels.length,
      cheapest,
      fastest,
    };
  }, [filteredModels]);

  const insight = buildInsightCopy(sectionTab, previewModel, filteredModels.length);

  const openChat = (model: ModelCatalogItem) => {
    sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(model));
    navigate(`/sohbet/konus?model=${encodeURIComponent(model.modelId)}`, {
      state: { selectedModel: model },
    });
  };

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
      <AIStudioHeader searchValue={search} onSearchChange={setSearch} />

      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#05070f] text-white">
        <div className="flex flex-wrap gap-2 border-b border-white/5 px-5 py-4 md:px-7">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSectionTab(tab.key)}
              className={[
                'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                sectionTab === tab.key
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 border-b border-white/5 px-5 py-5 md:grid-cols-[1.15fr_0.85fr] md:px-7">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                Tekli filtre
              </span>
              <button className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Çoklu filtre
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Hizmet sınıfı</div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                    Tümü
                  </button>
                  <button className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white">
                    Chat
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Özellik</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'Tümü' },
                    { key: 'multimodal', label: 'Görsel' },
                    { key: 'reasoning', label: 'Muhakeme' },
                    { key: 'search', label: 'Arama' },
                    { key: 'speed', label: 'Hıza göre' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setFeature(item.key as FeatureFilter)}
                      className={[
                        'rounded-full border px-4 py-2 text-sm font-semibold transition',
                        feature === item.key
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                          : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white',
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Sektör</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'Tümü' },
                    { key: 'agency', label: 'Ajanslar için' },
                    { key: 'student', label: 'Öğrenciler için' },
                    { key: 'enterprise', label: 'Kurumsal' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setAudience(item.key as AudienceFilter)}
                      className={[
                        'rounded-full border px-4 py-2 text-sm font-semibold transition',
                        audience === item.key
                          ? 'border-lime-400/30 bg-lime-400/10 text-lime-300'
                          : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white',
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Fiyat</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'speed_desc', label: 'Hızlıdan yavaşa' },
                    { key: 'input_price_asc', label: 'Kredi artan' },
                    { key: 'input_price_desc', label: 'Kredi azalan' },
                    { key: 'name_asc', label: 'Ada göre' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setSort(item.key)}
                      className={[
                        'rounded-full border px-4 py-2 text-sm font-semibold transition',
                        sort === item.key
                          ? 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300'
                          : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white',
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                {filteredModels.length} / {catalog?.total ?? 0} model
              </span>
              {company !== 'ALL' && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-300">
                  Şirket: {company}
                </span>
              )}
              {feature !== 'all' && (
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-300">
                  Özellik: {feature}
                </span>
              )}
              {audience !== 'all' && (
                <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-lime-300">
                  Sektör: {audience}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#0a0f1d] p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Anlık bakış</div>
            <h2 className="text-2xl font-black tracking-tight">{insight.title}</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{insight.body}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Görünen model</div>
                <div className="mt-2 text-2xl font-black">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">En hızlı</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {stats.fastest ? stats.fastest.modelName : '-'}
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  {stats.fastest ? stats.fastest.speedLabel : 'Yok'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">En düşük giriş</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {stats.cheapest ? stats.cheapest.modelName : '-'}
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  {stats.cheapest ? formatCredits(stats.cheapest.prices.input) : 'Yok'}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Şirket</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCompany('ALL')}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                    company === 'ALL'
                      ? 'border-white/20 bg-white/[0.08] text-white'
                      : 'border-white/10 bg-white/[0.03] text-zinc-300',
                  ].join(' ')}
                >
                  Tümü
                </button>
                {(catalog?.facets.companies ?? []).slice(0, 12).map((companyName) => (
                  <button
                    key={companyName}
                    onClick={() => setCompany(companyName)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                      company === companyName
                        ? 'border-white/20 bg-white/[0.08] text-white'
                        : 'border-white/10 bg-white/[0.03] text-zinc-300',
                    ].join(' ')}
                  >
                    {companyName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 md:px-7">
          {loading && (
            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[340px] animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[24px] border border-red-400/20 bg-red-400/10 p-6 text-red-200">
              <div className="text-lg font-bold">Model kataloğu yüklenemedi</div>
              <p className="mt-2 text-sm leading-7">{error}</p>
            </div>
          )}

          {!loading && !error && filteredModels.length === 0 && (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-center">
              <div className="text-xl font-bold text-white">Eşleşen sohbet modeli bulunamadı</div>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Arama veya filtreleri sadeleştir. Katalog yalnızca CHAT rozetli worker kayıtlarını gösterir.
              </p>
            </div>
          )}

          {!loading && !error && filteredModels.length > 0 && (
            <div className="grid gap-5 xl:grid-cols-3">
              {filteredModels.map((model) => {
                const inputCredits = priceToCredits(model.prices.input);
                const outputCredits = priceToCredits(model.prices.output);
                const isPreview = previewModel?.modelId === model.modelId;

                return (
                  <button
                    key={model.modelId}
                    type="button"
                    onClick={() => openChat(model)}
                    onMouseEnter={() => setPreviewModelId(model.modelId)}
                    className={[
                      'group text-left overflow-hidden rounded-[26px] border p-5 transition-all',
                      isPreview
                        ? 'border-white/20 bg-white/[0.06] shadow-[0_24px_80px_-36px_rgba(255,255,255,0.25)]'
                        : 'border-white/10 bg-[#0a0f1d] hover:border-white/20 hover:bg-white/[0.04]',
                    ].join(' ')}
                    style={{
                      boxShadow: isPreview ? `0 24px 80px -40px ${model.style.accent}55` : undefined,
                    }}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: model.style.accent }}>
                          {model.company}
                        </div>
                        <div className="mt-2 text-2xl font-black tracking-tight text-white">{model.modelName}</div>
                        <div className="mt-2 text-xs text-zinc-500">{model.modelId}</div>
                      </div>

                      <div className="rounded-xl border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ borderColor: `${model.style.accent}55`, color: model.style.accent }}>
                        {model.categoryRaw.replace('LLM / ', '')}
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      {model.badges.slice(0, 3).map((badge) => (
                        <span
                          key={badge}
                          className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
                          style={{ borderColor: `${model.style.accent}40`, color: model.style.accent }}
                        >
                          {badge}
                        </span>
                      ))}
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                        {model.speedLabel}
                      </span>
                    </div>

                    <div className="space-y-3 border-y border-white/5 py-4 text-sm text-zinc-300">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: model.style.accent }} />
                        <span>{model.standoutFeature}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                        <span>{model.useCase}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                        <span>{model.rivalAdvantage}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Giriş</div>
                        <div className="mt-2 text-xl font-black text-white">{inputCredits !== null ? `${inputCredits} kr` : '-'}</div>
                        <div className="mt-1 text-xs text-zinc-400">{formatUsd(model.prices.input)} / 1M token</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Çıkış</div>
                        <div className="mt-2 text-xl font-black text-white">{outputCredits !== null ? `${outputCredits} kr` : '-'}</div>
                        <div className="mt-1 text-xs text-zinc-400">{formatUsd(model.prices.output)} / 1M token</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {model.traits.slice(0, 3).map((trait) => (
                        <span key={trait} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
                          {trait}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <div className="text-xs text-zinc-500">Parametre: {model.parameters}</div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 transition group-hover:bg-emerald-400/15">
                        Sohbete geç
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

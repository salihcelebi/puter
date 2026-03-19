import { useEffect, useMemo, useState } from 'react';

type RouteConfig = {
  id: string;
  route: string;
  page: string;
  worker: string;
  filterGroup: string;
  checklistGroup: string;
  enabled: boolean;
};

type WorkerConfig = {
  id: string;
  name: string;
  endpoint: string;
  status: 'active' | 'passive';
};

type FilterConfig = {
  id: string;
  name: string;
  options: string[];
};

type ChecklistGroup = {
  id: string;
  name: string;
  items: Array<{ id: string; label: string; done: boolean }>;
};

type LoadState = {
  routes: RouteConfig[];
  workers: WorkerConfig[];
  filters: FilterConfig[];
  checklists: ChecklistGroup[];
  pageTargets: string[];
};

const emptyState: LoadState = {
  routes: [],
  workers: [],
  filters: [],
  checklists: [],
  pageTargets: [],
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${url} yüklenemedi (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export default function SayfaYonetimi() {
  const [data, setData] = useState<LoadState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    const readConfig = async () => {
      try {
        setLoading(true);
        setError('');

        const [routes, workers, filters, checklists, pageManagement] = await Promise.all([
          fetchJson<RouteConfig[]>('/config/rotalar.json'),
          fetchJson<WorkerConfig[]>('/config/workers.json'),
          fetchJson<FilterConfig[]>('/config/sayfa-filtreleri.json'),
          fetchJson<ChecklistGroup[]>('/config/checklist.json'),
          fetchJson<{ pageTargets: string[] }>('/config/sayfa-yonetimi.json'),
        ]);

        setData({
          routes,
          workers,
          filters,
          checklists,
          pageTargets: pageManagement.pageTargets,
        });
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Bilinmeyen hata';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void readConfig();
  }, []);

  const visibleRoutes = useMemo(() => {
    if (selectedFilter === 'all') {
      return data.routes;
    }

    return data.routes.filter((item) => item.filterGroup === selectedFilter);
  }, [data.routes, selectedFilter]);

  const toggleChecklistItem = (groupId: string, itemId: string) => {
    setData((prev) => ({
      ...prev,
      checklists: prev.checklists.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        return {
          ...group,
          items: group.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
        };
      }),
    }));
  };

  const getWorkerStatus = (workerId: string) => {
    const worker = data.workers.find((item) => item.id === workerId);
    return worker?.status ?? 'passive';
  };

  return (
    <section className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Sayfa Yönetimi</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Route, worker, filtre ve checklist tanımları tek merkezden izlenir.
        </p>
      </header>

      {loading && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Yapı dosyaları yükleniyor...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-zinc-900">Hedef TSX Sayfaları</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.pageTargets.map((target) => (
                <span key={target} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  {target}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-zinc-900">Route ve Worker Eşleşmeleri</h2>
              <select
                value={selectedFilter}
                onChange={(event) => setSelectedFilter(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="all">Tüm filtreler</option>
                {data.filters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="py-2 pr-4 font-medium">Route</th>
                    <th className="py-2 pr-4 font-medium">TSX</th>
                    <th className="py-2 pr-4 font-medium">Worker</th>
                    <th className="py-2 pr-4 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRoutes.map((item) => {
                    const workerState = getWorkerStatus(item.worker);

                    return (
                      <tr key={item.id} className="border-b border-zinc-100">
                        <td className="py-3 pr-4 text-zinc-800">{item.route}</td>
                        <td className="py-3 pr-4 text-zinc-700">{item.page}</td>
                        <td className="py-3 pr-4 text-zinc-700">{item.worker}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              item.enabled && workerState === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {item.enabled && workerState === 'active' ? 'aktif' : 'pasif'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-zinc-900">Checklist</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {data.checklists.map((group) => (
                <div key={group.id} className="rounded-lg border border-zinc-200 p-4">
                  <h3 className="text-sm font-semibold text-zinc-800">{group.name}</h3>
                  <ul className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => toggleChecklistItem(group.id, item.id)}
                          />
                          <span>{item.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

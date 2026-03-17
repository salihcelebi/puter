import { useState, useEffect } from 'react';
import { Save, RefreshCw, Search, CheckCircle, XCircle, Edit2, TrendingUp, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface ModelRecord {
  id: string;
  provider_name: string;
  model_name: string;
  service_type: string;
  billing_unit: string;
  is_active: boolean;
  
  raw_cost_input_usd: number | null;
  raw_cost_output_usd: number | null;
  raw_cost_single_usd: number | null;
  
  usd_try_rate: number;
  
  raw_cost_input_try: number | null;
  raw_cost_output_try: number | null;
  raw_cost_single_try: number | null;
  
  profit_multiplier: number;
  
  sale_cost_input_usd: number | null;
  sale_cost_output_usd: number | null;
  sale_cost_single_usd: number | null;
  
  sale_cost_input_try: number | null;
  sale_cost_output_try: number | null;
  sale_cost_single_try: number | null;
  
  sale_credit_input: number | null;
  sale_credit_output: number | null;
  sale_credit_single: number | null;
  
  metadata_json: any;
  last_rate_sync_at: string;
  last_price_sync_at: string;
  created_at: string;
  updated_at: string;
}

const flexibleMatch = (query: string, text: string) => {
  if (!query) return true;
  if (!text) return false;
  
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const textLower = text.toLowerCase();
  
  return queryWords.every(word => {
    if (textLower.includes(word)) return true;
    
    let wordIdx = 0;
    let textIdx = 0;
    while (wordIdx < word.length && textIdx < textLower.length) {
      if (word[wordIdx] === textLower[textIdx]) {
        wordIdx++;
      }
      textIdx++;
    }
    return wordIdx === word.length;
  });
};

const priceMatch = (query: string, usdPrice: number | null, tryPrice: number | null) => {
  if (!query) return true;
  const q = query.replace(',', '.').trim();
  if (!q) return true;
  
  // Check for range query (e.g. "0.01 - 0.05" or "0.01-0.05")
  if (q.includes('-')) {
    const parts = q.split('-');
    if (parts.length === 2) {
      const min = parseFloat(parts[0].trim());
      const max = parseFloat(parts[1].trim());
      
      if (!isNaN(min) && !isNaN(max)) {
        const usdMatch = usdPrice !== null && usdPrice >= min && usdPrice <= max;
        const tryMatch = tryPrice !== null && tryPrice >= min && tryPrice <= max;
        return usdMatch || tryMatch;
      }
    }
  }

  // Exact or partial match
  const matchUsd = usdPrice !== null && usdPrice.toString().includes(q);
  const matchTry = tryPrice !== null && tryPrice.toString().includes(q);
  
  return matchUsd || matchTry;
};

export default function AdminModels() {
  const [activeTab, setActiveTab] = useState<'active' | 'prices' | 'inactive' | 'popular' | 'credits'>('active');
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMultiplier, setBulkMultiplier] = useState<string>('');

  const [filters, setFilters] = useState({
    provider: '',
    model: '',
    service_type: '',
    input_price: '',
    output_price: ''
  });

  const [stats, setStats] = useState<any[]>([]);

  // Part 2.5: admin model tabs consume persisted catalog through backend query filters.
  useEffect(() => {
    fetchModels();
  }, [activeTab, filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/models');
      if (res.ok) {
        const data = await res.json();
        setStats(Array.isArray(data?.models) ? data.models : []);
      }
    } catch (error) {
      console.error('İstatistikler alınamadı', error);
    }
  };

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/models');
      if (!res.ok) throw new Error('models-worker.js kaynağına erişilemedi');
      const payload = await res.json();
      const rows = Array.isArray(payload?.models) ? payload.models : [];
      const mapped = rows.map((m: any) => ({
        id: String(m.id || m.modelId || `${m.provider}_${m.modelName}`),
        provider_name: String(m.provider || m.provider_name || ''),
        model_name: String(m.modelName || m.model_name || ''),
        service_type: String(m.serviceType || m.service_type || 'image'),
        billing_unit: String(m.billingUnit || m.billing_unit || 'image'),
        is_active: true,
        raw_cost_input_usd: m.inputPrice ?? null,
        raw_cost_output_usd: m.outputPrice ?? null,
        raw_cost_single_usd: m.imagePrice ?? null,
        usd_try_rate: 0,
        raw_cost_input_try: null,
        raw_cost_output_try: null,
        raw_cost_single_try: null,
        profit_multiplier: 1,
        sale_cost_input_usd: null,
        sale_cost_output_usd: null,
        sale_cost_single_usd: null,
        sale_cost_input_try: null,
        sale_cost_output_try: null,
        sale_cost_single_try: null,
        sale_credit_input: null,
        sale_credit_output: null,
        sale_credit_single: null,
        metadata_json: m,
        last_rate_sync_at: new Date().toISOString(),
        last_price_sync_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      setModels(mapped.filter((m: any) => {
        if (filters.provider && !flexibleMatch(filters.provider, m.provider_name)) return false;
        if (filters.model && !flexibleMatch(filters.model, m.model_name)) return false;
        return true;
      }));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/models/sync', { method: 'POST' });
      if (!res.ok) {
        let errMsg = 'Senkronizasyon başarısız';
        try {
          const data = await res.json();
          if (data.error) errMsg = data.error;
        } catch (e) {}
        throw new Error(errMsg);
      }
      toast.success('Fiyatlar ve kur başarıyla güncellendi');
      await fetchModels();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateModel = async (id: string, updates: Partial<ModelRecord>) => {
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Güncelleme başarısız');
      
      const { model } = await res.json();
      setModels(prev => prev.map(m => m.id === id ? model : m));
      toast.success('Model güncellendi');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBulkUpdate = async (updates: Partial<ModelRecord>) => {
    if (selectedIds.size === 0) {
      toast.error('Lütfen en az bir model seçin');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/models/bulk/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates })
      });
      
      if (!res.ok) throw new Error('Toplu güncelleme başarısız');
      toast.success('Seçili modeller güncellendi');
      setSelectedIds(new Set());
      await fetchModels();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = (filteredModels: ModelRecord[]) => {
    if (selectedIds.size === filteredModels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredModels.map(m => m.id)));
    }
  };

  const filteredModels = models.filter(m => {
    return flexibleMatch(filters.provider, m.provider_name) &&
           flexibleMatch(filters.model, m.model_name) &&
           flexibleMatch(filters.service_type, m.service_type) &&
           priceMatch(filters.input_price, m.raw_cost_input_usd, m.raw_cost_input_try) &&
           priceMatch(filters.output_price, m.raw_cost_output_usd, m.raw_cost_output_try);
  });

  const renderFilters = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-100 mb-6">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Sağlayıcı</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Örn: ai21" 
            className="w-full text-sm pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white" 
            value={filters.provider} 
            onChange={e => setFilters({...filters, provider: e.target.value})} 
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Model Adı</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Örn: jamba" 
            className="w-full text-sm pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white" 
            value={filters.model} 
            onChange={e => setFilters({...filters, model: e.target.value})} 
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Tür</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Örn: llm" 
            className="w-full text-sm pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white" 
            value={filters.service_type} 
            onChange={e => setFilters({...filters, service_type: e.target.value})} 
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Girdi Maliyeti</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Sayı girin" 
            className="w-full text-sm pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white" 
            value={filters.input_price} 
            onChange={e => setFilters({...filters, input_price: e.target.value})} 
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Çıktı Maliyeti</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Sayı girin" 
            className="w-full text-sm pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white" 
            value={filters.output_price} 
            onChange={e => setFilters({...filters, output_price: e.target.value})} 
          />
        </div>
      </div>
    </div>
  );

  const renderActiveModels = () => {
    const activeModels = filteredModels.filter(m => m.is_active);
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Aktif Modeller ({activeModels.length})</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => handleBulkUpdate({ is_active: false })}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              Seçilileri Pasif Yap
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="p-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={activeModels.length > 0 && selectedIds.size === activeModels.length}
                    onChange={() => selectAll(activeModels)}
                    className="rounded border-zinc-300"
                  />
                </th>
                <th className="p-3 font-medium text-zinc-500">Sağlayıcı</th>
                <th className="p-3 font-medium text-zinc-500">Model</th>
                <th className="p-3 font-medium text-zinc-500">Tür</th>
                <th className="p-3 font-medium text-zinc-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {activeModels.map(m => (
                <tr key={m.id} className="hover:bg-zinc-50">
                  <td className="p-3">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelection(m.id)}
                      className="rounded border-zinc-300"
                    />
                  </td>
                  <td className="p-3">{m.provider_name}</td>
                  <td className="p-3 font-medium">{m.model_name}</td>
                  <td className="p-3"><span className="px-2 py-1 bg-zinc-100 rounded text-xs">{m.service_type}</span></td>
                  <td className="p-3">
                    <button 
                      onClick={() => handleUpdateModel(m.id, { is_active: false })}
                      className="text-red-500 hover:text-red-700 font-medium text-xs"
                    >
                      Pasif Yap
                    </button>
                  </td>
                </tr>
              ))}
              {activeModels.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">Aktif model bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderInactiveModels = () => {
    const inactiveModels = filteredModels.filter(m => !m.is_active);
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Pasif Modeller ({inactiveModels.length})</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => handleBulkUpdate({ is_active: true })}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-sm bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
            >
              Seçilileri Aktif Yap
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="p-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={inactiveModels.length > 0 && selectedIds.size === inactiveModels.length}
                    onChange={() => selectAll(inactiveModels)}
                    className="rounded border-zinc-300"
                  />
                </th>
                <th className="p-3 font-medium text-zinc-500">Sağlayıcı</th>
                <th className="p-3 font-medium text-zinc-500">Model</th>
                <th className="p-3 font-medium text-zinc-500">Tür</th>
                <th className="p-3 font-medium text-zinc-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {inactiveModels.map(m => (
                <tr key={m.id} className="hover:bg-zinc-50">
                  <td className="p-3">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleSelection(m.id)}
                      className="rounded border-zinc-300"
                    />
                  </td>
                  <td className="p-3">{m.provider_name}</td>
                  <td className="p-3 font-medium text-zinc-500">{m.model_name}</td>
                  <td className="p-3"><span className="px-2 py-1 bg-zinc-100 rounded text-xs">{m.service_type}</span></td>
                  <td className="p-3">
                    <button 
                      onClick={() => handleUpdateModel(m.id, { is_active: true })}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-xs"
                    >
                      Aktif Yap
                    </button>
                  </td>
                </tr>
              ))}
              {inactiveModels.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">Pasif model bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPrices = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Ham Maliyetler (Sağlayıcı Fiyatları)</h3>
        </div>
        <div className="overflow-x-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="p-3 font-medium text-zinc-500">Sağlayıcı</th>
                <th className="p-3 font-medium text-zinc-500">Model</th>
                <th className="p-3 font-medium text-zinc-500">Tür</th>
                <th className="p-3 font-medium text-zinc-500">Birim</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Kur (USD/TRY)</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Girdi/Tekil (USD)</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Çıktı (USD)</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Girdi/Tekil (TRY)</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Çıktı (TRY)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredModels.map(m => {
                const isLlm = m.service_type === 'llm';
                const inUsd = isLlm ? m.raw_cost_input_usd : m.raw_cost_single_usd;
                const outUsd = isLlm ? m.raw_cost_output_usd : null;
                const inTry = isLlm ? m.raw_cost_input_try : m.raw_cost_single_try;
                const outTry = isLlm ? m.raw_cost_output_try : null;

                return (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="p-3">{m.provider_name}</td>
                    <td className="p-3 font-medium">{m.model_name}</td>
                    <td className="p-3"><span className="px-2 py-1 bg-zinc-100 rounded text-xs">{m.service_type}</span></td>
                    <td className="p-3 text-zinc-500 text-xs">{m.billing_unit}</td>
                    <td className="p-3 text-right">
                      <input 
                        type="number" 
                        defaultValue={m.usd_try_rate}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0 && val !== m.usd_try_rate) {
                            handleUpdateModel(m.id, { usd_try_rate: val });
                          }
                        }}
                        className="w-20 px-2 py-1 text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-black"
                        step="0.01"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-zinc-500">$</span>
                        <input 
                          type="number" 
                          defaultValue={inUsd || 0}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0 && val !== inUsd) {
                              const updates = isLlm ? { raw_cost_input_usd: val } : { raw_cost_single_usd: val };
                              handleUpdateModel(m.id, updates);
                            }
                          }}
                          className="w-20 px-2 py-1 text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-black"
                          step="0.0001"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {isLlm ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-zinc-500">$</span>
                          <input 
                            type="number" 
                            defaultValue={outUsd || 0}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0 && val !== outUsd) {
                                handleUpdateModel(m.id, { raw_cost_output_usd: val });
                              }
                            }}
                            className="w-20 px-2 py-1 text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-black"
                            step="0.0001"
                          />
                        </div>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-zinc-500">{inTry !== null ? `₺${inTry.toFixed(4)}` : '-'}</td>
                    <td className="p-3 text-right text-zinc-500">{outTry !== null ? `₺${outTry.toFixed(4)}` : '-'}</td>
                  </tr>
                );
              })}
              {filteredModels.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-500">Kayıt bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCreditPrices = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Kredi Fiyatlandırması & Kar Marjı</h3>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Toplu Kar (Örn: 2)" 
              value={bulkMultiplier}
              onChange={e => setBulkMultiplier(e.target.value)}
              className="w-32 px-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button 
              onClick={() => {
                const val = parseFloat(bulkMultiplier);
                if (!isNaN(val) && val > 0) {
                  handleBulkUpdate({ profit_multiplier: val });
                } else {
                  toast.error('Geçerli bir çarpan girin');
                }
              }}
              disabled={selectedIds.size === 0 || !bulkMultiplier}
              className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50"
            >
              Seçililere Uygula
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="p-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredModels.length > 0 && selectedIds.size === filteredModels.length}
                    onChange={() => selectAll(filteredModels)}
                    className="rounded border-zinc-300"
                  />
                </th>
                <th className="p-3 font-medium text-zinc-500">Model</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Ham (USD)</th>
                <th className="p-3 font-medium text-zinc-500 text-center">Kar Katsayısı</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Satış (USD)</th>
                <th className="p-3 font-medium text-zinc-500 text-right">Satış Kredisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredModels.map(m => {
                const isLlm = m.service_type === 'llm';
                const inUsd = isLlm ? m.raw_cost_input_usd : m.raw_cost_single_usd;
                const saleInUsd = isLlm ? m.sale_cost_input_usd : m.sale_cost_single_usd;
                const creditIn = isLlm ? m.sale_credit_input : m.sale_credit_single;
                
                return (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="p-3">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelection(m.id)}
                        className="rounded border-zinc-300"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{m.model_name}</div>
                      <div className="text-xs text-zinc-500">{m.provider_name} • {m.service_type}</div>
                    </td>
                    <td className="p-3 text-right text-zinc-500">
                      {inUsd !== null ? `$${inUsd}` : '-'}
                      {isLlm && m.raw_cost_output_usd !== null && ` / $${m.raw_cost_output_usd}`}
                    </td>
                    <td className="p-3 text-center">
                      <input 
                        type="number" 
                        defaultValue={m.profit_multiplier}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0 && val !== m.profit_multiplier) {
                            handleUpdateModel(m.id, { profit_multiplier: val });
                          }
                        }}
                        className="w-20 px-2 py-1 text-center border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-black"
                        step="0.1"
                        min="1"
                      />
                    </td>
                    <td className="p-3 text-right font-medium">
                      {saleInUsd !== null ? `$${saleInUsd}` : '-'}
                      {isLlm && m.sale_cost_output_usd !== null && ` / $${m.sale_cost_output_usd}`}
                    </td>
                    <td className="p-3 text-right font-bold text-indigo-600">
                      {creditIn !== null ? `${creditIn} kr` : '-'}
                      {isLlm && m.sale_credit_output !== null && ` / ${m.sale_credit_output} kr`}
                    </td>
                  </tr>
                );
              })}
              {filteredModels.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">Kayıt bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPopular = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Sık Kullanılan Modeller</h3>
        <button 
          onClick={fetchStats}
          className="px-3 py-1.5 text-sm bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Yenile
        </button>
      </div>
      
      <div className="overflow-x-auto border border-zinc-200 rounded-lg">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="p-3 font-medium text-zinc-500">Model</th>
              <th className="p-3 font-medium text-zinc-500">Sağlayıcı</th>
              <th className="p-3 font-medium text-zinc-500">Tür</th>
              <th className="p-3 font-medium text-zinc-500 text-right">Kullanım Sayısı</th>
              <th className="p-3 font-medium text-zinc-500 text-right">Elde Edilen Kredi</th>
              <th className="p-3 font-medium text-zinc-500 text-right">Oluşan Maliyet (TRY)</th>
              <th className="p-3 font-medium text-zinc-500 text-right">Net Kar (TRY)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {stats.map((s, idx) => (
              <tr key={idx} className="hover:bg-zinc-50">
                <td className="p-3 font-medium">{s.model_name}</td>
                <td className="p-3 text-zinc-500">{s.provider_name}</td>
                <td className="p-3"><span className="px-2 py-1 bg-zinc-100 rounded text-xs">{s.service_type}</span></td>
                <td className="p-3 text-right font-medium">{s.usage_count}</td>
                <td className="p-3 text-right text-indigo-600 font-medium">{s.total_revenue_credits.toFixed(2)} kr</td>
                <td className="p-3 text-right text-red-600 font-medium">₺{s.total_cost_try.toFixed(4)}</td>
                <td className="p-3 text-right text-emerald-600 font-medium">₺{s.total_profit_try.toFixed(4)}</td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500">Henüz kullanım verisi bulunmuyor.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading && models.length === 0) {
    return <div className="p-6 text-center text-zinc-500">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Üretim Modelleri ve Fiyatlandırma</h1>
          <p className="text-sm text-zinc-500 mt-1">Sistemdeki tüm yapay zeka modellerini, maliyetlerini ve satış kredilerini yönetin. Kaynak: models-worker.js (/models)</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors flex items-center disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Senkronize Ediliyor...' : 'Fiyatları ve Kuru Güncelle'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Aktif Modeller
        </button>
        <button
          onClick={() => setActiveTab('prices')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prices' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Fiyatlar (Ham)
        </button>
        <button
          onClick={() => setActiveTab('credits')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'credits' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Kredi Fiyatları (Satış)
        </button>
        <button
          onClick={() => setActiveTab('inactive')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'inactive' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Pasif Modeller
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'popular' ? 'border-black text-black' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Sık Kullanılanlar
        </button>
      </div>

      {renderFilters()}

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6">
        {activeTab === 'active' && renderActiveModels()}
        {activeTab === 'inactive' && renderInactiveModels()}
        {activeTab === 'prices' && renderPrices()}
        {activeTab === 'credits' && renderCreditPrices()}
        {activeTab === 'popular' && renderPopular()}
      </div>
    </div>
  );
}

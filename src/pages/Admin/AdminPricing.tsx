import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, RefreshCw, DollarSign } from 'lucide-react';

export default function AdminPricing() {
  const [creditPerUsd, setCreditPerUsd] = useState<number>(100);
  const [originalCreditPerUsd, setOriginalCreditPerUsd] = useState<number>(100);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [updatedBy, setUpdatedBy] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/pricing');
      if (!res.ok) throw new Error('Fiyatlandırma ayarları alınamadı');
      
      const data = await res.json();
      setCreditPerUsd(data.creditPerUsd);
      setOriginalCreditPerUsd(data.creditPerUsd);
      setUpdatedAt(data.updatedAt);
      setUpdatedBy(data.updatedBy);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (creditPerUsd <= 0) {
      setError('Kredi oranı 0\'dan büyük olmalıdır.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creditPerUsd })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Güncelleme başarısız');
      }
      
      const data = await res.json();
      setCreditPerUsd(data.pricing.creditPerUsd);
      setOriginalCreditPerUsd(data.pricing.creditPerUsd);
      setUpdatedAt(data.pricing.updatedAt);
      setUpdatedBy(data.pricing.updatedBy);
      setSuccess('Fiyatlandırma ayarları başarıyla güncellendi. Tüm modellerin satış kredileri yeniden hesaplandı.');
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = creditPerUsd !== originalCreditPerUsd;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Merkezi Fiyatlandırma</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistemdeki tüm kredi hesaplamaları için temel USD/Kredi oranını belirleyin. kaynak: models-worker.js (/models)
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Temel Kredi Oranı</h2>
          <p className="text-sm text-gray-500 mt-1">
            1 USD maliyetin kaç krediye denk geleceğini belirler.
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              1 USD = Kaç Kredi?
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={creditPerUsd}
                onChange={(e) => setCreditPerUsd(Number(e.target.value))}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Örnek: Eğer oran 100 ise, 0.01 USD maliyetli bir işlem 1 krediye satılır.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
            <h3 className="font-medium text-gray-900 mb-2">Bu ayar neleri etkiler?</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tüm AI modellerinin (Chat, Görsel, Video, Ses vb.) satış kredi maliyetlerini.</li>
              <li>Bu değeri değiştirdiğinizde, sistemdeki <strong>tüm modellerin satış kredileri otomatik olarak yeniden hesaplanır</strong>.</li>
              <li>Kullanıcıların mevcut kredi bakiyeleri etkilenmez, sadece yeni işlemlerin maliyetleri değişir.</li>
            </ul>
          </div>

          {updatedAt && (
            <div className="text-xs text-gray-500">
              Son güncelleme: {new Date(updatedAt).toLocaleString('tr-TR')} 
              {updatedBy && ` (${updatedBy} tarafından)`}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

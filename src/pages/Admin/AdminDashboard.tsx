import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, CreditCard, Activity, TrendingUp, AlertCircle, 
  Settings, FileText, Shield, BarChart3, Zap, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/admin/summary');
      if (!res.ok) throw new Error('Özet bilgileri alınamadı');
      const json = await res.json();
      setData(json);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-zinc-500">Yükleniyor...</div>;
  }

  if (!data) {
    return <div className="p-6 text-center text-red-500">Veri bulunamadı.</div>;
  }

  const { metrics, recentActivity, recentAssets, charts, alerts } = data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Yönetim Paneli</h1>
          <p className="text-zinc-500">Sistem durumu, finansal özet ve kullanıcı aktiviteleri.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/modeller" className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 font-medium flex items-center gap-2">
            <Settings size={18} />
            Model Ayarları
          </Link>
        </div>
      </header>

      {/* Alerts */}
      {alerts.failedPayments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={20} />
          <div>
            <h3 className="text-red-800 font-medium">Başarısız Ödemeler Tespit Edildi</h3>
            <p className="text-red-700 text-sm mt-1">
              Son 24 saat içinde {alerts.failedPayments.length} adet başarısız ödeme denemesi oldu. Ödeme loglarını kontrol ediniz.
            </p>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <div className="text-zinc-500 text-sm font-medium mb-1">Toplam Kullanıcı</div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.totalUsers.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <div className="text-zinc-500 text-sm font-medium mb-1">Bugün Aktif</div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.todayActiveUsers.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <div className="text-zinc-500 text-sm font-medium mb-1">Günlük Tüketim</div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.todayCreditUsage.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <div className="text-zinc-500 text-sm font-medium mb-1">Günlük Ciro</div>
          <div className="text-2xl font-bold text-zinc-900">₺{metrics.todayRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <div className="text-zinc-500 text-sm font-medium mb-1">Bekleyen Ödeme</div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.pendingPaymentsCount}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <div className="text-zinc-500 text-sm font-medium mb-1">Aktif Modeller</div>
          <div className="text-2xl font-bold text-zinc-900">{metrics.activeModelsCount}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Hızlı Yönetim</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link to="/admin/kullanicilar" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-100">
              <Users size={24} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Kullanıcılar</span>
          </Link>
          <Link to="/admin/odeme-yonetimi" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-emerald-100">
              <CreditCard size={24} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Ödemeler</span>
          </Link>
          <Link to="/admin/modeller" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100">
              <Shield size={24} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Modeller</span>
          </Link>
          <Link to="/admin/modeller" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-100">
              <TrendingUp size={24} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Fiyat Güncelle</span>
          </Link>
          <Link to="/admin/loglar" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-100">
              <Activity size={24} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Sistem Logları</span>
          </Link>
          <Link to="/admin/ozet" className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-zinc-200 shadow-sm hover:border-pink-300 hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-pink-100">
              <BarChart3 size={24} />
            </div>
            <span className="text-sm font-medium text-zinc-700">Raporlar</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-zinc-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-900">Son Sistem Aktiviteleri</h2>
            <Link to="/admin/loglar" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Tümünü Gör</Link>
          </div>
          <div className="p-0 flex-1">
            {recentActivity.length > 0 ? (
              <ul className="divide-y divide-zinc-100">
                {recentActivity.map((activity: any, index: number) => (
                  <li key={index} className="p-4 hover:bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                        {activity.type === 'user_registered' && <Users size={18} />}
                        {activity.type === 'payment' && <CreditCard size={18} />}
                        {activity.type === 'usage' && <Zap size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {activity.type === 'user_registered' && 'Yeni Kullanıcı Kaydı'}
                          {activity.type === 'payment' && 'Ödeme İşlemi'}
                          {activity.type === 'usage' && 'Sistem Kullanımı'}
                        </p>
                        <p className="text-xs text-zinc-500">{new Date(activity.date).toLocaleString('tr-TR')}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {activity.type === 'payment' && (
                        <span className="text-sm font-medium text-zinc-900">₺{activity.data.tutar_tl}</span>
                      )}
                      {activity.type === 'usage' && (
                        <span className="text-sm font-medium text-zinc-900">{activity.data.kredi_maliyeti} Kredi</span>
                      )}
                      <span className="text-xs flex items-center gap-1 mt-1">
                        {activity.data.durum === 'success' || activity.data.durum === 'completed' ? (
                          <><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-emerald-600">Başarılı</span></>
                        ) : activity.data.durum === 'failed' ? (
                          <><XCircle size={12} className="text-red-500" /><span className="text-red-600">Başarısız</span></>
                        ) : (
                          <><Clock size={12} className="text-amber-500" /><span className="text-amber-600">İşlemde</span></>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
                <Activity size={32} className="mb-2 text-zinc-300" />
                <p>Henüz bir aktivite bulunmuyor.</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts (Simplified) */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex flex-col">
          <div className="p-5 border-b border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900">Günlük Kullanım ve Gelir (Son 7 Gün)</h2>
          </div>
          <div className="p-5 flex-1 flex items-end gap-2 h-64">
            {charts.last7Days.length > 0 ? (
              charts.last7Days.map((day: any, i: number) => {
                const maxRevenue = Math.max(...charts.last7Days.map((d: any) => d.revenue), 100);
                const height = Math.max((day.revenue / maxRevenue) * 100, 5);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full bg-emerald-100 rounded-t-md relative flex items-end justify-center">
                      <div 
                        className="w-full bg-emerald-500 rounded-t-md transition-all duration-500 group-hover:bg-emerald-600"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="absolute -top-8 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        ₺{day.revenue}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">{day.date}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                Veri bulunmuyor
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Genel Finansal Durum</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-zinc-500 mb-1">Toplam Satış</p>
            <p className="text-2xl font-bold text-emerald-600">₺{metrics.totalSales.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">Satılan Kredi</p>
            <p className="text-2xl font-bold text-indigo-600">{metrics.totalCreditsSold.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">Harcanan Kredi</p>
            <p className="text-2xl font-bold text-orange-600">{metrics.totalCreditsUsed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">İç Maliyet (Tahmini)</p>
            <p className="text-2xl font-bold text-red-600">₺{metrics.totalInternalCost.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

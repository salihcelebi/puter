import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Package {
  id: string;
  name: string;
  credits: number;
  price_tl: number;
  price_usd: number;
  color: string;
}

export default function Checkout() {
  const { packageId } = useParams<{ packageId: string }>();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const response = await fetch('/api/billing/packages');
        if (response.ok) {
          const data = await response.json();
          const selected = data.packages.find((p: Package) => p.id === packageId);
          if (selected) {
            setPkg(selected);
          } else {
            setError('Paket bulunamadı');
          }
        }
      } catch (error) {
        setError('Paket bilgileri alınamadı');
      } finally {
        setLoading(false);
      }
    };

    if (packageId) {
      fetchPackage();
    }
  }, [packageId]);

  const handlePayment = async (provider: string) => {
    if (!user) {
      navigate('/giris', { replace: true, state: { from: { pathname: `/odeme-yap/${packageId}` } } });
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, provider }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ödeme başlatılamadı');
      }

      // Redirect to mock checkout page
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  if (error || !pkg) {
    return (
      <div className="max-w-3xl mx-auto mt-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error || 'Paket bulunamadı'}
        </div>
        <button onClick={() => navigate('/odeme-paketleri')} className="mt-4 text-indigo-600 hover:underline">
          Paketlere Dön
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Ödeme Yap</h1>
        <p className="text-zinc-500 mt-1">Ana Sayfa / Ödeme</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Bakiye Yükleme</h2>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium">
                {pkg.credits} Kredi
              </div>
              <div className="bg-zinc-100 px-6 py-3 rounded-lg font-medium text-zinc-900 flex-1 text-right">
                ₺ {pkg.price_tl.toFixed(2)}
              </div>
            </div>

            <p className="text-sm text-zinc-500 mb-4">
              Daha fazla kredi satın almak için aşağıdaki ödeme yöntemlerinden birini seçin:
            </p>

            {error && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => handlePayment('iyzico')}
                disabled={processing}
                className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <div className="font-bold text-blue-600 text-xl mb-1">iyzico</div>
                <div className="text-xs text-zinc-500 text-center">Kolay Ödeme & Ötesi</div>
              </button>

              <button
                onClick={() => handlePayment('paytr')}
                disabled={processing}
                className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <div className="font-bold text-sky-600 text-xl mb-1">PAYTR</div>
                <div className="text-xs text-zinc-500 text-center">Güvenle Ödeyebilirsiniz!</div>
              </button>

              <button
                onClick={() => handlePayment('shopier')}
                disabled={processing}
                className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <div className="font-bold text-pink-500 text-xl mb-1">Shopier</div>
                <div className="text-xs text-zinc-500 text-center">Güvenilir. Hızlı. Kolay.</div>
              </button>

              <button
                onClick={() => handlePayment('param')}
                disabled={processing}
                className="flex flex-col items-center justify-center p-4 border border-zinc-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <div className="font-bold text-blue-500 text-xl mb-1">Param</div>
                <div className="text-xs text-zinc-500 text-center">Param İle Öde</div>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-[#1e293b] text-white p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Ödeme Bilgileri</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                <span className="text-slate-300">Mevcut Kredi</span>
                <span className="font-medium">{user?.toplam_kredi - (user?.kullanilan_kredi || 0)}</span>
              </div>
              
              <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                <span className="text-slate-300">Alınacak Kredi</span>
                <span className="font-medium text-emerald-400">+{pkg.credits}</span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-semibold">Toplam Tutar</span>
                <span className="text-2xl font-bold">₺ {pkg.price_tl.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <div className="mt-0.5 text-emerald-400">✓</div>
                <p>Ödeme işlemi 256-bit SSL ile şifrelenmektedir.</p>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <div className="mt-0.5 text-emerald-400">✓</div>
                <p>Kredi tutarı anında hesabınıza yansır.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

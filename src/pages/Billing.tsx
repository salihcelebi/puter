import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Package {
  id: string;
  name: string;
  credits: number;
  price_tl: number;
  price_usd: number;
  color: string;
}

export default function Billing() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch('/api/billing/packages');
        if (response.ok) {
          const data = await response.json();
          setPackages(data.packages);
        }
      } catch (error) {
        console.error('Failed to fetch packages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  const handleBuy = (pkg: Package) => {
    navigate(`/odeme-yap/${pkg.id}`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Kredi Paketleri</h1>
        <p className="text-zinc-500 mt-1">İhtiyacınıza uygun kredi paketlerinden dilediğinizi seçin ve hemen kullanmaya başlayın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
            <div className={`${pkg.color} p-6 text-white flex justify-between items-center`}>
              <h3 className="text-2xl font-bold">{pkg.credits} Kredi</h3>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">🪙</span>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="mb-6">
                <div className="flex items-baseline text-4xl font-extrabold text-zinc-900">
                  <span className="text-2xl mr-1">₺</span>
                  {pkg.price_tl}
                </div>
                <div className="text-sm text-zinc-500 mt-1">
                  Yaklaşık ${pkg.price_usd}
                </div>
              </div>
              <button
                onClick={() => handleBuy(pkg)}
                className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${pkg.color} hover:opacity-90`}
              >
                Satın Al
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

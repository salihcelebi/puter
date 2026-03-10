import { kv } from '../db/kv.js';
import { authService } from './authService.js';

export interface Package {
  id: string;
  name: string;
  credits: number;
  price_tl: number;
  price_usd: number;
  color: string;
}

export interface Payment {
  id: string;
  kullanici_id: string;
  paket_id: string;
  saglayici: string;
  tutar_tl: number;
  kredi_miktari: number;
  durum: 'pending' | 'completed' | 'failed';
  referans: string;
  idempotency_key: string;
  webhook_dogrulandi_mi: boolean;
  olusturma_tarihi: string;
  guncelleme_tarihi: string;
}

export interface LedgerEntry {
  id: string;
  kullanici_id: string;
  islem_tipi: 'topup' | 'usage' | 'refund' | 'adjustment';
  miktar: number;
  onceki_bakiye: number;
  sonraki_bakiye: number;
  bagli_odeme_id?: string;
  bagli_kullanim_id?: string;
  aciklama: string;
  created_at: string;
}

const DEFAULT_PACKAGES: Package[] = [
  { id: 'pkg_100', name: 'Başlangıç', credits: 100, price_tl: 69, price_usd: 2.5, color: 'bg-emerald-500' },
  { id: 'pkg_250', name: 'Temel', credits: 250, price_tl: 159, price_usd: 5.5, color: 'bg-blue-600' },
  { id: 'pkg_500', name: 'Standart', credits: 500, price_tl: 279, price_usd: 9.5, color: 'bg-purple-600' },
  { id: 'pkg_750', name: 'Avantaj', credits: 750, price_tl: 399, price_usd: 13.5, color: 'bg-amber-500' },
  { id: 'pkg_1000', name: 'Pro', credits: 1000, price_tl: 499, price_usd: 16.5, color: 'bg-orange-500' },
  { id: 'pkg_1500', name: 'Ultra', credits: 1500, price_tl: 599, price_usd: 19.5, color: 'bg-rose-600' },
];

export const billingService = {
  async getPackages(): Promise<Package[]> {
    const storedPackages = await kv.get('settings:billing:packages');
    return storedPackages || DEFAULT_PACKAGES;
  },

  async getPackage(id: string): Promise<Package | null> {
    const packages = await this.getPackages();
    return packages.find(p => p.id === id) || null;
  },

  async createPayment(userId: string, packageId: string, provider: string): Promise<{ payment: Payment, checkoutUrl: string }> {
    const pkg = await this.getPackage(packageId);
    if (!pkg) throw new Error('Paket bulunamadı');

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const idempotencyKey = `idemp_${paymentId}`;
    const now = new Date().toISOString();

    const payment: Payment = {
      id: paymentId,
      kullanici_id: userId,
      paket_id: packageId,
      saglayici: provider,
      tutar_tl: pkg.price_tl,
      kredi_miktari: pkg.credits,
      durum: 'pending',
      referans: `REF-${paymentId.toUpperCase()}`,
      idempotency_key: idempotencyKey,
      webhook_dogrulandi_mi: false,
      olusturma_tarihi: now,
      guncelleme_tarihi: now,
    };

    await kv.set(`payments:${paymentId}`, payment);
    await kv.set(`userPayments:${userId}:${paymentId}`, paymentId);

    // Mock checkout URL generation based on provider
    const checkoutUrl = `/api/billing/mock-checkout/${paymentId}`;

    return { payment, checkoutUrl };
  },

  async processWebhook(provider: string, payload: any): Promise<boolean> {
    // In a real scenario, verify signature here using provider's SDK
    // For this mock, we assume payload contains paymentId and status
    const { paymentId, status, transactionId } = payload;

    const payment = await kv.get(`payments:${paymentId}`) as Payment;
    if (!payment) {
      console.error(`Webhook error: Payment ${paymentId} not found`);
      return false;
    }

    // Idempotency check: If already completed, ignore
    if (payment.durum === 'completed' || payment.webhook_dogrulandi_mi) {
      console.log(`Webhook info: Payment ${paymentId} already processed`);
      return true;
    }

    // Log webhook payload
    await kv.set(`webhook_kayitlari:${paymentId}_${Date.now()}`, {
      provider,
      payload,
      received_at: new Date().toISOString()
    });

    if (status === 'success') {
      payment.durum = 'completed';
      payment.webhook_dogrulandi_mi = true;
      payment.guncelleme_tarihi = new Date().toISOString();
      
      await kv.set(`payments:${paymentId}`, payment);

      // Add credits to user and write to ledger
      await this.addCredits(payment.kullanici_id, payment.kredi_miktari, paymentId, `${provider} üzerinden ${payment.kredi_miktari} kredi satın alımı`);
      return true;
    } else {
      payment.durum = 'failed';
      payment.guncelleme_tarihi = new Date().toISOString();
      await kv.set(`payments:${paymentId}`, payment);
      return true;
    }
  },

  async addCredits(userId: string, amount: number, paymentId: string, description: string): Promise<void> {
    const user = await kv.get(`users:${userId}`);
    if (!user) throw new Error('Kullanıcı bulunamadı');

    const previousBalance = user.toplam_kredi;
    const newBalance = previousBalance + amount;

    // Update user
    user.toplam_kredi = newBalance;
    await kv.set(`users:${userId}`, user);

    // Write to ledger
    const ledgerId = `ldg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const entry: LedgerEntry = {
      id: ledgerId,
      kullanici_id: userId,
      islem_tipi: 'topup',
      miktar: amount,
      onceki_bakiye: previousBalance,
      sonraki_bakiye: newBalance,
      bagli_odeme_id: paymentId,
      aciklama: description,
      created_at: new Date().toISOString()
    };

    await kv.set(`creditLedger:${ledgerId}`, entry);
    await kv.set(`userCreditLedger:${userId}:${ledgerId}`, ledgerId);
  }
};

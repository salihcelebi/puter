import { Router } from 'express';
import { billingService } from '../services/billingService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const billingRouter = Router();

billingRouter.get('/packages', async (req, res) => {
  try {
    const packages = await billingService.getPackages();
    res.json({ packages });
  } catch (error) {
    res.status(500).json({ error: 'Paketler alınamadı' });
  }
});

billingRouter.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { packageId, provider } = req.body;
    const userId = req.user.id;

    if (!packageId || !provider) {
      return res.status(400).json({ error: 'Paket ve sağlayıcı seçilmelidir' });
    }

    const { payment, checkoutUrl } = await billingService.createPayment(userId, packageId, provider);
    res.json({ payment, checkoutUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ödeme başlatılamadı' });
  }
});

billingRouter.post('/webhook/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const payload = req.body;

    // In a real app, verify signature here
    const success = await billingService.processWebhook(provider, payload);
    
    if (success) {
      res.status(200).send('OK');
    } else {
      res.status(400).send('Bad Request');
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Mock checkout page for testing
billingRouter.get('/mock-checkout/:paymentId', (req, res) => {
  const paymentId = req.params.paymentId;
  res.send(`
    <html>
      <head>
        <title>Mock Checkout</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f5; }
          .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
          button { background: #4f46e5; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; margin: 0.5rem; }
          button.fail { background: #ef4444; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Mock Payment Gateway</h2>
          <p>Payment ID: ${paymentId}</p>
          <button onclick="simulateWebhook('success')">Simulate Success</button>
          <button class="fail" onclick="simulateWebhook('failed')">Simulate Failure</button>
        </div>
        <script>
          function simulateWebhook(status) {
            fetch('/api/billing/webhook/mock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId: '${paymentId}', status: status, transactionId: 'txn_123' })
            }).then(() => {
              window.location.href = '/dashboard?payment=' + status;
            });
          }
        </script>
      </body>
    </html>
  `);
});

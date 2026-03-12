import { Router } from 'express';
import { kv } from '../db/kv.js';
import { fileSystem } from '../db/fs.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

export const assetsRouter = Router();
assetsRouter.use(requireAuth);

const mimeByType: Record<string, string> = {
  image: 'image/png',
  audio: 'audio/mpeg',
  video: 'video/mp4',
};

assetsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    // Part 3: stream persisted output assets via ownership-checked metadata.
    const asset = await kv.get(`assets:${req.params.id}`);
    if (!asset) return res.status(404).json({ error: 'Asset bulunamadı', code: 'ASSET_NOT_FOUND' });
    if (asset.kullanici_id !== req.user.id) return res.status(403).json({ error: 'Bu varlığa erişim izniniz yok', code: 'ASSET_FORBIDDEN' });

    const file = await fileSystem.read(asset.fs_path);
    const contentType = mimeByType[asset.tur] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${asset.dosya_adi}"`);
    return res.send(file);
  } catch (error) {
    return res.status(500).json({ error: 'Asset stream başarısız', code: 'ASSET_STREAM_FAILED' });
  }
});

import { Router } from 'express';
export const assetsRouter = Router();

assetsRouter.get('/', (req, res) => {
  res.json({ message: 'Assets list endpoint' });
});

assetsRouter.get('/:id', (req, res) => {
  res.json({ message: 'Asset detail endpoint' });
});

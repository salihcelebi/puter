import fs from 'fs';
import path from 'path';

const dirs = [
  'server',
  'server/db',
  'server/routes',
  'server/middleware',
  'server/services'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const files = [
  {
    path: 'server/db/kv.ts',
    content: `// KV (Key-Value) Store Adapter
// In a real Puter environment, this would use puter.kv
// For local dev, we simulate it with an in-memory map or simple JSON file.

const store = new Map<string, any>();

export const kv = {
  get: async (key: string) => store.get(key) || null,
  set: async (key: string, value: any) => { store.set(key, value); return true; },
  delete: async (key: string) => { store.delete(key); return true; },
  list: async (prefix: string) => {
    const results: any[] = [];
    for (const [k, v] of store.entries()) {
      if (k.startsWith(prefix)) results.push({ key: k, value: v });
    }
    return results;
  }
};
`
  },
  {
    path: 'server/db/fs.ts',
    content: `// FS (File System) Store Adapter
// In a real Puter environment, this would use puter.fs
// For local dev, we simulate it using the local file system.

import fs from 'fs/promises';
import path from 'path';

const BASE_DIR = path.join(process.cwd(), '.data', 'fs');

export const fileSystem = {
  init: async () => {
    await fs.mkdir(BASE_DIR, { recursive: true });
  },
  write: async (filePath: string, data: Buffer | string) => {
    const fullPath = path.join(BASE_DIR, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return fullPath;
  },
  read: async (filePath: string) => {
    const fullPath = path.join(BASE_DIR, filePath);
    return await fs.readFile(fullPath);
  },
  delete: async (filePath: string) => {
    const fullPath = path.join(BASE_DIR, filePath);
    await fs.unlink(fullPath);
    return true;
  }
};
`
  },
  {
    path: 'server/routes/auth.ts',
    content: `import { Router } from 'express';
export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint' });
});

authRouter.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint' });
});
`
  },
  {
    path: 'server/routes/billing.ts',
    content: `import { Router } from 'express';
export const billingRouter = Router();

billingRouter.get('/packages', (req, res) => {
  res.json({ message: 'Billing packages endpoint' });
});

billingRouter.post('/checkout', (req, res) => {
  res.json({ message: 'Checkout endpoint' });
});

billingRouter.post('/webhook', (req, res) => {
  res.json({ message: 'Webhook endpoint' });
});
`
  },
  {
    path: 'server/routes/ai.ts',
    content: `import { Router } from 'express';
export const aiRouter = Router();

aiRouter.post('/chat', (req, res) => {
  res.json({ message: 'Chat generation endpoint' });
});

aiRouter.post('/image', (req, res) => {
  res.json({ message: 'Image generation endpoint' });
});
`
  },
  {
    path: 'server/routes/admin.ts',
    content: `import { Router } from 'express';
export const adminRouter = Router();

adminRouter.get('/summary', (req, res) => {
  res.json({ message: 'Admin summary endpoint' });
});

adminRouter.get('/users', (req, res) => {
  res.json({ message: 'Admin users endpoint' });
});
`
  },
  {
    path: 'server/middleware/auth.ts',
    content: `import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Placeholder for auth middleware
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Placeholder for admin middleware
  next();
};
`
  },
  {
    path: 'server/middleware/credit.ts',
    content: `import { Request, Response, NextFunction } from 'express';

export const checkCredit = (cost: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Placeholder for credit check middleware
    next();
  };
};
`
  }
];

files.forEach(file => {
  fs.writeFileSync(path.resolve(file.path), file.content);
});
console.log('Backend skeleton generated successfully.');

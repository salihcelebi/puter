// FS (File System) Store Adapter
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

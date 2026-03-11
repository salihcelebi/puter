import fs from 'fs';
import path from 'path';

import { getWritableBaseDir, isServerlessRuntime } from './runtime.js';

const DB_FILE = isServerlessRuntime()
  ? path.join(getWritableBaseDir(), 'kv.json')
  : path.join(getWritableBaseDir(), 'server', 'db', 'kv.json');

// Initialize store from file
let store = new Map<string, any>();

const saveStore = () => {
  try {
    const obj = Object.fromEntries(store);
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Error saving KV store:', e);
  }
};

try {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    if (data.trim()) {
      const parsed = JSON.parse(data);
      store = new Map(Object.entries(parsed));
    }
  }
} catch (e) {
  console.error('Error loading KV store, resetting to empty store:', e);
  store = new Map<string, any>();
  saveStore();
}

export const kv = {
  get: async (key: string) => store.get(key) || null,
  set: async (key: string, value: any) => {
    store.set(key, value);
    saveStore();
    return true;
  },
  delete: async (key: string) => {
    store.delete(key);
    saveStore();
    return true;
  },
  list: async (prefix: string) => {
    const results: any[] = [];
    for (const [k, v] of store.entries()) {
      if (k.startsWith(prefix)) results.push({ key: k, value: v });
    }
    return results;
  }
};

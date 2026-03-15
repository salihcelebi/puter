/*
█████████████████████████████████████████████
1) BU DOSYA, PROJENİN DOSYA TABANLI İKİNCİ DEPOLAMA KATMANIDIR VE BINARY / ASSET VERİLERİNİ SAKLAMAK İÇİN KULLANILIR.
2) KV'DEN FARKLI OLARAK BU MODÜL, METADATA DEĞİL DOSYANIN KENDİ İÇERİĞİNİ YAZIP OKUMAYA ODAKLANIR.
3) DOSYA, LOKAL GELİŞTİRMEDE NODE FS KULLANIR; YORUM SATIRINDA PUTER FS BENZERİ HEDEF AÇIKLANMIŞTIR.
4) getWritableBaseDir VE isServerlessRuntime SAYESİNDE ÇALIŞMA DİZİNİNİ ORTAMA GÖRE SEÇER.
5) SERVERLESS'TE data/fs, NORMAL ORTAMDA .data/fs ALTINA YAZAR.
6) init FONKSİYONU, GEREKLİ KLASÖRÜ OLUŞTURARAK DOSYA YAZIMINA ORTAMI HAZIRLAR.
7) write FONKSİYONU, ALT KLASÖRLERİ DE OLUŞTURUP DOSYAYI KALICI OLARAK YAZAR.
8) read FONKSİYONU, KAYDEDİLMİŞ DOSYAYI BUFFER OLARAK GERİ OKUR.
9) delete FONKSİYONU, DOSYAYI SİLER VE TEMİZLİK AKIŞINI DESTEKLER.
10) KISACA: BU MODÜL, ASSET DOSYALARINI DISKTE TUTAN BASİT AMA İŞLEVSEL FILE STORE ADAPTÖRÜDÜR.
█████████████████████████████████████████████
*/
// FS (File System) Store Adapter
// In a real Puter environment, this would use puter.fs
// For local dev, we simulate it using the local file system.

import fs from 'fs/promises';
import path from 'path';

import { getWritableBaseDir, isServerlessRuntime } from './runtime.js';

const BASE_DIR = isServerlessRuntime()
  ? path.join(getWritableBaseDir(), 'data', 'fs')
  : path.join(getWritableBaseDir(), '.data', 'fs');

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

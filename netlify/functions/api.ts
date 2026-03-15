/*
█████████████████████████████████████████████
1) BU DOSYA, NETLIFY FUNCTION GİRİŞ NOKTASIDIR.
2) serverless-http KULLANARAK EXPRESS UYGULAMASINI NETLIFY SERVERLESS FORMATINA SARAR.
3) createApiApp() İLE OLUŞAN UYGULAMA, BU DOSYA ÜZERİNDEN HANDLER HALİNE GETİRİLİR.
4) cachedHandler DEĞİŞKENİ, HANDLER'I HER İSTEĞİNDE YENİDEN KURMAMAK İÇİN CACHE GÖREVİ GÖRÜR.
5) getHandler() FONKSİYONU, İLK ÇAĞRIDA APP'I OLUŞTURUR, SONRA AYNI HANDLER'I YENİDEN KULLANIR.
6) basePath DEĞERİ "/.netlify/functions/api" OLARAK AYARLANDIĞI İÇİN ROUTE EŞLEŞMESİ NETLIFY YAPISINA GÖRE ÇALIŞIR.
7) normalizeSetCookie() FONKSİYONU, SET-COOKIE HEADER'INI multiValueHeaders FORMATINA TAŞIYARAK NETLIFY UYUMLULUĞU SAĞLAR.
8) BU AYRINTI, TEK ÇEREZ DEĞİL BİRDEN FAZLA ÇEREZ DÖNEN AUTH AKIŞLARI İÇİN KRİTİKTİR.
9) export const handler, EVENT VE CONTEXT ALIP ÖNCE EXPRESS HANDLER'I ÇALIŞTIRIR, SONRA HEADER NORMALİZASYONU YAPAR.
10) KISACA: BU DOSYA, EXPRESS BACKEND'İ NETLIFY FUNCTION ORTAMINA GÜVENLİ ŞEKİLDE BAĞLAYAN KÖPRÜ KATMANIDIR.
█████████████████████████████████████████████
*/
import serverless from "serverless-http";

import { createApiApp } from "../../server/app.js";

let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const app = await createApiApp();
    cachedHandler = serverless(app, {
      basePath: "/.netlify/functions/api",
    });
  }

  return cachedHandler;
}

function normalizeSetCookie(response: any) {
  const headers = response?.headers || {};
  const rawSetCookie = headers['set-cookie'] || headers['Set-Cookie'];

  if (!rawSetCookie) {
    return response;
  }

  const cookieValues = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
  return {
    ...response,
    multiValueHeaders: {
      ...(response?.multiValueHeaders || {}),
      'set-cookie': cookieValues,
    },
  };
}

export const handler = async (event: any, context: any) => {
  const currentHandler = await getHandler();
  const response = await currentHandler(event, context);
  return normalizeSetCookie(response);
};

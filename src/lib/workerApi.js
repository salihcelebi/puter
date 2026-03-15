/*
█████████████████████████████████████████████
1) BU DOSYA, FRONTEND İÇİN TEK MERKEZLİ WORKER URL KAYNAĞIDIR.
2) ANA AI WORKER OLARAK https://api-cagrilari.puter.work TANIMLANMIŞTIR.
3) JOB STATUS WORKER OLARAK https://is-durumu.puter.work TANIMLANMIŞTIR.
4) DOSYANIN AMAÇLARINDAN BİRİ, WORKER URL DEĞİŞİRSE TEK DOSYADAN GÜNCELLEME YAPILABİLMESİDİR.
5) DİĞER AMAÇ, UI DOSYALARINI SADE TUTUP URL DAĞINIKLIĞINI AZALTMAKTIR.
6) PUTER_OWNER_AI_BASE_URL VE vite_api_base_url GİBİ İSİMLER “KULLANILMAYAN / YANLIŞ İSİMLİ WORKER” OLARAK İŞARETLENMİŞTİR.
7) BU DOSYA, HANGİ WORKER'IN GERÇEK SERVİS, HANGİSİNİN YASAKLI / DEPRECATED OLDUĞUNU AÇIK BİÇİMDE AYIRIR.
8) BOZUK VEYA ESKİ İSİMLERİN UYGULAMAYA YAYILMASINI ENGELLEMEK İÇİN REFERANS DOSYASI GİBİ ÇALIŞIR.
9) FRONTEND TEST VE TANI KODLARI DA BU DOSYADAKİ SABİTLERE DAYANABİLİR.
10) KISACA: BU DOSYA, WORKER UÇLARININ DOĞRU KULLANILMASI İÇİN KÜÇÜK AMA MERKEZİ BİR ADRES DEFTERİDİR.
█████████████████████████████████████████████
*/
/* ============================================================================
   DOSYA ADI: src/lib/workerApi.js

   NE İŞE YARAR?
   - Frontend tarafında Puter Worker çağrılarını tek yerde toplar.
   - UI bileşenleri doğrudan fetch/worker URL yazmaz.
   - Chat, image, tts, video, photo-to-video ve job status çağrılarını standartlaştırır.
   - puter.workers.exec() kullanır; böylece kullanıcı session/context otomatik taşınır.

   NEDEN ÖNEMLİ?
   - Kod tekrarını azaltır.
   - Hata yönetimini tek yerde toplar.
   - Worker URL değişirse tek dosyadan güncellenir.
   - UI dosyaları sade kalır.

   KULLANILAN WORKER'LAR
   - Ana AI worker:   https://api-cagrilari.puter.work
   - Job status:      https://is-durumu.puter.work

   KULLANILMAYAN / YANLIŞ İSİMLİ WORKER'LAR
   - https://PUTER_OWNER_AI_BASE_URL.puter.work
   - https://vite_api_base_url.puter.work
   Bunlar gerçek servis değil; kullanılmamalı.

   KULLANIM ÖRNEĞİ
   ----------------------------------------------------------------
   import {
     chatIste,
     gorselUret,
     sesiUret,
     videoUret,
     fotografaVideoUret,
     isDurumuGetir
   } from "./lib/workerApi";

   const sonuc = await chatIste({
     prompt: "Bana kısa slogan yaz",
     model: "gpt-5-nano"
   });

   console.log(sonuc.text);
   ----------------------------------------------------------------
   ============================================================================ */

/* ---------------------------------------------------------------------------
   1) SABİTLER
   --------------------------------------------------------------------------- */

/* Ana AI işlemlerinin gittiği worker */
export const ANA_AI_WORKER = "https://api-cagrilari.puter.work";

/* Job durumlarını okuyan worker */
export const IS_DURUMU_WORKER = "https://is-durumu.puter.work";

/* Varsayılan timeout süresi.
   Çok kısa olursa video/görsel gibi işlemler erken kesilebilir.
   Çok uzun olursa kullanıcı gereksiz bekler.
*/
export const VARSAYILAN_TIMEOUT_MS = 120000;

/* ---------------------------------------------------------------------------
   2) GENEL YARDIMCI FONKSİYONLAR
   --------------------------------------------------------------------------- */

/* Tarayıcıda Puter SDK yüklü mü?
   - script ile yüklendiyse window.puter üzerinden erişilir
   - yoksa kullanıcıya açık ve anlaşılır hata veriyoruz
*/
function puterVarmi() {
  return typeof window !== "undefined" && !!window.puter;
}

/* Puter nesnesini güvenli şekilde getirir */
function puterGetir() {
  if (!puterVarmi()) {
    throw new Error(
      "Puter.js yüklenmemiş. Önce https://js.puter.com/v2/ script'ini eklemelisin."
    );
  }

  if (!window.puter.workers || typeof window.puter.workers.exec !== "function") {
    throw new Error(
      "Puter Workers API bulunamadı. puter.workers.exec erişilebilir olmalı."
    );
  }

  return window.puter;
}

/* URL birleştirme helper'ı
   Amaç:
   - sonda / olsa da olmasa da düzgün yol üretmek
   - başta / olsa da olmasa da düzgün yol üretmek
*/
function urlBirlestir(baseUrl, path = "") {
  const temizBase = String(baseUrl || "").replace(/\/+$/, "");
  const temizPath = String(path || "").replace(/^\/+/, "");

  return temizPath ? `${temizBase}/${temizPath}` : temizBase;
}

/* Response içeriğini akıllı okumaya çalışır
   - JSON ise json()
   - değilse text()
*/
async function responseGovdesiniOku(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

/* Hata mesajını olabildiğince anlaşılır çıkarır */
function hataMesajiCikar(payload, fallback = "İstek başarısız oldu.") {
  if (!payload) return fallback;

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return fallback;
}

/* Zaman aşımı için AbortController üretir */
function timeoutControllerOlustur(timeoutMs = VARSAYILAN_TIMEOUT_MS) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort(new Error("İstek zaman aşımına uğradı."));
  }, timeoutMs);

  return { controller, timer };
}

/* Standart hata nesnesi üretir
   UI tarafında kolay yönetilsin diye detaylı dönüyoruz
*/
function detayliHataOlustur({
  message,
  status = 0,
  worker = null,
  endpoint = null,
  payload = null,
  cause = null,
}) {
  const error = new Error(message);
  error.status = status;
  error.worker = worker;
  error.endpoint = endpoint;
  error.payload = payload;
  error.cause = cause;
  return error;
}

/* ---------------------------------------------------------------------------
   3) EN TEMEL WORKER ÇAĞRISI
   --------------------------------------------------------------------------- */

/* Bu dosyanın kalbi burada.
   Bütün worker istekleri sonunda bu fonksiyona gelir.

   NE YAPAR?
   - Puter SDK var mı kontrol eder
   - worker URL + path birleştirir
   - body varsa JSON'a çevirir
   - puter.workers.exec() ile çağrı yapar
   - Response'u okur
   - hata varsa anlamlı Error fırlatır
   - başarıysa JSON/text ne geldiyse döndürür
*/
export async function workerCagir({
  workerUrl,
  path = "",
  method = "GET",
  body = undefined,
  headers = {},
  timeoutMs = VARSAYILAN_TIMEOUT_MS,
}) {
  const puter = puterGetir();
  const endpoint = urlBirlestir(workerUrl, path);

  const finalHeaders = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  const requestInit = {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const { controller, timer } = timeoutControllerOlustur(timeoutMs);

  try {
    /* Not:
       puter.workers.exec resmi olarak workerURL + RequestInit alır.
       Dönen değer standart fetch benzeri Response objesidir.
    */
    const response = await puter.workers.exec(endpoint, {
      ...requestInit,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const payload = await responseGovdesiniOku(response);

    if (!response.ok) {
      throw detayliHataOlustur({
        message: hataMesajiCikar(payload, `İstek başarısız oldu. HTTP ${response.status}`),
        status: response.status,
        worker: workerUrl,
        endpoint,
        payload,
      });
    }

    return payload;
  } catch (error) {
    clearTimeout(timer);

    if (error?.name === "AbortError") {
      throw detayliHataOlustur({
        message: "Worker isteği zaman aşımına uğradı.",
        worker: workerUrl,
        endpoint,
        cause: error,
      });
    }

    /* Zaten kendi detaylı hatamızsa aynen geçir */
    if (error?.worker || error?.status || error?.payload) {
      throw error;
    }

    throw detayliHataOlustur({
      message: error?.message || "Worker çağrısı başarısız oldu.",
      worker: workerUrl,
      endpoint,
      cause: error,
    });
  }
}

/* Kısa yardımcılar */
export function getIste({ workerUrl, path = "", headers = {}, timeoutMs } = {}) {
  return workerCagir({
    workerUrl,
    path,
    method: "GET",
    headers,
    timeoutMs,
  });
}

export function postIste({
  workerUrl,
  path = "",
  body = {},
  headers = {},
  timeoutMs,
} = {}) {
  return workerCagir({
    workerUrl,
    path,
    method: "POST",
    body,
    headers,
    timeoutMs,
  });
}

/* ---------------------------------------------------------------------------
   4) CHAT İŞLEMLERİ
   --------------------------------------------------------------------------- */

/* Sohbet isteği atar */
export async function chatIste({
  prompt,
  model = "gpt-5-nano",
  temperature,
  max_tokens,
  tools,
  timeoutMs,
} = {}) {
  return postIste({
    workerUrl: ANA_AI_WORKER,
    path: "/chat",
    timeoutMs,
    body: {
      prompt,
      model,
      temperature,
      max_tokens,
      tools,
    },
  });
}

/* Alias: daha okunaklı Türkçe isim isteyen yerlerde kullanılabilir */
export const sohbetEt = chatIste;

/* ---------------------------------------------------------------------------
   5) IMAGE İŞLEMLERİ
   --------------------------------------------------------------------------- */

/* Görsel üretir */
export async function gorselUret({
  prompt,
  provider,
  model,
  quality,
  ratio,
  width,
  height,
  aspect_ratio,
  steps,
  seed,
  negative_prompt,
  n,
  image_url,
  image_base64,
  input_image,
  input_image_mime_type,
  mask_image_url,
  mask_image_base64,
  test_mode,
  timeoutMs,
} = {}) {
  return postIste({
    workerUrl: ANA_AI_WORKER,
    path: "/image",
    timeoutMs,
    body: {
      prompt,
      provider,
      model,
      quality,
      ratio,
      width,
      height,
      aspect_ratio,
      steps,
      seed,
      negative_prompt,
      n,
      image_url,
      image_base64,
      input_image,
      input_image_mime_type,
      mask_image_url,
      mask_image_base64,
      test_mode,
    },
  });
}

/* İsteğe bağlı alias */
export const resimUret = gorselUret;

/* ---------------------------------------------------------------------------
   6) TTS İŞLEMLERİ
   --------------------------------------------------------------------------- */

/* Metni sese çevirir */
export async function sesiUret({
  text,
  provider,
  model,
  voice,
  engine,
  language,
  timeoutMs,
} = {}) {
  return postIste({
    workerUrl: ANA_AI_WORKER,
    path: "/tts",
    timeoutMs,
    body: {
      text,
      provider,
      model,
      voice,
      engine,
      language,
    },
  });
}

/* Alias */
export const ttsIste = sesiUret;

/* ---------------------------------------------------------------------------
   7) VIDEO İŞLEMLERİ
   --------------------------------------------------------------------------- */

/* Metinden video üretir */
export async function videoUret({
  prompt,
  provider = "openai",
  model = "sora-2",
  seconds = 4,
  size,
  resolution,
  test_mode,
  timeoutMs = 180000,
} = {}) {
  return postIste({
    workerUrl: ANA_AI_WORKER,
    path: "/video",
    timeoutMs,
    body: {
      prompt,
      provider,
      model,
      seconds,
      size,
      resolution,
      test_mode,
    },
  });
}

/* Fotoğraftan video üretir */
export async function fotografaVideoUret({
  prompt,
  imageUrl,
  provider = "together",
  model,
  seconds = 4,
  width,
  height,
  fps,
  steps,
  guidance_scale,
  seed,
  output_format,
  output_quality,
  negative_prompt,
  metadata,
  timeoutMs = 180000,
} = {}) {
  return postIste({
    workerUrl: ANA_AI_WORKER,
    path: "/photo-to-video",
    timeoutMs,
    body: {
      prompt,
      imageUrl,
      provider,
      model,
      seconds,
      width,
      height,
      fps,
      steps,
      guidance_scale,
      seed,
      output_format,
      output_quality,
      negative_prompt,
      metadata,
    },
  });
}

/* Alias */
export const photoToVideoIste = fotografaVideoUret;

/* ---------------------------------------------------------------------------
   8) JOB STATUS İŞLEMLERİ
   --------------------------------------------------------------------------- */

/* POST ile job durumu getirir */
export async function isDurumuGetir(jobId, { timeoutMs } = {}) {
  return postIste({
    workerUrl: IS_DURUMU_WORKER,
    path: "/jobs/status",
    timeoutMs,
    body: { jobId },
  });
}

/* GET ile job durumu getirir
   Bazı yerlerde polling için daha rahat olabilir.
*/
export async function isDurumuGetirGet(jobId, { timeoutMs } = {}) {
  return getIste({
    workerUrl: IS_DURUMU_WORKER,
    path: `/jobs/status/${encodeURIComponent(jobId)}`,
    timeoutMs,
  });
}

/* Video veya photo-to-video sonucu polling ile beklemek için helper */
export async function isBiteneKadarBekle(jobId, {
  toplamBeklemeMs = 180000,
  aralikMs = 2500,
  getMode = false,
} = {}) {
  const baslangic = Date.now();

  while (Date.now() - baslangic < toplamBeklemeMs) {
    const sonuc = getMode
      ? await isDurumuGetirGet(jobId)
      : await isDurumuGetir(jobId);

    const status = sonuc?.status;

    if (status === "completed") {
      return sonuc;
    }

    if (status === "failed" || status === "canceled" || status === "not_found") {
      throw detayliHataOlustur({
        message: sonuc?.error || `İş başarısız oldu. Durum: ${status}`,
        status: 400,
        worker: IS_DURUMU_WORKER,
        endpoint: "/jobs/status",
        payload: sonuc,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, aralikMs));
  }

  throw detayliHataOlustur({
    message: "İş beklenen sürede tamamlanmadı.",
    worker: IS_DURUMU_WORKER,
    endpoint: "/jobs/status",
  });
}

/* ---------------------------------------------------------------------------
   9) DEPRECATED / YANLIŞ WORKER KORUMALARI
   --------------------------------------------------------------------------- */

/* Bu fonksiyonları özellikle ekliyoruz.
   Amaç:
   - yanlış worker kullanımını erkenden yakalamak
   - ekip içinde karışıklığı azaltmak
*/
export const YASAKLI_WORKERLAR = [
  "https://PUTER_OWNER_AI_BASE_URL.puter.work",
  "https://vite_api_base_url.puter.work",
];

/* Bir URL yanlış isimli worker mı kontrol eder */
export function yanlisWorkerMi(url) {
  return YASAKLI_WORKERLAR.includes(String(url || "").trim());
}

/* Güvenlik amaçlı doğrulama */
export function workerUrlDogrula(url) {
  if (yanlisWorkerMi(url)) {
    throw new Error(
      "Bu worker gerçek servis worker'ı değil. api-cagrilari.puter.work veya is-durumu.puter.work kullan."
    );
  }
  return true;
}

/* ---------------------------------------------------------------------------
   10) TEK NOKTADAN EXPORT EDİLEN YAPI
   --------------------------------------------------------------------------- */

/* İsteyen yerlerde toplu obje olarak da kullanılabilsin */
const workerApi = {
  ANA_AI_WORKER,
  IS_DURUMU_WORKER,
  VARSAYILAN_TIMEOUT_MS,

  workerCagir,
  getIste,
  postIste,

  chatIste,
  sohbetEt,

  gorselUret,
  resimUret,

  sesiUret,
  ttsIste,

  videoUret,
  fotografaVideoUret,
  photoToVideoIste,

  isDurumuGetir,
  isDurumuGetirGet,
  isBiteneKadarBekle,

  YASAKLI_WORKERLAR,
  yanlisWorkerMi,
  workerUrlDogrula,
};

export default workerApi;

/* ---------------------------------------------------------------------------
   11) HIZLI TEST / GELİŞTİRİCİ NOTLARI

   A) CHAT
   const r = await chatIste({ prompt: "Merhaba", model: "gpt-5-nano" });

   B) IMAGE
   const r = await gorselUret({ prompt: "Mavi arka planlı modern afiş" });

   C) TTS
   const r = await sesiUret({ text: "Merhaba dünya", voice: "alloy" });

   D) VIDEO
   const r = await videoUret({
     prompt: "Sinematik şehir manzarası",
     provider: "openai",
     model: "sora-2",
     seconds: 4
   });

   E) PHOTO TO VIDEO
   const r = await fotografaVideoUret({
     prompt: "Fotoğraftaki kişiyi hafifçe kameraya döndür",
     imageUrl: "https://ornek.com/foto.jpg"
   });

   F) JOB STATUS
   const r = await isDurumuGetir("job_xxx");
   const r2 = await isBiteneKadarBekle("job_xxx");

   --------------------------------------------------------------------------- */

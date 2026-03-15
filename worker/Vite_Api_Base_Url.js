/*
WORKER ADI:
https://vite_api_base_url.puter.work

NE İŞE YARAR?
- Bu da gerçek servis worker'ı değildir.
- İsmi frontend env değişkeni gibi görünüyor.
- O yüzden bunu da "deprecated / yönlendirme / uyarı" worker'ı yapıyoruz.

NEDEN?
- Sen bu worker’ı zaten oluşturmuşsun.
- Yanlışlıkla kullanılırsa doğru mimariyi anlatsın.
- Ama gerçek backend işini burada yapmıyoruz.
*//*
█████████████████████████████████████████████
1) BU DOSYA DA GERÇEK SERVİS WORKER'I DEĞİL, DEPRECATED UYARI WORKER'IDIR.
2) ADI, FRONTEND ENV DEĞİŞKENİ GİBİ GÖRÜNEN "vite_api_base_url" İSMİYLE TUTULMUŞTUR.
3) deprecated: true ALANIYLA YANLIŞ KULLANILMAMASI GEREKEN BİR ADRES OLDUĞU İŞARETLENİR.
4) useInstead ALANI, DOĞRU SERVİS OLARAK https://api-cagrilari.puter.work ADRESİNİ GÖSTERİR.
5) json() VE corsHeaders() YARDIMCILARI, RESPONSE VE CORS DAVRANIŞINI STANDARTLAŞTIRIR.
6) OPTIONS İSTEKLERİNDE 204 DÖNÜLEREK TARAYICI PRE-FLIGHT AKIŞI DESTEKLENİR.
7) GET / UÇ NOKTASI 410 DÖNÜP “BU WORKER GERÇEK API KÖKÜ DEĞİLDİR” MESAJI VERİR.
8) POST İSTEKLERİNDE DE AYNI MANTIKLA YANLIŞ WORKER ÇAĞRISI TESPİT EDİLİR.
9) routesToUse ALANI, CHAT, IMAGE, TTS, VIDEO, PHOTO-TO-VIDEO VE JOB STATUS İÇİN KULLANILMASI GEREKEN GERÇEK UÇLARI SAYAR.
10) KISACA: BU DOSYA, FRONTEND ENV GİBİ İSİMLENDİRİLMİŞ YANLIŞ BİR WORKER'I EĞİTİCİ YÖNLENDİRME SERVİSİNE DÖNÜŞTÜRÜR.
█████████████████████████████████████████████
*/

const DEPRECATED_WORKER_INFO = {
  worker: "vite_api_base_url",
  deprecated: true,
  useInstead: "https://api-cagrilari.puter.work",
  reason: "Bu isim frontend env değişkeni gibi görünüyor; gerçek servis adı olmamalı.",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "*";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-credentials": "true",
  };
}

router.options("/*page", ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
});

router.get("/", async ({ request }) => {
  return json(
    {
      ok: false,
      ...DEPRECATED_WORKER_INFO,
      message: "Bu worker artık gerçek API kökü olarak kullanılmamalıdır.",
      routesToUse: [
        "https://api-cagrilari.puter.work/chat",
        "https://api-cagrilari.puter.work/image",
        "https://api-cagrilari.puter.work/tts",
        "https://api-cagrilari.puter.work/video",
        "https://api-cagrilari.puter.work/photo-to-video",
        "https://is-durumu.puter.work/jobs/status",
      ],
    },
    410,
    corsHeaders(request)
  );
});

router.post("/*page", async ({ request }) => {
  return json(
    {
      ok: false,
      ...DEPRECATED_WORKER_INFO,
      message: "Yanlış worker çağrıldı. Gerçek istekleri api-cagrilari.puter.work adresine taşı.",
    },
    410,
    corsHeaders(request)
  );
});

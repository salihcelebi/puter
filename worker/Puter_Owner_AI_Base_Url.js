/*
█████████████████████████████████████████████
1) BU DOSYA, GERÇEK İŞ YÜKÜ TAŞIYAN BİR AI WORKER'I DEĞİL, DEPRECATED UYARI WORKER'IDIR.
2) worker ADI "PUTER_OWNER_AI_BASE_URL" OLARAK GEÇER VE İSMİN ENV DEĞİŞKENİ GİBİ GÖRÜNDÜĞÜ AÇIKÇA BELİRTİLİR.
3) deprecated: true BAYRAĞIYLA BU DOSYANIN ESKİ / YANLIŞ KULLANIMI İŞARETLENİR.
4) useInstead ALANI, DOĞRU ADRES OLARAK https://api-cagrilari.puter.work KULLANILMASINI SÖYLER.
5) json() YARDIMCISI, RESPONSE'LARI JSON FORMATINDA DÖNMEK İÇİN KULLANILIR.
6) corsHeaders(), origin TABANLI CORS BAŞLIKLARI ÜRETİR VE credentials: true DAVRANIŞINI DESTEKLER.
7) OPTIONS TALEPLERİNE 204 DÖNEREK PRE-FLIGHT İSTEKLERİ YUMUŞAK ŞEKİLDE KARŞILAR.
8) GET / UÇ NOKTASI, 410 STATUS İLE BU WORKER'IN ARTIK GERÇEK AI ÇAĞRILARI İÇİN KULLANILMAMASI GEREKTİĞİNİ ANLATIR.
9) POST İSTEKLERİNDE DE AYNI ŞEKİLDE 410 DÖNÜP İSTEMCİYİ DOĞRU WORKER'A TAŞIMASINI İSTER.
10) KISACA: BU DOSYA, YANLIŞ ADLANDIRILMIŞ ESKİ WORKER'I GÜVENLİ BİR UYARI VE YÖNLENDİRME KAPISINA ÇEVİRİR.
█████████████████████████████████████████████
*/
/*
WORKER ADI:
https://PUTER_OWNER_AI_BASE_URL.puter.work

NE İŞE YARAR?
- Bu worker gerçek servis worker'ı değildir.
- İsmi env değişkeni gibi olduğu için mimariyi karıştırır.
- O yüzden bunu "deprecated / yönlendirme / uyarı" worker'ı olarak kullanıyoruz.

NEDEN BÖYLE YAPIYORUZ?
- Sen bu worker’ı zaten oluşturmuşsun.
- Tamamen boşa gitmesin diye, yanlış kullanım olursa doğru adrese yönlendirsin.
- Ama yeni geliştirmede bunun üstüne gerçek iş yükü bindirmiyoruz.
*/

const DEPRECATED_WORKER_INFO = {
  worker: "PUTER_OWNER_AI_BASE_URL",
  deprecated: true,
  useInstead: "https://api-cagrilari.puter.work",
  reason: "Bu isim servis adı değil, env değişken adı gibi görünüyor.",
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
      message: "Bu worker artık gerçek AI çağrıları için kullanılmamalıdır.",
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

/*
Bu route, yanlışlıkla bu worker’a POST atan istemcilere açık uyarı verir.
*/
router.post("/*page", async ({ request }) => {
  return json(
    {
      ok: false,
      ...DEPRECATED_WORKER_INFO,
      message: "Yanlış worker çağrıldı. Gerçek çağrıları api-cagrilari.puter.work adresine taşı.",
    },
    410,
    corsHeaders(request)
  );
});

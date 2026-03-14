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
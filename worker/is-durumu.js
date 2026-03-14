/*
WORKER ADI:
https://is-durumu.puter.work

NE İŞE YARAR?
- Bu worker, video ve photo-to-video iş kayıtlarını okumak için kullanılır.
- Ana worker KV’ye job kaydı yazar.
- Bu worker o kaydı okur ve frontend’e temiz bir status yanıtı verir.

NEDEN AYRI WORKER?
- Mimariyi sade ayırmak için:
  1) üretim/çalıştırma worker’ı
  2) durum/polling worker’ı

Bu sayede UI tarafında "iş durumu sor" çağrıları ayrı bir yerden yönetilir.
*/

const APP_INFO = {
    worker: "is-durumu",
    version: "1.0.0",
    purpose: "Job durumlarını KV üzerinden okur.",
  };
  
  const JOB_PREFIX = "ai_job:";
  
  /* -------------------------------------------------------
     ORTAK YARDIMCI FONKSİYONLAR
     ------------------------------------------------------- */
  
  function nowIso() {
    return new Date().toISOString();
  }
  
  function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...extraHeaders,
      },
    });
  }
  
  async function readJson(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
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
  
  async function getJob(jobId) {
    const raw = await me.puter.kv.get(`${JOB_PREFIX}${jobId}`);
    if (!raw) return null;
  
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  
  /* -------------------------------------------------------
     OPTIONS / ROOT / HEALTH
     ------------------------------------------------------- */
  
  router.options("/*page", ({ request }) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  });
  
  router.get("/", async ({ request }) => {
    return json(
      {
        ok: true,
        ...APP_INFO,
        time: nowIso(),
        routes: [
          "POST /jobs/status",
          "GET /jobs/status/:jobId",
        ],
        notes: [
          "Bu worker yalnızca KV üzerindeki job kayıtlarını okur.",
          "Gerçek üretim çağrıları api-cagrilari.puter.work üzerinde yapılır.",
        ],
      },
      200,
      corsHeaders(request)
    );
  });
  
  router.get("/health", async ({ request }) => {
    return json(
      {
        ok: true,
        worker: APP_INFO.worker,
        version: APP_INFO.version,
        time: nowIso(),
      },
      200,
      corsHeaders(request)
    );
  });
  
  /* -------------------------------------------------------
     POST /jobs/status
     ------------------------------------------------------- */
  
  /*
  Beklenen body örneği:
  {
    "jobId": "job_123_abc"
  }
  */
  router.post("/jobs/status", async ({ request }) => {
    const body = await readJson(request);
    const jobId = String(body.jobId || "").trim();
  
    if (!jobId) {
      return json(
        {
          ok: false,
          error: "jobId zorunludur.",
        },
        400,
        corsHeaders(request)
      );
    }
  
    const job = await getJob(jobId);
  
    if (!job) {
      return json(
        {
          ok: false,
          jobId,
          status: "not_found",
          error: "Job bulunamadı.",
        },
        404,
        corsHeaders(request)
      );
    }
  
    return json(
      {
        ok: true,
        jobId,
        status: job.status,
        feature: job.feature,
        outputUrl: job.outputUrl || null,
        error: job.error || null,
        job,
      },
      200,
      corsHeaders(request)
    );
  });
  
  /* -------------------------------------------------------
     GET /jobs/status/:jobId
     ------------------------------------------------------- */
  
  /*
  Bu route, polling yapmak isteyen istemci için daha rahat olabilir.
  Örnek:
  GET /jobs/status/job_123_abc
  */
  router.get("/jobs/status/:jobId", async ({ request, params }) => {
    const jobId = String(params.jobId || "").trim();
  
    if (!jobId) {
      return json(
        {
          ok: false,
          error: "jobId zorunludur.",
        },
        400,
        corsHeaders(request)
      );
    }
  
    const job = await getJob(jobId);
  
    if (!job) {
      return json(
        {
          ok: false,
          jobId,
          status: "not_found",
          error: "Job bulunamadı.",
        },
        404,
        corsHeaders(request)
      );
    }
  
    return json(
      {
        ok: true,
        jobId,
        status: job.status,
        feature: job.feature,
        outputUrl: job.outputUrl || null,
        error: job.error || null,
        job,
      },
      200,
      corsHeaders(request)
    );
  });
  
  /* -------------------------------------------------------
     İSTEĞE BAĞLI YARDIMCI ROUTE
     ------------------------------------------------------- */
  
  /*
  Bu route gerçek cancel işlemi yapmaz.
  Sadece "şimdilik desteklenmiyor" diyerek gelecekteki genişleme için yer açar.
  İstersen bunu hiç eklemeyebilirsin; burada bilinçli olarak koyuyoruz.
  */
  router.post("/jobs/cancel", async ({ request }) => {
    const body = await readJson(request);
  
    return json(
      {
        ok: false,
        feature: "jobs/cancel",
        jobId: body.jobId || null,
        error: "Bu sürümde gerçek cancel mekanizması kurulmadı.",
        note: "İstersen sonraki aşamada provider-native cancel desteği eklenebilir.",
      },
      501,
      corsHeaders(request)
    );
  });
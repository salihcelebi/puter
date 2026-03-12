/* ============================================================================
   DOSYA ADI: src/lib/workerDiagnostics.js

   NE İŞE YARAR?
   - Puter SDK gerçekten yüklenmiş mi kontrol eder.
   - puter.workers.exec erişilebilir mi kontrol eder.
   - Ana worker ve job-status worker canlı mı test eder.
   - Deprecated worker'lar beklenen uyarıyı veriyor mu kontrol eder.
   - Sonuçları tek nesnede toplar.

   NASIL KULLANILIR?
   ----------------------------------------------------------------
   import { tumWorkerTestleriniCalistir } from "./lib/workerDiagnostics";

   const rapor = await tumWorkerTestleriniCalistir();
   console.log("WORKER TEST RAPORU:", rapor);
   ----------------------------------------------------------------
   ============================================================================ */

import {
  ANA_AI_WORKER,
  IS_DURUMU_WORKER,
  YASAKLI_WORKERLAR,
} from "./workerApi";

/* Basit JSON parse yardımcı */
async function govdeOku(response) {
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
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

/* Puter var mı? */
export function puterHazirMi() {
  return typeof window !== "undefined" && !!window.puter;
}

/* workers.exec var mı? */
export function workersExecHazirMi() {
  return (
    typeof window !== "undefined" &&
    !!window.puter &&
    !!window.puter.workers &&
    typeof window.puter.workers.exec === "function"
  );
}

/* Tek endpoint testi */
export async function workerEndpointTestEt(url, options = {}) {
  const sonuc = {
    url,
    ok: false,
    status: null,
    payload: null,
    error: null,
  };

  try {
    if (!workersExecHazirMi()) {
      throw new Error("Puter SDK veya puter.workers.exec hazır değil.");
    }

    const response = await window.puter.workers.exec(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await govdeOku(response);

    sonuc.ok = response.ok;
    sonuc.status = response.status;
    sonuc.payload = payload;
    return sonuc;
  } catch (error) {
    sonuc.error = error?.message || "Bilinmeyen hata";
    return sonuc;
  }
}

/* Ana worker testleri */
export async function anaWorkerTestleri() {
  return {
    root: await workerEndpointTestEt(ANA_AI_WORKER),
    health: await workerEndpointTestEt(`${ANA_AI_WORKER}/health`),
  };
}

/* İş durumu worker testleri */
export async function isDurumuWorkerTestleri() {
  return {
    root: await workerEndpointTestEt(IS_DURUMU_WORKER),
    health: await workerEndpointTestEt(`${IS_DURUMU_WORKER}/health`),
    fakeJobStatusPost: await workerEndpointTestEt(`${IS_DURUMU_WORKER}/jobs/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        jobId: "job_test_fake_123",
      },
    }),
  };
}

/* Deprecated worker testleri */
export async function deprecatedWorkerTestleri() {
  const sonuclar = [];

  for (const workerUrl of YASAKLI_WORKERLAR) {
    const sonuc = await workerEndpointTestEt(workerUrl);
    sonuclar.push({
      workerUrl,
      sonuc,
    });
  }

  return sonuclar;
}

/* Tüm testleri tek seferde çalıştır */
export async function tumWorkerTestleriniCalistir() {
  const rapor = {
    zaman: new Date().toISOString(),
    puterHazir: puterHazirMi(),
    workersExecHazir: workersExecHazirMi(),
    anaWorker: null,
    isDurumuWorker: null,
    deprecatedWorkerlar: null,
    genelDurum: "unknown",
  };

  if (!rapor.puterHazir) {
    rapor.genelDurum = "failed";
    rapor.hata = "window.puter bulunamadı. Puter script muhtemelen yüklenmemiş.";
    return rapor;
  }

  if (!rapor.workersExecHazir) {
    rapor.genelDurum = "failed";
    rapor.hata = "puter.workers.exec bulunamadı. Puter Workers API hazır değil.";
    return rapor;
  }

  rapor.anaWorker = await anaWorkerTestleri();
  rapor.isDurumuWorker = await isDurumuWorkerTestleri();
  rapor.deprecatedWorkerlar = await deprecatedWorkerTestleri();

  const anaOk =
    rapor.anaWorker?.root?.ok === true ||
    rapor.anaWorker?.health?.ok === true;

  const durumOk =
    rapor.isDurumuWorker?.root?.ok === true ||
    rapor.isDurumuWorker?.health?.ok === true;

  rapor.genelDurum = anaOk && durumOk ? "passed" : "partial_or_failed";

  return rapor;
}

export default {
  puterHazirMi,
  workersExecHazirMi,
  workerEndpointTestEt,
  anaWorkerTestleri,
  isDurumuWorkerTestleri,
  deprecatedWorkerTestleri,
  tumWorkerTestleriniCalistir,
};

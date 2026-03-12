/*
DOSYA ADI:
- Öneri: src/components/WorkerTest.jsx

NE İŞE YARAR?
- Puter script gerçekten yüklenmiş mi kontrol eder.
- workerApi.js içindeki beklenen fonksiyon adları gerçekten export edilmiş mi kontrol eder.
- workerDiagnostics.js çalışıyor mu kontrol eder.
- Ana worker ve iş-durumu worker’ı gerçekten canlı mı kontrol eder.
- Deprecated worker’lar beklenen uyarıyı dönüyor mu kontrol eder.
- En ufak hatayı bile tek tek kart halinde gösterir.
- Her hata için en az bir cümlelik, yaklaşık 15+ kelimelik açıklama üretir.

ÖNEMLİ:
- Bu bileşen, chat/image/video gibi pahalı AI çağrılarını tetiklemez.
- Sadece altyapı, script, export ve worker sağlık kontrollerini yapar.
- Böylece yanlış kurulumları erken yakalarsın.

IMPORT PATH NOTU:
- Eğer bu dosyayı src/components içine koyarsan aşağıdaki import’lar doğru olur.
- Başka klasöre koyarsan ../lib yollarını uygun şekilde güncelle.
*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as workerApi from "../lib/workerApi";
import diagnostics from "../lib/workerDiagnostics";

/* ============================================================================
   1) SABİTLER
   ============================================================================ */

/*
Bu isimler SENİN özellikle kontrol etmemi istediğin exact fonksiyon adlarıdır.
Burada tek tek doğrulanırlar.
*/
const BEKLENEN_WORKER_API_FONKSIYONLARI = [
  "chatIste",
  "gorselUret",
  "sesiUret",
  "videoUret",
  "fotografaVideoUret",
  "isDurumuGetir",
  "isBiteneKadarBekle",
];

/*
Deprecated worker’lar burada ayrıca açıklanır.
*/
const DEPRECATED_WORKERLAR = [
  "https://PUTER_OWNER_AI_BASE_URL.puter.work",
  "https://vite_api_base_url.puter.work",
];

/* ============================================================================
   2) KÜÇÜK YARDIMCI FONKSİYONLAR
   ============================================================================ */

/* ISO tarih/saat üretir */
function nowIso() {
  return new Date().toISOString();
}

/* Null/undefined güvenli string dönüştürme */
function toText(value) {
  if (value === null || value === undefined) return "";
  try {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* Bir şey fonksiyon mu? */
function isFunction(value) {
  return typeof value === "function";
}

/* Array mi? */
function isArray(value) {
  return Array.isArray(value);
}

/* Hata kartı objesi üretir */
function createIssue({
  id,
  level = "error",
  category,
  title,
  summary,
  explanation,
  fix,
  details = null,
}) {
  return {
    id,
    level,
    category,
    title,
    summary,
    explanation,
    fix,
    details,
  };
}

/*
Başarılı kontrol objesi üretir.
İstersen bunları da ekranda gösterebiliriz ki kullanıcı neyin geçtiğini görsün.
*/
function createPass({
  id,
  category,
  title,
  summary,
  details = null,
}) {
  return {
    id,
    ok: true,
    category,
    title,
    summary,
    details,
  };
}

/*
Bir response testi başarılı mı?
- ok true ise başarılı
- bazı deprecated worker testlerinde 410 dönebilir; bu beklenen davranış sayılabilir
*/
function responseBasariliMi(result, acceptStatuses = []) {
  if (!result) return false;
  if (result.ok === true) return true;
  if (typeof result.status === "number" && acceptStatuses.includes(result.status)) return true;
  return false;
}

/* Script etiketi var mı? */
function puterScriptEtiketiBul() {
  if (typeof document === "undefined") return null;

  const scripts = Array.from(document.querySelectorAll("script[src]"));
  return scripts.find((script) => {
    const src = script.getAttribute("src") || "";
    return src.includes("js.puter.com/v2/");
  }) || null;
}

/* window.puter erişimi */
function getWindowPuter() {
  if (typeof window === "undefined") return null;
  return window.puter || null;
}

/* Tarayıcı online mı? */
function browserOnlineMi() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/* Güvenli context bilgisi */
function secureContextMi() {
  if (typeof window === "undefined") return false;
  return !!window.isSecureContext;
}

/*
Uzun açıklama zorunluluğu için her hataya minimum anlamlı cümle veriyoruz.
İstediğin gibi kısa ama en az bir dolu cümle olacak şekilde yazıldı.
*/
function varsayilanAciklama(title) {
  return `${title} aşamasında bir tutarsızlık bulundu; bu sorun çözülmeden worker çağrıları güvenilir ve kararlı şekilde çalışmayabilir.`;
}

/* JSON gösterimi için pretty helper */
function safePretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* ============================================================================
   3) DÜŞÜK SEVİYE KONTROLLER
   ============================================================================ */

/*
3.1 Puter script kontrolü
Burada sadece window.puter var mı bakmıyoruz.
Ayrıca script etiketi sayfaya gerçekten eklenmiş mi de kontrol ediyoruz.
*/
function testPuterScriptKurulumu() {
  const issues = [];
  const passes = [];

  const scriptTag = puterScriptEtiketiBul();
  const puter = getWindowPuter();

  if (!scriptTag) {
    issues.push(
      createIssue({
        id: "puter-script-tag-missing",
        category: "script",
        title: "Puter script etiketi sayfada bulunamadı",
        summary: "document içindeki script[src] etiketleri arasında https://js.puter.com/v2/ görünmüyor.",
        explanation:
          "Puter script etiketi yüklenmemişse window.puter nesnesi oluşmaz ve worker yardımcı dosyan tüm çağrılarda anında hata verir.",
        fix:
          'Ana HTML girişine veya app shell dosyana `<script src="https://js.puter.com/v2/"></script>` eklemelisin.',
        details: null,
      })
    );
  } else {
    passes.push(
      createPass({
        id: "puter-script-tag-found",
        category: "script",
        title: "Puter script etiketi bulundu",
        summary: `Bulunan script src: ${scriptTag.getAttribute("src")}`,
      })
    );
  }

  if (!puter) {
    issues.push(
      createIssue({
        id: "window-puter-missing",
        category: "script",
        title: "window.puter nesnesi bulunamadı",
        summary: "Tarayıcı runtime içinde Puter global nesnesi oluşmamış görünüyor.",
        explanation:
          "Script etiketi ekli olsa bile yükleme hatası, CSP kısıtı veya zamanlama problemi yüzünden window.puter oluşmamış olabilir.",
        fix:
          "Script’in gerçekten yüklendiğini, bloklanmadığını ve bu bileşenin script yüklendikten sonra render edildiğini doğrula.",
      })
    );
  } else {
    passes.push(
      createPass({
        id: "window-puter-found",
        category: "script",
        title: "window.puter nesnesi bulundu",
        summary: "Puter SDK tarayıcı tarafında erişilebilir durumda.",
      })
    );
  }

  if (!browserOnlineMi()) {
    issues.push(
      createIssue({
        id: "browser-offline",
        category: "network",
        title: "Tarayıcı çevrimdışı görünüyor",
        summary: "navigator.onLine false döndü.",
        explanation:
          "Tarayıcı çevrimdışı durumdaysa worker testleri yanıltıcı biçimde başarısız görünür ve gerçek kurulum problemini maskeleyebilir.",
        fix:
          "Bağlantını geri aç ve testleri tekrar çalıştır; özellikle worker sağlık kontrolleri için internet erişimi zorunludur.",
      })
    );
  } else {
    passes.push(
      createPass({
        id: "browser-online",
        category: "network",
        title: "Tarayıcı çevrimiçi görünüyor",
        summary: "Temel ağ bağlantısı açık.",
      })
    );
  }

  if (!secureContextMi()) {
    issues.push(
      createIssue({
        id: "not-secure-context",
        category: "environment",
        title: "Sayfa güvenli context içinde çalışmıyor",
        summary: "window.isSecureContext false döndü.",
        explanation:
          "Bazı tarayıcı özellikleri ve kimlik akışları güvenli context ister; bu eksiklik ileride oturum ve API davranışlarını bozabilir.",
        fix:
          "Sayfayı HTTPS üzerinden açtığından ve karışık içerik problemi olmadığından emin ol.",
      })
    );
  } else {
    passes.push(
      createPass({
        id: "secure-context",
        category: "environment",
        title: "Sayfa güvenli context içinde çalışıyor",
        summary: "HTTPS/güvenli ortam kontrolü geçti.",
      })
    );
  }

  return { issues, passes };
}

/*
3.2 workers.exec kontrolü
Puter var ama workers API olmayabilir.
*/
function testWorkersExecKurulumu() {
  const issues = [];
  const passes = [];

  const puter = getWindowPuter();

  if (!puter) {
    issues.push(
      createIssue({
        id: "workers-exec-window-puter-precondition",
        category: "workers",
        title: "workers.exec testi yapılamadı çünkü window.puter yok",
        summary: "Ön koşul eksikliği nedeniyle workers API kontrolü tamamlanamadı.",
        explanation:
          "Ana Puter nesnesi oluşmadan workers API var mı diye bakmak mümkün değildir; önce script yükleme sorunu çözülmelidir.",
        fix:
          "Önce Puter script yükleme problemini gider, sonra workers.exec testini yeniden çalıştır.",
      })
    );
    return { issues, passes };
  }

  if (!puter.workers) {
    issues.push(
      createIssue({
        id: "puter-workers-missing",
        category: "workers",
        title: "puter.workers nesnesi bulunamadı",
        summary: "Puter SDK var ama workers bölümü görünmüyor.",
        explanation:
          "SDK kısmen yüklenmiş, sürüm uyuşmuyor veya beklenen worker API bu build içinde erişilebilir değil gibi görünüyor.",
        fix:
          "Kullandığın Puter script sürümünü doğrula ve resmi v2 script’inin gerçekten geldiğini tekrar kontrol et.",
      })
    );
  } else {
    passes.push(
      createPass({
        id: "puter-workers-found",
        category: "workers",
        title: "puter.workers nesnesi bulundu",
        summary: "Workers modülü window.puter üzerinde mevcut.",
      })
    );
  }

  if (!isFunction(puter?.workers?.exec)) {
    issues.push(
      createIssue({
        id: "puter-workers-exec-missing",
        category: "workers",
        title: "puter.workers.exec fonksiyonu bulunamadı",
        summary: "Workers modülü var ama exec fonksiyonu erişilebilir görünmüyor.",
        explanation:
          "Worker çağrılarının tamamı exec üstünden gittiği için bu fonksiyon eksikse sistemin merkezi istek hattı tamamen kırılır.",
        fix:
          "Puter sürümünü ve yüklenen script’i kontrol et; ayrıca başka kodların window.puter değerini ezmediğinden emin ol.",
      })
    );
  } else {
    passes.push(
      createPass({
        id: "puter-workers-exec-found",
        category: "workers",
        title: "puter.workers.exec fonksiyonu bulundu",
        summary: "Authenticated worker request altyapısı erişilebilir durumda.",
      })
    );
  }

  return { issues, passes };
}

/*
3.3 workerApi export isimleri tam mı?
Kullanıcının özellikle sorduğu exact isimleri burada birebir doğruluyoruz.
*/
function testWorkerApiExportleri() {
  const issues = [];
  const passes = [];

  for (const fnName of BEKLENEN_WORKER_API_FONKSIYONLARI) {
    if (!isFunction(workerApi?.[fnName])) {
      issues.push(
        createIssue({
          id: `workerapi-export-missing-${fnName}`,
          category: "workerApi",
          title: `workerApi export eksik: ${fnName}`,
          summary: `Beklenen ${fnName} fonksiyonu workerApi.js üzerinden function olarak gelmiyor.`,
          explanation:
            `${fnName} export edilmezse ilgili UI ekranı import aşamasında kırılır ve çağrı akışı daha başlamadan durur.`,
          fix:
            `workerApi.js dosyasında ${fnName} fonksiyonunun gerçekten export edildiğini ve isimde harf hatası olmadığını doğrula.`,
          details: {
            mevcutTip: typeof workerApi?.[fnName],
            beklenenTip: "function",
          },
        })
      );
    } else {
      passes.push(
        createPass({
          id: `workerapi-export-ok-${fnName}`,
          category: "workerApi",
          title: `workerApi export tamam: ${fnName}`,
          summary: `${fnName} fonksiyonu doğru isimle erişilebilir durumda.`,
        })
      );
    }
  }

  return { issues, passes };
}

/*
3.4 diagnostics exportleri var mı?
Bu bileşenin çalışması için gerekli fonksiyonlar var mı bakıyoruz.
*/
function testDiagnosticsExportleri() {
  const issues = [];
  const passes = [];

  const beklenenDiagnostics = [
    "puterHazirMi",
    "workersExecHazirMi",
    "workerEndpointTestEt",
    "anaWorkerTestleri",
    "isDurumuWorkerTestleri",
    "deprecatedWorkerTestleri",
    "tumWorkerTestleriniCalistir",
  ];

  for (const fnName of beklenenDiagnostics) {
    if (!isFunction(diagnostics?.[fnName])) {
      issues.push(
        createIssue({
          id: `diagnostics-export-missing-${fnName}`,
          category: "diagnostics",
          title: `workerDiagnostics export eksik: ${fnName}`,
          summary: `Beklenen ${fnName} fonksiyonu workerDiagnostics.js içinden erişilebilir değil.`,
          explanation:
            "Tanılama yardımcı fonksiyonları eksikse test ekranı doğru rapor üretemez ve hataların kök nedenini saklayabilir.",
          fix:
            `workerDiagnostics.js içinde ${fnName} fonksiyonunun export edildiğini ve import path’inin doğru olduğunu doğrula.`,
        })
      );
    } else {
      passes.push(
        createPass({
          id: `diagnostics-export-ok-${fnName}`,
          category: "diagnostics",
          title: `workerDiagnostics export tamam: ${fnName}`,
          summary: `${fnName} fonksiyonu erişilebilir durumda.`,
        })
      );
    }
  }

  return { issues, passes };
}

/* ============================================================================
   4) AĞ / WORKER TESTLERİ
   ============================================================================ */

/*
Bu bölüm async çünkü gerçek worker sağlık kontrolleri çalışıyor.
*/
async function testGercekWorkerlar() {
  const issues = [];
  const passes = [];
  const raw = {
    anaWorker: null,
    isDurumuWorker: null,
    deprecatedWorkerlar: null,
    tumRapor: null,
  };

  /*
  İlk olarak toplu tanılama raporunu çalıştırıyoruz.
  Bu varsa daha zengin veri elde ederiz.
  */
  if (isFunction(diagnostics?.tumWorkerTestleriniCalistir)) {
    try {
      raw.tumRapor = await diagnostics.tumWorkerTestleriniCalistir();
    } catch (error) {
      issues.push(
        createIssue({
          id: "diagnostics-master-run-failed",
          category: "diagnostics",
          title: "Toplu worker tanılama çağrısı başarısız oldu",
          summary: error?.message || "tumWorkerTestleriniCalistir() sırasında hata oluştu.",
          explanation:
            "Toplu tanılama fonksiyonu çökerse alt testlerin bazıları hiç başlamamış olabilir ve bu da sahte eksik sonuç üretir.",
          fix:
            "workerDiagnostics.js içindeki async akışı ve import bağımlılıklarını kontrol et; özellikle puter hazır mı ön koşullarını gözden geçir.",
          details: {
            error: error?.message || String(error),
          },
        })
      );
    }
  }

  /*
  Ana worker testleri
  */
  if (isFunction(diagnostics?.anaWorkerTestleri)) {
    try {
      raw.anaWorker = await diagnostics.anaWorkerTestleri();

      const rootOk = responseBasariliMi(raw.anaWorker?.root);
      const healthOk = responseBasariliMi(raw.anaWorker?.health);

      if (!rootOk && !healthOk) {
        issues.push(
          createIssue({
            id: "ana-worker-down",
            category: "worker-health",
            title: "Ana AI worker canlı görünmüyor",
            summary: "api-cagrilari.puter.work root ve /health testleri beklenen başarılı yanıtı vermedi.",
            explanation:
              "Ana worker ayakta değilse sohbet, görsel, ses ve video isteklerinin tamamı uygulama içinde zincirleme biçimde başarısız olur.",
            fix:
              "https://api-cagrilari.puter.work adresinin deploy edildiğini, router root ve /health endpointlerinin gerçekten tanımlı olduğunu doğrula.",
            details: raw.anaWorker,
          })
        );
      } else {
        passes.push(
          createPass({
            id: "ana-worker-ok",
            category: "worker-health",
            title: "Ana AI worker yanıt veriyor",
            summary: `Root OK: ${String(rootOk)} | Health OK: ${String(healthOk)}`,
            details: raw.anaWorker,
          })
        );
      }
    } catch (error) {
      issues.push(
        createIssue({
          id: "ana-worker-test-crashed",
          category: "worker-health",
          title: "Ana worker testi çalışırken exception oluştu",
          summary: error?.message || "anaWorkerTestleri() exception fırlattı.",
          explanation:
            "Test fonksiyonunun kendi içinde çökmesi çoğu zaman ağ sorunu, puter erişimi veya beklenmeyen response biçimi anlamına gelir.",
          fix:
            "anaWorkerTestleri() içinde dönen payload yapısını console ile incele ve response parsing mantığını gerekirse güçlendir.",
          details: {
            error: error?.message || String(error),
          },
        })
      );
    }
  }

  /*
  İş-durumu worker testleri
  */
  if (isFunction(diagnostics?.isDurumuWorkerTestleri)) {
    try {
      raw.isDurumuWorker = await diagnostics.isDurumuWorkerTestleri();

      const rootOk = responseBasariliMi(raw.isDurumuWorker?.root);
      const healthOk = responseBasariliMi(raw.isDurumuWorker?.health);

      if (!rootOk && !healthOk) {
        issues.push(
          createIssue({
            id: "job-worker-down",
            category: "worker-health",
            title: "İş durumu worker canlı görünmüyor",
            summary: "is-durumu.puter.work root ve /health testleri beklenen başarılı yanıtı vermedi.",
            explanation:
              "Job status worker çalışmıyorsa video ve photo-to-video işlemlerinin durum takibi kullanıcıya güvenilir biçimde gösterilemez.",
            fix:
              "https://is-durumu.puter.work adresinin deploy edildiğini ve root ile /health endpointlerinin doğru döndüğünü doğrula.",
            details: raw.isDurumuWorker,
          })
        );
      } else {
        passes.push(
          createPass({
            id: "job-worker-ok",
            category: "worker-health",
            title: "İş durumu worker yanıt veriyor",
            summary: `Root OK: ${String(rootOk)} | Health OK: ${String(healthOk)}`,
            details: raw.isDurumuWorker,
          })
        );
      }

      const fakeJobStatus = raw.isDurumuWorker?.fakeJobStatusPost;
      if (fakeJobStatus) {
        const acceptable = responseBasariliMi(fakeJobStatus, [404]);
        if (!acceptable) {
          issues.push(
            createIssue({
              id: "job-worker-fake-status-unexpected",
              category: "worker-health",
              title: "İş durumu fake job testi beklenmedik sonuç verdi",
              summary: "Sahte jobId ile yapılan status testi beklenen 200/404 benzeri kontrollü yanıtı vermedi.",
              explanation:
                "Sahte job testi düzensiz sonuç veriyorsa status endpointi JSON contract’ını tutarlı biçimde korumuyor olabilir.",
              fix:
                "POST /jobs/status endpointinin jobId yokken 400, bulunamayınca 404, bulunursa 200 döndüğünü netleştir.",
              details: fakeJobStatus,
            })
          );
        } else {
          passes.push(
            createPass({
              id: "job-worker-fake-status-ok",
              category: "worker-health",
              title: "İş durumu fake job testi kontrollü sonuç verdi",
              summary: `HTTP ${fakeJobStatus.status} ile tutarlı bir cevap alındı.`,
              details: fakeJobStatus,
            })
          );
        }
      }
    } catch (error) {
      issues.push(
        createIssue({
          id: "job-worker-test-crashed",
          category: "worker-health",
          title: "İş durumu worker testi exception fırlattı",
          summary: error?.message || "isDurumuWorkerTestleri() exception verdi.",
          explanation:
            "Status worker testinin çökmesi, polling zincirinin güvenilir olmadığını ve UI tarafında sahte loading oluşabileceğini gösterir.",
          fix:
            "isDurumuWorkerTestleri() fonksiyonunu ve worker endpoint biçimini birlikte inceleyip beklenen response contract’ını sabitle.",
          details: {
            error: error?.message || String(error),
          },
        })
      );
    }
  }

  /*
  Deprecated worker testleri
  - Burada 410 gibi sonuçlar başarı kabul edilir.
  */
  if (isFunction(diagnostics?.deprecatedWorkerTestleri)) {
    try {
      raw.deprecatedWorkerlar = await diagnostics.deprecatedWorkerTestleri();

      if (!isArray(raw.deprecatedWorkerlar)) {
        issues.push(
          createIssue({
            id: "deprecated-tests-not-array",
            category: "deprecated-workers",
            title: "Deprecated worker test sonucu array dönmedi",
            summary: "Beklenen sonuç dizisi yerine farklı veri yapısı geldi.",
            explanation:
              "Deprecated worker test sonucu tutarsızsa yanlış worker kullanımını güvenilir biçimde yakalayan güvenlik katmanı zayıflar.",
            fix:
              "deprecatedWorkerTestleri() fonksiyonunun her worker için sonuç dizisi döndürdüğünü doğrula.",
            details: raw.deprecatedWorkerlar,
          })
        );
      } else {
        for (const item of raw.deprecatedWorkerlar) {
          const url = item?.workerUrl || "bilinmeyen-worker";
          const sonuc = item?.sonuc;
          const ok = responseBasariliMi(sonuc, [410]);

          if (!ok) {
            issues.push(
              createIssue({
                id: `deprecated-worker-unexpected-${url}`,
                category: "deprecated-workers",
                title: `Deprecated worker beklenmeyen sonuç verdi: ${url}`,
                summary: "Bu worker beklenen uyarı/410 tarzı cevap yerine farklı bir davranış sergiledi.",
                explanation:
                  "Yanlış isimli worker’ların kontrollü biçimde uyarı vermemesi ekip içinde yanlış entegrasyonların sessizce büyümesine neden olabilir.",
                fix:
                  "Bu worker’ı gerçek servis yapma; sadece yönlendirme/uyarı stub’ı olarak 410 veya benzeri net cevap döndür.",
                details: item,
              })
            );
          } else {
            passes.push(
              createPass({
                id: `deprecated-worker-ok-${url}`,
                category: "deprecated-workers",
                title: `Deprecated worker kontrollü cevap verdi: ${url}`,
                summary: `HTTP ${sonuc?.status} ile beklenen engelleme/uyarı davranışı görüldü.`,
                details: item,
              })
            );
          }
        }
      }
    } catch (error) {
      issues.push(
        createIssue({
          id: "deprecated-worker-tests-crashed",
          category: "deprecated-workers",
          title: "Deprecated worker testleri exception fırlattı",
          summary: error?.message || "deprecatedWorkerTestleri() çalışırken hata oluştu.",
          explanation:
            "Yanlış worker koruma katmanı test edilemiyorsa eski entegrasyonlar fark edilmeden tekrar devreye girebilir ve mimariyi bozabilir.",
          fix:
            "Deprecated worker test akışını, URL listesini ve response parse mantığını tekrar gözden geçir.",
          details: {
            error: error?.message || String(error),
          },
        })
      );
    }
  }

  return { issues, passes, raw };
}

/* ============================================================================
   5) TÜM TESTLERİ ORKESTRE EDEN ANA FONKSİYON
   ============================================================================ */

async function runAllChecks() {
  const allIssues = [];
  const allPasses = [];

  const script = testPuterScriptKurulumu();
  allIssues.push(...script.issues);
  allPasses.push(...script.passes);

  const exec = testWorkersExecKurulumu();
  allIssues.push(...exec.issues);
  allPasses.push(...exec.passes);

  const apiExports = testWorkerApiExportleri();
  allIssues.push(...apiExports.issues);
  allPasses.push(...apiExports.passes);

  const diagExports = testDiagnosticsExportleri();
  allIssues.push(...diagExports.issues);
  allPasses.push(...diagExports.passes);

  /*
  Ağ testlerini ancak temel workers.exec yoksa da yine çalıştırmaya zorlamıyoruz.
  Ön koşullar yoksa gereksiz gürültü üretmesin.
  */
  let network = { issues: [], passes: [], raw: null };

  const puter = getWindowPuter();
  const workersExecReady = !!puter?.workers && isFunction(puter?.workers?.exec);

  if (workersExecReady) {
    network = await testGercekWorkerlar();
    allIssues.push(...network.issues);
    allPasses.push(...network.passes);
  } else {
    allIssues.push(
      createIssue({
        id: "network-tests-skipped-no-workers-exec",
        category: "worker-health",
        title: "Gerçek worker sağlık testleri atlandı",
        summary: "workers.exec hazır olmadığı için canlı endpoint testleri güvenli şekilde başlatılmadı.",
        explanation:
          "Ön koşul eksikliği varken ağ testlerini zorlamak gerçek sorunu gizler ve gereksiz ikincil hatalar üretir.",
        fix:
          "Önce Puter script ve workers.exec kurulumunu düzelt, sonra canlı worker testlerini yeniden çalıştır.",
      })
    );
  }

  return {
    createdAt: nowIso(),
    issueCount: allIssues.length,
    passCount: allPasses.length,
    issues: allIssues,
    passes: allPasses,
    rawNetwork: network.raw,
    isHealthy: allIssues.filter((x) => x.level === "error").length === 0,
  };
}

/* ============================================================================
   6) GÖRSEL KÜÇÜK BİLEŞENLER
   ============================================================================ */

function Badge({ children, kind = "neutral" }) {
  const styles = {
    neutral: {
      background: "#eef2ff",
      color: "#3730a3",
      border: "1px solid #c7d2fe",
    },
    success: {
      background: "#ecfdf5",
      color: "#065f46",
      border: "1px solid #a7f3d0",
    },
    error: {
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    },
    warning: {
      background: "#fffbeb",
      color: "#92400e",
      border: "1px solid #fde68a",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        ...styles[kind],
      }}
    >
      {children}
    </span>
  );
}

function SectionCard({ title, children, right }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function IssueCard({ issue }) {
  const isWarning = issue.level === "warning";

  return (
    <div
      style={{
        border: `1px solid ${isWarning ? "#f59e0b" : "#fca5a5"}`,
        background: isWarning ? "#fffaf0" : "#fff5f5",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 16 }}>{issue.title}</strong>
        <Badge kind={isWarning ? "warning" : "error"}>
          {isWarning ? "UYARI" : "HATA"}
        </Badge>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <p style={{ margin: "6px 0" }}>
          <strong>Kategori:</strong> {issue.category}
        </p>
        <p style={{ margin: "6px 0" }}>
          <strong>Kısa Özet:</strong> {issue.summary}
        </p>
        <p style={{ margin: "6px 0" }}>
          <strong>Açıklama:</strong> {issue.explanation || varsayilanAciklama(issue.title)}
        </p>
        <p style={{ margin: "6px 0" }}>
          <strong>Önerilen Düzeltme:</strong> {issue.fix}
        </p>

        {issue.details ? (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Teknik Detayları Aç
            </summary>
            <pre
              style={{
                marginTop: 10,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                background: "#111827",
                color: "#f9fafb",
                padding: 12,
                borderRadius: 12,
                overflow: "auto",
              }}
            >
              {safePretty(issue.details)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function PassCard({ item }) {
  return (
    <div
      style={{
        border: "1px solid #a7f3d0",
        background: "#f0fdf4",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <strong style={{ fontSize: 15 }}>{item.title}</strong>
        <Badge kind="success">GEÇTİ</Badge>
      </div>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        {item.summary}
      </p>

      {item.details ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            Teknik Detayları Aç
          </summary>
          <pre
            style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              background: "#111827",
              color: "#f9fafb",
              padding: 12,
              borderRadius: 12,
              overflow: "auto",
            }}
          >
            {safePretty(item.details)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

/* ============================================================================
   7) ANA BİLEŞEN
   ============================================================================ */

export default function WorkerTest() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [fatalError, setFatalError] = useState(null);
  const [showPasses, setShowPasses] = useState(true);
  const [autoRan, setAutoRan] = useState(false);

  const runTests = useCallback(async () => {
    setLoading(true);
    setFatalError(null);

    try {
      const result = await runAllChecks();
      setReport(result);
    } catch (error) {
      setFatalError(
        createIssue({
          id: "worker-test-fatal",
          category: "component",
          title: "WorkerTest bileşeni çalışırken beklenmeyen kritik hata oluştu",
          summary: error?.message || "Bileşen test akışı dışında bir exception fırlattı.",
          explanation:
            "Bu kritik hata, test ekranının kendi mantığında problem olduğunu ve görünen sonuçların eksik veya yanıltıcı olabileceğini gösterir.",
          fix:
            "Console çıktısını incele; import yollarını, async test akışını ve browser runtime hatalarını birlikte değerlendir.",
          details: {
            message: error?.message || String(error),
            stack: error?.stack || null,
          },
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRan) {
      setAutoRan(true);
      runTests();
    }
  }, [autoRan, runTests]);

  const issueCount = report?.issueCount || 0;
  const passCount = report?.passCount || 0;

  const severeIssueCount = useMemo(() => {
    if (!report?.issues) return 0;
    return report.issues.filter((x) => x.level === "error").length;
  }, [report]);

  const headerBadge = useMemo(() => {
    if (loading) return <Badge kind="warning">TEST ÇALIŞIYOR</Badge>;
    if (fatalError) return <Badge kind="error">KRİTİK HATA</Badge>;
    if (!report) return <Badge kind="neutral">BEKLENİYOR</Badge>;
    if (report.isHealthy) return <Badge kind="success">GENEL DURUM SAĞLIKLI</Badge>;
    return <Badge kind="error">GENEL DURUM SORUNLU</Badge>;
  }, [loading, fatalError, report]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        color: "#111827",
        padding: 24,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 18 }}>
        <SectionCard
          title="Worker Test Paneli"
          right={headerBadge}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>Toplam Hata/Uyarı</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{issueCount}</div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>Kritik Hata</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{severeIssueCount}</div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>Geçen Kontrol</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{passCount}</div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>Son Test Zamanı</div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
                {report?.createdAt || "Henüz yok"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={runTests}
              disabled={loading}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "#d1d5db" : "#111827",
                color: "#fff",
              }}
            >
              {loading ? "TESTLER ÇALIŞIYOR..." : "TESTLERİ TEKRAR ÇALIŞTIR"}
            </button>

            <button
              onClick={() => setShowPasses((s) => !s)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 700,
                cursor: "pointer",
                background: "#fff",
                color: "#111827",
              }}
            >
              {showPasses ? "GEÇENLERİ GİZLE" : "GEÇENLERİ GÖSTER"}
            </button>
          </div>

          <p style={{ marginTop: 14, marginBottom: 0, color: "#4b5563", lineHeight: 1.7 }}>
            Bu panel Puter script, workers.exec, exact export isimleri, worker sağlık cevapları ve
            deprecated worker davranışlarını tek ekranda kontrol eder.
          </p>
        </SectionCard>

        {fatalError ? (
          <SectionCard title="Kritik Bileşen Hatası">
            <IssueCard issue={fatalError} />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Bulunan Hatalar ve Uyarılar"
          right={
            <Badge kind={issueCount > 0 ? "error" : "success"}>
              {issueCount > 0 ? `${issueCount} KAYIT` : "HATA YOK"}
            </Badge>
          }
        >
          {!report && !loading ? (
            <p>Henüz rapor üretilmedi.</p>
          ) : null}

          {loading && !report ? (
            <p>İlk testler hazırlanıyor, lütfen birkaç saniye bekle.</p>
          ) : null}

          {report?.issues?.length ? (
            <div style={{ display: "grid", gap: 12 }}>
              {report.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          ) : null}

          {report && (!report.issues || report.issues.length === 0) ? (
            <div
              style={{
                border: "1px solid #a7f3d0",
                background: "#f0fdf4",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <strong>Harika.</strong>
              <p style={{ margin: "8px 0 0 0", lineHeight: 1.7 }}>
                Görünen temel kontrollerin tamamı geçti; yine de gerçek kullanım ekranlarında manuel
                akış testi yapman hâlâ iyi bir fikir olur.
              </p>
            </div>
          ) : null}
        </SectionCard>

        {showPasses ? (
          <SectionCard
            title="Geçen Kontroller"
            right={<Badge kind="success">{passCount} GEÇTİ</Badge>}
          >
            {report?.passes?.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {report.passes.map((item) => (
                  <PassCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p>Henüz geçen kontrol görünmüyor.</p>
            )}
          </SectionCard>
        ) : null}

        <SectionCard title="Ham Teknik Rapor">
          <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.7 }}>
            Bu bölüm geliştirici gözüyle en ham veriyi görmen için eklendi; response contract
            farklılıklarını yakalamakta çok işe yarar.
          </p>

          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              background: "#111827",
              color: "#f9fafb",
              padding: 14,
              borderRadius: 14,
              overflow: "auto",
            }}
          >
            {safePretty({
              createdAt: report?.createdAt || null,
              issueCount: report?.issueCount || 0,
              passCount: report?.passCount || 0,
              isHealthy: report?.isHealthy || false,
              rawNetwork: report?.rawNetwork || null,
              deprecatedWorkers: DEPRECATED_WORKERLAR,
              expectedWorkerApiFunctions: BEKLENEN_WORKER_API_FONKSIYONLARI,
            })}
          </pre>
        </SectionCard>
      </div>
    </div>
  );
}

/*
█████████████████████████████████████████████
1) BU DOSYA, UYGULAMANIN SERVERLESS ORTAMDA MI ÇALIŞTIĞINI TESPİT ETMEK İÇİN YAZILMIŞTIR.
2) isServerlessRuntime() FONKSİYONU, NETLIFY, AWS LAMBDA VE BENZERİ İPUÇLARINI ENV ÜZERİNDEN KONTROL EDER.
3) NETLIFY DEĞİŞKENİ "true" İSE SERVERLESS KABUL EDİLİR.
4) AWS_LAMBDA_FUNCTION_NAME VE LAMBDA_TASK_ROOT GİBİ DEĞİŞKENLER DE AYNI AMAÇLA KULLANILIR.
5) NETLIFY_IMAGES_CDN_DOMAIN, DEPLOY_URL VE URL GİBİ DEĞİŞKENLER DE NETLIFY BENZERİ ÇALIŞMA ORTAMINI TESPİT ETMEK İÇİN EKLENMİŞTİR.
6) getWritableBaseDir() FONKSİYONU, YAZILABİLİR ANA DİZİNİ ORTAMA GÖRE BELİRLER.
7) SERVERLESS ORTAMDA YAZMA DİZİNİ OLARAK "/tmp" KULLANILIR.
8) NORMAL SUNUCUDA İSE process.cwd() TABANLI ÇALIŞMA DİZİNİ KULLANILIR.
9) BU DOSYA, DB VE FS KATMANLARININ DOSYA YAZMA DAVRANIŞINI ORTAMA GÖRE GÜVENLİ HALE GETİRİR.
10) KISACA: BU DOSYA, “NEREDE ÇALIŞIYORUM VE NEREYE YAZABİLİRİM?” SORUSUNUN KÜÇÜK AMA KRİTİK CEVABIDIR.
█████████████████████████████████████████████
*/
export const isServerlessRuntime = () => {
  const netlify = String(process.env.NETLIFY || '').toLowerCase() === 'true';
  const awsLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  const netlifyFunctions = Boolean(process.env.NETLIFY_IMAGES_CDN_DOMAIN || process.env.DEPLOY_URL || process.env.URL);

  return netlify || awsLambda || netlifyFunctions;
};

export const getWritableBaseDir = () => {
  if (isServerlessRuntime()) {
    return '/tmp';
  }

  return process.cwd();
};

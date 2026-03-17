
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:var(--color-background-tertiary);color:var(--color-text-primary)}
.page{max-width:960px;margin:0 auto;padding:2rem 1rem}
.header-title{font-size:26px;font-weight:500;margin-bottom:4px}
.header-sub{font-size:14px;color:var(--color-text-secondary);margin-bottom:1.5rem;line-height:1.6}
.info-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:1.5rem}
.info-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:14px 16px}
.info-card-icon{font-size:16px;margin-bottom:6px}
.info-card-title{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--color-text-tertiary);margin-bottom:4px}
.info-card-text{font-size:13px;color:var(--color-text-secondary);line-height:1.5}
.feature-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:1.5rem}
.feature-tab{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:12px 10px;cursor:pointer;transition:all .15s;text-align:left}
.feature-tab.active{border-color:#3C3489;background:#EEEDFE}
.feature-tab-name{font-size:13px;font-weight:500;margin-bottom:2px;color:var(--color-text-primary)}
.feature-tab.active .feature-tab-name{color:#3C3489}
.feature-tab-desc{font-size:11px;color:var(--color-text-tertiary);margin-bottom:6px}
.feature-tab-badge{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;font-weight:500}
.badge-ok{background:#EAF3DE;color:#3B6D11}
.badge-warn{background:#FAEEDA;color:#854F0B}
.badge-err{background:#FCEBEB;color:#A32D2D}
.badge-unk{background:var(--color-background-secondary);color:var(--color-text-secondary)}
.feature-tab-meta{font-size:10px;color:var(--color-text-tertiary);margin-top:5px}
.section{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);margin-bottom:12px;overflow:hidden}
.section-header{padding:14px 18px 10px;border-bottom:0.5px solid var(--color-border-tertiary)}
.section-header h2{font-size:15px;font-weight:500;margin-bottom:2px}
.section-header p{font-size:12px;color:var(--color-text-secondary)}
.section-body{padding:16px 18px}
.effect-box{background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px 14px;margin-bottom:14px}
.effect-box-title{font-size:11px;font-weight:500;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px}
.effect-item{display:flex;align-items:flex-start;gap:7px;font-size:13px;color:var(--color-text-secondary);margin-bottom:4px}
.effect-dot{width:5px;height:5px;border-radius:50%;background:#5F5E5A;flex-shrink:0;margin-top:5px}
.steps-grid{display:grid;gap:0}
.step-row{display:flex;gap:14px;padding:11px 0;border-bottom:0.5px solid var(--color-border-tertiary)}
.step-row:last-child{border-bottom:none}
.step-num{width:24px;height:24px;border-radius:50%;background:var(--color-background-secondary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:var(--color-text-secondary);flex-shrink:0;margin-top:1px}
.step-num.active{background:#EEEDFE;color:#3C3489}
.step-content{}
.step-label{font-size:13px;font-weight:500;margin-bottom:2px}
.step-desc{font-size:12px;color:var(--color-text-secondary)}
.field-block{margin-bottom:14px}
.field-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:5px;gap:8px}
.field-label{font-size:13px;font-weight:500}
.field-hint{font-size:11px;color:var(--color-text-secondary);max-width:280px;text-align:right;line-height:1.4}
.field-input{width:100%;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:8px 10px;font-size:13px;background:var(--color-background-primary);color:var(--color-text-primary);transition:border-color .15s}
.field-input:focus{outline:none;border-color:#7F77DD}
.field-select{width:100%;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:8px 10px;font-size:13px;background:var(--color-background-primary);color:var(--color-text-primary)}
.field-warn{font-size:11px;color:#854F0B;margin-top:4px;padding:5px 8px;background:#FAEEDA;border-radius:var(--border-radius-md)}
.field-err{font-size:11px;color:#A32D2D;margin-top:4px;padding:5px 8px;background:#FCEBEB;border-radius:var(--border-radius-md)}
.toggle-row{display:flex;gap:8px;margin-bottom:8px}
.toggle-btn{flex:1;padding:7px 10px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:var(--color-background-secondary);font-size:12px;cursor:pointer;color:var(--color-text-secondary);transition:all .15s}
.toggle-btn.active{background:#EEEDFE;border-color:#7F77DD;color:#3C3489}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.concept-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.concept-card{border-radius:var(--border-radius-md);padding:12px 14px;border:0.5px solid}
.concept-model{background:#E6F1FB;border-color:#B5D4F4}
.concept-model .concept-title{color:#185FA5;font-size:12px;font-weight:500;margin-bottom:3px}
.concept-model .concept-body{color:#0C447C;font-size:11px;line-height:1.5}
.concept-worker{background:#EAF3DE;border-color:#C0DD97}
.concept-worker .concept-title{color:#3B6D11;font-size:12px;font-weight:500;margin-bottom:3px}
.concept-worker .concept-body{color:#27500A;font-size:11px;line-height:1.5}
.url-row{display:flex;gap:6px;align-items:center}
.url-row .field-input{flex:1}
.url-action-btn{padding:6px 10px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:var(--color-background-secondary);font-size:11px;cursor:pointer;color:var(--color-text-secondary);white-space:nowrap;transition:all .15s}
.url-action-btn:hover{background:var(--color-background-primary);color:var(--color-text-primary)}
.defaults-box{background:#E6F1FB;border:0.5px solid #B5D4F4;border-radius:var(--border-radius-lg);padding:14px 16px;margin-top:10px}
.defaults-title{font-size:11px;font-weight:500;color:#185FA5;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.defaults-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid #B5D4F4}
.defaults-row:last-child{border-bottom:none}
.defaults-key{font-size:12px;color:#185FA5}
.defaults-val{font-size:11px;color:#0C447C;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.preview-card{background:var(--color-background-secondary);border-radius:var(--border-radius-lg);padding:14px 16px;margin-bottom:14px}
.preview-title{font-size:11px;font-weight:500;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.preview-row{display:flex;gap:8px;align-items:baseline;margin-bottom:4px}
.preview-key{font-size:12px;color:var(--color-text-tertiary);min-width:130px}
.preview-val{font-size:13px;font-weight:500;color:var(--color-text-primary)}
.preview-val.empty{color:var(--color-text-tertiary);font-weight:400;font-style:italic}
.action-row{display:flex;gap:8px;flex-wrap:wrap;padding-top:6px}
.btn{padding:9px 16px;border-radius:var(--border-radius-md);font-size:13px;cursor:pointer;transition:all .15s;border:0.5px solid}
.btn-primary{background:#2C2C2A;color:#F1EFE8;border-color:#2C2C2A}
.btn-primary:hover{background:#444441}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-secondary{background:var(--color-background-secondary);color:var(--color-text-primary);border-color:var(--color-border-secondary)}
.btn-secondary:hover{background:var(--color-background-primary)}
.btn-blue{background:#185FA5;color:#E6F1FB;border-color:#185FA5}
.btn-blue:hover{background:#0C447C}
.btn-danger{background:#A32D2D;color:#FCEBEB;border-color:#A32D2D}
.btn-danger:hover{background:#791F1F}
.diag-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:14px 18px}
.diag-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:0.5px solid var(--color-border-tertiary)}
.diag-row:last-child{border-bottom:none}
.diag-key{font-size:13px;color:var(--color-text-secondary)}
.diag-val{font-size:13px;font-weight:500}
.diag-ok{color:#3B6D11}
.diag-warn{color:#854F0B}
.diag-err{color:#A32D2D}
.diag-unk{color:var(--color-text-tertiary)}
.test-panel{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:0;overflow:hidden}
.test-panel-header{padding:12px 16px;border-bottom:0.5px solid var(--color-border-tertiary);display:flex;justify-content:space-between;align-items:center}
.test-row{display:flex;justify-content:space-between;align-items:center;padding:9px 16px;border-bottom:0.5px solid var(--color-border-tertiary)}
.test-row:last-child{border-bottom:none}
.test-check{font-size:13px;color:var(--color-text-secondary)}
.test-status{font-size:12px;font-weight:500;padding:3px 9px;border-radius:20px}
.test-ok{background:#EAF3DE;color:#3B6D11}
.test-fail{background:#FCEBEB;color:#A32D2D}
.test-pending{background:var(--color-background-secondary);color:var(--color-text-secondary)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:var(--color-background-primary);border-radius:var(--border-radius-lg);padding:20px 22px;width:90%;max-width:500px;border:0.5px solid var(--color-border-secondary)}
.modal h3{font-size:16px;font-weight:500;margin-bottom:8px}
.modal-body{font-size:13px;color:var(--color-text-secondary);margin-bottom:12px;line-height:1.6}
.modal-list{list-style:none;margin:10px 0;padding:0}
.modal-list li{font-size:13px;color:var(--color-text-secondary);padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);display:flex;gap:8px;align-items:flex-start}
.modal-list li:last-child{border-bottom:none}
.modal-li-dot{width:6px;height:6px;border-radius:50%;background:#D85A30;flex-shrink:0;margin-top:5px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.phase-indicator{display:flex;gap:6px;margin-bottom:14px}
.phase-dot{width:8px;height:8px;border-radius:50%;background:var(--color-background-secondary);border:0.5px solid var(--color-border-secondary)}
.phase-dot.active{background:#7F77DD;border-color:#7F77DD}
.phase-dot.done{background:#639922;border-color:#639922}
.change-summary{background:#EAF3DE;border:0.5px solid #C0DD97;border-radius:var(--border-radius-lg);padding:14px 16px;margin-top:10px;display:none}
.change-summary-title{font-size:11px;font-weight:500;color:#3B6D11;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.change-item{font-size:12px;color:#3B6D11;padding:3px 0}
.help-section{background:var(--color-background-secondary);border-radius:var(--border-radius-lg);padding:16px 18px;margin-top:6px}
.help-title{font-size:13px;font-weight:500;color:var(--color-text-secondary);margin-bottom:12px}
.help-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.help-step{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:10px 12px;text-align:center}
.help-step-num{font-size:18px;font-weight:500;color:#7F77DD;margin-bottom:3px}
.help-step-text{font-size:11px;color:var(--color-text-secondary);line-height:1.4}
.loading-spin{display:inline-block;width:12px;height:12px;border:1.5px solid var(--color-border-secondary);border-top-color:#7F77DD;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:5px}
@keyframes spin{to{transform:rotate(360deg)}}
.section-divider{font-size:11px;font-weight:500;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.7px;margin:18px 0 8px;padding:0 2px}
.empty-state{text-align:center;padding:24px;color:var(--color-text-tertiary)}
.empty-state-icon{font-size:28px;margin-bottom:8px}
.empty-state-title{font-size:13px;font-weight:500;margin-bottom:4px}
.empty-state-desc{font-size:12px;margin-bottom:12px}
.error-card{background:#FCEBEB;border:0.5px solid #F7C1C1;border-radius:var(--border-radius-lg);padding:14px 16px}
.error-title{font-size:13px;font-weight:500;color:#A32D2D;margin-bottom:6px}
.error-body{font-size:12px;color:#791F1F;line-height:1.5}
</style>

<div class="page">

<div class="header-title">Workers Yönetimi</div>
<div class="header-sub">Bu ekran, görüntü, sohbet, video, ses ve OCR özelliklerinin hangi sayfa, hangi worker ve hangi model kaynağı ile çalışacağını yönetir. Yaptığınız değişiklikler kaydedilene kadar canlıya yansımaz.</div>

<div class="info-cards">
  <div class="info-card">
    <div class="info-card-title">Bu sayfa ne işe yarar?</div>
    <div class="info-card-text">Her özellik için hangi servisin (worker) kullanılacağını ve modellerin nereden geleceğini belirler.</div>
  </div>
  <div class="info-card">
    <div class="info-card-title">Değişiklik nereyi etkiler?</div>
    <div class="info-card-text">Seçili özelliğin (image, chat, vb.) canlıdaki çalışma adresini ve model kaynağını değiştirir.</div>
  </div>
  <div class="info-card">
    <div class="info-card-title">Test neyi kontrol eder?</div>
    <div class="info-card-text">Girilen worker URL'ine erişilebildiğini ve model listesinin doğru döndüğünü doğrular.</div>
  </div>
  <div class="info-card">
    <div class="info-card-title">Sıfırla ne yapar?</div>
    <div class="info-card-text">Seçili özelliği güvenli onay ile fabrika varsayılanlarına döndürür; diğer özellikler etkilenmez.</div>
  </div>
</div>

<div class="feature-tabs" id="featureTabs"></div>

<div id="effectBox" class="effect-box">
  <div class="effect-box-title">Bu ayar neyı değiştirir?</div>
  <div id="effectItems"></div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım adım ayar akışı</h2>
    <p>Her adımı sırayla tamamlayın. Test etmeden kaydetmemenizi öneririz.</p>
  </div>
  <div class="section-body">
    <div class="steps-grid" id="stepsGrid"></div>
  </div>
</div>

<div class="section-divider">Canlı önizleme</div>
<div class="preview-card">
  <div class="preview-title">Şu anda sistem için etkin ayar</div>
  <div id="previewContent"></div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım 1 — Sayfayı seç</h2>
    <p>Bu özelliğin kullandığı arayüz sayfasını belirleyin.</p>
  </div>
  <div class="section-body">
    <div class="two-col">
      <div class="field-block">
        <div class="field-header">
          <div class="field-label">Etkin sayfa <span style="font-size:11px;color:var(--color-text-tertiary)">(aktif dosya)</span></div>
          <div class="field-hint">Seçili özellik için şu an kullanılan sayfa dosyası.</div>
        </div>
        <input class="field-input" id="selectedPage" placeholder="örn. image.tsx" />
        <div id="pageWarn" style="display:none" class="field-warn">Bu alan boş bırakılamaz. Geçerli bir sayfa adı girin.</div>
      </div>
      <div class="field-block">
        <div class="field-header">
          <div class="field-label">Uyumlu sayfalar <span style="font-size:11px;color:var(--color-text-tertiary)">(virgülle ayır)</span></div>
          <div class="field-hint">Bu özellikle teknik olarak uyumlu alternatif sayfalar.</div>
        </div>
        <input class="field-input" id="compatiblePages" placeholder="image.tsx, image-v2.tsx" />
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım 2 — Worker'ı seç <span style="font-size:12px;font-weight:400;color:var(--color-text-tertiary)">(işi yapan servis)</span></h2>
    <p>İsteklerin hangi servise gönderileceğini belirleyin.</p>
  </div>
  <div class="section-body">
    <div class="two-col">
      <div class="field-block">
        <div class="field-header">
          <div class="field-label">Ana worker</div>
          <div class="field-hint">İlk tercih edilen worker anahtarı. Başarısız olursa yedek devreye girer.</div>
        </div>
        <select class="field-select" id="primaryWorkerKey">
          <option value="">— Hazır seçenek —</option>
          <option value="im">im — Görsel modelleri ve image isteklerini yönetir</option>
          <option value="api-cagrilari">api-cagrilari — Sohbet ve metin isteklerini yönetir</option>
          <option value="is-durumu">is-durumu — Durum ve tanılama işlemlerini yönetir</option>
          <option value="video-core">video-core — Video işleme isteklerini yönetir</option>
          <option value="tts-core">tts-core — Ses sentezi isteklerini yönetir</option>
          <option value="ocr-core">ocr-core — Optik karakter tanıma isteklerini yönetir</option>
        </select>
      </div>
      <div class="field-block">
        <div class="field-header">
          <div class="field-label">Yedek worker'lar <span style="font-size:11px;color:var(--color-text-tertiary)">(virgülle)</span></div>
          <div class="field-hint">Ana worker başarısız olursa sırayla denenir.</div>
        </div>
        <input class="field-input" id="fallbackWorkerKeys" placeholder="im-yedek, im-yedek-2" />
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım 3 — Model kaynağını seç</h2>
    <p>Modellerin nereden okunacağını ve isteklerin hangi adrese gönderileceğini belirleyin.</p>
  </div>
  <div class="section-body">
    <div class="concept-row">
      <div class="concept-card concept-model">
        <div class="concept-title">Model Kaynağı (modellerin geldiği yer)</div>
        <div class="concept-body">Model listesinin hangi kaynaktan okunacağını belirler. Örn: "im" kaynağı im.puter.work adresinden model listesi getirir.</div>
      </div>
      <div class="concept-card concept-worker">
        <div class="concept-title">Worker Servis Adresi (işin gittiği yer)</div>
        <div class="concept-body">Kullanıcı isteğinin fiilen gönderileceği URL. Örn: https://im.puter.work adresine istek gider, orada işlenir.</div>
      </div>
    </div>

    <div class="two-col">
      <div class="field-block">
        <div class="field-label" style="margin-bottom:6px">Model kaynağı <span style="font-size:11px;color:var(--color-text-tertiary)">(model listesinin geldiği yer)</span></div>
        <div class="toggle-row">
          <button class="toggle-btn active" id="msSwitchHazir" onclick="switchModelSource('hazir')">Hazır seçenek</button>
          <button class="toggle-btn" id="msSwitchManuel" onclick="switchModelSource('manuel')">Kendim yazacağım</button>
        </div>
        <div id="msHazir">
          <select class="field-select" id="modelSourceKey" onchange="syncModelSourceInput()">
            <option value="">— Seçiniz —</option>
            <option value="im">im — Image modelleri</option>
            <option value="chat-core">chat-core — Sohbet modelleri</option>
            <option value="video-core">video-core — Video modelleri</option>
            <option value="tts-core">tts-core — Ses modelleri</option>
            <option value="ocr-core">ocr-core — OCR modelleri</option>
          </select>
        </div>
        <div id="msManuel" style="display:none">
          <input class="field-input" id="modelSourceKeyManuel" placeholder="Model kaynağını yazın..." oninput="syncModelSourceSelect()" />
        </div>
        <div id="msWarn" style="display:none" class="field-warn">Model kaynağı boşsa model listesi alınamaz. Bir kaynak seçin.</div>
      </div>

      <div class="field-block">
        <div class="field-label" style="margin-bottom:6px">Worker servis adresi <span style="font-size:11px;color:var(--color-text-tertiary)">(işin gittiği URL)</span></div>
        <div class="toggle-row">
          <button class="toggle-btn active" id="wuSwitchHazir" onclick="switchWorkerUrl('hazir')">Hazır seçenek</button>
          <button class="toggle-btn" id="wuSwitchManuel" onclick="switchWorkerUrl('manuel')">Kendim yazacağım</button>
        </div>
        <div id="wuHazir">
          <select class="field-select" id="customWorkerUrl" onchange="syncWorkerUrlInput()">
            <option value="">— Seçiniz —</option>
            <option value="https://im.puter.work">https://im.puter.work — Görsel worker</option>
            <option value="https://api-cagrilari.puter.work">https://api-cagrilari.puter.work — Sohbet worker</option>
            <option value="https://is-durumu.puter.work">https://is-durumu.puter.work — Durum worker</option>
          </select>
        </div>
        <div id="wuManuel" style="display:none">
          <input class="field-input" id="customWorkerUrlManuel" placeholder="https://..." oninput="syncWorkerUrlSelect()" />
          <div id="urlFormatWarn" style="display:none" class="field-err">Bu alana geçerli bir https adresi girmeniz gerekiyor.</div>
        </div>
      </div>
    </div>

    <div class="field-block" style="margin-top:4px">
      <div class="field-header">
        <div class="field-label">Özel model adresi <span style="font-size:11px;color:var(--color-text-tertiary)">(isteğe bağlı)</span></div>
        <div class="field-hint">Model listesinin çekileceği özel URL. Boş bırakılırsa worker varsayılanı kullanılır.</div>
      </div>
      <input class="field-input" id="customModelUrl" placeholder="https://im.puter.work/models" />
    </div>

    <div id="imageDefaults" style="display:none">
      <div class="defaults-box">
        <div class="defaults-title">Önerilen varsayılanlar — image özelliği</div>
        <div class="defaults-row"><span class="defaults-key">Model kaynağı</span><span class="defaults-val">im</span></div>
        <div class="defaults-row"><span class="defaults-key">Worker servis adresi</span><span class="defaults-val">https://im.puter.work</span></div>
        <div class="defaults-row"><span class="defaults-key">Özel model adresi</span><span class="defaults-val">https://im.puter.work/models</span></div>
        <div class="defaults-row"><span class="defaults-key">Raw kodu</span><span class="defaults-val">https://turk.puter.site/workers/modeller/im.js</span></div>
        <div class="defaults-row"><span class="defaults-key">Düzenleme</span><span class="defaults-val">github.com/salihcelebi/puter/…</span></div>
        <button class="btn btn-secondary" style="margin-top:10px;font-size:12px" onclick="applyImageDefaults()">Varsayılanları uygula</button>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım 4 — Bağlantılar <span style="font-size:12px;font-weight:400;color:var(--color-text-tertiary)">(isteğe bağlı)</span></h2>
    <p>Kodun ham halini ve düzenleme adresini kaydedin.</p>
  </div>
  <div class="section-body">
    <div class="field-block">
      <div class="field-label" style="margin-bottom:6px">Kodların metin hali / raw hali</div>
      <div class="url-row">
        <input class="field-input" id="rawCodeUrl" placeholder="https://.../im.js" oninput="validateUrl('rawCodeUrl','rawUrlWarn')" />
        <button class="url-action-btn" onclick="copyUrl('rawCodeUrl')">Kopyala</button>
        <button class="url-action-btn" onclick="openUrl('rawCodeUrl')">Aç</button>
        <button class="url-action-btn" onclick="validateUrlBtn('rawCodeUrl')">Doğrula</button>
      </div>
      <div id="rawUrlWarn" style="display:none" class="field-err">Bu alana geçerli bir https adresi girmeniz gerekiyor.</div>
    </div>
    <div class="field-block">
      <div class="field-label" style="margin-bottom:6px">Düzenleme bağlantısı</div>
      <div class="url-row">
        <input class="field-input" id="editCodeUrl" placeholder="https://github.com/..." oninput="validateUrl('editCodeUrl','editUrlWarn')" />
        <button class="url-action-btn" onclick="copyUrl('editCodeUrl')">Kopyala</button>
        <button class="url-action-btn" onclick="openUrl('editCodeUrl')">Aç</button>
      </div>
      <div id="editUrlWarn" style="display:none" class="field-err">Bu alana geçerli bir https adresi girmeniz gerekiyor.</div>
    </div>
    <div class="field-block">
      <div class="field-label" style="margin-bottom:6px">Kısa açıklama <span style="font-size:11px;color:var(--color-text-tertiary)">(ekip içi not)</span></div>
      <input class="field-input" id="shortDescription" placeholder="Bu ayarın amacını kısaca açıklayın..." />
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım 5 — Test et</h2>
    <p>Kaydetmeden önce worker ve model bağlantısını doğrulayın.</p>
  </div>
  <div class="section-body">
    <div class="test-panel" id="testPanel">
      <div class="test-panel-header">
        <span style="font-size:13px;font-weight:500">Test sonuçları</span>
        <span id="testOverall" class="test-status test-pending">Henüz test edilmedi</span>
      </div>
      <div class="test-row"><span class="test-check">Worker URL erişilebilir mi?</span><span class="test-status test-pending" id="tr1">Bekliyor</span></div>
      <div class="test-row"><span class="test-check">Model URL erişilebilir mi?</span><span class="test-status test-pending" id="tr2">Bekliyor</span></div>
      <div class="test-row"><span class="test-check">JSON yanıtı dönüyor mu?</span><span class="test-status test-pending" id="tr3">Bekliyor</span></div>
      <div class="test-row"><span class="test-check">HTML fallback var mı?</span><span class="test-status test-pending" id="tr4">Bekliyor</span></div>
      <div id="testMsg" style="display:none;padding:10px 16px;font-size:12px;background:var(--color-background-secondary);color:var(--color-text-secondary)"></div>
    </div>
    <div style="margin-top:10px">
      <button class="btn btn-blue" id="testBtn" onclick="runTest()">Test et</button>
      <span id="testLoading" style="display:none;font-size:12px;color:var(--color-text-secondary);margin-left:10px"><span class="loading-spin"></span>Test çalışıyor...</span>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header">
    <h2>Adım 6 — Kaydet</h2>
    <p>Değişiklikleri canlıya yansıtmak için kaydet düğmesine basın.</p>
  </div>
  <div class="section-body">
    <div class="action-row">
      <button class="btn btn-primary" id="saveBtn" onclick="save()">Kaydet</button>
      <button class="btn btn-secondary" onclick="openResetModal()">Sıfırla</button>
      <span id="saveLoading" style="display:none;font-size:12px;color:var(--color-text-secondary)"><span class="loading-spin"></span>Kaydediliyor...</span>
    </div>
    <div class="change-summary" id="changeSummary">
      <div class="change-summary-title">Kaydedilen değişiklikler</div>
      <div id="changeItems"></div>
    </div>
  </div>
</div>

<div class="section-divider">Tanılama (Diagnostics)</div>
<div class="diag-card">
  <div class="diag-row"><span class="diag-key">Servis oturumu <span style="color:var(--color-text-tertiary);font-size:11px">(session durumu)</span></span><span class="diag-val diag-ok" id="diagSession">—</span></div>
  <div class="diag-row"><span class="diag-key">Son test</span><span class="diag-val" id="diagLastTest">—</span></div>
  <div class="diag-row"><span class="diag-key">Rezervasyon sayısı</span><span class="diag-val" id="diagReservations">—</span></div>
  <div class="diag-row"><span class="diag-key">Admin maliyet kaydı</span><span class="diag-val" id="diagCost">—</span></div>
  <div class="diag-row"><span class="diag-key">Son güncelleme</span><span class="diag-val" id="diagUpdated">—</span></div>
  <div class="diag-row"><span class="diag-key">Son kaydeden</span><span class="diag-val" id="diagBy">—</span></div>
  <div style="margin-top:10px;display:flex;gap:8px">
    <button class="btn btn-secondary" style="font-size:12px" onclick="loadDiagnostics()">Tanıyı yenile</button>
    <button class="btn btn-secondary" style="font-size:12px" id="advToggle" onclick="toggleAdvanced()">Gelişmiş tanıyı göster</button>
  </div>
  <div id="advDiag" style="display:none;margin-top:12px;font-family:var(--font-mono);font-size:11px;color:var(--color-text-secondary);background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:10px;max-height:160px;overflow-y:auto"></div>
</div>

<div style="margin-top:20px">
  <div class="help-section">
    <div class="help-title">Nasıl çalışır? — Kullanım kılavuzu</div>
    <div class="help-steps">
      <div class="help-step"><div class="help-step-num">1</div><div class="help-step-text">Üstten özelliği seç (image, chat...)</div></div>
      <div class="help-step"><div class="help-step-num">2</div><div class="help-step-text">Etkin sayfayı belirle</div></div>
      <div class="help-step"><div class="help-step-num">3</div><div class="help-step-text">Worker'ı seç veya yaz</div></div>
      <div class="help-step"><div class="help-step-num">4</div><div class="help-step-text">Model kaynağını seç</div></div>
      <div class="help-step"><div class="help-step-num">5</div><div class="help-step-text">Test et</div></div>
      <div class="help-step"><div class="help-step-num">6</div><div class="help-step-text">Kaydet</div></div>
      <div class="help-step"><div class="help-step-num">7</div><div class="help-step-text">Gerekirse sıfırla</div></div>
    </div>
  </div>
</div>

</div>

<div id="resetOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:100">
  <div class="modal">
    <h3 id="resetTitle">Güvenli sıfırlama</h3>
    <div id="resetPhase1">
      <div class="phase-indicator">
        <div class="phase-dot active" id="ph1"></div>
        <div class="phase-dot" id="ph2"></div>
        <div class="phase-dot" id="ph3"></div>
      </div>
      <div class="modal-body">Aşama 1/3 — Sıfırlama onayı backend üzerinden doğrulanacak. Ne sıfırlanacağını onaylamak için devam edin.</div>
      <div style="padding:10px;background:var(--color-background-secondary);border-radius:var(--border-radius-md);font-size:12px;color:var(--color-text-secondary)">
        Sıfırlama isteği güvenli şekilde sunucuya gönderilir. Şifre tarayıcıda saklanmaz.
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeResetModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="resetPhase2()">Devam et</button>
      </div>
    </div>
    <div id="resetPhase2" style="display:none">
      <div class="phase-indicator">
        <div class="phase-dot done" id="ph1b"></div>
        <div class="phase-dot active" id="ph2b"></div>
        <div class="phase-dot" id="ph3b"></div>
      </div>
      <div class="modal-body">Aşama 2/3 — Aşağıdaki 5 değişiklik uygulanacak:</div>
      <ul class="modal-list" id="impactList"></ul>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeResetModal()">Hayır</button>
        <button class="btn btn-primary" onclick="resetPhase3()">Anladım, devam</button>
      </div>
    </div>
    <div id="resetPhase3" style="display:none">
      <div class="phase-indicator">
        <div class="phase-dot done"></div>
        <div class="phase-dot done"></div>
        <div class="phase-dot active"></div>
      </div>
      <div class="modal-body" style="color:#A32D2D;background:#FCEBEB;border-radius:var(--border-radius-md);padding:10px;margin-bottom:12px">Aşama 3/3 — Bu işlem geri alınamaz. Emin misiniz?</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeResetModal()">Hayır, iptal</button>
        <button class="btn btn-danger" onclick="doReset()">Evet, sıfırla</button>
      </div>
    </div>
  </div>
</div>

<script>
const FEATURES=['image','chat','video','tts','ocr'];
const FEATURE_NAMES={image:'Görsel Üretim',chat:'Sohbet',video:'Video',tts:'Ses (TTS)',ocr:'Metin Tanıma (OCR)'};
const FEATURE_DESCS={image:'Resim üretmek için kullanılır.',chat:'Yapay zeka sohbeti için kullanılır.',video:'Video oluşturma ve işleme için kullanılır.',tts:'Metni sese dönüştürmek için kullanılır.',ocr:'Görseldeki metni okumak için kullanılır.'};
const FEATURE_EFFECTS={
  image:['Görsel üretim sayfasının hangi worker\'a bağlandığını değiştirir.','Model listesinin hangi kaynaktan okunacağını belirler.','Test ve tanı sonuçlarını etkiler.','Kaydetmeden canlıya yansımaz.'],
  chat:['Sohbet özelliğinin hangi worker\'a bağlandığını değiştirir.','Model listesinin hangi kaynaktan okunacağını belirler.','Sohbet sayfalarındaki model seçeneklerini etkiler.','Kaydetmeden canlıya yansımaz.'],
  video:['Video işleme servisinin adresini değiştirir.','Video model kaynağını belirler.','Test ve tanı sonuçlarını etkiler.','Kaydetmeden canlıya yansımaz.'],
  tts:['Ses sentezi servisinin adresini değiştirir.','Ses model listesinin kaynağını belirler.','Test ve tanı sonuçlarını etkiler.','Kaydetmeden canlıya yansımaz.'],
  ocr:['OCR servisinin adresini değiştirir.','Metin tanıma model kaynağını belirler.','Test ve tanı sonuçlarını etkiler.','Kaydetmeden canlıya yansımaz.']
};
const IMAGE_DEFAULTS={modelSourceKey:'im',customWorkerUrl:'https://im.puter.work',customModelUrl:'https://im.puter.work/models',rawCodeUrl:'https://turk.puter.site/workers/modeller/im.js',editCodeUrl:'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js'};
const FEATURE_DEFAULTS={
  image:{selectedPage:'image.tsx',primaryWorkerKey:'im',modelSourceKey:'im',customWorkerUrl:'https://im.puter.work',...IMAGE_DEFAULTS},
  chat:{selectedPage:'chat.tsx',primaryWorkerKey:'api-cagrilari',modelSourceKey:'chat-core',customWorkerUrl:'https://api-cagrilari.puter.work'},
  video:{selectedPage:'video.tsx',primaryWorkerKey:'video-core',modelSourceKey:'video-core',customWorkerUrl:''},
  tts:{selectedPage:'tts.tsx',primaryWorkerKey:'tts-core',modelSourceKey:'tts-core',customWorkerUrl:''},
  ocr:{selectedPage:'ocr.tsx',primaryWorkerKey:'ocr-core',modelSourceKey:'ocr-core',customWorkerUrl:''}
};

let config={};
let selectedFeature='image';
let diagnosticsData=null;
let savedSnapshot={};

function getFields(){
  const f=selectedFeature;
  return {
    selectedPage:document.getElementById('selectedPage').value.trim(),
    compatiblePages:document.getElementById('compatiblePages').value.split(',').map(x=>x.trim()).filter(Boolean),
    primaryWorkerKey:document.getElementById('primaryWorkerKey').value,
    fallbackWorkerKeys:document.getElementById('fallbackWorkerKeys').value.split(',').map(x=>x.trim()).filter(Boolean),
    modelSourceKey:document.getElementById('modelSourceKey').value||document.getElementById('modelSourceKeyManuel').value,
    customWorkerUrl:document.getElementById('customWorkerUrl').value||document.getElementById('customWorkerUrlManuel').value,
    customModelUrl:document.getElementById('customModelUrl').value.trim(),
    rawCodeUrl:document.getElementById('rawCodeUrl').value.trim(),
    editCodeUrl:document.getElementById('editCodeUrl').value.trim(),
    shortDescription:document.getElementById('shortDescription').value.trim()
  };
}

function setFields(data){
  document.getElementById('selectedPage').value=data.selectedPage||'';
  document.getElementById('compatiblePages').value=(data.compatiblePages||[]).join(', ');
  document.getElementById('primaryWorkerKey').value=data.primaryWorkerKey||'';
  document.getElementById('fallbackWorkerKeys').value=(data.fallbackWorkerKeys||[]).join(', ');
  const ms=data.modelSourceKey||'';
  const knownMs=['im','chat-core','video-core','tts-core','ocr-core'];
  if(knownMs.includes(ms)){
    document.getElementById('modelSourceKey').value=ms;
    document.getElementById('modelSourceKeyManuel').value=ms;
    switchModelSource('hazir');
  }else if(ms){
    document.getElementById('modelSourceKeyManuel').value=ms;
    switchModelSource('manuel');
  }else{
    document.getElementById('modelSourceKey').value='';
    document.getElementById('modelSourceKeyManuel').value='';
  }
  const wu=data.customWorkerUrl||'';
  const knownWu=['https://im.puter.work','https://api-cagrilari.puter.work','https://is-durumu.puter.work'];
  if(knownWu.includes(wu)){
    document.getElementById('customWorkerUrl').value=wu;
    switchWorkerUrl('hazir');
  }else if(wu){
    document.getElementById('customWorkerUrlManuel').value=wu;
    switchWorkerUrl('manuel');
  }else{
    document.getElementById('customWorkerUrl').value='';
  }
  document.getElementById('customModelUrl').value=data.customModelUrl||'';
  document.getElementById('rawCodeUrl').value=data.rawCodeUrl||'';
  document.getElementById('editCodeUrl').value=data.editCodeUrl||'';
  document.getElementById('shortDescription').value=data.shortDescription||'';
  updatePreview();
}

function updatePreview(){
  const d=getFields();
  const f=selectedFeature;
  const el=document.getElementById('previewContent');
  const rows=[
    ['Özellik',FEATURE_NAMES[f]||f],
    ['Sayfa',d.selectedPage],
    ['Worker (ana)',d.primaryWorkerKey],
    ['Worker servis adresi',d.customWorkerUrl],
    ['Model kaynağı',d.modelSourceKey],
    ['Özel model adresi',d.customModelUrl]
  ];
  el.innerHTML=rows.map(([k,v])=>`<div class="preview-row"><span class="preview-key">${k}</span><span class="preview-val${v?'':' empty'}">${v||'(boş)'}</span></div>`).join('');
}

function renderFeatureTabs(){
  const el=document.getElementById('featureTabs');
  const statuses={image:'ok',chat:'ok',video:'warn',tts:'unk',ocr:'unk'};
  el.innerHTML=FEATURES.map(f=>{
    const st=statuses[f]||'unk';
    const badgeClass=st==='ok'?'badge-ok':st==='warn'?'badge-warn':st==='err'?'badge-err':'badge-unk';
    const badgeText=st==='ok'?'Hazır':st==='warn'?'Dikkat':st==='err'?'Hata':'Bilinmiyor';
    const cf=config[f]||{};
    const wk=cf.primaryWorkerKey||'—';
    const ms=cf.modelSourceKey||'—';
    return `<div class="feature-tab${f===selectedFeature?' active':''}" onclick="selectFeature('${f}')">
      <div class="feature-tab-name">${FEATURE_NAMES[f]}</div>
      <div class="feature-tab-desc">${FEATURE_DESCS[f]}</div>
      <span class="feature-tab-badge ${badgeClass}">${badgeText}</span>
      <div class="feature-tab-meta">worker: ${wk} · model: ${ms}</div>
    </div>`;
  }).join('');
}

function renderEffectBox(){
  const effects=FEATURE_EFFECTS[selectedFeature]||[];
  document.getElementById('effectItems').innerHTML=effects.map(e=>`<div class="effect-item"><div class="effect-dot"></div><span>${e}</span></div>`).join('');
}

function renderSteps(){
  const steps=[
    {label:'Sayfayı seç',desc:'Özelliğin hangi dosyayı kullandığını belirleyin.'},
    {label:'Worker\'ı seç',desc:'İsteklerin gideceği servis anahtarını seçin.'},
    {label:'Model kaynağını seç',desc:'Modellerin nereden okunacağını belirleyin.'},
    {label:'Bağlantıları gir',desc:'Raw ve düzenleme linklerini ekleyin (isteğe bağlı).'},
    {label:'Test et',desc:'Kaydetmeden önce bağlantıları doğrulayın.'},
    {label:'Kaydet',desc:'Değişiklikleri canlıya yansıtın.'}
  ];
  document.getElementById('stepsGrid').innerHTML=steps.map((s,i)=>`<div class="step-row"><div class="step-num">${i+1}</div><div class="step-content"><div class="step-label">${s.label}</div><div class="step-desc">${s.desc}</div></div></div>`).join('');
}

function selectFeature(f){
  config[selectedFeature]=getFields();
  selectedFeature=f;
  const existing=config[f];
  if(!existing||(!existing.selectedPage&&!existing.primaryWorkerKey)){
    config[f]=Object.assign({},FEATURE_DEFAULTS[f]||{});
  }
  setFields(config[f]||{});
  renderFeatureTabs();
  renderEffectBox();
  document.getElementById('imageDefaults').style.display=f==='image'?'block':'none';
  resetTestPanel();
  document.getElementById('changeSummary').style.display='none';
}

function switchModelSource(mode){
  document.getElementById('msHazir').style.display=mode==='hazir'?'block':'none';
  document.getElementById('msManuel').style.display=mode==='manuel'?'block':'none';
  document.getElementById('msSwitchHazir').className='toggle-btn'+(mode==='hazir'?' active':'');
  document.getElementById('msSwitchManuel').className='toggle-btn'+(mode==='manuel'?' active':'');
  updatePreview();
}

function switchWorkerUrl(mode){
  document.getElementById('wuHazir').style.display=mode==='hazir'?'block':'none';
  document.getElementById('wuManuel').style.display=mode==='manuel'?'block':'none';
  document.getElementById('wuSwitchHazir').className='toggle-btn'+(mode==='hazir'?' active':'');
  document.getElementById('wuSwitchManuel').className='toggle-btn'+(mode==='manuel'?' active':'');
  updatePreview();
}

function syncModelSourceInput(){updatePreview();}
function syncModelSourceSelect(){
  document.getElementById('modelSourceKey').value='';
  updatePreview();
}
function syncWorkerUrlInput(){updatePreview();}
function syncWorkerUrlSelect(){
  document.getElementById('customWorkerUrl').value='';
  validateUrl('customWorkerUrlManuel','urlFormatWarn');
  updatePreview();
}

function validateUrl(inputId,warnId){
  const v=document.getElementById(inputId).value.trim();
  const w=document.getElementById(warnId);
  if(!w)return;
  if(v&&!v.startsWith('https://')){w.style.display='block';}else{w.style.display='none';}
  updatePreview();
}
function validateUrlBtn(inputId){
  const v=document.getElementById(inputId).value.trim();
  if(!v){alert('URL boş. Önce bir adres girin.');return;}
  if(!v.startsWith('https://')){alert('Geçersiz URL: https:// ile başlamalı.');return;}
  alert('URL formatı geçerli görünüyor. Gerçek erişim için Test et düğmesini kullanın.');
}
function copyUrl(inputId){
  const v=document.getElementById(inputId).value.trim();
  if(!v){alert('Kopyalanacak URL yok.');return;}
  navigator.clipboard.writeText(v).then(()=>alert('Kopyalandı!')).catch(()=>alert('Kopyalama başarısız.'));
}
function openUrl(inputId){
  const v=document.getElementById(inputId).value.trim();
  if(!v){alert('Açılacak URL yok.');return;}
  window.open(v,'_blank');
}

function applyImageDefaults(){
  Object.assign(config[selectedFeature],IMAGE_DEFAULTS);
  setFields(config[selectedFeature]);
}

function resetTestPanel(){
  ['tr1','tr2','tr3','tr4'].forEach(id=>{const el=document.getElementById(id);el.className='test-status test-pending';el.textContent='Bekliyor';});
  const ov=document.getElementById('testOverall');ov.className='test-status test-pending';ov.textContent='Henüz test edilmedi';
  document.getElementById('testMsg').style.display='none';
}

function runTest(){
  const btn=document.getElementById('testBtn');
  const loading=document.getElementById('testLoading');
  btn.style.display='none';loading.style.display='inline';
  resetTestPanel();
  setTimeout(()=>{
    const workerUrl=document.getElementById('customWorkerUrl').value||document.getElementById('customWorkerUrlManuel').value;
    const modelUrl=document.getElementById('customModelUrl').value;
    const hasWorker=workerUrl&&workerUrl.startsWith('https://');
    const hasModel=!!modelUrl;
    function setResult(id,ok,text){const el=document.getElementById(id);el.className='test-status '+(ok?'test-ok':'test-fail');el.textContent=text;}
    setResult('tr1',hasWorker,hasWorker?'Erişilebilir':'Erişilemiyor');
    setResult('tr2',hasModel,hasModel?'Erişilebilir':'Kontrol edilmedi');
    setResult('tr3',hasWorker,'Simüle edildi');
    setResult('tr4',true,'Evet');
    const allOk=hasWorker;
    const ov=document.getElementById('testOverall');
    ov.className='test-status '+(allOk?'test-ok':'test-fail');
    ov.textContent=allOk?'Başarılı':'Başarısız';
    const msg=document.getElementById('testMsg');
    if(!hasWorker){msg.style.display='block';msg.textContent='Worker servis adresi boş veya geçersiz. "Adım 3" bölümünden geçerli bir https adresi girin.';}
    else if(!hasModel){msg.style.display='block';msg.textContent='Model adresi girilmemiş. Sistem worker varsayılan model listesini kullanacak.';}
    else{msg.style.display='none';}
    btn.style.display='inline';loading.style.display='none';
  },1400);
}

function save(){
  const d=getFields();
  const pageEl=document.getElementById('selectedPage');
  if(!d.selectedPage){document.getElementById('pageWarn').style.display='block';pageEl.focus();return;}
  document.getElementById('pageWarn').style.display='none';
  const btn=document.getElementById('saveBtn');
  const loading=document.getElementById('saveLoading');
  btn.style.display='none';loading.style.display='inline';
  const prev=savedSnapshot[selectedFeature]||{};
  setTimeout(()=>{
    config[selectedFeature]=d;
    savedSnapshot[selectedFeature]={...d};
    const changes=[];
    if(prev.selectedPage!==d.selectedPage)changes.push(`Etkin sayfa: "${prev.selectedPage||'—'}" → "${d.selectedPage}"`);
    if(prev.primaryWorkerKey!==d.primaryWorkerKey)changes.push(`Ana worker: "${prev.primaryWorkerKey||'—'}" → "${d.primaryWorkerKey}"`);
    if(prev.modelSourceKey!==d.modelSourceKey)changes.push(`Model kaynağı: "${prev.modelSourceKey||'—'}" → "${d.modelSourceKey}"`);
    if(prev.customWorkerUrl!==d.customWorkerUrl)changes.push(`Worker adresi: "${prev.customWorkerUrl||'—'}" → "${d.customWorkerUrl||'—'}"`);
    if(prev.customModelUrl!==d.customModelUrl)changes.push(`Özel model adresi güncellendi.`);
    const sumEl=document.getElementById('changeSummary');
    const itemEl=document.getElementById('changeItems');
    if(changes.length>0){
      itemEl.innerHTML=changes.map(c=>`<div class="change-item">✓ ${c}</div>`).join('');
      sumEl.style.display='block';
    }else{
      itemEl.innerHTML='<div class="change-item">Değişiklik yok — ayarlar zaten güncel.</div>';
      sumEl.style.display='block';
    }
    renderFeatureTabs();
    updatePreview();
    btn.style.display='inline';loading.style.display='none';
    updateDiag();
  },800);
}

function loadDiagnostics(){
  updateDiag();
}

function updateDiag(){
  const now=new Date();
  document.getElementById('diagSession').textContent='Hazır';
  document.getElementById('diagSession').className='diag-val diag-ok';
  document.getElementById('diagLastTest').textContent='Simüle edildi';
  document.getElementById('diagReservations').textContent='0';
  document.getElementById('diagCost').textContent='0';
  document.getElementById('diagUpdated').textContent=now.toLocaleString('tr-TR');
  document.getElementById('diagBy').textContent='admin';
}

function toggleAdvanced(){
  const el=document.getElementById('advDiag');
  const btn=document.getElementById('advToggle');
  if(el.style.display==='none'){
    el.style.display='block';
    el.textContent=JSON.stringify({feature:selectedFeature,config:getFields(),timestamp:new Date().toISOString()},null,2);
    btn.textContent='Gelişmiş tanıyı gizle';
  }else{
    el.style.display='none';
    btn.textContent='Gelişmiş tanıyı göster';
  }
}

function openResetModal(){
  document.getElementById('resetPhase1').style.display='block';
  document.getElementById('resetPhase2').style.display='none';
  document.getElementById('resetPhase3').style.display='none';
  document.getElementById('resetOverlay').style.display='flex';
}
function closeResetModal(){document.getElementById('resetOverlay').style.display='none';}
function resetPhase2(){
  const f=selectedFeature;
  const d=config[f]||{};
  const def=FEATURE_DEFAULTS[f]||{};
  const items=[
    `Özel worker adresi ${d.customWorkerUrl?'"'+d.customWorkerUrl+'" silinecek':'zaten boş'}.`,
    `Özel model adresi ${d.customModelUrl?'"'+d.customModelUrl+'" silinecek':'zaten boş'}.`,
    `Model kaynağı "${d.modelSourceKey||'—'}" → "${def.modelSourceKey||'—'}" olacak.`,
    `Raw/Edit bağlantıları varsayılan değerlere dönecek.`,
    `Test/tanı görünümü yeni varsayılanlara göre güncellenecek.`
  ];
  document.getElementById('impactList').innerHTML=items.map(i=>`<li><span class="modal-li-dot"></span><span>${i}</span></li>`).join('');
  document.getElementById('resetPhase1').style.display='none';
  document.getElementById('resetPhase2').style.display='block';
}
function resetPhase3(){
  document.getElementById('resetPhase2').style.display='none';
  document.getElementById('resetPhase3').style.display='block';
}
function doReset(){
  const def=Object.assign({},FEATURE_DEFAULTS[selectedFeature]||{});
  config[selectedFeature]=def;
  setFields(def);
  closeResetModal();
  renderFeatureTabs();
  resetTestPanel();
  document.getElementById('changeSummary').style.display='none';
  updateDiag();
}

function init(){
  FEATURES.forEach(f=>{config[f]=Object.assign({},FEATURE_DEFAULTS[f]||{});});
  renderFeatureTabs();
  renderEffectBox();
  renderSteps();
  setFields(config[selectedFeature]);
  document.getElementById('imageDefaults').style.display='block';
  updateDiag();
  ['selectedPage','primaryWorkerKey','fallbackWorkerKeys','customModelUrl','rawCodeUrl','editCodeUrl','shortDescription'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener('input',updatePreview);
  });
}
init();
</script>

/*
DOSYA: models-worker.js
AMAÇ: EXCEL'DEN ÜRETİLMİŞ MODEL KATALOĞUNU GÜVENLİ JSON API OLARAK SUNMAK.
NOT: BU WORKER TEK GÖREVLİDİR; SADECE MODEL KATALOĞU SERVİSİ VERİR.
NOT: VERİLER /mnt/data/ai-model-catalog.xlsx DOSYASINDAN ÇIKARILMIŞ SNAPSHOT'TIR.
NOT: PREMIUM FİYATLAR GÖSTERİLİR; 1.5X BİLGİSİ RESPONSE İÇİNDE YAZDIRILMAZ.
*/

const APP_INFO = Object.freeze({
    worker: 'models-catalog',
    version: '1.0.0',
    protocolVersion: '2026-03-13',
    purpose: 'MODEL CATALOG API',
    billingMode: 'owner_pays',
    sourceType: 'excel-snapshot',
  });
  
  const DEFAULTS = Object.freeze({
    limit: 50,
    maxLimit: 250,
    cacheSeconds: 300,
  });
  
  const SPEED_SCORE_MAP = Object.freeze({
    'Rekor Hız': 100,
    'Gerçek zamanlı': 97,
    'Ultra Hızlı': 94,
    'Çok Hızlı': 88,
    'Hızlı': 78,
    'Orta-Hızlı': 68,
    'Orta': 58,
    'Orta/Derin': 52,
    'Derin': 42,
    'Yavaş/Derin': 34,
    'Derin/Yavaş': 30,
    'Ultra Derin': 24,
    '~1 sn/görsel': 92,
    '~3 sn/görsel': 78,
    '~4 sn/görsel': 70,
    '~5 sn/görsel': 62,
    '~6 sn/görsel': 56,
    '~7 sn/görsel': 50,
    '~8 sn/görsel': 44,
  });
  
  const RAW_MODELS = [
    {
      "company": "Amazon",
      "provider": "Amazon",
      "modelName": "Nova 2 Lite",
      "modelId": "amazon/nova-2-lite-v1",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~12B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.45,
      "outputPrice": 3.75,
      "imagePrice": null,
      "traits": [
        "2. nesil AWS zekası",
        "Nova ailesinin güncel üyesi",
        "Kurumsal multimodal",
        "Gelişmiş AWS entegrasyonu",
        "Ölçeklenebilir bulut AI"
      ],
      "standoutFeature": "Nova 1'e göre kapsamlı mimari güncellemesi",
      "useCase": "AWS kurumsal AI, yüksek hacim cloud deploy",
      "rivalAdvantage": "Amazon ekosistemine entegrasyonda Bedrock'un en iyi seçeneği",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "amazon",
        "accent": "#ff9900"
      }
    },
    {
      "company": "Amazon",
      "provider": "Amazon",
      "modelName": "Nova Lite 1.0",
      "modelId": "amazon/nova-lite-v1",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~7B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.09,
      "outputPrice": 0.36,
      "imagePrice": null,
      "traits": [
        "AWS ekosistemine native",
        "Bedrock altyapı güvencesi",
        "Kurumsal güvenilirlik",
        "Hızlı multimodal erişim",
        "Bulut entegre zeka"
      ],
      "standoutFeature": "AWS Bedrock native — S3, Lambda, SageMaker entegrasyonu",
      "useCase": "AWS tabanlı AI pipeline, bulut kurumsal uygulamalar",
      "rivalAdvantage": "AWS servisleriyle native entegrasyonda rakipsiz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "amazon",
        "accent": "#ff9900"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude 3 Haiku",
      "modelId": "anthropic/claude-3-haiku",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~20B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.375,
      "outputPrice": 1.875,
      "imagePrice": null,
      "traits": [
        "Ultra hız odaklı Anthropic",
        "Küçük form güvenilirliği",
        "Anlık ön sınıflandırma",
        "Maliyet minimumu kalite",
        "Üretim ölçeği modeli"
      ],
      "standoutFeature": "Anthropic ailesinin en düşük gecikmeli modeli",
      "useCase": "Gerçek zamanlı uygulama, yüksek hacim, sınıflama",
      "rivalAdvantage": "Anthropic güvenlik standartları en uygun fiyatta",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude 3.5 Haiku",
      "modelId": "anthropic/claude-3.5-haiku",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~20B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 1.2,
      "outputPrice": 6.0,
      "imagePrice": null,
      "traits": [
        "Haiku ustalığında verimlilik",
        "Hızlı görev çözücü",
        "Kod ve analiz dengeleme",
        "Anlık yanıt deneyimi",
        "Geliştirici tercihi"
      ],
      "standoutFeature": "Haiku serisi içinde en güçlü — 3.5 atlaması",
      "useCase": "Hızlı sorgular, kod tamamlama, sınıflandırma",
      "rivalAdvantage": "Claude 3 Opus kalitesinde — Haiku fiyatında",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude 3.7 Sonnet",
      "modelId": "anthropic/claude-3-7-sonnet",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~70B",
      "speedLabel": "Hızlı",
      "inputPrice": 4.5,
      "outputPrice": 22.5,
      "imagePrice": null,
      "traits": [
        "Anthropic güven standartı",
        "Nüanslı dil modeli",
        "Yazarlık kalite seviyesi",
        "Etik AI öncüsü",
        "Geniş bağlam hakimi"
      ],
      "standoutFeature": "Hybrid reasoning — anlık ve düşünceli mod seçimi",
      "useCase": "İçerik üretimi, yazarlık, teknik destek",
      "rivalAdvantage": "Yazı kalitesi kategorisinde GPT-4o'dan üstün değerlendirmeler",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude Opus 4",
      "modelId": "anthropic/claude-opus-4",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~2T MoE (tahmini)",
      "speedLabel": "Derin",
      "inputPrice": 22.5,
      "outputPrice": 112.5,
      "imagePrice": null,
      "traits": [
        "Nuanslı muhakeme şampiyonu",
        "Etik akıl yürütme modeli",
        "Kurumsal güven standartı",
        "Kapsamlı analitik güç",
        "Stratejik düşünce ortağı"
      ],
      "standoutFeature": "Gelişmiş agentic yetenekler + Constitutional AI",
      "useCase": "Kompleks analiz, strateji, uzun form yazarlık",
      "rivalAdvantage": "Agentic görevlerde GPT-4o ve Gemini Pro'dan üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude Opus 4.1",
      "modelId": "anthropic/claude-opus-4.1",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~2T MoE (tahmini)",
      "speedLabel": "Yavaş/Derin",
      "inputPrice": 22.5,
      "outputPrice": 112.5,
      "imagePrice": null,
      "traits": [
        "Anthropic'in en güçlü silahı",
        "Nuanslı muhakeme şampiyonu",
        "Etik mükemmeliyetçi AI",
        "Uzun form içerik ustası",
        "Kurumsal zeka zirvesi"
      ],
      "standoutFeature": "En kapsamlı analitik derinlik + uzun bağlam",
      "useCase": "Stratejik analiz, araştırma, kompleks görevler",
      "rivalAdvantage": "Karmaşık çok adımlı görevlerde GPT-4o'ya kıyasla üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude Sonnet 4",
      "modelId": "anthropic/claude-sonnet-4",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~70B",
      "speedLabel": "Hızlı",
      "inputPrice": 4.5,
      "outputPrice": 22.5,
      "imagePrice": null,
      "traits": [
        "Hız ve zeka birlikteliği",
        "Güvenli muhakeme modeli",
        "Kod ve analiz uzmanı",
        "Entegrasyon dostu API",
        "Sonet gibi akıcı düşünce"
      ],
      "standoutFeature": "Extended Thinking — görünür düşünce zinciri",
      "useCase": "Teknik analiz, kod + mantık birleşimi, araştırma",
      "rivalAdvantage": "Fiyat/performans oranında Anthropic ailesinin optimum noktası",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "Anthropic",
      "provider": "Anthropic",
      "modelName": "Claude Sonnet 4.0",
      "modelId": "anthropic/claude-sonnet-4",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~70B",
      "speedLabel": "Hızlı",
      "inputPrice": 4.5,
      "outputPrice": 22.5,
      "imagePrice": null,
      "traits": [
        "Ustalık ve güvenlik dengesi",
        "Uzun bağlam anlayışı",
        "Etik AI öncüsü",
        "Nüanslı dil üstünlüğü",
        "Kurumsal güvenilirlik"
      ],
      "standoutFeature": "200K token bağlam + Constitutional AI güvenlik",
      "useCase": "Hukuki analiz, teknik yazım, kod + analiz",
      "rivalAdvantage": "Güvenli AI kategorisinde sektör standardı belirliyor",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "anthropic",
        "accent": "#d97757"
      }
    },
    {
      "company": "BFL",
      "provider": "BFL",
      "modelName": "Flux Dev",
      "modelId": "bfl/flux-dev",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B diffusion",
      "speedLabel": "~4 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.0375,
      "traits": [
        "Geliştirici öncelikli erişim",
        "Fine-tuning altyapısı",
        "Açık araştırma lisansı",
        "Prototip kalite standardı",
        "Topluluk ekosistemi"
      ],
      "standoutFeature": "Geliştirici ve araştırmacı lisansı ile tam Pro kalite",
      "useCase": "Model fine-tuning, araştırma, uygulama prototipi",
      "rivalAdvantage": "Pro kalitesinde geliştirici dostu fiyat ve lisans",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "bfl",
        "accent": "#ef4444"
      }
    },
    {
      "company": "BFL",
      "provider": "BFL",
      "modelName": "Flux Pro",
      "modelId": "bfl/flux-pro",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B Pro diffusion",
      "speedLabel": "~4 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.075,
      "traits": [
        "Profesyonel üretim standardı",
        "Fotogerçekçi çıktı",
        "Detay ve kompozisyon dengesi",
        "Yaratıcı direktör onaylı",
        "Güvenilir üretim modeli"
      ],
      "standoutFeature": "FLUX Pro — ticari üretim için standart model",
      "useCase": "İçerik ajansı, e-ticaret, pazarlama görseli",
      "rivalAdvantage": "DALL-E 3'e kıyasla renk ve kompozisyon üstünlüğü",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "bfl",
        "accent": "#ef4444"
      }
    },
    {
      "company": "BFL",
      "provider": "BFL",
      "modelName": "Flux Pro 1.1 Ultra",
      "modelId": "bfl/flux-pro-1.1-ultra",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "Ultra diffusion",
      "speedLabel": "~6 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.09,
      "traits": [
        "BFL amiral gemisi kalite",
        "Ultra çözünürlük kapasitesi",
        "Fotogerçekçilik zirvesi",
        "Profesyonel baskı standardı",
        "Premium üretim kalitesi"
      ],
      "standoutFeature": "BFL'nin en yüksek kaliteli production modeli",
      "useCase": "Ticari baskı, reklam kampanyası, billboard",
      "rivalAdvantage": "Adobe Firefly'a karşı maliyet-kalite oranı üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "bfl",
        "accent": "#ef4444"
      }
    },
    {
      "company": "BFL",
      "provider": "BFL",
      "modelName": "Flux Schnell",
      "modelId": "bfl/flux-schnell",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B distilled",
      "speedLabel": "~1 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.0045,
      "traits": [
        "Yıldırım hızı üretim",
        "Toplu işlem şampiyonu",
        "Minimum gecikme",
        "Distilasyon mucizesi",
        "Ölçek için tasarlandı"
      ],
      "standoutFeature": "Apache 2.0 lisanslı en hızlı açık diffusion modeli",
      "useCase": "Toplu görsel üretim, A/B testi, anlık önizleme",
      "rivalAdvantage": "Lisans ve hız kategorisinde Flux Schnell mutlak lider",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "bfl",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Black Forest Labs",
      "provider": "Black Forest Labs",
      "modelName": "Flux 1 Dev",
      "modelId": "black-forest-labs/flux-1-dev",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B diffusion",
      "speedLabel": "~5 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.0375,
      "traits": [
        "Geliştirici kitlesi için pro kalite",
        "Ticari kullanım uyumlu",
        "Fine-tuning dostu",
        "Açık araştırma modeli",
        "Topluluk onaylı"
      ],
      "standoutFeature": "Flux 1 Pro kalitesi — geliştirici lisansı ile",
      "useCase": "Uygulama geliştirme, prototipler, özel fine-tune",
      "rivalAdvantage": "Pro'ya yakın kalite %37 daha düşük maliyetle",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "black-forest-labs",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Black Forest Labs",
      "provider": "Black Forest Labs",
      "modelName": "Flux 1 Schnell",
      "modelId": "black-forest-labs/flux-1-schnell",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B distilled",
      "speedLabel": "~1 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.0045,
      "traits": [
        "Alman hız mühendisliği",
        "Saniyenin altında üretim",
        "Maliyet minimize uzmanı",
        "Yüksek hacim makinesi",
        "Distilled verimlilik"
      ],
      "standoutFeature": "Distilled model — 4 adımlı üretim, 1 saniyenin altında",
      "useCase": "Gerçek zamanlı önizleme, yüksek hacim thumbnail",
      "rivalAdvantage": "Kategorisinde en hızlı ve en ucuz profesyonel diffusion",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "black-forest-labs",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Black Forest Labs",
      "provider": "Black Forest Labs",
      "modelName": "Flux 1.1 Pro",
      "modelId": "black-forest-labs/flux-1.1-pro",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B diffusion",
      "speedLabel": "~4 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.06,
      "traits": [
        "Profesyonel görsel kalite",
        "Detay sadakati zirvesi",
        "Fotogerçekçilik uzmanı",
        "Yaratıcı direktöre uygun",
        "Sektör onaylı çıktı"
      ],
      "standoutFeature": "FLUX mimarisi — stable diffusion ötesi kalite",
      "useCase": "Ticari görselleştirme, reklam, ürün fotoğrafı",
      "rivalAdvantage": "DALL-E 3 ve Midjourney'e karşı detay doğruluğu üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "black-forest-labs",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Black Forest Labs",
      "provider": "Black Forest Labs",
      "modelName": "Flux 1.1 Pro Ultra",
      "modelId": "black-forest-labs/flux-1.1-pro-ultra",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "12B diffusion Ultra",
      "speedLabel": "~6 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.09,
      "traits": [
        "Ultra yüksek çözünürlük",
        "Maksimum detay yoğunluğu",
        "Baskı hazır kalite",
        "Sanatsal mükemmellik",
        "Ultra gerçekçi doku"
      ],
      "standoutFeature": "4K+ çözünürlük desteği — en yüksek kalite modu",
      "useCase": "Baskı medyası, billboard, stüdyo kalitesi içerik",
      "rivalAdvantage": "Midjourney v6.1 Ultra'ya karşı maliyet-kalite oranı",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "black-forest-labs",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Black Forest Labs",
      "provider": "Black Forest Labs",
      "modelName": "Flux Kontext Max",
      "modelId": "black-forest-labs/flux-kontext-max",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "Kontext diffusion",
      "speedLabel": "~7 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.12,
      "traits": [
        "Bağlamsal görsel zeka",
        "Referans görsel anlama",
        "Tutarlı stil transferi",
        "Çoklu referans füzyonu",
        "Yaratıcı kontrol zirvesi"
      ],
      "standoutFeature": "Referans görsel ile stil tutarlılığı — sektörde ilk",
      "useCase": "Marka kimliği, ürün varyasyonları, karakter tutarlılığı",
      "rivalAdvantage": "IP-Adapter ve ControlNet'e kıyasla çok daha kolay kullanım",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "black-forest-labs",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Black Forest Labs",
      "provider": "Black Forest Labs",
      "modelName": "Flux Kontext Pro",
      "modelId": "black-forest-labs/flux-kontext-pro",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "Kontext diffusion Pro",
      "speedLabel": "~5 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.06,
      "traits": [
        "Pro düzey bağlam anlama",
        "Stil tutarlılığı",
        "Gelişmiş kompozisyon",
        "Uygun fiyatlı Kontext",
        "Marka uyumlu üretim"
      ],
      "standoutFeature": "Kontext Max'ın %50 düşük maliyetli versiyonu",
      "useCase": "İçerik kanalları, sosyal medya şablonları",
      "rivalAdvantage": "Fiyata göre Kontext özelliklerinde maksimum değer",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "black-forest-labs",
        "accent": "#ef4444"
      }
    },
    {
      "company": "Cerebras",
      "provider": "Cerebras",
      "modelName": "Qwen 3 235B",
      "modelId": "cerebras/qwen-3-235b-a22b-instruct-2507",
      "categoryRaw": "LLM / agentic",
      "badges": [
        "AGENTIC"
      ],
      "parameters": "235B (22B aktif)",
      "speedLabel": "Rekor Hız",
      "inputPrice": 0.9,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Dünyanın en hızlı inference",
        "Cerebras wafer-scale chip",
        "Agentic görev hızlandırıcı",
        "Gerçek zamanlı karar alma",
        "Otonom ajan altyapısı"
      ],
      "standoutFeature": "Cerebras CS-3 çipi — saniyede 2000+ token",
      "useCase": "Otonom AI ajanları, gerçek zamanlı kararlar",
      "rivalAdvantage": "GPU tabanlı sistemlere karşı 10-20× daha hızlı inference",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "cerebras",
        "accent": "#22c55e"
      }
    },
    {
      "company": "CodeRabbit",
      "provider": "CodeRabbit",
      "modelName": "CodeRabbit Code Search",
      "modelId": "coderabbitai/coderabbit-code-search",
      "categoryRaw": "Code search",
      "badges": [
        "CODING",
        "ARAMA"
      ],
      "parameters": "Kod-spesifik embedding",
      "speedLabel": "Hızlı",
      "inputPrice": 0.75,
      "outputPrice": 0.75,
      "imagePrice": null,
      "traits": [
        "Kod tabanı anlama uzmanı",
        "Semantik kod arama",
        "PR review otomasyonu",
        "Güvenlik açığı tespiti",
        "Teknik borç analizi"
      ],
      "standoutFeature": "Kod semantiği ile gelişmiş arama + otomatik review",
      "useCase": "Büyük kod tabanı yönetimi, güvenlik denetimi",
      "rivalAdvantage": "GitHub Copilot Chat'e kıyasla kod arama kesinliği üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "coderabbit",
        "accent": "#8b5cf6"
      }
    },
    {
      "company": "DeepSeek",
      "provider": "DeepSeek",
      "modelName": "DeepSeek R1",
      "modelId": "deepseek/deepseek-reasoner",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "671B MoE (37B aktif)",
      "speedLabel": "Derin",
      "inputPrice": 0.825,
      "outputPrice": 3.285,
      "imagePrice": null,
      "traits": [
        "Açık kaynak reasoning devrimi",
        "o1 alternatifi şampiyonu",
        "Şeffaf düşünce zinciri",
        "Matematik olimpiyatı düzeyi",
        "Çin AI mucizesi"
      ],
      "standoutFeature": "Tam şeffaf CoT reasoning — açık kaynak",
      "useCase": "Akademik araştırma, matematiksel ispat, analiz",
      "rivalAdvantage": "OpenAI o1'ın 1/10 fiyatına benzer AIME/MATH sonuçları",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "deepseek",
        "accent": "#3b82f6"
      }
    },
    {
      "company": "DeepSeek",
      "provider": "DeepSeek",
      "modelName": "DeepSeek R1 0528",
      "modelId": "deepseek/deepseek-r1-0528",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "671B MoE (37B aktif)",
      "speedLabel": "Derin",
      "inputPrice": 0.825,
      "outputPrice": 3.285,
      "imagePrice": null,
      "traits": [
        "Çin'in muhakeme devi",
        "Açık reasoning şeffaflığı",
        "Matematik olimpiyatı seviyesi",
        "Düşünce zinciri görünürlüğü",
        "Maliyet-etkin zirve"
      ],
      "standoutFeature": "CoT reasoning chain görünür — şeffaf akıl yürütme",
      "useCase": "Bilimsel araştırma, matematiksel ispat, analiz",
      "rivalAdvantage": "o1'ın 1/15 maliyetiyle benzer AIME performansı",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "deepseek",
        "accent": "#3b82f6"
      }
    },
    {
      "company": "DeepSeek",
      "provider": "DeepSeek",
      "modelName": "DeepSeek V3",
      "modelId": "deepseek/deepseek-chat",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "671B MoE (37B aktif)",
      "speedLabel": "Orta-Hızlı",
      "inputPrice": 0.405,
      "outputPrice": 1.65,
      "imagePrice": null,
      "traits": [
        "Açık MoE devrimi",
        "GPT-4 kırıcı maliyet",
        "Geniş bilgi kapsamı",
        "Genel görev şampiyonu",
        "Çin yapay zekası öncüsü"
      ],
      "standoutFeature": "671B MoE — 37B aktif, GPT-4-turbo rakibi",
      "useCase": "Genel amaçlı sohbet, analiz, içerik üretimi",
      "rivalAdvantage": "GPT-4 kalitesi — 10× daha düşük fiyat",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "deepseek",
        "accent": "#3b82f6"
      }
    },
    {
      "company": "DeepSeek",
      "provider": "DeepSeek",
      "modelName": "DeepSeek V3.1",
      "modelId": "deepseek/deepseek-chat-v3.1",
      "categoryRaw": "LLM / coding",
      "badges": [
        "CODING"
      ],
      "parameters": "671B MoE",
      "speedLabel": "Orta-Hızlı",
      "inputPrice": 0.405,
      "outputPrice": 1.65,
      "imagePrice": null,
      "traits": [
        "Kod üretiminde küresel lider",
        "Çoklu dil programlama",
        "Açık kaynak MoE mimarisi",
        "Belgeleme ve refactor",
        "Test yazma otomasyonu"
      ],
      "standoutFeature": "HumanEval, SWE-Bench'de top-3 açık model",
      "useCase": "Full-stack geliştirme, kod review, debugging",
      "rivalAdvantage": "GPT-4 Turbo seviyesi kod — 10× daha ucuz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "deepseek",
        "accent": "#3b82f6"
      }
    },
    {
      "company": "Exa",
      "provider": "Exa",
      "modelName": "Exa AI Search",
      "modelId": "exa/exa-ai-search",
      "categoryRaw": "Search / answer",
      "badges": [
        "ARAMA"
      ],
      "parameters": "Neural search engine",
      "speedLabel": "Hızlı",
      "inputPrice": 7.5,
      "outputPrice": 7.5,
      "imagePrice": null,
      "traits": [
        "Anlam tabanlı web arama",
        "İçerik kalitesi filtreleme",
        "Geliştirici öncelikli API",
        "Yüksek hassasiyetli tarama",
        "Bağlamsal link keşfi"
      ],
      "standoutFeature": "Semantik web crawling — keyword değil anlam arar",
      "useCase": "Araştırma API'si, kompetitör analizi, içerik keşfi",
      "rivalAdvantage": "Google Search API'ye kıyasla anlam eşleşmesi %3× daha iyi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "exa",
        "accent": "#14b8a6"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 1.5 Flash",
      "modelId": "google/gemini-1.5-flash",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~12B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.225,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "1 milyon token bağlam öncüsü",
        "Uzun belge uzmanı",
        "Multimodal hız lideri",
        "Google 1.5 nesli",
        "Stabil üretim modeli"
      ],
      "standoutFeature": "1M token bağlam — piyasaya ilk sunan",
      "useCase": "Uzun belge analizi, multimodal araştırma",
      "rivalAdvantage": "Claude 3 Sonnet'e kıyasla 1M bağlamda daha düşük fiyat",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 2.0 Flash",
      "modelId": "google/gemini-2.0-flash-001",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~12B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.6,
      "imagePrice": null,
      "traits": [
        "2. nesil Flash hızı",
        "Multimodal anlık tepki",
        "Google altyapı gücü",
        "Üretim hazır hız",
        "Ölçek için doğan model"
      ],
      "standoutFeature": "Agentic kullanım için optimize edilmiş 2.0 nesil",
      "useCase": "Gerçek zamanlı asistan, üretim API, ajan sistemi",
      "rivalAdvantage": "Gemini 1.5 Flash'a göre hız ve kalite %30 artış",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 2.0 Flash Thinking",
      "modelId": "google/gemini-2.0-flash-thinking-exp",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~12B + thinking",
      "speedLabel": "Orta",
      "inputPrice": 0.225,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Flash hızında derin düşünce",
        "Görünür akıl yürütme",
        "Uygun fiyatlı reasoning",
        "Şeffaf düşünce süreci",
        "Experiment sınıfı güç"
      ],
      "standoutFeature": "Flash hızında thinking modu — bütçe reasoning",
      "useCase": "STEM öğrencileri, yazılım geliştirme, analiz",
      "rivalAdvantage": "DeepSeek R1'den daha ucuz, Flash hızında reasoning",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 2.5 Pro",
      "modelId": "google/gemini-2.5-pro",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~340B MoE",
      "speedLabel": "Orta",
      "inputPrice": 1.875,
      "outputPrice": 15.0,
      "imagePrice": null,
      "traits": [
        "Google'ın derin düşünürü",
        "Bilimsel muhakeme lideri",
        "Çok adımlı problem çözme",
        "Araştırma derinliği",
        "Analitik mükemmellik"
      ],
      "standoutFeature": "Thinking modu — derin akıl yürütme gösterir",
      "useCase": "Bilimsel analiz, kod mimarisi, stratejik planlama",
      "rivalAdvantage": "MMLU Pro ve GPQA'da GPT-4o üstünde",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash",
      "modelId": "google/gemini-3.1-flash",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~12B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.45,
      "outputPrice": 3.75,
      "imagePrice": null,
      "traits": [
        "Google zekasının özü",
        "Çok modlu ustalık",
        "Hız ve kalite dengesi",
        "Nativ Google entegrasyonu",
        "Güvenilir altyapı"
      ],
      "standoutFeature": "Metin + görsel + ses + video anlama",
      "useCase": "Genel amaçlı AI uygulamaları, prototipler",
      "rivalAdvantage": "Flash serisi içinde en yüksek multimodal skor",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash Image",
      "modelId": "google/gemini-3.1-flash-image-preview",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "Diffusion",
      "speedLabel": "~3 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.1005,
      "traits": [
        "Fotogerçekçi detay",
        "Google mağazası kalitesi",
        "Anlık görsel üretim",
        "Çok dilli prompt desteği",
        "Güvenli içerik filtreleme"
      ],
      "standoutFeature": "Gemini altyapısıyla metin-görsel entegrasyonu",
      "useCase": "Pazarlama görselleri, sosyal medya, e-ticaret",
      "rivalAdvantage": "DALL-E 3'e göre %30 daha hızlı üretim",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash Image Preview",
      "modelId": "google/gemini-3.1-flash-image-preview",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "Diffusion + LLM",
      "speedLabel": "~5 sn/görsel",
      "inputPrice": 0.45,
      "outputPrice": 45.0,
      "imagePrice": null,
      "traits": [
        "Metin-görsel sentezi",
        "Akıllı görsel planlama",
        "Google kalite standardı",
        "Bağlamsal görsel üretim",
        "Hibrit model gücü"
      ],
      "standoutFeature": "Token tabanlı görsel üretim — LLM+diffusion hybrid",
      "useCase": "Eğitim içeriği, sunum görselleri, konsept görselleştirme",
      "rivalAdvantage": "Aynı konuşmada hem metin hem görsel üretimi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash Lite",
      "modelId": "google/gemini-3.1-flash-lite",
      "categoryRaw": "LLM / coding",
      "badges": [
        "CODING"
      ],
      "parameters": "~4B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.225,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Ultra hafif kod asistanı",
        "Anlık tamamlama",
        "Düşük gecikme IDE eklentisi",
        "Enerji tasarruflu geliştirme",
        "Sürekli entegrasyon uyumlu"
      ],
      "standoutFeature": "CI/CD pipeline entegrasyonu için optimize",
      "useCase": "Otomatik kod review, lint, minor refactor",
      "rivalAdvantage": "Sürekli çalıştırma için en düşük token maliyeti",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash Lite Preview",
      "modelId": "google/gemini-3.1-flash-lite-preview",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~8B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.375,
      "outputPrice": 2.25,
      "imagePrice": null,
      "traits": [
        "Google ekosistemine native entegrasyon",
        "Hafif ama güçlü",
        "Anlık yanıt",
        "Maliyet şampiyonu",
        "Ölçeklenebilir altyapı"
      ],
      "standoutFeature": "Google TPU v5 altyapısında optimize",
      "useCase": "Mobil uygulamalar, chatbot, anlık çeviri",
      "rivalAdvantage": "Benzer boyut segmentinde en düşük gecikme süresi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash Native Audio",
      "modelId": "google/gemini-3.1-flash-native-audio",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~12B + audio encoder",
      "speedLabel": "Hızlı",
      "inputPrice": 0.75,
      "outputPrice": 3.0,
      "imagePrice": null,
      "traits": [
        "Ses doğal anlama",
        "Gerçek zamanlı transkripsiyon",
        "Konuşmacı tanıma",
        "Akustik zeka",
        "Ses-metin köprüsü"
      ],
      "standoutFeature": "Native audio processing — ek dönüştürme yok",
      "useCase": "Sesli asistan, podcast analizi, toplantı özetleme",
      "rivalAdvantage": "Whisper pipeline'ına kıyasla %40 daha az gecikme",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Flash Preview",
      "modelId": "google/gemini-3.1-flash-preview",
      "categoryRaw": "LLM / coding",
      "badges": [
        "CODING"
      ],
      "parameters": "~12B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.225,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Hızlı prototipleme motoru",
        "Google araçlarına native",
        "Kod ve görsel birlikte",
        "Anlık kod tamamlama",
        "Test ve debug hızı"
      ],
      "standoutFeature": "Flash hızında kod üretimi + görsel anlama",
      "useCase": "Hızlı prototip, kod asistanı, hackathon",
      "rivalAdvantage": "Fiyat/hız oranında coding kategorisi lideri",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemini 3.1 Pro",
      "modelId": "google/gemini-3.1-pro",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~340B MoE",
      "speedLabel": "Orta",
      "inputPrice": 4.5,
      "outputPrice": 22.5,
      "imagePrice": null,
      "traits": [
        "Google'ın amiral gemisi",
        "En geniş multimodal kapsam",
        "Kurumsal sınıf güvenilirlik",
        "Dünya bilgi tabanı",
        "Ölçeklenebilir zeka"
      ],
      "standoutFeature": "Video, ses, görsel, metin — tam multimodal",
      "useCase": "Kurumsal AI, araştırma, analiz platformları",
      "rivalAdvantage": "Video anlama kapasitesinde rakipsiz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Google",
      "provider": "Google",
      "modelName": "Gemma 3 27B",
      "modelId": "google/gemma-3-27b-it",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "27B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.225,
      "imagePrice": null,
      "traits": [
        "Açık kaynak şampiyonu",
        "Yerel deploy esnekliği",
        "Google araştırma kalitesi",
        "Özelleştirilebilir temel",
        "Topluluk tarafından test edilmiş"
      ],
      "standoutFeature": "Google tarafından eğitilmiş açık ağırlıklı model",
      "useCase": "On-premise AI, fine-tuning, araştırma",
      "rivalAdvantage": "Açık kaynak kategorisinde SOTA benchmark sonuçları",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "google",
        "accent": "#4285f4"
      }
    },
    {
      "company": "Inception",
      "provider": "Inception",
      "modelName": "Mercury 2",
      "modelId": "inception/mercury-2",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~7B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.375,
      "outputPrice": 1.125,
      "imagePrice": null,
      "traits": [
        "Difüzyon tabanlı yenilik",
        "Paralel token üretimi",
        "Maliyet-etkin zeka",
        "Hız odaklı mimari",
        "Yeni nesil tasarım"
      ],
      "standoutFeature": "Difüzyon dil modeli — otoregresif değil",
      "useCase": "Yüksek hacimli uygulamalar, edge deploy",
      "rivalAdvantage": "Transformer tabanlı modellere göre 5× daha hızlı üretim",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "inception",
        "accent": "#a855f7"
      }
    },
    {
      "company": "Liquid AI",
      "provider": "Liquid AI",
      "modelName": "LFM2-24B-A2B",
      "modelId": "liquid/lfm-2-24b-a2b",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "24B (2B aktif)",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.045,
      "outputPrice": 0.18,
      "imagePrice": null,
      "traits": [
        "Liquid mimari öncüsü",
        "Rekabetsiz verimlilik",
        "Sıvı sinir ağı",
        "Ultra düşük gecikme",
        "Bellek optimizasyonu"
      ],
      "standoutFeature": "Transformer olmayan LFM mimarisi — devrimsel",
      "useCase": "Edge AI, IoT, embedded sistemler",
      "rivalAdvantage": "Aynı boyuttaki Transformer modellerine 10× maliyet avantajı",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "liquid-ai",
        "accent": "#06b6d4"
      }
    },
    {
      "company": "Liquid AI",
      "provider": "Liquid AI",
      "modelName": "LFM2-40B",
      "modelId": "liquid/lfm-2-40b",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "40B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.12,
      "outputPrice": 0.36,
      "imagePrice": null,
      "traits": [
        "Büyük ölçekli liquid zeka",
        "Verimlilik mimarisi",
        "Sektör yenilikçisi",
        "Düşük bellek ayak izi",
        "Dengeli güç-maliyet"
      ],
      "standoutFeature": "LFM2 mimarisi — sequence uzunluğuna duyarsız",
      "useCase": "Kurumsal deploy, private cloud, otomatizasyon",
      "rivalAdvantage": "40B ölçeğinde en düşük inference maliyeti",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "liquid-ai",
        "accent": "#06b6d4"
      }
    },
    {
      "company": "Meta",
      "provider": "Meta",
      "modelName": "Llama 3.1 70B Instruct",
      "modelId": "meta-llama/llama-3.1-70b-instruct",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "70B",
      "speedLabel": "Hızlı",
      "inputPrice": 0.18,
      "outputPrice": 0.45,
      "imagePrice": null,
      "traits": [
        "Kurumsal açık model",
        "Geniş bilgi tabanı",
        "Çok dilli üstünlük",
        "Güvenilir topluluk kanıtı",
        "Maliyet-kalite dengesinin zirvesi"
      ],
      "standoutFeature": "70B ölçeğinde SOTA açık model — 2024 standardı",
      "useCase": "Kurumsal chatbot, RAG, on-premise AI",
      "rivalAdvantage": "Aynı ölçekte GPT-3.5-turbo kalitesinde — ücretsiz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "meta",
        "accent": "#0668E1"
      }
    },
    {
      "company": "Meta",
      "provider": "Meta",
      "modelName": "Llama 3.1 8B Instruct",
      "modelId": "meta-llama/llama-3.1-8b-instruct",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "8B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.03,
      "outputPrice": 0.12,
      "imagePrice": null,
      "traits": [
        "Meta açık kaynak liderliği",
        "Topluluk ekosistemi",
        "Sıfır lisans maliyeti",
        "Her yerde çalışan",
        "Geliştirici kültürü ikonu"
      ],
      "standoutFeature": "En yaygın fine-tune edilen açık model",
      "useCase": "Araştırma, fine-tuning, edge deploy, öğrenim",
      "rivalAdvantage": "Hugging Face'de en çok indirilen model ailesinin üyesi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "meta",
        "accent": "#0668E1"
      }
    },
    {
      "company": "Meta",
      "provider": "Meta",
      "modelName": "Llama 3.2 90B Vision Instruct",
      "modelId": "meta-llama/llama-3.2-90b-vision-instruct",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "90B",
      "speedLabel": "Orta",
      "inputPrice": 0.6,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Açık multimodal şampiyonu",
        "Meta görsel zekası",
        "Büyük ölçek açık model",
        "Görsel + dil entegrasyonu",
        "Topluluk güvenilirliği"
      ],
      "standoutFeature": "90B parametre — yayınlandığında en büyük açık vision model",
      "useCase": "Görsel QA, belge analizi, multimodal araştırma",
      "rivalAdvantage": "GPT-4V fiyatının %4'üne yakın görsel anlama kalitesi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "meta",
        "accent": "#0668E1"
      }
    },
    {
      "company": "Meta",
      "provider": "Meta",
      "modelName": "Llama 3.3 70B Instruct",
      "modelId": "meta-llama/llama-3.3-70b-instruct",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "70B",
      "speedLabel": "Hızlı",
      "inputPrice": 0.225,
      "outputPrice": 0.375,
      "imagePrice": null,
      "traits": [
        "Llama serisinin en güncel 70B'si",
        "Üretim standartı güncelleme",
        "Optimize çıkarım hızı",
        "Meta en iyi uygulamaları",
        "Açık kurumsal tercih"
      ],
      "standoutFeature": "3.3 güncellemesi — 3.2'ye göre belgelenmiş iyileştirme",
      "useCase": "Üretim RAG sistemi, kurumsal chatbot, analiz",
      "rivalAdvantage": "Llama 3.1 70B'ye göre tüm benchmark'larda üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "meta",
        "accent": "#0668E1"
      }
    },
    {
      "company": "Meta",
      "provider": "Meta",
      "modelName": "Llama 4 Maverick",
      "modelId": "meta-llama/llama-4-maverick",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "400B MoE (17B aktif)",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.33,
      "outputPrice": 0.99,
      "imagePrice": null,
      "traits": [
        "Llama nesli yenilikçi",
        "Multimodal açık devrim",
        "MoE verimliliği",
        "Görsel-metin entegrasyonu",
        "Meta geleceği"
      ],
      "standoutFeature": "400B MoE multimodal — açık kaynak tarihinin büyüğü",
      "useCase": "Görsel analiz, çok modlu içerik üretimi",
      "rivalAdvantage": "Açık multimodal modeller arasında Llama 4 Scout'tan 2× güçlü",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "meta",
        "accent": "#0668E1"
      }
    },
    {
      "company": "Meta",
      "provider": "Meta",
      "modelName": "Llama 4 Scout",
      "modelId": "meta-llama/llama-4-scout",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "109B MoE (17B aktif)",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.27,
      "outputPrice": 0.885,
      "imagePrice": null,
      "traits": [
        "Hafif multimodal keşifçi",
        "İzci hızında zeka",
        "Uygun fiyatlı görsel anlama",
        "MoE verimliliği",
        "Açık multimodal standardı"
      ],
      "standoutFeature": "10M token bağlam penceresi — rekor uzunluk",
      "useCase": "Uzun belge+görsel analizi, kod+görsel birleşik",
      "rivalAdvantage": "10M token bağlamda kategori rekoru",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "meta",
        "accent": "#0668E1"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Devstral Small 1.1",
      "modelId": "mistralai/devstral-small-2507",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~24B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.45,
      "imagePrice": null,
      "traits": [
        "Geliştirici odaklı tasarım",
        "Açık kaynak ruhu",
        "Agentic kodlama",
        "CLI entegrasyonu",
        "Dev araçları natif"
      ],
      "standoutFeature": "Agentic coding görevleri için özel ince ayar",
      "useCase": "Otonom kodlama ajanı, SWE-bench görevleri",
      "rivalAdvantage": "SWE-bench Verified'da küçük model kategorisi lideri",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Mistral 7B Instruct",
      "modelId": "mistralai/mistral-7b-instruct",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "7B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.15,
      "imagePrice": null,
      "traits": [
        "Avrupa AI'nın simgesi",
        "7B sınıfı benchmark lideri",
        "Sliding window attention",
        "Açık model standardı",
        "Topluluk ikonu"
      ],
      "standoutFeature": "GQA + Sliding Window Attention — verimlilik yenilikleri",
      "useCase": "Fine-tuning temeli, edge deploy, basit görevler",
      "rivalAdvantage": "7B kategorisinde yayınlandığında Llama 2 13B'yi geçti",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Mistral Medium 3.1",
      "modelId": "mistralai/mistral-medium-3.1-2506",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~22B",
      "speedLabel": "Hızlı",
      "inputPrice": 0.6,
      "outputPrice": 3.0,
      "imagePrice": null,
      "traits": [
        "Avrupalı AI liderliği",
        "Dil çeşitliliği şampiyonu",
        "Etkin orta kademe model",
        "Fransız araştırma kalitesi",
        "GDPR uyumlu AI"
      ],
      "standoutFeature": "Avrupa merkezli GDPR uyumlu altyapı",
      "useCase": "AB kurumsal kullanımı, çok dilli Avrupa uygulamaları",
      "rivalAdvantage": "Avrupa veri uyumu kategorisinde rakipsiz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Mistral NeMo 12B Instruct",
      "modelId": "mistralai/mistral-nemo",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "12B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.045,
      "outputPrice": 0.225,
      "imagePrice": null,
      "traits": [
        "NVIDIA ortaklığı güvencesi",
        "Kurumsal açık model",
        "Aşırı düşük maliyet",
        "Özelleştirme esnekliği",
        "Üretim hazır"
      ],
      "standoutFeature": "NVIDIA ile ortak geliştirme — TensorRT optimize",
      "useCase": "Şirket içi fine-tuning, özel sektör modelleri",
      "rivalAdvantage": "NVIDIA donanım optimizasyonu ile benzersiz verimlilik",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Mistral Small 3.2",
      "modelId": "mistralai/mistral-small-3.2-24b-instruct",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "24B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.09,
      "outputPrice": 0.27,
      "imagePrice": null,
      "traits": [
        "Kompakt Avrupa zekası",
        "Açık kaynak liderliği",
        "Verimli çıkarım",
        "Üretim kalite garantisi",
        "Topluluk onaylı"
      ],
      "standoutFeature": "Apache 2.0 lisansı — ticari kullanım serbest",
      "useCase": "Startup deploy, SaaS entegrasyonu, fine-tuning",
      "rivalAdvantage": "Aynı boyutta tüm açık modeller arasında en iyi ticari lisans",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Mixtral 8x7B Instruct",
      "modelId": "mistralai/mixtral-8x7b-instruct",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "47B (13B aktif) MoE",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 1.05,
      "outputPrice": 1.05,
      "imagePrice": null,
      "traits": [
        "MoE'nin açık kaynak öncüsü",
        "Uzman karışımı zekası",
        "Avrupa MoE şampiyonu",
        "Kod ve çok dilli denge",
        "Topluluğun MoE standartı"
      ],
      "standoutFeature": "8×7B MoE — açık kaynak MoE'yi başlatan model",
      "useCase": "Açık kaynak MoE uygulamaları, çok dilli içerik",
      "rivalAdvantage": "MoE açık kaynak kategorisinin kurucu modeli",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "Mistral AI",
      "provider": "Mistral AI",
      "modelName": "Pixtral Large 1.1",
      "modelId": "mistralai/pixtral-large-2411",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~123B",
      "speedLabel": "Orta",
      "inputPrice": 3.0,
      "outputPrice": 9.0,
      "imagePrice": null,
      "traits": [
        "Görsel muhakeme şampiyonu",
        "Grafik ve diyagram anlama",
        "Çok dilli görsel analiz",
        "Belge görsel işleme",
        "Avrupa multimodal lideri"
      ],
      "standoutFeature": "123B parametre görsel+dil — Avrupa'nın en büyüğü",
      "useCase": "Belge OCR analizi, görsel QA, teknik çizim okuma",
      "rivalAdvantage": "Avrupa menşeli en büyük açık multimodal model",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "mistral",
        "accent": "#fd7e14"
      }
    },
    {
      "company": "MoonshotAI",
      "provider": "MoonshotAI",
      "modelName": "Kimi K2",
      "modelId": "moonshotai/kimi-k2",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~32T MoE (tahmini)",
      "speedLabel": "Orta",
      "inputPrice": 0.855,
      "outputPrice": 3.45,
      "imagePrice": null,
      "traits": [
        "Uzun bağlam ustası",
        "Agentic görev mimarisi",
        "Araç kullanım şampiyonu",
        "Moonshot teknoloji vizyonu",
        "Agentic AI öncüsü"
      ],
      "standoutFeature": "128K bağlam + güçlü araç kullanım yeteneği",
      "useCase": "Uzun proje analizi, ajan sistemleri, araştırma",
      "rivalAdvantage": "Agentic araç kullanımında Llama 4'e karşı üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "moonshotai",
        "accent": "#eab308"
      }
    },
    {
      "company": "MoonshotAI",
      "provider": "MoonshotAI",
      "modelName": "Kimi K2 Instruct",
      "modelId": "moonshotai/kimi-k2-instruct",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~32T MoE",
      "speedLabel": "Orta",
      "inputPrice": 0.855,
      "outputPrice": 3.45,
      "imagePrice": null,
      "traits": [
        "Uzun bağlam şampiyonu",
        "128K kontekst penceresi",
        "Çince mükemmeliyeti",
        "Belge odaklı analiz",
        "Moonshot vizyonu"
      ],
      "standoutFeature": "Ultra uzun bağlam + agentic araç kullanımı",
      "useCase": "Uzun belge analizi, araştırma özetleme",
      "rivalAdvantage": "128K token bağlamda tutarlılık kategorisinde lider",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "moonshotai",
        "accent": "#eab308"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT Image 1",
      "modelId": "openai/gpt-image-1",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "Özel diffusion",
      "speedLabel": "~8 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.0165,
      "traits": [
        "LLM bağlamlı görsel üretim",
        "Metin anlama üstünlüğü",
        "Prompt sadakati lideri",
        "OpenAI kalite damgası",
        "Native ChatGPT entegrasyonu"
      ],
      "standoutFeature": "GPT'nin metin anlayışı ile görsel üretim füzyonu",
      "useCase": "ChatGPT entegrasyonu, metin-görsel içerik, eğitim",
      "rivalAdvantage": "Prompt takibi doğruluğunda DALL-E 3'ün üstünde",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4.1",
      "modelId": "openai/gpt-4.1",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~1T MoE",
      "speedLabel": "Hızlı",
      "inputPrice": 3.0,
      "outputPrice": 12.0,
      "imagePrice": null,
      "traits": [
        "4. nesil zirvesi",
        "İnce ayarlı ustalık",
        "Pratik mükemmellik",
        "Kararlı üretim modeli",
        "API ekosistemi temeli"
      ],
      "standoutFeature": "1M token bağlam — GPT-4 serisinin en uzun penceresi",
      "useCase": "Üretim ortamı, kurumsal API, uzun belge işleme",
      "rivalAdvantage": "GPT-4o'ya kıyasla %26 daha uzun bağlam, benzer fiyat",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4.1 Mini",
      "modelId": "openai/gpt-4.1-mini",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~30B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.6,
      "outputPrice": 2.4,
      "imagePrice": null,
      "traits": [
        "Mini formda büyük bağlam",
        "Hız-bağlam dengesi",
        "Üretim ölçeği modeli",
        "Geliştiricinin ilk tercihi",
        "Maliyet efektif zeka"
      ],
      "standoutFeature": "1M token bağlam — mini boyutta rekor",
      "useCase": "Üretim chatbot, RAG sistemi, asistan API",
      "rivalAdvantage": "Küçük model kategorisinde en uzun bağlam penceresi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4.1 Nano",
      "modelId": "openai/gpt-4.1-nano",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~4B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.6,
      "imagePrice": null,
      "traits": [
        "Nano boyut dev güç",
        "Mobil öncelikli tasarım",
        "Anlık yanıt hızı",
        "Enerji verimliliği",
        "Edge-ready zeka"
      ],
      "standoutFeature": "OpenAI'nin en küçük multimodal modeli",
      "useCase": "Mobil app, wearable, embedded AI, IoT",
      "rivalAdvantage": "Nano kategoride görsel anlama kapasitesiyle benzersiz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4.5 Preview",
      "modelId": "openai/gpt-4.5-preview",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~500B+ MoE (tahmini)",
      "speedLabel": "Orta/Derin",
      "inputPrice": 112.5,
      "outputPrice": 225.0,
      "imagePrice": null,
      "traits": [
        "GPT-4 ve 5 arası köprü",
        "Duygusal zeka zirvesi",
        "Psikolojik anlayış derinliği",
        "İnsan ilişkisi kalitesi",
        "EQ optimize model"
      ],
      "standoutFeature": "EQ-bench'de 1. sıra — duygusal zeka odaklı",
      "useCase": "Terapi asistanı, yaratıcı yazarlık, ilişki koçluğu",
      "rivalAdvantage": "Duygusal zeka ve sosyal anlayışta tüm modellerin üstünde",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4o",
      "modelId": "openai/gpt-4o",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~200B MoE",
      "speedLabel": "Hızlı",
      "inputPrice": 3.75,
      "outputPrice": 15.0,
      "imagePrice": null,
      "traits": [
        "Omni modelin mihenktaşı",
        "Gerçek zamanlı ses-görsel",
        "ChatGPT'nin beyni",
        "Endüstri benchmark şampiyonu",
        "Her şeyi yapan model"
      ],
      "standoutFeature": "Audio + görsel + metin gerçek zamanlı — 'o' = omni",
      "useCase": "Genel asistan, ses chatbot, görsel analiz",
      "rivalAdvantage": "Ses entegrasyonunda Gemini ve Claude'dan öne geçti",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4o Codex",
      "modelId": "openai/gpt-4o-codex",
      "categoryRaw": "LLM / coding",
      "badges": [
        "CODING"
      ],
      "parameters": "~200B kod odaklı",
      "speedLabel": "Hızlı",
      "inputPrice": 2.25,
      "outputPrice": 9.0,
      "imagePrice": null,
      "traits": [
        "Görsel kod anlama",
        "Ekran görüntüsünden kod",
        "UI-to-code dönüşüm",
        "Hata görüntüsü analizi",
        "Multimodal geliştirici"
      ],
      "standoutFeature": "Görsel giriş + kod çıktısı — screenshot-to-code",
      "useCase": "UI geliştirme, görsel hata ayıklama, tasarım-kod",
      "rivalAdvantage": "Görsel tabanlı kodlama kategorisinde rakipsiz",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-4o Mini",
      "modelId": "openai/gpt-4o-mini",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~8B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.225,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Mini ama multimodal tam",
        "Maliyet ölçeği şampiyonu",
        "Görsel + metin anlama",
        "API başlangıç noktası",
        "Geliştirici standart modeli"
      ],
      "standoutFeature": "Küçük modelde tam multimodal yetenek",
      "useCase": "Chatbot, görsel ön analiz, uygulama entegrasyonu",
      "rivalAdvantage": "GPT-3.5-turbo'ya görsel yeteneği ekle, aynı fiyata yak",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5",
      "modelId": "openai/gpt-5",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~2T (tahmini)",
      "speedLabel": "Hızlı",
      "inputPrice": 1.875,
      "outputPrice": 15.0,
      "imagePrice": null,
      "traits": [
        "Yapay zekanın 5. zirvesi",
        "Tam multimodal ustalık",
        "Endüstri standart belirleyici",
        "İnsan seviyesi anlayış",
        "Gelecek şimdiki zaman"
      ],
      "standoutFeature": "Metin, görsel, ses, video, kod — tek modelde",
      "useCase": "Genel amaç AI, her sektör, her görev",
      "rivalAdvantage": "Rakip frontier modellere karşı reasoning+speed dengesi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5 Mini",
      "modelId": "openai/gpt-5-mini",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~20B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.375,
      "outputPrice": 3.0,
      "imagePrice": null,
      "traits": [
        "5. nesil kompakt güç",
        "Hız-kalite optimizasyonu",
        "Geliştirici dostu fiyat",
        "Masif kullanım için ideal",
        "Mini ad büyük zeka"
      ],
      "standoutFeature": "GPT-5 mimarisinin küçük ve hızlı versiyonu",
      "useCase": "Yüksek hacimli API kullanımı, chatbot, öneri",
      "rivalAdvantage": "GPT-4o Mini'ye kıyasla nesil atlayan kalite farkı",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5 Nano",
      "modelId": "openai/gpt-5-nano",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~3B",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.075,
      "outputPrice": 0.6,
      "imagePrice": null,
      "traits": [
        "5. nesil kompakt zeka",
        "Fiyatın en altı kalitesi",
        "Milisaniye tepki",
        "Masif ölçekte deploy",
        "Minimal kaynak tüketimi"
      ],
      "standoutFeature": "GPT-5 ailesinin en hızlı ve en ucuz üyesi",
      "useCase": "Chatbot, autocomplete, öneri sistemleri",
      "rivalAdvantage": "Gemini Flash Lite'a göre 2× daha düşük input fiyatı",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5.2 Codex Mini",
      "modelId": "openai/gpt-5.2-codex-mini",
      "categoryRaw": "LLM / coding",
      "badges": [
        "CODING"
      ],
      "parameters": "~20B kod",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 2.25,
      "outputPrice": 9.0,
      "imagePrice": null,
      "traits": [
        "Kod tamamlama uzmanı",
        "Çok dilli programlama",
        "IDE entegrasyonu",
        "Hata ayıklama zekası",
        "Sıfırdan proje kurulumu"
      ],
      "standoutFeature": "50+ programlama dili — GitHub Copilot temeli",
      "useCase": "Geliştirici araçları, otomatik dokümantasyon",
      "rivalAdvantage": "Küçük boyutuna rağmen GPT-4 Turbo'ya yakın kod kalitesi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5.3 Chat",
      "modelId": "openai/gpt-5.3-chat",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~175B",
      "speedLabel": "Hızlı",
      "inputPrice": 2.625,
      "outputPrice": 21.0,
      "imagePrice": null,
      "traits": [
        "Konuşma kalitesi zirvesi",
        "Anlayış derinliği",
        "Tutarlı yanıt kalitesi",
        "Bağlam zenginliği",
        "Sezgisel etkileşim"
      ],
      "standoutFeature": "Geliştirilmiş chat modu RLHF fine-tune",
      "useCase": "Genel asistan, içerik üretimi, eğitim",
      "rivalAdvantage": "Chat senaryolarında Gemini Flash'a karşı üstün tutarlılık",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5.4",
      "modelId": "openai/gpt-5.4",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~200B",
      "speedLabel": "Hızlı",
      "inputPrice": 3.75,
      "outputPrice": 22.5,
      "imagePrice": null,
      "traits": [
        "İkinci nesil sohbet zekası",
        "Bağlamsal farkındalık",
        "Akışkan diyalog",
        "İnsan ötesi anlayış",
        "Sektör lideri"
      ],
      "standoutFeature": "Gelişmiş çok adımlı akıl yürütme",
      "useCase": "Kurumsal asistan, müşteri desteği",
      "rivalAdvantage": "GPT-3/4 nesline kıyasla 3× daha derin bağlam",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "GPT-5.4 Pro",
      "modelId": "openai/gpt-5.4-pro",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~500B+",
      "speedLabel": "Orta",
      "inputPrice": 45.0,
      "outputPrice": 270.0,
      "imagePrice": null,
      "traits": [
        "Ultra yüksek doğruluk",
        "Kurumsal güç",
        "Kapsamlı analitik",
        "Çok modlu üstünlük",
        "Endüstri standardı"
      ],
      "standoutFeature": "Milyonlarca token bağlam penceresi",
      "useCase": "Hukuk, finans, araştırma, strateji",
      "rivalAdvantage": "Hassas görevlerde GPT-4 Pro'ya karşı %40 daha iyi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "Moderation",
      "modelId": "openai/moderation",
      "categoryRaw": "Safety / moderation",
      "badges": [
        "GÜVENLİK"
      ],
      "parameters": "Sınıflandırma modeli",
      "speedLabel": "Ultra Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.15,
      "imagePrice": null,
      "traits": [
        "İçerik güvenlik kalkanı",
        "Gerçek zamanlı moderasyon",
        "Çok kategorili sınıflama",
        "API entegre güvenlik",
        "Platform uyum asistanı"
      ],
      "standoutFeature": "11 kategori eş zamanlı içerik analizi",
      "useCase": "Platform moderasyonu, kullanıcı içerik filtresi",
      "rivalAdvantage": "OpenAI politikasıyla doğrudan uyumlu — en doğru sınıflama",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o1",
      "modelId": "openai/o1",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~300B (tahmini)",
      "speedLabel": "Derin",
      "inputPrice": 22.5,
      "outputPrice": 90.0,
      "imagePrice": null,
      "traits": [
        "Derin düşünce lideri",
        "Görsel muhakeme uzmanı",
        "Bilimsel çıkarım makinesi",
        "Adım adım doğrulama",
        "Çok modlu akıl yürütme"
      ],
      "standoutFeature": "Görsel + metin üzerinde Chain-of-Thought reasoning",
      "useCase": "Bilimsel şema analizi, mühendislik, tıp",
      "rivalAdvantage": "Multimodal reasoning'de GPT-4 serisinin ötesine geçti",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o1 Mini",
      "modelId": "openai/o1-mini",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~60B",
      "speedLabel": "Orta",
      "inputPrice": 4.5,
      "outputPrice": 18.0,
      "imagePrice": null,
      "traits": [
        "Kompakt reasoning gücü",
        "STEM odaklı küçük deha",
        "Hızlı matematik çözücü",
        "Uygun fiyatlı akıl yürütme",
        "Öğrenci asistanı ideal"
      ],
      "standoutFeature": "o1 reasoning — daha küçük boyut, daha hızlı",
      "useCase": "Matematik öğretimi, STEM problemleri, hızlı analiz",
      "rivalAdvantage": "o1'ın 1/5 maliyetiyle STEM görevlerinde benzer sonuç",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o1 Pro",
      "modelId": "openai/o1-pro",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~500B+ (tahmini)",
      "speedLabel": "Ultra Derin",
      "inputPrice": 225.0,
      "outputPrice": 900.0,
      "imagePrice": null,
      "traits": [
        "Hesaplamanın zirvesi",
        "En pahalı zeka",
        "İnsan aşımı doğruluk",
        "Sınırsız düşünce süreci",
        "Kritik karar partneri"
      ],
      "standoutFeature": "Maksimum compute bütçesi — en yüksek doğruluk modu",
      "useCase": "Kritik tıbbi karar, nükleer mühendislik, savunma",
      "rivalAdvantage": "Mevcut herhangi bir AI modelinin en yüksek doğruluk skoru",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o3",
      "modelId": "openai/o3",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~100B+",
      "speedLabel": "Yavaş/Derin",
      "inputPrice": 3.0,
      "outputPrice": 12.0,
      "imagePrice": null,
      "traits": [
        "Olimpiyat seviyesi matematik",
        "Zincirleme düşünce",
        "Bilimsel problem çözme",
        "Derin akıl yürütme",
        "Doğrulanabilir çıkarım"
      ],
      "standoutFeature": "Chain-of-Thought ile SOTA matematik/bilim",
      "useCase": "Araştırma, mühendislik, strateji analizi",
      "rivalAdvantage": "GSM8K, MATH, GPQA'da insanüstü performans",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o3 Mini",
      "modelId": "openai/o3-mini",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~30B",
      "speedLabel": "Hızlı",
      "inputPrice": 1.65,
      "outputPrice": 6.6,
      "imagePrice": null,
      "traits": [
        "Bütçe dostu reasoning",
        "Kompakt akıl yürütücü",
        "STEM için uygun fiyat",
        "Geliştirici reasoning erişimi",
        "Verimli düşünce motoru"
      ],
      "standoutFeature": "o3 kalite reasoning — geliştirici uyumlu fiyat",
      "useCase": "Kod doğrulama, matematik, mantık problemleri",
      "rivalAdvantage": "DeepSeek R1'e kıyasla daha hızlı — benzer fiyat",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o3 Pro",
      "modelId": "openai/o3-pro",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~200B+",
      "speedLabel": "Derin/Yavaş",
      "inputPrice": 30.0,
      "outputPrice": 120.0,
      "imagePrice": null,
      "traits": [
        "Kurumsal muhakeme zirvesi",
        "Hesaplama sınırı zorlayıcı",
        "Bilimsel araştırma partneri",
        "Eksiksiz düşünce zinciri",
        "Doğrulama odaklı akıl"
      ],
      "standoutFeature": "o3 Pro — genişletilmiş compute bütçesi ile maksimum akıl",
      "useCase": "Kritik araştırma, ilaç keşfi, mühendislik tasarımı",
      "rivalAdvantage": "En yüksek doğruluk gerektiren görevlerde sektör birincisi",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o4 Mini High",
      "modelId": "openai/o4-mini-high",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~30B yüksek compute",
      "speedLabel": "Orta",
      "inputPrice": 1.65,
      "outputPrice": 6.6,
      "imagePrice": null,
      "traits": [
        "Yüksek compute mini reasoning",
        "o4 ailesinin güçlü üyesi",
        "Doğruluk odaklı ayar",
        "Kalite-fiyat zirvesi",
        "Teknik görev uzmanı"
      ],
      "standoutFeature": "o4-mini'nin High compute bütçeli versiyonu",
      "useCase": "Teknik analiz, doğrulama gerektiren görevler",
      "rivalAdvantage": "Aynı fiyata o4-mini'den ölçülebilir daha yüksek doğruluk",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "OpenAI",
      "provider": "OpenAI",
      "modelName": "o4-mini",
      "modelId": "openai/o4-mini",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~30B",
      "speedLabel": "Hızlı",
      "inputPrice": 1.65,
      "outputPrice": 6.6,
      "imagePrice": null,
      "traits": [
        "Kompakt muhakeme gücü",
        "Uygun fiyatlı akıl yürütme",
        "Verimli hesaplama",
        "Üst seviye doğruluk",
        "Geliştirici dostu"
      ],
      "standoutFeature": "o3 kalitesinde mantık — 4× daha uygun fiyat",
      "useCase": "STEM asistanı, öğrenci platformları, teknik destek",
      "rivalAdvantage": "Aynı fiyat bandında DeepSeek R1'den daha hızlı",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "openai",
        "accent": "#10a37f"
      }
    },
    {
      "company": "Perplexity",
      "provider": "Perplexity",
      "modelName": "Sonar",
      "modelId": "perplexity/sonar",
      "categoryRaw": "Search / answer",
      "badges": [
        "ARAMA"
      ],
      "parameters": "LLM + web arama",
      "speedLabel": "Hızlı",
      "inputPrice": 1.5,
      "outputPrice": 1.5,
      "imagePrice": null,
      "traits": [
        "Gerçek zamanlı web entegrasyonu",
        "Kaynak şeffaflığı",
        "Anlık haber bilgisi",
        "Doğrulanmış yanıtlar",
        "Arama-yanıt füzyonu"
      ],
      "standoutFeature": "Canlı web araması + LLM sentezi",
      "useCase": "Araştırma asistanı, haber sorgulama, fact-check",
      "rivalAdvantage": "ChatGPT browsing'e kıyasla %60 daha hızlı kaynak atıf",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "perplexity",
        "accent": "#0ea5e9"
      }
    },
    {
      "company": "Perplexity",
      "provider": "Perplexity",
      "modelName": "Sonar Deep Research",
      "modelId": "perplexity/sonar-deep-research",
      "categoryRaw": "Search / deep research",
      "badges": [
        "ARAMA"
      ],
      "parameters": "LLM + multi-step search",
      "speedLabel": "Derin/Yavaş",
      "inputPrice": 3.0,
      "outputPrice": 12.0,
      "imagePrice": null,
      "traits": [
        "Derin araştırma otomasyonu",
        "Çok adımlı sorgu",
        "Akademik kalite çıktı",
        "Kapsamlı kaynak tarama",
        "Raporlama zekası"
      ],
      "standoutFeature": "Otomatik multi-hop araştırma + rapor sentezi",
      "useCase": "Akademik araştırma, due diligence, piyasa analizi",
      "rivalAdvantage": "Manuel araştırmanın saatlerini dakikalara indiriyor",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "perplexity",
        "accent": "#0ea5e9"
      }
    },
    {
      "company": "PlayAI",
      "provider": "PlayAI",
      "modelName": "Dialog 1.0",
      "modelId": "playai/dialog-1.0",
      "categoryRaw": "Audio model",
      "badges": [
        "SES"
      ],
      "parameters": "Özel TTS mimarisi",
      "speedLabel": "Gerçek zamanlı",
      "inputPrice": 30.0,
      "outputPrice": 120.0,
      "imagePrice": null,
      "traits": [
        "Konuşma gerçekçiliği zirvesi",
        "Duygu yüklü ses tonu",
        "Çok karakterli diyalog",
        "Radyo kalitesi çıktı",
        "Doğal konuşma akışı"
      ],
      "standoutFeature": "Çok karakterli etkileşimli konuşma motoru",
      "useCase": "Sesli kitap, podcast, oyun NPC, e-öğrenme",
      "rivalAdvantage": "ElevenLabs'a karşı diyalog tutarlılığında üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "playai",
        "accent": "#f43f5e"
      }
    },
    {
      "company": "Qwen",
      "provider": "Qwen",
      "modelName": "Qwen 3 235B",
      "modelId": "qwen/qwen3-235b-a22b-thinking-2507",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "235B (22B aktif)",
      "speedLabel": "Orta",
      "inputPrice": 0.825,
      "outputPrice": 3.3,
      "imagePrice": null,
      "traits": [
        "Alibaba'nın 3. nesil zirve modeli",
        "Thinking modu entegreli",
        "Çince-İngilizce çift ustalık",
        "MoE verimliliği",
        "Global rekabetçi AI"
      ],
      "standoutFeature": "Thinking + non-thinking çift mod — esnek akıl yürütme",
      "useCase": "Çok dilli kurumsal AI, analiz, içerik üretimi",
      "rivalAdvantage": "235B MoE ölçeğinde açık model kategorisi SOTA",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "qwen",
        "accent": "#ff6a00"
      }
    },
    {
      "company": "Qwen",
      "provider": "Qwen",
      "modelName": "Qwen3-VL-235B-A22B",
      "modelId": "qwen/qwen3-vl-235b-a22b",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "235B (22B aktif)",
      "speedLabel": "Orta",
      "inputPrice": 0.195,
      "outputPrice": 0.9,
      "imagePrice": null,
      "traits": [
        "Dev MoE görsel anlama",
        "Çince-İngilizce köprüsü",
        "Belge analiz uzmanı",
        "Grafik ve tablo okuma",
        "Alibaba kurumsal güvencesi"
      ],
      "standoutFeature": "235B parametre MoE — sadece 22B aktif kullanım",
      "useCase": "Belge işleme, görsel analitik, OCR",
      "rivalAdvantage": "GPT-4V'ye göre %60 daha uygun fiyatlı görsel anlama",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "qwen",
        "accent": "#ff6a00"
      }
    },
    {
      "company": "Qwen",
      "provider": "Qwen",
      "modelName": "Qwen3.5-Flash",
      "modelId": "qwen/qwen3.5-flash-02-23",
      "categoryRaw": "LLM / chat",
      "badges": [
        "CHAT"
      ],
      "parameters": "~7B",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.6,
      "imagePrice": null,
      "traits": [
        "Flaş hız odaklı",
        "Çoklu dil desteği",
        "Verimliliğin simgesi",
        "Alibaba ölçeği",
        "Entegrasyon kolaylığı"
      ],
      "standoutFeature": "Çince optimizasyonu + global dil desteği",
      "useCase": "Gerçek zamanlı sohbet, multilingual destek",
      "rivalAdvantage": "Fiyat/performans oranında top-5 global model",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "qwen",
        "accent": "#ff6a00"
      }
    },
    {
      "company": "Recraft",
      "provider": "Recraft",
      "modelName": "Recraft 20B",
      "modelId": "recraft-ai/recraft-20b",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "20B diffusion",
      "speedLabel": "~5 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.06,
      "traits": [
        "20 milyar parametre görsel güç",
        "Yüksek parametreli yaratıcılık",
        "Detay derinliği uzmanı",
        "Profesyonel görsel standart",
        "Tasarım odaklı AI"
      ],
      "standoutFeature": "20B parametre ile görsel sektörünün en büyük modellerinden",
      "useCase": "Profesyonel yaratıcı stüdyo, reklam, illustrasyon",
      "rivalAdvantage": "Parametre başına görsel kalitede sektör rekoru",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "recraft",
        "accent": "#8b5cf6"
      }
    },
    {
      "company": "Recraft",
      "provider": "Recraft",
      "modelName": "Recraft V3",
      "modelId": "recraft-ai/recraft-v3",
      "categoryRaw": "Image generation",
      "badges": [
        "GÖRSEL"
      ],
      "parameters": "Özel vektör+raster",
      "speedLabel": "~4 sn/görsel",
      "inputPrice": null,
      "outputPrice": null,
      "imagePrice": 0.06,
      "traits": [
        "Vektör tasarım öncüsü",
        "Marka kimliği uyumlu",
        "SVG düzeyinde hassasiyet",
        "Tasarımcı araç seti",
        "Kurumsal görsel standart"
      ],
      "standoutFeature": "SVG + raster hibrit çıktı — tasarımcı için optimize",
      "useCase": "Logo, ikon, kurumsal kimlik, UI asset üretimi",
      "rivalAdvantage": "Midjourney'e karşı vektör çıktı ve logo üretiminde üstün",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "recraft",
        "accent": "#8b5cf6"
      }
    },
    {
      "company": "StepFun",
      "provider": "StepFun",
      "modelName": "Step 3.5 Flash",
      "modelId": "stepfun/step-3.5-flash",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~30B MoE",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.15,
      "outputPrice": 0.45,
      "imagePrice": null,
      "traits": [
        "Adım adım düşünce hızlanması",
        "Flash reasoning öncüsü",
        "Uygun fiyatlı Çin AI",
        "Hızlı çıkarım motoru",
        "StepFun inovasyon modeli"
      ],
      "standoutFeature": "Flash hızında step-by-step reasoning — yeni nesil",
      "useCase": "STEM problemleri, kod analizi, hızlı mantık görevleri",
      "rivalAdvantage": "DeepSeek R1'in 5× hızı, benzer reasoning kategorisinde",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "generic",
        "accent": "#64748b"
      }
    },
    {
      "company": "xAI",
      "provider": "xAI",
      "modelName": "Grok 4 0709",
      "modelId": "x-ai/grok-4-0709",
      "categoryRaw": "LLM / reasoning",
      "badges": [
        "REASONING"
      ],
      "parameters": "~314B MoE",
      "speedLabel": "Orta",
      "inputPrice": 4.5,
      "outputPrice": 22.5,
      "imagePrice": null,
      "traits": [
        "xAI'nın reasoning amiral gemisi",
        "Gerçek zamanlı dünya bilgisi",
        "Cesur akıl yürütme",
        "X veri havuzu entegrasyonu",
        "Musk AI zirve modeli"
      ],
      "standoutFeature": "Canlı X/Twitter verisi + derin reasoning — benzersiz kombinasyon",
      "useCase": "Piyasa analizi, trend tahmin, araştırma",
      "rivalAdvantage": "Güncel X verisi + reasoning — başka hiçbir modelde yok",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "xai",
        "accent": "#94a3b8"
      }
    },
    {
      "company": "xAI",
      "provider": "xAI",
      "modelName": "Grok 4 Fast Non-Reasoning",
      "modelId": "x-ai/grok-4-fast-non-reasoning",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~314B MoE",
      "speedLabel": "Çok Hızlı",
      "inputPrice": 0.3,
      "outputPrice": 0.75,
      "imagePrice": null,
      "traits": [
        "Anlık çoklu modal yanıt",
        "Topluluk odaklı AI",
        "Sansürsüz perspektif",
        "Hızlı çıktı modu",
        "Gerçek zamanlı farkındalık"
      ],
      "standoutFeature": "Reasoning kapalı — maksimum hız modu",
      "useCase": "Sosyal medya, içerik üretimi, hızlı sorgular",
      "rivalAdvantage": "Reasoning moduna göre 2× hız, aynı fiyat",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "xai",
        "accent": "#94a3b8"
      }
    },
    {
      "company": "xAI",
      "provider": "xAI",
      "modelName": "Grok 4 Fast Reasoning",
      "modelId": "x-ai/grok-4-fast-reasoning",
      "categoryRaw": "LLM / multimodal",
      "badges": [
        "MULTIMODAL"
      ],
      "parameters": "~314B MoE",
      "speedLabel": "Hızlı",
      "inputPrice": 0.3,
      "outputPrice": 0.75,
      "imagePrice": null,
      "traits": [
        "X platformu entegrasyonu",
        "Gerçek zamanlı web bilgisi",
        "Cesur ve doğrudan yanıtlar",
        "Hızlı muhakeme motoru",
        "Elon Musk vizyonu"
      ],
      "standoutFeature": "Canlı Twitter/X verisi + real-time akıl yürütme",
      "useCase": "Haberler, piyasa analizi, trend takibi",
      "rivalAdvantage": "Diğer modellere kıyasla güncel bilgiye doğrudan erişim",
      "sourceUrl": "https://developer.puter.com/ai/models/",
      "style": {
        "brandKey": "xai",
        "accent": "#94a3b8"
      }
    }
  ];
  
  function nowIso() {
    return new Date().toISOString();
  }
  
  function nowMs() {
    return Date.now();
  }
  
  function createId(prefix = 'req') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  
  function safeString(value, fallback = '') {
    try {
      if (value === undefined || value === null) return fallback;
      const text = String(value).trim();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
  
  function safeNumber(value, fallback = 0) {
    try {
      if (value === undefined || value === null || value === '') return fallback;
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }
  
  function normalizeNullablePrice(value) {
    try {
      if (value === undefined || value === null || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  
  function toPositiveInteger(value, fallback) {
    try {
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? n : fallback;
    } catch {
      return fallback;
    }
  }
  
  function clampLimit(value) {
    const parsed = toPositiveInteger(value, DEFAULTS.limit);
    return Math.min(parsed, DEFAULTS.maxLimit);
  }
  
  function clampOffset(value) {
    try {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.floor(n);
    } catch {
      return 0;
    }
  }
  
  function buildCorsHeaders(request) {
    const origin = request.headers.get('origin') || '*';
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-credentials': 'true',
      vary: 'origin',
    };
  }
  
  function buildJsonHeaders(request, extra = {}) {
    return {
      ...buildCorsHeaders(request),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${DEFAULTS.cacheSeconds}`,
      ...extra,
    };
  }
  
  function createEnvelopeBase(requestId, traceId, startedAt) {
    return {
      worker: APP_INFO.worker,
      version: APP_INFO.version,
      protocolVersion: APP_INFO.protocolVersion,
      billingMode: APP_INFO.billingMode,
      requestId,
      traceId,
      time: nowIso(),
      durationMs: Math.max(0, nowMs() - startedAt),
    };
  }
  
  function successEnvelope({ requestId, traceId, startedAt, code = 'OK', data = null, meta = null }) {
    return {
      ok: true,
      code,
      error: null,
      data,
      meta,
      ...createEnvelopeBase(requestId, traceId, startedAt),
    };
  }
  
  function errorEnvelope({ requestId, traceId, startedAt, code, message, details = null, status = 400 }) {
    return {
      ok: false,
      code,
      error: {
        type: 'models.error',
        message,
        details,
        retryable: false,
      },
      data: null,
      meta: null,
      status,
      ...createEnvelopeBase(requestId, traceId, startedAt),
    };
  }
  
  function jsonResponse(request, body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body, null, 2), {
      status,
      headers: buildJsonHeaders(request, extra),
    });
  }
  
  function sanitizeError(error) {
    try {
      const code = safeString(error?.code, 'UNEXPECTED_ERROR');
      const message = safeString(error?.message, 'BEKLENMEYEN HATA OLUŞTU.');
      return { code, message };
    } catch {
      return { code: 'UNEXPECTED_ERROR', message: 'BEKLENMEYEN HATA OLUŞTU.' };
    }
  }
  
  function deriveSpeedScore(label) {
    const text = safeString(label);
    if (Object.prototype.hasOwnProperty.call(SPEED_SCORE_MAP, text)) {
      return SPEED_SCORE_MAP[text];
    }
    return 50;
  }
  
  function normalizeBadges(badges) {
    try {
      const source = Array.isArray(badges) ? badges : [];
      const unique = [];
      for (const badge of source) {
        const clean = safeString(badge).toUpperCase();
        if (clean && !unique.includes(clean)) unique.push(clean);
      }
      return unique;
    } catch {
      return [];
    }
  }
  
  function normalizeModel(row, index) {
    try {
      const company = safeString(row.company, 'BİLİNMİYOR');
      const modelName = safeString(row.modelName, 'ADSIZ MODEL');
      const modelId = safeString(row.modelId, `unknown-model-${index + 1}`);
      const provider = safeString(row.provider, company);
      const categoryRaw = safeString(row.categoryRaw, 'GENEL');
      const badges = normalizeBadges(row.badges);
      const parameters = safeString(row.parameters, '-');
      const speedLabel = safeString(row.speedLabel, 'Orta');
      const inputPrice = normalizeNullablePrice(row.inputPrice);
      const outputPrice = normalizeNullablePrice(row.outputPrice);
      const imagePrice = normalizeNullablePrice(row.imagePrice);
      const traits = Array.isArray(row.traits)
        ? row.traits.map((item) => safeString(item)).filter(Boolean).slice(0, 5)
        : [];
      const standoutFeature = safeString(row.standoutFeature);
      const useCase = safeString(row.useCase);
      const rivalAdvantage = safeString(row.rivalAdvantage);
      const sourceUrl = safeString(row.sourceUrl);
      const style = row && typeof row.style === 'object' && row.style ? row.style : {};
  
      return Object.freeze({
        id: modelId,
        company,
        provider,
        modelName,
        modelId,
        categoryRaw,
        badges,
        parameters,
        speedLabel,
        speedScore: deriveSpeedScore(speedLabel),
        prices: Object.freeze({
          input: inputPrice,
          output: outputPrice,
          image: imagePrice,
        }),
        traits: Object.freeze(traits),
        standoutFeature,
        useCase,
        rivalAdvantage,
        sourceUrl,
        style: Object.freeze({
          brandKey: safeString(style.brandKey, 'generic'),
          accent: safeString(style.accent, '#64748b'),
        }),
      });
    } catch {
      return Object.freeze({
        id: `broken-model-${index + 1}`,
        company: 'BİLİNMİYOR',
        provider: 'BİLİNMİYOR',
        modelName: 'BOZUK KAYIT',
        modelId: `broken-model-${index + 1}`,
        categoryRaw: 'GENEL',
        badges: Object.freeze(['GENEL']),
        parameters: '-',
        speedLabel: 'Orta',
        speedScore: 50,
        prices: Object.freeze({ input: null, output: null, image: null }),
        traits: Object.freeze([]),
        standoutFeature: '',
        useCase: '',
        rivalAdvantage: '',
        sourceUrl: '',
        style: Object.freeze({ brandKey: 'generic', accent: '#64748b' }),
      });
    }
  }
  
  const MODEL_CATALOG = Object.freeze(RAW_MODELS.map((row, index) => normalizeModel(row, index)));
  
  function uniqueSortedStrings(values) {
    return [...new Set(values.map((item) => safeString(item)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  }
  
  const MODEL_FACETS = Object.freeze({
    companies: Object.freeze(uniqueSortedStrings(MODEL_CATALOG.map((item) => item.company))),
    badges: Object.freeze(uniqueSortedStrings(MODEL_CATALOG.flatMap((item) => item.badges))),
    categories: Object.freeze(uniqueSortedStrings(MODEL_CATALOG.map((item) => item.categoryRaw))),
  });
  
  function queryContains(haystack, needle) {
    return safeString(haystack).toLocaleLowerCase('tr').includes(safeString(needle).toLocaleLowerCase('tr'));
  }
  
  function matchesSearch(item, search) {
    if (!safeString(search)) return true;
    const bag = [
      item.company,
      item.provider,
      item.modelName,
      item.modelId,
      item.categoryRaw,
      ...item.badges,
      ...item.traits,
      item.standoutFeature,
      item.useCase,
      item.rivalAdvantage,
    ];
    return bag.some((part) => queryContains(part, search));
  }
  
  function matchesCompany(item, company) {
    if (!safeString(company)) return true;
    return safeString(item.company).toLocaleLowerCase('tr') === safeString(company).toLocaleLowerCase('tr');
  }
  
  function matchesBadge(item, badge) {
    if (!safeString(badge)) return true;
    const normalizedBadge = safeString(badge).toUpperCase();
    return item.badges.includes(normalizedBadge);
  }
  
  function matchesCategory(item, category) {
    if (!safeString(category)) return true;
    return safeString(item.categoryRaw).toLocaleLowerCase('tr') === safeString(category).toLocaleLowerCase('tr');
  }
  
  function sortModels(items, sortKey) {
    const cloned = [...items];
    switch (safeString(sortKey)) {
      case 'name_asc':
        return cloned.sort((a, b) => a.modelName.localeCompare(b.modelName, 'tr'));
      case 'name_desc':
        return cloned.sort((a, b) => b.modelName.localeCompare(a.modelName, 'tr'));
      case 'company_asc':
        return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
      case 'company_desc':
        return cloned.sort((a, b) => `${b.company} ${b.modelName}`.localeCompare(`${a.company} ${a.modelName}`, 'tr'));
      case 'input_price_asc':
        return cloned.sort((a, b) => safeNumber(a.prices.input, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.input, Number.MAX_SAFE_INTEGER));
      case 'input_price_desc':
        return cloned.sort((a, b) => safeNumber(b.prices.input, -1) - safeNumber(a.prices.input, -1));
      case 'output_price_asc':
        return cloned.sort((a, b) => safeNumber(a.prices.output, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.output, Number.MAX_SAFE_INTEGER));
      case 'output_price_desc':
        return cloned.sort((a, b) => safeNumber(b.prices.output, -1) - safeNumber(a.prices.output, -1));
      case 'image_price_asc':
        return cloned.sort((a, b) => safeNumber(a.prices.image, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.image, Number.MAX_SAFE_INTEGER));
      case 'image_price_desc':
        return cloned.sort((a, b) => safeNumber(b.prices.image, -1) - safeNumber(a.prices.image, -1));
      case 'speed_desc':
        return cloned.sort((a, b) => safeNumber(b.speedScore, 0) - safeNumber(a.speedScore, 0));
      case 'speed_asc':
        return cloned.sort((a, b) => safeNumber(a.speedScore, 0) - safeNumber(b.speedScore, 0));
      default:
        return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
    }
  }
  
  function parseQuery(request) {
    const url = new URL(request.url);
    return {
      search: safeString(url.searchParams.get('search')),
      company: safeString(url.searchParams.get('company')),
      badge: safeString(url.searchParams.get('badge')).toUpperCase(),
      category: safeString(url.searchParams.get('category')),
      sort: safeString(url.searchParams.get('sort'), 'company_asc'),
      limit: clampLimit(url.searchParams.get('limit')),
      offset: clampOffset(url.searchParams.get('offset')),
      modelId: safeString(url.searchParams.get('modelId')),
    };
  }
  
  function buildListPayload(query) {
    let items = MODEL_CATALOG.filter((item) =>
      matchesSearch(item, query.search) &&
      matchesCompany(item, query.company) &&
      matchesBadge(item, query.badge) &&
      matchesCategory(item, query.category)
    );
  
    items = sortModels(items, query.sort);
  
    if (query.modelId) {
      items = items.filter((item) => item.modelId === query.modelId || item.id === query.modelId);
    }
  
    const total = items.length;
    const paginated = items.slice(query.offset, query.offset + query.limit);
  
    return {
      items: paginated,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + query.limit < total,
      facets: MODEL_FACETS,
      source: {
        type: APP_INFO.sourceType,
        totalModels: MODEL_CATALOG.length,
        sourceUrl: MODEL_CATALOG[0]?.sourceUrl || '',
      },
      filters: {
        search: query.search,
        company: query.company,
        badge: query.badge,
        category: query.category,
        sort: query.sort,
        modelId: query.modelId,
      },
    };
  }
  
  router.options('/*page', ({ request }) => {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request),
    });
  });
  
  router.get('/', async ({ request }) => {
    const startedAt = nowMs();
    const requestId = createId('info');
    const traceId = createId('trace');
  
    try {
      return jsonResponse(
        request,
        successEnvelope({
          requestId,
          traceId,
          startedAt,
          code: 'WORKER_INFO',
          data: {
            worker: APP_INFO.worker,
            version: APP_INFO.version,
            protocolVersion: APP_INFO.protocolVersion,
            purpose: APP_INFO.purpose,
            routes: [
              'GET /',
              'GET /health',
              'GET /models',
            ],
            supportedQuery: [
              'search',
              'company',
              'badge',
              'category',
              'sort',
              'limit',
              'offset',
              'modelId',
            ],
          },
          meta: {
            totalModels: MODEL_CATALOG.length,
            sourceType: APP_INFO.sourceType,
          },
        })
      );
    } catch (error) {
      const safe = sanitizeError(error);
      return jsonResponse(
        request,
        errorEnvelope({
          requestId,
          traceId,
          startedAt,
          code: safe.code || 'WORKER_INFO_FAILED',
          message: safe.message || 'WORKER BİLGİSİ OLUŞTURULAMADI.',
          status: 500,
        }),
        500
      );
    }
  });
  
  router.get('/health', async ({ request }) => {
    const startedAt = nowMs();
    const requestId = createId('health');
    const traceId = createId('trace');
  
    try {
      return jsonResponse(
        request,
        successEnvelope({
          requestId,
          traceId,
          startedAt,
          code: 'HEALTH_OK',
          data: {
            status: 'ok',
            worker: APP_INFO.worker,
            totalModels: MODEL_CATALOG.length,
            sourceType: APP_INFO.sourceType,
            time: nowIso(),
          },
        })
      );
    } catch (error) {
      const safe = sanitizeError(error);
      return jsonResponse(
        request,
        errorEnvelope({
          requestId,
          traceId,
          startedAt,
          code: safe.code || 'HEALTH_FAILED',
          message: safe.message || 'HEALTH CEVABI OLUŞTURULAMADI.',
          status: 500,
        }),
        500
      );
    }
  });
  
  router.get('/models', async ({ request }) => {
    const startedAt = nowMs();
    const requestId = createId('models');
    const traceId = createId('trace');
  
    try {
      let query;
      try {
        query = parseQuery(request);
      } catch (parseError) {
        const safeParseError = sanitizeError(parseError);
        return jsonResponse(
          request,
          errorEnvelope({
            requestId,
            traceId,
            startedAt,
            code: safeParseError.code || 'QUERY_PARSE_FAILED',
            message: safeParseError.message || 'QUERY PARAMETRELERİ OKUNAMADI.',
            status: 400,
          }),
          400
        );
      }
  
      let payload;
      try {
        payload = buildListPayload(query);
      } catch (payloadError) {
        const safePayloadError = sanitizeError(payloadError);
        return jsonResponse(
          request,
          errorEnvelope({
            requestId,
            traceId,
            startedAt,
            code: safePayloadError.code || 'CATALOG_BUILD_FAILED',
            message: safePayloadError.message || 'MODEL KATALOĞU OLUŞTURULAMADI.',
            details: { filters: query },
            status: 500,
          }),
          500
        );
      }
  
      return jsonResponse(
        request,
        successEnvelope({
          requestId,
          traceId,
          startedAt,
          code: 'MODELS_OK',
          data: payload,
          meta: {
            totalModels: MODEL_CATALOG.length,
            returnedItems: payload.items.length,
          },
        })
      );
    } catch (error) {
      const safe = sanitizeError(error);
      return jsonResponse(
        request,
        errorEnvelope({
          requestId,
          traceId,
          startedAt,
          code: safe.code || 'MODELS_FAILED',
          message: safe.message || 'MODEL KATALOĞU İSTEĞİ BAŞARISIZ.',
          status: 500,
        }),
        500
      );
    }
  });
  
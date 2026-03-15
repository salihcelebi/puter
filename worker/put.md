# Puter.js Playground Örnekleri İçin Detaylı Türkçe README.md

## Genel amaç ve Playground mantığı

Puter.js Playground (docs.puter.com/playground) sayfasındaki örnekler; **Puter.js’i tarayıcıdan doğrudan çalıştırıp** (kurulum/arka uç yazmadan) AI, Cloud Storage, Key-Value Store (NoSQL), Hosting ve Auth gibi servisleri hızlıca denemeniz için hazırlanmış “çalıştırılabilir kod parçalarıdır”. citeturn24search6turn66search8turn67search10

Puter.js’in temel vaadi şudur:  
Uygulamanızda **API key yönetmeden** ve çoğu senaryoda **backend kurmadan** Puter altyapı servislerini çağırabilirsiniz; maliyet modeli de “User-Pays” yaklaşımıyla, altyapı tüketimini **kullanıcı hesabı** üzerinden karşılatmayı hedefler. citeturn66search8turn67search9turn33search7

Güvenlik/izin yaklaşımında da önemli bir varsayılan vardır: kullanıcı bir kez doğrulandıktan sonra uygulamanızın **kendi AppData dizini** (örn. `~/AppData/<app-id>/`) ve **uygulamaya özel sandbox KV store** alanı olur; varsayılan olarak bu alanların **dışına erişemez**. Bu yüzden örneklerin çoğu “dosya yaz”, “kv set” gibi işlemleri doğrudan yapar. citeturn67search11

Aşağıdaki README, Playground menüsündeki örnekleri **tek dosyada anlaşılır hale getirmek** için hazırlanmış “eşdeğer” örnek kodlar içerir. Kodları; Puter Docs’ta yayımlanan API sözleşmesi ve örneklerinden yola çıkarak yeniden yazdım (aynı API çağrıları, aynı davranış). citeturn43view0turn44view0turn64view0turn68search2turn67search1

## Kurulum ve çalıştırma

### Tarayıcı (Playground/HTML sayfası)
Playground mantığıyla aynı şekilde, HTML içine Puter.js’i CDN ile ekleyip global `puter` nesnesini kullanırsınız: citeturn66search8turn67search10

```html
<!doctype html>
<html>
  <body>
    <script src="https://js.puter.com/v2/"></script>
    <script>
      // Burada puter.* API’lerini çağırabilirsiniz
    </script>
  </body>
</html>
```

### Node.js
Node tarafında token ile init ederek kullanılır (Playground’dan farklı olarak “auth token” gerekir): citeturn67search8turn68search4

```js
import { init } from "@heyputer/puter.js/src/init.cjs";
const puter = init(process.env.puterAuthToken);

const resp = await puter.ai.chat("Merhaba!");
console.log(resp);
```

### Kullanıcı doğrulama ne zaman gerekir?
Puter.js; birçok “temel” API çağrısında doğrulamayı otomatik ele alabilse de, kimi durumda **manuel sign-in akışı** uygulamak isteyebilirsiniz. `puter.auth.signIn()` pop-up açtığı için mutlaka **kullanıcı aksiyonundan** (ör. click) tetiklenmelidir. citeturn67search0turn67search1

---

## AI örnekleri

Bu bölüm, Playground’daki **AI** menüsündeki alt örnekleri kapsar. AI tarafındaki ana giriş noktası `puter.ai.chat()` (LLM chat), bunun yanında `txt2img`, `img2txt(OCR)`, `txt2speech`, `speech2speech`, `speech2txt`, `txt2vid` gibi yardımcı fonksiyonlar vardır. citeturn61search4turn43view0turn59view0turn52search0turn61search0turn61search1turn60view0

### Introduction → Image Analysis ve AI → Image Analysis
Playground’da iki yerde “Image Analysis” görürsünüz: biri Introduction altından, biri AI altından. Pratikte her ikisi de görsel bağlam vererek bir modeli konuşturmayı hedefler.

**Kod (görsel URL ile analiz):** (`puter.ai.chat(prompt, image, options)` biçimi docs’ta gösterilir) citeturn43view0

```html
<script src="https://js.puter.com/v2/"></script>
<img id="img" src="https://assets.puter.site/doge.jpeg" style="max-width:320px;">
<script>
(async () => {
  const imageUrl = document.getElementById("img").src;

  // 1) Prompt: modele ne istediğini söylersin
  const prompt = "Bu görselde ne görüyorsun? Kısa maddelerle anlat.";

  // 2) Model seçimi (opsiyonel): docs’ta defaultun gpt-5-nano olduğu belirtilir
  const resp = await puter.ai.chat(prompt, imageUrl, { model: "gpt-5-nano" });

  // 3) Çıktıyı ekrana bas (burada ham objeyi yazdırıyoruz)
  document.body.insertAdjacentHTML("beforeend", `<pre>${JSON.stringify(resp, null, 2)}</pre>`);
})();
</script>
```

**Hangi satır ne yapıyor?**  
`imageUrl` görsel bağlamı sağlar. `puter.ai.chat(prompt, imageUrl, {model})` çağrısı; modele hem metin hem görsel vererek yanıt üretir. citeturn43view0

### Chat with GPT-5 nano
`puter.ai.chat()` dokümanında, `model` verilmezse varsayılanın `gpt-5-nano` olduğu ve örnek kullanım gösterilir. citeturn43view0

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const resp = await puter.ai.chat("What is life?", { model: "gpt-5-nano" });
  document.body.innerHTML = `<pre>${resp.message?.content ?? JSON.stringify(resp, null, 2)}</pre>`;
})();
</script>
```

**Mantık:**  
`puter.ai.chat(prompt, {model})` tek bir prompt gönderir; dönen `ChatResponse` içinden metni `resp.message.content` gibi bir alanda okursunuz (alanlar model/vendor’a göre değişebilir; JSON bastırmak debug için güvenlidir). citeturn43view0

### Stream the response
Streaming senaryosunda `options.stream: true` verilir ve `for await...of` ile parçalar okunur. citeturn43view0

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const prompt = "Rick and Morty nedir? Ayrıntılı anlat.";
  const stream = await puter.ai.chat(prompt, { model: "google/gemini-2.5-flash-lite", stream: true });

  let out = "";
  for await (const chunk of stream) {
    if (chunk?.text) out += chunk.text;
    document.body.innerHTML = out.replaceAll("\n", "<br>");
  }
})();
</script>
```

**Neden stream kullanılır?**  
Uzun yanıtlarda kullanıcı “bekliyor” hissine kapılmasın diye parçalı çıktı üretilir. `chunk.text` geldikçe DOM güncellenir. citeturn43view0turn46search1

### Function Calling
Docs örneğinde `tools` dizisiyle bir “function” tanımı verilir; model tool call isterse `tool_calls` gelir; siz fonksiyonu çalıştırır, sonucu `role: "tool"` mesajıyla geri yollayıp final yanıtı alırsınız. citeturn43view0

```html
<script src="https://js.puter.com/v2/"></script>
<script>
function getWeather(location) {
  // Gerçekte burada bir API çağırabilirsiniz. Örnek statik:
  return `${location}: 22°C, Sunny`;
}

(async () => {
  const question = "Paris'te hava nasıl?";

  const tools = [{
    type: "function",
    function: {
      name: "get_weather",
      description: "Bir şehir için güncel hava durumunu getirir",
      parameters: {
        type: "object",
        properties: { location: { type: "string" } },
        required: ["location"]
      }
    }
  }];

  const first = await puter.ai.chat(question, { tools });

  const toolCall = first?.message?.tool_calls?.[0];
  if (!toolCall) {
    document.body.textContent = "Model tool çağırmadan cevap verdi: " + JSON.stringify(first);
    return;
  }

  const args = JSON.parse(toolCall.function.arguments);
  const result = getWeather(args.location);

  const final = await puter.ai.chat([
    { role: "user", content: question },
    first.message,
    { role: "tool", tool_call_id: toolCall.id, content: result }
  ]);

  document.body.textContent = final?.message?.content ?? String(final);
})();
</script>
```

**Kritik noktalar:**  
Tool tanımı JSON Schema ile yapılır; model `tool_calls` döner; siz `tool_call_id` ile eşleyip sonucu geri beslersiniz. citeturn43view0

### Streaming Function Calls
Docs’ta hem stream hem tool kullanımının birlikte yürütüldüğü akış gösterilir. Buradaki temel fark: akış sırasında **tool_use** benzeri event geldiğinde tool’u çalıştırıp ikinci bir chat akışıyla final çıktıyı yine stream edersiniz. citeturn43view0

### Web Search
OpenAI modellerinin bazıları için `tools: [{type:"web_search"}]` verilerek modelin web araması yapması sağlanır. citeturn43view0

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const resp = await puter.ai.chat(
    "User-Pays Model nedir? Şu sayfayı özetle: https://docs.puter.com/user-pays-model/",
    {
      model: "openai/gpt-5.2-chat",
      tools: [{ type: "web_search" }]
    }
  );

  document.body.textContent = resp?.message?.content ?? String(resp);
})();
</script>
```

**Ne işe yarar?**  
Model, yanıt üretmeden önce web’den bilgi çekebilir (özellikle güncel bilgi gerektiren özet/inceleme işleri). citeturn43view0turn67search9

### AI Resume Analyzer (File handling)
Docs’ta “Working with Files” örneği, bir dosyayı önce Puter FS’e yazıp sonra **messages içinde file referansı** ile modele göndererek analiz yaptırmayı gösterir; iş bitince geçici dosya silinir. citeturn43view0turn44view0turn67search11

Aşağıdaki kod daha kısa bir “öz” versiyondur:

```html
<script src="https://js.puter.com/v2/"></script>
<input id="f" type="file" accept=".pdf,.doc,.docx,.txt">
<button id="go" disabled>Analiz et</button>
<pre id="out"></pre>

<script>
let file;
f.onchange = () => { file = f.files[0]; go.disabled = !file; };

go.onclick = async () => {
  out.textContent = "Yükleniyor...";
  const puterFile = await puter.fs.write(`temp_${Date.now()}_${file.name}`, file); // 1) Dosyayı Puter’a yaz
  try {
    const stream = await puter.ai.chat([
      {
        role: "user",
        content: [
          { type: "file", puter_path: puterFile.path },           // 2) Dosyayı “file content” olarak ver
          { type: "text", text: "Bu CV’yi 5 maddede değerlendir." } // 3) Talimatı ekle
        ]
      }
    ], { model: "anthropic/claude-sonnet-4-6", stream: true });   // 4) Stream ile yanıt al

    let acc = "";
    for await (const part of stream) {
      if (part?.text) acc += part.text;
      out.textContent = acc;
    }
  } finally {
    await puter.fs.delete(puterFile.path); // 5) Geçici dosyayı sil
  }
};
</script>
```

**Hangi kod hangi işe yarıyor?**  
Önce dosya `puter.fs.write()` ile Puter FS’e alınır; sonra chat mesajında `{type:"file", puter_path: ...}` ile model bağlamına eklenir; sonunda dosya silinerek temizlik yapılır. citeturn43view0turn44view0turn67search11

### Chat with OpenAI o3-mini / Chat with Claude Sonnet / DeepSeek / Gemini / xAI (Grok)
Playground’daki bu örneklerin ana farkı **model ID** seçimidir; kod iskeleti aynıdır:

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const modelId = "google/gemini-2.5-flash"; // sadece burayı değiştir!
  const resp = await puter.ai.chat("Kendini tek cümlede tanıt.", { model: modelId });
  document.body.textContent = resp?.message?.content ?? String(resp);
})();
</script>
```

**Model ID örnekleri (Playground örnekleriyle uyumlu tipik seçimler):**
- OpenAI o3-mini benzeri: `openai/o3-mini-high` (Puter Developer model kartında gösterilen ID) citeturn47search0  
- Claude Sonnet: `anthropic/claude-sonnet-4-6` citeturn45search0  
- DeepSeek: `deepseek/deepseek-chat-v3.1` citeturn45search4  
- Gemini: `google/gemini-2.5-flash` veya daha hafif `google/gemini-2.5-flash-lite` citeturn46search0turn46search1  
- Grok: `x-ai/grok-3` citeturn45search6  

**Neden sadece modelId değişiyor?**  
`puter.ai.chat()` tek API ile birçok sağlayıcıyı destekler; sağlayıcılar `model` parametresiyle seçilir. citeturn43view0turn33search5

### Extract Text from Image (OCR) → `puter.ai.img2txt()`
OCR için `puter.ai.img2txt(source)` çağrılır. citeturn52search1

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const text = await puter.ai.img2txt("https://assets.puter.site/letter.png");
  document.body.innerHTML = `<pre>${text}</pre>`;
})();
</script>
```

### Text to Image → `puter.ai.txt2img()`
Temel kullanımda prompt verirsiniz; test geliştirme için `testMode: true` kullanılabilir. citeturn59view0turn54view0

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const img = await puter.ai.txt2img("A picture of a cat.", true); // testMode=true
  document.body.appendChild(img);
})();
</script>
```

### Text to Image with options
Örnek olarak model ve kalite seçebilirsiniz. citeturn54view0turn59view0

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const img = await puter.ai.txt2img("a cat playing the piano", {
    model: "gpt-image-1.5",
    quality: "low"
  });
  document.body.appendChild(img);
})();
</script>
```

### Text to Image with image-to-image generation
Docs örneğinde Gemini image model ile `input_image` (base64) + `input_image_mime_type` verilerek image-to-image yapılır. citeturn59view0

Aşağıdaki kodda base64’ü kısaltılmış placeholder ile gösteriyorum:

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const base64Png = "iVBORw0KGgoAAAANSUhEUgAA..."; // 1) PNG dosyanızın base64 içeriği
  const img = await puter.ai.txt2img("a cat playing piano", {
    model: "gemini-2.5-flash-image-preview",
    input_image: base64Png,
    input_image_mime_type: "image/png"
  });
  document.body.appendChild(img);
})();
</script>
```

### Text to Speech / options / engines / OpenAI / ElevenLabs → `puter.ai.txt2speech()`
`puter.ai.txt2speech()` çağrısı **HTMLAudioElement** döndürür; `audio.play()` ile çalarsınız. Provider/engine/voice gibi ayarlar opsiyonlarla yönetilir. citeturn52search0

**Temel TTS:**
```html
<script src="https://js.puter.com/v2/"></script>
<button id="play">Konuş!</button>
<script>
play.onclick = async () => {
  const audio = await puter.ai.txt2speech("Merhaba! Bu bir test konuşmasıdır.");
  audio.play();
};
</script>
```

**Options ile (AWS Polly örneği: voice + engine + language):**
```html
<script src="https://js.puter.com/v2/"></script>
<button id="play">Neural Engine</button>
<script>
play.onclick = async () => {
  const audio = await puter.ai.txt2speech("Hello world! This is using a neural voice.", {
    voice: "Joanna",
    engine: "neural",
    language: "en-US"
  });
  audio.play();
};
</script>
```

**Engines karşılaştırma fikri (standard / neural / generative):**  
Aynı metni farklı `engine` değerleriyle çağırıp sırayla çalarsınız (Playground’daki “Text-to-Speech Engine Comparison” sayfası bunun UI’lı halidir). citeturn52search0turn37view0

**OpenAI provider ile:**
```js
const audio = await puter.ai.txt2speech("OpenAI alloy voice ile örnek.", {
  provider: "openai",
  model: "gpt-4o-mini-tts",
  voice: "alloy",
  response_format: "mp3",
  instructions: "Neşeli ama aşırı hızlı değil."
});
audio.play();
```
citeturn52search0

**ElevenLabs provider ile:**
```js
const audio = await puter.ai.txt2speech("ElevenLabs ses örneği.", {
  provider: "elevenlabs",
  model: "eleven_multilingual_v2",
  voice: "21m00Tcm4TlvDq8ikWAM",
  output_format: "mp3_44100_128"
});
audio.play();
```
citeturn52search0

### ElevenLabs Voice Changer (Speech-to-Speech) → `puter.ai.speech2speech()`
Bu örnekler Playground’da “Voice changer” olarak geçer. API; bir ses kaydını başka bir sese dönüştürür ve audio element döndürür. citeturn61search1

**Sample clip URL ile:**
```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const audio = await puter.ai.speech2speech("https://assets.puter.site/example.mp3", {
    voice: "21m00Tcm4TlvDq8ikWAM"
  });
  audio.play();
})();
</script>
```

**Dosya input ile (kayıt yükleyip dönüştürme):**  
Mantık: `<input type="file">` → seçilen file’ı `puter.ai.speech2speech(file, options)` ile dönüştür → dönen audio’nun `src`’ini player’a bağla. (Docs sayfasında bu pattern örneklenir.) citeturn61search1

### Transcribe an audio recording into text → `puter.ai.speech2txt()`
Ses dosyasını metne çevirir; basit kullanımda string/obj dönebilir. citeturn61search0turn61search5

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const result = await puter.ai.speech2txt("https://assets.puter.site/example.mp3");
  const text = result.text ?? result;
  document.body.innerHTML = `<pre>${text}</pre>`;
})();
</script>
```

### Text to Video / options → `puter.ai.txt2vid()`
`txt2vid` bir `HTMLVideoElement` döndürür. Test modda hızlı UI testi yapılabilir; gerçek üretim biraz sürebilir. citeturn60view0

**Test mode (kredi harcamadan):**
```js
const video = await puter.ai.txt2vid("A sunrise drone shot flying over a calm ocean", true);
document.body.appendChild(video);
```

**Options (ör. 8 saniye, çözünürlük):**
```js
const video = await puter.ai.txt2vid("A fox sprinting through a snow-covered forest at dusk", {
  model: "sora-2-pro",
  seconds: 8,
  size: "1280x720"
});
document.body.appendChild(video);
```
citeturn60view0

### List AI models → `puter.ai.listModels()`
Kullanılabilir model listesini (metadata ile) döndürür. citeturn61search2turn43view0

```js
const models = await puter.ai.listModels();
console.log(models[0]); // id, provider vb.
```

### List AI model providers → `puter.ai.listModelProviders()`
Provider adlarını liste olarak döndürür. citeturn61search8turn63view1

```js
const providers = await puter.ai.listModelProviders();
console.log(providers);
```

---

## Cloud Storage ve FileSystem örnekleri

Playground’daki “Cloud Storage” ve “FileSystem” örnekleri aynı çekirdeğe dayanır: `puter.fs.*`. Varsayılan olarak uygulamanız, kullanıcı hesabında kendi AppData dizinine serbestçe yazabilir. citeturn67search11turn62search4turn44view0

Aşağıdaki örnekler Playground menüsündeki alt başlıklara karşılık gelir.

### Write File → `puter.fs.write()`
`puter.fs.write(path, data, options)` Puter depolamasında dosya oluşturur/yazar. citeturn44view0turn41search7

```js
await puter.fs.write("hello.txt", "Hello, world!");
```

**Detay:**  
- `path`: hedef dosya yolu  
- `data`: string / File / Blob olabilir  
- `options`: overwrite/dedupeName/createMissingParents gibi davranışları kontrol eder citeturn44view0

### Write a file with deduplication
Aynı isim varsa otomatik “hello (n).txt” gibi yeni ad üretmek için `dedupeName: true`. citeturn44view0

```js
await puter.fs.write("hello.txt", "v1");
const v2 = await puter.fs.write("hello.txt", "v2", { dedupeName: true });
console.log(v2.name);
```

### Create a new file with input coming from a file input
Mantık: `<input type="file">` ile dosyayı alıp `puter.fs.write("hedef", fileObj)` yazmak. citeturn44view0

```html
<input id="f" type="file">
<script>
f.onchange = async () => {
  const file = f.files[0];
  await puter.fs.write(file.name, file);
  alert("Yüklendi: " + file.name);
};
</script>
```

### Create a file in a directory that does not exist
Parent klasörler yoksa `createMissingParents: true`. citeturn44view0

```js
const item = await puter.fs.write(
  "a/b/c/hello.txt",
  "Hello!",
  { createMissingParents: true }
);
console.log(item.path);
```

### Read File → `puter.fs.read()`
Dosyayı `Blob` olarak okur; `blob.text()` ile string’e çevrilir. citeturn62search3

```js
const blob = await puter.fs.read("hello.txt");
const text = await blob.text();
console.log(text);
```

### Make a Directory → `puter.fs.mkdir()`
Klasör oluşturur; `dedupeName` ve `createMissingParents` seçeneklerini destekler. citeturn62search2

```js
await puter.fs.mkdir("my-folder");
```

**Deduplication:**  
```js
await puter.fs.mkdir("hello");
await puter.fs.mkdir("hello", { dedupeName: true });
```
citeturn62search2

**Missing parents:**  
```js
await puter.fs.mkdir("x/y/z", { createMissingParents: true });
```
citeturn62search2

### Read Directory → `puter.fs.readdir()`
Bir dizindeki öğeleri (FSItem listesi) döndürür. citeturn62search0

```js
const items = await puter.fs.readdir("./");
console.log(items.map(i => i.path));
```

### Delete / Delete a directory → `puter.fs.delete()`
Dosya veya dizin siler; örneklerde hem dosya hem dizin silme gösterilir. citeturn62search1

```js
await puter.fs.delete("hello.txt");
await puter.fs.delete("my-folder");
```

### Rename → `puter.fs.rename()`
Dosya/dizin ismini değiştirir. citeturn66search0

```js
await puter.fs.write("hello.txt", "hi");
await puter.fs.rename("hello.txt", "hello-world.txt");
```

### Copy File/Directory → `puter.fs.copy()`
Kaynağı hedefe kopyalar; hedef bir dizinse aynı isimle içine kopyalar. citeturn66search3

```js
await puter.fs.write("a.txt", "data");
await puter.fs.mkdir("dest");
await puter.fs.copy("a.txt", "dest"); // dest/a.txt oluşur
```

### Move File/Directory → `puter.fs.move()`
Kaynağı hedefe taşır; `createMissingParents` ile olmayan klasörleri yaratabilir. citeturn66search1

```js
await puter.fs.write("a.txt", "data");
await puter.fs.mkdir("dest");
await puter.fs.move("a.txt", "dest"); // dest/a.txt
```

**Move a file with missing parent directories (Playground karşılığı):**
```js
await puter.fs.write("a.txt", "data");
await puter.fs.move("a.txt", "new-parent/new-child/a.txt", { createMissingParents: true });
```
citeturn66search1

### Upload → `puter.fs.upload()`
Bir veya çok dosyayı (FileList / Array<File>) Puter FS’e yükler. citeturn66search2turn62search4

```html
<input id="u" type="file" multiple>
<script>
u.onchange = async () => {
  const uploaded = await puter.fs.upload(u.files);
  console.log(uploaded);
};
</script>
```

### Get File/Directory Info
Playground’da “Get File/Directory Info” örneği menüde geçer; Cloud Storage fonksiyon listesinde `puter.fs.stat()` ile bilgi alma bulunduğu belirtilir. citeturn66search5turn62search4  
Bu oturumda `stat()` fonksiyon sayfasını ayrıca açamadığım için burada birebir kod veremiyorum; ancak pratikte hedef bir path için metadata döndüren bir çağrı olarak kullanılır (FSItem türü). citeturn42view0turn66search5

### Bonus: Paylaşılabilir okuma linki → `puter.fs.getReadURL()`
Dosya okuma URL’i üretir. citeturn65search8

```js
const url = await puter.fs.getReadURL("~/myfile.txt");
console.log(url);
```

---

## Key-Value Store örnekleri

Playground’daki KV bölümü; uygulamaya özel, sandbox’lı bir key-value alanını yönetir. KV API; set/get, artırım/azaltım, listeleme, TTL/expire, nested update gibi operasyonlar sağlar. citeturn64view0turn65search5turn67search11

### Set → `puter.kv.set()`
Set, key oluşturur ya da günceller; `true` döndürür. Ayrıca her uygulamanın KV alanı birbirinden izoledir. citeturn65search4turn41search5

```js
const ok = await puter.kv.set("name", "Puter Smith");
console.log(ok); // true
```

### Get → `puter.kv.get()`
Bir anahtarın değerini okur. KV overview örneğinde set ardından get akışı gösterilir. citeturn64view0

```js
await puter.kv.set("name", "Puter Smith");
const val = await puter.kv.get("name");
console.log(val);
```

### Increment / Decrement → `puter.kv.incr()` ve `puter.kv.decr()`
Sayısal değeri artırır/azaltır ve yeni değeri döndürür. citeturn64view0

```js
const n1 = await puter.kv.incr("counter");
const n2 = await puter.kv.decr("counter");
console.log({ n1, n2 });
```

### Increment (Object value) / Decrement (Object value)
Playground menüsünde “Object value” varyantları vardır. KV tarafında “nested alanları tüm objeyi ezmeden değiştirmek” için `update()` gibi fonksiyonlar önerilir; docs’ta `update` ile dot-path kullanımı gösterilir. citeturn65search0turn41search3

Örnek (nested alan güncelleme + TTL yenileme):
```js
await puter.kv.set("profile", { name: "Puter", stats: { score: 10 } });

const updated = await puter.kv.update(
  "profile",
  { "stats.score": 11 },  // nested alan
  3600                    // TTL saniye
);

console.log(updated);
```
citeturn65search0

### Add → `puter.kv.add()`
Mevcut bir key’in içindeki alanlara “ekleme” yapar; object verirseniz dot-path gibi yorumlanır. citeturn65search2turn41search3

```js
await puter.kv.set("profile", { tags: ["alpha"] });
const updated = await puter.kv.add("profile", { "tags": ["beta", "gamma"] });
console.log(updated);
```

### Remove → `puter.kv.remove()`
Playground’da “Remove” örneği vardır; KV fonksiyon listesinde `puter.kv.remove()` “path’e göre değer çıkarma” olarak listelenir. citeturn41search3turn65search0  
Bu oturumda `remove()` fonksiyon sayfasını ayrıca açamadığım için imza/örnek kodu birebir veremiyorum; ancak `update()` ve `add()` ile aynı “dot-path map” yaklaşımına yakın bir kullanım beklenir. citeturn65search0turn41search3

### Update → `puter.kv.update()`
Nested alanları günceller; TTL de yenileyebilir. citeturn65search0

```js
await puter.kv.set("profile", { name: "Puter", stats: { score: 10 } });
const updated = await puter.kv.update("profile", { "name": "Puter Smith", "stats.score": 11 }, 3600);
console.log(updated);
```

### Delete → `puter.kv.del()`
Bir anahtarı siler. KV overview örneğinde del + get akışı var. citeturn64view0turn41search3

```js
await puter.kv.set("name", "Puter Smith");
await puter.kv.del("name");
console.log(await puter.kv.get("name")); // null/undefined olabilir
```

### List → `puter.kv.list()`
Keys’i getirir; `list(true)` ile key-value birlikte gelebilir; pattern ile filtreleme (ör. `is*`) örneklenir. citeturn64view0

```js
await puter.kv.set("name", "Puter Smith");
await puter.kv.set("age", 21);
await puter.kv.set("isCool", true);

console.log(await puter.kv.list());       // ["name","age","isCool"] benzeri
console.log(await puter.kv.list(true));   // [{key,value}, ...] benzeri
console.log(await puter.kv.list("is*"));  // pattern filtre
```

### Flush → `puter.kv.flush()`
Uygulamanın KV alanını tamamen temizler. citeturn64view0turn41search3

```js
await puter.kv.flush();
```

### Expire / Expire At → TTL yönetimi
- `expire(key, ttlSeconds)`: TTL saniye verir citeturn65search3  
- `expireAt(key, timestampSeconds)`: Unix timestamp (saniye) verir citeturn65search1  

```js
await puter.kv.set("name", "Puter Smith");
await puter.kv.expire("name", 1); // 1 saniye sonra silinsin
setTimeout(async () => console.log(await puter.kv.get("name")), 2000);
```

```js
await puter.kv.set("name", "Puter Smith");
await puter.kv.expireAt("name", Math.floor(Date.now()/1000) + 1);
setTimeout(async () => console.log(await puter.kv.get("name")), 2000);
```

### What’s your name?
Playground’daki interaktif örnek; tipik olarak bir input ile “name” key’ini KV’ye kaydedip tekrar okur (KV set/get). citeturn31search8turn64view0turn65search4  

Basit bir karşılık:

```html
<script src="https://js.puter.com/v2/"></script>
<input id="name" placeholder="Adınız">
<button id="save">Kaydet</button>
<pre id="out"></pre>

<script>
(async () => {
  const saved = await puter.kv.get("name");
  if (saved) out.textContent = "Kayıtlı ad: " + saved;
})();

save.onclick = async () => {
  await puter.kv.set("name", name.value);
  out.textContent = "Kaydedildi: " + name.value;
};
</script>
```

---

## Hosting örnekleri

Publishing/Hosting tarafında Puter.js, kullanıcı adına subdomain oluşturup bir dizini web sitesi olarak yayınlamayı sağlar. Hosting API; create/list/delete/update/get operasyonlarını içerir ve docs’ta Playground’daki başlıklarla birebir örneklenmiştir. citeturn68search2turn41search13turn41search2

### Create a simple website displaying “Hello world!”
Özet akış:  
1) Rastgele dizin oluştur → 2) `index.html` yaz → 3) rastgele subdomain ile host et. citeturn68search2turn41search2

```html
<script src="https://js.puter.com/v2/"></script>
<script>
(async () => {
  const dir = puter.randName();
  await puter.fs.mkdir(dir);
  await puter.fs.write(`${dir}/index.html`, "<h1>Hello, world!</h1>");

  const sub = puter.randName();
  const site = await puter.hosting.create(sub, dir);

  document.body.innerHTML = `
    <p>Yayınlandı: <a target="_blank" href="https://${site.subdomain}.puter.site">https://${site.subdomain}.puter.site</a></p>
  `;
})();
</script>
```

### Create 3 random websites and then list them → `puter.hosting.list()`
3 subdomain oluşturup list ile alırsınız; sonra cleanup. citeturn68search1turn68search2

```js
const s1 = puter.randName(), s2 = puter.randName(), s3 = puter.randName();
await puter.hosting.create(s1);
await puter.hosting.create(s2);
await puter.hosting.create(s3);

const all = await puter.hosting.list();
console.log(all.map(x => x.subdomain));

await puter.hosting.delete(s1);
await puter.hosting.delete(s2);
await puter.hosting.delete(s3);
```

### Create a random website then delete it → `puter.hosting.delete()`
Silme işlemi subdomain’i kaldırır (dizin silinmez). citeturn62search7turn68search2

```js
const sub = puter.randName();
await puter.hosting.create(sub);
await puter.hosting.delete(sub);
```

### Update a subdomain to point to a new directory → `puter.hosting.update()`
Subdomain’i yeni bir dizine bağlar. citeturn65search9turn68search2

```js
const sub = puter.randName();
await puter.hosting.create(sub);

const dir = puter.randName();
await puter.fs.mkdir(dir);
await puter.fs.write(`${dir}/index.html`, "<h1>New root</h1>");

await puter.hosting.update(sub, dir);
```

### Retrieve information about a subdomain → `puter.hosting.get()`
Subdomain metadata’sını getirir. citeturn68search0turn68search2

```js
const info = await puter.hosting.get("some-subdomain");
console.log(info);
```

---

## Authentication, Apps, Workers, Networking ve güvenlik notları

Bu başlık altı, Playground’daki “Authentication”, “Apps”, “Workers”, “Networking” menülerini ve Puter.js’in güvenlik varsayılanlarını bir arada özetler.

### Authentication (Playground: Sign in / Sign out / Check sign in / Get user)
Auth API; `signIn`, `signOut`, `isSignedIn`, `getUser` fonksiyonlarını içerir; `signIn()` pop-up açtığı için user action gerektirir. citeturn67search1turn67search0turn67search3turn67search2turn67search4

**Sign in:**
```html
<script src="https://js.puter.com/v2/"></script>
<button id="btn">Sign in</button>
<pre id="out"></pre>
<script>
btn.onclick = async () => {
  const res = await puter.auth.signIn();
  out.textContent = "Signed in: " + JSON.stringify(res, null, 2);
};
</script>
```

**Check sign in:**
```js
console.log(puter.auth.isSignedIn());
```
citeturn67search3

**Get user:**
```js
const user = await puter.auth.getUser();
console.log(user);
```
citeturn67search2

**Sign out:**
```js
puter.auth.signOut();
```
citeturn67search4

**Get user’s monthly usage (Playground’da var):**  
Docs navigasyonunda `getMonthlyUsage()` fonksiyonu listeleniyor. citeturn42view0turn63view0  
Bu oturumda ilgili fonksiyon sayfasına ayrıca erişemediğim için burada birebir kod paylaşamıyorum; ancak Playground’daki örnek, oturum açmış kullanıcı için aylık kullanım metriklerini sorgulama amaçlıdır. citeturn24search6turn42view0

### Güvenlik ve varsayılan izinler
Uygulama doğrulandıktan sonra; AppData dizini ve KV store gibi alanlar varsayılan olarak gelir ve uygulamalar bu sandbox dışına varsayılan olarak erişemez. Ayrıca AI ve Hosting servisleri de varsayılan olarak kullanılabilir servisler arasındadır. citeturn67search11turn67search9

### Apps (Playground: To-Do List / AI Chat / Camera Photo Describer / Text Summarizer)
Bu dört örnek; “örnek uygulama” niteliğinde senaryoları temsil eder. Docs Examples sayfasında bunların hangi Puter modüllerine dayandığı kısaca açıklanır (ör. To-Do = KV Store; AI Chat = AI modülü; Image Describer = Vision; Summarizer = AI chat). citeturn42view0turn41search20

### Apps API (Playground: create/list/delete/update/get)
Playground’da ayrıca “app registration” yönetimi örnekleri vardır. `puter.apps.get()` sayfasındaki örnek; `puter.apps.create(name, url)`, `puter.apps.get(name)`, `puter.apps.delete(name)` akışını gösterir. citeturn68search5turn42view0

Örnek (Create → Get → Delete):
```js
const name = puter.randName();
await puter.apps.create(name, "https://example.com");
const app = await puter.apps.get(name);
console.log(app.uid);
await puter.apps.delete(name);
```
citeturn68search5

`list()` ve `update()` örnekleri Playground menüsünde yer alır (fonksiyonlar docs navigasyonunda listelenir). citeturn42view0turn63view0  
Bu oturumda `puter.apps.list()` ve `puter.apps.update()` sayfalarını ayrıca açamadığım için parametre/örnek kodu burada sabitlemiyorum; ancak Playground’daki örnekler bu fonksiyonlarla “listele” ve “başlık güncelle” gibi akışları gösterir. citeturn24search6turn42view0

### Workers (Playground: Create/List/Get + Workers Management + Authenticated Worker Requests)
Serverless Workers; router tabanlı HTTP endpoint tanımlamayı sağlar (GET/POST, route parametreleri vb.). Docs’ta router ile “Hello World” ve POST JSON body örnekleri verilir. citeturn68search7turn68search4

**Worker içinde basit endpoint:**
```js
router.get("/api/hello", async () => {
  return { message: "Hello, World!" };
});

router.post("/api/user", async ({ request }) => {
  const body = await request.json();
  return { processed: true, body };
});
```
citeturn68search7turn68search4

**Workers Management (Playground sayfasında görülen minimal örnek):**  
Playground’da örnek olarak `/api/random` endpoint’i ile random sayı döndürme gösterilir. citeturn31search7

```js
router.get("/api/random", async () => {
  return { number: Math.floor(Math.random() * 1000) };
});
```
citeturn31search7

**Worker deployment hayat döngüsü (delete örneği üzerinden):**  
`puter.workers.delete(workerName)` dokümanı; worker yaratma/silme ve `puter.workers.get()` ile kontrol akışını örnekler. citeturn62search8  
Bu oturumda `create/list/get` fonksiyon sayfalarına ayrıca erişemediğim için tüm parametreleri sabitlemiyorum; ancak Playground’daki “Create/List/Get worker” örnekleri bu yaşam döngüsünü gösterir. citeturn62search8turn24search6

### Networking (Playground: Basic TCP Socket / TLS Socket / Fetch)
Docs navigasyonunda Networking bölümünde `Socket`, `TLSSocket`, `fetch()` başlıkları bulunur. citeturn42view0turn63view0  
Bu oturumda Networking fonksiyon sayfalarını ayrıca açamadığım için burada birebir Puter API çağrı örneği yazmıyorum; Playground’daki örnekler temel TCP/TLS socket bağlantısı ve HTTP fetch benzeri ağ çağrılarını göstermeyi amaçlar. citeturn24search6turn42view0

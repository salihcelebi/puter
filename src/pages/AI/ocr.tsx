import { useState } from 'react';

export default function OCR() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');

  const runDemoOcr = () => {
    if (!text.trim()) {
      setResult('Lütfen OCR için örnek metin girin.');
      return;
    }

    setResult(`OCR örnek çıktısı: ${text.trim()}`);
  };

  return (
    <section className="max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">OCR</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Bu ekran, yeni sayfa yönetimi sistemi içindeki OCR hedef sayfası olarak eklendi.
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label htmlFor="ocr-input" className="block text-sm font-medium text-zinc-700 mb-2">
          OCR Demo Metni
        </label>
        <textarea
          id="ocr-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Örnek: Faturadaki metni buraya yapıştırın"
          className="w-full min-h-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={runDemoOcr}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            OCR Çalıştır
          </button>
          <span className="text-xs text-zinc-500">Not: Şu an demo çıktı gösterir.</span>
        </div>

        {result && (
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Sonuç</p>
            <p className="text-sm text-zinc-800 whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </div>
    </section>
  );
}

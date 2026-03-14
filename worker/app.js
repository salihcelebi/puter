const WORKER_BASE_URL = "https://turk.puter.work";
let allRows = [];

const els = {
  tableBody: document.getElementById("tableBody"),
  providerFilter: document.getElementById("providerFilter"),
  serviceFilter: document.getElementById("serviceFilter"),
  searchInput: document.getElementById("searchInput"),
  reloadBtn: document.getElementById("reloadBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportExcelBtn: document.getElementById("exportExcelBtn"),
  secretInput: document.getElementById("secretInput"),
  lastUpdated: document.getElementById("lastUpdated"),
  rowCount: document.getElementById("rowCount"),
  logBox: document.getElementById("logBox"),
};

function log(msg) {
  const now = new Date().toLocaleString("tr-TR");
  els.logBox.textContent = `[${now}] ${msg}\n` + els.logBox.textContent;
}

function money(v, currency = "USD") {
  if (v === null || v === undefined || v === "") return "-";
  return `${v} ${currency}`;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map(x => x[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "tr"));
}

function fillSelect(selectEl, values, placeholder) {
  const current = selectEl.value;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
  selectEl.value = current;
}

function getFilteredRows() {
  const provider = els.providerFilter.value.trim().toLowerCase();
  const service = els.serviceFilter.value.trim().toLowerCase();
  const search = els.searchInput.value.trim().toLowerCase();

  return allRows.filter(row => {
    const providerOk = !provider || String(row.provider || "").toLowerCase() === provider;
    const serviceOk = !service || String(row.service_type || "").toLowerCase() === service;

    const haystack = [
      row.provider,
      row.model,
      row.service_type,
      row.price_note,
      row.source_url
    ].join(" ").toLowerCase();

    const searchOk = !search || haystack.includes(search);
    return providerOk && serviceOk && searchOk;
  });
}

function renderTable() {
  const rows = getFilteredRows();
  els.rowCount.textContent = String(rows.length);

  if (!rows.length) {
    els.tableBody.innerHTML = `<tr><td colspan="10">Kayıt bulunamadı.</td></tr>`;
    return;
  }

  els.tableBody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.provider || "-")}</td>
      <td>${escapeHtml(row.model || "-")}</td>
      <td><span class="badge">${escapeHtml(row.service_type || "-")}</span></td>
      <td>${money(row.input_price, row.currency)}</td>
      <td>${money(row.output_price, row.currency)}</td>
      <td>${money(row.image_price, row.currency)}</td>
      <td>${money(row.video_price, row.currency)}</td>
      <td>${escapeHtml(row.currency || "USD")}</td>
      <td>${escapeHtml(row.price_note || "-")}</td>
      <td>${row.source_url ? `<a href="${row.source_url}" target="_blank" rel="noreferrer">Aç</a>` : "-"}</td>
    </tr>
  `).join("");
}

function refreshFilters() {
  fillSelect(els.providerFilter, uniqueValues(allRows, "provider"), "Tüm Sağlayıcılar");
  fillSelect(els.serviceFilter, uniqueValues(allRows, "service_type"), "Tüm Servisler");
}

function buildExcelRows(rows) {
  return rows.map(row => ({
    Provider: row.provider || "",
    Model: row.model || row.model_name || "",
    Model_ID: row.model_id || "",
    Service_Type: row.service_type || "",
    Input_Price_USD_per_1M_Tokens: row.input_price ?? "",
    Output_Price_USD_per_1M_Tokens: row.output_price ?? "",
    Image_Price_USD: row.image_price ?? "",
    Video_Price_USD: row.video_price ?? "",
    Currency: row.currency || "USD",
    Price_Note: row.price_note || "",
    Context_Window: row.context_window || "",
    Max_Output: row.max_output || "",
    Release_Date: row.release_date || "",
    Source_URL: row.source_url || "",
    Updated_At: row.updated_at || ""
  }));
}

function exportFilteredRowsToExcel() {
  const rows = getFilteredRows();

  if (!rows.length) {
    alert("Excel'e aktarılacak kayıt bulunamadı.");
    return;
  }

  if (!window.XLSX) {
    alert("Excel kütüphanesi yüklenemedi.");
    return;
  }

  const data = buildExcelRows(rows);
  const ws = XLSX.utils.json_to_sheet(data);

  ws["!cols"] = [
    { wch: 18 },
    { wch: 34 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 60 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 60 },
    { wch: 24 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Prices");

  const filenameDate = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  XLSX.writeFile(wb, `puter-pricing-${filenameDate}.xlsx`);
  log(`Excel dışa aktarıldı. ${rows.length} kayıt.`);
}

async function loadPrices() {
  log("Fiyatlar yükleniyor...");
  const res = await fetch(`${WORKER_BASE_URL}/api/prices`, { method: "GET" });
  if (!res.ok) throw new Error(`GET /api/prices başarısız: ${res.status}`);

  const data = await res.json();
  allRows = Array.isArray(data.rows) ? data.rows : [];
  els.lastUpdated.textContent = data.updated_at ? new Date(data.updated_at).toLocaleString("tr-TR") : "-";
  refreshFilters();
  renderTable();
  log(`Yüklendi. ${allRows.length} kayıt.`);
}

async function runRefresh() {
  const secret = els.secretInput.value.trim();
  if (!secret) {
    alert("Yönetici gizli anahtarını gir.");
    return;
  }

  log("Manuel tazeleme başlatıldı...");
  const res = await fetch(`${WORKER_BASE_URL}/api/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret
    },
    body: JSON.stringify({ manual: true })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `POST /api/refresh başarısız: ${res.status}`);
  }

  log(`Tazeleme tamamlandı. ${data.count || 0} kayıt güncellendi.`);
  await loadPrices();
}

els.searchInput.addEventListener("input", renderTable);
els.providerFilter.addEventListener("change", renderTable);
els.serviceFilter.addEventListener("change", renderTable);
els.reloadBtn.addEventListener("click", loadPrices);
els.refreshBtn.addEventListener("click", runRefresh);
els.exportExcelBtn.addEventListener("click", exportFilteredRowsToExcel);

loadPrices().catch(err => log(err.message));
const STORAGE_KEY = "atSlotSpecialDayRecords";
const CANDIDATE_STORAGE_KEY = "atSlotNameCandidates";
const TAGS = ["ゾロ目日", "7の日", "周年", "月イチ", "その他"];

const state = {
  records: loadRecords(),
  selectedImage: "",
  summaryMode: "tag",
  activeView: "recommend",
  candidates: loadCandidates(),
};

const $ = (id) => document.getElementById(id);
const yen = new Intl.NumberFormat("ja-JP");

const elements = {
  scanForm: $("scanForm"),
  recordForm: $("recordForm"),
  imageInput: $("imageInput"),
  previewImage: $("previewImage"),
  emptyPreview: $("emptyPreview"),
  ocrStatus: $("ocrStatus"),
  ocrMachineNumber: $("ocrMachineNumber"),
  estimatedMedals: $("estimatedMedals"),
  clearImageButton: $("clearImageButton"),
  resetEditButton: $("resetEditButton"),
  deleteEditingButton: $("deleteEditingButton"),
  editingIdInput: $("editingIdInput"),
  winLoseBanner: $("winLoseBanner"),
  recordsBody: $("recordsBody"),
  summaryHead: $("summaryHead"),
  summaryBody: $("summaryBody"),
  summaryShopFilter: $("summaryShopFilter"),
  summaryTagFilter: $("summaryTagFilter"),
  summaryMachineFilter: $("summaryMachineFilter"),
  recordsShopFilter: $("recordsShopFilter"),
  recordsTagFilter: $("recordsTagFilter"),
  recordsMachineFilter: $("recordsMachineFilter"),
  shopCandidates: $("shopCandidates"),
  machineCandidates: $("machineCandidates"),
  recommendTagInput: $("recommendTagInput"),
  recommendationList: $("recommendationList"),
  exportCsvButton: $("exportCsvButton"),
  importCsvInput: $("importCsvInput"),
};

document.addEventListener("DOMContentLoaded", () => {
  $("dateInput").valueAsDate = new Date();
  syncConfirmFromScan();
  seedCandidatesFromRecords();
  bindEvents();
  renderCandidateControls();
  renderAll();
});

function bindEvents() {
  elements.imageInput.addEventListener("change", handleImageSelect);
  elements.scanForm.addEventListener("submit", handleScan);
  elements.recordForm.addEventListener("submit", handleSaveRecord);
  $("confirmMedalsInput").addEventListener("input", updateWinLoseBanner);
  elements.clearImageButton.addEventListener("click", clearImage);
  elements.resetEditButton.addEventListener("click", resetEditor);
  elements.deleteEditingButton.addEventListener("click", () => {
    const id = elements.editingIdInput.value;
    if (id && confirm("この登録を削除しますか？")) {
      deleteRecord(id);
      resetEditor();
    }
  });
  [elements.summaryShopFilter, elements.summaryTagFilter, elements.summaryMachineFilter].forEach((filter) => {
    filter.addEventListener("change", renderSummary);
  });
  [elements.recordsShopFilter, elements.recordsTagFilter, elements.recordsMachineFilter].forEach((filter) => {
    filter.addEventListener("change", renderRecords);
  });
  elements.recommendTagInput.addEventListener("change", renderRecommendations);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importCsvInput.addEventListener("change", importCsv);
  document.querySelectorAll(".menu-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.summaryMode = tab.dataset.summary;
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      renderSummary();
    });
  });
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function loadCandidates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CANDIDATE_STORAGE_KEY) || "{}");
    return {
      shops: uniqueSorted(parsed.shops || []),
      machines: uniqueSorted(parsed.machines || []),
    };
  } catch {
    return { shops: [], machines: [] };
  }
}

function saveCandidates() {
  localStorage.setItem(CANDIDATE_STORAGE_KEY, JSON.stringify(state.candidates));
}

function seedCandidatesFromRecords() {
  state.records.forEach((record) => {
    addCandidate("shops", record.shop, false);
    addCandidate("machines", record.machine, false);
  });
  saveCandidates();
}

function addCandidate(type, value, shouldRender = true) {
  const name = String(value || "").trim();
  if (!name) return false;
  const normalized = name.toLocaleLowerCase("ja-JP");
  const list = state.candidates[type] || [];
  if (list.some((item) => item.toLocaleLowerCase("ja-JP") === normalized)) return false;
  state.candidates[type] = uniqueSorted([...list, name]);
  saveCandidates();
  if (shouldRender) renderCandidateControls();
  return true;
}

function uniqueSorted(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase("ja-JP");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "ja-JP"));
}

function renderCandidateControls() {
  renderDatalist(elements.shopCandidates, state.candidates.shops);
  renderDatalist(elements.machineCandidates, state.candidates.machines);
  renderSelectOptions(elements.summaryShopFilter, state.candidates.shops, "すべて");
  renderSelectOptions(elements.summaryMachineFilter, state.candidates.machines, "すべて");
  renderSelectOptions(elements.recordsShopFilter, state.candidates.shops, "すべて");
  renderSelectOptions(elements.recordsMachineFilter, state.candidates.machines, "すべて");
  renderSelectOptions(elements.summaryTagFilter, TAGS, "すべて");
  renderSelectOptions(elements.recordsTagFilter, TAGS, "すべて");
}

function renderDatalist(element, values) {
  element.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function renderSelectOptions(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = values.includes(current) ? current : "";
}

function switchView(view) {
  state.activeView = view;
  document.querySelectorAll(".menu-tab").forEach((tab) => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const isActive = panel.dataset.viewPanel === view;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

function handleImageSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    state.selectedImage = String(reader.result);
    elements.previewImage.src = state.selectedImage;
    elements.previewImage.parentElement.classList.add("has-image");
    setStatus("画像選択済み");
  };
  reader.readAsDataURL(file);
}

async function handleScan(event) {
  event.preventDefault();
  if (!state.selectedImage) {
    syncConfirmFromScan();
    setStatus("画像なしで確認欄へ反映");
    return;
  }

  syncConfirmFromScan();
  setStatus("読取中...");

  const [machineNumber, estimatedMedals] = await Promise.all([
    readMachineNumber(state.selectedImage),
    estimateMedalsFromGraph(state.selectedImage),
  ]);

  const fallbackNumber = $("confirmNumberInput").value || "";
  const normalizedNumber = machineNumber || fallbackNumber;
  $("confirmNumberInput").value = normalizedNumber;
  $("confirmMedalsInput").value = Number.isFinite(estimatedMedals) ? String(estimatedMedals) : "0";
  elements.ocrMachineNumber.textContent = normalizedNumber || "未読取";
  elements.estimatedMedals.textContent = formatMedals(Number($("confirmMedalsInput").value));
  updateWinLoseBanner();
  setStatus("確認してください");
}

async function readMachineNumber(imageData) {
  if (!window.Tesseract) {
    return "";
  }

  try {
    const result = await window.Tesseract.recognize(imageData, "eng+jpn", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          setStatus(`OCR ${Math.round(message.progress * 100)}%`);
        }
      },
    });
    const text = result.data.text || "";
    const candidates = text.match(/\d{2,5}/g) || [];
    if (!candidates.length) return "";
    return candidates.sort((a, b) => scoreMachineNumber(b) - scoreMachineNumber(a))[0];
  } catch {
    return "";
  }
}

function scoreMachineNumber(value) {
  const numeric = Number(value);
  let score = value.length;
  if (numeric >= 1 && numeric <= 3000) score += 5;
  if (numeric >= 100 && numeric <= 999) score += 2;
  return score;
}

function estimateMedalsFromGraph(imageData) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / image.width);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const point = findGraphEndPoint(data, canvas.width, canvas.height);
      if (!point) {
        resolve(0);
        return;
      }

      const centerY = canvas.height * 0.5;
      const graphTop = canvas.height * 0.14;
      const graphBottom = canvas.height * 0.88;
      const span = Math.max(1, Math.max(centerY - graphTop, graphBottom - centerY));
      const medals = Math.round(((centerY - point.y) / span) * 5000 / 50) * 50;
      resolve(medals);
    };
    image.onerror = () => resolve(0);
    image.src = imageData;
  });
}

function findGraphEndPoint(data, width, height) {
  const points = [];
  const startX = Math.floor(width * 0.18);
  const endX = Math.floor(width * 0.98);
  const startY = Math.floor(height * 0.08);
  const endY = Math.floor(height * 0.92);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const alpha = data[index + 3];
      if (alpha < 80) continue;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      const isColoredLine = saturation > 38 && (r > 110 || g > 110 || b > 110);
      const isDarkLine = r < 90 && g < 110 && b < 125;
      if (isColoredLine || isDarkLine) points.push({ x, y });
    }
  }

  if (!points.length) return null;
  const maxX = Math.max(...points.map((point) => point.x));
  const tail = points.filter((point) => point.x >= maxX - Math.max(8, width * 0.025));
  const averageY = tail.reduce((sum, point) => sum + point.y, 0) / tail.length;
  return { x: maxX, y: averageY };
}

function syncConfirmFromScan() {
  $("confirmDateInput").value = $("dateInput").value;
  $("confirmShopInput").value = $("shopInput").value;
  $("confirmTagInput").value = $("tagInput").value;
  $("confirmMachineInput").value = $("machineInput").value;
  updateWinLoseBanner();
}

function handleSaveRecord(event) {
  event.preventDefault();
  const medalValue = Number($("confirmMedalsInput").value);
  const record = {
    id: elements.editingIdInput.value || crypto.randomUUID(),
    date: $("confirmDateInput").value,
    shop: $("confirmShopInput").value.trim(),
    tag: $("confirmTagInput").value,
    machine: $("confirmMachineInput").value.trim(),
    number: $("confirmNumberInput").value.trim(),
    medals: Number.isFinite(medalValue) ? Math.round(medalValue) : 0,
    result: medalValue >= 0 ? "勝ち" : "負け",
    image: state.selectedImage,
    updatedAt: new Date().toISOString(),
  };

  addCandidate("shops", record.shop);
  addCandidate("machines", record.machine);

  const index = state.records.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    state.records[index] = { ...state.records[index], ...record };
  } else {
    state.records.unshift(record);
  }

  saveRecords();
  resetEditor();
  renderAll();
}

function editRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  elements.editingIdInput.value = record.id;
  $("confirmDateInput").value = record.date;
  $("confirmShopInput").value = record.shop;
  $("confirmTagInput").value = record.tag;
  $("confirmMachineInput").value = record.machine;
  $("confirmNumberInput").value = record.number;
  $("confirmMedalsInput").value = record.medals;
  state.selectedImage = record.image || "";
  elements.deleteEditingButton.hidden = false;
  elements.previewImage.src = state.selectedImage;
  elements.previewImage.parentElement.classList.toggle("has-image", Boolean(state.selectedImage));
  elements.ocrMachineNumber.textContent = record.number || "未読取";
  elements.estimatedMedals.textContent = formatMedals(record.medals);
  updateWinLoseBanner();
  setStatus("編集中");
  switchView("register");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteRecord(id) {
  state.records = state.records.filter((item) => item.id !== id);
  saveRecords();
  renderAll();
}

function resetEditor() {
  elements.editingIdInput.value = "";
  $("confirmNumberInput").value = "";
  $("confirmMedalsInput").value = "";
  elements.deleteEditingButton.hidden = true;
  syncConfirmFromScan();
  updateWinLoseBanner();
  setStatus(state.selectedImage ? "画像選択済み" : "待機中");
}

function clearImage() {
  elements.imageInput.value = "";
  state.selectedImage = "";
  elements.previewImage.removeAttribute("src");
  elements.previewImage.parentElement.classList.remove("has-image");
  elements.ocrMachineNumber.textContent = "未読取";
  elements.estimatedMedals.textContent = "未推定";
  setStatus("待機中");
}

function updateWinLoseBanner() {
  const medals = Number($("confirmMedalsInput").value);
  elements.winLoseBanner.classList.remove("win", "lose");
  if (!Number.isFinite(medals)) {
    elements.winLoseBanner.textContent = "勝敗は差枚から自動判定されます";
    return;
  }
  const result = medals >= 0 ? "勝ち" : "負け";
  elements.winLoseBanner.textContent = `${formatMedals(medals)} / ${result}`;
  elements.winLoseBanner.classList.add(medals >= 0 ? "win" : "lose");
}

function renderAll() {
  renderCandidateControls();
  renderRecords();
  renderSummary();
  renderRecommendations();
}

function renderRecords() {
  const filtered = applyFilters(state.records, {
    shop: elements.recordsShopFilter.value,
    tag: elements.recordsTagFilter.value,
    machine: elements.recordsMachineFilter.value,
  });

  if (!filtered.length) {
    elements.recordsBody.innerHTML = `<tr><td class="empty-row" colspan="8">登録データがありません</td></tr>`;
    return;
  }

  elements.recordsBody.innerHTML = filtered
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(record.date)}</td>
          <td>${escapeHtml(record.shop)}</td>
          <td>${escapeHtml(record.tag)}</td>
          <td>${escapeHtml(record.machine)}</td>
          <td class="number-cell">${escapeHtml(record.number)}</td>
          <td class="number-cell">${formatMedals(record.medals)}</td>
          <td class="${record.medals >= 0 ? "win-text" : "lose-text"}">${record.medals >= 0 ? "勝ち" : "負け"}</td>
          <td>
            <div class="row-actions">
              <button class="small-button" type="button" data-edit="${record.id}">編集</button>
              <button class="small-button delete" type="button" data-delete="${record.id}">削除</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  elements.recordsBody.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editRecord(button.dataset.edit));
  });
  elements.recordsBody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (confirm("この登録を削除しますか？")) deleteRecord(button.dataset.delete);
    });
  });
}

function renderSummary() {
  const mode = state.summaryMode;
  const summaryRecords = applyFilters(state.records, {
    shop: elements.summaryShopFilter.value,
    tag: elements.summaryTagFilter.value,
    machine: elements.summaryMachineFilter.value,
  });
  const labels = {
    tag: ["特日タグ", "登録台数"],
    machine: ["機種名", "登録台数"],
    number: ["台番号", "登録回数"],
  };
  elements.summaryHead.innerHTML = `
    <tr>
      <th>${labels[mode][0]}</th>
      <th>勝率</th>
      <th>平均差枚</th>
      <th>総差枚</th>
      <th>${labels[mode][1]}</th>
    </tr>
  `;

  const groups = groupRecords(mode, summaryRecords);
  if (!groups.length) {
    elements.summaryBody.innerHTML = `<tr><td class="empty-row" colspan="5">集計できるデータがありません</td></tr>`;
    return;
  }

  elements.summaryBody.innerHTML = groups
    .map(
      (group) => `
        <tr>
          <td>${escapeHtml(group.key)}</td>
          <td class="number-cell">${Math.round(group.winRate * 100)}%</td>
          <td class="number-cell">${formatMedals(group.average)}</td>
          <td class="number-cell">${formatMedals(group.total)}</td>
          <td class="number-cell">${group.count}</td>
        </tr>
      `
    )
    .join("");
}

function renderRecommendations() {
  const tag = elements.recommendTagInput.value;
  const byNumber = state.records.filter((record) => record.tag === tag);
  const groups = summarizeBy(byNumber, (record) => `${record.shop}|||${record.machine}|||${record.number}`);
  const recommendations = groups
    .map((group) => ({ ...group, grade: gradeGroup(group) }))
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || b.average - a.average || b.winRate - a.winRate)
    .slice(0, 12);

  if (!recommendations.length) {
    elements.recommendationList.innerHTML = `<tr><td class="empty-row" colspan="8">選択中の特日タグには、まだ登録データがありません。</td></tr>`;
    return;
  }

  elements.recommendationList.innerHTML = recommendations
    .map((item) => {
      const [shop, machine, number] = item.key.split("|||");
      return `
        <tr>
          <td>${escapeHtml(shop)}</td>
          <td>${escapeHtml(machine)}</td>
          <td class="number-cell">${escapeHtml(number)}</td>
          <td class="number-cell">${Math.round(item.winRate * 100)}%</td>
          <td class="number-cell">${formatMedals(item.average)}</td>
          <td class="number-cell">${formatMedals(item.total)}</td>
          <td><span class="grade grade-${item.grade.toLowerCase()}">${item.grade}</span></td>
          <td>${escapeHtml(recommendationReason(item))}</td>
        </tr>
      `;
    })
    .join("");
}

function recommendationReason(item) {
  if (item.grade === "A") return `勝率${Math.round(item.winRate * 100)}%かつ平均差枚がプラスで、${item.count}回の実績があります。`;
  if (item.grade === "B") return `勝率または平均差枚のどちらかが良好で、候補として期待できます。`;
  return item.count < 2 ? "実績は少なめですが比較候補として表示しています。" : "上位候補と比べると成績は控えめです。";
}

function groupRecords(mode, records = state.records) {
  const selectors = {
    tag: (record) => record.tag,
    machine: (record) => record.machine,
    number: (record) => record.number,
  };
  return summarizeBy(records, selectors[mode]).sort((a, b) => b.average - a.average || b.winRate - a.winRate);
}

function applyFilters(records, filters) {
  return records.filter((record) => {
    if (filters.shop && record.shop !== filters.shop) return false;
    if (filters.tag && record.tag !== filters.tag) return false;
    if (filters.machine && record.machine !== filters.machine) return false;
    return true;
  });
}

function summarizeBy(records, selector) {
  const map = new Map();
  records.forEach((record) => {
    const key = selector(record) || "未設定";
    const item = map.get(key) || { key, count: 0, wins: 0, total: 0 };
    item.count += 1;
    item.wins += Number(record.medals) >= 0 ? 1 : 0;
    item.total += Number(record.medals) || 0;
    map.set(key, item);
  });
  return Array.from(map.values()).map((item) => ({
    ...item,
    winRate: item.count ? item.wins / item.count : 0,
    average: item.count ? Math.round(item.total / item.count) : 0,
  }));
}

function gradeGroup(group) {
  if (group.count < 2) return "C";
  if (group.winRate >= 0.6 && group.average > 0) return "A";
  if (group.winRate >= 0.6 || group.average > 0) return "B";
  return "C";
}

function gradeRank(grade) {
  return { A: 1, B: 2, C: 3 }[grade] || 9;
}

function exportCsv() {
  const headers = ["日付", "店舗名", "特日タグ", "機種名", "台番号", "差枚", "勝敗", "画像"];
  const rows = state.records.map((record) => [
    record.date,
    record.shop,
    record.tag,
    record.machine,
    record.number,
    record.medals,
    record.medals >= 0 ? "勝ち" : "負け",
    record.image || "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `at-slot-data-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result).replace(/^\ufeff/, ""));
    const imported = rows.slice(1).map((row) => {
      const medals = Number(row[5]) || 0;
      return {
        id: crypto.randomUUID(),
        date: row[0] || "",
        shop: row[1] || "",
        tag: TAGS.includes(row[2]) ? row[2] : "その他",
        machine: row[3] || "",
        number: row[4] || "",
        medals,
        result: medals >= 0 ? "勝ち" : "負け",
        image: row[7] || "",
        updatedAt: new Date().toISOString(),
      };
    }).filter((record) => record.date || record.shop || record.machine || record.number);

    state.records = [...imported, ...state.records];
    saveRecords();
    seedCandidatesFromRecords();
    renderAll();
    event.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatMedals(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${yen.format(number)}枚`;
}

function setStatus(text) {
  elements.ocrStatus.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

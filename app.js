const STORAGE_KEY = "atSlotSpecialDayRecords";
const TAGS = ["ゾロ目日", "7の日", "周年", "月イチ", "その他"];

const state = {
  records: loadRecords(),
  selectedImage: "",
  summaryMode: "tag",
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
  searchInput: $("searchInput"),
  recommendTagInput: $("recommendTagInput"),
  recommendationList: $("recommendationList"),
  exportCsvButton: $("exportCsvButton"),
  importCsvInput: $("importCsvInput"),
};

document.addEventListener("DOMContentLoaded", () => {
  $("dateInput").valueAsDate = new Date();
  syncConfirmFromScan();
  bindEvents();
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
  elements.searchInput.addEventListener("input", renderRecords);
  elements.recommendTagInput.addEventListener("change", renderRecommendations);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importCsvInput.addEventListener("change", importCsv);
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
    setStatus("画像未選択");
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
  renderRecords();
  renderSummary();
  renderRecommendations();
}

function renderRecords() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filtered = state.records.filter((record) => {
    const haystack = `${record.shop} ${record.tag} ${record.machine} ${record.number}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!filtered.length) {
    elements.recordsBody.innerHTML = `<tr><td class="empty-row" colspan="9">登録データがありません</td></tr>`;
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
          <td>${record.image ? `<img class="thumb" src="${record.image}" alt="登録画像" />` : "なし"}</td>
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

  const groups = groupRecords(mode);
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
  const groups = summarizeBy(byNumber, (record) => `${record.machine} / ${record.number}`);
  const recommendations = groups
    .map((group) => ({ ...group, grade: gradeGroup(group) }))
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || b.average - a.average || b.winRate - a.winRate)
    .slice(0, 8);

  if (!recommendations.length) {
    elements.recommendationList.innerHTML = `<p class="hint">選択中の特日タグには、まだ登録データがありません。</p>`;
    return;
  }

  elements.recommendationList.innerHTML = recommendations
    .map(
      (item) => `
        <article class="recommend-card">
          <div class="grade grade-${item.grade.toLowerCase()}">${item.grade}</div>
          <div>
            <div class="recommend-title">${escapeHtml(item.key)}</div>
            <div class="recommend-meta">
              勝率 ${Math.round(item.winRate * 100)}% / 平均 ${formatMedals(item.average)} / 総差枚 ${formatMedals(item.total)} / ${item.count}回
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function groupRecords(mode) {
  const selectors = {
    tag: (record) => record.tag,
    machine: (record) => record.machine,
    number: (record) => record.number,
  };
  return summarizeBy(state.records, selectors[mode]).sort((a, b) => b.average - a.average || b.winRate - a.winRate);
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

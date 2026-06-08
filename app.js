const STORAGE_KEY = "atSlotSpecialDayRecords";
const CANDIDATE_STORAGE_KEY = "atSlotNameCandidates";
const TAGS = ["ゾロ目日", "7の日", "周年", "月イチ", "その他"];

const state = {
  records: loadRecords(),
  selectedImage: "",
  selectedImages: [],
  batchResults: [],
  summaryMode: "tag",
  activeView: "recommend",
  candidates: loadCandidates(),
};

const $ = (id) => document.getElementById(id);
const yen = new Intl.NumberFormat("ja-JP");

const elements = {
  scanForm: $("scanForm"),
  scanButton: $("scanButton"),
  recordForm: $("recordForm"),
  imageInput: $("imageInput"),
  previewImage: $("previewImage"),
  emptyPreview: $("emptyPreview"),
  ocrStatus: $("ocrStatus"),
  ocrMachineNumber: $("ocrMachineNumber"),
  estimatedMedals: $("estimatedMedals"),
  clearImageButton: $("clearImageButton"),
  batchPanel: $("batchPanel"),
  batchResults: $("batchResults"),
  bulkRegisterButton: $("bulkRegisterButton"),
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
  summaryStartDateFilter: $("summaryStartDateFilter"),
  summaryEndDateFilter: $("summaryEndDateFilter"),
  recordsShopFilter: $("recordsShopFilter"),
  recordsTagFilter: $("recordsTagFilter"),
  recordsMachineFilter: $("recordsMachineFilter"),
  recordsNumberFilter: $("recordsNumberFilter"),
  recommendShopFilter: $("recommendShopFilter"),
  recommendMachineFilter: $("recommendMachineFilter"),
  shopCandidates: $("shopCandidates"),
  machineCandidates: $("machineCandidates"),
  recommendTagInput: $("recommendTagInput"),
  recommendationList: $("recommendationList"),
  exportCsvButton: $("exportCsvButton"),
  importCsvInput: $("importCsvInput"),
  recordsExportCsvButton: $("recordsExportCsvButton"),
  recordsImportCsvInput: $("recordsImportCsvInput"),
  clearAllRecordsButton: $("clearAllRecordsButton"),
  debugLog: $("debugLog"),
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
  elements.scanButton.addEventListener("click", handleScan);
  elements.scanForm.addEventListener("submit", (event) => event.preventDefault());
  elements.recordForm.addEventListener("submit", handleSaveRecord);
  $("confirmMedalsInput").addEventListener("input", updateWinLoseBanner);
  elements.clearImageButton.addEventListener("click", clearImage);
  [$("dateInput"), $("shopInput"), $("tagInput"), $("machineInput")].forEach((input) => {
    input.addEventListener("input", applyScanDefaultsToBatchResults);
    input.addEventListener("change", applyScanDefaultsToBatchResults);
  });
  elements.bulkRegisterButton.addEventListener("click", saveAllBatchResults);
  elements.batchResults.addEventListener("input", handleBatchInput);
  elements.batchResults.addEventListener("change", handleBatchInput);
  elements.batchResults.addEventListener("click", handleBatchClick);
  elements.resetEditButton.addEventListener("click", resetEditor);
  elements.deleteEditingButton.addEventListener("click", () => {
    const id = elements.editingIdInput.value;
    if (id && confirm("この登録を削除しますか？")) {
      deleteRecord(id);
      resetEditor();
    }
  });
  [
    elements.summaryShopFilter,
    elements.summaryTagFilter,
    elements.summaryMachineFilter,
    elements.summaryStartDateFilter,
    elements.summaryEndDateFilter,
  ].forEach((filter) => {
    filter.addEventListener("change", renderSummary);
  });
  [elements.recordsShopFilter, elements.recordsTagFilter, elements.recordsMachineFilter].forEach((filter) => {
    filter.addEventListener("change", renderRecords);
  });
  elements.recordsNumberFilter.addEventListener("input", renderRecords);
  [elements.recommendShopFilter, elements.recommendTagInput, elements.recommendMachineFilter].forEach((filter) => {
    filter.addEventListener("change", renderRecommendations);
  });
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importCsvInput.addEventListener("change", importCsv);
  elements.recordsExportCsvButton.addEventListener("click", exportCsv);
  elements.recordsImportCsvInput.addEventListener("change", importCsv);
  elements.clearAllRecordsButton.addEventListener("click", clearAllRecords);
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
  renderSelectOptions(elements.recommendShopFilter, state.candidates.shops, "すべて");
  renderSelectOptions(elements.recommendMachineFilter, state.candidates.machines, "すべて");
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

async function handleImageSelect(event) {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;

  setStatus(`${files.length}枚の画像を読込中...`);
  const images = await Promise.all(files.map(readFileAsDataUrl));
  state.selectedImages = images;
  state.selectedImage = images[0] || "";
  state.batchResults = [];

  if (state.selectedImage) {
    elements.previewImage.src = state.selectedImage;
    elements.previewImage.parentElement.classList.add("has-image");
  }
  hideBatchResults();
  setStatus(files.length > 1 ? `${files.length}枚選択済み` : "画像選択済み");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function debugLog(message, data = null) {
  if (localStorage.getItem("atSlotDebug") !== "1") return;
  if (data === null || data === undefined) {
    console.debug(message);
    return;
  }
  console.debug(message, data);
}

async function handleScan(event) {
  event?.preventDefault?.();
  setStatus("読み取り処理を開始しました");
  debugLog("読み取りボタンが押された");

  try {
    const selectedFiles = Array.from(elements.imageInput.files || []).filter((file) => file.type.startsWith("image/"));
    debugLog("imageInput.files の枚数", selectedFiles.length);
    debugLog("state.selectedImages の枚数", state.selectedImages.length);

    if (!state.selectedImages.length && selectedFiles.length) {
      state.selectedImages = await Promise.all(selectedFiles.map(readFileAsDataUrl));
      state.selectedImage = state.selectedImages[0] || "";
      if (state.selectedImage) {
        elements.previewImage.src = state.selectedImage;
        elements.previewImage.parentElement.classList.add("has-image");
      }
      debugLog("imageInput.files から state.selectedImages を復元", state.selectedImages.length);
    }

    const images = state.selectedImages.length ? state.selectedImages : state.selectedImage ? [state.selectedImage] : [];
    setStatus(`選択画像：${images.length}枚`);
    debugLog("読み取り対象 images の枚数", images.length);
    if (!images.length) {
      setStatus("グラフ画像を選択してください");
      alert("グラフ画像を選択してください。");
      return;
    }

    syncConfirmFromScan();
    state.batchResults = [];
    hideBatchResults();
    setStatus(`読取中... 0/${images.length}`);

    const results = await readGraphImages(images);
    if (!results.length) {
      results.push(createBatchResult(state.selectedImage || images[0], createFailedScanResult(["読み取りできませんでした。手動で入力してください。"]), 0));
    }

    state.batchResults = sortBatchResults(results);
    fillConfirmFromScanResult(state.batchResults[0]);
    renderBatchResults();
    updateWinLoseBanner();

    const statusMessage = getScanStatusMessage(results, images.length);
    setStatus(statusMessage);
  } catch (error) {
    console.error("画像読み取りエラー:", error);
    debugLog("エラー発生時の error.message", error?.message || String(error));
    const fallback = createBatchResult(state.selectedImage || "", createFailedScanResult(["読み取りできませんでした。手動で入力してください。"]), 0);
    fillConfirmFromScanResult(fallback);
    updateWinLoseBanner();
    setStatus("読み取りできませんでした。手動で入力してください。");
    alert("画像読み取り中にエラーが発生しました。画像形式やコードを確認してください。");
  }
}

async function readGraphImages(images) {
  const results = [];
  let resultIndex = 0;
  for (const [imageIndex, image] of images.entries()) {
    try {
      setStatus(`読取中... ${imageIndex + 1}/${images.length}`);
      debugLog("recognizeGraphDiffImage 開始", { imageIndex: imageIndex + 1 });
      const scans = await recognizeGraphDiffImage(image, imageIndex);
      debugLog("recognizeGraphDiffImage 結果", {
        imageIndex: imageIndex + 1,
        graphCount: scans.length,
        scans: scans.map((scan) => ({ number: scan.number, medals: scan.medals, warnings: scan.warnings, rect: scan.rect })),
      });
      scans.forEach((scan) => {
        results.push(createBatchResult(scan.image || image, scan, resultIndex));
        resultIndex += 1;
      });
    } catch (error) {
      console.error(`${imageIndex + 1}枚目の読み取り失敗`, error);
      debugLog("エラー発生時の error.message", error?.message || String(error));
      results.push(createBatchResult(image, createFailedScanResult(["読み取りできませんでした。手動で入力してください。"]), resultIndex));
      resultIndex += 1;
    }
  }
  return results;
}

async function recognizeGraphDiffImage(imageData, imageIndex = 0) {
  const sourceCanvas = await imageDataToCanvas(imageData, 1400);
  debugLog("recognizeGraphDiffImage canvas", { imageIndex: imageIndex + 1, width: sourceCanvas.width, height: sourceCanvas.height });
  const graphRegions = detectGraphRegions(sourceCanvas);
  debugLog("detectGraphRegions 結果", graphRegions);

  if (!graphRegions.length) {
    const warning = "グラフ領域を検出できませんでした。画像の背景・スクショ範囲が想定と違う可能性があります。";
    setStatus(warning);
    return [{ ...createFailedScanResult([warning]), image: imageData, sourceIndex: imageIndex + 1, regionIndex: 1 }];
  }

  const scans = [];
  for (const [regionIndex, rect] of graphRegions.entries()) {
    try {
      debugLog("グラフ個別読み取り開始", { imageIndex: imageIndex + 1, regionIndex: regionIndex + 1, rect });
      const previewCanvas = cropCanvas(sourceCanvas, expandRect(rect, sourceCanvas, { top: 42, right: 4, bottom: 4, left: 4 }), { padding: 0, fill: "white" });
      const [unitResult, diffResult] = await Promise.all([
        recognizeGraphUnitNumber(sourceCanvas, rect),
        analyzeGraphDiff(sourceCanvas, rect),
      ]);
      const warnings = uniqueSorted([...(unitResult.warnings || []), ...(diffResult.warnings || [])]);
      const failed = !unitResult.number || !Number.isFinite(diffResult.medals);
      const memo = buildScanMemo(unitResult, diffResult, warnings);
      if (failed && !warnings.length) warnings.push("要確認：読み取り結果を手動で確認してください。");
      scans.push({
        number: unitResult.number || "",
        numberCandidates: unitResult.candidates || [],
        medals: Number.isFinite(diffResult.medals) ? diffResult.medals : 0,
        memo,
        warnings,
        failed,
        image: previewCanvas.toDataURL("image/png"),
        rect,
        sourceIndex: imageIndex + 1,
        regionIndex: regionIndex + 1,
      });
      debugLog("グラフ個別読み取り結果", scans[scans.length - 1]);
    } catch (error) {
      debugLog("エラー発生時の error.message", error?.message || String(error));
      scans.push({
        ...createFailedScanResult(["要確認：このグラフの読み取りに失敗しました。手動入力してください。"]),
        memo: "読み取り失敗",
        image: cropCanvas(sourceCanvas, rect, { padding: 0, fill: "white" }).toDataURL("image/png"),
        rect,
        sourceIndex: imageIndex + 1,
        regionIndex: regionIndex + 1,
      });
    }
  }
  return scans;
}

async function scanSingleImage(imageData) {
  const scans = await recognizeGraphDiffImage(imageData, 0);
  return scans[0] || createFailedScanResult(["読み取りできませんでした。手動で入力してください。"]);
}

function buildScanMemo(unitResult, diffResult, warnings = []) {
  const messages = diffResult.memo ? [diffResult.memo] : [];
  if (!unitResult.number && !Number.isFinite(diffResult.medals)) {
    messages.push("読み取り失敗");
  } else {
    if (!unitResult.number) messages.push("台番号要確認");
    if (!Number.isFinite(diffResult.medals)) messages.push("差枚要確認");
  }
  warnings.forEach((warning) => {
    if (/数字誤認識|0ライン|異常値|黄色文字/.test(warning)) messages.push(warning);
  });
  return uniqueSorted(messages).join(" / ");
}

function createFailedScanResult(warnings = []) {
  return {
    number: "",
    numberCandidates: [],
    medals: 0,
    memo: warnings.join(" / ") || "読み取り失敗",
    warnings,
    failed: true,
  };
}

function getScanStatusMessage(results, imageCount) {
  const warnings = uniqueSorted(results.flatMap((result) => result.warnings || []).filter((warning) => warning !== "数字除外済み"));
  if (warnings.length) return warnings.join(" / ");
  const graphCount = results.length;
  if (results.some((result) => result.failed)) return "読み取りできませんでした。手動で入力してください。";
  return graphCount > 1 ? `${graphCount}件の結果を確認してください` : imageCount > 1 ? `${imageCount}枚の画像を確認してください` : "確認してください";
}

function sortBatchResults(results) {
  return results
    .map((result, originalIndex) => ({ result, originalIndex }))
    .sort((a, b) => {
      const numberA = sortableMachineNumber(a.result.number);
      const numberB = sortableMachineNumber(b.result.number);
      if (numberA !== numberB) return numberA - numberB;
      return (a.result.sourceIndex || 0) - (b.result.sourceIndex || 0) || (a.result.regionIndex || 0) - (b.result.regionIndex || 0) || a.originalIndex - b.originalIndex;
    })
    .map(({ result }, index) => ({ ...result, index: index + 1 }));
}

function sortableMachineNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function createBatchResult(image, scan, index) {
  return {
    id: crypto.randomUUID(),
    image,
    sourceIndex: scan.sourceIndex || null,
    regionIndex: scan.regionIndex || index + 1,
    ...getScanDefaults(),
    number: scan.number || "",
    medals: Number.isFinite(scan.medals) ? Math.round(scan.medals) : 0,
    memo: scan.memo || (scan.warnings || []).join(" / "),
    warnings: scan.warnings || [],
    numberCandidates: scan.numberCandidates || [],
    failed: Boolean(scan.failed),
    saved: false,
    index: index + 1,
  };
}

function fillConfirmFromScanResult(result) {
  if (!result) return;
  $("confirmDateInput").value = result.date;
  $("confirmShopInput").value = result.shop;
  $("confirmTagInput").value = result.tag;
  $("confirmMachineInput").value = result.machine;
  $("confirmNumberInput").value = result.number;
  $("confirmMedalsInput").value = String(result.medals);
  state.selectedImage = result.image;
  elements.previewImage.src = result.image;
  elements.previewImage.parentElement.classList.add("has-image");
  elements.ocrMachineNumber.textContent = result.number || "未読取";
  elements.estimatedMedals.textContent = formatMedals(result.medals);
}

async function recognizeGraphUnitNumber(sourceCanvas, graphRect) {
  if (!window.Tesseract) {
    const message = "台番号をOCRで読み取れませんでした。手動入力してください。";
    debugLog("台番号OCR", "Tesseract が未読込");
    setStatus(message);
    return { number: "", candidates: [], warnings: [message] };
  }

  const titleRect = expandRect(graphRect, sourceCanvas, {
    top: Math.max(36, Math.round(graphRect.height * 0.22)),
    right: 8,
    bottom: -Math.max(2, Math.round(graphRect.height * 0.80)),
    left: 8,
  });
  const fallbackTitleRect = expandRect(graphRect, sourceCanvas, { top: Math.max(48, Math.round(graphRect.height * 0.30)), right: 8, bottom: 0, left: 8 });
  const cropped = cropCanvas(sourceCanvas, titleRect.bottom > titleRect.top ? titleRect : fallbackTitleRect, { padding: 8, fill: "white" });
  const enhanced = enhanceCanvasForOcr(cropped);

  try {
    const result = await window.Tesseract.recognize(enhanced, "eng", {
      tessedit_pageseg_mode: "6",
      tessedit_char_whitelist: "[]0123456789台番No.- ",
    });
    const text = result.data.text || "";
    const candidates = uniqueSorted(text.match(/\d{2,5}/g) || []).sort((a, b) => scoreMachineNumber(b) - scoreMachineNumber(a));
    debugLog("台番号OCR結果", { text, candidates, graphRect });
    if (!candidates.length) {
      const message = "台番号をOCRで読み取れませんでした。手動入力してください。";
      setStatus(message);
      return { number: "", candidates: [], warnings: [message] };
    }
    return { number: candidates[0], candidates, warnings: [] };
  } catch (error) {
    const message = "台番号をOCRで読み取れませんでした。手動入力してください。";
    debugLog("エラー発生時の error.message", error?.message || String(error));
    setStatus(message);
    return { number: "", candidates: [], warnings: [message] };
  }
}

function readMachineNumber(imageData) {
  return imageDataToCanvas(imageData, 1100).then((canvas) =>
    recognizeGraphUnitNumber(canvas, {
      left: 0,
      top: Math.round(canvas.height * 0.18),
      right: canvas.width - 1,
      bottom: Math.round(canvas.height * 0.88),
      width: canvas.width,
      height: Math.round(canvas.height * 0.70),
    }).then((result) => result.number)
  );
}

function imageDataToCanvas(imageData, maxWidth = 1100) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / image.width);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = reject;
    image.src = imageData;
  });
}

function detectGraphRegions(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (isGraphBackgroundPixel(data[index], data[index + 1], data[index + 2])) {
        mask[y * width + x] = 1;
      }
    }
  }

  const components = detectMaskComponents(mask, width, height, { minPixels: 400, step: 2 });
  const minWidth = Math.max(80, width * 0.12);
  const minHeight = Math.max(70, height * 0.08);
  const regions = components
    .map((component) => normalizeRect(component, width, height))
    .filter((rect) => rect.width >= minWidth && rect.height >= minHeight)
    .filter((rect) => rect.width / rect.height >= 0.75 && rect.width / rect.height <= 8)
    .map((rect) => trimGraphRegionToDarkBounds(rect, mask, width, height))
    .flatMap((rect) => splitMergedGraphRegion(rect, mask, width, height))
    .filter((rect) => rect.width >= minWidth && rect.height >= minHeight);

  return mergeOverlappingRects(regions)
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .map((rect) => expandRect(rect, canvas, { top: 0, right: 1, bottom: 1, left: 1 }));
}

function isGraphBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  return luminance < 70 && max - min < 45;
}

function detectMaskComponents(mask, width, height, options = {}) {
  const minPixels = options.minPixels || 1;
  const step = options.step || 1;
  const visited = new Uint8Array(width * height);
  const components = [];
  const queue = [];

  for (let startY = 0; startY < height; startY += step) {
    for (let startX = 0; startX < width; startX += step) {
      const startIndex = startY * width + startX;
      if (!mask[startIndex] || visited[startIndex]) continue;

      let left = startX;
      let right = startX;
      let top = startY;
      let bottom = startY;
      let pixels = 0;
      queue.length = 0;
      queue.push(startIndex);
      visited[startIndex] = 1;

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        const x = index % width;
        const y = Math.floor(index / width);
        pixels += 1;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;

        for (let dy = -step; dy <= step; dy += step) {
          for (let dx = -step; dx <= step; dx += step) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nextIndex = ny * width + nx;
            if (!mask[nextIndex] || visited[nextIndex]) continue;
            visited[nextIndex] = 1;
            queue.push(nextIndex);
          }
        }
      }

      if (pixels >= minPixels) {
        components.push({ left, right, top, bottom, pixels });
      }
    }
  }
  return components;
}

function normalizeRect(rect, maxWidth, maxHeight) {
  const left = Math.max(0, Math.floor(rect.left));
  const top = Math.max(0, Math.floor(rect.top));
  const right = Math.min(maxWidth - 1, Math.ceil(rect.right));
  const bottom = Math.min(maxHeight - 1, Math.ceil(rect.bottom));
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function expandRect(rect, canvas, padding) {
  const leftPad = typeof padding === "number" ? padding : padding.left || 0;
  const rightPad = typeof padding === "number" ? padding : padding.right || 0;
  const topPad = typeof padding === "number" ? padding : padding.top || 0;
  const bottomPad = typeof padding === "number" ? padding : padding.bottom || 0;
  return normalizeRect(
    {
      left: rect.left - leftPad,
      right: rect.right + rightPad,
      top: rect.top - topPad,
      bottom: rect.bottom + bottomPad,
    },
    canvas.width,
    canvas.height
  );
}


function splitMergedGraphRegion(rect, mask, width, height) {
  const xSegments = splitAxisByMaskGaps({
    from: rect.left,
    to: rect.right,
    fixedFrom: rect.top,
    fixedTo: rect.bottom,
    minSegmentSize: Math.max(80, rect.width * 0.16),
    gapThreshold: Math.max(4, rect.height * 0.10),
    countAt: (position) => countMaskColumn(mask, width, position, rect.top, rect.bottom),
  });
  const splitByX = xSegments.map(([left, right]) => normalizeRect({ left, right, top: rect.top, bottom: rect.bottom }, width, height));
  const splitByBothAxes = splitByX.flatMap((xRect) => {
    const ySegments = splitAxisByMaskGaps({
      from: xRect.top,
      to: xRect.bottom,
      fixedFrom: xRect.left,
      fixedTo: xRect.right,
      minSegmentSize: Math.max(70, xRect.height * 0.20),
      gapThreshold: Math.max(4, xRect.width * 0.10),
      countAt: (position) => countMaskRow(mask, width, position, xRect.left, xRect.right),
    });
    return ySegments.map(([top, bottom]) => normalizeRect({ left: xRect.left, right: xRect.right, top, bottom }, width, height));
  });
  return splitByBothAxes.length ? splitByBothAxes : [rect];
}

function splitAxisByMaskGaps({ from, to, minSegmentSize, gapThreshold, countAt }) {
  const minGapSize = 8;
  const segments = [];
  let segmentStart = from;
  let gapStart = null;

  for (let position = from; position <= to; position += 1) {
    const isGap = countAt(position) < gapThreshold;
    if (isGap && gapStart === null) gapStart = position;
    if (!isGap && gapStart !== null) {
      const gapEnd = position - 1;
      if (gapEnd - gapStart + 1 >= minGapSize) {
        const segmentEnd = gapStart - 1;
        if (segmentEnd - segmentStart + 1 >= minSegmentSize) segments.push([segmentStart, segmentEnd]);
        segmentStart = position;
      }
      gapStart = null;
    }
  }

  if (gapStart !== null && to - gapStart + 1 >= minGapSize) {
    const segmentEnd = gapStart - 1;
    if (segmentEnd - segmentStart + 1 >= minSegmentSize) segments.push([segmentStart, segmentEnd]);
    segmentStart = to + 1;
  }
  if (to - segmentStart + 1 >= minSegmentSize) segments.push([segmentStart, to]);
  return segments.length ? segments : [[from, to]];
}

function trimGraphRegionToDarkBounds(rect, mask, width, height) {
  let left = rect.left;
  let right = rect.right;
  let top = rect.top;
  let bottom = rect.bottom;
  const columnThreshold = Math.max(6, rect.height * 0.20);
  const rowThreshold = Math.max(6, rect.width * 0.20);

  while (left < right && countMaskColumn(mask, width, left, top, bottom) < columnThreshold) left += 1;
  while (right > left && countMaskColumn(mask, width, right, top, bottom) < columnThreshold) right -= 1;
  while (top < bottom && countMaskRow(mask, width, top, left, right) < rowThreshold) top += 1;
  while (bottom > top && countMaskRow(mask, width, bottom, left, right) < rowThreshold) bottom -= 1;
  return normalizeRect({ left, right, top, bottom }, width, height);
}

function countMaskColumn(mask, width, x, top, bottom) {
  let count = 0;
  for (let y = top; y <= bottom; y += 1) count += mask[y * width + x] ? 1 : 0;
  return count;
}

function countMaskRow(mask, width, y, left, right) {
  let count = 0;
  for (let x = left; x <= right; x += 1) count += mask[y * width + x] ? 1 : 0;
  return count;
}

function mergeOverlappingRects(rects) {
  const merged = [];
  rects.forEach((rect) => {
    const duplicate = merged.find((item) => rectOverlapRatio(item, rect) > 0.65);
    if (!duplicate) {
      merged.push({ ...rect });
      return;
    }
    duplicate.left = Math.min(duplicate.left, rect.left);
    duplicate.top = Math.min(duplicate.top, rect.top);
    duplicate.right = Math.max(duplicate.right, rect.right);
    duplicate.bottom = Math.max(duplicate.bottom, rect.bottom);
    duplicate.width = duplicate.right - duplicate.left + 1;
    duplicate.height = duplicate.bottom - duplicate.top + 1;
  });
  return merged;
}

function rectOverlapRatio(a, b) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return 0;
  const overlap = (right - left + 1) * (bottom - top + 1);
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return overlap / Math.max(1, smaller);
}

function analyzeGraphDiff(sourceCanvas, graphRect) {
  const graphCanvas = cropCanvas(sourceCanvas, graphRect, { padding: 0, fill: "black" });
  const ctx = graphCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, graphCanvas.width, graphCanvas.height);
  const yellowMask = buildYellowMask(imageData);
  const yellowComponents = detectYellowComponents(yellowMask, graphCanvas.width, graphCanvas.height);
  const textBlocks = detectYellowTextBlocks(yellowComponents, graphCanvas.width, graphCanvas.height);
  const lineMask = removeYellowTextBlocksFromMask(yellowMask, graphCanvas.width, textBlocks);
  const trace = buildYellowLineTrace(lineMask, graphCanvas.width, graphCanvas.height);
  const segments = findYellowLineTraceSegments(trace, graphCanvas.width, graphCanvas.height, textBlocks);
  const endpoint = detectYellowEndpoint(segments, graphCanvas.width, graphCanvas.height, textBlocks);
  const zeroLine = detectZeroLineY(imageData);
  const zeroLineY = zeroLine?.y ?? null;
  const endpointIsText = endpointLooksLikeText(endpoint, textBlocks, graphCanvas.width, graphCanvas.height);

  debugLog("analyzeGraphDiff", {
    graphRect,
    yellowComponents: yellowComponents.length,
    yellowTextBlocks: textBlocks.length,
    textBlocks,
    tracePoints: trace.filter(Boolean).length,
    segments: segments.map((segment) => ({ startX: segment.startX, endX: segment.endX, length: segment.points.length, textLike: segment.textLike })),
    zeroLine,
    endpoint,
    endpointIsText,
    yellowTextRemoved: textBlocks.length > 0,
  });

  if (!endpoint) {
    const message = segments.some((segment) => segment.textLike)
      ? "要確認：数字誤認識（黄色文字をグラフ線候補から除外しました）"
      : "グラフ線を検出できませんでした。画像の線色・背景・スクショ範囲が想定と違う可能性があります。";
    setStatus(message);
    return { medals: Number.NaN, warnings: [message] };
  }

  const warnings = [];
  if (!zeroLine?.detected) warnings.push("要確認：0ラインを検出できませんでした");
  if (endpointIsText) warnings.push("要確認：数字誤認識（黄色文字を終点候補として検出）");

  const graphTop = Math.max(0, graphCanvas.height * 0.08);
  const graphBottom = Math.min(graphCanvas.height - 1, graphCanvas.height * 0.92);
  const baseZeroLine = Number.isFinite(zeroLineY) ? zeroLineY : graphCanvas.height * 0.5;
  const span = Math.max(1, Math.max(baseZeroLine - graphTop, graphBottom - baseZeroLine));
  const medals = Math.round(((baseZeroLine - endpoint.y) / span) * 5000 / 50) * 50;
  if (medals <= -5000 || medals >= 5000) warnings.push("要確認：数字誤認識または推定差枚が異常値です");
  debugLog("推定差枚", { medals, zeroLineY: baseZeroLine, endpoint, warnings });

  if (warnings.length) {
    setStatus(warnings[0]);
    return { medals: Number.NaN, warnings: uniqueSorted(warnings) };
  }
  return { medals, warnings: textBlocks.length ? ["数字除外済み"] : [], memo: textBlocks.length ? "最右連続区間採用 / 数字除外済み" : "最右連続区間採用" };
}

function buildYellowMask(imageData) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (isAtGraphYellow(data[index], data[index + 1], data[index + 2])) mask[y * width + x] = 1;
    }
  }
  return mask;
}

function detectYellowComponents(mask, width, height) {
  return detectMaskComponents(mask, width, height, { minPixels: 3, step: 1 })
    .map((component) => normalizeRect(component, width, height))
    .map((rect) => ({ ...rect, pixels: countMaskPixels(mask, width, rect) }));
}

function countMaskPixels(mask, width, rect) {
  let count = 0;
  for (let y = rect.top; y <= rect.bottom; y += 1) {
    for (let x = rect.left; x <= rect.right; x += 1) count += mask[y * width + x] ? 1 : 0;
  }
  return count;
}

function detectYellowTextBlocks(components, width, height) {
  const characterBlocks = components.filter((component) => {
    if (isLikelyYellowPayoutText(component, width, height)) return true;
    if (isLikelyYellowLineComponent(component, width, height)) return false;
    const inTextZone = component.left > width * 0.52 || component.top > height * 0.62 || component.bottom < height * 0.16;
    const characterSized = component.width <= Math.max(44, width * 0.18) && component.height <= Math.max(38, height * 0.22);
    return inTextZone && characterSized;
  });
  return mergeTextBlocks(groupYellowTextBlocks(characterBlocks, width, height));
}

function isLikelyYellowPayoutText(component, width, height) {
  const area = component.width * component.height;
  const density = component.pixels / Math.max(1, area);
  const inPayoutZone = component.left >= width * 0.52 && component.top >= height * 0.52;
  const compact = component.width <= Math.max(58, width * 0.22) && component.height <= Math.max(46, height * 0.24);
  const digitLike = density >= 0.08 && density <= 0.92;
  return inPayoutZone && compact && digitLike;
}

function groupYellowTextBlocks(blocks, width, height) {
  const groups = [];
  blocks
    .slice()
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .forEach((block) => {
      const padded = padRect(block, Math.max(4, width * 0.01), Math.max(4, height * 0.015), width, height);
      const group = groups.find((item) => rectOverlapRatio(item, padded) > 0 || rectDistance(item, padded) < Math.max(16, width * 0.04));
      if (!group) {
        groups.push({ ...padded, pixels: block.pixels || 0 });
        return;
      }
      group.left = Math.min(group.left, padded.left);
      group.top = Math.min(group.top, padded.top);
      group.right = Math.max(group.right, padded.right);
      group.bottom = Math.max(group.bottom, padded.bottom);
      group.width = group.right - group.left + 1;
      group.height = group.bottom - group.top + 1;
      group.pixels = (group.pixels || 0) + (block.pixels || 0);
    });
  return groups;
}

function mergeTextBlocks(blocks) {
  const merged = [];
  blocks.forEach((block) => {
    const existing = merged.find((item) => rectOverlapRatio(item, block) > 0 || rectDistance(item, block) < 10);
    if (!existing) {
      merged.push({ ...block });
      return;
    }
    existing.left = Math.min(existing.left, block.left);
    existing.top = Math.min(existing.top, block.top);
    existing.right = Math.max(existing.right, block.right);
    existing.bottom = Math.max(existing.bottom, block.bottom);
    existing.width = existing.right - existing.left + 1;
    existing.height = existing.bottom - existing.top + 1;
    existing.pixels = (existing.pixels || 0) + (block.pixels || 0);
  });
  return merged;
}

function rectDistance(a, b) {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return Math.hypot(dx, dy);
}

function padRect(rect, padX, padY, width, height) {
  return normalizeRect(
    {
      left: rect.left - padX,
      right: rect.right + padX,
      top: rect.top - padY,
      bottom: rect.bottom + padY,
    },
    width,
    height
  );
}

function removeYellowTextBlocksFromMask(mask, width, textBlocks) {
  const cleaned = new Uint8Array(mask);
  const height = Math.max(1, Math.floor(mask.length / width));
  textBlocks.forEach((block) => {
    const padded = padRect(block, Math.max(5, width * 0.012), Math.max(5, height * 0.018), width, height);
    for (let y = padded.top; y <= padded.bottom; y += 1) {
      for (let x = padded.left; x <= padded.right; x += 1) cleaned[y * width + x] = 0;
    }
  });
  return cleaned;
}

function isLikelyYellowLineComponent(component, width, height) {
  if (isLikelyYellowPayoutText(component, width, height)) return false;
  const area = component.width * component.height;
  const density = component.pixels / Math.max(1, area);
  const horizontalLine = component.width >= width * 0.16 && component.height <= height * 0.28;
  const longTrace = component.width >= width * 0.10 && density < 0.72;
  const tallButNotRightText = component.height >= height * 0.16 && component.left < width * 0.70 && density < 0.45;
  return horizontalLine || longTrace || tallButNotRightText;
}

function detectZeroLineY(imageData) {
  const { data, width, height } = imageData;
  let best = { y: null, count: 0 };
  for (let y = Math.round(height * 0.20); y < Math.round(height * 0.80); y += 1) {
    let count = 0;
    for (let x = Math.round(width * 0.05); x < Math.round(width * 0.95); x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isGrid = max - min < 28 && max >= 70 && max <= 220;
      if (isGrid) count += 1;
    }
    if (count > best.count) best = { y, count };
  }
  const threshold = width * 0.12;
  return { y: best.count > threshold ? best.y : null, detected: best.count > threshold, count: best.count, threshold };
}

function buildYellowLineTrace(mask, width, height) {
  const trace = Array(width).fill(null);
  for (let x = 0; x < width; x += 1) {
    const ys = [];
    for (let y = Math.round(height * 0.04); y < Math.round(height * 0.96); y += 1) {
      if (mask[y * width + x]) ys.push(y);
    }
    if (!ys.length) continue;
    ys.sort((a, b) => a - b);
    trace[x] = { x, y: ys[Math.floor(ys.length / 2)], count: ys.length };
  }
  return trace;
}

function findYellowLineTraceSegments(trace, width, height, textBlocks = []) {
  const segments = [];
  let current = [];
  let gap = 0;
  const maxGap = Math.max(3, Math.round(width * 0.012));

  trace.forEach((point) => {
    if (point) {
      if (current.length && Math.abs(point.y - current[current.length - 1].y) > Math.max(28, height * 0.20)) {
        if (current.length >= 4) segments.push(segmentFromPoints(current, width, height, textBlocks));
        current = [];
      }
      current.push(point);
      gap = 0;
      return;
    }
    if (!current.length) return;
    gap += 1;
    if (gap > maxGap) {
      const trimmed = current.slice(0, Math.max(0, current.length - gap + 1));
      if (trimmed.length >= 4) segments.push(segmentFromPoints(trimmed, width, height, textBlocks));
      current = [];
      gap = 0;
    }
  });

  if (current.length >= 4) segments.push(segmentFromPoints(current, width, height, textBlocks));
  return segments.filter((segment) => segment.points.length >= Math.max(5, width * 0.018));
}

function segmentFromPoints(points, width, height, textBlocks = []) {
  const segment = { startX: points[0].x, endX: points[points.length - 1].x, points };
  const endpoint = endpointFromTraceSegment(segment, width);
  segment.textLike = endpointLooksLikeText(endpoint, textBlocks, width, height) || looksLikeTextOnlySegment(segment, width, height);
  return segment;
}

function looksLikeTextOnlySegment(segment, width, height) {
  const segmentWidth = segment.endX - segment.startX + 1;
  const ys = segment.points.map((point) => point.y);
  const segmentHeight = Math.max(...ys) - Math.min(...ys) + 1;
  const inPayoutZone = segment.endX > width * 0.60 && Math.min(...ys) > height * 0.50;
  const compact = segmentWidth < width * 0.18 && segmentHeight < height * 0.28;
  return inPayoutZone && compact;
}

function detectYellowEndpoint(segments, width, height, textBlocks = []) {
  const candidates = segments
    .slice()
    .sort((a, b) => b.endX - a.endX || b.points.length - a.points.length);
  for (const segment of candidates) {
    if (segment.textLike) continue;
    const endpoint = endpointFromTraceSegment(segment, width);
    if (!endpointLooksLikeText(endpoint, textBlocks, width, height)) return endpoint;
  }
  return null;
}

function endpointFromTraceSegment(segment, width) {
  if (!segment?.points?.length) return null;
  const tailWidth = Math.max(4, Math.round(width * 0.02));
  const tail = segment.points.filter((point) => point.x >= segment.endX - tailWidth);
  const usable = tail.length ? tail : segment.points.slice(-5);
  const averageY = usable.reduce((sum, point) => sum + point.y, 0) / usable.length;
  return { x: segment.endX, y: averageY };
}

function endpointLooksLikeText(endpoint, textBlocks = [], width = 1, height = 1) {
  if (!endpoint) return false;
  const nearTextBlock = textBlocks.some((block) => {
    const padded = padRect(block, Math.max(10, width * 0.025), Math.max(8, height * 0.025), width, height);
    return endpoint.x >= padded.left && endpoint.x <= padded.right && endpoint.y >= padded.top && endpoint.y <= padded.bottom;
  });
  const inPayoutCorner = endpoint.x > width * 0.72 && endpoint.y > height * 0.62;
  return nearTextBlock || inPayoutCorner;
}


function detectAtGraphRegion(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height).data;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  let count = 0;

  for (let y = Math.round(height * 0.10); y < Math.round(height * 0.92); y += 1) {
    for (let x = Math.round(width * 0.05); x < Math.round(width * 0.98); x += 1) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      if (isAtGraphYellow(r, g, b) || isAtGraphLineColor(r, g, b)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        count += 1;
      }
    }
  }

  if (count < 80 || right <= left || bottom <= top) return null;
  const padX = Math.max(12, Math.round(width * 0.025));
  const padY = Math.max(12, Math.round(height * 0.035));
  return {
    left: Math.max(0, left - padX),
    right: Math.min(width - 1, right + padX),
    top: Math.max(0, top - padY),
    bottom: Math.min(height - 1, bottom + padY),
  };
}

async function recognizeAtGraphUnitNumber(sourceCanvas, graphRect) {
  if (!window.Tesseract) return "";
  const titleHeight = Math.max(42, Math.round(sourceCanvas.height * 0.12));
  const rect = {
    left: Math.max(0, graphRect.left - 8),
    right: Math.min(sourceCanvas.width - 1, graphRect.right + 8),
    top: Math.max(0, graphRect.top - titleHeight),
    bottom: Math.max(0, graphRect.top - 1),
  };
  if (rect.bottom <= rect.top) return "";
  const cropped = cropCanvas(sourceCanvas, rect, { padding: 10, fill: "white" });
  const enhanced = enhanceCanvasForOcr(cropped);
  try {
    const result = await window.Tesseract.recognize(enhanced, "eng", {
      tessedit_pageseg_mode: "6",
      tessedit_char_whitelist: "[]0123456789台番No.- ",
    });
    const text = result.data.text || "";
    const candidates = text.match(/\d{2,5}/g) || [];
    return candidates.sort((a, b) => scoreMachineNumber(b) - scoreMachineNumber(a))[0] || "";
  } catch {
    return "";
  }
}

function estimateAtGraphMedals(sourceCanvas, graphRect) {
  const graphCanvas = cropCanvas(sourceCanvas, graphRect, { padding: 0, fill: "white" });
  const ctx = graphCanvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = graphCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const points = collectAtGraphLinePoints(imageData);
  debugLog("collectAtGraphLinePoints の点数", points.length);
  const minPointCount = Math.max(20, Math.round(width * 0.02));
  if (points.length < minPointCount) {
    const message = "グラフ線を検出できませんでした。画像の線色・背景・スクショ範囲が想定と違う可能性があります。";
    setStatus(message);
    debugLog(message, { points: points.length, minPointCount });
    debugLog("推定した zeroLineY", null);
    debugLog("推定した endPoint", null);
    debugLog("推定差枚", null);
    return { medals: Number.NaN, warnings: [message] };
  }

  const endPoint = pickAtGraphEndpoint(points, width);
  const zeroLineY = detectAtGraphZeroLine(imageData) ?? height * 0.5;
  const graphTop = Math.max(0, height * 0.08);
  const graphBottom = Math.min(height - 1, height * 0.92);
  const span = Math.max(1, Math.max(zeroLineY - graphTop, graphBottom - zeroLineY));
  const medals = Math.round(((zeroLineY - endPoint.y) / span) * 5000 / 50) * 50;
  debugLog("推定した zeroLineY", zeroLineY);
  debugLog("推定した endPoint", endPoint);
  debugLog("推定差枚", medals);
  return { medals, warnings: [] };
}

function collectAtGraphLinePoints(imageData) {
  const { data, width, height } = imageData;
  const points = [];
  for (let y = Math.round(height * 0.04); y < Math.round(height * 0.96); y += 1) {
    for (let x = Math.round(width * 0.03); x < Math.round(width * 0.98); x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (isAtGraphYellow(r, g, b) || isAtGraphLineColor(r, g, b)) points.push({ x, y });
    }
  }
  return points;
}

function pickAtGraphEndpoint(points, width) {
  const maxX = Math.max(...points.map((point) => point.x));
  const tail = points.filter((point) => point.x >= maxX - Math.max(10, width * 0.03));
  const averageY = tail.reduce((sum, point) => sum + point.y, 0) / tail.length;
  return { x: maxX, y: averageY };
}

function detectAtGraphZeroLine(imageData) {
  const { data, width, height } = imageData;
  let best = { y: null, count: 0 };
  for (let y = Math.round(height * 0.25); y < Math.round(height * 0.75); y += 1) {
    let count = 0;
    for (let x = Math.round(width * 0.05); x < Math.round(width * 0.95); x += 1) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const gray = Math.max(r, g, b) - Math.min(r, g, b) < 18;
      if (gray && r >= 95 && r <= 205 && g >= 95 && g <= 205 && b >= 95 && b <= 205) count += 1;
    }
    if (count > best.count) best = { y, count };
  }
  return best.count > width * 0.18 ? best.y : null;
}

function isAtGraphYellow(r, g, b) {
  return r >= 170 && g >= 125 && g <= 235 && b <= 110 && r - b >= 80;
}

function isAtGraphLineColor(r, g, b) {
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  const isColoredLine = saturation > 38 && (r > 105 || g > 105 || b > 105);
  const isDarkLine = r < 88 && g < 105 && b < 120;
  return isColoredLine || isDarkLine;
}

function cropCanvas(source, rect, options = {}) {
  const padding = options.padding || 0;
  const width = Math.max(1, Math.round(rect.right - rect.left + 1 + padding * 2));
  const height = Math.max(1, Math.round(rect.bottom - rect.top + 1 + padding * 2));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = options.fill || "transparent";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, rect.left, rect.top, rect.right - rect.left + 1, rect.bottom - rect.top + 1, padding, padding, width - padding * 2, height - padding * 2);
  return canvas;
}

function enhanceCanvasForOcr(source) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    const value = luminance < 170 ? 0 : 255;
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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
      if (isAtGraphLineColor(r, g, b) || isAtGraphYellow(r, g, b)) points.push({ x, y });
    }
  }

  if (!points.length) return null;
  return pickAtGraphEndpoint(points, width);
}


function applyScanDefaultsToBatchResults() {
  if (!state.batchResults.length) return;
  const defaults = getScanDefaults();
  state.batchResults = state.batchResults.map((result) => ({ ...result, ...defaults, saved: false }));
  renderBatchResults();
}

function getScanDefaults() {
  return {
    date: $("dateInput").value,
    shop: $("shopInput").value.trim(),
    tag: $("tagInput").value,
    machine: $("machineInput").value.trim(),
  };
}

function renderBatchWarnings(result) {
  const messages = [...(result.warnings || [])];
  if (result.numberCandidates?.length > 1) {
    messages.push(`台番号候補：${result.numberCandidates.join(" / ")}`);
  }
  if (!messages.length) return "";
  return messages.join(" / ");
}

function hideBatchResults() {
  state.batchResults = state.batchResults.filter(Boolean);
  elements.batchPanel.hidden = true;
  elements.batchResults.innerHTML = "";
}

function renderBatchResults() {
  if (!state.batchResults.length) {
    elements.batchPanel.hidden = true;
    elements.batchResults.innerHTML = "";
    return;
  }

  elements.batchPanel.hidden = false;
  elements.batchResults.innerHTML = `
    <div class="batch-card-list">
      ${state.batchResults.map(renderBatchResultRow).join("")}
    </div>
  `;
}

function renderBatchResultRow(result, index) {
  const resultClass = Number(result.medals) > 0 ? "win" : "lose";
  const status = result.saved ? "登録済み" : result.failed ? "要確認" : "未登録";
  const warningText = renderBatchWarnings(result);
  const memo = uniqueSorted([result.memo || "", warningText].filter(Boolean)).join(" / ");
  return `
    <article class="batch-result-card ${result.saved ? "saved" : ""} ${result.failed ? "needs-review" : ""}" data-batch-card="${index}">
      <header class="batch-card-head">
        <div>
          <p class="batch-card-kicker">${escapeHtml(status)}</p>
          <h3 class="batch-card-title ${getBatchHeadingClass(result)}">${escapeHtml(formatBatchHeading(result))}</h3>
        </div>
        <button class="small-button delete" type="button" data-batch-delete="${index}">削除</button>
      </header>
      <div class="batch-card-body">
        <figure class="batch-graph-preview">
          <img class="batch-graph-image" src="${escapeHtml(result.image)}" alt="読み取りグラフ ${index + 1}" />
        </figure>
        <div class="batch-card-fields">
          <p class="batch-memo-preview">${escapeHtml(memo || "メモなし")}</p>
          <div class="batch-field-grid">
            <label>
              台番号
              <input type="text" inputmode="numeric" data-batch-index="${index}" data-batch-field="number" value="${escapeHtml(result.number)}" placeholder="手動入力" required />
            </label>
            <label>
              差枚
              <input type="number" step="1" data-batch-index="${index}" data-batch-field="medals" value="${escapeHtml(result.medals)}" placeholder="要確認" required />
            </label>
            <label>
              勝敗
              <span class="batch-result-text ${resultClass}">${Number(result.medals) > 0 ? "勝ち" : "負け"}</span>
            </label>
            <label>
              店舗名
              <input type="text" list="shopCandidates" data-batch-index="${index}" data-batch-field="shop" value="${escapeHtml(result.shop)}" required />
            </label>
            <label>
              機種名
              <input type="text" list="machineCandidates" data-batch-index="${index}" data-batch-field="machine" value="${escapeHtml(result.machine)}" required />
            </label>
            <label>
              日付
              <input type="date" data-batch-index="${index}" data-batch-field="date" value="${escapeHtml(result.date)}" required />
            </label>
            <label>
              特日タグ
              <select data-batch-index="${index}" data-batch-field="tag" required>
                ${TAGS.map((tag) => `<option value="${escapeHtml(tag)}" ${tag === result.tag ? "selected" : ""}>${escapeHtml(tag)}</option>`).join("")}
              </select>
            </label>
            <label class="batch-memo-field">
              メモ
              <textarea data-batch-index="${index}" data-batch-field="memo" rows="2" placeholder="要確認メモ">${escapeHtml(memo)}</textarea>
            </label>
          </div>
          <div class="button-row batch-card-actions">
            <button class="primary-button" type="button" data-batch-save="${index}" ${result.saved ? "disabled" : ""}>この1件を登録</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function formatBatchHeading(result) {
  const numberLabel = String(result.number || "").trim() ? `${String(result.number).trim()}番` : "台番号未読取";
  if (batchMedalsNeedReview(result)) return `${numberLabel} 要確認`;
  return `${numberLabel} ${formatMedals(result.medals)}`;
}

function getBatchHeadingClass(result) {
  if (batchMedalsNeedReview(result)) return "review";
  return Number(result.medals) > 0 ? "win" : "lose";
}

function batchMedalsNeedReview(result) {
  if (result.medalsConfirmed) return false;
  const warnings = (result.warnings || []).filter((warning) => warning !== "数字除外済み");
  const memo = String(result.memo || "");
  return warnings.some((warning) => /差枚|数字誤認識|0ライン|異常値|グラフ線|読み取り失敗/.test(warning)) || /差枚要確認|数字誤認識|読み取り失敗/.test(memo);
}

function handleBatchInput(event) {
  const input = event.target.closest("[data-batch-index][data-batch-field]");
  if (!input) return;
  const index = Number(input.dataset.batchIndex);
  const field = input.dataset.batchField;
  const result = state.batchResults[index];
  if (!result) return;
  result[field] = field === "medals" ? input.value : input.value.trim();
  result.saved = false;
  if (field === "medals") result.medalsConfirmed = true;
  if (field === "memo") result.warnings = [];

  const card = input.closest(".batch-result-card");
  const saveButton = card?.querySelector("[data-batch-save]");
  if (saveButton) saveButton.disabled = false;
  card?.classList.remove("saved");
  if (field === "medals" || field === "number" || field === "memo") updateBatchResultBanner(card, result);
}

function updateBatchResultBanner(card, result) {
  const resultCell = card?.querySelector(".batch-result-text");
  const title = card?.querySelector(".batch-card-title");
  if (resultCell) {
    resultCell.classList.toggle("win", Number(result.medals) > 0);
    resultCell.classList.toggle("lose", Number(result.medals) <= 0);
    resultCell.textContent = Number(result.medals) > 0 ? "勝ち" : "負け";
  }
  if (title) {
    title.classList.remove("win", "lose", "review");
    title.classList.add(getBatchHeadingClass(result));
    title.textContent = formatBatchHeading(result);
  }
}

function handleBatchClick(event) {
  const deleteButton = event.target.closest("[data-batch-delete]");
  if (deleteButton) {
    const index = Number(deleteButton.dataset.batchDelete);
    state.batchResults.splice(index, 1);
    renderBatchResults();
    setStatus(state.batchResults.length ? `${state.batchResults.length}件の読み取り結果を確認してください` : "読み取り結果を削除しました");
    return;
  }

  const button = event.target.closest("[data-batch-save]");
  if (!button) return;
  const index = Number(button.dataset.batchSave);
  saveBatchResult(index);
}

function saveBatchResult(index) {
  const result = state.batchResults[index];
  if (!result) return false;
  const missing = getBatchResultMissingFields(result);
  if (missing.length) {
    const message = `${index + 1}件目の不足項目：${missing.join("、")}`;
    result.warnings = uniqueSorted([...(result.warnings || []), message]);
    renderBatchResults();
    alert(message);
    return false;
  }
  const record = createRecordFromBatchResult(result);
  saveRecord(record);
  result.saved = true;
  renderBatchResults();
  renderAll();
  return true;
}

function saveAllBatchResults() {
  if (!state.batchResults.length) return;
  const skipped = [];
  let savedCount = 0;

  for (let index = 0; index < state.batchResults.length; index += 1) {
    const result = state.batchResults[index];
    if (result.saved) continue;
    const missing = getBatchResultMissingFields(result);
    if (missing.length) {
      const message = `${index + 1}件目の不足項目：${missing.join("、")}`;
      result.warnings = uniqueSorted([...(result.warnings || []), message]);
      skipped.push(message);
      continue;
    }
    const record = createRecordFromBatchResult(result);
    saveRecord(record);
    result.saved = true;
    savedCount += 1;
  }

  renderBatchResults();
  renderAll();
  if (skipped.length) {
    setStatus(`${savedCount}件を登録、${skipped.length}件は不足項目のため未登録です`);
    alert(`未登録の結果があります。\n${skipped.join("\n")}`);
    return;
  }
  setStatus(`${savedCount}件を登録しました`);
}

function validateBatchResult(result) {
  return getBatchResultMissingFields(result).length === 0;
}

function getBatchResultMissingFields(result) {
  const missing = [];
  if (!result.date) missing.push("日付");
  if (!String(result.shop || "").trim()) missing.push("店舗名");
  if (!String(result.machine || "").trim()) missing.push("機種名");
  if (!String(result.number || "").trim()) missing.push("台番号");
  if (String(result.medals ?? "").trim() === "" || !Number.isFinite(Number(result.medals))) missing.push("差枚");
  return missing;
}

function createRecordFromBatchResult(result) {
  const medals = Number(result.medals);
  return {
    id: crypto.randomUUID(),
    date: result.date,
    shop: String(result.shop || "").trim(),
    tag: TAGS.includes(result.tag) ? result.tag : "その他",
    machine: String(result.machine || "").trim(),
    number: String(result.number || "").trim(),
    medals: Number.isFinite(medals) ? Math.round(medals) : 0,
    result: medals > 0 ? "勝ち" : "負け",
    memo: String(result.memo || "").trim(),
    image: result.image,
    updatedAt: new Date().toISOString(),
  };
}

function createRecordFromConfirmForm() {
  const medalValue = Number($("confirmMedalsInput").value);
  const editingId = elements.editingIdInput.value;
  const existing = state.records.find((record) => record.id === editingId);
  return {
    id: editingId || crypto.randomUUID(),
    date: $("confirmDateInput").value,
    shop: $("confirmShopInput").value.trim(),
    tag: $("confirmTagInput").value,
    machine: $("confirmMachineInput").value.trim(),
    number: $("confirmNumberInput").value.trim(),
    medals: Number.isFinite(medalValue) ? Math.round(medalValue) : 0,
    result: medalValue > 0 ? "勝ち" : "負け",
    memo: existing?.memo || "",
    image: state.selectedImage,
    updatedAt: new Date().toISOString(),
  };
}

function validateRecord(record) {
  return Boolean(record.date && record.shop && record.machine && record.number && Number.isFinite(Number(record.medals)));
}

function saveRecord(record) {
  addCandidate("shops", record.shop);
  addCandidate("machines", record.machine);

  const index = state.records.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    state.records[index] = { ...state.records[index], ...record };
  } else {
    state.records.unshift(record);
  }

  saveRecords();
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
  const record = createRecordFromConfirmForm();
  if (!validateRecord(record)) {
    alert("必須項目（日付・店舗名・機種名・台番号・差枚）を確認してください。");
    return;
  }
  saveRecord(record);
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
  state.selectedImages = state.selectedImage ? [state.selectedImage] : [];
  state.batchResults = [];
  hideBatchResults();
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
  state.selectedImages = [];
  state.batchResults = [];
  elements.previewImage.removeAttribute("src");
  elements.previewImage.parentElement.classList.remove("has-image");
  elements.ocrMachineNumber.textContent = "未読取";
  elements.estimatedMedals.textContent = "未推定";
  hideBatchResults();
  setStatus("待機中");
}

function updateWinLoseBanner() {
  const medals = Number($("confirmMedalsInput").value);
  elements.winLoseBanner.classList.remove("win", "lose");
  if (!Number.isFinite(medals)) {
    elements.winLoseBanner.textContent = "勝敗は差枚から自動判定されます";
    return;
  }
  const result = medals > 0 ? "勝ち" : "負け";
  elements.winLoseBanner.textContent = `${formatMedals(medals)} / ${result}`;
  elements.winLoseBanner.classList.add(medals > 0 ? "win" : "lose");
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
    number: elements.recordsNumberFilter.value.trim(),
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
          <td class="number-cell medals-cell ${record.medals > 0 ? "win-text" : "lose-text"}">${formatMedals(record.medals)}</td>
          <td class="${record.medals > 0 ? "win-text" : "lose-text"}">${record.medals > 0 ? "勝ち" : "負け"}</td>
          <td>${escapeHtml(record.memo || "")}</td>
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
    startDate: elements.summaryStartDateFilter.value,
    endDate: elements.summaryEndDateFilter.value,
  });
  const labels = {
    tag: "特日タグ",
    shop: "店舗名",
    machine: "機種名",
    number: "台番号",
    tail: "末尾",
    range: "番号帯",
  };
  elements.summaryHead.innerHTML = `
    <tr>
      <th>${labels[mode]}</th>
      <th>登録台数</th>
      <th>プラス台数</th>
      <th>勝率</th>
      <th>平均差枚</th>
      <th>総差枚</th>
      <th>最大差枚</th>
      <th>最小差枚</th>
    </tr>
  `;

  const groups = groupRecords(mode, summaryRecords);
  if (!groups.length) {
    elements.summaryBody.innerHTML = `<tr><td class="empty-row" colspan="8">集計できるデータがありません</td></tr>`;
    return;
  }

  elements.summaryBody.innerHTML = groups
    .map(
      (group) => `
        <tr>
          <td>${escapeHtml(group.key)}</td>
          <td class="number-cell">${group.count}</td>
          <td class="number-cell win-text">${group.positives}</td>
          <td class="number-cell strong-rate">${Math.round(group.winRate * 100)}%</td>
          <td class="number-cell medals-cell ${group.average > 0 ? "win-text" : "lose-text"}">${formatMedals(group.average)}</td>
          <td class="number-cell medals-cell ${group.total > 0 ? "win-text" : "lose-text"}">${formatMedals(group.total)}</td>
          <td class="number-cell medals-cell win-text">${formatMedals(group.max)}</td>
          <td class="number-cell medals-cell lose-text">${formatMedals(group.min)}</td>
        </tr>
      `
    )
    .join("");
}

function renderRecommendations() {
  const filtered = applyFilters(state.records, {
    shop: elements.recommendShopFilter.value,
    tag: elements.recommendTagInput.value,
    machine: elements.recommendMachineFilter.value,
  });
  const groups = summarizeBy(filtered, (record) => `${record.shop}|||${record.machine}|||${record.number}`);
  const recommendations = groups
    .map((group) => ({ ...group, grade: gradeGroup(group) }))
    .sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || b.average - a.average || b.winRate - a.winRate || b.count - a.count)
    .slice(0, 20);

  if (!recommendations.length) {
    elements.recommendationList.innerHTML = `<tr><td class="empty-row" colspan="9">条件に一致する登録データがありません。</td></tr>`;
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
          <td class="number-cell">${item.count}</td>
          <td class="number-cell strong-rate">${Math.round(item.winRate * 100)}%</td>
          <td class="number-cell medals-cell ${item.average > 0 ? "win-text" : "lose-text"}">${formatMedals(item.average)}</td>
          <td class="number-cell medals-cell ${item.total > 0 ? "win-text" : "lose-text"}">${formatMedals(item.total)}</td>
          <td><span class="grade grade-${item.grade.toLowerCase()}">${item.grade}</span></td>
          <td>${escapeHtml(recommendationReason(item))}</td>
        </tr>
      `;
    })
    .join("");
}

function recommendationReason(item) {
  const rate = Math.round(item.winRate * 100);
  if (item.count < 2) return `データ不足（登録${item.count}回）。AT機は荒れやすいため、1回だけの大勝ちは参考扱いです。`;
  if (item.grade === "A" && item.count >= 3) return `登録${item.count}回、勝率${rate}%、平均差枚がプラスで安定感があります。`;
  if (item.grade === "A") return `登録${item.count}回で平均差枚+500枚以上。回数は少なめなので手動確認推奨です。`;
  if (item.grade === "B") return `A条件には未達ですが、勝率${rate}%または平均差枚プラスで候補に残せます。`;
  return item.average < 0 ? "平均差枚がマイナス、または勝率が低いためC評価です。" : "データ不足または上位条件に届かないためC評価です。";
}

function groupRecords(mode, records = state.records) {
  const selectors = {
    tag: (record) => record.tag,
    shop: (record) => record.shop,
    machine: (record) => record.machine,
    number: (record) => record.number,
    tail: (record) => numberTail(record.number),
    range: (record) => numberRange(record.number),
  };
  return summarizeBy(records, selectors[mode] || selectors.tag).sort((a, b) => b.average - a.average || b.winRate - a.winRate || b.count - a.count);
}

function applyFilters(records, filters) {
  return records.filter((record) => {
    if (filters.shop && record.shop !== filters.shop) return false;
    if (filters.tag && record.tag !== filters.tag) return false;
    if (filters.machine && record.machine !== filters.machine) return false;
    if (filters.number && !String(record.number || "").includes(filters.number)) return false;
    if (filters.startDate && String(record.date || "") < filters.startDate) return false;
    if (filters.endDate && String(record.date || "") > filters.endDate) return false;
    return true;
  });
}

function summarizeBy(records, selector) {
  const map = new Map();
  records.forEach((record) => {
    const key = selector(record) || "未設定";
    const medals = Number(record.medals) || 0;
    const item = map.get(key) || { key, count: 0, positives: 0, total: 0, max: medals, min: medals };
    item.count += 1;
    item.positives += medals > 0 ? 1 : 0;
    item.total += medals;
    item.max = Math.max(item.max, medals);
    item.min = Math.min(item.min, medals);
    map.set(key, item);
  });
  return Array.from(map.values()).map((item) => ({
    ...item,
    wins: item.positives,
    winRate: item.count ? item.positives / item.count : 0,
    average: item.count ? Math.round(item.total / item.count) : 0,
  }));
}

function gradeGroup(group) {
  if (group.count < 2) return "C";
  if ((group.count >= 3 && group.winRate >= 0.5 && group.average > 0) || group.average >= 500) return "A";
  if (group.average > 0 || group.winRate >= 0.5) return "B";
  return "C";
}

function numberTail(value) {
  const digits = String(value || "").match(/\d/g);
  return digits?.length ? `${digits[digits.length - 1]}番末尾` : "未設定";
}

function numberRange(value) {
  const number = Number(String(value || "").replace(/\D/g, ""));
  if (!Number.isFinite(number) || number <= 0) return "未設定";
  if (number < 100) return "1〜99番台";
  const start = Math.floor(number / 100) * 100;
  return `${start}〜${start + 99}番台`;
}

function gradeRank(grade) {
  return { A: 1, B: 2, C: 3 }[grade] || 9;
}

function clearAllRecords() {
  if (!state.records.length) {
    alert("削除する登録データがありません。");
    return;
  }
  if (!confirm(`登録データ${state.records.length}件をすべて削除しますか？この操作は元に戻せません。`)) return;
  state.records = [];
  saveRecords();
  renderAll();
}

function exportCsv() {
  const headers = ["日付", "店舗名", "特日タグ", "機種名", "台番号", "差枚", "勝敗", "メモ", "画像"];
  const rows = state.records.map((record) => [
    record.date,
    record.shop,
    record.tag,
    record.machine,
    record.number,
    record.medals,
    record.medals > 0 ? "勝ち" : "負け",
    record.memo || "",
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
    const headers = rows[0] || [];
    const hasMemoColumn = headers.includes("メモ");
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
        result: medals > 0 ? "勝ち" : "負け",
        memo: hasMemoColumn ? row[7] || "" : "",
        image: hasMemoColumn ? row[8] || "" : row[7] || "",
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

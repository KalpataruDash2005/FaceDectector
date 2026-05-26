const els = {
  health: document.querySelector("#health"),
  statsGrid: document.querySelector("#statsGrid"),
  uploadForm: document.querySelector("#uploadForm"),
  fileInput: document.querySelector("#fileInput"),
  fileLabel: document.querySelector("#fileLabel"),
  dropzone: document.querySelector("#dropzone"),
  uploadModel: document.querySelector("#uploadModel"),
  uploadDetector: document.querySelector("#uploadDetector"),
  uploadMessage: document.querySelector("#uploadMessage"),
  imageOne: document.querySelector("#imageOne"),
  imageTwo: document.querySelector("#imageTwo"),
  compareForm: document.querySelector("#compareForm"),
  compareModel: document.querySelector("#compareModel"),
  compareDetector: document.querySelector("#compareDetector"),
  compareResult: document.querySelector("#compareResult"),
  refreshButton: document.querySelector("#refreshButton"),
  apiUrl: document.querySelector("#apiUrl"),
  saveApiButton: document.querySelector("#saveApiButton"),
  gallery: document.querySelector("#gallery"),
  template: document.querySelector("#imageCardTemplate"),
  detailDialog: document.querySelector("#detailDialog"),
  detailTitle: document.querySelector("#detailTitle"),
  detailBody: document.querySelector("#detailBody"),
  closeDialog: document.querySelector("#closeDialog"),
  modeList: document.querySelector("#modeList"),
  modeTitle: document.querySelector("#modeTitle"),
  modeCopy: document.querySelector("#modeCopy"),
  moduleTitle: document.querySelector("#moduleTitle"),
  moduleCopy: document.querySelector("#moduleCopy"),
  moduleOutput: document.querySelector("#moduleOutput"),
};

const modes = {
  fake: {
    title: "AI Check",
    copy: "Estimate AI-generated or manipulated-photo risk with local texture, smoothness, symmetry, and edge-density heuristics.",
    module: "AI Check Board",
    moduleCopy: "This is a local heuristic signal, not a court-grade authenticity result.",
  },
  doppelganger: {
    title: "Local Doppleganger",
    copy: "Compare your local uploads and find the closest visual match using face embeddings.",
    module: "Local Match Board",
    moduleCopy: "The closest-match workflow uses only the images you upload here.",
  },
};

const state = {
  images: [],
  apiBase: localStorage.getItem("faceDetectionApiBase") || "/api/v1",
  mode: "fake",
  analysisCache: new Map(),
};

els.apiUrl.value = state.apiBase;

const apiUrl = (path) => `${state.apiBase}${path}`;

const setBusy = (button, busy, label) => {
  button.disabled = busy;
  const span = button.querySelector("span");
  if (span) span.textContent = label;
  else button.textContent = label;
};

const request = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      message = message;
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : "Not processed";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char]));

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  let size = Number(bytes);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const setHealth = (status, aiService) => {
  const ok = status === "UP" && aiService === "UP";
  els.health.innerHTML = `<span class="dot ${ok ? "up" : "down"}"></span><span>Backend ${status || "DOWN"} - AI ${aiService || "DOWN"}</span>`;
};

const renderStats = (stats = {}) => {
  const items = [
    ["Images", stats.totalImages ?? 0],
    ["Completed", stats.completedImages ?? 0],
    ["Pending", stats.pendingImages ?? 0],
    ["Failed", stats.failedImages ?? 0],
    ["Matches", stats.totalMatches ?? 0],
  ];
  els.statsGrid.innerHTML = items.map(([label, value]) => (
    `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`
  )).join("");
};

const detailRows = (items) => items.map(([label, value]) => (
  `<div><dt>${label}</dt><dd>${value}</dd></div>`
)).join("");

const completedImages = () => state.images.filter((image) => image.processingStatus === "COMPLETED");

const fillCompareSelects = () => {
  const options = completedImages().map((image) => (
    `<option value="${image.id}">#${image.id} ${escapeHtml(image.originalFilename)}</option>`
  )).join("");
  const fallback = `<option value="">Upload completed images first</option>`;
  els.imageOne.innerHTML = options || fallback;
  els.imageTwo.innerHTML = options || fallback;
};

const loadAnalysis = async (id) => {
  if (state.analysisCache.has(id)) return state.analysisCache.get(id);
  const analysis = await request(`/images/${id}/studio-analysis?detectorBackend=${encodeURIComponent(els.uploadDetector.value)}`);
  state.analysisCache.set(id, analysis);
  return analysis;
};

const renderGallery = () => {
  els.gallery.innerHTML = "";
  if (!state.images.length) {
    els.gallery.innerHTML = `<p>No images uploaded yet. Add local images to run AI checks and doppleganger comparisons.</p>`;
    fillCompareSelects();
    renderModule();
    return;
  }

  for (const image of state.images) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    const img = node.querySelector("img");
    const title = node.querySelector("h3");
    const subtitle = node.querySelector("p");
    const badge = node.querySelector(".badge");
    const dl = node.querySelector("dl");

    img.src = apiUrl(`/images/${image.id}/file`);
    img.alt = image.originalFilename;
    title.textContent = image.originalFilename;
    subtitle.textContent = `Uploaded ${formatDate(image.uploadedAt)}`;
    badge.textContent = image.processingStatus;
    badge.classList.toggle("failed", image.processingStatus === "FAILED");
    dl.innerHTML = detailRows([
      ["Faces", image.faceCount ?? 0],
      ["Size", formatBytes(image.fileSize)],
    ]);

    node.querySelector(".detail-button").addEventListener("click", () => showDetails(image.id));
    node.querySelector(".delete-button").addEventListener("click", () => deleteImage(image.id));
    els.gallery.appendChild(node);
  }

  fillCompareSelects();
  renderModule();
};

const loadHealth = async () => {
  try {
    const health = await request("/health");
    setHealth(health.status, health.aiService);
  } catch {
    setHealth("DOWN", "DOWN");
  }
};

const loadStats = async () => {
  try {
    renderStats(await request("/stats"));
  } catch {
    renderStats();
  }
};

const loadImages = async () => {
  const page = await request("/images?page=0&size=100");
  state.images = page.content || [];
  renderGallery();
};

const refresh = async () => {
  await Promise.all([loadHealth(), loadStats(), loadImages()]);
};

const uploadImage = async (event) => {
  event.preventDefault();
  const files = Array.from(els.fileInput.files || []);
  if (!files.length) return;

  const button = els.uploadForm.querySelector("button");
  setBusy(button, true, `Uploading 0/${files.length}`);
  els.uploadMessage.textContent = "";

  try {
    for (let i = 0; i < files.length; i += 1) {
      const formData = new FormData();
      formData.append("file", files[i]);
      formData.append("model", els.uploadModel.value);
      formData.append("detectorBackend", els.uploadDetector.value);
      setBusy(button, true, `Uploading ${i + 1}/${files.length}`);
      await request("/images/upload", { method: "POST", body: formData });
    }
    els.uploadMessage.textContent = `Uploaded ${files.length} image${files.length === 1 ? "" : "s"}.`;
    els.uploadForm.reset();
    els.fileLabel.textContent = "Choose or drop images";
    state.analysisCache.clear();
    await refresh();
  } catch (error) {
    els.uploadMessage.textContent = error.message;
  } finally {
    setBusy(button, false, "Upload and Analyze");
  }
};

const compareImages = async (event) => {
  event.preventDefault();
  if (!els.imageOne.value || !els.imageTwo.value) return;
  if (els.imageOne.value === els.imageTwo.value) {
    els.compareResult.textContent = "Choose two different images.";
    return;
  }

  const button = els.compareForm.querySelector("button");
  setBusy(button, true, "Comparing...");
  els.compareResult.textContent = "";

  try {
    const result = await request("/images/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageId1: Number(els.imageOne.value),
        imageId2: Number(els.imageTwo.value),
        model: els.compareModel.value,
        detectorBackend: els.compareDetector.value,
      }),
    });
    const transformation = Math.max(0, 100 - Number(result.confidenceScore ?? 0)).toFixed(2);
    els.compareResult.innerHTML = `
      <strong>${result.isMatch ? "Same-person match" : "No match found"}</strong><br />
      Same-person confidence ${Number(result.confidenceScore ?? 0).toFixed(2)}%<br />
      Doppleganger distance score ${transformation}%<br />
      Distance ${Number(result.distance ?? 0).toFixed(4)}
    `;
    await loadStats();
  } catch (error) {
    els.compareResult.textContent = error.message;
  } finally {
    setBusy(button, false, "Compare Pair");
  }
};

const paletteHtml = (palette = []) => (
  `<div class="swatches">${palette.map((item) => `<span class="swatch" title="${item.hex}" style="background:${item.hex}"></span>`).join("")}</div>`
);

const analysisCards = (analysis) => {
  if (!analysis?.success) return `<div class="mini-card"><strong>Analysis unavailable</strong><p>${analysis?.error || "AI service is not ready."}</p></div>`;
  return `
    <div class="feature-grid">
      <div class="mini-card"><dt>Fake risk</dt><dd>${analysis.fakePhoto.riskScore}%</dd><p>${analysis.fakePhoto.label}</p></div>
      <div class="mini-card"><dt>Texture noise</dt><dd>${analysis.fakePhoto.noiseSignature}</dd><p>Local image texture signal</p></div>
      <div class="mini-card"><dt>Edge density</dt><dd>${analysis.fakePhoto.edgeDensity}</dd><p>Low edges can raise risk</p></div>
      <div class="mini-card"><dt>Symmetry</dt><dd>${analysis.fakePhoto.symmetryScore}%</dd><p>High symmetry can raise risk</p></div>
    </div>
  `;
};

const showDetails = async (id) => {
  try {
    const detail = await request(`/images/${id}`);
    const analysis = await loadAnalysis(id);
    let metadata = {};
    try {
      metadata = detail.metadata ? JSON.parse(detail.metadata) : {};
    } catch {
      metadata = { raw: detail.metadata };
    }

    els.detailTitle.textContent = detail.originalFilename;
    els.detailBody.innerHTML = `
      <div class="detail-grid">
        <div>
          <img class="detail-image" src="${apiUrl(`/images/${id}/file`)}" alt="${escapeHtml(detail.originalFilename)}" />
        </div>
        <div>
          ${analysisCards(analysis)}
          <dl>
            ${detailRows([
              ["Status", detail.processingStatus],
              ["Faces", detail.faceCount ?? 0],
              ["Size", formatBytes(detail.fileSize)],
              ["Uploaded", formatDate(detail.uploadedAt)],
              ["Processed", formatDate(detail.processedAt)],
              ["Risk", `${analysis.fakePhoto?.riskScore ?? 0}%`],
              ["Signal", analysis.fakePhoto?.label ?? "unknown"],
              ["Detector", els.uploadDetector.options[els.uploadDetector.selectedIndex].text],
            ])}
          </dl>
          <h3>AI Check Signal</h3>
          <pre>${JSON.stringify(analysis.fakePhoto || {}, null, 2)}</pre>
          <h3>Metadata</h3>
          <pre>${JSON.stringify({ upload: metadata, image: analysis.metadata, matches: detail.faceMatches || [] }, null, 2)}</pre>
        </div>
      </div>
    `;
    els.detailDialog.showModal();
  } catch (error) {
    alert(error.message);
  }
};

const deleteImage = async (id) => {
  const image = state.images.find((item) => item.id === id);
  if (!confirm(`Delete ${image?.originalFilename || "this image"}?`)) return;
  await request(`/images/${id}`, { method: "DELETE" });
  state.analysisCache.delete(id);
  await refresh();
};

const renderModule = () => {
  const mode = modes[state.mode];
  els.modeTitle.textContent = mode.title;
  els.modeCopy.textContent = mode.copy;
  els.moduleTitle.textContent = mode.module;
  els.moduleCopy.textContent = mode.moduleCopy;

  if (!state.images.length) {
    els.moduleOutput.innerHTML = `
      <div class="feature-grid">
        ${Object.values(modes).map((item) => `<div class="feature-card"><strong>${item.title}</strong><p>${item.copy}</p></div>`).join("")}
      </div>
    `;
    return;
  }

  const cards = {
    fake: ["Texture noise", "Smoothness", "Symmetry", "AI risk"],
    doppelganger: ["Local dataset", "Closest pair", "Match history", "Visual distance"],
  };

  els.moduleOutput.innerHTML = `
    <div class="feature-grid">
      ${(cards[state.mode] || []).map((label) => `<div class="feature-card"><strong>${label}</strong><p>Open Studio on an uploaded image to generate this local analysis.</p></div>`).join("")}
    </div>
  `;
};

els.fileInput.addEventListener("change", () => {
  const files = Array.from(els.fileInput.files || []);
  els.fileLabel.textContent = files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose or drop images";
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("dragging");
  });
}

els.dropzone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  els.fileInput.files = transfer.files;
  els.fileLabel.textContent = `${files.length} image${files.length === 1 ? "" : "s"} selected`;
});

els.modeList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-mode]");
  if (!button) return;
  state.mode = button.dataset.mode;
  els.modeList.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  renderModule();
});

els.uploadForm.addEventListener("submit", uploadImage);
els.compareForm.addEventListener("submit", compareImages);
els.refreshButton.addEventListener("click", refresh);
els.closeDialog.addEventListener("click", () => els.detailDialog.close());
els.saveApiButton.addEventListener("click", async () => {
  state.apiBase = els.apiUrl.value.trim().replace(/\/$/, "") || "/api/v1";
  localStorage.setItem("faceDetectionApiBase", state.apiBase);
  state.analysisCache.clear();
  await refresh();
});

refresh().catch((error) => {
  els.gallery.innerHTML = `<p>${error.message}</p>`;
  renderModule();
});

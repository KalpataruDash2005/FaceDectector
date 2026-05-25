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
};

const state = {
  images: [],
  apiBase: localStorage.getItem("faceDetectionApiBase") || "/api/v1",
};

els.apiUrl.value = state.apiBase;

const setBusy = (button, busy, label) => {
  button.disabled = busy;
  button.querySelector("span") ? button.querySelector("span").textContent = label : button.textContent = label;
};

const apiUrl = (path) => `${state.apiBase}${path}`;

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
  if (response.status === 204) {
    return null;
  }
  return response.json();
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : "Not processed";

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
  const dotClass = status === "UP" && aiService === "UP" ? "up" : "down";
  els.health.innerHTML = `<span class="dot ${dotClass}"></span><span>Backend ${status || "DOWN"} · AI ${aiService || "DOWN"}</span>`;
};

const renderStats = (stats = {}) => {
  const items = [
    ["Total", stats.totalImages ?? 0],
    ["Completed", stats.completedImages ?? 0],
    ["Pending", stats.pendingImages ?? 0],
    ["Failed", stats.failedImages ?? 0],
    ["Matches", stats.totalMatches ?? 0],
  ];
  els.statsGrid.innerHTML = items.map(([label, value]) => (
    `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`
  )).join("");
};

const completedImages = () => state.images.filter((image) => image.processingStatus === "COMPLETED");

const fillCompareSelects = () => {
  const options = completedImages().map((image) => (
    `<option value="${image.id}">#${image.id} ${image.originalFilename}</option>`
  )).join("");
  const fallback = `<option value="">Upload completed images first</option>`;
  els.imageOne.innerHTML = options || fallback;
  els.imageTwo.innerHTML = options || fallback;
};

const detailRows = (items) => items.map(([label, value]) => (
  `<div><dt>${label}</dt><dd>${value}</dd></div>`
)).join("");

const renderGallery = () => {
  els.gallery.innerHTML = "";

  if (!state.images.length) {
    els.gallery.innerHTML = `<p>No images uploaded yet.</p>`;
    fillCompareSelects();
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
  const file = els.fileInput.files[0];
  if (!file) return;

  const button = els.uploadForm.querySelector("button");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", els.uploadModel.value);
  formData.append("detectorBackend", els.uploadDetector.value);

  els.uploadMessage.textContent = "";
  setBusy(button, true, "Processing...");

  try {
    const result = await request("/images/upload", {
      method: "POST",
      body: formData,
    });
    els.uploadMessage.textContent = result.message || "Upload complete";
    els.uploadForm.reset();
    els.fileLabel.textContent = "Choose or drop an image";
    await refresh();
  } catch (error) {
    els.uploadMessage.textContent = error.message;
  } finally {
    setBusy(button, false, "Upload and Detect");
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

    els.compareResult.innerHTML = `
      <strong>${result.isMatch ? "Match found" : "No match"}</strong><br />
      Confidence ${Number(result.confidenceScore ?? 0).toFixed(2)}% · Distance ${Number(result.distance ?? 0).toFixed(4)}
    `;
    await loadStats();
  } catch (error) {
    els.compareResult.textContent = error.message;
  } finally {
    setBusy(button, false, "Compare Images");
  }
};

const showDetails = async (id) => {
  try {
    const detail = await request(`/images/${id}`);
    let metadata = {};
    try {
      metadata = detail.metadata ? JSON.parse(detail.metadata) : {};
    } catch {
      metadata = { raw: detail.metadata };
    }

    els.detailTitle.textContent = detail.originalFilename;
    els.detailBody.innerHTML = `
      <img class="detail-image" src="${apiUrl(`/images/${id}/file`)}" alt="${detail.originalFilename}" />
      <dl>
        ${detailRows([
          ["Status", detail.processingStatus],
          ["Faces", detail.faceCount ?? 0],
          ["Size", formatBytes(detail.fileSize)],
          ["Uploaded", formatDate(detail.uploadedAt)],
          ["Processed", formatDate(detail.processedAt)],
        ])}
      </dl>
      <h3>Metadata</h3>
      <pre>${JSON.stringify(metadata, null, 2)}</pre>
      <h3>Matches</h3>
      <pre>${JSON.stringify(detail.faceMatches || [], null, 2)}</pre>
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
  await refresh();
};

els.fileInput.addEventListener("change", () => {
  els.fileLabel.textContent = els.fileInput.files[0]?.name || "Choose or drop an image";
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
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  els.fileInput.files = transfer.files;
  els.fileLabel.textContent = file.name;
});

els.uploadForm.addEventListener("submit", uploadImage);
els.compareForm.addEventListener("submit", compareImages);
els.refreshButton.addEventListener("click", refresh);
els.closeDialog.addEventListener("click", () => els.detailDialog.close());
els.saveApiButton.addEventListener("click", async () => {
  state.apiBase = els.apiUrl.value.trim().replace(/\/$/, "") || "/api/v1";
  localStorage.setItem("faceDetectionApiBase", state.apiBase);
  await refresh();
});

refresh().catch((error) => {
  els.gallery.innerHTML = `<p>${error.message}</p>`;
});

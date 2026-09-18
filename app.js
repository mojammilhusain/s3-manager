// ============================================================
//  app.js — UI + interactions for the S3 mobile manager
// ============================================================
(() => {
  const $ = (id) => document.getElementById(id);
  const cfg = window.S3_CONFIG;

  const state = {
    bucket: localStorage.getItem("s3.bucket") || cfg.defaultBucket || "",
    prefix: "", // current "folder" path, e.g. "photos/2026/"
  };

  // ---------- helpers ----------
  const fmtSize = (n) => {
    if (!n) return "0 B";
    const u = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
  };
  const baseName = (key) => {
    const k = key.endsWith("/") ? key.slice(0, -1) : key;
    return k.substring(k.lastIndexOf("/") + 1);
  };
  const iconFor = (name) => {
    const ext = name.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "heic", "webp", "bmp"].includes(ext)) return "🖼️";
    if (["mp4", "mov", "m4v", "avi", "mkv", "webm"].includes(ext)) return "🎬";
    if (["mp3", "wav", "m4a", "aac", "flac"].includes(ext)) return "🎵";
    if (["pdf"].includes(ext)) return "📕";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "🗜️";
    if (["doc", "docx", "txt", "md", "rtf"].includes(ext)) return "📄";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
    return "📦";
  };
  const isImage = (n) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(n);
  const isVideo = (n) => /\.(mp4|mov|m4v|webm)$/i.test(n);

  function showStatus(msg, type = "info") {
    const el = $("status");
    el.textContent = msg;
    el.className = "status " + type;
    el.classList.remove("hidden");
  }
  const hideStatus = () => $("status").classList.add("hidden");

  // ---------- setup screen ----------
  function showSetup() {
    $("app").classList.add("hidden");
    $("setup").classList.remove("hidden");
    $("regionLabel").textContent = cfg.region;
    $("bucketInput").value = state.bucket;
  }

  $("connectBtn").onclick = () => {
    const b = $("bucketInput").value.trim();
    if (!b) return;
    openBucket(b);
  };
  $("listBucketsBtn").onclick = async () => {
    const ul = $("bucketList");
    ul.innerHTML = "<li class='muted'>Loading…</li>";
    try {
      const buckets = await S3.listBuckets();
      ul.innerHTML = "";
      if (!buckets.length) { ul.innerHTML = "<li class='muted'>No buckets found.</li>"; return; }
      buckets.forEach((b) => {
        const li = document.createElement("li");
        li.textContent = "🪣 " + b;
        li.onclick = () => openBucket(b);
        ul.appendChild(li);
      });
    } catch (e) {
      ul.innerHTML = "<li class='muted'>Couldn't list buckets (CORS). Just type the name above.</li>";
    }
  };

  function openBucket(bucket) {
    state.bucket = bucket;
    state.prefix = "";
    localStorage.setItem("s3.bucket", bucket);
    $("setup").classList.add("hidden");
    $("app").classList.remove("hidden");
    load();
  }

  // ---------- breadcrumbs ----------
  function renderCrumbs() {
    const c = $("crumbs");
    c.innerHTML = "";
    const mk = (label, prefix) => {
      const span = document.createElement("span");
      span.className = "seg";
      span.textContent = label;
      span.onclick = () => { state.prefix = prefix; load(); };
      c.appendChild(span);
    };
    mk("🪣 " + state.bucket, "");
    let acc = "";
    state.prefix.split("/").filter(Boolean).forEach((part) => {
      acc += part + "/";
      const sep = document.createElement("span");
      sep.className = "sep"; sep.textContent = "›";
      c.appendChild(sep);
      mk(part, acc);
    });
  }

  // ---------- main list ----------
  async function load() {
    renderCrumbs();
    const list = $("list");
    list.innerHTML = "<div class='empty'>Loading…</div>";
    hideStatus();
    try {
      const { folders, files } = await S3.listObjects(state.bucket, state.prefix);
      list.innerHTML = "";

      if (!folders.length && !files.length) {
        list.innerHTML = "<div class='empty'>This folder is empty.<br>Tap Upload to add files.</div>";
        return;
      }
      folders.forEach((p) => list.appendChild(folderRow(p)));
      files.forEach((f) => list.appendChild(fileRow(f)));
    } catch (e) {
      list.innerHTML = "";
      showStatus(e.message, "error");
    }
  }

  function folderRow(prefix) {
    const row = document.createElement("div");
    row.className = "row folder";
    row.innerHTML = `<div class="ic">📁</div>
      <div class="meta"><div class="name">${baseName(prefix)}</div>
      <div class="sub">Folder</div></div>
      <div class="actions"><button class="del" title="Delete">🗑</button></div>`;
    row.querySelector(".meta").onclick = () => { state.prefix = prefix; load(); };
    row.querySelector(".ic").onclick = () => { state.prefix = prefix; load(); };
    row.querySelector(".del").onclick = (e) => { e.stopPropagation(); deleteFolder(prefix); };
    return row;
  }

  function fileRow(f) {
    const name = baseName(f.key);
    const row = document.createElement("div");
    row.className = "row";
    const when = f.modified ? new Date(f.modified).toLocaleString() : "";
    row.innerHTML = `<div class="ic">${iconFor(name)}</div>
      <div class="meta"><div class="name">${name}</div>
      <div class="sub">${fmtSize(f.size)} · ${when}</div></div>
      <div class="actions">
        <button class="dl" title="Download">⬇</button>
        <button class="del" title="Delete">🗑</button>
      </div>`;
    row.querySelector(".dl").onclick = () => startDownload(f);
    row.querySelector(".del").onclick = () => deleteFile(f.key, name);
    return row;
  }

  // ---------- open / preview / download ----------
  async function openFile(key, name) {
    const url = await S3.downloadUrl(state.bucket, key);
    if (isImage(name) || isVideo(name)) {
      const body = $("previewBody");
      body.innerHTML = isImage(name)
        ? `<img src="${url}" alt="${name}">`
        : `<video src="${url}" controls autoplay playsinline></video>`;
      $("preview").classList.remove("hidden");
    } else {
      window.open(url, "_blank");
    }
  }
  $("previewClose").onclick = () => {
    $("preview").classList.add("hidden");
    $("previewBody").innerHTML = "";
  };

  // ---------- delete ----------
  async function deleteFile(key, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await S3.deleteObject(state.bucket, key);
      load();
    } catch (e) { showStatus(e.message, "error"); }
  }
  async function deleteFolder(prefix) {
    if (!confirm(`Delete folder "${baseName(prefix)}" and everything in it?`)) return;
    try {
      showStatus("Deleting folder…");
      const { folders, files } = await S3.listObjects(state.bucket, prefix);
      // delete files, the placeholder, and recurse into subfolders
      for (const f of files) await S3.deleteObject(state.bucket, f.key);
      await S3.deleteObject(state.bucket, prefix).catch(() => {});
      for (const sub of folders) await deleteFolderSilent(sub);
      hideStatus();
      load();
    } catch (e) { showStatus(e.message, "error"); }
  }
  async function deleteFolderSilent(prefix) {
    const { folders, files } = await S3.listObjects(state.bucket, prefix);
    for (const f of files) await S3.deleteObject(state.bucket, f.key);
    await S3.deleteObject(state.bucket, prefix).catch(() => {});
    for (const sub of folders) await deleteFolderSilent(sub);
  }

  // ---------- upload ----------
  async function uploadFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const box = $("uploads");

    for (const file of files) {
      const key = state.prefix + file.name;
      const item = document.createElement("div");
      item.className = "up-item";
      item.innerHTML = `<div class="up-name"><span>${file.name}</span><span class="pct">0%</span></div>
        <div class="up-bar"><div class="up-fill"></div></div>`;
      box.appendChild(item);
      const fill = item.querySelector(".up-fill");
      const pct = item.querySelector(".pct");
      try {
        await S3.putObject(state.bucket, key, file, (p) => {
          fill.style.width = Math.round(p * 100) + "%";
          pct.textContent = Math.round(p * 100) + "%";
        });
        pct.textContent = "✓";
        setTimeout(() => item.remove(), 1200);
      } catch (e) {
        pct.textContent = "✕";
        item.querySelector(".up-name").title = e.message;
      }
    }
    load();
  }
  $("fileInput").onchange = (e) => { uploadFiles(e.target.files); e.target.value = ""; };
  if ($("mediaInput")) $("mediaInput").onchange = (e) => { uploadFiles(e.target.files); e.target.value = ""; };

  // ---------- new folder ----------
  $("newFolderBtn").onclick = async () => {
    const name = prompt("New folder name:");
    if (!name || !name.trim()) return;
    try {
      await S3.createFolder(state.bucket, state.prefix, name.trim());
      load();
    } catch (e) { showStatus(e.message, "error"); }
  };

  // ========================================================
  //  Download manager — progress + pause/resume + save
  //  Uses ranged fetch so paused downloads resume where they
  //  left off. Finished files are saved via the iOS share
  //  sheet (Files / Photos) or a normal browser download.
  // ========================================================
  const downloads = [];
  let dlSeq = 0;

  function mimeFor(name) {
    const e = name.split(".").pop().toLowerCase();
    const m = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
      webp: "image/webp", heic: "image/heic", bmp: "image/bmp",
      mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm",
      mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac",
      pdf: "application/pdf", zip: "application/zip", txt: "text/plain",
      csv: "text/csv", json: "application/json",
    };
    return m[e] || "application/octet-stream";
  }

  function startDownload(f) {
    let task = downloads.find((t) => t.key === f.key && t.status !== "error");
    if (!task) {
      task = {
        id: "dl" + (++dlSeq), bucket: state.bucket, key: f.key,
        name: baseName(f.key), size: f.size || null, loaded: 0, chunks: [],
        status: "queued", controller: null, blob: null, error: "",
      };
      downloads.unshift(task);
    }
    openDownloads();
    if (task.status === "done") { flash(task); return; }
    if (task.status !== "downloading") runTask(task);
  }

  function flash(task) {
    const el = document.getElementById(task.id);
    if (el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 700); }
  }

  async function runTask(task) {
    task.status = "downloading";
    task.error = "";
    renderDownloads();
    updateDlBadge();
    try {
      const url = await S3.downloadUrl(task.bucket, task.key, 3600);
      task.controller = new AbortController();
      const headers = {};
      if (task.loaded > 0) headers.Range = `bytes=${task.loaded}-`;
      const res = await fetch(url, { headers, signal: task.controller.signal });

      // If the server ignored our Range and sent the whole file, restart clean.
      if (task.loaded > 0 && res.status === 200) { task.loaded = 0; task.chunks = []; }
      if (!(res.status === 200 || res.status === 206)) throw new Error("HTTP " + res.status);

      if (!task.size) {
        const cl = parseInt(res.headers.get("Content-Length") || "0", 10);
        if (cl) task.size = cl + (res.status === 206 ? task.loaded : 0);
      }

      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        task.chunks.push(value);
        task.loaded += value.byteLength;
        updateTaskRow(task);
      }

      task.blob = new Blob(task.chunks, { type: mimeFor(task.name) });
      task.chunks = [];
      task.status = "done";
      task.controller = null;
      renderDownloads();
      updateDlBadge();
    } catch (e) {
      task.controller = null;
      if (task.status === "paused") { renderDownloads(); updateDlBadge(); return; } // intentional
      task.status = "error";
      task.error = (e && e.message) || "failed";
      renderDownloads();
      updateDlBadge();
    }
  }

  function pauseTask(task) {
    if (task.status === "downloading") {
      task.status = "paused";
      if (task.controller) task.controller.abort();
      renderDownloads();
      updateDlBadge();
    }
  }
  function resumeTask(task) {
    if (task.status === "paused" || task.status === "error") runTask(task);
  }
  function cancelTask(task) {
    task.status = "canceled";
    if (task.controller) task.controller.abort();
    task.chunks = [];
    task.blob = null;
    const i = downloads.indexOf(task);
    if (i >= 0) downloads.splice(i, 1);
    renderDownloads();
    updateDlBadge();
  }
  function removeTask(task) {
    const i = downloads.indexOf(task);
    if (i >= 0) downloads.splice(i, 1);
    renderDownloads();
    updateDlBadge();
  }

  async function saveTask(task) {
    if (!task.blob) return;
    const file = new File([task.blob], task.name, {
      type: task.blob.type || "application/octet-stream",
    });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: task.name });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // user dismissed share sheet
    }
    const url = URL.createObjectURL(task.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = task.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  function openTask(task) {
    if (!task.blob) return;
    const url = URL.createObjectURL(task.blob);
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(task.name) || /\.(mp4|mov|m4v|webm)$/i.test(task.name)) {
      const body = $("previewBody");
      body.innerHTML = /\.(mp4|mov|m4v|webm)$/i.test(task.name)
        ? `<video src="${url}" controls autoplay playsinline></video>`
        : `<img src="${url}" alt="${task.name}">`;
      $("preview").classList.remove("hidden");
    } else {
      window.open(url, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function statusText(task) {
    switch (task.status) {
      case "downloading": return "Downloading…";
      case "paused": return "Paused — tap Resume to continue";
      case "queued": return "Queued";
      case "done": return "Ready — tap Save";
      case "error": return "Error: " + (task.error || "failed");
      default: return "";
    }
  }

  function updateDlBadge() {
    const n = downloads.filter((t) => ["downloading", "queued", "paused"].includes(t.status)).length;
    const b = $("dlBadge");
    b.textContent = n;
    b.classList.toggle("hidden", n === 0);
  }

  function updateTaskRow(task) {
    const fill = document.getElementById(task.id + "-fill");
    const pct = document.getElementById(task.id + "-pct");
    if (fill && task.size) fill.style.width = Math.min(100, Math.round((task.loaded / task.size) * 100)) + "%";
    if (pct) pct.textContent = task.size ? `${fmtSize(task.loaded)} / ${fmtSize(task.size)}` : fmtSize(task.loaded);
  }

  function dlRow(task) {
    const pctText = task.size ? `${fmtSize(task.loaded)} / ${fmtSize(task.size)}` : fmtSize(task.loaded);
    const w = task.size ? Math.min(100, Math.round((task.loaded / task.size) * 100)) : (task.status === "done" ? 100 : 0);
    const item = document.createElement("div");
    item.className = "dl-item";
    item.id = task.id;
    item.innerHTML = `
      <div class="dl-top">
        <span class="dl-name">${iconFor(task.name)} ${task.name}</span>
        <span id="${task.id}-pct" class="dl-pct">${pctText}</span>
      </div>
      <div class="dl-bar"><div id="${task.id}-fill" class="dl-fill ${task.status}" style="width:${w}%"></div></div>
      <div class="dl-sub">${statusText(task)}</div>
      <div class="dl-actions"></div>`;
    const acts = item.querySelector(".dl-actions");
    const btn = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "dl-btn " + (cls || "");
      b.textContent = label;
      b.onclick = fn;
      acts.appendChild(b);
    };
    if (task.status === "downloading") {
      btn("⏸ Pause", "", () => pauseTask(task));
      btn("✕ Cancel", "ghost", () => cancelTask(task));
    } else if (task.status === "paused") {
      btn("▶ Resume", "go", () => resumeTask(task));
      btn("✕ Cancel", "ghost", () => cancelTask(task));
    } else if (task.status === "queued") {
      btn("✕ Cancel", "ghost", () => cancelTask(task));
    } else if (task.status === "error") {
      btn("↻ Retry", "go", () => resumeTask(task));
      btn("✕ Remove", "ghost", () => cancelTask(task));
    } else if (task.status === "done") {
      btn("⬇ Save", "save", () => saveTask(task));
      btn("↗ Open", "", () => openTask(task));
      btn("✕", "ghost", () => removeTask(task));
    }
    return item;
  }

  function renderDownloads() {
    const list = $("dlList");
    list.innerHTML = "";
    if (!downloads.length) {
      list.innerHTML = "<div class='empty'>No downloads yet.<br>Tap ⬇ on any file to download it here.</div>";
      return;
    }
    downloads.forEach((task) => list.appendChild(dlRow(task)));
  }

  function openDownloads() {
    renderDownloads();
    $("downloads-sheet").classList.remove("hidden");
  }
  function closeDownloads() {
    $("downloads-sheet").classList.add("hidden");
  }

  $("downloadsBtn").onclick = openDownloads;
  $("downloadsClose").onclick = closeDownloads;
  $("clearDone").onclick = () => {
    for (let i = downloads.length - 1; i >= 0; i--) {
      if (downloads[i].status === "done") downloads.splice(i, 1);
    }
    renderDownloads();
    updateDlBadge();
  };

  // ---------- nav ----------
  $("upBtn").onclick = () => {
    if (!state.prefix) return;
    const parts = state.prefix.split("/").filter(Boolean);
    parts.pop();
    state.prefix = parts.length ? parts.join("/") + "/" : "";
    load();
  };
  $("refreshBtn").onclick = load;
  $("switchBucketBtn").onclick = showSetup;

  // ---------- boot ----------
  $("regionLabel").textContent = cfg.region;
  if (state.bucket) {
    $("setup").classList.add("hidden");
    $("app").classList.remove("hidden");
    load();
  } else {
    showSetup();
  }

  // register service worker for offline app shell / installability
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
})();

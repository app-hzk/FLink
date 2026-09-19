/* ================================
   FLink — Script
   ================================ */

// ============================================
// ⚙️ KONFIGURASI — ISI API KEY IMGBB DI SINI
// ============================================
const IMGBB_API_KEY = 'f767a22a57f7fd8e8d82cc98ad177c2e';
// ============================================

const STORAGE_KEY = 'flink_history_v1';
const THEME_KEY = 'flink_theme';

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const queueEl = document.getElementById('queue');
const resultsGrid = document.getElementById('resultsGrid');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');
const themeToggle = document.getElementById('themeToggle');
const qrModal = document.getElementById('qrModal');
const qrCanvas = document.getElementById('qrCanvas');
const qrFilename = document.getElementById('qrFilename');
const downloadQrBtn = document.getElementById('downloadQrBtn');
const toastContainer = document.getElementById('toastContainer');

let currentQrDataUrl = null;

// ============================================
// THEME
// ============================================
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
});

// ============================================
// TOAST
// ============================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// UTILS
// ============================================
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// UPLOAD TO IMGBB
// ============================================
async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Upload gagal');
  }
  
  // ✅ PERBAIKAN: gunakan URL utama sebagai thumbnail
  return {
    url: data.data.url,
    display_url: data.data.display_url || data.data.url,
    thumb: data.data.url,  // ← ini yang diubah (sebelumnya data.data.thumb?.url)
    delete_url: data.data.delete_url,
    size: data.data.size,
  };
}

// ============================================
// DROPZONE
// ============================================
['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (files.length) handleFiles(files);
  else showToast('Hanya file gambar yang didukung', 'error');
});

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const files = [...e.target.files];
  if (files.length) handleFiles(files);
  fileInput.value = '';
});

// ============================================
// HANDLE FILES
// ============================================
async function handleFiles(files) {
  if (IMGBB_API_KEY === 'ISI_API_KEY_IMGBB_KAMU_DI_SINI') {
    showToast('API key ImgBB belum diisi di script.js', 'error');
    return;
  }

  for (const file of files) {
    if (file.size > 32 * 1024 * 1024) {
      showToast(`${file.name} terlalu besar (maks 32 MB)`, 'error');
      continue;
    }
    await uploadFile(file);
  }
}

async function uploadFile(file) {
  // Buat queue item
  const item = document.createElement('div');
  item.className = 'queue-item';
  const previewUrl = URL.createObjectURL(file);
   setTimeout(() => {
  item.style.animation = 'slideIn 0.3s ease reverse';
  setTimeout(() => {
    item.remove();
    URL.revokeObjectURL(previewUrl);  // ← tambahkan ini
  }, 300);
}, 2000);
  item.innerHTML = `
    <img class="queue-thumb" src="${previewUrl}" alt="" />
    <div class="queue-info">
      <div class="queue-name">${escapeHtml(file.name)}</div>
      <div class="queue-meta">${formatSize(file.size)}</div>
      <div class="queue-progress"><div class="queue-progress-bar"></div></div>
    </div>
    <div class="queue-status loading">Upload...</div>
  `;
  queueEl.appendChild(item);

  const bar = item.querySelector('.queue-progress-bar');
  const status = item.querySelector('.queue-status');

  // Fake progress
  let prog = 0;
  const interval = setInterval(() => {
    prog = Math.min(prog + Math.random() * 20, 90);
    bar.style.width = prog + '%';
  }, 200);

  try {
    const result = await uploadToImgBB(file);
    clearInterval(interval);
    bar.style.width = '100%';
    status.textContent = '✓ Selesai';
    status.className = 'queue-status success';

    // Simpan ke history
    const record = {
      id: Date.now() + Math.random().toString(36).slice(2, 8),
      name: file.name,
      size: file.size,
      url: result.url,
      thumb: result.thumb,
      deleteUrl: result.delete_url,
      uploadedAt: new Date().toISOString(),
    };
    saveHistory(record);
    renderResults();

    showToast(`${file.name} berhasil diupload!`, 'success');

    // Hapus queue item setelah 2 detik
    setTimeout(() => {
      item.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => item.remove(), 300);
    }, 2000);
  } catch (err) {
    clearInterval(interval);
    bar.style.width = '100%';
    bar.style.background = 'var(--danger)';
    status.textContent = '✕ Gagal';
    status.className = 'queue-status error';
    showToast(`Gagal upload ${file.name}: ${err.message}`, 'error');
    console.error(err);
  }
}

// ============================================
// HISTORY (localStorage)
// ============================================
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory(record) {
  const history = getHistory();
  history.unshift(record);
  // Batasi 100 item
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
}

function deleteRecord(id) {
  const history = getHistory().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderResults();
  showToast('Link dihapus dari riwayat', 'info');
}

function clearAllHistory() {
  if (!confirm('Hapus semua riwayat link? File di ImgBB tetap ada.')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderResults();
  showToast('Semua riwayat dihapus', 'info');
}

// ============================================
// RENDER RESULTS
// ============================================
function renderResults() {
  const history = getHistory();
  resultsGrid.innerHTML = '';

  if (history.length === 0) {
    resultsGrid.appendChild(emptyState);
    return;
  }

  history.forEach(record => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
       <div class="result-preview">
       <img src="${record.thumb}" 
         alt="${escapeHtml(record.name)}" 
         loading="lazy"
         onerror="this.onerror=null; this.src='${record.url}';" />
       <span class="result-badge">IMG</span>
     </div>
  <div class="result-body">
        <div class="result-name" title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</div>
        <div class="result-size">${formatSize(record.size)}</div>
        <div class="result-link">
          <input type="text" value="${escapeHtml(record.url)}" readonly />
        </div>
        <div class="result-actions">
          <button class="action-btn copy-btn" data-url="${escapeHtml(record.url)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
          <button class="action-btn qr-btn" data-url="${escapeHtml(record.url)}" data-name="${escapeHtml(record.name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
            QR
          </button>
          <button class="action-btn danger delete-btn" data-id="${record.id}" title="Hapus dari riwayat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    resultsGrid.appendChild(card);
  });

  // Attach events
  resultsGrid.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyLink(btn.dataset.url));
  });
  resultsGrid.querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => openQr(btn.dataset.url, btn.dataset.name));
  });
  resultsGrid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteRecord(btn.dataset.id));
  });
}

// ============================================
// COPY LINK
// ============================================
async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link berhasil dicopy!', 'success');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Link berhasil dicopy!', 'success');
  }
}

// ============================================
// QR CODE
// ============================================
async function openQr(url, name) {
  try {
    qrFilename.textContent = name;
    await QRCode.toCanvas(qrCanvas, url, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    currentQrDataUrl = qrCanvas.toDataURL('image/png');
    qrModal.classList.add('active');
  } catch (err) {
    showToast('Gagal membuat QR code', 'error');
    console.error(err);
  }
}

qrModal.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => qrModal.classList.remove('active'));
});

downloadQrBtn.addEventListener('click', () => {
  if (!currentQrDataUrl) return;
  const a = document.createElement('a');
  a.href = currentQrDataUrl;
  a.download = `qrcode-${Date.now()}.png`;
  a.click();
  showToast('QR code didownload', 'success');
});

// ============================================
// CLEAR ALL
// ============================================
clearAllBtn.addEventListener('click', clearAllHistory);

// ============================================
// INIT
// ============================================
initTheme();
renderResults();

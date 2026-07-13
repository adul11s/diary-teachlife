/**
 * Code.gs — Backend "Diary Pembelajaran" (Google Drive integration)
 * ------------------------------------------------------------
 * Deploy sebagai Web App (Google Apps Script):
 *   1. Buat Google Spreadsheet baru
 *   2. Buat folder di Google Drive untuk menyimpan foto
 *   3. Extensions → Apps Script → tempel kode ini → Save
 *   4. Jalankan fungsi setup() SEKALI dari editor
 *   5. Deploy → New deployment → Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   6. Salin Web App URL → taruh di .env.local (VITE_API_URL)
 *
 * Skema sheet "Diary":
 *   ID | Date | Photo1_URL | Photo2_URL | Photo3_URL | Caption | Status | CreatedAt | UpdatedAt
 *
 * Catatan:
 *   - Foto dikirim sebagai Base64 (data URI) → disimpan ke Google Drive
 *   - File Drive di-set "Anyone with link can view" agar bisa di-render <img>
 * ------------------------------------------------------------
 */

/** ====== KONFIGURASI ====== */
const ADMIN_USERNAME = 'guru';
const ADMIN_PASSWORD = 'gantiPassword123'; // ganti sesuai kebutuhan
const SHEET_NAME = 'Diary';
const SESSION_SHEET = 'Session';

/**
 * ID folder Google Drive tempat penyimpanan foto.
 * Cara dapat ID: buka folder di Drive → lihat URL → https://drive.google.com/drive/folders/ID_INI
 */
const DRIVE_FOLDER_ID = 'MASUKKAN_FOLDER_ID_ANDA_DISINI';

const HEADERS = [
  'ID', 'Date', 'Photo1_URL', 'Photo2_URL', 'Photo3_URL',
  'Caption', 'Status', 'CreatedAt', 'UpdatedAt',
];

/**
 * ====== SETUP (jalankan SEKALI dari editor) ======
 * Membuat sheet & folder jika belum ada.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let diary = ss.getSheetByName(SHEET_NAME);
  if (!diary) diary = ss.insertSheet(SHEET_NAME);
  if (diary.getLastRow() === 0) diary.appendRow(HEADERS);

  let session = ss.getSheetByName(SESSION_SHEET);
  if (!session) session = ss.insertSheet(SESSION_SHEET);
  if (session.getLastRow() === 0) session.appendRow(['Token', 'CreatedAt', 'ExpiresAt']);

  // Pastikan folder Drive ada
  try {
    DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'FOLDER_ID tidak valid. Buat folder dulu di Google Drive, lalu salin ID-nya ke DRIVE_FOLDER_ID.',
    );
    return;
  }

  SpreadsheetApp.getUi().alert(
    'Setup selesai! Sheet "Diary", "Session", dan folder Drive siap digunakan.',
  );
}

/** ====== ENTRY POINT ====== */
function doGet(e) { return handleRequest(e, 'GET'); }
function doPost(e) { return handleRequest(e, 'POST'); }

function handleRequest(e, method) {
  let payload = {};
  try {
    if (method === 'POST' && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (method === 'GET' && e.parameter) {
      payload = e.parameter;
    }
  } catch (err) {
    return jsonOut({ success: false, message: 'Invalid JSON body' });
  }

  const action = payload.action || '';
  let result;

  switch (action) {
    case 'publicList':
      result = getPublishedDiaries();
      break;

    case 'login':
      result = login(payload);
      break;
    case 'logout':
      result = logout(payload);
      break;

    case 'uploadPhoto':
      result = requireAuth(payload, () => uploadPhoto(payload));
      break;
    case 'deletePhoto':
      result = requireAuth(payload, () => deletePhoto(payload));
      break;

    case 'adminList':
      result = requireAuth(payload, getAdminDiaries);
      break;
    case 'getById':
      result = requireAuth(payload, () => getDiaryById(payload.id));
      break;
    case 'create':
      result = requireAuth(payload, () => createDiary(payload));
      break;
    case 'update':
      result = requireAuth(payload, () => updateDiary(payload));
      break;
    case 'setStatus':
      result = requireAuth(payload, () => setStatus(payload));
      break;
    case 'delete':
      result = requireAuth(payload, () => deleteDiary(payload.id));
      break;

    default:
      result = { success: false, message: 'Unknown action: ' + action };
  }

  return jsonOut(result);
}

/** ====== RESPONSE ====== */
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** ====== SHEET HELPERS ====== */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function getSessionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SESSION_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SESSION_SHEET);
    sheet.appendRow(['Token', 'CreatedAt', 'ExpiresAt']);
  }
  return sheet;
}

function requireAuth(payload, fn) {
  const token = payload.token;
  if (!token || !isValidToken(token)) {
    return { success: false, message: 'Unauthorized', code: 401 };
  }
  return fn();
}

function isValidToken(token) {
  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date().getTime();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      const expires = new Date(data[i][2]).getTime();
      return expires > now;
    }
  }
  return false;
}

function removeToken(token) {
  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === token) sheet.deleteRow(i + 1);
  }
}

/** ====== AUTH ====== */
function login(payload) {
  const { username, password } = payload;
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return { success: false, message: 'Username atau password salah' };
  }
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  getSessionSheet().appendRow([token, now, expires]);
  return { success: true, token, expiresAt: expires.toISOString() };
}

function logout(payload) {
  if (payload.token) removeToken(payload.token);
  return { success: true };
}

/** ====== PHOTO UPLOAD / DELETE (Google Drive) ====== */

/**
 * uploadPhoto: menerima Base64 → simpan ke Drive → return URL publik
 * Payload: { filename, data: "data:image/jpeg;base64,..." }
 */
function uploadPhoto(payload) {
  const { filename = 'photo.jpg', data } = payload;

  if (!data || typeof data !== 'string' || data.indexOf(';base64,') === -1) {
    return { success: false, message: 'Data foto (Base64) tidak valid.' };
  }

  // Ekstrak tipe MIME dan Base64
  const parts = data.split(';base64,');
  const mimeType = parts[0].replace('data:', '');
  const raw = parts[1];

  if (!raw) {
    return { success: false, message: 'Base64 payload kosong.' };
  }

  try {
    const decoded = Utilities.base64Decode(raw);
    const blob = Utilities.newBlob(decoded, mimeType, filename);

    // Simpan ke folder Drive
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const file = folder.createFile(blob);

    // Set akses publik (Anyone with link can view)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // URL yang bisa di-render di <img>
    const fileId = file.getId();
    const url = 'https://drive.google.com/uc?export=view&id=' + fileId;

    return { success: true, url, fileId, name: file.getName() };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan foto ke Drive: ' + err.message };
  }
}

/**
 * deletePhoto: hapus file dari Drive (trash)
 * Payload: { fileId }
 */
function deletePhoto(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, message: 'fileId diperlukan.' };
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, message: 'Gagal menghapus foto: ' + err.message };
  }
}

/** Ambil fileId dari URL Drive */
function extractFileId(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
}

/** ====== CRUD DIARY ====== */

/**
 * Konversi baris sheet ke objek.
 * Kolom: 0=ID, 1=Date, 2=Photo1_URL, 3=Photo2_URL, 4=Photo3_URL,
 *        5=Caption, 6=Status, 7=CreatedAt, 8=UpdatedAt
 */
function rowToObj(row) {
  return {
    id: row[0],
    date: row[1],
    photo1Url: row[2],
    photo2Url: row[3],
    photo3Url: row[4],
    caption: row[5],
    status: row[6],
    createdAt: row[7] ? new Date(row[7]).toISOString() : null,
    updatedAt: row[8] ? new Date(row[8]).toISOString() : null,
  };
}

function getPublishedDiaries() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const obj = rowToObj(data[i]);
    if (obj.status === 'Published') result.push(obj);
  }
  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { success: true, data: result };
}

function getAdminDiaries() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    result.push(rowToObj(data[i]));
  }
  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { success: true, data: result };
}

function getDiaryById(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return { success: true, data: rowToObj(data[i]) };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

function createDiary(payload) {
  const sheet = getSheet();
  const {
    date,
    photo1Url = '',
    photo2Url = '',
    photo3Url = '',
    caption = '',
    status = 'Draft',
  } = payload;

  if (!date) return { success: false, message: 'Tanggal wajib diisi' };

  // Validasi maksimal 3 foto per hari
  const existing = countPhotosByDate(sheet, date);
  const incoming = [photo1Url, photo2Url, photo3Url].filter(Boolean).length;
  if (existing + incoming > 3) {
    return {
      success: false,
      message: 'Maksimal 3 foto per hari. Anda sudah mengunggah ' + existing + ' foto pada ' + date,
    };
  }

  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  sheet.appendRow([id, date, photo1Url, photo2Url, photo3Url, caption, status, now, now]);
  return {
    success: true,
    data: { id, date, photo1Url, photo2Url, photo3Url, caption, status },
  };
}

function updateDiary(payload) {
  const sheet = getSheet();
  const { id, date, photo1Url, photo2Url, photo3Url, caption, status } = payload;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      const row = i + 1;

      // Hapus foto lama dari Drive jika diganti dengan yang baru
      if (photo1Url !== undefined) {
        const oldFileId = extractFileId(data[i][2]);
        if (oldFileId) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) { /* skip */ }
        sheet.getRange(row, 3).setValue(photo1Url);
      }
      if (photo2Url !== undefined) {
        const oldFileId = extractFileId(data[i][3]);
        if (oldFileId) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) { /* skip */ }
        sheet.getRange(row, 4).setValue(photo2Url);
      }
      if (photo3Url !== undefined) {
        const oldFileId = extractFileId(data[i][4]);
        if (oldFileId) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) { /* skip */ }
        sheet.getRange(row, 5).setValue(photo3Url);
      }

      if (date !== undefined) sheet.getRange(row, 2).setValue(date);
      if (caption !== undefined) sheet.getRange(row, 6).setValue(caption);
      if (status !== undefined) sheet.getRange(row, 7).setValue(status);
      sheet.getRange(row, 9).setValue(new Date().toISOString());
      return { success: true, data: rowToObj(sheet.getRange(row, 1, 1, 9).getValues()[0]) };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

function setStatus(payload) {
  const sheet = getSheet();
  const { id, status } = payload;
  if (!['Draft', 'Published'].includes(status)) {
    return { success: false, message: 'Status tidak valid' };
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 7).setValue(status);
      sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
      return { success: true, data: { id, status } };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

function deleteDiary(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      // Hapus semua foto terkait dari Drive
      for (let col = 3; col <= 5; col++) {
        const url = data[i][col - 1];
        const fileId = extractFileId(url);
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* skip */ }
        }
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

/** Hitung total foto non-kosong pada tanggal tertentu */
function countPhotosByDate(sheet, date) {
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(date)) {
      if (data[i][2]) count++;
      if (data[i][3]) count++;
      if (data[i][4]) count++;
    }
  }
  return count;
}

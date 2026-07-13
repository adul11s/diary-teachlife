/**
 * Code.gs — Backend "Diary Pembelajaran" (Drive-backed, proxy-served photos)
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
 *   ID | Date | Photo1_ID | Photo2_ID | Photo3_ID | Caption | Status | CreatedAt | UpdatedAt
 *
 * Foto disimpan di Google Drive dan disajikan via endpoint servePhoto
 * (data URI base64). Tidak perlu set akses publik pada file Drive.
 * ------------------------------------------------------------
 */

/** ====== KONFIGURASI ====== */
const ADMIN_USERNAME = 'guru';
const ADMIN_PASSWORD = 'gantiPassword123';
const SHEET_NAME = 'Diary';
const SESSION_SHEET = 'Session';
const DRIVE_FOLDER_ID = '1dtAznKqNK-f5DncLjvk18dnALkIGr_-G';

const HEADERS = [
  'ID', 'Date', 'Photo1_ID', 'Photo2_ID', 'Photo3_ID',
  'Caption', 'Status', 'CreatedAt', 'UpdatedAt',
];

/** ====== SETUP ====== */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let diary = ss.getSheetByName(SHEET_NAME);
  if (!diary) diary = ss.insertSheet(SHEET_NAME);
  if (diary.getLastRow() === 0) diary.appendRow(HEADERS);
  let session = ss.getSheetByName(SESSION_SHEET);
  if (!session) session = ss.insertSheet(SESSION_SHEET);
  if (session.getLastRow() === 0) session.appendRow(['Token', 'CreatedAt', 'ExpiresAt']);
  try { DriveApp.getFolderById(DRIVE_FOLDER_ID); } catch (e) {
    SpreadsheetApp.getUi().alert('FOLDER_ID tidak valid.');
    return;
  }
  SpreadsheetApp.getUi().alert('Setup selesai!');
}

/** ====== ENTRY POINT ====== */
function doGet(e) {
  if (e.parameter.img) {
    return serveImageDirect(e.parameter.img);
  }
  return handleRequest(e, 'GET');
}
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
    case 'publicList': result = getPublishedDiaries(); break;
    case 'login': result = login(payload); break;
    case 'logout': result = logout(payload); break;
    case 'uploadPhoto': result = requireAuth(payload, () => uploadPhoto(payload)); break;
    case 'servePhoto': result = servePhoto(payload); break;
    case 'deletePhoto': result = requireAuth(payload, () => deletePhoto(payload)); break;
    case 'adminList': result = requireAuth(payload, getAdminDiaries); break;
    case 'getById': result = requireAuth(payload, () => getDiaryById(payload.id)); break;
    case 'create': result = requireAuth(payload, () => createDiary(payload)); break;
    case 'update': result = requireAuth(payload, () => updateDiary(payload)); break;
    case 'setStatus': result = requireAuth(payload, () => setStatus(payload)); break;
    case 'delete': result = requireAuth(payload, () => deleteDiary(payload.id)); break;
    default: result = { success: false, message: 'Unknown action: ' + action };
  }
  return jsonOut(result);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** ====== SHEET HELPERS ====== */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); sheet.appendRow(HEADERS); }
  return sheet;
}
function getSessionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SESSION_SHEET);
  if (!sheet) { sheet = ss.insertSheet(SESSION_SHEET); sheet.appendRow(['Token', 'CreatedAt', 'ExpiresAt']); }
  return sheet;
}
function requireAuth(payload, fn) {
  const token = payload.token;
  if (!token || !isValidToken(token)) return { success: false, message: 'Unauthorized', code: 401 };
  return fn();
}
function isValidToken(token) {
  const sheet = getSessionSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date().getTime();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) return new Date(data[i][2]).getTime() > now;
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
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD)
    return { success: false, message: 'Username atau password salah' };
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

/** ====== PHOTO UPLOAD / SERVE / DELETE ====== */

/** Upload foto → simpan ke Drive → return fileId */
function uploadPhoto(payload) {
  const { filename = 'photo.jpg', data } = payload;
  if (!data || typeof data !== 'string' || data.indexOf(';base64,') === -1)
    return { success: false, message: 'Data foto tidak valid.' };
  const parts = data.split(';base64,');
  const mimeType = parts[0].replace('data:', '');
  const raw = parts[1];
  if (!raw) return { success: false, message: 'Base64 payload kosong.' };
  try {
    const bytes = Utilities.base64Decode(raw);
    const blob = Utilities.newBlob(bytes, mimeType, filename);
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const file = folder.createFile(blob);
    const fileId = file.getId();
    // Tidak perlu setSharing — foto disajikan via servePhoto endpoint
    return { success: true, fileId, name: file.getName() };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan foto ke Drive: ' + err.message };
  }
}

/** Serve foto sebagai data URI base64 (bisa diakses publik & admin) */
function servePhoto(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, message: 'fileId diperlukan.' };
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const b64 = Utilities.base64Encode(blob.getBytes());
    const dataUri = 'data:' + blob.getContentType() + ';base64,' + b64;
    return { success: true, dataUri };
  } catch (err) {
    return { success: false, message: 'Gagal membaca foto: ' + err.message };
  }
}

/** Serve foto langsung via GET (untuk <img src>) — opsional */
function serveImageDirect(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const b64 = Utilities.base64Encode(blob.getBytes());
    const html = '<img src="data:' + blob.getContentType() + ';base64,' + b64 + '" style="max-width:100%">';
    return HtmlService.createHtmlOutput(html).setTitle('Foto');
  } catch (e) {
    return HtmlService.createHtmlOutput('Foto tidak ditemukan').setTitle('Error');
  }
}

/** Hapus foto dari Drive */
function deletePhoto(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, message: 'fileId diperlukan.' };
  try { DriveApp.getFileById(fileId).setTrashed(true); return { success: true }; }
  catch (err) { return { success: false, message: 'Gagal menghapus foto: ' + err.message }; }
}

/** Ambil fileId dari URL (mendukung format lama & baru) */
function extractFileId(url) {
  if (!url) return null;
  const m = url.match(/[?&]id=([^&]+)/);
  return m ? m[1] : (url.indexOf('/') === -1 ? url : null);
}

/** ====== CRUD DIARY ====== */

/** Kolom: 0=ID, 1=Date, 2=Photo1_ID, 3=Photo2_ID, 4=Photo3_ID, 5=Caption, 6=Status, 7=CreatedAt, 8=UpdatedAt */
function rowToObj(row) {
  return {
    id: row[0], date: row[1],
    photo1Id: row[2], photo2Id: row[3], photo3Id: row[4],
    caption: row[5], status: row[6],
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
  for (let i = 1; i < data.length; i++) result.push(rowToObj(data[i]));
  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { success: true, data: result };
}

function getDiaryById(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return { success: true, data: rowToObj(data[i]) };
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

function createDiary(payload) {
  const sheet = getSheet();
  const { date, photo1Id = '', photo2Id = '', photo3Id = '', caption = '', status = 'Draft' } = payload;
  if (!date) return { success: false, message: 'Tanggal wajib diisi' };
  const existing = countPhotosByDate(sheet, date);
  const incoming = [photo1Id, photo2Id, photo3Id].filter(Boolean).length;
  if (existing + incoming > 3)
    return { success: false, message: 'Maksimal 3 foto per hari.' };
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  sheet.appendRow([id, date, photo1Id, photo2Id, photo3Id, caption, status, now, now]);
  return { success: true, data: { id, date, photo1Id, photo2Id, photo3Id, caption, status } };
}

function updateDiary(payload) {
  const sheet = getSheet();
  const { id, date, photo1Id, photo2Id, photo3Id, caption, status } = payload;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      const r = i + 1;
      if (photo1Id !== undefined) {
        const oldFileId = extractFileId(data[i][2]);
        if (oldFileId) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {}
        sheet.getRange(r, 3).setValue(photo1Id);
      }
      if (photo2Id !== undefined) {
        const oldFileId = extractFileId(data[i][3]);
        if (oldFileId) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {}
        sheet.getRange(r, 4).setValue(photo2Id);
      }
      if (photo3Id !== undefined) {
        const oldFileId = extractFileId(data[i][4]);
        if (oldFileId) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {}
        sheet.getRange(r, 5).setValue(photo3Id);
      }
      if (date !== undefined) sheet.getRange(r, 2).setValue(date);
      if (caption !== undefined) sheet.getRange(r, 6).setValue(caption);
      if (status !== undefined) sheet.getRange(r, 7).setValue(status);
      sheet.getRange(r, 9).setValue(new Date().toISOString());
      return { success: true, data: rowToObj(sheet.getRange(r, 1, 1, 9).getValues()[0]) };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

function setStatus(payload) {
  const sheet = getSheet();
  const { id, status } = payload;
  if (!['Draft', 'Published'].includes(status)) return { success: false, message: 'Status tidak valid' };
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
      for (let col = 3; col <= 5; col++) {
        const fid = extractFileId(data[i][col - 1]);
        if (fid) try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {}
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

function countPhotosByDate(sheet, date) {
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(date)) {
      if (data[i][2]) count++; if (data[i][3]) count++; if (data[i][4]) count++;
    }
  }
  return count;
}

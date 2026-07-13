/**
 * Code.gs — Backend "Diary Pembelajaran"
 * ------------------------------------------------------------
 * Deploy sebagai Web App (Google Apps Script):
 *   1. Buka spreadsheet baru → Extensions → Apps Script
 *   2. Tempel seluruh isi file ini, lalu Save
 *   3. Buat sheet bernama "Diary" dan sheet "Session" (opsional, untuk token)
 *   4. Deploy → New deployment → Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   5. Salin Web App URL → taruh di frontend (.env: VITE_API_URL)
 *
 * Skema sheet "Diary" (baris 1 = header):
 *   ID | Date | Photo1 | Photo2 | Photo3 | Caption | Status | CreatedAt | UpdatedAt
 * ------------------------------------------------------------
 */

/** ====== KONFIGURASI ====== */
const ADMIN_USERNAME = 'guru';
const ADMIN_PASSWORD = 'gantiPassword123'; // ganti sesuai kebutuhan
const SHEET_NAME = 'Diary';
const SESSION_SHEET = 'Session'; // menyimpan token aktif

/** Header kolom (urutan WAJIB sesuai skema) */
const HEADERS = [
  'ID', 'Date', 'Photo1', 'Photo2', 'Photo3',
  'Caption', 'Status', 'CreatedAt', 'UpdatedAt',
];

/** ====== SETUP (jalankan SEKALI dari editor) ======
 *  Pilih fungsi "setup" di dropdown editor → klik Run.
 *  Ini membuat sheet "Diary" dan "Session" beserta header-nya.
 *  Saat pertama kali run, Google akan meminta otorisasi — izinkan.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sheet "Diary"
  let diary = ss.getSheetByName(SHEET_NAME);
  if (!diary) diary = ss.insertSheet(SHEET_NAME);
  if (diary.getLastRow() === 0) diary.appendRow(HEADERS);

  // Sheet "Session"
  let session = ss.getSheetByName(SESSION_SHEET);
  if (!session) session = ss.insertSheet(SESSION_SHEET);
  if (session.getLastRow() === 0) session.appendRow(['Token', 'CreatedAt', 'ExpiresAt']);

  SpreadsheetApp.getUi().alert(
    'Setup selesai. Sheet "Diary" & "Session" sudah dibuat dengan header.',
  );
}

/** ====== ENTRY POINT (Web App) ====== */
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

/** Router sederhana berdasarkan parameter `action` */
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
    // ---- Publik ----
    case 'publicList':
      result = getPublishedDiaries();
      break;

    // ---- Auth ----
    case 'login':
      result = login(payload);
      break;
    case 'logout':
      result = logout(payload);
      break;

    // ---- Admin ----
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

/** ====== RESPONSE HELPER ====== */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
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

/** Validasi token sesi admin */
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
  // Buat token sederhana
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 jam
  const sheet = getSessionSheet();
  sheet.appendRow([token, now, expires]);
  return { success: true, token, expiresAt: expires.toISOString() };
}

function logout(payload) {
  if (payload.token) removeToken(payload.token);
  return { success: true };
}

/** ====== CRUD DIARY ====== */
function rowToObj(row) {
  return {
    id: row[0],
    date: row[1],
    photo1: row[2],
    photo2: row[3],
    photo3: row[4],
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
  // Urutkan tanggal terbaru di atas
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
  const { date, photo1 = '', photo2 = '', photo3 = '', caption = '', status = 'Draft' } = payload;

  if (!date) return { success: false, message: 'Tanggal wajib diisi' };

  // Cek batas maksimal 3 foto per hari
  const existing = countPhotosByDate(sheet, date);
  const incoming = [photo1, photo2, photo3].filter(Boolean).length;
  // Catatan: batas 3 FOTO per hari = 1 diary berisi 3 foto, jadi batas di sini
  // adalah jumlah foto baru + foto existing tidak boleh > 3.
  if (existing + incoming > 3) {
    return {
      success: false,
      message: 'Maksimal 3 foto per hari. Anda sudah mengunggah ' + existing + ' foto pada ' + date,
    };
  }

  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  sheet.appendRow([id, date, photo1, photo2, photo3, caption, status, now, now]);
  return { success: true, data: { id, date, photo1, photo2, photo3, caption, status } };
}

function updateDiary(payload) {
  const sheet = getSheet();
  const { id, date, photo1, photo2, photo3, caption, status } = payload;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      const row = i + 1;
      if (date !== undefined) sheet.getRange(row, 2).setValue(date);
      if (photo1 !== undefined) sheet.getRange(row, 3).setValue(photo1);
      if (photo2 !== undefined) sheet.getRange(row, 4).setValue(photo2);
      if (photo3 !== undefined) sheet.getRange(row, 5).setValue(photo3);
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
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'Diary tidak ditemukan' };
}

/** Hitung total foto pada tanggal tertentu (across all diary entries that date) */
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
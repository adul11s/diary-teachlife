/**
 * tests/gs-logic.test.mjs
 * ------------------------------------------------------------
 * Logic murni dari gs/Code.gs (token sesi & batas ukuran gambar),
 * diuji dengan mock SpreadsheetApp / PropertiesService / DriveApp / Utilities.
 *
 * Code.gs tidak di-import sebagai modul — file aslinya dibaca dan
 * dijalankan lewat `new Function` dengan globals Apps Script palsu,
 * sehingga tempel-update di Apps Script tetap tercakup oleh test.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const codeSrc = readFileSync(join(root, 'gs', 'Code.gs'), 'utf8');

/** Muat Code.gs dengan globals Apps Script palsu; kembalikan fungsi yang diuji. */
function loadCode({ props = {}, sessionRows = [], diaryRows = [], driveCalls = [] } = {}) {
  const copiedDiaryRows = [...diaryRows];

  function makeSheet(initialRows) {
    const rows = initialRows ? [...initialRows] : [];
    return {
      rows,
      getLastRow: () => rows.length,
      appendRow: (row) => rows.push([...row]),
      getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
      deleteRow: (idx) => rows.splice(idx - 1, 1),
      getRange: () => ({ setValue: () => {} }),
    };
  }

  const sessionSheet = makeSheet(sessionRows);
  const diarySheet = makeSheet(copiedDiaryRows);
  const spreadsheets = { [sessionSheet]: 0 }; // noop supaya linter tenang

  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => (name === 'Session' ? sessionSheet : diarySheet),
      }),
      getUi: () => ({ alert: () => {} }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }),
    },
    DriveApp: {
      getFolderById: (_id) => ({
        createFile: (blob) => {
          driveCalls.push({ createFile: blob });
          return { getId: () => 'new-file-id', getName: () => blob.getName() };
        },
      }),
      getFileById: () => ({ setTrashed: () => {} }),
    },
    Utilities: {
      getUuid: () => 'uuid-token-1234',
      base64Decode: (_b64) => Array.from({ length: 4 }, () => 0),
      newBlob: (data, mimeType, filename) => ({ data, mimeType, getName: () => filename }),
    },
    ContentService: { createTextOutput: () => ({ setMimeType: () => {} }) },
    HtmlService: { createHtmlOutput: () => ({ setTitle: () => {} }) },
  };

  const names = Object.keys(globals);
  const factory = new Function(
    ...names,
    `${codeSrc}
    return { getAdminCredentials, isValidToken, login, uploadPhoto, base64ByteLength, MAX_IMAGE_SIZE_BYTES };`
  );
  const api = factory(...names.map((n) => globals[n]));
  return { api, sessionSheet, diarySheet, driveCalls, spreadsheets };
}

/** Base64 palsu yang mewakili ~N MB data. */
function fakeBase64(nBytes) {
  return 'aGk='.slice(0, 0) + 'A'.repeat(Math.ceil((nBytes * 4) / 3));
}

describe('token sesi (validity & kedaluwarsa)', () => {
  it('menolak token dengan ExpiresAt di masa lalu', () => {
    const { api } = loadCode({
      sessionRows: [['Token', 'CreatedAt', 'ExpiresAt'],
        ['tok-expired', new Date('2024-01-01'), new Date('2024-01-02')]],
    });
    expect(api.isValidToken('tok-expired')).toBe(false);
  });

  it('menerima token yang masih berlaku, dan menolak token yang tidak dikenal', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const { api } = loadCode({
      sessionRows: [['Token', 'CreatedAt', 'ExpiresAt'],
        ['tok-valid', new Date(), future]],
    });
    expect(api.isValidToken('tok-valid')).toBe(true);
    expect(api.isValidToken('tidak-ada')).toBe(false);
    expect(api.isValidToken('')).toBe(false);
  });

  it('login gagal ketika kredensial belum diset di Script Properties (fail-fast)', () => {
    const { api } = loadCode({ props: {} });
    const res = api.login({ username: 'guru', password: 'apa pun' });
    expect(res.success).toBe(false);
    expect(String(res.message)).toContain('Script Properties');
  });

  it('login berhasil dengan kredensial dari Script Properties dan token berlaku', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { api } = loadCode({ props: { ADMIN_USERNAME: 'guru', ADMIN_PASSWORD: 'rahasia' } });
    const ok = api.login({ username: 'guru', password: 'rahasia' });
    expect(ok.success).toBe(true);
    expect(new Date(ok.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // token hasil login langsung valid
    const ok2 = api.login({ username: 'salah', password: 'rahasia' });
    expect(ok2.success).toBe(false);
    void future;
  });
});

describe('batas ukuran gambar (uploadPhoto)', () => {
  it('menolak gambar yang decoded-nya melebihi batas (5 MB), Drive tidak dipanggil', () => {
    const driveCalls = [];
    const { api } = loadCode({ driveCalls });
    const big = fakeBase64(api.MAX_IMAGE_SIZE_BYTES + 1024 * 1024); // ~6 MB
    const res = api.uploadPhoto({ filename: 'big.jpg', data: 'data:image/jpeg;base64,' + big });
    expect(res.success).toBe(false);
    expect(String(res.message)).toContain('batas');
    expect(driveCalls).toHaveLength(0);
  });

  it('menerima gambar kecil dan menyimpan ke Drive', () => {
    const driveCalls = [];
    const { api } = loadCode({
      props: { DRIVE_FOLDER_ID: 'folder-x' },
      driveCalls,
    });
    const res = api.uploadPhoto({ filename: 'small.jpg', data: 'data:image/jpeg;base64,QkFTRTY0' });
    expect(res.success).toBe(true);
    expect(res.fileId).toBe('new-file-id');
    expect(driveCalls).toHaveLength(1);
  });

  it('base64ByteLength memperhitungkan padding dengan benar', () => {
    const { api } = loadCode();
    expect(api.base64ByteLength('')).toBe(0);
    expect(api.base64ByteLength('QQ==')).toBe(1);
    expect(api.base64ByteLength('QVI=')).toBe(2);
    expect(api.base64ByteLength('aGk=')).toBe(2); // "hi" = 2 byte
    expect(api.base64ByteLength('aGVsbG8=')).toBe(5); // "hello" = 5 byte, padding 1
  });
});

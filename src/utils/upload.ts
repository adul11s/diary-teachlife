/**
 * utils/upload.ts
 * ------------------------------------------------------------
 * Upload foto ke Apps Script yang akan menyimpannya ke Google Drive
 * dan mengembalikan URL publik. Memuat progress state (loading, error).
 *
 * Alur:
 *   1. pilih file → kompres → base64
 *   2. kirim { action: 'uploadPhoto', filename, data } ke Apps Script
 *   3. Apps Script decode → save ke Drive → set public → return URL
 *   4. frontend simpan URL
 */

import type { UploadPhotoResult } from '../types/diary';
import { API_URL, withToken } from './api';
import { compressImageToBase64 } from './imageCompression';

export interface UploadState {
  status: 'idle' | 'compressing' | 'uploading' | 'done' | 'error';
  url?: string;
  fileId?: string;
  error?: string;
}

export async function uploadPhotoToDrive(
  file: File,
): Promise<UploadPhotoResult> {
  // 1. Kompres
  const { base64, filename } = await compressImageToBase64(file);

  // 2. Kirim ke Apps Script -> Drive
  const body = JSON.stringify({
    action: 'uploadPhoto',
    token: await withToken(), // throws if no token
    filename,
    data: base64,
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });

  const text = await res.text();
  if (!text) throw new Error('Server mengembalikan respons kosong.');

  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.message || 'Gagal upload foto ke Drive.');

  return { url: json.url, fileId: json.fileId, name: json.name };
}

/**
 * Hapus foto dari Drive via Apps Script.
 */
export async function deletePhotoFromDrive(fileId: string): Promise<void> {
  const body = JSON.stringify({
    action: 'deletePhoto',
    token: await withToken(),
    fileId,
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Gagal hapus foto.');
}

/**
 * utils/upload.ts
 * ------------------------------------------------------------
 * Upload foto ke Drive via Apps Script, lalu load data URI untuk ditampilkan.
 */

import type { UploadPhotoResult } from '../types/diary';
import { API_URL, withToken } from './api';
import { compressImageToBase64 } from './imageCompression';

export async function uploadPhotoToDrive(file: File): Promise<UploadPhotoResult> {
  const { base64, filename } = await compressImageToBase64(file);

  const body = JSON.stringify({
    action: 'uploadPhoto',
    token: await withToken(),
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
  if (!text) throw new Error('Server kosong.');
  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.message || 'Gagal upload.');

  return { fileId: json.fileId, name: json.name };
}

export async function deletePhotoFromDrive(fileId: string): Promise<void> {
  const body = JSON.stringify({
    action: 'deletePhoto',
    token: await withToken(),
    fileId,
  });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body, redirect: 'follow',
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Gagal hapus foto.');
}

/**
 * Ambil data URI foto dari Drive via Apps Script.
 * Bisa dipanggil tanpa auth (publik).
 */
export async function fetchPhotoDataUri(fileId: string): Promise<string> {
  const body = JSON.stringify({ action: 'servePhoto', fileId });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body, redirect: 'follow',
  });

  const text = await res.text();
  if (!text) throw new Error('Server kosong.');
  const json = JSON.parse(text);
  if (!json.success) throw new Error(json.message || 'Gagal load foto.');
  return json.dataUri as string;
}

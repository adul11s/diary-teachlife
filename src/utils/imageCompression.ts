/**
 * utils/imageCompression.ts
 * ------------------------------------------------------------
 * Kompresi gambar di frontend sebelum dikirim ke backend.
 * Alasan: Google Sheets memiliki batas ~50.000 karakter per sel,
 * jadi foto asli (ber-megabyte) tidak boleh dikirim mentah.
 *
 * Strategi:
 *  1. Resize dimensi ke maksimal `maxWidthOrHeight` px (default 800px)
 *     menggunakan browser-image-compression (berbasis Canvas API).
 *  2. Ubah hasil kompresi menjadi string Base64 (data URI).
 *  3. Validasi bahwa hasil Base64 tidak melebihi batas aman per sel.
 */

import imageCompression from 'browser-image-compression';
import { MAX_BASE64_PER_PHOTO } from '../types/diary';

export interface CompressResult {
  base64: string;
  sizeBytes: number;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 800,
  initialQuality: 0.7,
  useWebWorker: true,
};

/** Kompresi file gambar → blob → Base64 (data URI) */
export async function compressImageToBase64(
  file: File,
  options: Partial<typeof DEFAULT_OPTIONS> = {},
): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPEG/PNG/WebP).');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const compressedFile = await imageCompression(file, opts);
  const base64 = await blobToBase64(compressedFile);

  // Cek panjang Base64 (perkiraan bytes ≈ string length)
  if (base64.length > MAX_BASE64_PER_PHOTO) {
    // Coba kompres lebih agresif sekali lagi
    const retryFile = await imageCompression(file, {
      ...opts,
      maxWidthOrHeight: 600,
      initialQuality: 0.5,
    });
    const retryBase64 = await blobToBase64(retryFile);
    if (retryBase64.length > MAX_BASE64_PER_PHOTO) {
      throw new Error(
        'Foto terlalu besar setelah kompresi. Coba foto lain dengan resolusi lebih kecil.',
      );
    }
    return wrapResult(retryBase64, retryFile);
  }

  return wrapResult(base64, compressedFile);
}

function wrapResult(base64: string, file: Blob): CompressResult {
  return {
    base64,
    sizeBytes: file.size,
    width: 0,
    height: 0,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ByteLength(base64: string): number {
  // data URI: "...;base64,XXXX"
  const idx = base64.indexOf(';base64,');
  if (idx === -1) return base64.length;
  const payload = base64.slice(idx + 8);
  return Math.floor((payload.length * 3) / 4);
}
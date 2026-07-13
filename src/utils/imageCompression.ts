/**
 * utils/imageCompression.ts
 * ------------------------------------------------------------
 * Kompresi gambar di frontend sebelum dikirim ke backend.
 * Hasil kompresi diubah ke Base64 (data URI) untuk transport ke Apps Script,
 * yang kemudian menyimpannya ke Google Drive.
 *
 * Resolusi maksimal 1024px agar tidak terlalu kecil untuk tampilan orang tua,
 * tapi tetap cukup ringan untuk dikirim via Apps Script.
 */

import imageCompression from 'browser-image-compression';

export interface CompressResult {
  base64: string;
  sizeBytes: number;
  filename: string;
}

const DEFAULT_OPTIONS = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 1024,
  initialQuality: 0.75,
  useWebWorker: true,
};

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

  return {
    base64,
    sizeBytes: compressedFile.size,
    filename: file.name.replace(/\.[^.]+$/, '.jpg') || 'photo.jpg',
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

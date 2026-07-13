/** Tipe data Diary yang dipakai di seluruh aplikasi */
export interface Diary {
  id: string;
  date: string; // YYYY-MM-DD
  photo1?: string; // Base64 string (bisa juga data URI)
  photo2?: string;
  photo3?: string;
  caption: string;
  status: 'Draft' | 'Published';
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  code?: number;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
}

/** Ukuran file Base64 approx (bytes) */
export const MAX_BASE64_PER_PHOTO = 48_000; // aman di bawah batas ~50.000 per sel
export const MAX_PHOTOS_PER_DAY = 3;
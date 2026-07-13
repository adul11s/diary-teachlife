/** Tipe data Diary yang dipakai di seluruh aplikasi */
export interface Diary {
  id: string;
  date: string; // YYYY-MM-DD
  photo1Url?: string; // Google Drive URL
  photo2Url?: string;
  photo3Url?: string;
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
  token?: string;
  expiresAt?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
}

export interface UploadPhotoResult {
  url: string;
  fileId: string;
  name: string;
}

export const MAX_PHOTOS_PER_DAY = 3;

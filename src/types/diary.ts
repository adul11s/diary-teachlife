export interface Diary {
  id: string;
  date: string;
  photo1Id?: string;
  photo2Id?: string;
  photo3Id?: string;
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
  fileId: string;
  name: string;
}

export const MAX_PHOTOS_PER_DAY = 3;

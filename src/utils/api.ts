/**
 * utils/api.ts
 * ------------------------------------------------------------
 * Client untuk Google Apps Script Web App.
 * Setiap request memakai POST dengan body JSON `{ action, ...payload }`.
 */

import type { ApiResponse, Diary } from '../types/diary';
import { getToken } from './auth';

export const API_URL = import.meta.env.VITE_API_URL as string;
if (!API_URL) console.warn('[api] VITE_API_URL belum diset di .env');

/**
 * Helper: ambil token atau throw.
 * Dipakai oleh upload.ts yang butuh token wajib.
 */
export async function withToken(): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Sesi habis. Silakan login ulang.');
  return token;
}

async function call<T>(
  action: string,
  payload: Record<string, unknown> = {},
  withAuth = false,
): Promise<ApiResponse<T>> {
  const body: Record<string, unknown> = { action, ...payload };
  if (withAuth) {
    const token = getToken();
    if (!token) return { success: false, message: 'Not logged in', code: 401 } as ApiResponse<T>;
    body.token = token;
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
  } catch (err) {
    return {
      success: false,
      message: 'Tidak dapat terhubung ke server: ' + (err as Error).message,
    } as ApiResponse<T>;
  }

  if (!res.ok) {
    return {
      success: false,
      message: `Server merespons ${res.status} ${res.statusText}`,
    } as ApiResponse<T>;
  }

  const text = await res.text();
  if (!text) {
    return {
      success: false,
      message: 'Server mengembalikan respons kosong. Pastikan Web App sudah dideploy ulang.',
    } as ApiResponse<T>;
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      message: 'Respons server bukan JSON valid: ' + text.slice(0, 200),
    } as ApiResponse<T>;
  }
}

/** ====== Publik ====== */
export function fetchPublishedDiaries() {
  return call<Diary[]>('publicList');
}

/** ====== Auth ====== */
export function login(username: string, password: string) {
  return call('login', { username, password });
}

export function logout() {
  const token = getToken();
  return call('logout', { token });
}

/** ====== Admin ====== */
export function fetchAdminDiaries() {
  return call<Diary[]>('adminList', {}, true);
}

export function fetchDiaryById(id: string) {
  return call<Diary>('getById', { id }, true);
}

export function createDiary(data: Partial<Diary>) {
  return call<Diary>('create', { ...data }, true);
}

export function updateDiary(data: Partial<Diary> & { id: string }) {
  return call<Diary>('update', { ...data }, true);
}

export function setDiaryStatus(id: string, status: 'Draft' | 'Published') {
  return call('setStatus', { id, status }, true);
}

export function deleteDiary(id: string) {
  return call('delete', { id }, true);
}

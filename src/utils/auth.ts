/**
 * utils/auth.ts
 * ------------------------------------------------------------
 * Simpan / ambil token sesi admin dari localStorage.
 * Token diberikan oleh backend (Google Apps Script) saat login.
 */

const TOKEN_KEY = 'diary_token';
const EXPIRES_KEY = 'diary_token_expires';

export function saveToken(token: string, expiresAt: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, expiresAt);
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return null;
  if (new Date(expires).getTime() < Date.now()) {
    clearToken();
    return null;
  }
  return token;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}
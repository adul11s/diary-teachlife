import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../utils/api';
import { saveToken, isLoggedIn } from '../utils/auth';
import { Spinner } from '../components/Spinner';

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isLoggedIn()) {
    nav('/admin', { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    const token = (res as unknown as Record<string, unknown>).token as string | undefined;
    const expiresAt = (res as unknown as Record<string, unknown>).expiresAt as string | undefined;
    if (res.success && token && expiresAt) {
      saveToken(token, expiresAt);
      nav('/admin');
    } else {
      setError(res.message || 'Login gagal');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/60"
      >
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Diary Pembelajaran</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk sebagai Guru</p>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          autoComplete="username"
          required
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading && <Spinner />}
          Masuk
        </button>
      </form>
    </div>
  );
}
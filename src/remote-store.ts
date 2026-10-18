import type { FinanceData } from './types';
import { validate } from './store';

export type SpaceSummary = { id: string; kind: 'personal' | 'household'; name: string; role: 'owner' | 'editor' | 'reader'; memberId: string };
export type Session = { user: { id: string; email: string; name: string }; spaces: SpaceSummary[] };

let active: { userId: string; space: SpaceSummary } | null = null;
export function setActiveSpace(userId: string, space: SpaceSummary) {
  active = { userId, space };
  try { localStorage.setItem(`khaneh:${userId}:last-space`, space.id); } catch { /* preference only */ }
}
export function lastSpace(userId: string) { try { return localStorage.getItem(`khaneh:${userId}:last-space`); } catch { return null; } }
export function activeSpace() { return active?.space ?? null; }
export function remoteEnabled() { return !!active; }

// Browser copies are kept per account and space, so two people on one browser never see each other's data.
const prefix = () => `khaneh:${active?.userId ?? 'anonymous'}:${active?.space.id ?? 'none'}:`;
export const spaceStorage = {
  getItem: (key: string) => localStorage.getItem(prefix() + key),
  setItem: (key: string, value: string) => localStorage.setItem(prefix() + key, value),
  removeItem: (key: string) => localStorage.removeItem(prefix() + key),
};

export async function api(path: string, body: unknown = {}) {
  const response = await fetch(path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({ error: 'پاسخ سرور قابل خواندن نیست.' }));
  if (response.status === 401 && !path.startsWith('/api/auth/')) { location.assign('/login?next=' + encodeURIComponent(location.pathname)); throw new Error(result.error || 'ابتدا وارد شو.'); }
  if (!response.ok) throw new Error(result.error || 'ارتباط برقرار نشد. دوباره تلاش کن.');
  return result;
}
export async function fetchSession(): Promise<Session | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('اتصال به سرور انجام نشد.');
  return response.json();
}
export async function logout() {
  try { await api('/api/auth/logout'); } finally {
    for (const key of Object.keys(localStorage)) if (key.startsWith('khaneh')) localStorage.removeItem(key);
    sessionStorage.clear();
    try { for (const key of await caches.keys()) await caches.delete(key); } catch { /* no cache storage */ }
    location.assign('/');
  }
}

export async function remoteRequest(action: 'read' | 'write' | 'invitations' | 'requests' | 'decide', data?: FinanceData, expected?: FinanceData, extra: Record<string, unknown> = {}) {
  if (!active) throw new Error('فضای مالی انتخاب نشده است.');
  const result = await api(`/api/spaces/${active.space.id}/${action}`, { ...extra, data, expected });
  if (action === 'read') validate(result.data);
  return result;
}
export async function commitRemote(data: FinanceData, expected: FinanceData) {
  validate(data);
  try { await remoteRequest('write', data, expected); }
  catch (error) {
    // A dropped response is not proof that the transaction failed. Never post it twice.
    try { const current = await remoteRequest('read'); if (JSON.stringify(current.data) === JSON.stringify(data)) return; } catch {/* retain the original error */}
    throw error;
  }
}

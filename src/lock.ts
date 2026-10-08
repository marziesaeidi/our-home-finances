export const LOCK_KEY = 'khaneh-device-lock';
type LockRecord = { version: 1; salt: string; hash: string; iterations: number };
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) => Uint8Array.from(value.match(/../g) ?? [], pair => parseInt(pair, 16));
export function readLock(storage: Pick<Storage, 'getItem'>): LockRecord | null {
  const raw = storage.getItem(LOCK_KEY);
  if (raw === null) return null;
  const value = JSON.parse(raw) as LockRecord;
  if (value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.salt) || !/^[a-f0-9]{64}$/.test(value.hash) || value.iterations !== 310000) throw new Error('تنظیمات قفل دستگاه معتبر نیست.');
  return value;
}
async function hashPassword(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: 310000 }, material, 256)));
}
export async function enableLock(storage: Pick<Storage, 'setItem'>, password: string) {
  if (password.length < 8 || password.length > 128) throw new Error('رمز باید بین ۸ و ۱۲۸ نویسه باشد.');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  storage.setItem(LOCK_KEY, JSON.stringify({ version: 1, salt, hash: await hashPassword(password, salt), iterations: 310000 }));
}
export async function verifyLock(storage: Pick<Storage, 'getItem'>, password: string) {
  const lock = readLock(storage);
  return lock !== null && await hashPassword(password, lock.salt) === lock.hash;
}

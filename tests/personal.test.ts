import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, loadStore, saveStore, STORE_KEY, validate } from '../src/store';
import { post } from '../src/finance';
import { categoryNames, saveCategory } from '../src/personalization';
import { removeAccount } from '../src/AccountManager';
import { enableLock, LOCK_KEY, readLock, verifyLock } from '../src/lock';
import { configureDisplay, fa, persianDate } from '../src/utils';
import type { FinanceData } from '../src/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppLock } from '../src/AppLock';
import { categoryIcon } from '../src/category-icons';
import { CategoryEditor } from '../src/SettingsPanel';

test('legacy category icons match transaction defaults and preserve saved custom icons', () => {
  for (const [name, icon] of [['خوراک','🛒'], ['خانه','🏠'], ['حمل‌ونقل','🚕'], ['حقوق','💼'], ['هدیه','🎁'], ['فروش رمز ارز','🪙']]) {
    assert.equal(categoryIcon({ name }), icon);
  }
  assert.equal(categoryIcon({ name: 'خوراک', icon: '🦋' }), '🦋');
  assert.equal(categoryIcon({ name: 'خوراک', icon: '◌' }), '◌');
  assert.equal(categoryIcon({ name: 'دسته دلخواه' }), '◌');
});

test('editing a legacy category starts with its displayed icon and original name', () => {
  const data = fixture();
  const category = data.categoryRecords.find(c => c.name === 'خوراک')!;
  const before = structuredClone(category);
  const html = renderToStaticMarkup(createElement(CategoryEditor, { data, category, change: () => {}, onDone: () => {} }));
  assert.ok(html.includes('value="🛒 خوراک"'));
  assert.deepEqual(category, before);
});

const at = '2026-10-08T12:00:00Z';
const initial = { transactions: [], accounts: [{ id: 'a', name: 'بانک', type: 'بانکی', balance: 1000, visibility: 'shared' as const }, { id: 'b', name: 'نقد', type: 'نقدی', balance: 0, visibility: 'shared' as const }], loans: [], goals: [], recurring: [], budget: { total: 1000, categories: { خوراک: 100 } } };
const fixture = () => migrate(structuredClone(initial), at);
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
test('category rename preserves IDs, budgets, recurring links and financial projections across reload', () => {
  let data = post(fixture(), { id: 'expense', title: 'خرید', amount: 100, date: '2026-10-08', category: 'خوراک', accountId: 'a', type: 'expense', createdBy: 'مرزیه', visibility: 'shared' });
  data.recurring.push({ id: 'r', name: 'خرید', amount: 100, nextDate: '2026-11-08', category: 'خوراک', owner: 'مرزیه', frequency: 'ماهانه', reminder: false });
  const category = data.categoryRecords.find(c => c.name === 'خوراک')!;
  const result = saveCategory(data, { ...category, name: 'مواد غذایی', icon: '🥑', color: '#123456', kind: 'expense' });
  assert.equal(result.transactions[0].categoryId, category.id);
  assert.equal(result.transactions[0].category, 'مواد غذایی');
  assert.equal(result.budget.categories['مواد غذایی'], 100);
  assert.equal(result.budget.categories.خوراک, undefined);
  assert.equal(result.recurring[0].category, 'مواد غذایی');
  assert.deepEqual(result.accounts, data.accounts); assert.deepEqual(result.accountEntries, data.accountEntries);
  const storage = new MemoryStorage(); saveStore(storage, result); assert.deepEqual(loadStore(storage, initial, at), result);
  assert.throws(() => saveCategory(result, { ...category, name: 'خانه' }));
  const archived = saveCategory(result, { ...result.categoryRecords.find(c => c.id === category.id)!, archived: true });
  assert.ok(!categoryNames(archived).includes('مواد غذایی')); assert.equal(archived.transactions.length, 1);
});
test('full portable backup is idempotent and malformed import cannot replace durable records', () => {
  const data = fixture(); data.settings = { ...data.settings, preferredCurrency: 'EUR', calendar: 'gregory', persianNumbers: false };
  const storage = new MemoryStorage(); saveStore(storage, data);
  const file = JSON.stringify(data); const restore = (raw: string) => { const next = migrate(JSON.parse(raw), at); saveStore(storage, next); };
  restore(file); restore(file); assert.equal(storage.getItem(STORE_KEY), file);
  for (const patch of [{ settings: null }, { categoryRecords: [{ id: 'x', name: 'x', archived: 'false' }] }, { settings: { ...data.settings, preferredCurrency: 'ZZZ' } }, { settings: { ...data.settings, calendar: 'unknown' } }]) {
    assert.throws(() => restore(JSON.stringify({ ...data, ...patch }))); assert.equal(storage.getItem(STORE_KEY), file);
  }
  const duplicated = post(data, { id: 't', occurrenceKey: 'recurring:day', title: 'پرداخت', amount: 10, date: '2026-10-08', category: 'خوراک', accountId: 'a', type: 'expense', createdBy: 'مرزیه', visibility: 'shared' });
  duplicated.transactions.push({ ...duplicated.transactions[0], id: 'duplicate' }); assert.throws(() => validate(duplicated));
});
test('account deletion cannot orphan history, schedules, transfers or balances', () => {
  const data = fixture(); assert.equal(removeAccount(data, 'b').accounts.length, 1); assert.throws(() => removeAccount(data, 'a'));
  const transfer = post(data, { id: 'transfer', title: 'انتقال', amount: 100, date: '2026-10-08', category: 'سایر', accountId: 'a', toAccountId: 'b', type: 'transfer', createdBy: 'مرزیه', visibility: 'shared' });
  assert.throws(() => removeAccount(transfer, 'b'));
  data.recurring.push({ id: 'r', name: 'پرداخت', amount: 10, nextDate: '2026-11-08', category: 'سایر', accountId: 'b', owner: 'مرزیه', frequency: 'ماهانه', reminder: false });
  assert.throws(() => removeAccount(data, 'b'));
});
test('display preferences retain Persian digits with either calendar', () => {
  try { configureDisplay({ calendar: 'gregory', persianNumbers: false }); assert.equal(fa(1234), '۱٬۲۳۴'); assert.match(persianDate('2026-10-08'), /۲۰۲۶/); configureDisplay({}); assert.equal(fa(1234), '۱٬۲۳۴'); assert.match(persianDate('2026-10-08'), /۱۴۰۵/); } finally { configureDisplay({}); }
});
test('device lock stores a salted verifier, rejects wrong passwords and remains outside financial backups', async () => {
  const storage = new MemoryStorage(); await enableLock(storage, 'fictional-test-password');
  assert.ok(!storage.getItem(LOCK_KEY)!.includes('fictional-test-password')); assert.equal(await verifyLock(storage, 'wrong-password'), false); assert.equal(await verifyLock(storage, 'fictional-test-password'), true);
  const first = readLock(storage)!; await enableLock(storage, 'fictional-test-password'); assert.notEqual(first.salt, readLock(storage)!.salt);
  await assert.rejects(enableLock(storage, 'short')); assert.ok(!JSON.stringify(fixture()).includes(LOCK_KEY));
  storage.setItem(LOCK_KEY, '{invalid'); assert.throws(() => readLock(storage));
});
test('portable backup retains all modeled collections and optional settings', () => {
  const data = fixture(); const exported: FinanceData = JSON.parse(JSON.stringify(data)); validate(exported);
  for (const key of ['transactions', 'folders', 'goals', 'assets', 'loans', 'obligations', 'recurring', 'installments', 'accounts', 'accountEntries', 'categoryRecords', 'monthlyBudgets', 'settings'] as const) assert.deepEqual(exported[key], data[key]);
});
test('balanced but forged account entries are rejected before restore', () => {
  const data = post(fixture(), { id: 't', title: 'پرداخت', amount: 100, date: '2026-10-08', category: 'خوراک', accountId: 'a', type: 'expense', createdBy: 'مرزیه', visibility: 'shared' });
  data.accountEntries[0].delta = -200; data.accounts[0].balance = 800;
  assert.throws(() => validate(data));
});
test('screen lock keeps mounted content hidden and inert rather than replacing its state', async () => {
  const storage = new MemoryStorage(); await enableLock(storage, 'fictional-test-password');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const locked = renderToStaticMarkup(createElement(AppLock, null, createElement('section', null, 'current snapshot')));
    assert.match(locked, /hidden="" inert=""/); assert.match(locked, /current snapshot/); assert.match(locked, /برنامه قفل است/);
    storage.values.delete(LOCK_KEY);
    const unlocked = renderToStaticMarkup(createElement(AppLock, null, createElement('section', null, 'current snapshot')));
    assert.match(unlocked, /current snapshot/); assert.doesNotMatch(unlocked, /برنامه قفل است|hidden=""/);
  } finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});


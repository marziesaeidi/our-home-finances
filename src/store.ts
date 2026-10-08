import { validateForeignExpense } from './foreignValidation';
import { currencies, currencyDefinition } from './currencies';
import { validateObligations } from './obligations';
import type { Data, FinanceData } from './types';
import { canonicalDay, fromJalali, isoDay, periodKey } from './calendar';
import { converted, decimal, sum } from './decimal';
import { categories } from './data';
import { validateSavingsAssets } from './savings';

export const STORE_KEY = 'khaneh-v2';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export function validate(value: unknown): asserts value is FinanceData {
  if (!record(value)) throw new Error('ساختار فایل معتبر نیست.');
  if (value.schemaVersion !== 2) throw new Error('نسخه داده پشتیبانی نمی‌شود.');
  for (const key of ['transactions', 'accounts', 'loans', 'goals', 'recurring', 'folders', 'assets', 'obligations', 'installments', 'accountEntries', 'categoryRecords']) {
    const rows = value[key];
    if (!Array.isArray(rows)) throw new Error('ساختار داده ناقص است.');
    const ids = new Set<string>();
    for (const row of rows) {
      if (!record(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('شناسه تکراری یا نامعتبر در داده‌ها.');
      ids.add(row.id);
      for (const field of ['amount', 'balance', 'total', 'installment', 'target', 'saved', 'cost', 'openingCost', 'principal', 'interest', 'fee', 'costBasis', 'openingBalance', 'openingSaved', 'principalRemaining', 'delta']) {
        if (row[field] !== undefined && !Number.isSafeInteger(row[field])) throw new Error('داده شامل مبلغ اعشاری یا خارج از محدوده امن است؛ نسخه اصلی حفظ شد.');
      }
    }
  }
  const data = value as unknown as FinanceData;
  for (const f of data.folders) {
    if (typeof f.name !== 'string' || !f.name.trim() || f.note !== undefined && typeof f.note !== 'string' || f.budget !== undefined && (!Number.isSafeInteger(f.budget) || f.budget < 0) || f.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(f.color) || f.icon !== undefined && typeof f.icon !== 'string') throw new Error('مشخصات پوشه معتبر نیست.');
  }
  const required: Record<string, string[]> = { transactions:['title','amount','date','type','accountId','category','createdBy','visibility'], accounts:['name','balance','openingBalance','visibility','currency'], loans:['name','total','installment','count','paid','nextDate','frequency'], goals:['name','target','saved','visibility'], recurring:['name','amount','frequency','nextDate','owner'], folders:['name','visibility','owner'], assets:['name','kind','quantity','openingQuantity','unit','custody','cost','openingCost','visibility','owner'], obligations:['name','amount','date','accountId','status','direction','visibility','owner'], installments:['loanId','index','amount','date','settled'], accountEntries:['accountId','transactionId','delta','operation','at'], categoryRecords:['name','archived'] };
  for (const [collection, fields] of Object.entries(required)) for (const row of value[collection] as Record<string, unknown>[]) {
    if (fields.some(field => row[field] === undefined || row[field] === null)) throw new Error('فایل داده ناقص است؛ نسخه اصلی حفظ شد.');
    if (fields.some(field => ['name','title','date','type','accountId','category','createdBy','visibility','currency','nextDate','frequency','owner','kind','quantity','openingQuantity','unit','custody','status','direction','loanId','transactionId','operation','at'].includes(field) && typeof row[field] !== 'string')) throw new Error('نوع اطلاعات فایل معتبر نیست.');
  }
  for (const a of data.accounts) {
    currencyDefinition(a.currency??'IRT',data.currencyDefinitions);
    if ( a.openingBalance === undefined || a.balance !== sum([a.openingBalance, ...data.accountEntries.filter(e => e.accountId === a.id).map(e => e.delta)])) throw new Error('موجودی حساب با دفتر تغییرات سازگار نیست.');
  }
  for (const t of data.transactions) {
    if (t.folderId && !data.folders.some(f => f.id === t.folderId)) throw new Error('ارتباط پوشه معتبر نیست.');
    if (!isoDay(t.date) || !['expense','income','transfer','saving','asset-buy','asset-sell','loan-receipt','loan-payment'].includes(t.type) || !['shared','private'].includes(t.visibility) || typeof t.title !== 'string') throw new Error('تراکنش معتبر نیست؛ نسخه اصلی حفظ شد.');
    // Existing dangling links are retained; new events must have valid relationships.
    if (!t.legacy && (!data.accounts.some(a => a.id === t.accountId) || t.goalId && !data.goals.some(g => g.id === t.goalId) || t.assetId && !data.assets.some(a => a.id === t.assetId))) throw new Error('ارتباط مالی معتبر نیست.');
    if (t.amount <= 0 || t.fee !== undefined && t.fee < 0) throw new Error('مبلغ تراکنش معتبر نیست.');
    if (t.fx && (t.fx.direction !== 'IRT-per-unit' || t.fx.rounding !== 'half-up' || !isoDay(t.fx.date) || typeof t.fx.source !== 'string' || !t.fx.source.trim() || typeof t.fx.currency !== 'string' || t.foreignExpense?.convertedOverride === undefined && converted(t.fx.originalAmount,t.fx.rate) !== t.amount || decimal(t.fx.rate).units <= 0n)) throw new Error('مبلغ و نرخ تاریخی همخوان نیستند.');
  }
  for (const t of data.transactions) validateForeignExpense(data,t);
  if(data.currencyDefinitions){ const codes=new Set(currencies.map(c=>c.code)); for(const c of data.currencyDefinitions){if(!/^[A-Z]{3}$/.test(c.code)||codes.has(c.code)||!c.label?.trim()||!Number.isInteger(c.decimals)||c.decimals<0||c.decimals>6)throw new Error('تنظیمات ارز معتبر نیست.');codes.add(c.code);} }
  if(data.fxRefreshMinutes!==undefined && (!Number.isSafeInteger(data.fxRefreshMinutes)||data.fxRefreshMinutes<1||data.fxRefreshMinutes>10080))throw new Error('فاصله تازه‌سازی معتبر نیست.');
  for (const l of data.loans) if (!Number.isInteger(l.count) || l.count < 1 || l.count > 1200 || !Number.isInteger(l.paid) || l.paid < 0 || l.paid > l.count || l.total < 0 || l.installment < 0) throw new Error('مقادیر وام معتبر نیستند.');
  for (const g of data.goals) if (g.saved < 0 || g.target < 0) throw new Error('مقادیر هدف معتبر نیستند.');
  for (const a of data.assets) {
    decimal(a.quantity); decimal(a.openingQuantity);
    if (a.cost < 0 || a.openingCost < 0 || !['gold','crypto','currency','other'].includes(a.kind) || a.quote && (decimal(a.quote).units <= 0n || !a.quoteDate || !isoDay(a.quoteDate))) throw new Error('دارایی یا قیمت معتبر نیست.');
    if (a.quote) converted(a.quantity,a.quote);
  }
  for (const o of data.obligations) if (o.amount <= 0 || !isoDay(o.date) || !['pending','cleared','canceled','bounced'].includes(o.status) || !data.accounts.some(a => a.id === o.accountId)) throw new Error('تعهد معتبر نیست.');
  if (!['light','dark'].includes(data.settings.theme) || typeof data.settings.name !== 'string' || data.settings.currency !== 'IRT' || data.settings.timezone !== 'Asia/Tehran') throw new Error('تنظیمات معتبر نیست.');
  for (const key of Object.keys(data.monthlyBudgets)) {
    if (!/^\d{4}-\d{2}$/.test(key)) throw new Error('کلید ماه بودجه معتبر نیست.');
    fromJalali(`${key.replace('-','/')}/1`);
  }
  for (const entry of data.accountEntries) if (!data.accounts.some(a=>a.id===entry.accountId) || !data.transactions.some(t=>t.id===entry.transactionId)) throw new Error('ارتباط دفتر تغییرات معتبر نیست.');
  // Reject aggregate values beyond the supported range before any screen renders them.
  for(const code of new Set(data.accounts.map(a=>a.currency)))sum(data.accounts.filter(a=>a.currency===code).map(a=>a.balance)); sum(data.goals.map(g=>g.saved)); sum(data.assets.filter(a=>a.quote).map(a=>converted(a.quantity,a.quote!)));
  if (!record(value.budget) || !record(value.budget.categories) || !record(value.monthlyBudgets) || !record(value.settings) || !Array.isArray(value.migrationWarnings)) throw new Error('تنظیمات یا بودجه معتبر نیست.');
  for (const budget of [value.budget, ...Object.values(value.monthlyBudgets)]) {
    if (!record(budget) || !record(budget.categories) || !Number.isSafeInteger(budget.total) || Number(budget.total) < 0 || Object.values(budget.categories).some(n => !Number.isSafeInteger(n) || Number(n) < 0)) throw new Error('بودجه معتبر نیست.');
  }
  validateSavingsAssets(data);
  validateObligations(data);
}
export function migrate(input: Data | FinanceData, at: string): FinanceData {
  if ('schemaVersion' in input) { validate(input); return input; }
  for (const key of ['transactions', 'accounts', 'loans', 'goals', 'recurring'] as const) if (!Array.isArray(input[key])) throw new Error('داده قدیمی ناقص است؛ نسخه اصلی حفظ شد.');
  const categoryRecords = [...new Set([...categories, ...input.transactions.map(t => t.category)])].map((name, i) => ({ id: `category-${i}`, name, archived: false }));
  const result: FinanceData = {
    ...input, schemaVersion: 2, migratedAt: at,
    transactions: input.transactions.map(t => ({ ...t, categoryId: categoryRecords.find(c=>c.name===t.category)?.id, legacy: true, currency: 'IRT', status: 'posted' })),
    accounts: input.accounts.map(a => ({ ...a, currency: 'IRT', owner: a.id === 'ali' ? 'علی' : 'مرزیه', openingBalance: a.balance, baselineAt: at })),
    goals: input.goals.map(g => ({ ...g, owner: 'مرزیه', openingSaved: g.saved })),
    loans: input.loans.map(l => ({ ...l, baselinePaid: l.paid, legacy: true })),
    folders: [], assets: [], obligations: [], installments: [], accountEntries: [],
    categoryRecords,
    monthlyBudgets: { [periodKey(canonicalDay(new Date(at)))]: structuredClone(input.budget) },
    settings: { name: 'خانه ما', theme: 'light', currency: 'IRT', timezone: 'Asia/Tehran' },
    migrationWarnings: ['موجودی حساب‌ها و پس‌اندازهای قبلی به‌عنوان مبنای افتتاحیه حفظ شدند؛ تاریخچه قدیمی دوباره روی موجودی اعمال نشده است.', ...(input.loans.some(l => !isoDay(l.nextDate)) || input.recurring.some(r => !isoDay(r.nextDate)) ? ['بعضی سررسیدهای قدیمی سال ندارند؛ پیش از پرداخت دوره‌ای، تاریخ کامل را وارد کن.'] : []), ...(input.loans.length ? ['تفکیک اصل و سود وام‌های قدیمی معلوم نیست؛ مبلغ قراردادی بدون حدس حفظ شده است.'] : [])]
  };
  validate(result); return result;
}
export function loadStore(storage: StorageLike, initial: Data, at: string): FinanceData {
  const current = storage.getItem(STORE_KEY);
  if (current !== null) { const parsed: unknown = JSON.parse(current); validate(parsed); return parsed; }
  const legacy = storage.getItem('khaneh-v1');
  const data = migrate(legacy ? JSON.parse(legacy) as Data : initial, at);
  if (legacy !== null) storage.setItem('khaneh-v1-original', legacy);
  storage.setItem(STORE_KEY, JSON.stringify(data));
  return data;
}
export function saveStore(storage: StorageLike, data: FinanceData, expected?: FinanceData) {
  validate(data);
  // One key replacement is atomic. The last valid state is retained for recovery.
  const previous = storage.getItem(STORE_KEY);
  if (expected && previous !== JSON.stringify(expected)) throw new Error('داده در پنجره دیگری تغییر کرده است؛ صفحه را تازه‌سازی کن تا تغییری از بین نرود.');
  if (previous !== null) storage.setItem('khaneh-v2-previous', previous);
  storage.setItem(STORE_KEY, JSON.stringify(data));
}

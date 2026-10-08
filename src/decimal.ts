// Financial values never pass through binary fractional arithmetic.
export const normalizeDigits = (value: string) => value.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/٫/g, '.').trim();
function normalizedNumber(value: string) {
  const normalized = normalizeDigits(value);
  if (!/[,٬]/.test(normalized)) return normalized;
  if (!/^\d{1,3}(?:[,٬]\d{3})+(?:\.\d{1,18})?$/.test(normalized)) throw new Error('جداکننده هزارگان معتبر نیست.');
  return normalized.replace(/[,٬]/g,'');
}
export function decimal(value: string): { units: bigint; scale: bigint } {
  const normalized = normalizedNumber(value);
  if (!/^\d+(\.\d{1,18})?$/.test(normalized) || normalized.length > 80) throw new Error('عدد معتبر با حداکثر ۱۸ رقم اعشار وارد کن.');
  const [whole, fraction = ''] = normalized.split('.');
  return { units: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
}
export function checked(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('مبلغ از محدوده مجاز بیشتر است.');
  return Number(value);
}
export function integer(value: string, allowZero = false): number {
  const normalized = normalizedNumber(value);
  if (!/^\d+$/.test(normalized) || normalized.length > 80) throw new Error('مبلغ را به تومان و بدون اعشار وارد کن.');
  const result = checked(BigInt(normalized));
  if (result < (allowZero ? 0 : 1)) throw new Error('مبلغ معتبر وارد کن.');
  return result;
}
export const add = (a: number, b: number) => {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw new Error('مبلغ صحیح و امن لازم است.');
  return checked(BigInt(a) + BigInt(b));
};
export const sum = (values: number[]) => checked(values.reduce((total, value) => {
  if (!Number.isSafeInteger(value)) throw new Error('مبلغ صحیح و امن لازم است.');
  return total + BigInt(value);
}, 0n));
export const multiply = (a: number, b: number) => checked(BigInt(integer(String(a), true)) * BigInt(integer(String(b), true)));
export function converted(amount: string, rate: string): number {
  const a = decimal(amount), r = decimal(rate), denominator = a.scale * r.scale;
  return checked((a.units * r.units * 2n + denominator) / (2n * denominator));
}
export function quantityAdd(a: string, b: string, subtract = false): string {
  const x = decimal(a), y = decimal(b), scale = x.scale > y.scale ? x.scale : y.scale;
  const units = x.units * (scale / x.scale) + (subtract ? -1n : 1n) * y.units * (scale / y.scale);
  if (units < 0n) throw new Error('مقدار دارایی کافی نیست.');
  const digits = scale.toString().length - 1;
  const text = units.toString().padStart(digits + 1, '0');
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}`.replace(/\.?0+$/, '') || '0' : text;
}
export function proportional(total: number, part: string, whole: string): number {
  const p = decimal(part), w = decimal(whole);
  if (!w.units) throw new Error('مقدار دارایی صفر است.');
  return checked(BigInt(total) * p.units * w.scale / (p.scale * w.units));
}
export function split(total: number, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 1200) throw new Error('تعداد اقساط باید بین ۱ و ۱۲۰۰ باشد.');
  const t = BigInt(integer(String(total), true)), c = BigInt(count), base = t / c;
  return Array.from({ length: count }, (_, i) => checked(base + (i === count - 1 ? t % c : 0n)));
}
export function apportion(component: number, amounts: number[]): number[] {
  const total = BigInt(sum(amounts)), part = BigInt(integer(String(component), true));
  if (!total || part > total) throw new Error('جزء مبلغ بیشتر از مجموع اقساط است.');
  let cumulative = 0n, allocated = 0n;
  return amounts.map(amount => {
    cumulative += BigInt(amount);
    const next = part * cumulative / total, result = next - allocated;
    allocated = next; return checked(result);
  });
}

// Rounded half-up to 18 decimals; the original total and quantity remain authoritative.
export function pricePerUnit(total: string, quantity: string): string {
 const t=decimal(total),q=decimal(quantity);if(!q.units)throw new Error('مقدار دارایی صفر است.');
 const scale=10n**18n, numerator=t.units*q.scale*scale, denominator=t.scale*q.units;
 const units=(2n*numerator+denominator)/(2n*denominator), text=units.toString().padStart(19,'0');
 return `${text.slice(0,-18)}.${text.slice(-18)}`.replace(/\.?0+$/,'')||'0';
}

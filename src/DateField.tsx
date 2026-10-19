import { useEffect, useId, useRef, useState } from 'react';
import { fromJalali, isoDay, jalaliInput } from './calendar';
import { normalizeDigits } from './decimal';
import { persianDigits } from './input-format';
import { displayPreferences } from './utils';

export function DateField({ value, onChange, label }: { value: string; onChange: (date: string) => void; label?: string }) {
  const gregorian = displayPreferences().calendar === 'gregory';
  const title = label ?? (gregorian ? 'تاریخ میلادی' : 'تاریخ شمسی');
  const format = (date: string) => normalizeDigits(gregorian ? date.replace(/-/g, '/') : jalaliInput(date)).split('/');
  const [parts, setParts] = useState<string[]>(() => format(value));
  const [error, setError] = useState('');
  const group = useRef<HTMLFieldSetElement>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const hint = useId();
  useEffect(() => {
    if (!group.current?.contains(document.activeElement)) {
      setParts(format(value));
      if (isoDay(value)) { inputs.current[0]?.setCustomValidity('');setError(''); }
    }
  }, [value, gregorian]);
  const update = (next: string[]) => {
    setParts(next);
    try {
      if (!/^\d{4}$/.test(next[0] ?? '') || !/^\d{1,2}$/.test(next[1] ?? '') || !/^\d{1,2}$/.test(next[2] ?? '')) throw new Error();
      const date = gregorian ? `${next[0]}-${next[1].padStart(2, '0')}-${next[2].padStart(2, '0')}` : fromJalali(next.join('/'));
      if (!isoDay(date)) throw new Error();
      inputs.current[0]?.setCustomValidity(''); setError(''); onChange(date);
    } catch {
      inputs.current[0]?.setCustomValidity('سال، ماه و روز معتبر وارد کن.');
      onChange('');
    }
  };
  return <fieldset ref={group} className="field date-field" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget as Node) && inputs.current[0]?.validationMessage) setError('تاریخ کامل و معتبر وارد کن؛ مثلاً ' + (gregorian ? '۲۰۲۶/۱۰/۱۵' : '۱۴۰۵/۰۷/۲۳') + '.');
  }}><legend>{title}</legend><div className="date-segments" dir="ltr" data-invalid={!!error}>
    {['سال', 'ماه', 'روز'].map((name, index) => <span className="date-segment" key={name}>
      <input ref={node => { inputs.current[index] = node; }} type="text" inputMode="numeric" required
        aria-label={`${title}، ${name}`} aria-invalid={!!error} aria-describedby={hint}
        placeholder={index === 0 ? 'سال' : name} value={persianDigits(parts[index] ?? '')}
        onFocus={e => e.currentTarget.select()} maxLength={index === 0 ? 4 : 2}
        onInvalid={e => { e.preventDefault(); setError('سال، ماه و روز را کامل و معتبر وارد کن.'); }}
        onPaste={e => { const digits = normalizeDigits(e.clipboardData.getData('text')).replace(/[^0-9]/g, ''); if (digits.length === 8) { e.preventDefault(); update([digits.slice(0,4), digits.slice(4,6), digits.slice(6,8)]); } }}
        onKeyDown={e => { if (e.key === 'Backspace' && !parts[index] && index) inputs.current[index - 1]?.focus(); }}
        onChange={e => { const digits = normalizeDigits(e.target.value).replace(/[^0-9]/g, '').slice(0, index === 0 ? 4 : 2); const next = [...parts]; next[index] = digits; update(next); if (digits.length === (index === 0 ? 4 : 2)) inputs.current[index + 1]?.focus(); }}/>
    </span>)}
  </div><small id={hint} className={error ? 'field-error' : 'field-hint'} role={error ? 'alert' : undefined}>{error || 'سال / ماه / روز · فقط عدد بنویس'}</small></fieldset>;
}

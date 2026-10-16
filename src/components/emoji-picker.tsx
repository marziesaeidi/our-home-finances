import { useId } from 'react';
import { AppIcon, iconLabel, iconOptions } from './app-icon';
import { Action, FieldInput } from './finance-ui';

export function EmojiPicker({ value, onChange, label = 'آیکن دلخواه', choices = iconOptions.map(([symbol]) => symbol) }: {
  value: string; onChange: (value: string) => void; label?: string; choices?: readonly string[];
}) {
  const hint = useId();
  return <fieldset className="emoji-picker"><legend>{label}</legend>
    <div className="emoji-presets">{choices.map(symbol => <Action type="button" key={symbol}
      className={value === symbol ? 'outline selected' : 'outline'} aria-pressed={value === symbol}
      aria-label={`انتخاب ${iconLabel(symbol)}`} onClick={() => onChange(symbol)}><AppIcon symbol={symbol} size={26}/></Action>)}</div>
    <label className="field"><span>ایموجی دلخواه از کیبورد گوشی</span><FieldInput type="text" inputMode="text"
      value={value} maxLength={32} autoComplete="off" spellCheck={false} aria-describedby={hint}
      placeholder="مثلاً 🦋" onChange={event => onChange(event.target.value)}/></label>
    <small id={hint} className="field-hint">روی کادر بزن و از بخش ایموجی کیبورد، نماد دلخواهت را وارد کن.</small>
  </fieldset>;
}

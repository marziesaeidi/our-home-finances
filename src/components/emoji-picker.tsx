import { useId, useState } from 'react';
import { isSingleEmoji } from '../emoji';
import { AppIcon, iconLabel, iconOptions } from './app-icon';
import { Action, FieldInput } from './finance-ui';

export function EmojiPicker({ value, onChange, label = 'آیکن دلخواه', choices = iconOptions.map(([symbol]) => symbol), showCustomInput = true }: {
  value: string; onChange: (value: string) => void; label?: string; choices?: readonly string[]; showCustomInput?: boolean;
}) {
  const hint = useId();
  const [error, setError] = useState('');
  return <fieldset className="emoji-picker"><legend>{label}</legend>
    <div className="emoji-presets">{choices.map(symbol => <Action variant={value === symbol ? "outline" : "outline"} type="button" key={symbol}
      className={value === symbol ? 'outline selected' : 'outline'} aria-pressed={value === symbol}
      aria-label={`انتخاب ${iconLabel(symbol)}`} onClick={() => { setError(''); onChange(symbol); }}><AppIcon symbol={symbol} size={26}/></Action>)}</div>
    {showCustomInput && <><label className="field"><span>ایموجی دلخواه از کیبورد گوشی</span><FieldInput type="text" inputMode="text"
      value={value} error={error} autoComplete="off" spellCheck={false} aria-describedby={hint}
      placeholder="مثلاً 🦋" onChange={event => {
        const next = event.target.value;
        if (next && !isSingleEmoji(next)) {
          event.target.value = value;
          setError('فقط یک ایموجی انتخاب کن؛ وارد کردن متن یا چند ایموجی مجاز نیست.');
          return;
        }
        setError('');
        onChange(next);
      }}/></label>
    <small id={hint} className="field-hint">از بخش ایموجی کیبورد فقط یک ایموجی انتخاب کن. برای جایگزینی، ابتدا ایموجی فعلی را پاک کن.</small></>}
  </fieldset>;
}

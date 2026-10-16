import { FlowBack } from './flow-navigation';
import { useRef, useState, type ReactNode } from 'react';
import { Action } from './finance-ui';
import { Card } from './ui/card';

export function EditorForm({ title, children, onSubmit, defaultOpen = false, afterSave = 'stay', onNew, submitLabel = 'ثبت' }: {
  title: string; children: ReactNode; onSubmit: (data: FormData) => void;
  defaultOpen?: boolean; afterSave?: 'stay' | 'close'; onNew?: () => void; submitLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const lock = useRef(false);
  const details = useRef<HTMLDetailsElement>(null);
  return <Card asChild className="finance-surface"><details ref={details} className="card module-editor" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    {open&&<FlowBack label="بازگشت" onBack={()=>setOpen(false)}/>}
    <summary>{title}</summary>
    <form key={epoch} className="finance-form" onSubmit={e => {
      e.preventDefault();
      if (lock.current || saved) return;
      lock.current = true;
      try {
        onSubmit(new FormData(e.currentTarget)); setError('');
        if (afterSave === 'close') { setSaved(true); if (details.current) details.current.open = false; }
      } catch (err) { setError(err instanceof Error ? err.message : 'ثبت انجام نشد.'); }
      finally { lock.current = false; }
    }}>
      {children}
      {error && <p role="alert" className="form-error">{error}</p>}
      {saved && <p role="status">ثبت شد.</p>}
      <Action type="submit" className="primary" disabled={saved}>{submitLabel}</Action>
      {saved && <Action type="button" className="outline" onClick={() => { onNew?.(); setEpoch(n => n + 1); setSaved(false); setError(''); }}>{onNew ? 'ثبت مورد جدید' : 'ویرایش دوباره'}</Action>}
    </form>
  </details></Card>;
}

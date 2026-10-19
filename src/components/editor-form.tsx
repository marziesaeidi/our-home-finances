import { ErrorNotice } from './error-notice';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../Dialog';
import { ComposerIntro } from './transaction-composer';
import { Action, AddAction } from './finance-ui';
import { FlowBack } from './flow-navigation';
import { Card } from './ui/card';

export function EditorForm({ title, children, onSubmit, defaultOpen = false, afterSave = 'stay', onNew, submitLabel = 'ثبت', kind, summary, openRequest = 0, flow, hideLauncher = false }: {
  title: string; children: ReactNode; onSubmit: (data: FormData) => void;
  defaultOpen?: boolean; afterSave?: 'stay' | 'close'; onNew?: () => void; submitLabel?: string;
  kind?: string; summary?: string; openRequest?: number; hideLauncher?: boolean;
  flow?: { active: boolean; select: () => void; close: () => void };
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const lock = useRef(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (openRequest) { setOpen(true); flow?.select(); setSaved(false); setError(''); } }, [openRequest]);
  const editor = <form key={epoch} className="finance-form planning-form transaction-composer" onSubmit={e=>{
    e.preventDefault(); if(lock.current)return;lock.current=true;
    try { onSubmit(new FormData(e.currentTarget));setError('');setSaved(true);setOpen(false);flow?.close(); }
    catch(err) { setError(err instanceof Error?err.message:'ثبت انجام نشد.'); }
    finally { lock.current=false; }
  }}><div className="planning-fields"><ComposerIntro kind={kind ?? 'expense'}/>{children}
    {error&&<ErrorNotice message={error}/>}
    </div><div className="planning-footer app-action-footer">{summary&&<p className="composer-receipt" aria-live="polite">{summary}</p>}<Action type="submit" className="primary full">{submitLabel}</Action><Action type="button" className="outline full" onClick={()=>{setOpen(false);flow?.close();}}>انصراف</Action></div>
  </form>;
  if (kind && flow) return <div className="planning-launcher asset-flow-launcher">
    <Action type="button" className={flow.active?'primary planning-launch':'outline planning-launch'} aria-pressed={flow.active} onClick={()=>{if(saved){onNew?.();setEpoch(n=>n+1);}setSaved(false);setError('');flow.select();}}>{title}</Action>
    {flow.active&&<section className="card asset-flow-editor"><FlowBack title={title} label="بازگشت به نمای کلی دارایی‌ها" onBack={flow.close}/>{editor}</section>}
  </div>;
  if (kind) return <div className="planning-launcher">
    {!hideLauncher && (/جدید|افزودن|^ثبت (چک|وام|پرداخت دوره‌ای)/.test(title)
      ? <AddAction onClick={() => { if(saved) { onNew?.();setEpoch(n=>n+1); } setSaved(false);setError('');setOpen(true); }}>{title}</AddAction>
      : <Action type="button" className="outline full planning-launch" onClick={() => { if(saved) { onNew?.();setEpoch(n=>n+1); } setSaved(false);setError('');setOpen(true); }}>{title}</Action>)}
    {saved&&<p className="planning-success" role="status">ذخیره شد.</p>}
    {open&&<Dialog title={title} className="planning-editor-dialog" onClose={()=>setOpen(false)}>
      {editor}
    </Dialog>}
  </div>;
  return <Card asChild className="finance-surface"><details ref={details} className="card module-editor" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
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
      {error && <ErrorNotice message={error}/>}
      {saved && <p role="status">ثبت شد.</p>}
      <Action type="submit" className="primary" disabled={saved}>{submitLabel}</Action>
      {saved && <Action type="button" className="outline" onClick={() => { onNew?.(); setEpoch(n => n + 1); setSaved(false); setError(''); }}>{onNew ? 'ثبت مورد جدید' : 'ویرایش دوباره'}</Action>}
    </form>
  </details></Card>;
}

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, children, onClose, sheet = false }: { title: string; children: ReactNode; onClose: () => void; sheet?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null), close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    const targets = () => Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]')).filter(el => el.getClientRects().length);
    (targets()[0] ?? node).focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); }
      if (e.key === 'Tab') {
        const items = targets(), first = items[0], last = items[items.length - 1];
        if (!first) { e.preventDefault(); node.focus(); }
        else if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    node.addEventListener('keydown', handler);
    return () => { node.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={dialog} tabIndex={-1} className={`modal ${sheet ? 'sheet' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={20}/></button></div>{children}</div></div>;
}

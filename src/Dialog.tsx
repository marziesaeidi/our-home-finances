import type { ReactNode } from 'react';
import { Dialog as Root, DialogContent, DialogTitle, DialogClose } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { X } from 'lucide-react';
import { BackButton } from './components/finance-ui';

export function Dialog({ title, children, onClose, sheet = false, className = '', hideTitle = false }: { title: string; children: ReactNode; onClose: () => void; sheet?: boolean; className?: string; hideTitle?: boolean }) {
  const planning = className.includes('planning-editor-dialog');
  return <Root open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir="rtl" aria-describedby={undefined} showCloseButton={false} className={`ds-portal finance-dialog ${sheet ? 'finance-sheet' : ''} ${className}`}>
      <div className="modal-head" dir="rtl">
        {planning && <DialogClose asChild><BackButton/></DialogClose>}
        <DialogTitle className={hideTitle || planning ? 'sr-only' : undefined}>{title}</DialogTitle>
        {!planning && <DialogClose asChild><Button variant="ghost" size="icon" aria-label="بستن"><X/></Button></DialogClose>}
      </div>
      {children}
    </DialogContent>
  </Root>;
}

import type { ReactNode } from 'react';
import { Dialog as Root, DialogContent, DialogTitle, DialogClose } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { X } from 'lucide-react';

export function Dialog({ title, children, onClose, sheet = false }: { title: string; children: ReactNode; onClose: () => void; sheet?: boolean }) {
  return <Root open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir="rtl" aria-describedby={undefined} showCloseButton={false} className={`ds-portal finance-dialog ${sheet ? 'finance-sheet' : ''}`}>
      <div className="modal-head"><DialogTitle>{title}</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" aria-label="بستن"><X/></Button></DialogClose></div>
      {children}
    </DialogContent>
  </Root>;
}

import type { ReactNode } from 'react';
import { Dialog } from '../Dialog';
import { Action } from './finance-ui';
import { ActionGroup } from './action-layout';

export function ConfirmationDialog({ title, children, onClose, onCancel = onClose, onConfirm, confirmLabel = 'تأیید', destructive = true, disabled = false }: {
  title: string; children: ReactNode; onClose: () => void; onCancel?: () => void;
  onConfirm: () => void; confirmLabel?: ReactNode; destructive?: boolean; disabled?: boolean;
}) {
  return <Dialog title={title} onClose={onClose}>{children}<ActionGroup className="confirm-actions">
    <Action type="button" variant={destructive ? 'destructive' : 'default'} disabled={disabled} onClick={onConfirm}>{confirmLabel}</Action>
    <Action type="button" variant="outline" disabled={disabled} onClick={onCancel}>انصراف</Action>
  </ActionGroup></Dialog>;
}

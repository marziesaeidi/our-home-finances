import { ActionGroup } from './action-layout';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../Dialog';
import { Action, FieldInput } from './finance-ui';

/** Styled replacement for browser prompts; cancellation retains the existing flow. */
export function useUIRequest() {
  const [request, setRequest] = useState<{ title: string; value: string; confirm: boolean } | null>(null);
  const resolve = useRef<((value: string | null) => void) | null>(null);
  useEffect(() => () => { resolve.current?.(null); }, []);
  const finish = (value: string | null) => { resolve.current?.(value); resolve.current = null; setRequest(null); };
  const ask = (title: string, value = '', confirm = false) => new Promise<string | null>(done => {
    resolve.current?.(null); resolve.current = done; setRequest({ title, value, confirm });
  });
  const requestDialog = request && <Dialog title={request.title} onClose={() => finish(null)}>
    <form className="finance-form" onSubmit={event => { event.preventDefault(); finish(request.value); }}>
      {request.confirm ? <p className="confirm-copy">{request.title}</p> : <label className="field">{request.title}<FieldInput autoFocus value={request.value} onChange={event => setRequest({ ...request, value: event.target.value })}/></label>}
      <ActionGroup className="confirm-actions"><Action variant={request.confirm ? "destructive" : "default"} type="submit" className={request.confirm ? 'danger' : 'primary'}>تأیید</Action><Action variant="outline" type="button" className="outline" onClick={() => finish(null)}>انصراف</Action></ActionGroup>
    </form>
  </Dialog>;
  return { requestText: (title: string, value = '') => ask(title, value), requestConfirmation: async (title: string) => (await ask(title, '', true)) !== null, requestDialog };
}

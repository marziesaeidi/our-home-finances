import type { FinanceData } from './types';
import { validate } from './store';

export function remoteEnabled() {
  return !!document.querySelector('meta[name="khaneh-public-share"]') || !['localhost','127.0.0.1','[::1]'].includes(location.hostname) || !!localStorage.getItem('khaneh-owner-key') || !!localStorage.getItem('khaneh-approved-access');
}
export async function remoteRequest(action:'read'|'write'|'invite'|'requests'|'decide', data?:FinanceData, expected?:FinanceData, extra:Record<string,unknown>={}) {
  const response=await fetch('/api/database/sync',{
    method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),
    body:JSON.stringify({...extra,action,data,expected,ownerKey:localStorage.getItem('khaneh-owner-key'),token:localStorage.getItem('khaneh-approved-access')||sessionStorage.getItem('khaneh-approved-access')}),
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'ذخیره روی سرور انجام نشد.');
  if(action==='read')validate(result.data);
  return result;
}
export async function commitRemote(data:FinanceData,expected:FinanceData) {
  validate(data);
  try { await remoteRequest('write',data,expected); }
  catch(error) {
    // A dropped response is not proof that the transaction failed. Never post it twice.
    try { const current=await remoteRequest('read');if(JSON.stringify(current.data)===JSON.stringify(data))return; }catch {/* retain the original error */}
    throw error;
  }
}

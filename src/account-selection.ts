import type { Account, FinanceData } from './types';
import { membersOf } from './household-access';
export function accountLabel(data: FinanceData, account: Account) {
 const owner=membersOf(data).find(m=>m.id===account.owner)?.name??account.owner;
 return `${account.name}${owner?` · ${owner}`:''}`;
}
export function defaultAccount(data: FinanceData, viewer: string, currency='IRT') {
 const recent=data.transactions.find(t=>t.createdBy===viewer&&t.status!=='reversed'&&data.accounts.some(a=>a.id===t.accountId&&(a.currency??'IRT')===currency));
 return recent?.accountId??data.accounts.find(a=>(a.currency??'IRT')===currency)?.id??'';
}
export function confirmAccounts(data: FinanceData, viewer: string, ids: (string|undefined)[]) {
 const others=data.accounts.filter(a=>ids.includes(a.id)&&a.owner&&a.owner!==viewer);
 if(others.length&&!window.confirm(`شما دارید با حساب ${others.map(a=>accountLabel(data,a)).join('، ')} تراکنش ثبت می‌کنید. آیا مطمئن هستید؟`))throw new Error('ثبت لغو شد؛ حساب را تغییر بده یا دوباره تأیید کن.');
}

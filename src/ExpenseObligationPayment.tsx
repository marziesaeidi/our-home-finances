import { ErrorNotice } from './components/error-notice';
import { ComposerIntro, ComposerFooter, CompactDate } from './components/transaction-composer';
import { useRef, useState } from 'react';
import type { FinanceData } from './types';
import { expensePayments, payExpenseObligation, type PaymentKind, type ExpensePayment } from './expense-payments';
import { allowed } from './finance';
import { integer } from './decimal';
import { Action, FieldInput, FieldSelect, Surface } from './components/finance-ui';
import { isoDay, periodKey } from './calendar';
import { id, persianDate, today } from './utils';
import { obligationMoney } from './FinancialObligations';

type Props = { data: FinanceData; viewer: string; kind: PaymentKind; change: (data: FinanceData) => void; onSaved: () => void };
export function ExpenseObligationPayment(props: Props) {
  const rows = expensePayments(props.data,props.viewer).filter(r => r.kind === props.kind && (r.kind !== 'installment' || isoDay(r.date) && periodKey(r.date) === periodKey(today())));
  const [key,setKey] = useState('');
  const row = rows.find(r => r.key === key);
  return <div className="expense-obligation-flow"><label className="field"><span>{props.kind === 'installment'?'وام و قسط مربوط به این ماه':props.kind === 'check'?'چک مربوط':'تعهد دوره‌ای مربوط'}</span><FieldSelect value={key} onChange={e=>setKey(e.target.value)} required><option value="">انتخاب کن</option>{rows.map(r=><option key={r.key} value={r.key}>{r.name} · {persianDate(r.date)} · {obligationMoney(r.amount,r.currency)}</option>)}</FieldSelect></label>{!rows.length&&<p className="field-hint">{props.kind==='installment'?'در ماه جاری شمسی قسط پرداخت‌نشده‌ای وجود ندارد.':'مورد پرداخت‌نشده‌ای وجود ندارد. ابتدا آن را در برنامه مالی ← تعهدات تعریف کن.'}</p>}{row&&<PaymentForm key={row.key} {...props} row={row}/>}</div>;
}
function PaymentForm({data,viewer,change,onSaved,row}:Props & {row:ExpensePayment}) {
  const [requestId]=useState(id),lock=useRef(false);
  const [account,setAccount]=useState(row.accountId??data.accounts.find(a=>allowed(a,viewer)&&(a.currency??'IRT')==='IRT')?.id??'');
  const [date,setDate]=useState(today()),[rate,setRate]=useState(''),[value,setValue]=useState(String(row.amount)),[error,setError]=useState('');
  let total=row.amount;try{if(row.kind==='recurring')total=integer(value);}catch{total=0;}
  return <Surface as="section" className="card add-form-card transaction-composer composer-installment"><ComposerIntro kind="installment"/><form className="finance-form" onSubmit={e=>{e.preventDefault();if(lock.current)return;lock.current=true;try{
    change(payExpenseObligation(data,viewer,row.key,{requestId,date,accountId:account,rate:rate||undefined,value:row.kind==='recurring'?integer(value):undefined}));onSaved();
  }catch(e){lock.current=false;setError((e as Error).message);}}}>
    <p className="calculated">مبلغ پرداخت: <strong>{obligationMoney(total,row.currency)}</strong></p>
    {row.kind==='recurring'&&<label className="field"><span>مبلغ واقعی پرداخت ({row.currency})</span><FieldInput required inputMode="numeric" value={value} onChange={e=>setValue(e.target.value)}/></label>}
    {row.currency==='USD'&&<label className="field"><span>قیمت هر دلار در روز پرداخت (تومان)</span><FieldInput required inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value)}/></label>}
    {row.currency==='IRR'&&<p className="field-hint">هر ۱۰ ریال یک تومان است.</p>}
    <label className="field composer-account"><span>حساب پرداخت</span><FieldSelect required value={account} onChange={e=>setAccount(e.target.value)}><option value="">انتخاب حساب</option>{data.accounts.filter(a=>allowed(a,viewer)&&(a.currency??'IRT')==='IRT').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</FieldSelect></label>
    <CompactDate label="تاریخ پرداخت" value={date} onChange={setDate}/>
    <p className="field-hint">با ثبت پرداخت، موجودی حساب و وضعیت همین تعهد هم‌زمان به‌روز می‌شوند.</p>
    {error&&<ErrorNotice message={error}/>}<ComposerFooter summary={`${row.name} · ${obligationMoney(total,row.currency)} از ${data.accounts.find(a=>a.id===account)?.name??'حساب انتخاب‌شده'}`}><Action type="submit" className="primary full submit">ثبت پرداخت</Action></ComposerFooter>
  </form></Surface>;
}

import { FormField } from './components/form-fields';
import { ReportCard, Metric, Empty } from './components/report-card';
import { Action, FieldSelect, FieldInput, Surface } from './components/finance-ui';
import { useState } from 'react';
import type { FinanceData, Transaction } from './types';
import { currencies, nativeMoney, minorUnits } from './currencies';
import { checked, integer, pricePerUnit } from './decimal';
import { active, allowed } from './finance';
import { foreignSummary, recordForeign } from './foreignLedger';
import type { ForeignInput } from './foreignLedger';
import type { RateQuote } from './exchangeRates';
import { today, money, persianDate } from './utils';
import { periodKey } from './calendar';
import { DateField } from './DateField';
import { FolderSelector } from './FolderProjects';
type Props={data:FinanceData;viewer:Transaction['createdBy'];change:(next:FinanceData|((d:FinanceData)=>FinanceData))=>void};
export function ForeignExpenses(props:Props){
  const {data,viewer}=props;
  const [filter,setFilter]=useState('foreign'),[month,setMonth]=useState(''),[editing,setEditing]=useState<Transaction|undefined>(),[formKey,setFormKey]=useState(0),[message,setMessage]=useState('');
  const [formOpen,setFormOpen]=useState(false);
  const [selection,setSelection]=useState<{kind:string;label:string}|undefined>();
  const summary=foreignSummary(data,viewer,filter,month);
  const rows=summary.rows.filter(t=>!selection||(selection.kind==='ماه‌های شمسی'?periodKey(t.date):selection.kind==='خدمات و فروشگاه‌ها'?t.foreignExpense?.merchant??t.title:t.category)===selection.label);
  const group=(title:string,values:Record<string,number>)=><ReportCard title={`جمع هزینه به تفکیک ${title}`} description="برای دیدن تراکنش‌های هر گروه، روی آن بزن.">{!Object.keys(values).length&&<Empty>هنوز هزینه‌ای برای این گزارش ثبت نشده است.</Empty>}{Object.entries(values).map(([label,value])=><Action type="button" className="report-metric-button" key={label} aria-pressed={selection?.kind===title&&selection.label===label} onClick={()=>{setSelection({kind:title,label});document.getElementById('foreign-purchases')?.scrollIntoView({behavior:'smooth'});}}><Metric label={label} value={money(value)}/></Action>)}</ReportCard>;
  return <><h1>هزینه‌های ارزی</h1><p>جزئیات خرید و مبلغی را که به تومان پرداخت کرده‌ای ثبت کن.</p><div className="segment"><Action className={filter==='foreign'?'selected':''} onClick={()=>{setSelection(undefined);setFilter('foreign')}}>ارزی</Action><Action className={filter==='domestic'?'selected':''} onClick={()=>{setSelection(undefined);setFilter('domestic')}}>داخلی (تومان / ریال)</Action><Action className={filter==='all'?'selected':''} onClick={()=>{setSelection(undefined);setFilter('all')}}>همه هزینه‌ها</Action></div><FormField label="ماه شمسی"><FieldSelect value={month} onChange={e=>{setMonth(e.target.value);setSelection(undefined)}}><option value="">همه ماه‌ها</option>{[...new Set(data.transactions.filter(t=>active(t)&&allowed(t,viewer)).map(t=>periodKey(t.date)))].sort().reverse().map(m=><option key={m}>{m}</option>)}</FieldSelect></FormField><ReportCard title="خلاصه هزینه‌های انتخاب‌شده" description="مبلغ هزینه‌ها با نرخ ثبت‌شده در روز خرید، همراه کارمزد."><Metric label="مجموع مبلغ اصلی دلار" value={`${summary.usd} USD`}/><Metric label="مجموع هزینه به تومان" value={money(summary.total)}/><p className="field-hint">این هزینه‌ها در جمع عمومی نیز یک بار محاسبه می‌شوند. موجودی حساب ارزی بدون نرخ ارزش‌گذاری با تومان جمع نمی‌شود.</p></ReportCard>
  <Surface as="details" className="card module-editor" open={formOpen} onToggle={e=>setFormOpen(e.currentTarget.open)}><summary>{editing?'اصلاح تاریخی با حفظ سابقه':'ثبت خرید ارزی'}</summary><ForeignExpenseForm key={`${formKey}:${editing?.id??'new'}`} {...props} initial={editing} saved={()=>{setFormOpen(false);setEditing(undefined);setFormKey(k=>k+1);setMessage('هزینه ثبت شد و مبلغ پرداختی از حساب انتخاب‌شده کم شد.')}} cancel={()=>{setEditing(undefined);setFormKey(k=>k+1)}}/></Surface>
  {message&&<p role="status">{message}</p>}<div className="ds-grid foreign-reports">{group('ماه‌های شمسی',summary.months)}{group('خدمات و فروشگاه‌ها',summary.merchants)}{group('دسته‌بندی هزینه',summary.categories)}<ReportCard title="اشتراک‌های ارزی" description="خریدهای تکرارشونده و یادآوری پرداخت بعدی؛ یادآوری به‌تنهایی پولی از حساب کم نمی‌کند.">{!summary.subscriptions.length&&!data.recurring.some(r=>r.foreignCurrency&&!r.archived&&r.owner===viewer)&&<p>هنوز اشتراک ارزی ثبت نشده است.</p>}{summary.subscriptions.map(t=><div className="ds-budget" key={t.id}><Metric label={t.foreignExpense?.merchant??t.title} value={money(t.amount)}/><p><bdi>{t.fx?.originalAmount} {t.fx?.currency}</bdi> · {persianDate(t.date)}</p></div>)}{data.recurring.filter(r=>r.foreignCurrency&&!r.archived&&r.owner===viewer).map(r=><div className="ds-budget" key={r.id}><strong>{r.name}</strong><p>سررسید {persianDate(r.nextDate)} · برای پرداخت بعدی، نرخ روز تراکنش تازه ثبت کن.</p></div>)}</ReportCard></div>
  <ReportCard id="foreign-purchases" title="خریدهای ثبت‌شده">{selection&&<p>نمایش گروه «{selection.label}» <Action type="button" className="outline" onClick={()=>setSelection(undefined)}>نمایش همه گروه‌ها</Action></p>}{!rows.length&&<p>هنوز هزینه‌ای در این فیلتر ثبت نشده است.</p>}{rows.map(t=><article className="foreign-entry" key={t.id}><strong>{t.title}</strong><span>{persianDate(t.date)} · {t.category} · {data.accounts.find(a=>a.id===t.accountId)?.name}</span><div><bdi>{t.fx?.originalAmount??t.amount} {t.fx?.currency??'IRT'}</bdi> ← {money(t.amount)}</div>{t.foreignExpense&&<><small>برداشت: <bdi>{nativeMoney(t.foreignExpense.debitMinor,t.foreignExpense.paymentCurrency,data.currencyDefinitions)}</bdi> · کارمزد: <bdi>{nativeMoney(t.foreignExpense.feeMinor,t.foreignExpense.paymentCurrency,data.currencyDefinitions)}</bdi></small><small>منبع: {t.foreignExpense.quote.source} · {t.foreignExpense.quote.frequency} · {t.foreignExpense.quote.rateType}<br/>زمان نرخ: <bdi>{t.foreignExpense.quote.effectiveAt}</bdi><br/>دریافت: <bdi>{t.foreignExpense.quote.retrievedAt}</bdi></small>{t.foreignExpense.overrideReason&&<small>دلیل اصلاح: {t.foreignExpense.overrideReason}</small>}<Action className="outline" onClick={()=>{setFormOpen(true);setEditing(t);window.scrollTo({top:0,behavior:'smooth'})}}>اصلاح تاریخی</Action></>}{t.correctsId&&<small>جایگزین سابقه {t.correctsId}</small>}</article>)}</ReportCard>
  </>;
}
function ForeignExpenseForm({data,viewer,change,initial,saved,cancel}:Props&{initial?:Transaction;saved:()=>void;cancel:()=>void}){
  const f=initial?.foreignExpense;
  const accounts=data.accounts.filter(a=>allowed(a,viewer)&&['IRT','IRR'].includes(a.currency??'IRT'));
  const [title,setTitle]=useState(initial?.title??''),[merchant,setMerchant]=useState(f?.merchant??''),[currency,setCurrency]=useState(initial?.fx?.currency??data.settings.preferredCurrency??'USD'),[original,setOriginal]=useState(initial?.fx?.originalAmount??''),[paid,setPaid]=useState(initial?String(initial.amount+(f?.feeToman??0)):''),[date,setDate]=useState(initial?.date??today()),[account,setAccount]=useState(initial?.accountId??accounts[0]?.id??''),[category,setCategory]=useState(initial?.category??'سایر'),[folderId,setFolderId]=useState(initial?.folderId??''),[note,setNote]=useState(initial?.note??''),[error,setError]=useState(''),[requestId]=useState(()=>crypto.randomUUID());
  let rate='';try{integer(paid);if(minorUnits(original,currency,data.currencyDefinitions)>0)rate=pricePerUnit(paid,original);}catch{/* Show no rate until both amounts are valid. */}
  const currencyLabel=[...currencies,...data.currencyDefinitions??[]].find(c=>c.code===currency)?.label??currency;
  const input=(label:string,value:string,set:(s:string)=>void,required=false,numeric=false)=><FormField label={label}><FieldInput required={required} value={value} onChange={e=>set(e.target.value)} inputMode={numeric?'decimal':undefined}/></FormField>;
  return <form className="finance-form" onSubmit={e=>{e.preventDefault();setError('');try{
    if(!title.trim()||!merchant.trim())throw new Error('نام خرید و محل خرید را وارد کن.');
    if(date>today())throw new Error('تاریخ خرید نباید در آینده باشد.');
    const total=integer(paid);
    if(minorUnits(original,currency,data.currencyDefinitions)<=0||!rate)throw new Error('مبلغ خرید به ارز را بیشتر از صفر وارد کن.');
    const paymentAccount=accounts.find(a=>a.id===account);if(!paymentAccount)throw new Error('یک حساب تومانی یا ریالی برای پرداخت انتخاب کن.');
    const now=new Date().toISOString();
    const quote:RateQuote={currency,target:'IRT',rate,source:'محاسبه از مبلغ پرداختی',effectiveAt:`${date}T00:00:00+03:30`,retrievedAt:now,rateType:'manual',frequency:'نرخ واقعی خرید'};
    const input:ForeignInput={id:requestId,title,merchant,currency,original,date,quote,accountId:account,debit:String(paymentAccount.currency==='IRR'?checked(BigInt(total)*10n):total),fee:'0',paymentRate:'',category,folderId:folderId||undefined,note,override:String(total),reason:initial?'اصلاح جزئیات خرید و محاسبه نرخ از مبلغ پرداختی':'محاسبه نرخ از مبلغ پرداختی',subscription:f?.subscription??false,correctsId:initial?.id};
    recordForeign(data,input,viewer);change(d=>recordForeign(d,input,viewer));saved();
  }catch(err){setError((err as Error).message)}}}>
    <p className="field-hint">مبلغ ارزی خرید و کل مبلغی را که به تومان پرداخت کرده‌ای وارد کن؛ قیمت هر واحد ارز خودکار حساب می‌شود.</p>
    {input('چی خریدی؟',title,setTitle,true)}
    {input('از کجا خریدی؟',merchant,setMerchant,true)}
    <FormField label="با چه ارزی خریدی؟"><FieldSelect value={currency} onChange={e=>setCurrency(e.target.value)}>{[...currencies,...data.currencyDefinitions??[]].filter(c=>c.code!=='IRT').map(c=><option key={c.code} value={c.code}>{c.label} · {c.code}</option>)}</FieldSelect></FormField>
    {input(`مبلغ خرید به ${currencyLabel}`,original,setOriginal,true,true)}
    {input('مبلغ پرداختی به تومان',paid,setPaid,true,true)}
    <FormField label={`قیمت هر واحد ${currencyLabel} به تومان (خودکار)`}><FieldInput readOnly value={rate} placeholder="پس از وارد کردن مبلغ‌ها محاسبه می‌شود"/><p className="field-hint">مبلغ پرداختی به تومان ÷ مبلغ ارزی خرید. مثلاً ۶٬۰۰۰٬۰۰۰ تومان برای ۱۰۰ دلار، یعنی هر دلار ۶۰٬۰۰۰ تومان.</p></FormField>
    <DateField value={date} onChange={setDate}/>
    <FormField label="از کدام حساب پرداخت کردی؟"><FieldSelect required value={account} onChange={e=>setAccount(e.target.value)}><option value="" disabled>حساب پرداخت را انتخاب کن</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}{a.currency==='IRR'?' (ریالی)':''}</option>)}</FieldSelect><p className="field-hint">همان مبلغ پرداختی از این حساب کم می‌شود؛ برای حساب ریالی، تومان به ریال تبدیل می‌شود.</p></FormField>
    <FormField label="دسته‌بندی خرید"><FieldSelect value={category} onChange={e=>setCategory(e.target.value)}>{data.categoryRecords.filter(c=>!c.archived&&c.kind!=='income').map(c=><option key={c.id}>{c.name}</option>)}</FieldSelect></FormField>
    <FolderSelector data={data} viewer={viewer} change={change} value={folderId} onChange={setFolderId}/>
    {input('یادداشت (اختیاری)',note,setNote)}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <Action className="primary">{initial?'ذخیره تغییرات خرید':'ثبت خرید ارزی'}</Action>{initial&&<Action type="button" className="outline" onClick={cancel}>انصراف</Action>}
  </form>;
}

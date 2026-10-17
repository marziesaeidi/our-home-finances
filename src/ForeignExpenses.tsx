import { CollectionPreview } from './components/collection-preview';
import { CollectionHeading } from './components/collection-heading';
import { FlowBack } from './components/flow-navigation';
import { ComposerIntro, ComposerFooter, CompactDate } from './components/transaction-composer';
import { FormField } from './components/form-fields';
import { ReportCard, Metric, Empty } from './components/report-card';
import { Action, FieldSelect, FieldInput, Surface } from './components/finance-ui';
import { useState } from 'react';
import { Download, ChevronLeft, Plus } from 'lucide-react';
import type { FinanceData, Transaction } from './types';
import { currencies, nativeMoney, minorUnits } from './currencies';
import { checked, integer, pricePerUnit } from './decimal';
import { active, allowed, consumption } from './finance';
import { foreignSummary, recordForeign } from './foreignLedger';
import type { ForeignInput } from './foreignLedger';
import type { RateQuote } from './exchangeRates';
import { today, money, persianDate } from './utils';
import { csv } from './reporting';
import { Dialog } from './Dialog';
import { periodKey } from './calendar';
import { FolderSelector } from './FolderProjects';
import { ComposerAccountForm } from './components/composer-account-form';
type Props={data:FinanceData;viewer:Transaction['createdBy'];change:(next:FinanceData|((d:FinanceData)=>FinanceData))=>void};
export function ForeignExpenses(props:Props){
  const [formKey,setFormKey]=useState(0),[message,setMessage]=useState('');
  return <><div className="page-head"><div><h1>ثبت خرید ارزی</h1><p>جزئیات خرید و مبلغ پرداختی را وارد کن.</p></div></div>
    <Surface as="section" className="card add-form-card transaction-composer composer-foreign"><ComposerIntro kind="foreign"/><ForeignExpenseForm key={formKey} {...props} saved={()=>{setFormKey(k=>k+1);setMessage('خرید ارزی ثبت شد و مبلغ پرداختی از حساب کم شد.')}} cancel={()=>{}}/>{message&&<p role="status">{message}</p>}</Surface>
  </>;
}
export function ForeignExpenseReports(props:Props){
  const {data,viewer}=props;
  const [filter,setFilter]=useState('foreign'),[month,setMonth]=useState(''),[formKey,setFormKey]=useState(0),[message,setMessage]=useState('');
  const [formOpen,setFormOpen]=useState(false);
  const [exportOpen,setExportOpen]=useState(false);
  const [selectedId,setSelectedId]=useState('');
  const [selection,setSelection]=useState<{kind:string;label:string}|undefined>();
  const summary=foreignSummary(data,viewer,filter,month);
  const rows=summary.rows.filter(t=>!selection||(selection.kind==='ماه‌های شمسی'?periodKey(t.date):selection.kind==='خدمات و فروشگاه‌ها'?t.foreignExpense?.merchant??t.title:t.category)===selection.label);
  const group=(title:string,values:Record<string,number>)=><ReportCard title={`جمع هزینه به تفکیک ${title}`} description="برای دیدن تراکنش‌های هر گروه، روی آن بزن.">{!Object.keys(values).length&&<Empty>هنوز هزینه‌ای برای این گزارش ثبت نشده است.</Empty>}{Object.entries(values).map(([label,value])=><Action type="button" className="report-metric-button" key={label} aria-pressed={selection?.kind===title&&selection.label===label} onClick={()=>{setSelection({kind:title,label});document.getElementById('foreign-purchases')?.scrollIntoView({behavior:'smooth'});}}><Metric label={label} value={money(value)}/></Action>)}</ReportCard>;
  const exportRows:(string|number)[][]=[['عنوان','تاریخ خرید','فروشگاه / خدمت','دسته‌بندی','حساب پرداخت','ارز اصلی','مبلغ اصلی','هزینه با کارمزد (تومان)'],...rows.map(t=>[t.title,persianDate(t.date),t.foreignExpense?.merchant??t.title,t.category,data.accounts.find(a=>a.id===t.accountId)?.name??'نامشخص',t.fx?.currency??'IRT',t.fx?.originalAmount??t.amount,consumption(t)])];
  const downloadTable=()=>{const url=URL.createObjectURL(new Blob([csv(exportRows)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='گزارش خریدهای ارزی.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const selected=summary.rows.find(t=>t.id===selectedId);
  if(selected)return <><FlowBack label="بازگشت به خریدهای ثبت‌شده" onBack={()=>{setSelectedId('')}}/><Surface as="section" className="card module-card collection-card"><CollectionHeading kind="account" description={selected.foreignExpense?.merchant??selected.category}>{selected.title}</CollectionHeading><p className="collection-balance">{money(selected.amount)}</p>{[
    ['تاریخ خرید',persianDate(selected.date)],['حساب پرداخت',data.accounts.find(a=>a.id===selected.accountId)?.name??'نامشخص'],['دسته‌بندی',selected.category],['مبلغ اصلی',`${selected.fx?.originalAmount??selected.amount} ${selected.fx?.currency??'IRT'}`],['پوشه',data.folders.find(f=>f.id===selected.folderId)?.name??'بدون پوشه'],['یادداشت',selected.note||'—']
  ].map(([label,value])=><div className="detail-row" key={label}><span>{label}</span><strong><bdi>{value}</bdi></strong></div>)}{selected.foreignExpense&&<><div className="detail-row"><span>برداشت از حساب</span><strong>{nativeMoney(selected.foreignExpense.debitMinor,selected.foreignExpense.paymentCurrency,data.currencyDefinitions)}</strong></div><div className="detail-row"><span>کارمزد</span><strong>{nativeMoney(selected.foreignExpense.feeMinor,selected.foreignExpense.paymentCurrency,data.currencyDefinitions)}</strong></div><details className="planning-options"><summary>نرخ و جزئیات ثبت</summary><p>منبع: {selected.foreignExpense.quote.source} · {selected.foreignExpense.quote.frequency} · {selected.foreignExpense.quote.rateType}</p><p>زمان نرخ: <bdi>{selected.foreignExpense.quote.effectiveAt}</bdi></p><p>دریافت: <bdi>{selected.foreignExpense.quote.retrievedAt}</bdi></p>{selected.foreignExpense.overrideReason&&<p>دلیل اصلاح: {selected.foreignExpense.overrideReason}</p>}</details><Surface as="details" className="card module-editor" open={formOpen} onToggle={e=>setFormOpen(e.currentTarget.open)}><summary>اصلاح تاریخی با حفظ سابقه</summary><ForeignExpenseForm key={`${formKey}:${selected.id}`} {...props} initial={selected} saved={()=>{setSelectedId('');setFormOpen(false);setFormKey(k=>k+1);setMessage('خرید اصلاح شد و سابقه قبلی حفظ شد.')}} cancel={()=>setFormOpen(false)}/></Surface></>}{selected.correctsId&&<p className="field-hint">جایگزین سابقه {selected.correctsId}</p>}</Surface></>;
  return <div className="foreign-report-page"><div className="page-head"><div><h1>گزارش خریدهای ارزی</h1><p>خریدهای قبلی، جمع هزینه‌ها و اشتراک‌های ارزی را بررسی کن.</p></div><Action className="outline" onClick={()=>setExportOpen(true)}><Download size={18}/> خروجی جدول و PDF</Action></div>{exportOpen&&<Dialog title="خروجی گزارش خریدهای ارزی" onClose={()=>setExportOpen(false)}><p>خروجی شامل خریدهای همین فیلتر و گروه انتخاب‌شده است.</p><div className="detail-actions"><Action className="outline" onClick={downloadTable}>دریافت جدول CSV</Action><Action className="primary" onClick={()=>{setExportOpen(false);requestAnimationFrame(()=>window.print())}}>چاپ / ذخیره PDF</Action></div></Dialog>}<Surface as="section" className="card module-card collection-card"><div className="ds-grid" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:16}}><FormField label="ماه شمسی"><FieldSelect value={month} onChange={e=>{setMonth(e.target.value);setSelection(undefined)}}><option value="">همه ماه‌ها</option>{[...new Set(data.transactions.filter(t=>active(t)&&allowed(t,viewer)).map(t=>periodKey(t.date)))].sort().reverse().map(m=><option key={m}>{m}</option>)}</FieldSelect></FormField><FormField label="نوع ارز"><FieldSelect value={filter} onChange={e=>{setFilter(e.target.value);setSelection(undefined)}}><option value="foreign">ارزی</option><option value="domestic">داخلی (تومان / ریال)</option><option value="all">همه هزینه‌ها</option></FieldSelect></FormField></div></Surface><ReportCard title="خلاصه هزینه‌های انتخاب‌شده" description="مبلغ هزینه‌ها با نرخ ثبت‌شده در روز خرید، همراه کارمزد."><Metric label="مجموع مبلغ اصلی دلار" value={`${summary.usd} USD`}/><Metric label="مجموع هزینه به تومان" value={money(summary.total)}/><p className="field-hint">این هزینه‌ها در جمع عمومی نیز یک بار محاسبه می‌شوند. موجودی حساب ارزی بدون نرخ ارزش‌گذاری با تومان جمع نمی‌شود.</p></ReportCard>
  <section id="foreign-purchases" className="foreign-purchases"><CollectionHeading kind="report">خریدهای ثبت‌شده</CollectionHeading>{selection&&<p>نمایش گروه «{selection.label}» <Action type="button" className="outline" onClick={()=>setSelection(undefined)}>نمایش همه گروه‌ها</Action></p>}{!rows.length&&<p>هنوز هزینه‌ای در این فیلتر ثبت نشده است.</p>}<div className="loan-cards">{rows.map(t=><CollectionPreview key={t.id} kind="account" name={t.title} amount={<>{money(t.amount)}{t.foreignExpense&&<> · برداشت: {nativeMoney(t.foreignExpense.debitMinor,t.foreignExpense.paymentCurrency,data.currencyDefinitions)}</>}</>} footer={<><span>{t.fx?.currency??'IRT'} · {t.category}</span><span>{persianDate(t.date)}</span></>} onClick={()=>{setSelectedId(t.id);window.scrollTo({top:0,behavior:'smooth'})}}/>)}</div></section>
  <section className="foreign-export-table"><h2>جدول خریدهای انتخاب‌شده</h2><p>{month||'همه ماه‌ها'} · {selection?.label??'همه گروه‌ها'} · {rows.length.toLocaleString('fa-IR')} خرید</p><table><thead><tr>{exportRows[0].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{exportRows.slice(1).map((row,i)=><tr key={rows[i].id}>{row.map((value,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table>{!rows.length&&<p>خریدی در این فیلتر وجود ندارد.</p>}</section>
  {message&&<p role="status">{message}</p>}<div className="ds-grid foreign-reports">{group('ماه‌های شمسی',summary.months)}{group('خدمات و فروشگاه‌ها',summary.merchants)}{group('دسته‌بندی هزینه',summary.categories)}<ReportCard title="اشتراک‌های ارزی" description="خریدهای تکرارشونده و یادآوری پرداخت بعدی؛ یادآوری به‌تنهایی پولی از حساب کم نمی‌کند.">{!summary.subscriptions.length&&!data.recurring.some(r=>r.foreignCurrency&&!r.archived&&r.owner===viewer)&&<p>هنوز اشتراک ارزی ثبت نشده است.</p>}{summary.subscriptions.map(t=><div className="ds-budget" key={t.id}><Metric label={t.foreignExpense?.merchant??t.title} value={money(t.amount)}/><p><bdi>{t.fx?.originalAmount} {t.fx?.currency}</bdi> · {persianDate(t.date)}</p></div>)}{data.recurring.filter(r=>r.foreignCurrency&&!r.archived&&r.owner===viewer).map(r=><div className="ds-budget" key={r.id}><strong>{r.name}</strong><p>سررسید {persianDate(r.nextDate)} · برای پرداخت بعدی، نرخ روز تراکنش تازه ثبت کن.</p></div>)}</ReportCard></div>

  </div>;
}
function ForeignExpenseForm({data,viewer,change,initial,saved,cancel}:Props&{initial?:Transaction;saved:()=>void;cancel:()=>void}){
  const f=initial?.foreignExpense;
  const [more,setMore]=useState(false);
  const [creatingAccount,setCreatingAccount]=useState(false);
  const accounts=data.accounts.filter(a=>allowed(a,viewer)&&['IRT','IRR'].includes(a.currency??'IRT'));
  const [title,setTitle]=useState(initial?.title??''),[merchant,setMerchant]=useState(f?.merchant??''),[currency,setCurrency]=useState(initial?.fx?.currency??data.settings.preferredCurrency??'USD'),[original,setOriginal]=useState(initial?.fx?.originalAmount??''),[paid,setPaid]=useState(initial?String(initial.amount+(f?.feeToman??0)):''),[date,setDate]=useState(initial?.date??today()),[account,setAccount]=useState(initial?.accountId??accounts[0]?.id??''),[category]=useState(initial?.category??'سایر'),[folderId,setFolderId]=useState(initial?.folderId??''),[note,setNote]=useState(initial?.note??''),[error,setError]=useState(''),[requestId]=useState(()=>crypto.randomUUID());
  let rate='';try{integer(paid);if(minorUnits(original,currency,data.currencyDefinitions)>0)rate=pricePerUnit(paid,original);}catch{/* Show no rate until both amounts are valid. */}
  const currencyLabel=[...currencies,...data.currencyDefinitions??[]].find(c=>c.code===currency)?.label??currency;
  const input=(label:string,value:string,set:(s:string)=>void,required=false,numeric=false)=><FormField label={label}><FieldInput required={required} value={value} onChange={e=>set(e.target.value)} inputMode={numeric?'decimal':undefined}/></FormField>;
  if(creatingAccount)return <ComposerAccountForm viewer={viewer} onCancel={()=>setCreatingAccount(false)} onSave={newAccount=>{change(d=>({...d,accounts:[newAccount,...d.accounts]}));setAccount(newAccount.id);setCreatingAccount(false)}}/>;
  return <form className="finance-form foreign-composer-form" onSubmit={e=>{e.preventDefault();setError('');try{
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

    {input('چی خریدی؟',title,setTitle,true)}
    {input('از کجا خریدی؟',merchant,setMerchant,true)}
    <FormField className="composer-account" label="ارز خرید"><FieldSelect value={currency} onChange={e=>setCurrency(e.target.value)}>{[...currencies,...data.currencyDefinitions??[]].filter(c=>c.code!=='IRT').map(c=><option key={c.code} value={c.code}>{c.label} · {c.code}</option>)}</FieldSelect></FormField>
    <div className="composer-fx-pair">{input(`مبلغ خرید به ${currencyLabel}`,original,setOriginal,true,true)}
    {input('مبلغ پرداختی به تومان',paid,setPaid,true,true)}</div>
    <div className="composer-rate"><FormField label={`قیمت هر واحد ${currencyLabel} به تومان (خودکار)`}><FieldInput readOnly value={rate} placeholder="پس از وارد کردن مبلغ‌ها محاسبه می‌شود"/><p className="field-hint">مبلغ پرداختی به تومان ÷ مبلغ ارزی خرید. مثلاً ۶٬۰۰۰٬۰۰۰ تومان برای ۱۰۰ دلار، یعنی هر دلار ۶۰٬۰۰۰ تومان.</p></FormField></div>
    <CompactDate value={date} onChange={setDate}/>
    <FormField className="composer-account" label="حساب پرداخت"><FieldSelect required value={account} onChange={e=>setAccount(e.target.value)}><option value="" disabled>حساب پرداخت را انتخاب کن</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}{a.currency==='IRR'?' (ریالی)':''}</option>)}</FieldSelect><p className="field-hint">همان مبلغ پرداختی از این حساب کم می‌شود؛ برای حساب ریالی، تومان به ریال تبدیل می‌شود.</p></FormField>
    <Action type="button" className="outline small" onClick={()=>setCreatingAccount(true)}><Plus size={16}/> افزودن حساب</Action>
    <Action type="button" className="more-toggle" aria-expanded={more} onClick={()=>setMore(!more)}>افزودن جزئیات <ChevronLeft size={16} className={more?'rotated':''}/></Action>
    {more&&<><FolderSelector hideSearch data={data} viewer={viewer} change={change} value={folderId} onChange={setFolderId}/>{input('یادداشت (اختیاری)',note,setNote)}</>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <ComposerFooter summary={rate?`${original} ${currency} · ${money(integer(paid))} از ${accounts.find(a=>a.id===account)?.name??'حساب انتخاب‌شده'}`:'مبلغ ارزی و پرداخت تومانی را وارد کن'}><Action className="primary full submit">{initial?'ذخیره تغییرات خرید':'ثبت خرید ارزی'}</Action></ComposerFooter>{initial&&<Action type="button" className="outline" onClick={cancel}>انصراف</Action>}
  </form>;
}

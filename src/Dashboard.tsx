import { Amount, Empty, Metric, ReportCard } from './components/report-card';
import { useState } from 'react';
import { CalendarDays, Wallet, TrendingUp, Receipt, TriangleAlert, LayoutDashboard } from 'lucide-react';
import type { FinanceData } from './types';
import { report, dateRange, budgetUsage } from './reporting';
import { periodKey } from './calendar';
import { money, fa, persianDate, today } from './utils';
import { nativeMoney } from './currencies';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DirectionProvider } from '@/components/ui/direction';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';

type Props = { data: FinanceData; viewer: string; change: (data: FinanceData) => void };
const sections = ['balances','monthly','budgets','overdue','due','recent'];
const labels: Record<string,string> = { balances:'مانده حساب‌ها',monthly:'درآمد و هزینه این ماه',budgets:'بودجه ماه',due:'پرداخت‌های پیش رو',overdue:'پرداخت‌های عقب‌افتاده',recent:'تراکنش‌های اخیر' };

export function DashboardSkeleton() { return <div className="ds-dashboard" role="status" aria-label="در حال بارگذاری داشبورد"><Skeleton className="h-10 w-48"/><div className="ds-grid">{sections.slice(0,4).map(id=><Skeleton key={id} className="h-48 w-full rounded-xl"/>)}</div></div>; }

export function UnifiedDashboard({ data, viewer }: Props) {
 const [activePanel, setActivePanel] = useState<'calendar' | null>(null);
 const calendarOpen = activePanel === 'calendar';
 const [date, setDate] = useState<Date | undefined>(new Date(today()+'T12:00:00'));
 const r = report(data,viewer,dateRange('current',today()),today());
 const order = sections;
 const due = report(data,viewer,{start:'1900-01-01',end:new Date(Date.parse(today()+'T12:00:00Z')+366*86400000).toISOString().slice(0,10)},today()).due;
 const calendarDue = due.filter(o=>o.kind==='installment');
 const recent = report(data,viewer,{start:'1300-01-01',end:today()},today()).transactions.slice(0,5);
 const currencyMoney = (n:number,c:string) => c==='IRT'?money(n):nativeMoney(n,c,data.currencyDefinitions).replace(/\d/g,ch=>'۰۱۲۳۴۵۶۷۸۹'[Number(ch)]);
 const selectedDay = date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` : today();
 const budget = data.monthlyBudgets[periodKey(today())];
 const budgetRows: [string,number,number][] = budget ? [['کل ماه',budget.total,r.expense],...Object.entries(budget.categories).map(([name,limit])=>[name,limit,r.categories.find(([n])=>n===name)?.[1]??0] as [string,number,number]),...Object.entries(budget.folders??{}).map(([id,limit])=>[data.folders.find(f=>f.id===id)?.name??id,limit,r.folderIds.find(([n])=>n===id)?.[1]??0] as [string,number,number])] : [];
 const paymentTable = (items: typeof due) => items.length ? <Table><TableHeader><TableRow><TableHead>عنوان</TableHead><TableHead>نوع</TableHead><TableHead>سررسید</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader><TableBody>{items.map(o=><TableRow key={o.kind+o.id}><TableCell>{o.name}</TableCell><TableCell>{o.direction==='pay'?'پرداخت':'دریافت'}</TableCell><TableCell>{persianDate(o.date)}</TableCell><TableCell><Amount>{currencyMoney(o.amount,o.currency)}</Amount></TableCell></TableRow>)}</TableBody></Table> : <Empty>پرداخت یا دریافتی برای نمایش وجود ندارد.</Empty>;
 return <DirectionProvider dir="rtl"><TooltipProvider><div className="ds-dashboard" lang="fa-IR" dir="rtl">
  <header className="ds-header"><div><h1>داشبورد مالی</h1><p>وضعیت ماه شمسی جاری · {persianDate(today())}</p></div></header>
  <div className="ds-toolbar"><Button variant={activePanel===null?'default':'outline'} aria-pressed={activePanel===null} onClick={()=>setActivePanel(null)}><LayoutDashboard/>نمای کلی</Button><Button variant={calendarOpen?'default':'outline'} aria-pressed={calendarOpen} aria-expanded={calendarOpen} aria-controls="dashboard-calendar" onClick={()=>setActivePanel('calendar')}><CalendarDays/>تقویم تعهدات</Button></div>
  {calendarOpen&&<Card id="dashboard-calendar" className="ds-inline-panel"><CardHeader><CardTitle>تقویم تعهدات</CardTitle><CardDescription>روزهای رنگی، سررسید پرداخت یا دریافت اقساط وام دارند. برای دیدن جزئیات، یک روز را انتخاب کن.</CardDescription></CardHeader><CardContent><Tabs defaultValue="calendar" dir="rtl"><TabsList className="ds-calendar-tabs"><TabsTrigger value="calendar">تقویم شمسی</TabsTrigger><TabsTrigger value="list">همه تعهدات وام و قسط</TabsTrigger></TabsList><TabsContent value="calendar"><Calendar mode="single" required dir="rtl" selected={date} onSelect={setDate} defaultMonth={date} modifiers={{payment:calendarDue.filter(o=>o.direction==='pay').map(o=>new Date(o.date+'T12:00:00')),receipt:calendarDue.filter(o=>o.direction==='receive').map(o=>new Date(o.date+'T12:00:00'))}} modifiersClassNames={{payment:'ds-day-payment',receipt:'ds-day-receipt'}}/><div className="ds-calendar-legend"><span className="ds-legend-payment">پرداخت</span><span className="ds-legend-receipt">دریافت</span><span className="ds-legend-both">پرداخت و دریافت</span></div><div aria-live="polite" className="ds-day-details"><h3>تعهدات وام و قسط {persianDate(selectedDay)}</h3>{paymentTable(calendarDue.filter(o=>o.date===selectedDay))}</div></TabsContent><TabsContent value="list">{paymentTable(calendarDue)}</TabsContent></Tabs></CardContent></Card>}

  <div className="ds-grid" hidden={activePanel!==null}>{order.map(id=><ReportCard key={id} className={`ds-${id} ${id==='overdue'&&due.some(o=>o.direction==='pay'&&o.date<today())?'ds-has-overdue':''}`} icon={null} title={<>{id==='balances'?<Wallet/>:id==='monthly'?<TrendingUp/>:id==='overdue'?<TriangleAlert/>:<Receipt/>}{labels[id]}{id==='overdue'&&<Badge variant="destructive">{fa(due.filter(o=>o.direction==='pay'&&o.date<today()).length)}</Badge>}</>} description={id==='balances'?'موجودی فعلی حساب‌ها به تفکیک واحد پول.':undefined}>
  {id==='balances'&&<>{r.balances.map(([c,n])=><Metric key={c} label={c==='IRT'?'':c} value={currencyMoney(n,c)}/>)}{!r.balances.length&&<Empty>حسابی برای نمایش وجود ندارد.</Empty>}</>}
  {id==='monthly'&&<><Metric label="درآمد" value={money(r.income)} tone="ds-success"/><Metric label="هزینه‌های روزمره" value={money(r.expense)} tone="ds-destructive"/></>}
  {id==='budgets'&&<>{!budget&&<Empty>بودجه‌ای برای این ماه تنظیم نشده.</Empty>}{budgetRows.map(([name,limit,spent])=>{const u=budgetUsage(limit,spent,budget?.warningThreshold,budget?.exceededThreshold);return <div className={`ds-budget ds-${u.state}`} key={name}><div className="ds-between"><strong>{name}</strong><Badge variant={u.state==='exceeded'?'destructive':'secondary'}>{fa(u.percentage)}٪</Badge></div><p><Amount>{money(spent)}</Amount> از <Amount>{money(limit)}</Amount></p><Progress aria-label={name} value={Math.max(0,Math.min(100,limit?spent/limit*100:0))}/><p>{u.remaining<0?'بیشتر از بودجه':'باقی‌مانده'}: <Amount>{money(Math.abs(u.remaining))}</Amount></p>{u.state==='warning'&&<p role="status">نزدیک سقف بودجه</p>}{u.state==='exceeded'&&<p role="alert">هزینه از سقف بودجه گذشته است</p>}{u.state==='unset'&&<small>سقف تنظیم نشده</small>}</div>;})}</>}
  {(id==='due'||id==='overdue')&&paymentTable(due.filter(o=>o.direction==='pay'&&(id==='overdue'?o.date<today():o.date>=today())).slice(0,5))}
  {id==='recent'&&<>{recent.length?<Table><TableHeader><TableRow><TableHead>تراکنش</TableHead><TableHead>تاریخ</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader><TableBody>{recent.map(t=><TableRow key={t.id}><TableCell>{t.title}</TableCell><TableCell>{persianDate(t.date)}</TableCell><TableCell><Amount>{money(t.amount)}</Amount></TableCell></TableRow>)}</TableBody></Table>:<Empty>اولین تراکنش خود را ثبت کن.</Empty>}</>}
  </ReportCard>)}</div>

 </div></TooltipProvider></DirectionProvider>;
}

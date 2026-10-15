import { useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, CalendarDays, Settings2, Wallet, TrendingUp, Receipt, PiggyBank, LayoutDashboard } from 'lucide-react';
import type { FinanceData } from './types';
import { report, dateRange, budgetUsage } from './reporting';
import { periodKey } from './calendar';
import { money, fa, persianDate, today } from './utils';
import { nativeMoney } from './currencies';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { DirectionProvider } from '@/components/ui/direction';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';

type Props = { data: FinanceData; viewer: string; change: (data: FinanceData) => void };
const sections = ['balances','monthly','budgets','goals','due','overdue','foreign','categories','recent'];
const labels: Record<string,string> = { balances:'مانده حساب‌ها',monthly:'درآمد و هزینه این ماه',budgets:'بودجه ماه',goals:'پیشرفت هدف‌ها',due:'پرداخت‌های پیش رو',overdue:'پرداخت‌های عقب‌افتاده',foreign:'هزینه خریدهای ارزی (به تومان)',categories:'دسته‌های پرهزینه',recent:'تراکنش‌های اخیر' };

function Amount({ children }: { children: ReactNode }) { return <bdi className="ds-amount">{children}</bdi>; }
function Empty({ children }: { children: ReactNode }) { return <p className="ds-empty">{children}</p>; }
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className="ds-metric"><span>{label}</span><Amount><span className={tone}>{value}</span></Amount></div>; }
export function DashboardSkeleton() { return <div className="ds-dashboard" role="status" aria-label="در حال بارگذاری داشبورد"><Skeleton className="h-10 w-48"/><div className="ds-grid">{sections.slice(0,4).map(id=><Skeleton key={id} className="h-48 w-full rounded-xl"/>)}</div></div>; }

export function UnifiedDashboard({ data, viewer, change }: Props) {
 const [activePanel, setActivePanel] = useState<'settings' | 'calendar' | null>(null);
 const customize = activePanel === 'settings', calendarOpen = activePanel === 'calendar';
 const [query, setQuery] = useState(''), [visibility, setVisibility] = useState('all');
 const [date, setDate] = useState<Date | undefined>(new Date(today()+'T12:00:00'));
 const r = report(data,viewer,dateRange('current',today()),today());
 const preferences = data.settings.dashboard?.[viewer] ?? { order:sections, hidden:[] };
 const order = [...preferences.order,...sections.filter(id=>!preferences.order.includes(id))];
 const update = (nextOrder: string[], hidden: string[]) => change({...data,settings:{...data.settings,dashboard:{...data.settings.dashboard,[viewer]:{order:nextOrder,hidden}}}});
 const move = (id: string, direction: number) => { const index=order.indexOf(id), next=[...order]; if(index+direction<0||index+direction>=order.length)return; [next[index],next[index+direction]]=[next[index+direction],next[index]];update(next,preferences.hidden); };
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
  <div className="ds-toolbar"><Button variant={activePanel===null?'default':'outline'} aria-pressed={activePanel===null} onClick={()=>setActivePanel(null)}><LayoutDashboard/>نمای پیش‌فرض</Button><Button variant={customize?'default':'outline'} aria-pressed={customize} aria-expanded={customize} aria-controls="dashboard-settings" onClick={()=>setActivePanel('settings')}><Settings2/>تنظیم داشبورد</Button><Button variant={calendarOpen?'default':'outline'} aria-pressed={calendarOpen} aria-expanded={calendarOpen} aria-controls="dashboard-calendar" onClick={()=>setActivePanel('calendar')}><CalendarDays/>تقویم تعهدات</Button></div>
  {customize&&<Card id="dashboard-settings" className="ds-inline-panel"><CardHeader><CardTitle>تنظیم کارت‌های داشبورد</CardTitle><CardDescription>کارت‌های دلخواهت را انتخاب کن و ترتیب نمایش آن‌ها را تغییر بده. تنظیمات برای {viewer} ذخیره می‌شود.</CardDescription></CardHeader><CardContent><Input aria-label="جستجوی کارت" placeholder="جستجوی کارت…" value={query} onChange={e=>setQuery(e.target.value)}/><Select value={visibility} onValueChange={setVisibility} dir="rtl"><SelectTrigger aria-label="فیلتر نمایش کارت‌ها"><SelectValue/></SelectTrigger><SelectContent className="ds-portal" dir="rtl"><SelectItem value="all">همه کارت‌ها</SelectItem><SelectItem value="visible">نمایان</SelectItem><SelectItem value="hidden">مخفی</SelectItem></SelectContent></Select><SidebarProvider className="ds-settings-sidebar"><Sidebar side="right" collapsible="none" className="w-full"><SidebarContent><SidebarGroup><SidebarGroupLabel>کارت‌های مالی</SidebarGroupLabel><SidebarMenu>{order.filter(id=>sections.includes(id)&&labels[id].includes(query)&&(visibility==='all'||(visibility==='hidden')===preferences.hidden.includes(id))).map(id=><SidebarMenuItem key={id} className="ds-setting-row"><label><input type="checkbox" checked={!preferences.hidden.includes(id)} onChange={e=>update(order,e.target.checked?preferences.hidden.filter(x=>x!==id):[...preferences.hidden,id])}/>{labels[id]}</label><div>{[-1,1].map(direction=><Tooltip key={direction}><TooltipTrigger asChild><Button variant="ghost" size="icon" disabled={direction===-1?order.indexOf(id)===0:order.indexOf(id)===order.length-1} aria-label={`${direction===-1?'بالا بردن':'پایین بردن'} ${labels[id]}`} onClick={()=>move(id,direction)}>{direction===-1?<ArrowUp/>:<ArrowDown/>}</Button></TooltipTrigger><TooltipContent className="ds-portal" dir="rtl">{direction===-1?'بالا بردن':'پایین بردن'}</TooltipContent></Tooltip>)}</div></SidebarMenuItem>)}</SidebarMenu></SidebarGroup></SidebarContent></Sidebar></SidebarProvider></CardContent></Card>}
  {calendarOpen&&<Card id="dashboard-calendar" className="ds-inline-panel"><CardHeader><CardTitle>تقویم تعهدات</CardTitle><CardDescription>روزهای رنگی، سررسید پرداخت یا دریافت اقساط وام دارند. برای دیدن جزئیات، یک روز را انتخاب کن.</CardDescription></CardHeader><CardContent><Tabs defaultValue="calendar" dir="rtl"><TabsList><TabsTrigger value="calendar">تقویم شمسی</TabsTrigger><TabsTrigger value="list">همه تعهدات وام و قسط</TabsTrigger></TabsList><TabsContent value="calendar"><Calendar mode="single" required dir="rtl" selected={date} onSelect={setDate} defaultMonth={date} modifiers={{payment:calendarDue.filter(o=>o.direction==='pay').map(o=>new Date(o.date+'T12:00:00')),receipt:calendarDue.filter(o=>o.direction==='receive').map(o=>new Date(o.date+'T12:00:00'))}} modifiersClassNames={{payment:'ds-day-payment',receipt:'ds-day-receipt'}}/><div className="ds-calendar-legend"><span className="ds-legend-payment">پرداخت</span><span className="ds-legend-receipt">دریافت</span><span className="ds-legend-both">پرداخت و دریافت</span></div><div aria-live="polite" className="ds-day-details"><h3>تعهدات وام و قسط {persianDate(selectedDay)}</h3>{paymentTable(calendarDue.filter(o=>o.date===selectedDay))}</div></TabsContent><TabsContent value="list">{paymentTable(calendarDue)}</TabsContent></Tabs></CardContent></Card>}

  <div className="ds-grid" hidden={activePanel!==null}>{order.filter(id=>sections.includes(id)&&!preferences.hidden.includes(id)).map(id=><Card key={id} className={`ds-card ds-${id}`}><CardHeader><CardTitle className="ds-title">{id==='balances'?<Wallet/>:id==='monthly'?<TrendingUp/>:id==='goals'?<PiggyBank/>:<Receipt/>}{labels[id]}{id==='overdue'&&<Badge variant="destructive">{fa(due.filter(o=>o.direction==='pay'&&o.date<today()).length)}</Badge>}</CardTitle>{id==='balances'&&<CardDescription>موجودی فعلی حساب‌ها به تفکیک واحد پول.</CardDescription>}</CardHeader><CardContent>
  {id==='balances'&&<>{r.balances.map(([c,n])=><Metric key={c} label={c} value={currencyMoney(n,c)}/>)}{!r.balances.length&&<Empty>حسابی برای نمایش وجود ندارد.</Empty>}</>}
  {id==='monthly'&&<><Metric label="درآمد" value={money(r.income)} tone="ds-success"/><Metric label="هزینه‌های روزمره" value={money(r.expense)} tone="ds-destructive"/>{r.cash.map(([c,n])=><Metric key={c} label="اختلاف واریز و برداشت" value={currencyMoney(n,c)}/>)}<Metric label="مبلغ خالص افزوده‌شده به پس‌انداز" value={money(r.saving)}/></>}
  {id==='budgets'&&<>{!budget&&<Empty>بودجه‌ای برای این ماه تنظیم نشده.</Empty>}{budgetRows.map(([name,limit,spent])=>{const u=budgetUsage(limit,spent,budget?.warningThreshold,budget?.exceededThreshold);return <div className={`ds-budget ds-${u.state}`} key={name}><div className="ds-between"><strong>{name}</strong><Badge variant={u.state==='exceeded'?'destructive':'secondary'}>{fa(u.percentage)}٪</Badge></div><p><Amount>{money(spent)}</Amount> از <Amount>{money(limit)}</Amount></p><Progress aria-label={name} value={Math.max(0,Math.min(100,limit?spent/limit*100:0))}/><p>{u.remaining<0?'بیشتر از بودجه':'باقی‌مانده'}: <Amount>{money(Math.abs(u.remaining))}</Amount></p>{u.state==='warning'&&<p role="status">نزدیک سقف بودجه</p>}{u.state==='exceeded'&&<p role="alert">هزینه از سقف بودجه گذشته است</p>}{u.state==='unset'&&<small>سقف تنظیم نشده</small>}</div>;})}</>}
  {id==='goals'&&<>{r.goals.map(g=><div className="ds-budget" key={g.id}><strong>{g.name}</strong><p><Amount>{money(g.saved)}</Amount> از <Amount>{money(g.target)}</Amount></p><Progress aria-label={g.name} value={Math.max(0,Math.min(100,g.saved/(g.target||1)*100))}/></div>)}{!r.goals.length&&<Empty>هدف پس‌اندازی ثبت نشده.</Empty>}</>}
  {(id==='due'||id==='overdue')&&paymentTable(due.filter(o=>o.direction==='pay'&&(id==='overdue'?o.date<today():o.date>=today())).slice(0,5))}
  {(id==='foreign'||id==='categories')&&<>{(id==='foreign'?r.foreign:r.categories.slice(0,4)).map(([n,v])=><Metric key={n} label={n} value={money(v)}/>)}{!(id==='foreign'?r.foreign:r.categories).length&&<Empty>هزینه‌ای ثبت نشده.</Empty>}</>}
  {id==='recent'&&<>{recent.length?<Table><TableHeader><TableRow><TableHead>تراکنش</TableHead><TableHead>تاریخ</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader><TableBody>{recent.map(t=><TableRow key={t.id}><TableCell>{t.title}</TableCell><TableCell>{persianDate(t.date)}</TableCell><TableCell><Amount>{money(t.amount)}</Amount></TableCell></TableRow>)}</TableBody></Table>:<Empty>اولین تراکنش خود را ثبت کن.</Empty>}</>}
  </CardContent></Card>)}</div>

 </div></TooltipProvider></DirectionProvider>;
}

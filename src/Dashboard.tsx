import { useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, CalendarDays, Settings2, MoreHorizontal, Wallet, TrendingUp, Receipt, PiggyBank } from 'lucide-react';
import type { FinanceData } from './types';
import { report, dateRange, budgetUsage } from './reporting';
import { periodKey } from './calendar';
import { money, fa, persianDate, today } from './utils';
import { nativeMoney } from './currencies';
import { FinancialDefinitions } from './BudgetReporting';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { DirectionProvider } from '@/components/ui/direction';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';

type Props = { data: FinanceData; viewer: string; change: (data: FinanceData) => void };
const sections = ['balances','monthly','budgets','goals','due','overdue','foreign','categories','recent'];
const labels: Record<string,string> = { balances:'مانده حساب‌ها',monthly:'خلاصه ماه',budgets:'بودجه ماه',goals:'پیشرفت هدف‌ها',due:'پرداخت‌های پیش رو',overdue:'پرداخت‌های عقب‌افتاده',foreign:'هزینه ارزی',categories:'دسته‌های پرهزینه',recent:'تراکنش‌های اخیر' };

function Amount({ children }: { children: ReactNode }) { return <bdi className="ds-amount">{children}</bdi>; }
function Empty({ children }: { children: ReactNode }) { return <p className="ds-empty">{children}</p>; }
function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className="ds-metric"><span>{label}</span><Amount><span className={tone}>{value}</span></Amount></div>; }
export function DashboardSkeleton() { return <div className="ds-dashboard" role="status" aria-label="در حال بارگذاری داشبورد"><Skeleton className="h-10 w-48"/><div className="ds-grid">{sections.slice(0,4).map(id=><Skeleton key={id} className="h-48 w-full rounded-xl"/>)}</div></div>; }

export function UnifiedDashboard({ data, viewer, change }: Props) {
 const [customize, setCustomize] = useState(false), [query, setQuery] = useState(''), [visibility, setVisibility] = useState('all');
 const [calendarOpen, setCalendarOpen] = useState(false), [date, setDate] = useState<Date | undefined>(new Date(today()+'T12:00:00'));
 const r = report(data,viewer,dateRange('current',today()),today());
 const preferences = data.settings.dashboard?.[viewer] ?? { order:sections, hidden:[] };
 const order = [...preferences.order,...sections.filter(id=>!preferences.order.includes(id))];
 const update = (nextOrder: string[], hidden: string[]) => change({...data,settings:{...data.settings,dashboard:{...data.settings.dashboard,[viewer]:{order:nextOrder,hidden}}}});
 const move = (id: string, direction: number) => { const index=order.indexOf(id), next=[...order]; if(index+direction<0||index+direction>=order.length)return; [next[index],next[index+direction]]=[next[index+direction],next[index]];update(next,preferences.hidden); };
 const due = report(data,viewer,{start:'1900-01-01',end:new Date(Date.parse(today()+'T12:00:00Z')+366*86400000).toISOString().slice(0,10)},today()).due;
 const recent = report(data,viewer,{start:'1300-01-01',end:today()},today()).transactions.slice(0,5);
 const currencyMoney = (n:number,c:string) => c==='IRT'?money(n):nativeMoney(n,c,data.currencyDefinitions).replace(/\d/g,ch=>'۰۱۲۳۴۵۶۷۸۹'[Number(ch)]);
 const selectedDay = date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` : today();
 const budget = data.monthlyBudgets[periodKey(today())];
 const budgetRows: [string,number,number][] = budget ? [['کل ماه',budget.total,r.expense],...Object.entries(budget.categories).map(([name,limit])=>[name,limit,r.categories.find(([n])=>n===name)?.[1]??0] as [string,number,number]),...Object.entries(budget.folders??{}).map(([id,limit])=>[data.folders.find(f=>f.id===id)?.name??id,limit,r.folderIds.find(([n])=>n===id)?.[1]??0] as [string,number,number])] : [];
 const paymentTable = (items: typeof due) => items.length ? <Table><TableHeader><TableRow><TableHead>عنوان</TableHead><TableHead>سررسید</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader><TableBody>{items.map(o=><TableRow key={o.kind+o.id}><TableCell>{o.name}</TableCell><TableCell>{persianDate(o.date)}</TableCell><TableCell><Amount>{currencyMoney(o.amount,o.currency)}</Amount></TableCell></TableRow>)}</TableBody></Table> : <Empty>تعهدی وجود ندارد.</Empty>;
 return <DirectionProvider dir="rtl"><TooltipProvider><div className="ds-dashboard" lang="fa-IR" dir="rtl">
  <header className="ds-header"><div><Badge variant="secondary">نمای مالی · {viewer}</Badge><h1>داشبورد مالی</h1><p>وضعیت ماه شمسی جاری · {persianDate(today())}</p></div><DropdownMenu dir="rtl"><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="گزینه‌های داشبورد"><MoreHorizontal/></Button></DropdownMenuTrigger><DropdownMenuContent className="ds-portal" align="end"><DropdownMenuItem onSelect={()=>setCustomize(true)}><Settings2/>تنظیم کارت‌ها</DropdownMenuItem><DropdownMenuItem onSelect={()=>setCalendarOpen(true)}><CalendarDays/>تقویم پرداخت‌ها و دریافت‌ها</DropdownMenuItem></DropdownMenuContent></DropdownMenu></header>
  <div className="ds-toolbar"><Button onClick={()=>setCustomize(true)}><Settings2/>تنظیم داشبورد</Button><Button variant="outline" onClick={()=>setCalendarOpen(true)}><CalendarDays/>تقویم پرداخت‌ها و دریافت‌ها</Button></div>
  <div className="ds-grid">{order.filter(id=>sections.includes(id)&&!preferences.hidden.includes(id)).map(id=><Card key={id} className={`ds-card ds-${id}`}><CardHeader><CardTitle className="ds-title">{id==='balances'?<Wallet/>:id==='monthly'?<TrendingUp/>:id==='goals'?<PiggyBank/>:<Receipt/>}{labels[id]}{id==='overdue'&&<Badge variant="destructive">{fa(due.filter(o=>o.direction==='pay'&&o.date<today()).length)}</Badge>}</CardTitle>{id==='balances'&&<CardDescription>مانده فعلی ثبت‌شده؛ ارزهای متفاوت جمع نمی‌شوند.</CardDescription>}</CardHeader><CardContent>
  {id==='balances'&&<>{r.balances.map(([c,n])=><Metric key={c} label={c} value={currencyMoney(n,c)}/>)}{!r.balances.length&&<Empty>حسابی برای نمایش وجود ندارد.</Empty>}</>}
  {id==='monthly'&&<><Metric label="درآمد" value={money(r.income)} tone="ds-success"/><Metric label="هزینه‌های روزمره" value={money(r.expense)} tone="ds-destructive"/>{r.cash.map(([c,n])=><Metric key={c} label="تغییر موجودی حساب‌ها" value={currencyMoney(n,c)}/>)}<Metric label="پس‌انداز پس از برداشت‌ها" value={money(r.saving)}/></>}
  {id==='budgets'&&<>{!budget&&<Empty>بودجه‌ای برای این ماه تنظیم نشده.</Empty>}{budgetRows.map(([name,limit,spent])=>{const u=budgetUsage(limit,spent,budget?.warningThreshold,budget?.exceededThreshold);return <div className={`ds-budget ds-${u.state}`} key={name}><div className="ds-between"><strong>{name}</strong><Badge variant={u.state==='exceeded'?'destructive':'secondary'}>{fa(u.percentage)}٪</Badge></div><p><Amount>{money(spent)}</Amount> از <Amount>{money(limit)}</Amount></p><Progress aria-label={name} value={Math.max(0,Math.min(100,limit?spent/limit*100:0))}/><p>{u.remaining<0?'بیشتر از بودجه':'باقی‌مانده'}: <Amount>{money(Math.abs(u.remaining))}</Amount></p>{u.state==='warning'&&<p role="status">نزدیک سقف بودجه</p>}{u.state==='exceeded'&&<p role="alert">هزینه از سقف بودجه گذشته است</p>}{u.state==='unset'&&<small>سقف تنظیم نشده</small>}</div>;})}</>}
  {id==='goals'&&<>{r.goals.map(g=><div className="ds-budget" key={g.id}><strong>{g.name}</strong><p><Amount>{money(g.saved)}</Amount> از <Amount>{money(g.target)}</Amount></p><Progress aria-label={g.name} value={Math.max(0,Math.min(100,g.saved/(g.target||1)*100))}/></div>)}{!r.goals.length&&<Empty>هدف پس‌اندازی ثبت نشده.</Empty>}</>}
  {(id==='due'||id==='overdue')&&paymentTable(due.filter(o=>o.direction==='pay'&&(id==='overdue'?o.date<today():o.date>=today())).slice(0,5))}
  {(id==='foreign'||id==='categories')&&<>{(id==='foreign'?r.foreign:r.categories.slice(0,4)).map(([n,v])=><Metric key={n} label={n} value={money(v)}/>)}{!(id==='foreign'?r.foreign:r.categories).length&&<Empty>هزینه‌ای ثبت نشده.</Empty>}</>}
  {id==='recent'&&<>{recent.length?<Table><TableHeader><TableRow><TableHead>تراکنش</TableHead><TableHead>تاریخ</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader><TableBody>{recent.map(t=><TableRow key={t.id}><TableCell>{t.title}</TableCell><TableCell>{persianDate(t.date)}</TableCell><TableCell><Amount>{money(t.amount)}</Amount></TableCell></TableRow>)}</TableBody></Table>:<Empty>اولین تراکنش خود را ثبت کن.</Empty>}</>}
  </CardContent></Card>)}</div><FinancialDefinitions/>
  <Dialog open={customize} onOpenChange={setCustomize}><DialogContent className="ds-portal ds-settings" dir="rtl"><DialogHeader><DialogTitle>تنظیم کارت‌های داشبورد</DialogTitle><DialogDescription>نمایش و ترتیب کارت‌ها برای {viewer} ذخیره می‌شود.</DialogDescription></DialogHeader><Input aria-label="جستجوی کارت" placeholder="جستجوی کارت…" value={query} onChange={e=>setQuery(e.target.value)}/><Select value={visibility} onValueChange={setVisibility} dir="rtl"><SelectTrigger aria-label="فیلتر نمایش کارت‌ها"><SelectValue/></SelectTrigger><SelectContent className="ds-portal" dir="rtl"><SelectItem value="all">همه کارت‌ها</SelectItem><SelectItem value="visible">نمایان</SelectItem><SelectItem value="hidden">مخفی</SelectItem></SelectContent></Select><SidebarProvider className="ds-settings-sidebar"><Sidebar side="right" collapsible="none" className="w-full"><SidebarContent><SidebarGroup><SidebarGroupLabel>کارت‌های مالی</SidebarGroupLabel><SidebarMenu>{order.filter(id=>sections.includes(id)&&labels[id].includes(query)&&(visibility==='all'||(visibility==='hidden')===preferences.hidden.includes(id))).map(id=><SidebarMenuItem key={id} className="ds-setting-row"><label><input type="checkbox" checked={!preferences.hidden.includes(id)} onChange={e=>update(order,e.target.checked?preferences.hidden.filter(x=>x!==id):[...preferences.hidden,id])}/>{labels[id]}</label><div>{[-1,1].map(direction=><Tooltip key={direction}><TooltipTrigger asChild><Button variant="ghost" size="icon" disabled={direction===-1?order.indexOf(id)===0:order.indexOf(id)===order.length-1} aria-label={`${direction===-1?'بالا بردن':'پایین بردن'} ${labels[id]}`} onClick={()=>move(id,direction)}>{direction===-1?<ArrowUp/>:<ArrowDown/>}</Button></TooltipTrigger><TooltipContent className="ds-portal" dir="rtl">{direction===-1?'بالا بردن':'پایین بردن'}</TooltipContent></Tooltip>)}</div></SidebarMenuItem>)}</SidebarMenu></SidebarGroup></SidebarContent></Sidebar></SidebarProvider></DialogContent></Dialog>
  <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}><DialogTrigger asChild><span hidden/></DialogTrigger><DialogContent className="ds-portal ds-calendar-dialog" dir="rtl"><DialogHeader><DialogTitle>تقویم پرداخت‌ها و دریافت‌ها</DialogTitle><DialogDescription>تعهدات ثبت‌شده؛ انتخاب تاریخ، اطلاعات مالی را تغییر نمی‌دهد.</DialogDescription></DialogHeader><Tabs defaultValue="calendar" dir="rtl"><TabsList><TabsTrigger value="calendar">تقویم شمسی</TabsTrigger><TabsTrigger value="list">پرداخت‌ها و دریافت‌ها</TabsTrigger></TabsList><TabsContent value="calendar"><Calendar mode="single" dir="rtl" selected={date} onSelect={setDate} defaultMonth={date}/><p>{persianDate(selectedDay)}</p>{paymentTable(due.filter(o=>o.date===selectedDay))}</TabsContent><TabsContent value="list">{paymentTable(due)}</TabsContent></Tabs></DialogContent></Dialog>
 </div></TooltipProvider></DirectionProvider>;
}

import type { Asset, FinanceData, Goal, Transaction } from './types';
import { add, converted, decimal, integer, sum, quantityAdd, proportional } from './decimal';
import { active, allowed, post, reverse } from './finance';
import { isoDay, periodKey } from './calendar';

export interface ValuationQuote { identifier: string; unit: string; purity?: string; price: string; currency: 'IRT'; timestamp: string; source: string }
export interface ValuationProvider { id: string; getQuote(asset: Asset): Promise<ValuationQuote> }
// Providers are opt-in. No default price feed or fabricated market data.
export const valuationProviders = new Map<string, ValuationProvider>();
export function setValuation(data: FinanceData, assetId: string, quote: ValuationQuote, mode: 'manual' | 'provider'): FinanceData {
  const a = data.assets.find(a => a.id === assetId);
  if (!a || quote.identifier !== (a.identifier ?? a.name) || quote.unit !== a.unit || quote.purity !== a.purity || quote.currency !== 'IRT') throw new Error('واحد، نماد یا عیار قیمت با دارایی یکسان نیست.');
  if (decimal(quote.price).units <= 0n || !Number.isFinite(Date.parse(quote.timestamp)) || !quote.source.trim() || Date.parse(quote.timestamp) > Date.now()) throw new Error('قیمت، زمان و منبع معتبر لازم است.');
  converted(a.quantity, quote.price);
  const day = quote.timestamp.slice(0,10);
  let quantity = a.openingQuantity, cost = a.openingCost;
  const known = !!a.acquisitionDate && a.acquisitionDate <= day;
  if (known) for (const t of data.transactions.filter(t => active(t) && t.assetId === a.id && t.date <= day).reverse().sort((a,b) => a.date.localeCompare(b.date))) {
    if (t.type === 'asset-buy') { quantity = quantityAdd(quantity,t.quantity!); cost = add(cost,t.amount); }
    else if (t.type === 'asset-sell') { const basis = proportional(cost,t.quantity!,quantity); quantity = quantityAdd(quantity,t.quantity!,true); cost = add(cost,-basis); }
  }
  const snapshot = known ? { quantity, cost } : day === new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'}) ? { quantity: a.quantity, cost: a.cost } : {};
  const latest = !a.quoteTimestamp || quote.timestamp >= a.quoteTimestamp;
  return { ...data, assets: data.assets.map(x => x.id === a.id ? { ...x, ...(latest ? {quote: quote.price, quoteDate: day, quoteTimestamp: quote.timestamp, quoteSource: quote.source, quoteMode: mode} : {}), quoteHistory: [...(x.quoteHistory ?? []), { price: quote.price, at: quote.timestamp, source: quote.source, mode, ...snapshot, recordedAt: new Date().toISOString() }] } : x) };
}
export const staleValuation = (a: Asset, now = Date.now()) => !a.quoteTimestamp || now - Date.parse(a.quoteTimestamp) > 86400000;
export function saveGoal(data: FinanceData, goal: Goal): FinanceData {
  if (!goal.name.trim() || goal.target < 0 || !Number.isSafeInteger(goal.target) || goal.monthlyTarget !== undefined && (!Number.isSafeInteger(goal.monthlyTarget) || goal.monthlyTarget < 0) || goal.targetDate && !isoDay(goal.targetDate) || !/^#[0-9a-f]{6}$/i.test(goal.color ?? '#16a085')) throw new Error('نام، مبلغ، رنگ یا تاریخ هدف معتبر نیست.');
  const existing = data.goals.find(g => g.id === goal.id);
  const next = existing ? { ...goal, saved: existing.saved, openingSaved: existing.openingSaved } : { ...goal, saved: 0, openingSaved: 0 };
  return { ...data, goals: existing ? data.goals.map(g => g.id === next.id ? next : g) : [...data.goals, next] };
}
export function savingsSummary(data: FinanceData, viewer: string, month: string) {
  const goals = data.goals.filter(g => allowed(g, viewer));
  const assets = data.assets.filter(a => allowed(a, viewer));
  const contributions = data.transactions.filter(t => active(t) && allowed(t,viewer) && t.type === 'saving' && periodKey(t.date) === month);
  return { allocated: sum(goals.map(g=>g.saved)), planned: sum(goals.filter(g=>(g.status??'active')==='active').map(g=>g.monthlyPlans?.[month]??g.monthlyTarget??0)), actual: sum(contributions.filter(t=>!t.goalWithdrawal).map(t=>t.amount)), withdrawals: sum(contributions.filter(t=>t.goalWithdrawal).map(t=>t.amount)), cost: sum(assets.map(a=>a.cost)), originalAcquisitions: sum([...assets.map(a=>a.openingCost),...data.transactions.filter(t=>active(t)&&assets.some(a=>a.id===t.assetId)&&t.type==='asset-buy').map(t=>t.amount)]), valuation: sum(assets.filter(a=>a.quote).map(a=>converted(a.quantity,a.quote!))), missing: assets.filter(a=>!a.quote).length };
}
export function assetTrade(data: FinanceData, t: Transaction, fundingGoalId?: string): FinanceData {
  if (data.transactions.some(x=>x.id===t.id)) return data;
  let next = data;
  if (fundingGoalId && t.type === 'asset-buy' && !t.allocationOnly) {
    const reserved = sum(data.transactions.filter(x=>active(x)&&x.allocationOnly&&x.type==='saving'&&x.goalId===fundingGoalId&&x.accountId===t.accountId).map(x=>x.goalWithdrawal?-x.amount:x.amount));
    const release = Math.min(reserved, add(t.amount,t.fee??0));
    if (release) next = post(next,{...t,id:`${t.id}:release`,type:'saving',assetId:undefined,quantity:undefined,fee:undefined,fx:undefined,goalId:fundingGoalId,goalWithdrawal:true,allocationOnly:true,amount:release,title:'تبدیل تخصیص هدف به دارایی'});
  }
  return post(next,t);
}
// Versioned correction: undo dependent trades, then replay them with weighted-average basis.
// Original rows and ledger reversals remain available for audit.
export function correctAssetTrade(data: FinanceData, id: string, replacement: Transaction): FinanceData {
  const old = data.transactions.find(t=>t.id===id && active(t));
  if (!old?.assetId || old.legacy || replacement.assetId!==old.assetId || replacement.type!==old.type) throw new Error('رویداد دارایی قابل اصلاح نیست.');
  const events = data.transactions.filter(t=>active(t)&&t.assetId===old.assetId);
  let next = data;
  for (const t of events) next = reverse(next,t.id);
  const version = data.transactions.length;
  for (const t of [...events].reverse()) {
    const edited = t.id===id ? replacement : t;
    const releasedGoal = data.transactions.find(x=>x.id===`${t.id}:release`&&active(x))?.goalId;
    next = assetTrade(next,{...edited,id:`${t.id}:correction:${version}`,status:'posted',revisions:[...(t.revisions??[]),{title:t.title,amount:t.amount,at:new Date().toISOString()}],note:`${edited.note??''}\nاصلاح مرتبط با ${t.id}`},releasedGoal);
  }
  return next;
}
export function correctAssetOpening(data: FinanceData, assetId: string, opening: Pick<Asset, 'openingQuantity' | 'openingCost' | 'acquisitionDate' | 'originalCost' | 'originalCurrency' | 'acquisitionPrice' | 'notes'>, reason: string): FinanceData {
  const old = data.assets.find(a=>a.id===assetId);
  if (!old || !reason.trim()) throw new Error('دارایی و دلیل اصلاح لازم است.');
  decimal(opening.openingQuantity); integer(String(opening.openingCost),true);
  let quantity=opening.openingQuantity, cost=opening.openingCost;
  const corrections=new Map<string,number>();
  for (const t of data.transactions.filter(t=>active(t)&&t.assetId===assetId).reverse()) {
    if(t.type==='asset-buy'){quantity=quantityAdd(quantity,t.quantity!);cost=add(cost,t.amount);}
    else { const basis=proportional(cost,t.quantity!,quantity); quantity=quantityAdd(quantity,t.quantity!,true);cost=add(cost,-basis);corrections.set(t.id,basis); }
  }
  // Quantity/cost correction has no cash effect; dependent disposals retain their posted proceeds.
  return {...data,assets:data.assets.map(a=>a.id===assetId?{...a,...opening,quantity,cost}:a),transactions:data.transactions.map(t=>corrections.has(t.id)?{...t,costBasis:corrections.get(t.id),costBasisRevisions:[...(t.costBasisRevisions??[]),{value:t.costBasis??0,at:new Date().toISOString()}],revisions:[...(t.revisions??[]),{title:t.title,amount:t.amount,at:new Date().toISOString()}],note:`${t.note??''}\nبازمحاسبه بهای فروش پس از اصلاح موجودی افتتاحیه`}:t),assetOpeningRevisions:[...(data.assetOpeningRevisions??[]),{assetId,at:new Date().toISOString(),previous:structuredClone(old),reason}]};
}
export function validateSavingsAssets(data: FinanceData) {
  for (const g of data.goals) {
    integer(String(g.monthlyTarget??0),true);
    if (!g.name.trim() || g.color && !/^#[0-9a-f]{6}$/i.test(g.color)) throw new Error('نام یا رنگ هدف معتبر نیست.');
    if (g.status && !['active','completed','archived'].includes(g.status)) throw new Error('وضعیت هدف معتبر نیست.');
    for (const [month, amount] of Object.entries(g.monthlyPlans??{})) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('ماه برنامه معتبر نیست.'); integer(String(amount),true); }
  }
  for (const a of data.assets) {
    if (a.goalId && !data.goals.some(g=>g.id===a.goalId)) throw new Error('هدف مرتبط دارایی معتبر نیست.');
    if (a.acquisitionDate && !isoDay(a.acquisitionDate)) throw new Error('تاریخ خرید معتبر نیست.');
    if (a.originalCost) decimal(a.originalCost);
    if (a.originalCurrency && !['IRT','IRR','USD','EUR'].includes(a.originalCurrency)) throw new Error('ارز هزینه اصلی معتبر نیست.');
    if (a.identifier && a.kind==='currency' && !['IRT','IRR','USD','EUR'].includes(a.identifier)) throw new Error('شناسه ارز نقدی معتبر نیست.');
    if (a.identifier && a.kind==='gold' && (a.unit!=='گرم' || !['18K','24K','21K','22K'].includes(a.purity??''))) throw new Error('واحد یا عیار طلای جدید معتبر نیست.');
    if (a.acquisitionPrice) decimal(a.acquisitionPrice);
    if (!decimal(a.quantity).units && a.cost) throw new Error('دارایی با مقدار صفر نمی‌تواند بهای باقی‌مانده داشته باشد.');
    if (a.quoteTimestamp && !Number.isFinite(Date.parse(a.quoteTimestamp))) throw new Error('زمان ارزش‌گذاری معتبر نیست.');
    if (a.quoteMode && (!['manual','provider'].includes(a.quoteMode) || !a.quoteTimestamp || !a.quoteSource?.trim())) throw new Error('منبع ارزش‌گذاری معتبر نیست.');
    let quantity=a.openingQuantity, cost=a.openingCost;
    for (const t of data.transactions.filter(t=>active(t)&&t.assetId===a.id&&!t.legacy).reverse()) {
      if (!t.quantity) throw new Error('مقدار رویداد دارایی لازم است.');
      if (t.type==='asset-buy') { quantity=quantityAdd(quantity,t.quantity);cost=add(cost,t.amount); }
      else { const basis=proportional(cost,t.quantity,quantity); if(t.costBasis!==basis) throw new Error('بهای فروش با تاریخچه سازگار نیست.');quantity=quantityAdd(quantity,t.quantity,true);cost=add(cost,-basis); }
    }
    const x=decimal(quantity),y=decimal(a.quantity);
    if(x.units*y.scale!==y.units*x.scale || cost!==a.cost) throw new Error('موجودی دارایی با تاریخچه سازگار نیست.');
  }
  if (data.assetOpeningRevisions && (!Array.isArray(data.assetOpeningRevisions) || data.assetOpeningRevisions.some(r=>!data.assets.some(a=>a.id===r.assetId) || !r.reason?.trim() || !Number.isFinite(Date.parse(r.at)) || !r.previous || r.previous.id!==r.assetId))) throw new Error('تاریخچه اصلاح افتتاحیه معتبر نیست.');
}

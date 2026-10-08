import { decimal } from './decimal';
import { canonicalDay, isoDay } from './calendar';
export type RateQuote = { currency: string; target: 'IRT'; rate: string; source: string; effectiveAt: string; retrievedAt: string; rateType: 'open-market-sell' | 'open-market-buy' | 'manual' | 'denomination'; frequency: string };
export interface ExchangeRateProvider { name: string; quote(currency: string, day: string): Promise<RateQuote> }
export function validateQuote(q: RateQuote, currency: string, day: string, now=Date.now()) {
  if (!q || q.currency!==currency || q.target!=='IRT' || typeof q.rate!=='string' || decimal(q.rate).units<=0n || !q.source?.trim() || !q.frequency?.trim() || !['open-market-sell','open-market-buy','manual','denomination'].includes(q.rateType) || !Number.isFinite(Date.parse(q.effectiveAt)) || !Number.isFinite(Date.parse(q.retrievedAt)) || Date.parse(q.effectiveAt)>now || Date.parse(q.retrievedAt)>now || Date.parse(q.retrievedAt)<Date.parse(q.effectiveAt) || canonicalDay(new Date(q.effectiveAt))!==day || !isoDay(day)) throw new Error('نرخ، واحد یا تاریخ پاسخ معتبر نیست؛ نرخ را دستی وارد کن.');
}
// A same-origin server proxy owns provider credentials and verifies raw quote units.
export class ProxyRateProvider implements ExchangeRateProvider {
  name='سرور نرخ بازار آزاد';
  constructor(private endpoint='/api/exchange-rates', private request: typeof fetch=fetch) {}
  async quote(currency: string, day: string) {
    const response=await this.request(`${this.endpoint}?currency=${encodeURIComponent(currency)}&date=${encodeURIComponent(day)}`,{signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('سرویس نرخ در دسترس نیست؛ نرخ دستی یا ذخیره‌شده را انتخاب کن.');
    const quote: RateQuote=await response.json(); validateQuote(quote,currency,day); return quote;
  }
}
export class RateService {
  constructor(private provider: ExchangeRateProvider, private storage: Pick<Storage,'getItem'|'setItem'>, public refreshMs=7200000, private now=()=>Date.now()) {
    if (!Number.isSafeInteger(refreshMs) || refreshMs<60000) throw new Error('فاصله تازه‌سازی باید حداقل یک دقیقه باشد.');
  }
  async get(currency: string, day: string, force=false): Promise<{quote:RateQuote;cached:boolean;offline:boolean;stale:boolean}> {
    const key=`khaneh-fx:${this.provider.name}:${currency}:${day}`;
    let cached: RateQuote|undefined;
    try { const raw=this.storage.getItem(key); if(raw){cached=JSON.parse(raw);validateQuote(cached!,currency,day,this.now());} } catch { cached=undefined; }
    const stale=!!cached && (this.now()-Date.parse(cached.retrievedAt)>=this.refreshMs || this.now()-Date.parse(cached.effectiveAt)>=this.refreshMs);
    if(cached&&!stale&&!force)return {quote:cached,cached:true,offline:false,stale:false};
    try { const quote=await this.provider.quote(currency,day); validateQuote(quote,currency,day,this.now()); try{this.storage.setItem(key,JSON.stringify(quote));}catch{/* A quote remains usable when the optional cache is full. */} return {quote,cached:false,offline:false,stale:this.now()-Date.parse(quote.effectiveAt)>=this.refreshMs}; }
    catch(error){if(cached)return {quote:cached,cached:true,offline:true,stale:true};throw error;}
  }
}

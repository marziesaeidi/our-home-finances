// Optional read-only proxy for this browser-first application. Never serve API keys.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
export function normalizeNavasan(raw, currency, day, unit, retrievedAt=new Date().toISOString(), frequency='دو ساعت (طرح رایگان)') {
  if(!['IRT','IRR'].includes(unit))throw new Error('Confirm NAVASAN_QUOTE_UNIT with your provider account before enabling.');
  const field={USD:'usd_sell'}[currency], row=raw?.[field];
  if(!row || !/^\d+$/.test(String(row.value)) || BigInt(row.value)<=0n || !Number.isSafeInteger(row.timestamp))throw new Error('Invalid provider response');
  const effectiveAt=new Date(row.timestamp*1000).toISOString();
  const effectiveDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(effectiveAt));
  if(effectiveDay!==day || Date.parse(effectiveAt)>Date.parse(retrievedAt))throw new Error('Provider quote does not match purchase day');
  const units=BigInt(row.value), rate=unit==='IRT'?units.toString():`${units/10n}.${units%10n}`;
  return {currency,target:'IRT',rate,source:`Navasan ${field} (${unit})`,effectiveAt,retrievedAt,rateType:'open-market-sell',frequency};
}
export function startRateServer(){
  const apiKey=process.env.NAVASAN_API_KEY, unit=process.env.NAVASAN_QUOTE_UNIT;
  const frequency=process.env.NAVASAN_UPDATE_DESCRIPTION??'دو ساعت (طرح رایگان)';
  const cache=new Map();const ttl=Number(process.env.FX_REFRESH_MINUTES??120)*60000;
  if(!Number.isSafeInteger(ttl)||ttl<60000)throw new Error('Invalid refresh interval');
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    const fail=(status,message)=>{res.writeHead(status);res.end(JSON.stringify({error:message}));};
    const url=new URL(req.url,'http://localhost');
    if(req.method!=='GET'||url.pathname!=='/api/exchange-rates')return fail(404,'Not found');
    if(!apiKey||!['IRT','IRR'].includes(unit))return fail(503,'Rate provider is not configured; use manual entry');
    const currency=url.searchParams.get('currency'),day=url.searchParams.get('date');
    const field={USD:'usd_sell'}[currency];
    if(!field||!/^\d{4}-\d{2}-\d{2}$/.test(day??''))return fail(400,'Unsupported currency or date');
    const key=`${currency}:${day}`,saved=cache.get(key);
    if(saved&&Date.now()-Date.parse(saved.retrievedAt)<ttl){res.end(JSON.stringify(saved));return;}
    try{
      // HTTPS only. No insecure HTTP fallback, even though the guide shows HTTP examples.
      const upstream=new URL('https://api.navasan.tech/latest/');
      upstream.searchParams.set('api_key',apiKey);upstream.searchParams.set('item',field);
      const response=await fetch(upstream,{signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)throw new Error('Upstream unavailable');
      const quote=normalizeNavasan(await response.json(),currency,day,unit,new Date().toISOString(),frequency);
      cache.set(key,quote);res.end(JSON.stringify(quote));
    }catch{fail(503,'No verified quote for this purchase day; enter the receipt rate manually');}
  });
  server.listen(Number(process.env.FX_PORT??8788),'127.0.0.1',()=>console.log('Rate proxy listening on localhost; credentials stay on server.'));
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startRateServer();

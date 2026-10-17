import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Asset } from './types';
import { add, converted } from './decimal';
import { money, persianDate } from './utils';
import { persianDigits } from './input-format';

export function AssetPriceHistory({asset}: {asset: Asset}) {
 const [fullscreen,setFullscreen]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null);
 const chartRef=useRef<SVGSVGElement>(null);
 useEffect(()=>{
   if(!fullscreen)return;
   const dialog=dialogRef.current;dialog?.showModal();
   const previous=document.body.style.overflow;document.body.style.overflow='hidden';
   return ()=>{document.body.style.overflow=previous;dialog?.close();pointers.current.clear();};
 },[fullscreen]);
 const [metric,setMetric]=useState<'price'|'profit'>('price');
 const [days,setDays]=useState(0),[zoom,setZoom]=useState(100),[offset,setOffset]=useState(100),[hover,setHover]=useState<number|null>(null);
 const all=[...(asset.quoteHistory??[])].sort((a,b)=>a.at.localeCompare(b.at));
 const end=all.length?Date.parse(all[all.length-1].at):0;
 const filtered=all.filter(p=>!days||Date.parse(p.at)>=end-days*86400000);
 const rangeStart=filtered.length?Date.parse(filtered[0].at):0;
 const rangeEnd=Math.max(rangeStart+86400000,end);
 const fullSpan=rangeEnd-rangeStart;
 const visibleSpan=fullSpan*zoom/100;
 const first=rangeStart+(fullSpan-visibleSpan)*offset/100,last=first+visibleSpan;
 const rows=filtered.map(p=>({...p,value:metric==='price'?Number(p.price):p.quantity!==undefined&&p.cost!==undefined?add(converted(p.quantity,p.price),-p.cost):null}));
 const visible=rows.filter(p=>Date.parse(p.at)>=first&&Date.parse(p.at)<=last);
 const valid=rows.filter(p=>p.value!==null),values=visible.filter(p=>p.value!==null).map(p=>p.value!);
 const min=values.length?Math.min(...values,0):0,max=values.length?Math.max(...values,1):1,span=max-min||1;
 const x=(at:string)=>60+(Date.parse(at)-first)/visibleSpan*840;
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef({distance:0,center:0});
 const clamp=(n:number,low:number,high:number)=>Math.min(high,Math.max(low,n));
 const inspect=(clientX:number,svg:SVGSVGElement)=>{
   const rect=svg.getBoundingClientRect(),px=(clientX-rect.left)/rect.width*960;
   let nearest:number|null=null;
   rows.forEach((p,i)=>{if(Date.parse(p.at)>=first&&Date.parse(p.at)<=last&&(nearest===null||Math.abs(x(p.at)-px)<Math.abs(x(rows[nearest].at)-px)))nearest=i});
   setHover(nearest);
 };
 const zoomAt=(nextZoom:number,anchor:number)=>{
   const next=clamp(nextZoom,1,100),ratio=clamp(anchor,0,1);
   const nextSpan=fullSpan*next/100;
   const nextFirst=clamp(first+visibleSpan*ratio-nextSpan*ratio,rangeStart,rangeEnd-nextSpan);
   setZoom(next);setOffset(fullSpan===nextSpan?100:(nextFirst-rangeStart)/(fullSpan-nextSpan)*100);
 };
 const pointerDown=(e:ReactPointerEvent<SVGSVGElement>)=>{
   e.currentTarget.setPointerCapture(e.pointerId);
   pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
   const points=[...pointers.current.values()];
   gesture.current={distance:points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0,center:points.reduce((s,p)=>s+p.x,0)/points.length};
   inspect(e.clientX,e.currentTarget);
 };
 const pointerMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
   if(!pointers.current.has(e.pointerId)){inspect(e.clientX,e.currentTarget);return;}
   pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
   const points=[...pointers.current.values()],center=points.reduce((s,p)=>s+p.x,0)/points.length;
   const rect=e.currentTarget.getBoundingClientRect(),plotWidth=rect.width*840/960;
   if(points.length>1){
     const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
     if(gesture.current.distance>0&&distance>0)zoomAt(zoom*gesture.current.distance/distance,(center-rect.left-rect.width*60/960)/plotWidth);
     gesture.current={distance,center};
   }else{
     const delta=(center-gesture.current.center)/plotWidth*visibleSpan;
     const nextFirst=clamp(first-delta,rangeStart,rangeEnd-visibleSpan);
     setOffset(fullSpan===visibleSpan?100:(nextFirst-rangeStart)/(fullSpan-visibleSpan)*100);
     gesture.current={distance:0,center};inspect(e.clientX,e.currentTarget);
   }
 };
 const pointerUp=(e:ReactPointerEvent<SVGSVGElement>)=>{
   pointers.current.delete(e.pointerId);const remaining=[...pointers.current.values()];
   gesture.current={distance:0,center:remaining[0]?.x??0};
   if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 useEffect(()=>{
   const chart=chartRef.current;if(!chart)return;
   const wheel=(e:WheelEvent)=>{
     e.preventDefault();const rect=chart.getBoundingClientRect();
     if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){
       const delta=e.shiftKey?e.deltaY:e.deltaX;
       const nextFirst=clamp(first+delta/(rect.width*840/960)*visibleSpan,rangeStart,rangeEnd-visibleSpan);
       setOffset(fullSpan===visibleSpan?100:(nextFirst-rangeStart)/(fullSpan-visibleSpan)*100);
     }else zoomAt(zoom*Math.exp(clamp(e.deltaY,-100,100)*0.003),(e.clientX-rect.left-rect.width*60/960)/(rect.width*840/960));
     setHover(null);
   };
   chart.addEventListener('wheel',wheel,{passive:false});
   return ()=>chart.removeEventListener('wheel',wheel);
 });
 const y=(value:number)=>260-(value-min)/span*220;
 const selected=hover!==null?rows[hover]:visible[visible.length-1];
 const chartContent=<div className="asset-chart-workspace"> <div className="history-controls"><div className="history-filter-pair"><label>نمایش <select value={metric} onChange={e=>{setMetric(e.target.value as 'price'|'profit');setHover(null)}}><option value="price">قیمت هر واحد</option><option value="profit">سود / زیان (تومان)</option></select></label><label>بازه <select value={days} onChange={e=>{setDays(Number(e.target.value));setHover(null)}}>{[[0,'همه'],[7,'۷ روز'],[30,'۳۰ روز'],[90,'۹۰ روز'],[365,'یک سال']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div></div>
 <p className="field-hint">با دو انگشت نمودار را بزرگ و کوچک کن؛ با کشیدن یک انگشت در تاریخ حرکت کن و برای دیدن مقدار دقیق، نقطه را لمس کن. قیمت‌ها به تومان هستند؛ سود و زیان ثبت‌های فاقد اطلاعات تاریخی نمایش داده نمی‌شود.</p>
 {!valid.length?<p>در این بازه اطلاعات کافی برای محاسبه سود و زیان وجود ندارد.</p>:<svg className="asset-price-chart" viewBox="0 0 960 320" preserveAspectRatio={fullscreen?"none":"xMidYMid meet"} role="img" aria-label="نمودار روند بر اساس تاریخ ثبت قیمت" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp} onPointerLeave={()=>{if(!pointers.current.size)setHover(null)}} ref={chartRef} onDoubleClick={()=>setFullscreen(true)}>
 {[0,1,2,3,4].map(i=>{const v=min+span*i/4;return <g key={i}><line x1="60" x2="900" y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".12"/><text x="955" y={y(v)-5} textAnchor="end">{Math.round(v).toLocaleString('fa-IR')}</text></g>})}
 <line x1="60" x2="900" y1={y(0)} y2={y(0)} stroke="currentColor" opacity=".4" strokeDasharray="4 4"/>
 <defs><clipPath id="asset-history-clip"><rect x="60" y="25" width="840" height="245"/></clipPath></defs><g clipPath="url(#asset-history-clip)">
 <path d={rows.map((p,i)=>p.value===null?'':`${i===0||rows[i-1].value===null?'M':'L'} ${x(p.at)} ${y(p.value)}`).join(' ')} fill="none" stroke="#16a085" strokeWidth="2.5"/>
 {valid.map((p,i)=><circle key={i} cx={x(p.at)} cy={y(p.value!)} r="4" fill={p.value!<0?'#e85c65':'#16a085'}/>)}
 {selected&&<line x1={x(selected.at)} x2={x(selected.at)} y1="30" y2="270" stroke="currentColor" strokeDasharray="3 4"/>}
 </g>{[0,1,2,3].map(i=><text key={i} x={60+i*280} y="300" textAnchor={i===0?"start":i===3?"end":"middle"}>{persianDate(new Date(first+visibleSpan*i/3).toISOString().slice(0,10))}</text>)}</svg>}
 {selected&&<div className="history-readout" aria-live="polite"><strong>{persianDate(selected.at.slice(0,10))}</strong><span>قیمت واحد: {persianDigits(selected.price)} تومان</span><span>سود / زیان: {selected.quantity!==undefined&&selected.cost!==undefined?money(add(converted(selected.quantity,selected.price),-selected.cost)):'اطلاعات تاریخی کافی نیست'}</span></div>}
</div>;
 return <section className="asset-history" aria-label="سابقه قیمت دارایی"><h2>سابقه قیمت و روند سود و زیان</h2>
 <p className="field-hint">هر نقطه یک قیمت ثبت‌شده است؛ خط بین نقاط فقط راهنمای روند است. سود و زیان، تخمینی و پیش از فروش است و هزینه خرید مقدار باقی‌مانده در تاریخ قیمت را مقایسه می‌کند؛ سود فروش‌های قبلی در آن نیست.</p>
 {!all.length?<p>هنوز قیمتی ثبت نشده است.</p>:<>
 {fullscreen?createPortal(<dialog ref={dialogRef} className="asset-chart-dialog" onClose={()=>setFullscreen(false)} aria-label={`نمودار ${asset.name}`}><div className="asset-chart-dialog-header"><strong>{asset.name} · روند قیمت و سود و زیان</strong><button type="button" className="outline" onClick={()=>setFullscreen(false)}>بستن نمای تمام‌صفحه</button></div>{chartContent}</dialog>,document.body):<><div className="asset-chart-open"><button type="button" className="outline" onClick={()=>setFullscreen(true)}>باز کردن نمودار در تمام‌صفحه</button></div>{chartContent}</>}
 <details><summary>تمام ثبت‌های قیمت ({all.length.toLocaleString('fa-IR')})</summary><div className="history-table-wrap"><table className="history-table"><thead><tr><th>تاریخ قیمت</th><th>قیمت واحد (تومان)</th><th>مقدار در آن تاریخ</th><th>سود / زیان تخمینی</th></tr></thead><tbody>{[...all].reverse().map((p,i)=><tr key={i}><td>{persianDate(p.at.slice(0,10))}</td><td>{persianDigits(p.price)}</td><td>{p.quantity!==undefined?`${persianDigits(p.quantity)} ${asset.unit}`:'نامشخص'}</td><td>{p.quantity!==undefined&&p.cost!==undefined?money(add(converted(p.quantity,p.price),-p.cost)):'نامشخص'}</td></tr>)}</tbody></table></div></details>
 </>}
 </section>;
}

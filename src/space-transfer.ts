import type { FinanceData } from './types';
import { allowed, assetAccountFunds } from './finance';
import { add, sum } from './decimal';
import { validate } from './store';
import { membersOf } from './household-access';
import { periodKey, canonicalDay } from './calendar';

export const transferKinds = { assets:'دارایی', goals:'باکس پس‌انداز', accounts:'حساب', transactions:'تراکنش', loans:'وام', obligations:'چک و تعهد', recurring:'پرداخت دوره‌ای', folders:'پوشه', monthlyBudgets:'بودجه ماه' } as const;
export type TransferKind = keyof typeof transferKinds;
export type TransferSelection = { kind: TransferKind; id: string };
type Collection = Exclude<TransferKind,'monthlyBudgets'> | 'installments';
type Row = { id:string; [key:string]:unknown };
const collections:Collection[]=['assets','goals','accounts','transactions','loans','obligations','recurring','folders','installments'];
const rows=(data:FinanceData,key:Collection)=>data[key] as unknown as Row[];
const permitted=(row:Row,viewer:string)=>typeof row.visibility!=='string'||allowed({visibility:row.visibility as string,owner:row.owner as string|undefined,createdBy:row.createdBy as string|undefined},viewer);
const refs:Record<string,Collection>={assetId:'assets',goalId:'goals',loanId:'loans',installmentId:'installments',obligationId:'obligations',transactionId:'transactions',correctsId:'transactions'};
export function transferPlan(data:FinanceData, selection:TransferSelection, viewer:string){
 if(!Object.hasOwn(transferKinds,selection.kind))throw new Error('نوع مورد انتقال معتبر نیست.');
 const selected=Object.fromEntries(collections.map(k=>[k,new Set<string>()])) as Record<Collection,Set<string>>;
 if(selection.kind==='monthlyBudgets'){
  if(!data.monthlyBudgets[selection.id])throw new Error('بودجه پیدا نشد.');
 }else{
  if(!rows(data,selection.kind).some(r=>r.id===selection.id))throw new Error('مورد انتخابی پیدا نشد.');
  selected[selection.kind].add(selection.id);
 }
 // Financial relationships travel together; account references are mapped separately.
 let changed=true;
 while(changed){changed=false;
  const take=(key:Collection,id:unknown)=>{if(typeof id==='string'&&rows(data,key).some(r=>r.id===id)&&!selected[key].has(id)){selected[key].add(id);changed=true;}};
  for(const key of collections)for(const row of rows(data,key)){
   const links=Object.entries(refs).filter(([field])=>!(key==='assets'&&field==='goalId')).map(([field,target])=>[target,row[field]] as const);
   if(key==='transactions'&&row.paymentAllocation){const p=row.paymentAllocation as {loanId:string;installmentId:string};links.push(['loans',p.loanId],['installments',p.installmentId]);}
   if(key==='transactions'&&typeof row.occurrenceKey==='string'){const recurring=data.recurring.find(r=>(row.occurrenceKey as string).startsWith(r.id+':'));if(recurring)links.push(['recurring',recurring.id]);}
   if(key==='transactions'){
    if(data.transactions.some(t=>t.id===row.id+':release'))links.push(['transactions',row.id+':release']);
    if(row.id.endsWith(':release')&&data.transactions.some(t=>t.id===row.id.slice(0,-8)))links.push(['transactions',row.id.slice(0,-8)]);
   }
   if(selected[key].has(row.id)){for(const [target,id] of links)take(target,id);}
   else if(key==='assets'&&selected.goals.has(String(row.goalId))||links.some(([target,id])=>typeof id==='string'&&selected[target].has(id))||selected.accounts.size&&['accountId','toAccountId','disbursementAccountId'].some(f=>selected.accounts.has(String(row[f])))||selection.kind==='folders'&&row.folderId===selection.id)take(key,row.id);
  }
 }
 for(const key of collections)for(const row of rows(data,key).filter(r=>selected[key].has(r.id)))if(!permitted(row,viewer))throw new Error('سوابق مرتبط شامل مورد خصوصی عضو دیگری است و قابل انتقال نیست.');
 const accounts=new Set<string>();
 for(const key of collections)for(const row of rows(data,key).filter(r=>selected[key].has(r.id)))for(const field of ['accountId','toAccountId','disbursementAccountId'])if(typeof row[field]==='string'&&!selected.accounts.has(row[field] as string))accounts.add(row[field] as string);
 const requiredAccounts=data.accounts.filter(a=>accounts.has(a.id));
 if(requiredAccounts.some(a=>!allowed(a,viewer)))throw new Error('به حساب مرتبط دسترسی نداری.');
 if(requiredAccounts.length!==accounts.size)throw new Error('ارتباط حساب در سابقه قدیمی ناقص است؛ ابتدا آن را اصلاح کن.');
 const items:{kind:Collection|'monthlyBudgets';id:string;name:string}[]=collections.flatMap(key=>rows(data,key).filter(r=>selected[key].has(r.id)).map(r=>({kind:key,id:r.id,name:String(r.name??r.title??(key==='installments'?'قسط':'مورد'))})));
 if(selection.kind==='monthlyBudgets')items.push({kind:'monthlyBudgets',id:selection.id,name:selection.id});
 return {selected,requiredAccounts,items};
}
export type TransferOptions={selection:TransferSelection; accountMap:Record<string,string>; requestId:string; sourceId:string; targetId:string; sourceMember:string; targetMember:string; targetKind:'personal'|'household'; at:string};
export function moveBetweenSpaces(original:FinanceData,destination:FinanceData,opts:TransferOptions){
 validate(original);validate(destination);
 for(const [data,viewer] of [[original,opts.sourceMember],[destination,opts.targetMember]] as const)if(!membersOf(data).some(m=>m.id===viewer&&!m.removed&&m.role!=='reader'))throw new Error('برای انتقال، دسترسی ویرایش در هر دو فضا لازم است.');
 if(opts.sourceId===opts.targetId)throw new Error('مبدأ و مقصد باید متفاوت باشند.');
 const plan=transferPlan(original,opts.selection,opts.sourceMember);
 const source=structuredClone(original),target=structuredClone(destination);
 const selected=plan.selected, visibility=opts.targetKind==='household'?'shared':'private';
 const map=new Map<string,string>();
 const ids=collections.flatMap(key=>rows(original,key).filter(r=>selected[key].has(r.id)).map(r=>r.id));
 if(new Set(ids).size!==ids.length)throw new Error('شناسه مشترک در داده قدیمی وجود دارد؛ انتقال این مجموعه نیازمند اصلاح شناسه‌ها است.');
 for(const key of collections)for(const id of selected[key])map.set(id,`move-${opts.requestId}-${key}-${encodeURIComponent(id)}`);
 for(const id of selected.transactions)if(id.endsWith(':release')&&map.has(id.slice(0,-8)))map.set(id,map.get(id.slice(0,-8))+':release');
 for(const account of plan.requiredAccounts){if(map.has(account.id))throw new Error('شناسه حساب با یک مورد دیگر تداخل دارد.');const to=target.accounts.find(a=>a.id===opts.accountMap[account.id]&&allowed(a,opts.targetMember));if(!to||(to.currency??'IRT')!==(account.currency??'IRT'))throw new Error('برای هر حساب سابقه، یک حساب مقصد با ارز یکسان انتخاب کن.');map.set(account.id,to.id);}
 // The two legs of an internal transfer must remain distinct after account mapping.
 for(const t of original.transactions.filter(t=>selected.transactions.has(t.id)))if(t.toAccountId&&map.get(t.accountId)===map.get(t.toAccountId))throw new Error('دو طرف انتقال پول باید به دو حساب متفاوت وصل شوند.');
 const usedCurrencies=new Set([...original.accounts.filter(a=>selected.accounts.has(a.id)).map(a=>a.currency??'IRT'),...original.transactions.filter(t=>selected.transactions.has(t.id)).map(t=>t.fx?.currency??'IRT')]);
 for(const definition of original.currencyDefinitions??[])if(usedCurrencies.has(definition.code)){
  const existing=target.currencyDefinitions?.find(c=>c.code===definition.code);
  if(existing&&existing.decimals!==definition.decimals)throw new Error('تعداد اعشار ارز سفارشی در دو فضا یکسان نیست.');
  if(!existing)target.currencyDefinitions=[...(target.currencyDefinitions??[]),structuredClone(definition)];
 }
 const metadataFolders=new Set<string>();
 for(const t of original.transactions.filter(t=>selected.transactions.has(t.id)))if(t.folderId&&!selected.folders.has(t.folderId))metadataFolders.add(t.folderId);
 if(opts.selection.kind==='monthlyBudgets')for(const id of Object.keys(original.monthlyBudgets[opts.selection.id].folders??{}))if(!selected.folders.has(id))metadataFolders.add(id);
 for(const id of metadataFolders){const folder=original.folders.find(f=>f.id===id);if(!folder||!allowed(folder,opts.sourceMember))throw new Error('پوشه مرتبط قابل انتقال نیست.');map.set(id,`move:${opts.requestId}:folder:${id}`);target.folders.push({...folder,id:map.get(id)!,owner:opts.targetMember,visibility});}
 const remap=(value:unknown,field=''):unknown=>{
  if(Array.isArray(value))return value.map(v=>remap(v,field));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v,k)]));
  if(typeof value!=='string')return value;
  if(['owner','createdBy'].includes(field))return opts.targetMember;
  if(field==='visibility')return visibility;
  if(field==='occurrenceKey'){const row=original.recurring.find(r=>value.startsWith(r.id+':'));return row&&map.has(row.id)?map.get(row.id)+value.slice(row.id.length):value;}
  return ['id','assetId','goalId','loanId','installmentId','obligationId','transactionId','transactionIds','correctsId','folderId','accountId','toAccountId','disbursementAccountId'].includes(field)?map.get(value)??value:value;
 };
 for(const key of collections){
  const picked=rows(original,key).filter(r=>selected[key].has(r.id));
  const moved=picked.map(row=>{const result=remap(row) as Row;if(key==='assets'&&row.goalId&&!selected.goals.has(String(row.goalId)))delete result.goalId;return result;});
  (source[key] as unknown as Row[])=rows(source,key).filter(r=>!selected[key].has(r.id));
  (target[key] as unknown as Row[]).push(...moved);
 }
 // Preserve posted amounts/rates. Category metadata is merged by name, never by coincidental ID.
 for(const t of target.transactions.filter(t=>selected.transactions.size&&[...selected.transactions].some(id=>map.get(id)===t.id))){const old=original.categoryRecords.find(c=>c.name===t.category);let category=target.categoryRecords.find(c=>c.name===t.category);if(!category){category={...(old??{name:t.category,archived:false}),id:`move:${opts.requestId}:category:${target.categoryRecords.length}`};target.categoryRecords.push(category);}t.categoryId=category.id;}
 const movedEntries=original.accountEntries.filter(e=>selected.transactions.has(e.transactionId));
 source.accountEntries=source.accountEntries.filter(e=>!selected.transactions.has(e.transactionId));
 for(const entry of movedEntries)target.accountEntries.push({...entry,id:`move:${opts.requestId}:entry:${entry.id}`,accountId:map.get(entry.accountId)!,transactionId:map.get(entry.transactionId)!});
 const baselines:{space:string;accountId:string;before:number;after:number}[]=[];
 // Relocating history is not a new cash payment. Offset relocated ledger legs explicitly.
 for(const a of source.accounts){const delta=sum(movedEntries.filter(e=>e.accountId===a.id).map(e=>e.delta));if(delta){const before=a.openingBalance!;a.openingBalance=add(before,delta);baselines.push({space:opts.sourceId,accountId:a.id,before,after:a.openingBalance});}}
 for(const a of target.accounts.filter(a=>!selected.accounts.size||![...selected.accounts].some(id=>map.get(id)===a.id))){const delta=sum(movedEntries.filter(e=>!selected.accounts.has(e.accountId)&&map.get(e.accountId)===a.id).map(e=>e.delta));if(delta){const before=a.openingBalance!;a.openingBalance=add(before,-delta);baselines.push({space:opts.targetId,accountId:a.id,before,after:a.openingBalance});}}
 const revisions=original.assetOpeningRevisions?.filter(r=>selected.assets.has(r.assetId))??[];
 if(revisions.length){source.assetOpeningRevisions=source.assetOpeningRevisions?.filter(r=>!selected.assets.has(r.assetId));target.assetOpeningRevisions=[...(target.assetOpeningRevisions??[]),...revisions.map(r=>remap(r) as typeof r)];}
 if(opts.selection.kind==='monthlyBudgets'){
  const key=opts.selection.id;if(target.monthlyBudgets[key]&&(target.monthlyBudgets[key].total!==0||Object.keys(target.monthlyBudgets[key].categories).length||Object.keys(target.monthlyBudgets[key].folders??{}).length))throw new Error('برای این ماه در مقصد بودجه وجود دارد؛ ابتدا آن را مدیریت کن.');
  const budget=structuredClone(source.monthlyBudgets[key]);budget.folders=Object.fromEntries(Object.entries(budget.folders??{}).map(([id,n])=>[map.get(id)??id,n]));target.monthlyBudgets[key]=budget;delete source.monthlyBudgets[key];
  if(key===periodKey(canonicalDay(new Date(opts.at)))){source.budget={total:0,categories:{}};target.budget=budget;}
 }
 // A moved folder's old budget limit belongs to the source plan, not a dangling ID.
 for(const budget of [source.budget,...Object.values(source.monthlyBudgets)])for(const id of selected.folders)if(budget.folders)delete budget.folders[id];
 for(const a of target.accounts){const funds=assetAccountFunds(target,a.id);if(funds.reserved>0&&funds.available<0)throw new Error('موجودی حساب مقصد برای پس‌انداز تخصیص‌یافته کافی نیست؛ حساب دیگری انتخاب کن یا خود حساب را منتقل کن.');}
 const audit={id:opts.requestId,at:opts.at,sourceId:opts.sourceId,targetId:opts.targetId,selection:opts.selection,items:plan.items,baselines,accountMap:opts.accountMap,originals:{...Object.fromEntries(collections.map(k=>[k,rows(original,k).filter(r=>selected[k].has(r.id))])),...(opts.selection.kind==='monthlyBudgets'?{monthlyBudget:original.monthlyBudgets[opts.selection.id]}:{})},accountEntries:movedEntries,assetOpeningRevisions:revisions};
 source.spaceTransfers=[...(source.spaceTransfers??[]),audit];target.spaceTransfers=[...(target.spaceTransfers??[]),audit];
 validate(source);validate(target);
 return {source,target,items:plan.items};
}

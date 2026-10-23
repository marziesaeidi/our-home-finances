import type { FinanceData, HouseholdMember } from './types';
export const defaultMembers: HouseholdMember[] = [{id:'مرزیه',name:'مرزیه',role:'owner'},{id:'علی',name:'علی',role:'editor'}];
export function membersOf(data: FinanceData) { return data.settings.members ?? defaultMembers; }
export function assertMemberChange(previous:FinanceData,next:FinanceData,viewer:string) {
 const current=membersOf(previous).find(m=>m.id===viewer&&!m.removed);
 if(!current)throw new Error('این عضو دیگر به فضای مشترک دسترسی ندارد.');
 if(current.role==='owner')return;
 if(previous.settings.calendarEmail!==next.settings.calendarEmail)throw new Error('فقط مالک می‌تواند ایمیل تقویم فضای مشترک را تغییر دهد.');
 const before=membersOf(previous),after=membersOf(next);
 const withoutOwnProfile=(rows:HouseholdMember[])=>rows.map(m=>m.id===viewer?{...m,avatar:undefined,name:undefined,calendarEmail:undefined}:m);
 if(JSON.stringify(withoutOwnProfile(before))!==JSON.stringify(withoutOwnProfile(after)))throw new Error('فقط مالک می‌تواند اعضا و دسترسی‌ها را تغییر دهد.');
 if(current.role==='reader') {
  const a={...previous,settings:{...previous.settings,members:undefined}};
  const b={...next,settings:{...next.settings,members:undefined}};
  if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('دسترسی این عضو فقط برای مشاهده است.');
 }
}


// Sharing is a property of the space; creator identities and audit records stay intact.
export function shareSpaceData(data: FinanceData): FinanceData {
 const next = {...data};
 for (const key of ['accounts','transactions','assets','goals','folders','obligations','loans','recurring'] as const) {
  (next as unknown as Record<string, unknown>)[key] = data[key].map(row => ({...row, visibility:'shared'}));
 }
 return next;
}

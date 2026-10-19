import { createContext, useContext, useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Dialog } from '../Dialog';
import { Button } from './ui/button';
import { errorGuidance, type ErrorDestination } from '../error-guidance';
export const ErrorNavigationContext = createContext<((destination:ErrorDestination)=>void)|null>(null);
export const ErrorDialogContext = createContext<((message:string)=>void)|null>(null);
export function ErrorNotice({message,autoPopup=true,allowNavigation=true,dialogEnabled=true}:{message:string;autoPopup?:boolean;allowNavigation?:boolean;dialogEnabled?:boolean}) {
 const navigate=useContext(ErrorNavigationContext),showDialog=useContext(ErrorDialogContext),guide=errorGuidance(message);
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(message&&dialogEnabled&&autoPopup&&guide.popup){if(showDialog)showDialog(message);else setOpen(true);}else setOpen(false);},[message,autoPopup,guide.popup,dialogEnabled,showDialog]);
 if(!message)return null;
 const navigationActions=()=>allowNavigation&&navigate&&guide.actions?.map(action=><Button type="button" key={action.destination} onClick={()=>{setOpen(false);navigate(action.destination);}}>{action.label}</Button>);
 const description=<>{!guide.hideTechnical&&<p className="error-notice-message">{message}</p>}<p className="error-notice-solution"><strong>چه کار کنم؟</strong> {guide.solution}</p>{guide.hideTechnical&&<details><summary>جزئیات خطا</summary><p dir="auto">{message}</p></details>}</>;
 return <><section className="form-error error-notice" role="alert"><div className="error-notice-heading"><CircleAlert size={20} aria-hidden="true"/><strong>{guide.title}</strong></div>{description}<div className="error-help-actions">{navigationActions()}</div>{dialogEnabled&&<Button type="button" variant="outline" onClick={()=>showDialog?showDialog(message):setOpen(true)}>راهنمای رفع خطا</Button>}</section>{open&&<Dialog title={guide.title} className="error-help-dialog" onClose={()=>setOpen(false)}><div className="error-help-copy">{description}</div><div className="error-help-actions">{navigationActions()}<Button type="button" variant="outline" onClick={()=>setOpen(false)}>برگشت</Button></div></Dialog>}</>;
}

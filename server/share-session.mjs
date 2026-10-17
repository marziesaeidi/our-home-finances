import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

export function getEmailSession(email, filename = resolve('data/khaneh.sqlite'), ownerEmail) {
  const db = new DatabaseSync(filename, {readOnly:true});
  try {
    if (ownerEmail && email.trim().toLowerCase() === ownerEmail.trim().toLowerCase()) {
      const snapshot = db.prepare('SELECT payload FROM finance_snapshots ORDER BY revision DESC LIMIT 1').get();
      const data = snapshot ? JSON.parse(snapshot.payload) : null;
      const member = data?.settings.members?.find(m=>m.role==='owner'&&!m.removed);
      return member ? {status:'approved',data,member} : {status:'unknown'};
    }
    const row = db.prepare("SELECT token,status,member_id FROM access_requests WHERE lower(email) = ? ORDER BY rowid DESC LIMIT 1").get(email.trim().toLowerCase());
    if (!row) return {status:'unknown'};
    if (row.status !== 'approved') return {status:row.status, token:row.token};
    const snapshot = db.prepare('SELECT payload FROM finance_snapshots ORDER BY revision DESC LIMIT 1').get();
    const data = snapshot ? JSON.parse(snapshot.payload) : null;
    const member = data?.settings.members.find(m=>m.id===row.member_id&&!m.removed);
    return member ? {status:'approved',data,member} : {status:'rejected'};
  } finally { db.close(); }
}

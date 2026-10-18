// Attach a registered account to an existing member of a household migrated from the
// single-household version, e.g. `node scripts/link-member.mjs owner@example.com مرزیه`.
// Run on the server (Dokploy terminal) after that person has signed up.
import { openDatabase } from '../server/database.mjs';

const [email, memberId, spaceId] = process.argv.slice(2);
if (!email || !memberId) {
  console.error('Usage: node scripts/link-member.mjs <email> <member-id> [space-id]');
  process.exit(1);
}
const database = openDatabase();
try {
  const { spaceId: linked, member } = database.linkMember(email.trim().toLowerCase(), memberId, spaceId);
  console.log(`Linked ${email} to member "${member.name}" (${member.role}) in household ${linked}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { database.close(); }

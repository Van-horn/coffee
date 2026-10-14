// Child process for the multi-process race test: opens the store, waits for a shared start time,
// claims one phone and prints the result as JSON. Run with plain `node` (type stripping).
import { createFileStore } from '../../lib/file-store.ts';

const [path, leadId, startAt] = process.argv.slice(2);
const store = createFileStore({ path });
while (Date.now() < Number(startAt)) {
  // spin: all children hit the database in the same few milliseconds
}
const result = await store.claimPhone('+375291234567', leadId, 600);
console.log(JSON.stringify({ leadId, result }));
store.close();

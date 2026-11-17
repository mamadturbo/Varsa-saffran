import { eq } from 'drizzle-orm';
import { ordersTable } from '@workspace/db/schema';
import type { db } from '@workspace/db';
import type { OrderToSave } from './create-order';

export function createOrderRepository(database: Pick<typeof db, 'insert' | 'select'>) {
  const findByKey = async (key: string) => {
    const [order] = await database.select().from(ordersTable).where(eq(ordersTable.idempotencyKey, key)).limit(1);
    return order ?? null;
  };
  const save = async (input: OrderToSave) => {
    const [created] = await database.insert(ordersTable).values(input)
      .onConflictDoNothing({ target: ordersTable.idempotencyKey }).returning();
    if (created) return created;
    // A concurrent transaction already committed this key. The unique index,
    // not a process-local cache, arbitrates creation across server instances.
    const existing = await findByKey(input.idempotencyKey);
    if (!existing) throw new Error('Could not resolve the committed order attempt');
    return existing;
  };
  return { findByKey, save };
}

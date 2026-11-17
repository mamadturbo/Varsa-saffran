import { eq, sql } from "drizzle-orm";
import { ordersTable, reservations } from "@workspace/db/schema";
import type { Database } from "../catalog/repository";
import { updateManagedOrder } from "../../lib/order-status";
import type { ManagementState } from "@workspace/catalog";

export async function expireOne(database: Database) {
  return database.transaction(async (raw) => {
    const tx = raw as unknown as Database;
    // Lock order first, exactly as cancellation. No config/document lock.
    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(
        sql`${ordersTable.status}='pending' AND NOT EXISTS (SELECT 1 FROM card_transfer_receipts p WHERE p.order_id=${ordersTable.id} AND p.status='pending') AND EXISTS (SELECT 1 FROM inventory_reservations r WHERE r.order_id=${ordersTable.id} AND r.state='reserved' AND r.expires_at<=now())`,
      )
      .orderBy(ordersTable.id)
      .for("update", { skipLocked: true })
      .limit(1);
    if (!order) return false;
    await updateManagedOrder({} as ManagementState, tx, order.id, "cancelled");
    return true;
  });
}

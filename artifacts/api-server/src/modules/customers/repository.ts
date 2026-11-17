import { eq } from "drizzle-orm";
import {
  customerAddresses,
  customerFavorites,
  customersTable,
} from "@workspace/db/schema";
import type { CustomerProfile, CustomerAddress } from "@workspace/catalog";
import type { Database } from "../catalog/repository";

export async function readProfile(
  tx: Database,
  row: { id: string; profile: Record<string, unknown> },
): Promise<CustomerProfile> {
  const addresses = await tx
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, row.id));
  const favorites = await tx
    .select()
    .from(customerFavorites)
    .where(eq(customerFavorites.customerId, row.id));
  return {
    ...row.profile,
    addresses: addresses.map(
      (a) =>
        ({
          ...a.payload,
          id: a.id,
          isDefault: a.isDefault,
        }) as unknown as CustomerAddress,
    ),
    favorites: favorites.map((f) => f.variantId),
  } as CustomerProfile;
}
export async function saveProfile(
  tx: Database,
  id: string,
  p: CustomerProfile,
) {
  const { addresses, favorites, ...profile } = p;
  await tx
    .update(customersTable)
    .set({ profile })
    .where(eq(customersTable.id, id));
  await tx
    .delete(customerAddresses)
    .where(eq(customerAddresses.customerId, id));
  for (const a of addresses)
    await tx
      .insert(customerAddresses)
      .values({
        id: a.id,
        customerId: id,
        isDefault: a.isDefault,
        payload: a as unknown as Record<string, unknown>,
      });
  await tx
    .delete(customerFavorites)
    .where(eq(customerFavorites.customerId, id));
  for (const variantId of favorites)
    await tx.insert(customerFavorites).values({ customerId: id, variantId });
}

import {
  customersTable,
  customerCasesTable,
  customerAddresses,
  customerFavorites,
  caseMessages,
} from "@workspace/db/schema";
import type { CustomerProfile, CasePayload } from "@workspace/catalog";
import type { Database } from "../catalog/repository";
import { saveProfile, readProfile } from "./repository";
import { saveMessages, readCase } from "../support/repository";
import assert from "node:assert/strict";

export async function backfillCustomerSupport(tx: Database) {
  let customers = 0,
    messages = 0;
  for (const row of await tx.select().from(customersTable)) {
    if (
      !Array.isArray(row.profile.addresses) &&
      !Array.isArray(row.profile.favorites)
    )
      continue;
    const profile = {
      ...row.profile,
      addresses: row.profile.addresses ?? [],
      favorites: row.profile.favorites ?? [],
    } as unknown as CustomerProfile;
    await saveProfile(tx, row.id, profile);
    const actual = await readProfile(tx, { ...row, profile: row.profile });
    if (
      JSON.stringify([...actual.favorites].sort()) !==
        JSON.stringify([...profile.favorites].sort()) ||
      actual.addresses.length !== profile.addresses.length
    )
      throw new Error("Customer reconciliation failed");
    assert.deepEqual(
      [...actual.addresses].sort((a, b) => a.id.localeCompare(b.id)),
      [...profile.addresses].sort((a, b) => a.id.localeCompare(b.id)),
    );
    customers++;
  }
  for (const row of await tx.select().from(customerCasesTable)) {
    if (!Array.isArray(row.payload.messages)) continue;
    const payload = row.payload as unknown as CasePayload;
    await saveMessages(tx, row.id, payload);
    const actual = await readCase(tx, row);
    if (actual.messages.length !== payload.messages.length)
      throw new Error("Support reconciliation failed");
    for (const message of payload.messages)
      assert.deepEqual(
        actual.messages.find((m) => m.id === message.id),
        { ...message, createdAt: new Date(message.createdAt).toISOString() },
      );
    messages += actual.messages.length;
  }
  return { customers, messages };
}

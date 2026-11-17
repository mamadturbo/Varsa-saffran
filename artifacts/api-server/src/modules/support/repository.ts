import { eq } from "drizzle-orm";
import { caseMessages, customerCasesTable } from "@workspace/db/schema";
import type { CasePayload, CaseMessage } from "@workspace/catalog";
import type { Database } from "../catalog/repository";

export async function readCase(
  tx: Database,
  row: { id: string; payload: Record<string, unknown> },
): Promise<CasePayload> {
  const messages = await tx
    .select()
    .from(caseMessages)
    .where(eq(caseMessages.caseId, row.id))
    .orderBy(caseMessages.createdAt, caseMessages.id);
  return {
    ...row.payload,
    messages: messages.map(
      (m) =>
        ({
          id: m.id,
          author: m.author,
          text: m.body,
          images: m.attachments,
          createdAt: m.createdAt.toISOString(),
        }) as CaseMessage,
    ),
  } as CasePayload;
}
export async function saveMessages(
  tx: Database,
  id: string,
  payload: CasePayload,
) {
  for (const m of payload.messages)
    await tx
      .insert(caseMessages)
      .values({
        id: m.id,
        caseId: id,
        author: m.author,
        body: m.text,
        attachments: m.images,
        createdAt: new Date(m.createdAt),
      })
      .onConflictDoNothing();
  const { messages: _messages, ...meta } = payload;
  await tx
    .update(customerCasesTable)
    .set({ payload: meta })
    .where(eq(customerCasesTable.id, id));
}
export async function caseViews<
  T extends { id: string; payload: Record<string, unknown> },
>(tx: Database, rows: T[]) {
  return Promise.all(
    rows.map(async (row) => ({ ...row, payload: await readCase(tx, row) })),
  );
}

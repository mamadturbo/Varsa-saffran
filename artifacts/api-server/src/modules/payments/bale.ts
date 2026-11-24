import sharp from "sharp";
import { eq } from "drizzle-orm";
import {
  baleBotState,
  cardTransferReceipts as receipts,
  ordersTable,
} from "@workspace/db/schema";
import type { Database } from "../catalog/repository";
import { digest, s3Storage } from "../files/storage";
import { StoreError } from "../../lib/management-store";
import { baleCall, type BaleCall } from "./bale-api";
import { cardTransferConfig } from "./config";
import { reviewReceipt } from "./service";

export { baleCall, type BaleCall } from "./bale-api";

export async function sendApprovalToBale(db: Database, orderId: number) {
  if (!cardTransferConfig().enabled) throw new Error("Bale disabled");
  const [order] = await db
    .select({ orderNumber: ordersTable.orderNumber })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  if (!order) throw new Error("Approved order not found");
  await baleCall("sendMessage", {
    chat_id: process.env.BALE_ADMIN_CHAT_ID,
    text: `✅ تأیید شد. پرداخت و سفارش ${order.orderNumber} تأیید شدند.`,
  });
}

export async function sendReceiptToBale(
  db: Database,
  id: string,
  call: BaleCall = baleCall,
) {
  if (!cardTransferConfig().enabled) throw new Error("Bale disabled");
  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
  if (!receipt || receipt.status !== "pending") return;
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, receipt.orderId));
  const bytes = await s3Storage().get(receipt.objectKey);
  if (bytes.length !== receipt.size || digest(bytes) !== receipt.sha256)
    throw new Error("Receipt checksum mismatch");
  const photo = await sharp(bytes).jpeg({ quality: 92 }).toBuffer();
  const form = new FormData();
  form.set("chat_id", process.env.BALE_ADMIN_CHAT_ID!);
  form.set(
    "photo",
    new Blob([new Uint8Array(photo)], { type: "image/jpeg" }),
    "receipt.jpg",
  );
  form.set(
    "caption",
    `درخواست بررسی پرداخت\nسفارش: ${order.orderNumber}\nمشتری: ${order.customerName}\nموبایل: ${order.phone}\nمبلغ: ${receipt.amount.toLocaleString("fa-IR")} تومان\nکارت مقصد: ${receipt.destination.cardNumber}\nعکس رسید ادعای پرداخت است. پس از بررسی واریز در حساب بانکی تأیید کنید.`,
  );
  form.set(
    "reply_markup",
    JSON.stringify({
      inline_keyboard: [
        [
          { text: "تأیید واریز و سفارش", callback_data: `pay:a:${id}` },
          { text: "رد رسید", callback_data: `pay:r:${id}` },
        ],
      ],
    }),
  );
  await call("sendPhoto", form);
}
export interface BaleUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}
export async function handleBaleUpdate(tx: Database, update: BaleUpdate) {
  const callback = update.callback_query;
  if (!callback) return null;
  if (
    String(callback.message?.chat.id) !== process.env.BALE_ADMIN_CHAT_ID ||
    !(process.env.BALE_ADMIN_USER_IDS ?? "")
      .split(",")
      .includes(String(callback.from?.id))
  )
    return {
      callback_query_id: callback.id,
      text: "دسترسی تأیید پرداخت ندارید.",
    };
  const match = callback.data?.match(/^pay:([ar]):([a-f0-9-]{36})$/);
  if (!match)
    return { callback_query_id: callback.id, text: "دکمه معتبر نیست." };
  try {
    const status = await reviewReceipt(
      tx,
      match[2],
      match[1] === "a" ? "approved" : "rejected",
      `bale:${callback.from.id}`,
    );
    return {
      callback_query_id: callback.id,
      text:
        status === "approved"
          ? "واریز و سفارش تأیید شد."
          : "رسید رد شد؛ مشتری می‌تواند رسید جدید ارسال کند.",
    };
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
    return { callback_query_id: callback.id, text: error.message };
  }
}
export async function pollBale(db: Database, call: BaleCall = baleCall) {
  if (!cardTransferConfig().enabled) return false;
  // One short poll at a time across workers. Keep the cursor and decisions in
  // the same commit; restarting cannot lose or apply a decision twice.
  const answers = await db.transaction(async (raw) => {
    const tx = raw as unknown as Database;
    const [state] = await tx
      .select()
      .from(baleBotState)
      .where(eq(baleBotState.id, "main"))
      .for("update", { skipLocked: true });
    if (!state) return [];
    const updates = await call<BaleUpdate[]>("getUpdates", {
      offset: state.nextOffset,
      limit: 20,
      timeout: 0,
      allowed_updates: ["callback_query"],
    });
    const result = [];
    for (const update of updates) {
      if (
        !Number.isSafeInteger(update.update_id) ||
        update.update_id < state.nextOffset
      )
        continue;
      const answer = await handleBaleUpdate(tx, update);
      if (answer) result.push(answer);
      state.nextOffset = update.update_id + 1;
    }
    await tx
      .update(baleBotState)
      .set({ nextOffset: state.nextOffset })
      .where(eq(baleBotState.id, "main"));
    return result;
  });
  // Callback acknowledgements are cosmetic; a provider failure must not roll
  // back a committed payment or block all following updates.
  for (const answer of answers)
    await call("answerCallbackQuery", answer).catch(() => {});
  return answers.length > 0;
}

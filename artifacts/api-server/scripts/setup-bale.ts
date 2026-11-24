import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { baleCall } from "../src/modules/payments/bale-api";

interface MessageUpdate {
  message?: {
    text?: string;
    chat?: { type: string; id: number };
    from?: { is_bot: boolean; id: number };
  };
}

async function main() {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(process.env.BALE_BOT_TOKEN ?? "")) {
    throw new Error(
      "توکن بازو را در BALE_BOT_TOKEN داخل فایل .env.bale تنظیم کنید.",
    );
  }

  const bot = await baleCall<{ is_bot: boolean; username?: string }>(
    "getMe",
    {},
  );
  if (!bot?.is_bot || !bot.username || !/^[A-Za-z0-9_]+$/.test(bot.username)) {
    throw new Error("نام کاربری بازو در پاسخ بله پیدا نشد.");
  }
  const webhook = await baleCall<{ url: string }>("getWebhookInfo", {});
  if (typeof webhook?.url !== "string") {
    throw new Error("وضعیت وب‌هوک بازو از بله دریافت نشد.");
  }
  if (webhook.url) {
    throw new Error(
      "این بازو وب‌هوک فعال دارد. برای راه‌اندازی از بازوی اختصاصی فروشگاه استفاده کنید.",
    );
  }

  const code = `varsa-setup-${randomBytes(12).toString("hex")}`;
  stdout.write(
    `پیوند اتصال بازو: https://ble.ir/${bot.username}?start=${code}\n`,
  );
  stdout.write(
    `از حساب مدیر، در گفت‌وگوی خصوصی بازو این پیام را بفرستید:\n\n${code}\n\n`,
  );
  stdout.write("بعد از ارسال پیام، Enter بزنید.\n");
  const terminal = createInterface({ input: stdin });
  try {
    const sent = await Promise.race([
      once(terminal, "line").then(() => true),
      once(terminal, "close").then(() => false),
    ]);
    if (!sent) throw new Error("راه‌اندازی پیش از دریافت تأیید متوقف شد.");
  } finally {
    terminal.close();
  }

  // Omit the offset so this setup command never acknowledges queued updates.
  const updates = await baleCall<MessageUpdate[]>("getUpdates", {
    limit: 100,
    timeout: 0,
  });
  const message = updates.find(
    ({ message }) =>
      message?.chat?.type === "private" &&
      (message.text === code || message.text === `/start ${code}`) &&
      Number.isSafeInteger(message.chat.id) &&
      message.chat.id > 0 &&
      message.from?.is_bot === false &&
      Number.isSafeInteger(message.from.id) &&
      message.from.id > 0,
  )?.message;
  if (!message?.chat || !message.from) {
    throw new Error(
      "پیام خصوصی با کد این اجرا پیدا نشد. فرمان را دوباره اجرا کنید و کد تازه را بفرستید.",
    );
  }

  stdout.write(`BALE_ADMIN_CHAT_ID=${message.chat.id}\n`);
  stdout.write(`BALE_ADMIN_USER_IDS=${message.from.id}\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error && error.message !== "bale_request_failed"
      ? error.message
      : "ارتباط با بله برقرار نشد. توکن و دسترسی به tapi.bale.ai را بررسی کنید.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

export function cardTransferConfig() {
  const cardNumber = (process.env.CARD_TRANSFER_NUMBER ?? "").replace(
    /[ -]/g,
    "",
  );
  const accountName = process.env.CARD_TRANSFER_ACCOUNT_NAME?.trim() ?? "";
  const bankName = process.env.CARD_TRANSFER_BANK_NAME?.trim() ?? "";
  const enabled =
    process.env.CARD_TRANSFER_ENABLED === "true" &&
    /^\d{16}$/.test(cardNumber) &&
    !!accountName &&
    !!bankName &&
    !!process.env.BALE_BOT_TOKEN &&
    /^\d+$/.test(process.env.BALE_ADMIN_CHAT_ID ?? "") &&
    /^\d+(,\d+)*$/.test(process.env.BALE_ADMIN_USER_IDS ?? "");
  return enabled
    ? { enabled: true as const, cardNumber, accountName, bankName }
    : { enabled: false as const };
}

export type BaleCall = <T = unknown>(
  method: string,
  payload: Record<string, unknown> | FormData,
) => Promise<T>;

export const baleCall: BaleCall = async <T>(
  method: string,
  payload: Record<string, unknown> | FormData,
) => {
  const token = process.env.BALE_BOT_TOKEN;
  if (!token) throw new Error("Bale not configured");
  // The request URL contains the bot token. Keep it out of errors and logs.
  try {
    const multipart = payload instanceof FormData;
    const response = await fetch(`https://tapi.bale.ai/bot${token}/${method}`, {
      method: "POST",
      ...(multipart ? {} : { headers: { "Content-Type": "application/json" } }),
      body: multipart ? payload : JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const body = (await response.json()) as { ok: boolean; result: T };
    if (!response.ok || body.ok !== true)
      throw new Error("Bale rejected request");
    return body.result;
  } catch {
    throw new Error("bale_request_failed");
  }
};

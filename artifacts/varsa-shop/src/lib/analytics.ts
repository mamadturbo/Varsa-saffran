import type { Product } from "./types";

interface Item {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity: number;
}

type Event =
  | { name: "page_view"; page_location: string; ai_source?: string }
  | {
      name:
        | "view_item"
        | "add_to_cart"
        | "begin_checkout"
        | "order_request_submitted";
      currency: "IRR";
      value: number;
      items: Item[];
    };

let enabled = false;
let adapter:
  { consent: () => boolean; send: (event: Event) => void } | undefined;

export function configureMeasurement(
  origin: string | undefined,
  indexable: boolean,
) {
  enabled = indexable && location.origin === origin;
}

/** Installed by the site's approved consent manager and analytics adapter. */
export function connectMeasurement(collector: NonNullable<typeof adapter>) {
  adapter = collector;
  return () => {
    if (adapter === collector) adapter = undefined;
  };
}

function measure(event: Event) {
  if (!enabled || !adapter) return;
  try {
    if (adapter.consent()) adapter.send(event);
  } catch {
    // Measurement must never interrupt navigation or ordering.
  }
}

const aiHosts = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "www.perplexity.ai",
  "perplexity.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
]);

export function measurePage(url: string, firstPage: boolean) {
  let ai_source: string | undefined;
  if (firstPage) {
    try {
      const host = new URL(document.referrer).hostname;
      if (aiHosts.has(host)) ai_source = host;
    } catch {
      /* Referrer suppressed or absent. */
    }
  }
  measure({
    name: "page_view",
    page_location: url,
    ...(ai_source ? { ai_source } : {}),
  });
}

export function measureCommerce(
  name: Exclude<Event, { name: "page_view" }>["name"],
  rows: {
    product: Product;
    quantity: number;
  }[],
) {
  if (!enabled || !adapter || rows.length === 0) return;
  const items = rows.map(({ product, quantity }) => ({
    item_id: product.id,
    item_name: product.name,
    item_category: product.category,
    price: product.price * 10,
    quantity,
  }));
  measure({
    name,
    currency: "IRR",
    value: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    items,
  });
}

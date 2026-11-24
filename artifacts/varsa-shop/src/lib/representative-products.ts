import type { StorefrontProduct } from "@workspace/catalog";
import { weightUnit } from "./product-comparison";

export const cutStudy = {
  url: "https://doi.org/10.1002/fsn3.1478",
  label: "پژوهش دربارهٔ تفاوت ظاهری برش‌های زعفران",
};

type Selection = {
  category: StorefrontProduct["category"];
  use: string;
  cut: string;
  source: typeof cutStudy;
};

const selections: Record<string, Selection> = {
  "super-negin-1-mesghal": {
    category: "سوپر نگین",
    use: "برای هدیه یا تزیین غذا، وقتی ظاهر رشته‌ها اولویت خرید است.",
    cut: "در توصیف اتحادیه، سوپر نگین می‌تواند به رشته‌های قرمز و ضخیمی گفته شود که خامهٔ زرد از آن‌ها جدا شده است.",
    source: {
      url: "https://iransaffronunion.com/انواع-دسته-بندی-زعفران/",
      label: "دسته‌بندی اتحادیهٔ صادرکنندگان زعفران خراسان رضوی",
    },
  },
  "negin-1-mesghal": {
    category: "نگین",
    use: "برای آشپزی و پذیرایی، وقتی می‌خواهید هم مبلغ بسته و هم ظاهر رشته‌ها را در نظر بگیرید.",
    cut: "در توصیف رایج نگین، رشته‌های قرمز کلاله از هم جدا هستند.",
    source: cutStudy,
  },
  "poshal-1-mesghal": {
    category: "پوشال",
    use: "برای آشپزی روزمره، وقتی هزینهٔ خرید بسته در اولویت است.",
    cut: "در پوشال معمولاً بخش کوتاهی از خامهٔ روشن در انتهای رشته‌های قرمز باقی می‌ماند.",
    source: cutStudy,
  },
};

export function representativeSelection(product: StorefrontProduct) {
  const selection = Object.hasOwn(selections, product.slug) ? selections[product.slug] : undefined;
  if (product.active === false || product.weight !== 1 || weightUnit(product.weight_unit) !== "مثقال") {
    return undefined;
  }
  return selection?.category === product.category ? selection : undefined;
}

export function representativeProducts(products: readonly StorefrontProduct[] = []) {
  return products.filter(representativeSelection).sort((a, b) => a.price - b.price);
}

export function productSummary(product: StorefrontProduct) {
  const description = product.short_description || product.long_description || "";
  const selection = representativeSelection(product);
  return selection ? [description, selection.use].filter(Boolean).join(" ") : description;
}

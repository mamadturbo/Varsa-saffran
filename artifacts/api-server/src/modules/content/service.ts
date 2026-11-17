import type { ManagementStore } from "../catalog/store";
import { legacyArticles } from "./router";

export async function importLegacyArticles(store: ManagementStore) {
  const current = await store.read();
  if (current.legacyArticlesEnabled === false)
    return { imported: 0, alreadyImported: true };
  const legacy = await legacyArticles();
  await store.mutate(async (state) => {
    if (state.legacyArticlesEnabled === false) return;
    const overrides = state.articles ?? [];
    state.articles = [
      ...legacy.filter((a) => !overrides.some((o) => o.slug === a.slug)),
      ...overrides,
    ];
    state.legacyArticlesEnabled = false;
  });
  const actual = await store.read();
  if (
    actual.legacyArticlesEnabled !== false ||
    legacy.some((a) => !actual.articles?.some((m) => m.slug === a.slug))
  )
    throw new Error("Article reconciliation failed");
  return { imported: legacy.length, alreadyImported: false };
}

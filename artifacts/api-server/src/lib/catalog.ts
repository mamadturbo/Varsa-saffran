import { getRestoredCatalog } from '@workspace/catalog';

export async function loadOrderCatalog() {
  return getRestoredCatalog(process.env.BASE_PATH ?? '/');
}

interface FocusTarget {
  node: HTMLElement;
  id: string;
  href: string | null;
  label: string | null;
}

const routeTriggers = new Map<string, FocusTarget>();
let pendingRouteFocus: { target: FocusTarget; fallback: HTMLElement | null } | null = null;

export function captureFocusTarget(node: Element | null): FocusTarget | null {
  if (!(node instanceof HTMLElement) || node === document.body) return null;
  return { node, id: node.id, href: node.getAttribute('href'), label: node.getAttribute('aria-label') };
}

// Route navigation unmounts the invoking card before its product is fetched.
// Keep only a short-lived in-memory descriptor, never customer or stored data.
export function rememberDialogTrigger(id: string, node: HTMLElement) {
  const target = captureFocusTarget(node);
  if (target) routeTriggers.set(id, target);
}
export const rememberedDialogTrigger = (id: string) => routeTriggers.get(id) ?? null;
export const forgetDialogTrigger = (id: string) => { routeTriggers.delete(id); };

const available = (node: HTMLElement | null | undefined): node is HTMLElement =>
  !!node?.isConnected && !node.closest('[inert], [aria-hidden="true"]') && node.getClientRects().length > 0 &&
  getComputedStyle(node).visibility !== 'hidden';

function equivalentLink(target: FocusTarget) {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => link.getAttribute('href') === target.href);
  return links.find(link => link.getAttribute('aria-label') === target.label && available(link)) ?? links.find(available);
}

export const clearPendingDialogFocus = () => { pendingRouteFocus = null; };
export function restorePendingDialogFocus() {
  const pending = pendingRouteFocus;
  pendingRouteFocus = null;
  if (!pending || document.querySelector('[data-store-dialog][data-state="open"]') ||
      (document.activeElement !== pending.fallback && document.activeElement !== document.body)) return;
  equivalentLink(pending.target)?.focus();
}

export function restoreDialogFocus(target: FocusTarget | null) {
  pendingRouteFocus = null;
  const dialogs = [...document.querySelectorAll<HTMLElement>('[data-store-dialog][data-state="open"]')];
  const top = dialogs.at(-1);
  const opener = target?.node;
  if (top) {
    // Closing a nested checkout resumes the cart; replacing a product with a
    // cart must not move focus back behind that newly opened dialog.
    if (available(opener) && top.contains(opener)) opener.focus();
    else if (!top.contains(document.activeElement)) top.focus();
    return;
  }
  if (available(opener)) { opener.focus(); return; }
  const idMatch = target?.id ? document.getElementById(target.id) : null;
  if (available(idMatch)) { idMatch.focus(); return; }
  if (target?.href) {
    const match = equivalentLink(target);
    if (match) { match.focus(); return; }
  }
  const fallback = document.querySelector<HTMLElement>('main h1[tabindex="-1"]') ?? document.querySelector<HTMLElement>('[data-focus-fallback]');
  fallback?.focus({ preventScroll: true });
  // The route's catalog request may still be loading when the portal closes.
  // Resume only if the user has not moved focus elsewhere in the meantime.
  if (target?.href) pendingRouteFocus = { target, fallback };
}

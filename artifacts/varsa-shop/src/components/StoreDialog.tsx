import { useRef, type ReactNode, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { captureFocusTarget, clearPendingDialogFocus, rememberedDialogTrigger, restoreDialogFocus } from '@/lib/dialog-focus';

interface StoreDialogProps {
  id: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className: string;
  layer: number;
  initialFocus?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
  busy?: boolean;
  focusAfterClose?: () => HTMLElement | null;
}

export const StoreDialogTitle = Dialog.Title;

export function StoreDialog({ id, open, onClose, children, className, layer, initialFocus, dismissible = true, busy, focusAfterClose }: StoreDialogProps) {
  const returnFocus = useRef<ReturnType<typeof captureFocusTarget>>(null);
  const lowerLayers = useRef<{ node: HTMLElement; wasInert: boolean }[]>([]);
  return <Dialog.Root open={open} onOpenChange={next => { if (!next && dismissible) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-ink-950/80 backdrop-blur-md" style={{ zIndex: layer - 1 }} />
      <Dialog.Content id={id} data-store-dialog="" data-dialog-layer={layer} dir="rtl" aria-modal="true" aria-describedby={undefined} aria-busy={busy || undefined}
        className={className} style={{ zIndex: layer }}
        onOpenAutoFocus={event => {
          clearPendingDialogFocus();
          returnFocus.current = rememberedDialogTrigger(id) ?? captureFocusTarget(document.activeElement);
          // Live regions can be exempted from aria-hidden by the primitive.
          // Make underlying dialogs inert as well, including the cart's live
          // quantity text, while a higher dialog owns keyboard interaction.
          lowerLayers.current = [...document.querySelectorAll<HTMLElement>('[data-store-dialog]')]
            .filter(node => node.id !== id && Number(node.dataset.dialogLayer) < layer)
            .map(node => ({ node, wasInert: node.inert }));
          lowerLayers.current.forEach(({ node }) => { node.inert = true; });
          if (initialFocus?.current) { event.preventDefault(); initialFocus.current.focus(); }
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          lowerLayers.current.forEach(({ node, wasInert }) => { node.inert = wasInert; });
          lowerLayers.current = [];
          const nextFocus = focusAfterClose?.();
          restoreDialogFocus(nextFocus ? captureFocusTarget(nextFocus) : returnFocus.current);
        }}
        onEscapeKeyDown={event => { if (!dismissible) event.preventDefault(); }}
        onPointerDownOutside={event => {
          if (!dismissible) {
            event.preventDefault();
            event.detail.originalEvent.preventDefault();
            initialFocus?.current?.focus({ preventScroll: true });
          }
        }}>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

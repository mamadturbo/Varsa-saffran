import { useEffect, useRef, useState } from 'react';

/**
 * Adds the `is-visible` class to any descendant `.reveal` elements when they
 * enter the viewport. Returns a ref to attach to the scroll container.
 * Uses a MutationObserver so elements added asynchronously (e.g. after a
 * data fetch) are picked up automatically.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const seen = new WeakSet<HTMLElement>();

    const reveal = (el: HTMLElement) => {
      el.classList.add('is-visible');
    };

    if (typeof IntersectionObserver === 'undefined') {
      const scanAll = () =>
        Array.from(root.querySelectorAll<HTMLElement>('.reveal')).forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            reveal(el);
          }
        });
      scanAll();
      const mo = new MutationObserver(scanAll);
      mo.observe(root, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    const scan = () => {
      Array.from(root.querySelectorAll<HTMLElement>('.reveal')).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          reveal(el);
        } else {
          io.observe(el);
        }
      });
    };

    scan();

    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return ref;
}

/** Tracks the active section id based on scroll position. */
export function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const handler = () => {
      const offset = window.innerHeight * 0.35;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= offset) {
          current = id;
        }
      }
      setActive(current);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [ids]);

  return active;
}

/** True once the page has scrolled past `offset` px. */
export function useScrolled(offset = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > offset);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [offset]);
  return scrolled;
}

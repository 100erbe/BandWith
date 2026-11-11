import type React from 'react';

/** A text field has focus, so the on-screen keyboard is (or is about to be) up. */
const typing = (): boolean => {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
};

/**
 * Handlers for a button tapped while the keyboard is open (search results,
 * pickers under a field). Normally that first tap only blurs the field: the
 * keyboard closes, the web view grows, the list moves and the click misses,
 * so it takes a second tap. Here the field keeps its focus during the touch,
 * the tap runs on touch end (only if the finger didn't move, so scrolling
 * still works) and the keyboard closes after.
 */
export function keyboardSafeTap(onTap: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch' && typing()) e.preventDefault();
    },
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      if (!t) return;
      e.currentTarget.dataset.tapX = String(t.clientX);
      e.currentTarget.dataset.tapY = String(t.clientY);
    },
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => {
      if (!typing()) return; // the normal click follows
      const t = e.changedTouches[0];
      const x = Number(e.currentTarget.dataset.tapX);
      const y = Number(e.currentTarget.dataset.tapY);
      if (!t || Number.isNaN(x) || Math.hypot(t.clientX - x, t.clientY - y) > 10) return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
      onTap();
    },
    onClick: onTap,
  };
}

/**
 * Focuses a hidden field inside the user's tap, so iOS opens the keyboard;
 * the screen being opened then moves the focus to its own field (iOS only
 * shows the keyboard for a focus that starts in a gesture).
 */
export function primeKeyboard(): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('bw-keyboard-primer') as HTMLInputElement | null;
  if (!el) {
    el = document.createElement('input');
    el.id = 'bw-keyboard-primer';
    el.type = 'text';
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    // 16px: iOS zooms into smaller fields.
    el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none;';
    el.addEventListener('blur', () => { el!.value = ''; });
    document.body.appendChild(el);
  }
  el.focus({ preventScroll: true });
}

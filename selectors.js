// selectors.js
// Centralizes DOM lookups for Instagram's carousel controls (spec §4).
// Instagram's class names are generated and churn across releases; the
// aria-label on the Next/Previous buttons has historically been the
// stable part. If Instagram changes this, only this file should need
// to change — confirm the real label by inspecting a live post before
// relying on this in production.

const KBSelectors = (() => {
  const NEXT_LABELS = ['Next'];

  function findByAriaLabel(labels) {
    for (const label of labels) {
      const el = document.querySelector(
        `button[aria-label="${label}"], div[role="button"][aria-label="${label}"]`
      );
      if (el) return el;
    }
    return null;
  }

  function findCarouselContainer() {
    return document.querySelector('main article') || document.querySelector('article');
  }

  // Fallback when no aria-label button is found: click near the carousel's
  // right edge. Cruder, but independent of Instagram's markup.
  function clickByGeometry() {
    const container = findCarouselContainer();
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    const x = rect.right - 24;
    const y = rect.top + rect.height / 2;
    const target = document.elementFromPoint(x, y);
    if (!target) return false;
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      target.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
      );
    }
    return true;
  }

  function clickNext() {
    const btn = findByAriaLabel(NEXT_LABELS);
    if (btn) {
      btn.click();
      return true;
    }
    return clickByGeometry();
  }

  return { clickNext, findCarouselContainer };
})();

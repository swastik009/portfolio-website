export function bringToFront(order, id) {
  return [...order.filter((x) => x !== id), id];
}

export function clampSize(w, h, { minW, minH, maxW, maxH }) {
  return { w: Math.min(Math.max(w, minW), maxW), h: Math.min(Math.max(h, minH), maxH) };
}

export const allowClose = (w) => !w?.onCloseRequest || w.onCloseRequest() !== false;

// A window stays fully on the desktop, above the taskbar: when it opens (a cascade) and while it's dragged.
export function fitPosition(x, y, w, h, bounds) {
  return {
    x: Math.max(0, Math.min(x, bounds.w - w)),
    y: Math.max(0, Math.min(y, bounds.h - bounds.taskbar - h)),
  };
}

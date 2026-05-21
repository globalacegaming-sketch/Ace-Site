/** Gate autofocus so mobile keyboards do not open on page load. */
export function shouldAuthAutoFocus(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(max-width: 767px)').matches;
}

export function scrollAuthFieldIntoView(target: EventTarget | null): void {
  const el =
    target instanceof HTMLElement
      ? target
      : target instanceof HTMLInputElement
        ? target
        : null;
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

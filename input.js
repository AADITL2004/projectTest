/*
 * input.js: input sources are kept separate from story progression.
 * Every input calls the same commands ("next", "prev", "restart", "goto").
 * A future webcam mudra recogniser can plug in by calling
 * commands.dispatch('next') when it recognises a gesture, with no engine changes.
 */

export class Commands {
  constructor() { this.handlers = {}; }
  on(name, fn) { this.handlers[name] = fn; }
  dispatch(name, arg, source = 'unknown') {
    const fn = this.handlers[name];
    if (fn) fn(arg, source);
  }
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function initialiseKeyboardNavigation(commands, isActive) {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (TYPING.has(t.tagName) || t.isContentEditable) return;
    if (document.querySelector('dialog[open]')) return;
    const state = isActive();
    if (state === 'intro') {
      if (e.key === 'ArrowRight' || (e.key === ' ' && t.tagName !== 'BUTTON')) { e.preventDefault(); commands.dispatch('start', null, 'keyboard'); }
      return;
    }
    if (state !== 'story') return;
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault(); commands.dispatch('next', null, 'keyboard'); break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault(); commands.dispatch('prev', null, 'keyboard'); break;
      case ' ':
        // Space activates a focused button natively, so only treat it as "next" elsewhere.
        if (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SUMMARY') return;
        e.preventDefault(); commands.dispatch('next', null, 'keyboard'); break;
      case 'Home':
        e.preventDefault(); commands.dispatch('goto', 0, 'keyboard'); break;
      case 'End':
        e.preventDefault(); commands.dispatch('goto', -1, 'keyboard'); break;
      default:
    }
  });
}

/*
 * Pointer parallax: the pointer sets a target, and gsap.quickTo eases toward it.
 * No new timelines are created per mouse move. Touch and pen input are ignored.
 */
export function initialiseParallax(stage, pointer, isEnabled) {
  const qx = gsap.quickTo(pointer, 'x', { duration: 1.2, ease: 'power3.out' });
  const qy = gsap.quickTo(pointer, 'y', { duration: 1.2, ease: 'power3.out' });
  const reset = () => { qx(0); qy(0); };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !isEnabled()) return;
    const r = stage.getBoundingClientRect();
    qx(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)));
    qy(Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)));
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  return { reset };
}

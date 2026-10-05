import { realTimers } from './core.js';

// Clipboard write with a legacy fallback, plus the copied-state feedback loop.
export async function copyText(text, env = globalThis) {
  try {
    if (env.navigator && env.navigator.clipboard && env.navigator.clipboard.writeText) {
      await env.navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  try {
    const d = env.document;
    const ta = d.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
    d.body.appendChild(ta); ta.select();
    const ok = d.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch { return false; }
}

export function wireCopy(el, { copy = copyText, timers = realTimers, ms = 1600, live = null } = {}) {
  if (!el || el.getAttribute('data-live') !== 'true') return null;
  let t = null;
  const handler = async () => {
    const text = el.getAttribute('data-copy');
    if (!text) return false;
    const ok = await copy(text);
    el.setAttribute('data-state', ok ? 'copied' : 'failed');
    if (live) live.textContent = ok ? 'Copied to clipboard' : 'Copy failed';
    if (t != null) timers.clear(t);
    t = timers.set(() => { el.removeAttribute('data-state'); if (live) live.textContent = ''; t = null; }, ms);
    return ok;
  };
  el.addEventListener('click', handler);
  return handler;
}

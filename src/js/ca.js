// Register helpers shared by the page renderer, the runtime and the gates.
// The address check is a full-shape test (0x + 40 hex, any letter case). It is
// deliberately not a prefix or checksum gate: valid hex must never be refused.
export const STATES = ['stated', 'absent', 'unconfirmed'];
const ADDR = /^0x[0-9a-fA-F]{40}$/;

export const isAddress = (v) => typeof v === 'string' && ADDR.test(v.trim());
export const isStated = (rec) => !!rec && rec.state === 'stated' && rec.value != null && rec.value !== '';
export const contractLive = (rec) => isStated(rec) && isAddress(rec.value);
export const linkLive = (rec) => {
  if (!isStated(rec)) return false;
  try { return new URL(rec.value).protocol === 'https:'; } catch { return false; }
};
// Store the URL, derive the handle. Nothing else is kept.
export const handleOf = (url) => {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? '@' + seg : '';
  } catch { return ''; }
};
export const shortAddr = (a) => a.slice(0, 6) + '…' + a.slice(-4);

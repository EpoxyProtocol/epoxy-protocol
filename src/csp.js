// One definition of the policy. The header file and the meta tag are both made from it,
// and the gates re-derive it to prove every live origin is covered.
import { LIVE_ORIGINS } from './js/sources.js';

export function originOf(url) { return new URL(url).origin; }

export function connectOrigins(reg) {
  return [originOf(reg.chain.value.rpc), LIVE_ORIGINS.llama, LIVE_ORIGINS.dex];
}

export function buildCsp(reg, { bootHash, meta = false } = {}) {
  const d = {
    'default-src': ["'none'"],
    'script-src': ["'self'", bootHash ? `'sha256-${bootHash}'` : null].filter(Boolean),
    'style-src': ["'self'"],
    'font-src': ["'self'"],
    'img-src': ["'self'", 'data:', LIVE_ORIGINS.dexImg],
    'connect-src': ["'self'", ...connectOrigins(reg)],
    'manifest-src': ["'self'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'object-src': ["'none'"],
  };
  if (!meta) d['frame-ancestors'] = ["'none'"];
  const parts = Object.entries(d).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!meta) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function buildHeaders(reg, csp) {
  return `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=86400

/index.html
  Cache-Control: no-cache
`;
}

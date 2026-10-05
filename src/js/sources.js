import { DASH } from './core.js';

export const LLAMA_URL = 'https://api.llama.fi/v2/chains';
export const DEX_URL = 'https://api.dexscreener.com/latest/dex/search?q=robinhood';
export const DEX_TAG = 'robinhood';
export const DEX_IMG_HOSTS = ['cdn.dexscreener.com'];
export const LIVE_ORIGINS = {
  llama: 'https://api.llama.fi',
  dex: 'https://api.dexscreener.com',
  dexImg: 'https://cdn.dexscreener.com',
};

export async function rpcCall(fetchFn, url, method, params = [], signal) {
  const res = await fetchFn(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error('rpc http ' + res.status);
  const j = await res.json();
  if (j.error) throw new Error('rpc ' + (j.error.message || j.error.code));
  return j.result;
}

const hexInt = (h) => (typeof h === 'string' && /^0x[0-9a-fA-F]+$/.test(h) ? parseInt(h, 16) : NaN);
export function parseBlock(b) {
  if (!b || typeof b !== 'object') throw new Error('empty block');
  const number = hexInt(b.number);
  if (!Number.isFinite(number)) throw new Error('bad block number');
  return {
    number,
    timestamp: hexInt(b.timestamp),
    txs: Array.isArray(b.transactions) ? b.transactions.length : NaN,
    gasUsed: hexInt(b.gasUsed),
    hash: typeof b.hash === 'string' ? b.hash : '',
  };
}

// Match by chain id, never by display name.
export function pickChainTvl(list, chainId) {
  if (!Array.isArray(list)) return null;
  const hit = list.find((c) => c && Number(c.chainId) === Number(chainId));
  const tvl = hit ? Number(hit.tvl) : NaN;
  return Number.isFinite(tvl) ? tvl : null;
}

export function topPairs(json, { tag = DEX_TAG, limit = 8 } = {}) {
  const pairs = json && Array.isArray(json.pairs) ? json.pairs : [];
  const seen = new Set();
  const rows = [];
  for (const p of pairs) {
    if (!p || p.chainId !== tag || !p.baseToken || seen.has(p.pairAddress)) continue;
    seen.add(p.pairAddress);
    let logo = '';
    try {
      const u = new URL(p.info && p.info.imageUrl);
      if (u.protocol === 'https:' && DEX_IMG_HOSTS.includes(u.hostname)) logo = u.href;
    } catch { /* no logo */ }
    const vol = Number(p.volume && p.volume.h24);
    const chg = Number(p.priceChange && p.priceChange.h24);
    rows.push({
      key: p.pairAddress,
      symbol: String(p.baseToken.symbol || DASH).slice(0, 14),
      quote: String((p.quoteToken && p.quoteToken.symbol) || '').slice(0, 8),
      priceUsd: p.priceUsd,
      volume24: Number.isFinite(vol) ? vol : null,
      change24: Number.isFinite(chg) ? chg : null,
      logo,
      url: typeof p.url === 'string' && p.url.startsWith('https://dexscreener.com/') ? p.url : '',
    });
  }
  rows.sort((a, b) => (b.volume24 ?? -1) - (a.volume24 ?? -1));
  return rows.slice(0, limit);
}

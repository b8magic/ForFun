/** UUID v4 from the platform CSPRNG (expo-crypto on native, Web Crypto on web). */
import * as Crypto from 'expo-crypto';

export function newId(): string {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === 'string' && id.length >= 32) return id;
    throw new Error('no uuid');
  } catch {
    const g = globalThis.crypto;
    if (g?.randomUUID) return g.randomUUID();
    const b = new Uint8Array(16);
    g.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
}

export const nowIso = () => new Date().toISOString();

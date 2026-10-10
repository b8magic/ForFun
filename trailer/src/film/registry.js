// Act registry (kept separate to avoid circular-import TDZ issues).
export const extra = [];
export function register(fn) { extra.push(fn); }

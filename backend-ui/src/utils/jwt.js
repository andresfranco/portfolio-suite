// Lightweight JWT helpers (no external deps)
// Note: This does not validate signatures; it only decodes payload and checks exp.

function base64UrlDecode(str) {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const decoded = atob(padded);
    // Convert binary string to UTF-8
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (e) {
    return null;
  }
}

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payloadJson = base64UrlDecode(parts[1]);
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}

export function getTokenExpiry(token) {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  // exp is in seconds since epoch
  return payload.exp * 1000;
}

export function isTokenExpired(token, skewMs = 0) {
  const expMs = getTokenExpiry(token);
  if (!expMs) return false; // If no exp, assume not expired to avoid false negatives
  const now = Date.now();
  return now + skewMs >= expMs;
}

export function msUntilExpiry(token) {
  const expMs = getTokenExpiry(token);
  if (!expMs) return null;
  return Math.max(0, expMs - Date.now());
}

export default {
  decodeJwt,
  getTokenExpiry,
  isTokenExpired,
  msUntilExpiry,
};

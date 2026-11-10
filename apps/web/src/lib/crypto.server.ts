// Web Crypto only (works on the edge runtime and in Node).
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
export const ITERATIONS = 100_000; // edge runtime caps PBKDF2 at 100k

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256),
  );
}
export function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return d === 0;
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [alg, it, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2" || !it || !salt || !hash) return false;
  return safeEqual(await derive(password, unb64(salt), Number(it)), unb64(hash));
}
export const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(32)));
export async function sha256Hex(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
/** CSRF token bound to the session token; never stored, recomputed per request. */
export const csrfFor = async (sessionToken: string) =>
  (await sha256Hex(`csrf:${sessionToken}`)).slice(0, 43);
export async function csrfMatches(sessionToken: string, provided: unknown) {
  if (typeof provided !== "string") return false;
  return safeEqual(enc.encode(await csrfFor(sessionToken)), enc.encode(provided));
}

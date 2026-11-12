// Only per-user session credentials enter the browser. Infrastructure secrets stay on Azure.
const SESSION_KEY = "devrescue.api-session";
export const API_BASE = (import.meta.env["VITE_API_BASE_URL"] || "").replace(/\/$/, "");
type AnyFn = (...args: never[]) => Promise<unknown>;
const getToken = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
export function rpc<F extends AnyFn>(name: string): F {
  return (async (options?: { data?: unknown }) => {
    if (!API_BASE)
      throw new Error(
        "API endpoint is not configured. Set the public API URL in the Pages deployment settings.",
      );
    const endpoint = new URL(API_BASE);
    if (
      endpoint.protocol !== "https:" &&
      !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))
    ) {
      throw new Error("The API endpoint must use HTTPS.");
    }
    const method = ["getSyncStatus", "accessStatus"].includes(name) ? "GET" : "POST";
    const token = getToken();
    const response = await fetch(`${API_BASE}/api/${name}`, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
      headers: {
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(options?.data ?? {}) } : {}),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "API request failed");
    if (name === "authenticate" && payload.ok && payload.sessionToken) {
      try {
        sessionStorage.setItem(SESSION_KEY, payload.sessionToken);
      } catch {
        /* cookie remains available */
      }
      delete payload.sessionToken;
    }
    if (name === "signOut")
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* no storage */
      }
    return payload;
  }) as unknown as F;
}
// Server function references are stable API clients; this preserves component call signatures.
export function useServerFn<F extends AnyFn>(fn: F): F {
  return fn;
}

import { createHmac, createHash } from "node:crypto";
export function callbackUrl() {
  const origin = process.env["API_ORIGIN"];
  if (!origin) throw Error("API_ORIGIN not configured");
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")
    throw Error("API_ORIGIN must use HTTPS");
  return new URL("/api/public/github/return", url).toString();
}
function verifier(nonce: string, session: string) {
  const key = process.env["TOKEN_ENCRYPTION_KEY"] || process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!key) throw Error("Token encryption key not configured");
  return createHmac("sha256", key).update(`github-pkce:${nonce}:${session}`).digest("base64url");
}
export function authorizationUrl(nonce: string, session: string) {
  const clientId = process.env["GITHUB_CLIENT_ID"];
  if (!clientId) throw Error("GITHUB_CLIENT_ID not configured");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(),
    scope: "read:user",
    state: nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier(nonce, session)).digest("base64url"),
  }).toString();
  return url.toString();
}
export async function exchangeCode(code: string, nonce: string, session: string) {
  const id = process.env["GITHUB_CLIENT_ID"],
    secret = process.env["GITHUB_CLIENT_SECRET"];
  if (!id || !secret) throw Error("GitHub OAuth not configured");
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: callbackUrl(),
      code_verifier: verifier(nonce, session),
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || data.error || !data.access_token) throw Error("GitHub authorization failed");
  return data.access_token;
}
export async function callAsAppUser(token: string, pathname: string, body?: unknown) {
  if (!["/user", "/graphql"].includes(pathname)) throw Error("Unsupported GitHub endpoint");
  return fetch("https://api.github.com" + pathname, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "DevRescue",
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
}

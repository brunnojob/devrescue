// Server-only: import exclusively through server helpers/functions.
const gateway = "https://connector-gateway.lovable.dev";
function headers() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("GitHub configuration unavailable");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
export async function authorizeAppUserOAuth(params: { appUserId: string; returnUrl: string }) {
  const client = process.env["GITHUB_APP_USER_CONNECTOR_CLIENT_API_KEY"];
  if (!client) throw new Error("GitHub configuration unavailable");
  const res = await fetch(`${gateway}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: { ...headers(), "X-Client-Api-Key": client },
    body: JSON.stringify({
      connector_id: "github",
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: { scopes: ["read:user"] },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("GitHub connection unavailable");
  const data = (await res.json()) as { authorization_url?: string };
  if (!data.authorization_url || new URL(data.authorization_url).protocol !== "https:")
    throw new Error("GitHub connection unavailable");
  return { authorizationUrl: data.authorization_url };
}
export async function exchangeAppUserOAuthCode(code: string) {
  const res = await fetch(`${gateway}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("GitHub connection unavailable");
  const data = (await res.json()) as { api_key?: string; connector_id?: string };
  if (data.connector_id !== "github" || !data.api_key)
    throw new Error("GitHub connection unavailable");
  return { connectionAPIKey: data.api_key, connectorId: data.connector_id };
}
export async function callAsAppUser(connectionAPIKey: string, path: string, body?: object) {
  return fetch(`${gateway}/github${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...headers(),
      "X-Connection-Api-Key": connectionAPIKey,
      "X-Lovable-Required-Scopes": "read:user",
      Accept: "application/vnd.github+json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
}

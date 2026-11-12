import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { requestContext } from "./rpc";
import * as sync from "./sync";
import * as access from "./access";

type Endpoint = { (options?: { data: never }): Promise<unknown>; httpMethod: string };
const endpoints: Record<string, Endpoint> = { ...sync, ...access };
const MAX_BODY = 96 * 1024;
export function frontendUrl() {
  const site = new URL(process.env["PUBLIC_SITE_URL"] || "https://brunnojob.github.io/devrescue/");
  if (site.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(site.hostname))
    throw Error("Frontend must use HTTPS");
  return site;
}
export function oauthReturn(url: URL) {
  const target = frontendUrl();
  const code = url.searchParams.get("code") || "",
    state = url.searchParams.get("state") || "";
  const valid = code.length > 0 && code.length <= 4096 && /^[A-Za-z0-9_-]{32,100}$/.test(state);
  target.hash =
    "/oauth-return?" +
    new URLSearchParams({ code: valid ? code : "", nonce: valid ? state : "" }).toString();
  return target.toString();
}
async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY) throw Object.assign(Error("Request too large"), { status: 413 });
    chunks.push(bytes);
  }
  const value = Buffer.concat(chunks).toString("utf8");
  return value ? JSON.parse(value) : {};
}
export function createApiServer() {
  const rate = new Map<string, { start: number; count: number }>();
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const allowed = frontendUrl().origin;
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("vary", "Origin");
    const send = (status: number, payload: unknown) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(payload));
    };
    if (origin && origin !== allowed) return send(403, { error: "Origin not allowed" });
    if (origin) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("access-control-allow-headers", "Content-Type, Authorization");
      res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(req.url || "/", process.env["API_ORIGIN"] || "http://127.0.0.1");
    if (url.pathname === "/health" && req.method === "GET")
      return send(200, { status: "ok", service: "devrescue-api" });
    if (url.pathname === "/api/public/github/return" && req.method === "GET") {
      res.statusCode = 302;
      res.setHeader("location", oauthReturn(url));
      res.end();
      return;
    }
    const key = req.socket.remoteAddress || "unknown",
      now = Date.now();
    for (const [ip, entry] of rate) if (now - entry.start > 60000) rate.delete(ip);
    const entry = rate.get(key) || { start: now, count: 0 };
    entry.count++;
    rate.set(key, entry);
    if (entry.count > 120) {
      res.setHeader("retry-after", "60");
      return send(429, { error: "Too many requests" });
    }
    const name = url.pathname.match(/^\/api\/([A-Za-z]+)$/)?.[1],
      fn = name && Object.hasOwn(endpoints, name) ? endpoints[name] : null;
    if (!fn) return send(404, { error: "Endpoint not found" });
    if (req.method !== fn.httpMethod) return send(405, { error: "Method not allowed" });
    if (req.method === "POST" && origin !== allowed) return send(403, { error: "Origin required" });
    if (
      req.method === "POST" &&
      !String(req.headers["content-type"] || "").startsWith("application/json")
    )
      return send(415, { error: "JSON required" });
    try {
      const data = req.method === "POST" ? await readBody(req) : undefined;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(",") : v);
      const context = {
        request: new Request(url, { headers }),
        headers: new Headers(),
        sessionToken: undefined as string | undefined,
      };
      const result = await requestContext.run(context, () => fn({ data: data as never }));
      context.headers.forEach((v, k) => res.setHeader(k, v));
      // Session-specific token supports Pages clients whose browsers block third-party cookies.
      // It is never a GitHub OAuth token, DB credential or shared application secret.
      const payload =
        name === "authenticate" &&
        typeof result === "object" &&
        result !== null &&
        "ok" in result &&
        result.ok &&
        context.sessionToken
          ? { ...result, sessionToken: context.sessionToken }
          : result;
      send(200, payload);
    } catch (error) {
      const e = error as { status?: number; name?: string };
      send(e.status ?? (e.name === "ZodError" || e.name === "SyntaxError" ? 400 : 500), {
        error: e.status === 413 ? "Request too large" : "Request failed",
      });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApiServer().listen(Number(process.env["PORT"] || 8787), "0.0.0.0", () =>
    console.log("DevRescue API listening"),
  );
}

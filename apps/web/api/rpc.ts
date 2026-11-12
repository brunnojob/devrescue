import { AsyncLocalStorage } from "node:async_hooks";
export const requestContext = new AsyncLocalStorage<{
  request: Request;
  headers: Headers;
  sessionToken?: string | undefined;
}>();
export function getRequest() {
  const ctx = requestContext.getStore();
  if (!ctx) throw Error("Missing request context");
  return ctx.request;
}
export function setResponseHeader(name: string, value: string) {
  requestContext.getStore()!.headers.set(name, value);
}
export function getCookie(name: string) {
  const request = getRequest();
  if (name === "devrescue_session") {
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
  }
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export function setCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
    partitioned?: boolean;
  },
) {
  const ctx = requestContext.getStore()!;
  if (name === "devrescue_session") ctx.sessionToken = value;
  ctx.headers.append(
    "set-cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${options.maxAge ?? 0}`,
  );
}
export function deleteCookie(name: string, _options?: unknown) {
  setCookie(name, "", { maxAge: 0 });
}
export function createServerFn(config: { method: "GET" | "POST" }) {
  function builder<T>(validate: (value: unknown) => T) {
    return {
      validator<U>(fn: (value: unknown) => U) {
        return builder(fn);
      },
      inputValidator<U>(schema: { parse: (value: unknown) => U }) {
        return builder((value) => schema.parse(value));
      },
      handler<R>(handler: (context: { data: T }) => Promise<R>) {
        const fn = async (options?: { data: T }) => handler({ data: validate(options?.data) });
        return Object.assign(fn, { httpMethod: config.method });
      },
    };
  }
  return builder((_value: unknown) => undefined);
}

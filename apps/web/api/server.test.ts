// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApiServer, oauthReturn } from "./server";
import { requestContext, getCookie, setCookie, createServerFn } from "./rpc";
import { authorizationUrl, exchangeCode, callAsAppUser } from "./github";
import type { AddressInfo } from "node:net";
import { z } from "zod";
const server = createApiServer();
let base: string;
const origin = "https://brunnojob.github.io";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
describe("HTTP boundary", () => {
  it("serves health without exposing database configuration", async () => {
    expect(await (await fetch(base + "/health")).json()).toEqual({
      status: "ok",
      service: "devrescue-api",
    });
  });
  it("rejects other origins and originless state changes", async () => {
    expect(
      (await fetch(base + "/api/getSyncStatus", { headers: { origin: "https://evil.example" } }))
        .status,
    ).toBe(403);
    expect(
      (
        await fetch(base + "/api/authenticate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  });
  it("permits only the Pages origin and declares bearer support", async () => {
    const r = await fetch(base + "/api/authenticate", { method: "OPTIONS", headers: { origin } });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe(origin);
    expect(r.headers.get("access-control-allow-headers")).toContain("Authorization");
  });
  it("rejects invalid JSON, schema violations and oversized requests", async () => {
    for (const body of ["{", "{}"])
      expect(
        (
          await fetch(base + "/api/authenticate", {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body,
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await fetch(base + "/api/authenticate", {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ password: "x".repeat(100000) }),
        })
      ).status,
    ).toBe(413);
  });
  it("does not expose other methods or arbitrary object members", async () => {
    expect((await fetch(base + "/api/authenticate")).status).toBe(405);
    expect((await fetch(base + "/api/constructor")).status).toBe(404);
  });
  it("does not authenticate an anonymous caller", async () => {
    const r = await fetch(base + "/api/accessStatus", { headers: { origin } });
    expect((await r.json()).state).toBe("sign_in");
  });
  it("bounds OAuth callback to the configured Pages destination", () => {
    const target = new URL(
      oauthReturn(
        new URL(
          "https://api.example/api/public/github/return?code=abc&state=" +
            "a".repeat(43) +
            "&redirect_uri=https://evil.example",
        ),
      ),
    );
    expect(target.origin).toBe(origin);
    expect(target.pathname).toBe("/devrescue/");
    expect(target.hash).toContain("code=abc");
    expect(
      oauthReturn(new URL("https://api.example/api/public/github/return?code=abc&state=short")),
    ).not.toContain("abc");
  });
});
it("isolates request contexts, uses per-user bearer credentials and secure cookies", async () => {
  const check = (token: string) =>
    requestContext.run(
      {
        request: new Request("https://api.example", {
          headers: { authorization: `Bearer ${token}` },
        }),
        headers: new Headers(),
      },
      async () => {
        await Promise.resolve();
        expect(getCookie("devrescue_session")).toBe(token);
        setCookie("devrescue_session", token, { maxAge: 60 });
        expect(requestContext.getStore()?.headers.get("set-cookie")).toContain(
          "HttpOnly; Secure; SameSite=None",
        );
      },
    );
  await Promise.all([check("session-a"), check("session-b")]);
});
it("actually validates Zod input before executing an endpoint", async () => {
  const fn = createServerFn({ method: "POST" })
    .inputValidator(z.object({ value: z.string() }))
    .handler(async ({ data }) => data.value);
  await expect(fn({ data: { value: "ok" } })).resolves.toBe("ok");
  await expect(fn({ data: {} as never })).rejects.toThrow();
});
it("binds direct GitHub authorization and code exchange with PKCE", async () => {
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
  vi.stubEnv("API_ORIGIN", "https://devrescue-api.example");
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
  const nonce = "a".repeat(43),
    url = new URL(authorizationUrl(nonce, "session-a"));
  expect(url.origin).toBe("https://github.com");
  expect(url.searchParams.get("state")).toBe(nonce);
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).not.toBe(
    new URL(authorizationUrl(nonce, "session-b")).searchParams.get("code_challenge"),
  );
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ access_token: "test-user-token" }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  try {
    await expect(exchangeCode("one-use-code", nonce, "session-a")).resolves.toBe("test-user-token");
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.code_verifier).toHaveLength(43);
    expect(body.redirect_uri).toBe("https://devrescue-api.example/api/public/github/return");
    await expect(callAsAppUser("token", "https://evil.example")).rejects.toThrow();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

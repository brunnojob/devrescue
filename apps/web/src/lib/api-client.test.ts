import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("does not send credentials when the independent API is unconfigured", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { rpc } = await import("./api-client");
  await expect(rpc("accessStatus")()).rejects.toThrow("not configured");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("stores only the per-user session and sends it on subsequent API calls", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, sessionToken: "per-user-session" }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ state: "trial" }) });
  vi.stubGlobal("fetch", fetchMock);
  const { rpc } = await import("./api-client");
  expect(await rpc("authenticate")()).toEqual({ ok: true });
  await rpc("accessStatus")();
  expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.example/api/accessStatus");
  expect(fetchMock.mock.calls[1]?.[1].headers.authorization).toBe("Bearer per-user-session");
});
it("clears the fallback on sign-out", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example");
  sessionStorage.setItem("devrescue.api-session", "per-user-session");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
  const { rpc } = await import("./api-client");
  await rpc("signOut")();
  expect(sessionStorage.getItem("devrescue.api-session")).toBeNull();
});
it("rejects an insecure remote API before sending a session credential", async () => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.example");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { rpc } = await import("./api-client");
  await expect(rpc("accessStatus")()).rejects.toThrow("HTTPS");
  expect(fetchMock).not.toHaveBeenCalled();
});

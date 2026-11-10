// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const made: { end: ReturnType<typeof vi.fn> }[] = [];
let connectImpl: () => Promise<void> = async () => {};
vi.mock("pg", () => {
  class Client {
    end = vi.fn(async () => {});
    on() {}
    constructor() {
      made.push(this);
    }
    connect() {
      return connectImpl();
    }
    async query(text: string) {
      return { rows: text.includes("SELECT 1") ? [{ ok: 1 }] : [] };
    }
  }
  return { default: { Client } };
});
const { withDbConfig, probeDb, resetProbeCache, EXPECTED_HOST } = await import("./db.server");

beforeEach(() => {
  made.length = 0;
  connectImpl = async () => {};
  resetProbeCache();
  process.env["DATABASE_URL"] = `postgres://u:p@${EXPECTED_HOST}:5432/db`;
});

describe("connection lifecycle", () => {
  it("ends the client when connect itself fails", async () => {
    connectImpl = async () => {
      throw Object.assign(new Error("timeout expired"), {});
    };
    await expect(withDbConfig({}, async () => 1)).rejects.toThrow("timeout");
    expect(made[0]?.end).toHaveBeenCalledTimes(1);
  });
  it("20 concurrent status probes open one connection, cached for 30s", async () => {
    const r = await Promise.all(Array.from({ length: 20 }, () => probeDb()));
    expect(new Set(r.map((x) => x.state))).toEqual(new Set(["schema_missing"]));
    await probeDb(Date.now() + 29_000);
    expect(made).toHaveLength(1);
    await probeDb(Date.now() + 31_000);
    expect(made).toHaveLength(2);
  });
  it("reports a timeout as a firewall/network problem", async () => {
    connectImpl = async () => {
      throw new Error("timeout expired");
    };
    expect((await probeDb()).detail).toMatch(/firewall/);
  });
});

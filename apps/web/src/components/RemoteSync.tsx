import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { AnalysisResult } from "@/lib/analyzer";
import { toSyncReport, type SyncReport } from "@/lib/sync-report";
import {
  authenticate,
  deleteRemoteReport,
  getSyncStatus,
  listRemoteReports,
  signOut,
  uploadReport,
} from "@/lib/sync.functions";

type Status = Awaited<ReturnType<typeof getSyncStatus>>;
type Remote = { id: string; createdAt: string; report: SyncReport };

const STATE_LABEL: Record<Status["db"], string> = {
  not_configured: "not configured",
  misconfigured: "misconfigured",
  unreachable: "unreachable",
  schema_missing: "schema not installed",
  schema_incompatible: "incompatible schema",
  ready: "database reachable",
};

const btn =
  "rounded border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-40";

export function RemoteSync({ result }: { result: AnalysisResult | null }) {
  const status$ = useServerFn(getSyncStatus);
  const auth$ = useServerFn(authenticate);
  const out$ = useServerFn(signOut);
  const list$ = useServerFn(listRemoteReports);
  const up$ = useServerFn(uploadReport);
  const del$ = useServerFn(deleteRemoteReport);
  const [status, setStatus] = useState<Status | null>(null);
  const [reports, setReports] = useState<Remote[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [preview, setPreview] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!checkedAt) return;
    const t = setTimeout(() => tick((n) => n + 1), 30_000);
    return () => clearTimeout(t);
  }, [checkedAt]);

  const refresh = useCallback(async () => {
    try {
      const s = await status$();
      setStatus(s);
      setCheckedAt(Date.now());
      if (s.csrf) {
        const r = await list$({ data: { csrf: s.csrf } });
        if (r.ok) setReports(r.reports);
      } else setReports([]);
    } catch {
      setMsg("Could not reach the DevRescue server.");
    }
  }, [status$, list$]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fn();
      setMsg(r.ok ? (done ?? "") : (r.error ?? "Request failed"));
      await refresh();
    } catch {
      setMsg("Invalid input or request failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!status)
    return <div className="panel p-4 text-sm text-muted-foreground">Checking account sync…</div>;
  const csrf = status.csrf ?? "";
  return (
    <div className="panel space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>Account sync</strong>
        <span className="font-mono text-xs text-muted-foreground">
          server: {STATE_LABEL[status.db]}
        </span>
        {status.detail && <span className="text-xs text-destructive">({status.detail})</span>}
        <button
          className={`${btn} ml-auto`}
          disabled={busy || Date.now() - checkedAt < 30_000}
          onClick={() => void refresh()}
          title="Server status is re-checked at most every 30 seconds"
        >
          Recheck
        </button>
      </div>
      {status.db !== "ready" && (
        <p className="text-xs text-muted-foreground">
          {status.db === "not_configured"
            ? "No database credentials are set on the server, so nothing can be synced. History stays in this browser."
            : status.db === "schema_missing"
              ? "The database answers, but the DevRescue tables have not been installed yet."
              : status.db === "schema_incompatible"
                ? "Existing DevRescue tables have a different layout. Nothing was changed; sync stays off until they are migrated manually."
                : "Sync is unavailable right now. Nothing has been uploaded."}
        </p>
      )}
      {status.db === "ready" && !status.user && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const mode =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "register"
                ? "register"
                : "login";
            void act(() => auth$({ data: { ...form, mode } }));
          }}
        >
          <input
            type="email"
            required
            maxLength={254}
            placeholder="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1"
          />
          <input
            type="password"
            required
            minLength={12}
            maxLength={128}
            placeholder="password (12+ chars)"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1"
          />
          <button className={btn} disabled={busy} value="login">
            Sign in
          </button>
          <button className={btn} disabled={busy} value="register">
            Create account
          </button>
        </form>
      )}
      {status.user && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs">Signed in as {status.user.email}</span>
            <button className={btn} disabled={busy} onClick={() => void act(() => out$())}>
              Sign out
            </button>
            <button className={btn} disabled={!result} onClick={() => setPreview(!preview)}>
              {preview ? "Hide" : "Review & sync current analysis"}
            </button>
          </div>
          {preview && result && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Only this sanitized summary is sent — not your log:
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(toSyncReport(result), null, 2)}
              </pre>
              <button
                className={btn}
                disabled={busy}
                onClick={() =>
                  void act(
                    () => up$({ data: { csrf, report: toSyncReport(result) } }),
                    "Synced.",
                  ).then(() => setPreview(false))
                }
              >
                Upload this summary
              </button>
            </div>
          )}
          {!reports.length && (
            <p className="text-xs text-muted-foreground">No synced reports yet.</p>
          )}
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-t border-border pt-2"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </span>
              <span className="flex-1">{r.report.title}</span>
              <span className="font-mono text-xs text-primary">
                {r.report.findings.length} findings
              </span>
              <button
                className={btn}
                disabled={busy}
                onClick={() => void act(() => del$({ data: { csrf, id: r.id } }), "Deleted.")}
              >
                Delete
              </button>
            </div>
          ))}
        </>
      )}
      {msg && (
        <p className="text-xs" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

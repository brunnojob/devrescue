import { usePreferences } from "@/lib/preferences";
import { useCallback, useEffect, useState } from "react";
import { SyncTroubleshoot } from "./SyncTroubleshoot";
import { Button } from "./ui/button";
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

export function RemoteSync({
  result,
  onAccountChange,
  accountOnly = false,
}: {
  result: AnalysisResult | null;
  onAccountChange?: () => void;
  accountOnly?: boolean;
}) {
  const { t } = usePreferences();
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
      if (s.csrf && !accountOnly) {
        const r = await list$({ data: { csrf: s.csrf } });
        setReports(r.ok ? r.reports : []);
      } else setReports([]);
    } catch {
      setMsg(t("Could not reach the DevRescue server."));
    }
  }, [status$, list$, accountOnly]);
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
      onAccountChange?.();
    } catch {
      setMsg(t("Invalid input or request failed."));
    } finally {
      setBusy(false);
    }
  };

  if (!status)
    return (
      <div className="panel p-4 text-sm text-muted-foreground"> {t("Checking account sync…")} </div>
    );
  const csrf = status.csrf ?? "";
  return (
    <div className="panel space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong> {t("Account sync")} </strong>
        <span className="font-mono text-xs text-muted-foreground">
          {" "}
          {t("server:")} {t(STATE_LABEL[status.db])}
        </span>
        <Button
          variant="outline"
          className={`${btn} ml-auto`}
          disabled={busy || Date.now() - checkedAt < 30_000}
          onClick={() => void refresh()}
          title={t("Server status is re-checked at most every 30 seconds")}
        >
          {" "}
          {t("Recheck")}{" "}
        </Button>
      </div>
      <SyncTroubleshoot state={status.db} kind={status.kind} detail={status.detail} />
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
            placeholder={t("email")}
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
            placeholder={t("password (12+ chars)")}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1"
          />
          <Button variant="outline" disabled={busy} value="login">
            {" "}
            {t("Sign in")}{" "}
          </Button>
          <Button variant="outline" disabled={busy} value="register">
            {" "}
            {t("Create account")}{" "}
          </Button>
        </form>
      )}
      {status.user && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs">
              {" "}
              {t("Signed in as")} {status.user.email}
            </span>
            <Button variant="outline" disabled={busy} onClick={() => void act(() => out$())}>
              {" "}
              {t("Sign out")}{" "}
            </Button>
            {!accountOnly && (
              <Button variant="outline" disabled={!result} onClick={() => setPreview(!preview)}>
                {preview ? t("Hide") : t("Review & sync current analysis")}
              </Button>
            )}
          </div>
          {preview && result && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {" "}
                {t("Only this sanitized summary is sent — not your log:")}{" "}
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
                    t("Synced."),
                  ).then(() => setPreview(false))
                }
              >
                {" "}
                {t("Upload this summary")}{" "}
              </button>
            </div>
          )}
          {!accountOnly && !reports.length && (
            <p className="text-xs text-muted-foreground"> {t("No synced reports yet.")} </p>
          )}
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-t border-border pt-2"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </span>
              <span className="flex-1">{t(r.report.title)}</span>
              <span className="font-mono text-xs text-primary">
                {r.report.findings.length} {t("findings")}{" "}
              </span>
              <button
                className={btn}
                disabled={busy}
                onClick={() => void act(() => del$({ data: { csrf, id: r.id } }), t("Deleted."))}
              >
                {" "}
                {t("Delete")}{" "}
              </button>
            </div>
          ))}
        </>
      )}
      {msg && (
        <p className="text-xs" role="status">
          {t(msg)}
        </p>
      )}
    </div>
  );
}

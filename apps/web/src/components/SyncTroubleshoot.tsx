import { usePreferences } from "@/lib/preferences";
import { DIAGNOSES, type DbErrorKind } from "@/lib/db-diagnosis";

type State =
  | "not_configured"
  | "misconfigured"
  | "unreachable"
  | "schema_missing"
  | "schema_incompatible"
  | "ready";

const SECRETS = "project name (top left) → Settings → Secrets";
const STATE_HELP: Record<
  Exclude<State, "ready" | "unreachable">,
  { title: string; cause: string; steps: string[] }
> = {
  not_configured: {
    title: "Not configured",
    cause: "No database connection setting exists on the server. History stays in this browser.",
    steps: [`Add DATABASE_URL in Lovable: ${SECRETS}. Never paste it in chat.`],
  },
  misconfigured: {
    title: "Connection setting rejected",
    cause:
      "The setting exists but is not a valid postgres:// URL for the expected Azure server. It was not used.",
    steps: [`Fix DATABASE_URL in ${SECRETS}; the host must be the Azure server name.`],
  },
  schema_missing: {
    title: "Tables not installed",
    cause: "The database answered and login worked, but the DevRescue tables do not exist yet.",
    steps: [
      "Review the schema file, then run the migration script with --apply and the printed hash.",
    ],
  },
  schema_incompatible: {
    title: "Incompatible tables",
    cause:
      "DevRescue tables exist with a different layout. Nothing was changed and no data was dropped.",
    steps: ["Rename or migrate the old tables manually, then press Recheck."],
  },
};

/** Ordered connection checkpoints, so users can see how far the connection got. */
const STAGES = ["Setting", "Network", "Certificate", "Login", "Tables"] as const;
function reached(state: State, kind?: DbErrorKind): number {
  if (state === "not_configured" || state === "misconfigured") return 0;
  if (state === "unreachable") {
    if (kind === "tls") return 2;
    if (kind === "auth") return 3;
    if (kind === "database_missing" || kind === "permission") return 4;
    return 1; // timeout, dns, refused, other: stopped at the network step
  }
  if (state === "ready") return 5;
  return 4;
}

export function SyncTroubleshoot({
  state,
  kind,
  detail,
}: {
  state: State;
  kind?: DbErrorKind | undefined;
  detail?: string | undefined;
}) {
  const { t } = usePreferences();
  if (state === "ready")
    return (
      <section
        aria-label={t("Sync connection status")}
        className="space-y-2 border-t border-border pt-3"
      >
        <strong role="status" className="text-primary">
          {" "}
          {t("Sync connection ready")}{" "}
        </strong>
        <ol className="flex flex-wrap gap-2 font-mono text-[11px] text-primary">
          {STAGES.map((stage) => (
            <li key={t(stage)}>✓ {t(stage)}</li>
          ))}
        </ol>
      </section>
    );
  const d = state === "unreachable" ? DIAGNOSES[kind ?? "other"] : STATE_HELP[state];
  const at = reached(state, kind);
  return (
    <section
      aria-label={t("Sync troubleshooting")}
      className="space-y-2 rounded border border-border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-destructive">{t(d.title)}</strong>
        {state === "schema_incompatible" && detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </div>
      <ol className="flex flex-wrap gap-1 font-mono text-[11px]">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className={`rounded px-2 py-0.5 ${i < at ? "bg-primary/15 text-primary" : i === at ? "bg-destructive/20 text-destructive" : "text-muted-foreground"}`}
          >
            {i < at ? "✓" : i === at ? "✗" : "·"} {t(s)}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{t(d.cause)}</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs">
        {d.steps.map((s) => (
          <li key={s}>{t(s)}</li>
        ))}
      </ol>
      <p className="text-[11px] text-muted-foreground">
        {" "}
        {t("No credentials, user names or server error text are shown here.")}{" "}
      </p>
    </section>
  );
}

import { usePreferences } from "@/lib/preferences";
import { createFileRoute } from "@tanstack/react-router";
import { Shell, REPO, SPONSOR } from "@/components/Shell";
export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — DevRescue" },
      {
        name: "description",
        content: "How DevRescue analyzes logs offline, what it detects, and how privacy works.",
      },
      { property: "og:title", content: "DevRescue Docs" },
      { property: "og:description", content: "How the offline deterministic log analyzer works." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});
const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="panel space-y-2 p-5">
    <h2 className="font-mono text-primary">{t}</h2>
    <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
  </section>
);
function Docs() {
  const { t } = usePreferences();
  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold"> {t("Documentation")} </h1>
        <S t={t("What it is")}>
          {" "}
          {t(
            "DevRescue is a deterministic, rule-based log analyzer that runs entirely in your browser. It is not an AI model. It aims to shorten the time you spend reading noisy logs, but it cannot guarantee a fix for every problem.",
          )}{" "}
        </S>
        <S t={t("Pipeline")}>
          <ol className="list-decimal space-y-1 pl-5">
            <li> {t("Strip ANSI color codes and normalize line endings.")} </li>
            <li>
              {" "}
              {t(
                "Redact tokens (GitHub, OpenAI-style, AWS, npm, JWT), Authorization headers, password/secret assignments, private keys and credentials inside connection URLs.",
              )}{" "}
            </li>
            <li>
              {" "}
              {t(
                "Match each line against rules; each finding records evidence lines, confidence, and location when present.",
              )}{" "}
            </li>
            <li>
              {" "}
              {t(
                "Deduplicate repeats and drop cascades (e.g. a missing module supersedes the generic traceback; DB/DNS/TLS errors supersede generic timeouts).",
              )}{" "}
            </li>
          </ol>
        </S>
        <S t={t("Detected categories")}>
          {" "}
          {t(
            "TypeScript diagnostics (file:line:col + TS code), Python tracebacks and missing modules, npm ERESOLVE and missing scripts, ENOSPC, EADDRINUSE, out-of-memory, Docker daemon and socket permission, PostgreSQL connection and migration errors, Git merge conflicts, DNS/TLS/timeouts, and test failures.",
          )}{" "}
        </S>
        <S t={t("Safety")}>
          {" "}
          {t(
            "DevRescue never executes pasted text or commands. Suggested commands are copied to your clipboard only; read them and their warnings first. Placeholders like",
          )}{" "}
          <code>&lt;port&gt;</code> {t("must be filled in by you.")}{" "}
        </S>
        <S t={t("Privacy & history")}>
          {" "}
          {t(
            "Analysis is offline. Session history is off by default; when enabled it is stored in this browser's localStorage and can be deleted per item or cleared. Exports (JSON/Markdown) contain only sanitized text.",
          )}{" "}
        </S>
        <S t={t("Optional account sync")}>
          {" "}
          {t(
            "Analysis always runs in your browser. If the server has database credentials and the DevRescue tables are installed, you can sign in and explicitly upload a sanitized summary (findings and short redacted evidence — never the log itself). The server re-redacts it, stores it per account, and lets you delete it. Database credentials live only on the server; the History tab shows the real server state.",
          )}{" "}
        </S>
        <S t={t("Hosted trial & sponsorship")}>
          {" "}
          {t(
            "Sign in and connect your GitHub account to start three hours of free access. After the trial, any monthly active sponsorship or confirmed one-time GitHub Sponsors payment to @brunnojob unlocks hosted access. Clearing browser data does not restart the trial. The GitHub Pages entry opens the separately hosted tool; account credentials and sponsorship verification stay on the server. The open-source analyzer remains available under the MIT license.",
          )}{" "}
        </S>
        <S t={t("Contribute")}>
          {" "}
          {t("Rules live in")} <code>src/lib/analyzer.ts</code>{" "}
          {t("with tests beside them. Source:")}{" "}
          <a className="text-primary" href={REPO}>
            {REPO}
          </a>{" "}
          {t(". Support the project:")}{" "}
          <a className="text-primary" href={SPONSOR}>
            GitHub Sponsors
          </a>
          .
        </S>
      </div>
    </Shell>
  );
}

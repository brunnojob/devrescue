import { translate, usePreferences } from "@/lib/preferences";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import {
  analyze,
  compareLogs,
  toJSON,
  toMarkdown,
  type Category,
  type Finding,
  type Severity,
} from "@/lib/analyzer";
import { SAMPLES } from "@/lib/samples";
import { buildPlan, sourceExcerpt, sourceHints, type Diagnosis } from "@/lib/diagnosis";
import { RemoteSync } from "@/components/RemoteSync";
import { AccessGate } from "@/components/AccessGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DevRescue — offline log analyzer workbench" },
      {
        name: "description",
        content:
          "Paste or upload build, runtime and CI logs. Get sanitized, deduplicated findings with evidence and suggested commands — all in your browser.",
      },
      { property: "og:title", content: "DevRescue workbench" },
      {
        property: "og:description",
        content: "Open-source, deterministic, offline troubleshooting for developer logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Tab = "analyze" | "compare" | "checklist" | "history";
interface HistItem {
  id: string;
  at: string;
  title: string;
  sanitized: string;
  count: number;
}
const HKEY = "devrescue.history",
  OKEY = "devrescue.historyOptIn",
  CKEY = "devrescue.checklist";

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
const sevCls: Record<Severity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  error: "bg-destructive/20 text-destructive",
  warning: "bg-warning/20 text-warning",
};
const Btn = (p: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => {
  const { primary, className, ...r } = p;
  return (
    <button
      {...r}
      className={`rounded px-3 py-1.5 text-sm transition disabled:opacity-40 ${primary ? "bg-primary font-medium text-primary-foreground shadow-glow hover:opacity-90" : "border border-border hover:border-primary"} ${className ?? ""}`}
    />
  );
};

function Index() {
  const { t } = usePreferences();
  const [tab, setTab] = useState<Tab>("analyze");
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [history, setHistory] = useState<HistItem[]>([]);
  const clearProtected = useCallback(() => {
    setInput("");
    setSubmitted("");
    setTab("analyze");
  }, []);
  useEffect(() => {
    setOptIn(localStorage.getItem(OKEY) === "1");
    try {
      setHistory(JSON.parse(localStorage.getItem(HKEY) || "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  const saveHist = (h: HistItem[]) => {
    setHistory(h);
    localStorage.setItem(HKEY, JSON.stringify(h));
  };
  const result = useMemo(() => (submitted ? analyze(submitted) : null), [submitted]);

  const run = (text = input) => {
    setSubmitted(text);
    if (optIn && text.trim()) {
      const r = analyze(text);
      saveHist(
        [
          {
            id: String(Date.now()),
            at: new Date().toISOString(),
            title: r.findings[0]?.title ?? "No findings",
            sanitized: r.sanitized,
            count: r.findings.length,
          },
          ...history,
        ].slice(0, 30),
      );
    }
  };
  const toggleOpt = (v: boolean) => {
    setOptIn(v);
    localStorage.setItem(OKEY, v ? "1" : "0");
  };

  return (
    <Shell>
      <AccessGate onLocked={clearProtected}>
        <section className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              {" "}
              {t("Open-source · offline · deterministic")}{" "}
            </p>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">
              {" "}
              {t("Turn noisy logs into a fix plan.")}{" "}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {" "}
              {t(
                "Rule-based analysis that runs in your browser. Secrets are redacted before anything is shown or exported. Nothing you paste is executed or uploaded. It aims to save debugging time — it can't promise to solve every issue.",
              )}{" "}
            </p>
          </div>
          <div className="panel flex gap-4 p-3 font-mono text-xs">
            <div>
              <div className="text-muted-foreground"> {t("Engine")} </div>
              <div className="text-primary"> {t("local rules")} </div>
            </div>
            <div>
              <div className="text-muted-foreground"> {t("History")} </div>
              <div>{optIn ? t("this browser") : t("off")}</div>
            </div>
          </div>
        </section>
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {(["analyze", "compare", "checklist", "history"] as Tab[]).map((tabName) => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm capitalize ${tab === tabName ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t(tabName)}
              {tabName === "history" && history.length ? ` (${history.length})` : ""}
            </button>
          ))}
        </div>
        {tab === "analyze" && (
          <Analyze input={input} setInput={setInput} run={run} result={result} />
        )}
        {tab === "compare" && <Compare />}
        {tab === "checklist" && <Checklist />}
        {tab === "history" && (
          <History
            optIn={optIn}
            toggleOpt={toggleOpt}
            history={history}
            save={saveHist}
            result={result}
            open={(h) => {
              setInput(h.sanitized);
              setSubmitted(h.sanitized);
              setTab("analyze");
            }}
          />
        )}
      </AccessGate>
    </Shell>
  );
}

function Analyze({
  input,
  setInput,
  run,
  result,
}: {
  input: string;
  setInput: (s: string) => void;
  run: (s?: string) => void;
  result: ReturnType<typeof analyze> | null;
}) {
  const { t, language } = usePreferences();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [sev, setSev] = useState<Severity | "all">("all");
  const list = (result?.findings ?? []).filter(
    (f) =>
      (cat === "all" || f.category === cat) &&
      (sev === "all" || f.severity === sev) &&
      (!q ||
        (f.title + f.evidence.join(" ") + (f.location ?? ""))
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const cats = [...new Set(result?.findings.map((f) => f.category) ?? [])];
  const plan = useMemo(() => (result ? buildPlan(result) : null), [result]);
  const byId = new Map(plan?.diagnoses.map((d) => [d.id, d]) ?? []);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="panel flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium"> {t("Log input")} </span>
          <select
            aria-label={t("Load sample")}
            className="ml-auto rounded border border-border bg-secondary px-2 py-1 text-sm"
            value=""
            onChange={(e) => {
              const s = SAMPLES[e.target.value];
              if (s) {
                setInput(s);
                run(s);
              }
            }}
          >
            <option value=""> {t("Load sample…")} </option>
            {Object.keys(SAMPLES).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <label className="cursor-pointer rounded border border-border px-3 py-1 text-sm hover:border-primary">
            {" "}
            {t("Upload")}{" "}
            <input
              type="file"
              accept=".log,.txt,text/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setInput(await f.text());
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <textarea
          aria-label={t("Log input")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("Paste build, runtime, CI, or terminal output here…")}
          className="min-h-[380px] flex-1 resize-y rounded border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary"
          spellCheck={false}
        />
        <div className="flex gap-2">
          <Btn primary onClick={() => run()} disabled={!input.trim()}>
            {" "}
            {t("Analyze")}{" "}
          </Btn>
          <Btn
            onClick={() => {
              setInput("");
              run("");
            }}
          >
            {" "}
            {t("Clear")}{" "}
          </Btn>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {input.length.toLocaleString()} {t("chars")}{" "}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {!result ? (
          <div className="panel grid min-h-[300px] place-items-center p-8 text-center text-muted-foreground">
            {" "}
            {t("Paste a log or load a sample to see findings.")}{" "}
          </div>
        ) : (
          <>
            {plan?.nextAction && (
              <section
                aria-label={t("Next action")}
                className="panel space-y-2 border-primary/50 p-4"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-primary">
                  {t("Next action")} · {t(plan.nextAction.finding.area)}
                </div>
                <p className="font-semibold">{t(plan.nextAction.step)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Root cause")}: {translate(plan.nextAction.finding.title, language)}
                  {plan.nextAction.finding.location ? ` · ${plan.nextAction.finding.location}` : ""}
                  {plan.nextAction.finding.triggers.length > 0 &&
                    ` · ${t("explains")} ${plan.nextAction.finding.triggers.length} ${t("other error(s)")}`}
                </p>
                <code className="block rounded bg-background px-2 py-1 font-mono text-xs text-primary">
                  {t("Verify")}: $ {plan.nextAction.verify}
                </code>
                {plan.roots.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {plan.roots.length}{" "}
                    {t("independent problems found — fix them in the order below.")}
                  </p>
                )}
              </section>
            )}
            <div className="panel flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-mono">
                <b className="text-primary">{result.findings.length}</b> {t("findings")}{" "}
              </span>
              <span className="font-mono text-muted-foreground">
                {result.lineCount} {t("lines ·")} {result.redactions} {t("redactions")}{" "}
              </span>
              <div className="ml-auto flex gap-2">
                <Btn
                  onClick={() =>
                    download("devrescue-report.json", toJSON(result), "application/json")
                  }
                >
                  {" "}
                  {t("Export JSON")}{" "}
                </Btn>
                <Btn
                  onClick={() =>
                    download("devrescue-report.md", toMarkdown(result), "text/markdown")
                  }
                >
                  {" "}
                  {t("Export MD")}{" "}
                </Btn>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label={t("Filter findings")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Filter…")}
                className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <select
                aria-label={t("Category")}
                value={cat}
                onChange={(e) => setCat(e.target.value as Category)}
                className="rounded border border-border bg-secondary px-2 text-sm"
              >
                <option value="all"> {t("All categories")} </option>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("Severity")}
                value={sev}
                onChange={(e) => setSev(e.target.value as Severity)}
                className="rounded border border-border bg-secondary px-2 text-sm"
              >
                <option value="all"> {t("All severities")} </option>
                <option value="critical">{t("critical")}</option>
                <option value="error">{t("error")}</option>
                <option value="warning">{t("warning")}</option>
              </select>
            </div>
            {list.length === 0 && (
              <div className="panel p-6 text-center text-sm text-muted-foreground">
                {" "}
                {t(
                  "No known patterns matched. DevRescue only recognizes the categories listed in Docs.",
                )}{" "}
              </div>
            )}
            {list.map((f) => (
              <FindingCard key={f.id} f={byId.get(f.id) ?? f} byId={byId} />
            ))}
            <details className="panel p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                {" "}
                {t("Sanitized log preview")}{" "}
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto font-mono text-xs">
                {result.sanitized}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

function FindingCard({ f, byId }: { f: Finding | Diagnosis; byId: Map<string, Diagnosis> }) {
  const { t, language } = usePreferences();
  const d = "fix" in f ? f : null;
  const [source, setSource] = useState("");
  const [showSource, setShowSource] = useState(false);
  const hints = d && source ? sourceHints(d, source) : [];
  const excerpt = d?.line && source ? sourceExcerpt(source, d.line) : [];
  const cause = d?.causedBy ? byId.get(d.causedBy) : undefined;
  const [copied, setCopied] = useState<number | null>(null);
  const copy = (c: string, i: number) => {
    navigator.clipboard?.writeText(c);
    setCopied(i);
    setTimeout(() => setCopied(null), 1200);
  };
  return (
    <article className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${sevCls[f.severity]}`}
        >
          {t(f.severity)}
        </span>
        <span className="rounded bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          {t(f.category)}
        </span>
        <h3 className="font-semibold">{translate(f.title, language)}</h3>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {Math.round(f.confidence * 100)} {t("% confidence")}{" "}
          {f.occurrences > 1 ? ` · ${f.occurrences}×` : ""}
        </span>
      </div>
      {f.location && (
        <div className="font-mono text-xs text-accent-foreground">📍 {f.location}</div>
      )}
      {cause && (
        <p className="rounded border border-border bg-secondary px-2 py-1 text-xs">
          ↳ {t("Probably caused by")} <b>{translate(cause.title, language)}</b>{" "}
          {t("— fix that first.")}
        </p>
      )}
      {d && d.triggers.length > 0 && (
        <p className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
          {t("Root cause: explains")}{" "}
          {d.triggers.map((id) => translate(byId.get(id)?.title ?? "", language)).join(", ")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t(f.explanation)}</p>
      <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-xs">
        {d && d.snippet.length ? d.snippet.join("\n") : f.evidence.join("\n")}
      </pre>
      {d && d.fix.length > 0 && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase text-muted-foreground">{t("Fix")}</div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {d.fix.map((x, i) => (
              <li key={i}>{t(x)}</li>
            ))}
          </ol>
        </div>
      )}
      {d?.verify && (
        <div className="font-mono text-xs">
          <span className="text-muted-foreground">{t("Verify")}: </span>
          <code className="text-primary">$ {d.verify}</code>
        </div>
      )}
      {d && (
        <div className="space-y-2">
          <button
            onClick={() => setShowSource((v) => !v)}
            className="text-xs text-muted-foreground underline hover:text-primary"
          >
            {d.file
              ? `${t("Add the involved file for an exact fix")} (${d.file})`
              : t("Add the involved file for an exact fix")}
          </button>
          {showSource && (
            <>
              <input
                type="file"
                aria-label={t("Upload source file")}
                className="block text-xs"
                onChange={(e) => void e.target.files?.[0]?.text().then(setSource)}
              />
              <textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t("…or paste the file content. It stays in your browser.")}
                className="h-28 w-full rounded border border-border bg-background p-2 font-mono text-xs"
              />
              {excerpt.length > 0 && (
                <pre className="overflow-x-auto rounded bg-background p-2 font-mono text-xs">
                  {excerpt.join("\n")}
                </pre>
              )}
              {hints.map((h, i) => (
                <p key={i} className="text-sm">
                  → {h}
                </p>
              ))}
            </>
          )}
        </div>
      )}
      <div className="space-y-1">
        {f.commands.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1"
          >
            <code className="flex-1 overflow-x-auto font-mono text-xs text-primary">$ {c}</code>
            <button
              onClick={() => copy(c, i)}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {copied === i ? t("Copied") : t("Copy")}
            </button>
          </div>
        ))}
      </div>
      {f.warnings.map((w, i) => (
        <p
          key={i}
          className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning"
        >
          {" "}
          {t("⚠ Review:")} {t(w)}
        </p>
      ))}
    </article>
  );
}

function Compare() {
  const { t, language } = usePreferences();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [res, setRes] = useState<ReturnType<typeof compareLogs> | null>(null);
  const Col = ({ t, items, cls }: { t: string; items: Finding[]; cls: string }) => (
    <div className="panel p-3">
      <h3 className={`mb-2 font-mono text-sm ${cls}`}>
        {t} ({items.length})
      </h3>
      {items.map((f) => (
        <div key={f.id} className="border-t border-border py-1.5 text-sm">
          {translate(f.title, language)}
          {f.location && (
            <div className="font-mono text-xs text-muted-foreground">{f.location}</div>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [t("Before"), a, setA],
          [t("After"), b, setB],
        ].map(([l, v, s]) => (
          <label key={l as string} className="panel block p-3 text-sm">
            {l as string}
            <textarea
              aria-label={`${l} log`}
              value={v as string}
              onChange={(e) => (s as (x: string) => void)(e.target.value)}
              className="mt-2 h-48 w-full rounded border border-input bg-background p-2 font-mono text-xs outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>
      <Btn primary onClick={() => setRes(compareLogs(a, b))} disabled={!a.trim() && !b.trim()}>
        {" "}
        {t("Compare logs")}{" "}
      </Btn>
      {res && (
        <div className="grid gap-4 md:grid-cols-3">
          <Col t={t("New")} items={res.introduced} cls="text-destructive" />
          <Col t={t("Resolved")} items={res.resolved} cls="text-primary" />
          <Col t={t("Still present")} items={res.persisting} cls="text-warning" />
        </div>
      )}
    </div>
  );
}

const CHECKS: [string, string][] = [
  ["Runtime versions", "node -v && npm -v   # match .nvmrc / engines"],
  ["Python env", "python --version && which python"],
  ["Clean install", "rm -rf node_modules && npm ci"],
  ["Env vars present", "compare .env.example with your .env (names only)"],
  ["Disk space", "df -h"],
  ["Ports free", "lsof -i :3000"],
  ["Docker running", "docker info"],
  ["Database reachable", "pg_isready -h <host> -p 5432"],
  ["Git state clean", "git status"],
  ["Network / proxy", "env | grep -i proxy"],
];
function Checklist() {
  const { t } = usePreferences();
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(CKEY) || "{}"));
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = (k: string) => {
    const n = { ...done, [k]: !done[k] };
    setDone(n);
    localStorage.setItem(CKEY, JSON.stringify(n));
  };
  const n = CHECKS.filter(([k]) => done[k]).length;
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-semibold"> {t("Environment checklist")} </h2>
        <span className="font-mono text-xs text-primary">
          {n}/{CHECKS.length}
        </span>
        <Btn
          className="ml-auto"
          onClick={() => {
            setDone({});
            localStorage.removeItem(CKEY);
          }}
        >
          {" "}
          {t("Reset")}{" "}
        </Btn>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {CHECKS.map(([k, c]) => (
          <label
            key={k}
            className={`flex cursor-pointer gap-3 rounded border p-3 ${done[k] ? "border-primary/50 bg-accent/30" : "border-border"}`}
          >
            <input
              type="checkbox"
              checked={!!done[k]}
              onChange={() => toggle(k)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t(k)}</span>
              <code className="font-mono text-xs text-muted-foreground">{c}</code>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function History({
  optIn,
  toggleOpt,
  history,
  save,
  open,
  result,
}: {
  result: ReturnType<typeof analyze> | null;
  optIn: boolean;
  toggleOpt: (v: boolean) => void;
  history: HistItem[];
  save: (h: HistItem[]) => void;
  open: (h: HistItem) => void;
}) {
  const { t } = usePreferences();
  return (
    <div className="space-y-3">
      <RemoteSync result={result} />
      <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => toggleOpt(e.target.checked)}
            className="accent-primary"
          />{" "}
          {t("Save sanitized sessions in this browser")}{" "}
        </label>
        <span className="text-xs text-muted-foreground"> {t("Stored in this browser only.")} </span>
        <Btn
          className="ml-auto"
          disabled={!history.length}
          onClick={() => {
            if (confirm(t("Delete all local history?"))) save([]);
          }}
        >
          {" "}
          {t("Clear all")}{" "}
        </Btn>
      </div>
      {!history.length && (
        <div className="panel p-6 text-center text-sm text-muted-foreground">
          {optIn
            ? t("No sessions yet. Run an analysis.")
            : t("History is off. Enable it to keep sanitized sessions locally.")}
        </div>
      )}
      {history.map((h) => (
        <div key={h.id} className="panel flex flex-wrap items-center gap-3 p-3 text-sm">
          <span className="font-mono text-xs text-muted-foreground">
            {new Date(h.at).toLocaleString()}
          </span>
          <span className="flex-1">{t(h.title)}</span>
          <span className="font-mono text-xs text-primary">
            {h.count} {t("findings")}{" "}
          </span>
          <Btn onClick={() => open(h)}> {t("Open")} </Btn>
          <Btn onClick={() => save(history.filter((x) => x.id !== h.id))}> {t("Delete")} </Btn>
        </div>
      ))}
    </div>
  );
}

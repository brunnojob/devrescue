import logo from "@/assets/devrescue-logo.png";
import { usePreferences } from "@/lib/preferences";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@/lib/api-client";
import { Clock, Github, Heart, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { RemoteSync } from "./RemoteSync";
import {
  accessStatus,
  completeGitHub,
  recheckSponsor,
  startGitHub,
  startTrial,
} from "@/lib/access.functions";
type Status = Awaited<ReturnType<typeof accessStatus>>;
export function AccessGate({ children, onLocked }: { children: ReactNode; onLocked: () => void }) {
  const { t } = usePreferences();
  const statusFn = useServerFn(accessStatus),
    connectFn = useServerFn(startGitHub),
    completeFn = useServerFn(completeGitHub),
    trialFn = useServerFn(startTrial),
    sponsorFn = useServerFn(recheckSponsor);
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [now, setNow] = useState(0);
  const refresh = useCallback(async () => {
    try {
      setStatus(await statusFn());
      setNow(Date.now());
    } catch {
      setStatus(null);
      setMessage(t("Access verification unavailable."));
    }
  }, [statusFn]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const allowed =
    !!status?.allowed &&
    (status.state !== "trial" || (status.expiresAt !== null && now < status.expiresAt));
  useEffect(() => {
    if (!allowed) onLocked();
  }, [allowed, onLocked]);
  useEffect(() => {
    if (status?.state !== "sponsor") return;
    const timer = setTimeout(() => void refresh(), 240_000);
    return () => clearTimeout(timer);
  }, [status, refresh]);
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fn();
      if (!r.ok) setMessage(r.error ?? "Request failed.");
      await refresh();
    } catch {
      setMessage(t("Request failed."));
    } finally {
      setBusy(false);
    }
  };
  const connect = async () => {
    const popup = window.open("", "devrescue-github", "width=600,height=720");
    if (!popup) {
      setMessage(t("Allow popups to connect GitHub."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await connectFn({ data: { csrf: status?.csrf ?? "" } });
      if (!result.ok) throw new Error(result.error);
      const code = await new Promise<string>((resolve, reject) => {
        const cleanup = () => {
          window.removeEventListener("message", listener);
          clearInterval(poll);
          clearTimeout(timeout);
        };
        const listener = (event: MessageEvent) => {
          if (
            event.source !== popup ||
            event.origin !== location.origin ||
            event.data?.type !== "devrescue-github-complete" ||
            event.data?.nonce !== result.nonce
          )
            return;
          cleanup();
          if (event.data.success && typeof event.data.code === "string") resolve(event.data.code);
          else reject(new Error(t("GitHub connection cancelled.")));
        };
        const poll = setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error(t("GitHub window closed.")));
          }
        }, 500);
        const timeout = setTimeout(() => {
          cleanup();
          popup.close();
          reject(new Error(t("GitHub connection timed out.")));
        }, 600_000);
        window.addEventListener("message", listener);
        popup.location.href = result.authorizationUrl;
      });
      const completed = await completeFn({
        data: { code, nonce: result.nonce, csrf: status?.csrf ?? "" },
      });
      if (!completed.ok) throw new Error(completed.error);
      setMessage(t("GitHub account verified."));
      await refresh();
    } catch (e) {
      popup.close();
      setMessage(e instanceof Error ? e.message : t("GitHub connection failed."));
    } finally {
      setBusy(false);
    }
  };
  const remaining = status?.expiresAt ? Math.max(0, status.expiresAt - now) : 0;
  const clock = [
    Math.floor(remaining / 3600000),
    Math.floor(remaining / 60000) % 60,
    Math.floor(remaining / 1000) % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <>
      <section
        aria-label={t("Access status")}
        className="mb-5 flex flex-wrap items-center gap-3 border-b border-border pb-4 text-sm"
      >
        <Clock className="size-4 text-primary" />
        <strong>
          {!status
            ? t(message ? "Access verification unavailable." : "Checking access…")
            : status.state === "sponsor"
              ? t("Sponsor access")
              : status.state === "trial" && allowed
                ? `${t("Free trial")} · ${clock}`
                : status.state === "setup_pending"
                  ? t("Access setup pending")
                  : status.state === "sign_in"
                    ? t("Sign in to start your free trial")
                    : status.state === "github_required"
                      ? t("Verify your GitHub account")
                      : status.state === "trial_available"
                        ? t("3 hours free")
                        : status.state === "verification_unavailable"
                          ? t("Sponsorship verification unavailable")
                          : t("Free trial ended")}
        </strong>
        {status?.state === "trial" && allowed && status.expiresAt && (
          <span className="text-muted-foreground">
            {t("Expires")}:{" "}
            {[
              ["America/Sao_Paulo", "BR"],
              ["America/New_York", "USA (ET)"],
            ]
              .map(
                ([tz, label]) =>
                  `${new Date(status.expiresAt as number).toLocaleString("en-GB", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ${label}`,
              )
              .join(" · ")}
          </span>
        )}
        {status?.githubLogin && (
          <span className="text-muted-foreground">@{status.githubLogin}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label={t("Refresh access")}
          >
            <RefreshCw /> {t("Refresh")}{" "}
          </Button>
          {(status?.state === "github_required" ||
            status?.state === "verification_unavailable") && (
            <Button size="sm" disabled={busy} onClick={() => void connect()}>
              <Github />
              {status?.githubLogin ? t("Reconnect GitHub") : t("Connect GitHub")}
            </Button>
          )}
          {status?.state === "trial_available" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void act(() => trialFn({ data: { csrf: status.csrf ?? "" } }))}
            >
              {" "}
              {t("Start 3-hour trial")}{" "}
            </Button>
          )}
          {status?.githubLogin && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void act(() => sponsorFn({ data: { csrf: status.csrf ?? "" } }))}
            >
              {" "}
              {t("Verify sponsorship")}{" "}
            </Button>
          )}
          <Button size="sm" asChild>
            <a href="https://github.com/sponsors/brunnojob" target="_blank" rel="noreferrer">
              <Heart /> {t("Sponsor")}{" "}
            </a>
          </Button>
        </div>
        {message && (
          <p role="status" className="w-full text-muted-foreground">
            {t(message)}
          </p>
        )}
      </section>
      {allowed ? (
        children
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-5">
            <img
              src={logo}
              alt="DevRescue"
              width={112}
              height={112}
              className="size-24 shrink-0 object-contain"
            />
            <div>
              <h2 className="text-xl font-semibold"> {t("DevRescue access")} </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {" "}
                {t("3 hours free. Then sponsor @brunnojob — any amount, monthly or one-time.")}{" "}
              </p>
            </div>
          </div>
          <RemoteSync result={null} onAccountChange={() => void refresh()} accountOnly />
        </div>
      )}
    </>
  );
}

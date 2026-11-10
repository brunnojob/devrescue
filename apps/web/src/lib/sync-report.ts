// Pure, client-safe: builds and validates the sanitized, derived report that may be synced.
// The full log (even sanitized) is never part of a synced report.
import { z } from "zod";
import { redact, type AnalysisResult } from "./analyzer";

export const LIMITS = {
  findings: 50,
  evidencePerFinding: 5,
  evidenceChars: 300,
  titleChars: 200,
  payloadBytes: 64 * 1024,
} as const;

const clean = (s: string, max: number) => redact(s).text.slice(0, max);

const findingSchema = z.object({
  ruleId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  title: z.string().max(LIMITS.titleChars),
  category: z.string().regex(/^[a-z]{1,20}$/),
  severity: z.enum(["critical", "error", "warning"]),
  confidence: z.number().min(0).max(1),
  occurrences: z.number().int().min(1).max(1_000_000),
  location: z.string().max(LIMITS.titleChars).optional(),
  evidence: z.array(z.string().max(LIMITS.evidenceChars)).max(LIMITS.evidencePerFinding),
});
export const syncReportSchema = z.object({
  version: z.literal(1),
  title: z.string().max(LIMITS.titleChars),
  lineCount: z.number().int().min(0).max(10_000_000),
  redactions: z.number().int().min(0).max(10_000_000),
  findings: z.array(findingSchema).max(LIMITS.findings),
});
export type SyncReport = z.infer<typeof syncReportSchema>;

export function toSyncReport(r: AnalysisResult): SyncReport {
  return {
    version: 1,
    title: clean(r.findings[0]?.title ?? "No findings", LIMITS.titleChars),
    lineCount: r.lineCount,
    redactions: r.redactions,
    findings: r.findings.slice(0, LIMITS.findings).map((f) => ({
      ruleId: f.ruleId,
      title: clean(f.title, LIMITS.titleChars),
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      occurrences: f.occurrences,
      ...(f.location ? { location: clean(f.location, LIMITS.titleChars) } : {}),
      evidence: f.evidence
        .slice(0, LIMITS.evidencePerFinding)
        .map((e) => clean(e, LIMITS.evidenceChars)),
    })),
  };
}

/** Server-side gate: size limit, strict schema, then re-redact every string (defense in depth). */
export function parseSyncReport(input: unknown): SyncReport {
  if (JSON.stringify(input ?? null).length > LIMITS.payloadBytes)
    throw new Error("Report too large");
  const r = syncReportSchema.parse(input);
  return {
    ...r,
    title: clean(r.title, LIMITS.titleChars),
    findings: r.findings.map((f) => ({
      ...f,
      title: clean(f.title, LIMITS.titleChars),
      ...(f.location ? { location: clean(f.location, LIMITS.titleChars) } : {}),
      evidence: f.evidence.map((e) => clean(e, LIMITS.evidenceChars)),
    })),
  };
}

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, "Password must be at least 12 characters").max(128),
});

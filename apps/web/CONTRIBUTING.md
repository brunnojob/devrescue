# Contributing to DevRescue

Thanks for taking a look. DevRescue is small on purpose: one deterministic
analyzer, one workbench UI, and tests beside the rules.

## The one rule that matters

`src/lib/analyzer.ts` must stay a **pure, deterministic module**.

- No network calls. No `fetch`, no imports of clients or SDKs.
- No command execution, ever — no `child_process`, no `eval`, no dynamic
  function construction from log text.
- No reading files, environment variables, or storage.

The analyzer takes a string in and returns findings out. That is what makes the
tool safe to paste a private log into, and what keeps it working offline.
Suggestions are strings for a human to read and run themselves.

## Adding a detection rule

Rules live in the `RULES` array in `src/lib/analyzer.ts`. Each entry is a
`Rule`:

```ts
{
  id: "my-rule",                       // unique; used for cascades and dedupe
  title: "Human-readable finding name",
  category: "npm",                     // see the Category union
  severity: "error",                   // "critical" | "error" | "warning"
  confidence: 0.9,                     // 0..1, shown to the user
  pattern: /the thing to match/,
  explanation: "What happened, in plain words.",
  commands: ["the first thing to try", "a second option"],
  warnings: ["a caveat the user must read before running"],
  key: (m) => m[1],                    // optional: groups repeats into one finding
  location: (m) => m[2],               // optional: where the problem is
  supersedes: ["other-rule"],          // optional: drop these when this matches
}
```

Then add a test in `src/lib/analyzer.test.ts` asserting your rule's `ruleId`
shows up for a fixture, and — if it supersedes another rule — that the
superseded one does **not**.

### Rule guidelines

- Match on a specific, well-known error string rather than a broad one. A
  confident narrow rule beats a vague one.
- Keep `commands` short, safe, and ordered cheapest-first. Use placeholders like
  `<port>` or `<host>` instead of inventing values.
- Every command that can delete data, require `sudo`, change system settings,
  or install a possibly-wrong package needs a matching `warnings` entry.
- If two rules describe the same event at different specificity, wire up
  `supersedes` so the user sees one finding, not two.

## Fixtures and privacy

Use synthetic log text in tests and samples. Never commit a real log, a real
token, or a real connection string — including your own. The `SAMPLES` map in
`src/lib/samples.ts` exists to demonstrate the redactors; keep it that way.

## Before you open a pull request

```sh
bun run format   # prettier --write
bun run lint     # must pass with zero errors
bun run test     # must pass
```

CI runs lint, tests and the build on every push and pull request, so these are
the same gates your branch has to clear.

## UI changes

The workbench is `src/routes/index.tsx`; docs are `src/routes/docs.tsx`. Keep
any new claim about what the tool can do honest — it says "may not solve every
problem" in the footer for a reason, and the same tone belongs anywhere new
copy goes.

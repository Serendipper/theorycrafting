# Personal automation with Cursor — roadmap and stack notes

General guidance for building **personal, policy-aware** automation using **Cursor** as the editor and AI pair. Stack-agnostic phases apply to Playwright, CLI tools, APIs, etc., depending on what you automate.

**Last updated:** 2026-04-17

---

## Retail drops (honest difficulty, no “how to bypass”)

Difficulty is on a **1–10** scale for *technical effort and reliability*, not moral approval.

| Scenario | Typical difficulty | Notes |
|----------|---------------------|--------|
| **Walmart — “refresh until I land in the queue”** | Often **3–6** | Technically simple (tabs, timers, extensions), but whether it helps depends on anti-bot rules, rate limits, and how queues are assigned — not verifiable from outside. |
| **Target — “fully automated purchase flow”** | Often **8–10** for anything reliable | Odd-hour drops plus login, cart, checkout, inventory, and bot defenses make end-to-end automation brittle and high-maintenance. |

**Summary:** Low–medium effort to prototype refreshing; very high effort to make Target “fully automated” in a way that stays working and avoids other problems.

### Why not a “cheat the system” roadmap

Walmart and Target publish terms that restrict automated access, bots, and circumvention. Tooling aimed at defeating queues or fair-access controls can mean account bans, canceled orders, and (for commercial or scaled use) legal/compliance exposure depending on how it is built and used. This document does **not** lay out retailer-specific circumvention steps.

### Legitimate shape (what people often actually want)

If the goal is **not missing a 2–5 AM drop** without fighting policies:

1. **Alerts first** — Official app notifications, wish lists, and allowed third-party stock/price alerts where terms permit. Goal: wake up or get a ping instead of babysitting the site.
2. **Human-in-the-loop checkout** — When an alert fires, you log in and complete checkout yourself. Often the sustainable approach when defenses are strong.
3. **Low-touch helpers (personal, policy-aware)** — Calendar blocks, multiple devices logged in legitimately, saved addresses/payment only where the retailer allows, and practicing the normal flow when awake so the odd-hour path is muscle memory.
4. **If you still want “automation”** — Treat it as **personal productivity** (open the right URL, fill fields you could fill yourself) and read Target/Walmart terms first. Anything that mimics mass access or queue gaming is where platforms typically draw the line.

### What to tell a friend (short)

- **Walmart:** Brute-force tab refresh might sometimes help and might also get throttled or flagged — unpredictable.
- **Target:** Expect anti-bot, login friction, and changing flows; “full automation” is usually a long cat-and-mouse project, not a weekend script.

---

## Start-to-finish roadmap (general automation)

### Phase 0 — Decide what “automated” means

- **Inputs:** URLs, schedules, files, webhooks, keyboard shortcuts.
- **Outputs:** clicks/submits, API calls, Slack/email, local files, another program.
- **Where it runs:** your machine (cron), a small VPS, GitHub Actions (scheduled jobs), or a worker service.
- **Failure modes:** timeouts, CAPTCHAs, logouts, rate limits — plan for **stop safely + notify** rather than infinite retries.

Write a one-paragraph spec in Cursor (even a scratch note): goal, trigger, success criteria, and **what you will not automate** (keeps scope sane).

### Phase 1 — Project setup in Cursor

- Create a repo (git) so you can iterate and roll back.
- Pick a language you will maintain: TypeScript/Node and Python are common for automation.
- Minimal structure: `README.md` (how to run), `.env.example` (secret *names*, no values), `src/` or `scripts/`.
- Pin dependencies (`package.json`, `requirements.txt`, `uv.lock`, etc.) so the environment is reproducible.
- Use Cursor to generate boilerplate from your spec (e.g. “Node + TypeScript CLI that reads `.env` and logs to stdout”).

### Phase 2 — Core automation path (happy path first)

- Smallest vertical slice: one command that does **one thing** end-to-end (open flow → one action → exit 0).
- Prefer stable interfaces:
  - Official APIs or exportable data when available.
  - Browser automation (e.g. Playwright) when the UI is the only surface — design around **selectors and waits**, not fixed sleeps.
- Secrets: never commit; load from env or OS keychain; document required vars in `.env.example`.
- In Cursor, work file-by-file: implement the runner, then extract helpers (login, navigation, parsing) as named functions.

### Phase 3 — Hardening (what makes it “a system”)

- **Logging:** structured logs (level, step, correlation id); redact tokens/passwords.
- **Retries:** exponential backoff, max attempts; distinguish “retry” vs “fatal”.
- **Idempotency** where it matters (avoid double-submit if the script restarts).
- **Configuration:** flags or config file for URLs, selectors, schedules — avoid hardcoding everything.
- **Health:** exit codes for CI/cron; optional heartbeat or notification on failure.

Refactor once the happy path works — easier than perfect architecture on day one.

### Phase 4 — Observation and debugging

- **Artifacts on failure:** screenshots (Playwright), HTML dumps, last response body (sanitized).
- **Dry-run mode:** log intended actions without side effects when possible.
- **Local replay:** fixtures (mock HTML/JSON) so parsers can be tested without hitting the network every time.

### Phase 5 — Scheduling and operation

- Cron / systemd timer / Task Scheduler on a machine that is on when jobs must run — or a VPS/cloud worker for 24/7.
- GitHub Actions (or similar) for scheduled jobs that do not need a GUI — awkward for interactive browser flows unless headed/headless patterns are chosen carefully.
- **Notifications:** email, Slack, Discord webhook on success/failure.
- Document exactly how to run: `pnpm run job`, env vars, and where logs go.

### Phase 6 — Using Cursor effectively on this kind of project

- **Single-source spec:** keep the spec in-repo; when behavior drifts, update the spec first, then the code.
- **Small tasks per chat:** “add retry wrapper,” “extract login to `auth.ts`,” “add Playwright trace on failure.”
- Let the model read your repo: `@` relevant files instead of pasting huge dumps.
- **Tests where they pay off:** unit tests for parsing/config; one smoke test that mocks network or uses a staging fixture.

### Phase 7 — Legal and policy reality check

Before you depend on it for anything important: read the site’s terms and acceptable use. Automation can be fine for your own accounts and permitted APIs; it often is not for circumventing access controls or queues. Treat ToS and rate limits as **part of the environment**, not bugs.

### End state (“finished”)

You have: a runnable command, documented env, scheduling, failure alerts, and enough logging to fix the next break in one session. That is the practical finish line for a personal automation system.

---

## Recommended stack (narrow checklist)

### Choice

**Node.js 20+ · TypeScript · Playwright**

- Playwright: reliable browser automation (auto-waits, traces, screenshots, multi-browser).
- TypeScript catches many bugs before you run headless at 3 AM.
- Node fits Cursor workflows, CI, and small deploys (VPS, Docker).

Python + Playwright is nearly equivalent if you prefer Python.

### Project shape

```text
automation/
  package.json
  tsconfig.json
  .env.example
  README.md
  src/
    config.ts          # env + validation (e.g. zod)
    logger.ts
    main.ts            # entry: parse args, run flow
    flows/
      example-flow.ts  # one vertical slice per target/site
    lib/
      browser.ts       # launch context, default timeouts
      retry.ts
  playwright.config.ts
```

### Bootstrap commands

```bash
mkdir automation && cd automation
npm init -y
npm install playwright zod dotenv
npm install -D typescript @types/node tsx
npx playwright install chromium   # or install-deps if needed on Linux
npx tsc --init --rootDir src --outDir dist --esModuleInterop --resolveJsonModule --strict
```

Add scripts to `package.json`:

```json
"dev": "tsx src/main.ts",
"build": "tsc",
"start": "node dist/main.js"
```

### Libraries (minimal)

| Role | Package |
|------|---------|
| Browser | `playwright` |
| Env | `dotenv` + `zod` (fail fast on bad/missing env) |
| Logging | `pino` or a thin console wrapper at first |

### Implementation order

1. `config.ts` — load `.env`, validate with Zod, export typed config.
2. `lib/browser.ts` — launch / `newContext` with sane timeout; optional trace/video on failure.
3. One `flows/example-flow.ts` — single happy path: open → wait for selector → act → assert visible text or URL.
4. `main.ts` — CLI entry (`--dry-run` optional), call one flow, `process.exit(code)`.
5. Hardening — `retry.ts` (max attempts, backoff), structured logs, screenshot + trace on failure.
6. Schedule — cron/systemd calling `npm run start` or `node dist/main.js` with env injected on the host (not committed).

### Playwright defaults worth setting early

- Prefer **locator + role/text** over brittle CSS when possible.
- Use `expect(locator).toBeVisible()` (or Playwright assertions) instead of long fixed sleeps.
- Enable `trace: 'on-first-retry'` or retain-on-failure in `playwright.config.ts` once you add tests/specs.

### When you are “done”

Runnable `npm run start`, `.env.example`, failure artifacts (screenshot/trace path in logs), and one line in README for cron — a complete **personal automation baseline**.

---

## One-page decision doc (for sharing)

You can reuse this outline with a friend — goals, constraints, risks, legitimate alternatives — **without** queue-circumvention steps:

| Section | Contents |
|---------|----------|
| Goal | What problem are we solving (e.g. not missing a drop)? |
| Constraints | Sleep, budget, terms of service, acceptable risk to accounts |
| Risks | Bans, canceled orders, maintenance burden of brittle automation |
| Legit path | Alerts → human checkout → practice / saved legit prefs |
| Technical reality | Difficulty estimates; “weekend script” vs long-term upkeep |

---

## Related

Stack-specific narrow checklists (folder layout, `npm`/`pip` commands) depend on **target stack** (Node + Playwright vs Python + Playwright vs pure HTTP) and whether jobs must run **headless on a server**. Adjust Phase 1–5 accordingly; keep retailer-specific automation within **their terms** and your own risk tolerance.

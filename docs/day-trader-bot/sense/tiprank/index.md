# Sense: TipRanks ingestion

Notes for the **day-trader-bot** pipeline: pulling **TipRanks**-related signal into a deterministic **Sense** layer (normalize → correlate → notify / trade later).

**Maintenance:** Update this file when integration approach, ToS, or official APIs change. Last reviewed: **2026-03-21** (not a live compliance review).

---

## 1. Define what “TipRanks” means for your pipeline

TipRanks bundles multiple product surfaces (analyst scores, news, calendars, insiders, screeners, etc.). Decide the **subset** you need before choosing an integration:

- Watchlist + news only?
- Smart Score / analyst rating changes?
- Insider activity feeds?
- Something else?

Downstream **correlation** and **signals** should consume a **normalized event** model, not raw TipRanks-only shapes (so you can swap sources).

---

## 2. Integration options (roughly: preferred → fragile)

### A. Official / licensed (best for stable automation)

- **TipRanks for Enterprise** — institutional API-style access, documented feeds: [enterprise.tipranks.com](https://enterprise.tipranks.com/). Typically **not** the same as the consumer app subscription; contact sales for developer/API availability and terms.
- **Third-party data vendors** — e.g. **Nasdaq Data Link** and similar may carry TipRanks or comparable datasets as **paid, licensed** tables (pandas-friendly pulls, scheduled jobs). Verify current publisher listings and licensing.

### B. Consumer app / website (no stable public hobby API)

- The **mobile app** and **website** are built for humans, not documented bot APIs.
- **Reverse-engineering** private mobile APIs or **scraping** authenticated pages breaks often and may **violate Terms of Use**. Treat as **high risk** for maintenance and compliance; read TipRanks’ current ToS before automating.

### C. Indirect ingestion (sometimes “good enough”)

- **Email alerts** from TipRanks (if the product sends them): dedicated inbox → **IMAP** or forwarding → **parse** into `NormalizedEvent` in Python.
- **Automation platforms** (IFTTT, Zapier, etc.): only if TipRanks or email exposes triggers you’re allowed to use—verify ToS.

---

## 3. Python service shape (adapter pattern)

Keep a **thin source adapter** so Sense stays source-agnostic:

| Piece | Role |
|-------|------|
| `ingestion/sources/tipranks.py` (name as you prefer) | Implements something like `fetch_events(since) -> list[NormalizedEvent]` for whatever *allowed* channel you have (HTTP API, vendor SDK, email parser). |
| `NormalizedEvent` | e.g. `{ source, occurred_at, url?, title?, body_snippet?, raw_ref }` — same for RSS, brokers, SEC filings later. |
| Secrets | API keys, IMAP passwords: **env / vault only**, never committed. |

Correlation / Discord / risk / execution **only** see **`NormalizedEvent`** (or your internal equivalent).

---

## 4. Decision checklist

1. Read **TipRanks Terms of Use** for anything you plan to automate as a user.
2. If budget allows: ask **Enterprise** whether a **developer API or data feed** exists for your use case and what it costs.
3. If you need **time-series / bulk** data: compare **Nasdaq Data Link** (or similar) licensed datasets vs. rolling your own scrapes.
4. If no affordable API: design Sense around **other** feeds (RSS, broker APIs, SEC, news APIs) for the same *intent*, and keep TipRanks as **human-in-the-loop** (user uses the app; bot uses other sources until a licensed pipe exists).

---

## 5. Links (verify periodically)

- [TipRanks — Enterprise](https://enterprise.tipranks.com/)
- [Nasdaq Data Link](https://data.nasdaq.com/) — search publishers for TipRanks or substitute datasets

---

## 6. Disclaimer

This doc is **technical planning**, not legal or investment advice. API availability, pricing, and permitted use change—confirm with TipRanks and your counsel if needed.

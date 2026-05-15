# PRD — Ask IRA (Unified Chat Experience)

**Status:** Draft v1 · **Scope:** Hackathon demo + Internal alpha · **Last updated:** 2026-04-26

> This PRD is consumed by Claude Code as build context. Tight by design. No prose where a table works.

---

## 1. Goal

Ask IRA is a single chat-driven surface where an auditor can **ask data questions** and **build re-runnable workflows** in one conversation. Chat carries the dialogue; **workspace canvas** carries the explainability — switching components based on whether IRA is answering a query (`Query Plan` / `Coder` / `Reference`) or shaping a workflow (`Workflow Plan` / `Input Config` / `Output Config` / `Result Preview`).

**Three entry points:**
1. Sidebar `Ask IRA` (toggle off — query mode).
2. `Build with IRA` button on workflow library (toggle pre-on — workflow mode).
3. `Save as workflow` action below a complete query result (toggle flips on mid-thread).

When a query becomes a workflow, IRA walks the user through a **checkpoint dialog** to mark which parameters (date ranges, statuses, thresholds) are configurable at run time. Same conversation produces both an answer *and* a workflow another user can run later.

---

## 2. User journey

### Path 1 — Direct query (toggle off)
1. User opens Ask IRA from sidebar. Empty chat, empty workspace, **toggle off**.
2. User types question (or uploads file). IRA shows `thinking` state.
3. Workspace loads in order: `Query Plan` → `Coder` → `Reference`. Newest auto-expands; older collapse.
4. Follow-ups stay in same thread; workspace updates per turn.
5. End: action bar appears below complete result → `Export · Dashboard · Reports · Save as workflow`.

### Path 2 — From workflow creator (toggle pre-on)
1. User clicks `Build with IRA` on workflow library. Ask IRA opens with **toggle on**, hint copy *"Describe the workflow you want to build."*
2. User describes workflow. IRA confirms, shows `thinking`.
3. Workspace loads: `Workflow Plan` → `Input Config preview` → `Output Config` → `Result Preview`.
4. IRA asks **checkpoint inline:** *"Which parameters should be configurable at run time?"* Chips suggest inferred params (threshold, date window, status filter).
5. User picks chips; workspace updates Input Config + Output Config + Result Preview.
6. User clicks `Save to Library` → toast confirm.

### Path 3 — Save as workflow from query (toggle flips mid-thread)
1. After a complete query result (Path 1, end), user clicks `Save as workflow`.
2. Confirm modal: *"Turn this thread into a workflow? You won't be able to switch back to query mode in this chat — start a new chat for that."* → confirm.
3. **Toggle flips on and locks** (renders as non-clickable `Pill tone="info"` reading `Workflow mode`). Workspace swaps query components for workflow components, seeded from the original query.
4. IRA posts new message in same thread: checkpoint question + inferred suggestions.
5. User picks; workspace updates; user reviews `Result Preview`.
6. User clicks `Save to Library` → toast. Original chat history remains scrollable above.

### Toggle behavior — locked
- **Off → On** is a deliberate user action (Path 2 entry, Path 3 confirm).
- **On → Off does not exist within a thread.** To do a query again, user starts `+ New chat`.
- Visual: switch UI only when off + clickable. When on, replaced with a status pill — no off affordance shown.

### Upload behavior — dual
- Composer upload button (Lucide `Paperclip`) is always available.
- IRA can also explicitly request data (*"Upload Q1_GST_returns.xlsx or use a connected source"*) with an inline `Upload file` button + connected-source chip below its message. Both routes work; same file picker.

---

## 3. Wireframes + design system

### Layout

Two panes inside the standard app shell.

```
┌─ App sidebar (256px, brand-900) ─┬──────── Ask IRA ────────────────────────┐
│                                   │                                          │
│   • Sidebar nav (existing)        │ ┌─ Chat canvas (~520px) ─┬─ Workspace ─┐ │
│   • + New chat                    │ │                         │  (flex)     │ │
│                                   │ │  conversation stream    │  accordion  │ │
│                                   │ │  ─────────────────────  │  of cards   │ │
│                                   │ │  composer (sticky)      │             │ │
│                                   │ └─────────────────────────┴─────────────┘ │
└───────────────────────────────────┴──────────────────────────────────────────┘
```

### Chat canvas (~520px fixed)

**Composer (sticky bottom)**
- Workflow-mode toggle (left). Switch when off; locked `Pill tone="info"` reading `Workflow mode` when on.
- Upload button — Lucide `Paperclip`, ghost variant, icon-only.
- Text input — single line, grows to max 6 lines.
- Send button — `brand-600`, disabled until text or attachment present.

**Conversation stream**
| Element | Treatment |
|---|---|
| User message | Plain text, left-aligned, `ink-800`, 17px. No avatar. No bubble. |
| Thinking state | Three pulsing `brand-400` dots, 900ms stagger, with current step name above (*"Querying transactions table…"*). |
| IRA message | `AIResponse` recipe — gradient border (violet→magenta 24% alpha), `paper-0` + 3% brand tint bg, `body-lg` 17px, max 66ch. Inline citation chips. |
| Inline checkpoint chips | `Pill`-styled buttons, `r-full`, secondary variant, multi-select. Freeform reply also accepted. |
| Inline upload CTA | `Button variant="secondary"` + Lucide `Upload` icon, beneath IRA's request message. |
| Action bar | Below complete IRA result only. Buttons: `Export · Dashboard · Reports · Save as workflow`. **Hidden during streaming, on errors, on clarification turns, on text-only outputs without table/graph data.** |

### Workspace canvas (flex, accordion both modes)

- Vertical accordion of `Card variant="outlined"`, radius 12, `paper-200` border.
- **Smart switching:** newest auto-expands; older collapse to one-line summary (icon + name + status pill + last-updated time).
- **Component header:** Lucide icon + sentence-case name + status pill on right.
- **Status pills:** `Pill tone="success" Done` / `tone="info" Working` / `tone="warning" Needs input` / `tone="error" Failed` / `tone="default" Stale`.
- **Mode-specific component sets:**
  - **Query mode:** `Query Plan` → `Coder` → `Reference`.
  - **Workflow mode:** `Workflow Plan` → `Input Config preview` → `Output Config` → `Result Preview`.
- **Result Preview tile:** renders KPI tiles row + chart + flagged-items table inline. Sticky action footer inside tile when expanded: `Edit Configuration · Save to Library · Run Detection`.
- **Empty state:** centered on `canvas-elevated`, `text-ink-500`, *"Components appear here as I work through your question."*

### Header (above panes)
- Breadcrumb: `Home / Ask IRA / [conversation title]`. IRA generates title after first turn.
- Right: `+ New chat` · overflow menu (rename, delete, export transcript). **No `Save as workflow` here** — it lives in the chat action bar.

### Design system tokens (Editorial GRC)

| Element | Token |
|---|---|
| App canvas | `--canvas` `#FCFAFD` |
| Composer + cards bg | `--canvas-elevated` `#FFFFFF`, border `--paper-200` |
| Workspace card | `Card variant="outlined"`, radius 12, border `--paper-200` |
| IRA response | `AIResponse` — gradient border, `paper-0` + brand 3% tint |
| Citations | inline pill, `JetBrains Mono code-sm`, `brand-50` bg, `brand-700` text |
| Thinking dots | three `brand-400` dots, spring ease, 900ms stagger |
| Streaming caret | 2px `brand-600`, 1.2s blink |
| Workflow-mode chip | `Pill tone="info"`, label `Workflow mode`, no border, no icon |
| Checkpoint chips | `Button variant="secondary" size="sm"`, `r-full` |
| Upload button (composer) | `Button variant="ghost" size="sm" icon-only`, Lucide `Paperclip` |
| Upload CTA (inline) | `Button variant="secondary" size="md"`, Lucide `Upload` |
| Toasts | success 5s · info 5s · warning 8s · error persistent · width 380px |
| Focus ring | `0 0 0 4px rgba(106,18,205,0.24)` |
| Typography | Inter for chat + UI; Source Serif 4 for narrative hero only; JetBrains Mono inside `Coder` + citations. |
| Density | 32px page padding, 8pt grid throughout |

---

## 4. QA / UAT scenarios + failure states

### Positive

**S1. Direct query renders complete result.**
*Steps:* User opens Ask IRA, types `"Show duplicate invoices in Q1 2026 with same vendor + amount + date ±3 days"`, sends.
*Expect:* Workspace loads `Query Plan` → `Coder` → `Reference`. Chat renders IRA prose + inline citations (`INV-4521`, `INV-3102`). Action bar appears: `Export · Dashboard · Reports · Save as workflow`.

**S2. Workflow build from creator entry point.**
*Steps:* User clicks `Build with IRA`. Toggle pre-on, empty state. Types `"Detect duplicate invoices weekly across all vendors with >85% match"`, sends.
*Expect:* Workspace loads `Workflow Plan` → `Input Config preview` (CSV/Excel + 1 source). IRA inline checkpoint: *"Which parameters should be configurable at run time?"* with chips: `Match threshold (85%)` `Date window (rolling 7 days)` `Vendor filter (all)`.

**S3. Save-as-workflow flips toggle mid-thread.**
*Steps:* From completed query (S1), click `Save as workflow` → confirm modal → confirm.
*Expect:* Toggle flips on and locks. Workspace swaps to workflow components seeded from query SQL. IRA posts checkpoint message in same thread with inferred suggestions: `Date range (Q1 2026)` `Vendor scope` `Threshold (±3 days)`.

**S4. Multi-turn query with mid-conversation upload.**
*Steps:* Mid-conversation, click composer upload, pick `Q1_vendor_master.csv` (2.3 MB). Type `"Cross-reference these vendors against the duplicates"`, send.
*Expect:* Attachment chip in user message. Workspace `Reference` updates with new file. IRA prose references both original duplicates + new vendor data.

**S5. IRA explicitly requests data, user uploads inline.**
*Steps:* Ask `"Show GST mismatches for last quarter"` without uploading anything.
*Expect:* IRA replies *"I need the GST returns file to answer this. Upload Q1_GST_returns.xlsx or point me at a connected source."* with inline `Upload file` button + chip `Use connected source: Tally Sync`. Both work.

### Negative / mode-specific

**S6. Upload exceeds size or format limit.**
*Steps:* Attempt to upload `transactions_2024.zip` (340 MB) or `audit_recording.mp4`.
*Expect:* File picker rejects pre-upload. Toast `error` (persistent): *"File must be CSV, Excel, or PDF under 50 MB. Got: ZIP, 340 MB."* No partial upload state.

**S7. Workflow save fails (server error).**
*Steps:* Complete S3 checkpoint flow, click `Save to Library`. API returns 500.
*Expect:* Spinner clears. Toast `error` (persistent): *"Couldn't save workflow. Your draft is preserved here — try again, or copy the workflow plan from the workspace."* Button re-enabled. Chat + workspace state preserved.

**S8. Query returns no results.**
*Steps:* Ask `"Show invoices over ₹100 Cr in Q1 2026"` — no matches exist.
*Expect:* IRA prose: *"I checked the Q1 2026 invoice ledger (4,820 records). No invoices exceeded ₹100 Cr. Largest was ₹47.3 Cr (Acme Corp, INV-4521)."* Workspace tiles show `Done — empty result`. Action bar shows only `Export · Save as workflow` (no Dashboard/Reports for empty data).

**S9. IRA citation doesn't resolve.**
*Steps:* Click inline citation chip `IT-GEN-99` in IRA response.
*Expect:* Citation drawer attempts fetch → fails. Drawer shows: *"This reference (`IT-GEN-99`) couldn't be loaded. It may have been removed or you don't have access."* + `Report this answer` link. Chip stays inline; conversation not broken.

**S10. Send fails — network drop mid-message.**
*Steps:* Type message, click send. Connection drops.
*Expect:* Message in chat with `Sending…` state → converts to `Failed to send` with inline `Retry` button. Composer re-enabled. No silent loss.

### Stitching / RBAC / edge cases

**S11. User lacks permission to save workflow.**
*Setup:* External Auditor role (read-only).
*Expect:* `Save as workflow` button **hidden** in action bar (not just disabled). If user opens via direct workflow-creator link, toggle locked off + IRA shows: *"Workflow building isn't available to your role. You can run published workflows from Workflows."*

**S12. Two browser tabs open the same chat thread.**
*Steps:* Send query in Tab A → open same chat URL in Tab B.
*Expect:* Tab B loads server state with read-only banner: *"This chat is open in another tab. Refresh to take over."* Sending from Tab B triggers confirm: *"Continue this chat here? The other tab will become read-only."* Server-side last-writer-wins.

**S13. Network drops mid-IRA-stream.**
*Steps:* IRA streaming response, connection drops at ~40%.
*Expect:* Caret stops. Partial message stays visible with banner: *"Connection lost while answering. The partial response is shown below — retry to get the full answer."* + `Retry`. On retry, IRA regenerates from the same prompt (does not splice).

**S14. Save-as-workflow attempted on incomplete output.**
*Setup:* IRA produced text only, no table/graph/structured data.
*Expect:* Action bar does **not** show `Save as workflow`. Visibility check is on result completeness, not on chat-having-an-answer. UAT must explicitly probe this gating.

**S15. Saved workflow run errors out from Workflows page.**
*Setup:* Click `Run Detection` on saved `Duplicate Invoice Detection`. Source data missing for one configured input.
*Expect:* Run page shows: *"This run couldn't complete. Input `Q1_invoices_2026` returned 0 rows — was it removed or renamed? Check the source or open in Ask IRA to debug."* + `Open in Ask IRA` button (opens fresh chat seeded with workflow + failure context).

### Graceful failure principles (global rules)

- Never show raw stack traces or HTTP codes. Always one-sentence what + one-sentence next step.
- Never silently lose user input. Failed sends keep the message + retry; failed uploads keep the file selected.
- Never block the chat on a workspace failure. Failed workspace tile shows inline error + `Retry component`; chat stays interactive.
- Never auto-retry a failed mutation (save / delete / run). Reads (citations, references) auto-retry once.
- Always preserve the chat thread. Drafts persist across browser refresh.

---

## 5. Async states

### Composer

| State | Trigger | Visual | Behavior |
|---|---|---|---|
| Idle | Default | Send disabled, `paper-200` border | Placeholder *"Ask anything or describe a workflow to build…"* |
| Typing | Text or attachment | Send enabled (`brand-600`) | Char count shown after 1,500 chars |
| Sending | Send clicked | Send → spinner, input disabled | Message in chat with `Sending…` label |
| Sent | Server ack | Spinner clears, composer resets | `Sending…` removed within 200ms |
| Send failed | Net/API fail | Message stays + `Failed` pill | Inline `Retry` + `Edit and resend` |
| Attaching | File picked | Attachment chip with progress bar 0–100% | Filename + size + cancel × |
| Attach failed | Upload fail | Chip → `error` tone | Inline `Retry upload` + `Remove` |

### IRA response

| State | Trigger | Visual | Copy |
|---|---|---|---|
| Thinking — generic | IRA queued | Three pulsing `brand-400` dots, 900ms stagger | None |
| Thinking — named step | IRA running sub-task | Dots + step name above | *"Reading process catalog…"* / *"Querying transactions table…"* / *"Drafting workflow plan…"* |
| Tool-running | IRA invoked tool | Inline mono pill below dots | `tool: query_runner · 1.2s elapsed` |
| Streaming | First token received | Prose appears + 2px `brand-600` caret blinking | Auto-scrolls only if user is at bottom |
| Streaming paused (optional v1.1) | User clicks `Pause` | Caret freezes, `Resume` chip below | *"Paused. Click resume to continue."* |
| Done | EOF token | Caret removes, timestamp under message | `Answered in 1.2s · 4 sources · model: ira-v2` |
| Errored | Stream failure | Partial response stays + warning banner attached | *"Connection lost. Partial response shown — retry for full answer."* + `Retry` |

### Workspace component

| State | Visual | Copy |
|---|---|---|
| Pending | Card collapsed, pill `Queued`, skeleton bar | None |
| Loading | Pill `tone="info" Working`, skeleton lines (3 rows pulsing 1.5s) | None |
| Streaming | Real content row-by-row, fade-in 200ms per row, pill stays `Working` | None |
| Done | Pill `tone="success" Done`, last-updated time in header (`Updated 12s ago`) | None |
| Needs input | Pill `tone="warning" Needs input`, header bg `brand-50` | Inline CTA inside card, e.g., *"Pick parameters to continue."* |
| Errored | Pill `tone="error" Failed`, error icon + line | *"Couldn't load this step."* + `Retry component`. Chat stays interactive. |
| Stale | Subtle `paper-100` overlay + chip top-right `Stale` | *"Data changed. Refresh to update."* |

### Workflow build

| State | Visual | Copy / behavior |
|---|---|---|
| Drafting checkpoint | Chips appear below IRA message | *"Pick which parameters should be configurable at run time."* Multi-select. |
| Checkpoint pending user reply (>30s) | Subtle pulse on chip group | None. Pulse stops on first interaction. |
| Building preview | `Result Preview` `Working` + skeleton of KPI tiles + chart + table | Inline above tile: *"Generating live preview from sample data…"* |
| Preview ready | `Result Preview Done`, action footer enabled | None |
| Saving to library | Button → spinner, other actions disabled | None |
| Saved | API success | Toast `success` 5s: *"Workflow saved to library."* + `View workflow` link. Button reverts to `Saved ✓` for 3s, then back to `Save to Library`. |
| Save failed | Button reverts | Toast `error` (persistent) per S7 |
| Run-now in progress | Button → spinner, `Result Preview` swaps to `Run in progress…` skeleton | *"Running on full data — this may take up to 30s."* |
| Run-now complete | Result Preview re-renders with real numbers | Inline: *"Run completed at 22:14 IST · 3 anomalies flagged."* |
| Run-now failed | Error tile per S15 | `Open in Ask IRA to debug` button |

### System-wide

| State | Visual | Copy |
|---|---|---|
| Network reconnecting | Sticky banner below header, `tone="warning"`, subtle pulse | *"Reconnecting…"* — no actions blocked client-side. |
| Network restored | Banner `tone="success"` for 3s, dismisses | *"Reconnected."* |
| Optimistic action pending | Target element `brand-50` bg | None — silent until confirm |
| Optimistic confirmed | Bg fades over 200ms | None |
| Optimistic rejected | Rolls back with shake (75ms × 2) | Inline error + retry |
| Background sync (>5min away) | Top banner `tone="info"` for 4s | *"Refreshed with latest data."* |
| Long-running >10s | Step name persists with elapsed time | *"Querying transactions table… 14s elapsed. This is taking longer than usual."* |
| Long-running >30s | Adds `Cancel` button | Cancel triggers IRA-side abort + chat banner *"Cancelled."* |
| Long-running >60s | Stronger copy | *"Still working — should be done within a minute."* |
| Long-running >120s | Hard cancel auto-offered | *"This is taking unusually long. Cancel and retry, or wait."* |
| Concurrent tab takeover | Banner in original tab | *"This chat is being edited in another tab. Refresh to take over."* |

**Reduced-motion:** all pulsing dots, skeleton shimmer, caret blink, shake animations respect `prefers-reduced-motion: reduce` — replaced with static states (single static dot; solid caret; flat `paper-100` skeleton bg).

---

## 6. Metrics + scale

### North star
**Workflow operationalization rate** — `% of complete IRA query results that become saved workflows within 7 days`.
- v1 launch target: ≥ 15% within first 30 days. Stretch: 25%.

### Business metrics (90d post-launch)

| Metric | Definition | Target |
|---|---|---|
| Saved workflows / WAU | Unique workflows saved per weekly active user | ≥ 0.5 |
| Workflow runs / week | Total runs from saved library | 3× baseline by week 8 |
| DAU / WAU stickiness | Daily active over weekly active in Ask IRA | ≥ 40% |
| Queries per active user per day | Median | ≥ 4 |
| First-week return rate | New user returns within 7d of first query | ≥ 60% |
| Time-to-first-workflow | First IRA query → first saved workflow per user | < 3 sessions |
| Hours saved per engagement | Self-reported in post-engagement survey vs baseline | ≥ 6 hrs (median) |
| Workflow re-use rate | Avg # runs per saved workflow within 30d | ≥ 4 |

### Tech / observability metrics

| Metric | SLO |
|---|---|
| Time-to-first-token (send → first IRA token) | p50 < 1.5s, p95 < 4s |
| Full response latency (send → done) | p50 ~60s, p95 ~120s |
| Streaming connection drop rate | < 0.5% |
| Send failure rate | < 0.2% |
| Upload failure rate (excl. user-cancel) | < 1% |
| Error rate per IRA turn (`Errored`) | < 1.5% |
| Citation resolve failure | < 0.5% |
| Optimistic rollback rate | < 0.3% |
| Workflow save latency | p95 < 3s |
| Workflow run-now latency | p95 < 30s |

### Per-component timing (active accordion tile)

| Component | Mode | p50 | p95 | Notes |
|---|---|---|---|---|
| Query Plan | Query | < 8s | < 20s | Pure reasoning, no data hit |
| Coder | Query | < 35s | < 75s | Code gen + execution against connected data |
| Reference | Query | < 8s | < 20s | Citation resolution + display |
| Workflow Plan | Workflow | < 12s | < 25s | Step decomposition |
| Input Config preview | Workflow | < 8s | < 18s | Schema inference from sources |
| Output Config | Workflow | < 12s | < 25s | KPI/table/graph structuring |
| Result Preview | Workflow | < 35s | < 70s | Live preview against sample data |
| Inter-component gap | Both | < 1s | < 2s | Time between one component done and next starting |
| First-token within a component | Both | < 3s | < 8s | Active accordion must show skeleton/status/content within 3s |

**Pacing rule:** active accordion tile must show *something* (skeleton, status, or first row) within 3s of becoming active. Long-running components (`Coder`, `Result Preview`) must surface **named-step updates every 10s**. Silence > 15s without status update → tile shows `Taking longer than usual…`.

### Funnel events (instrument explicitly)

```
query_sent → result_complete → action_bar_shown → save_as_workflow_clicked
  → confirm_modal_accepted → workflow_saved → workflow_run_at_least_once
```
Highest-leverage diagnostic: `% of action_bar_shown → save_as_workflow_clicked`.

### Scale (v1)

| Dimension | v1 target | v1 ceiling |
|---|---|---|
| Concurrent active users | 50 | 200 |
| Concurrent IRA streams | 20 | 80 |
| Max chat thread length | 50 turns / 100 KB context | 200 turns |
| Max attachment size | 50 MB | 100 MB |
| Max attachments per turn | 3 | 5 |
| Saved workflows per workspace | 500 | 2,000 |
| Workflow run frequency | 1 / minute / workspace | 5 / minute |
| Result Preview row limit | 1,000 inline | 10,000 paginated |

### Explicitly NOT instrumented in v1
- Trust signals (citation CTR, thumbs-up/down) — deferred.
- A/B test infra for prompt variants — out of scope.
- Per-component sub-timing beyond top-level latency.

---

## 7. Dependencies + stitching

All six surfaces are **greenfield** — built alongside Ask IRA. Order below = build sequence; anything `Required pre-v1` must ship (or stub) before Ask IRA demos end-to-end.

| # | Surface | Status | Owner | Contract | Stub for hackathon |
|---|---|---|---|---|---|
| 1 | Workflow library page | Required pre-v1 | Workflows team | `POST /workflows {name, description, plan, input_config, output_config, configurable_params, source_chat_id}` → `{workflow_id, library_url}`. `GET /workflows` for listing. | In-memory list, no persistence. Toast → click → workflow appears in library. |
| 2 | Workflow creator surface | Required pre-v1 | Workflows team | Single button `Build with IRA` → routes to `/ask-ira?mode=workflow&seed=<creator_context>`. | Single button on workflow library page. |
| 3 | Data sources / connections | Required pre-v1 | Data platform | `GET /sources` → `[{id, name, type, status, schema_summary}]`. `POST /uploads` → `{file_id, parsed_schema}`. Chunked upload, virus scan, parse (CSV/Excel/PDF), schema inference. | Local file upload only. Connector list hardcoded to 2 entries (`Tally Sync`, `Evidence repo`) with canned schemas. |
| 4 | Auth + RBAC | Required pre-v1 | Platform | `GET /me` → `{user_id, role, permissions[]}`. Frontend hides actions per `permissions[]`. | Single hardcoded role `Auditor` with all perms. External Auditor deferred. |
| 5 | Citation / evidence registry | Stub-only for v1 | Governance | `GET /entities/{id}` → `{id, type, title, snippet, link}`. 404 → graceful failure per S9. | In-memory entity map for ~20 fake citations matching demo dataset. Click opens side drawer with snippet. |
| 6 | Chat infra (streaming, persistence) | Built inside Ask IRA | Ask IRA team | SSE for streaming + REST for persistence. Internal only. | In-memory persistence (lost on server restart) acceptable for hackathon; durable in alpha. |

### Build sequence

```
Week 1–2  | Auth/RBAC stub  ┃ Data upload basic ┃ Chat infra (streaming)
Week 2–3  | Ask IRA query mode (Query Plan / Coder / Reference)
Week 3–4  | Workflow library stub ┃ Workflow creator entry button
Week 4    | Ask IRA workflow mode + checkpoint UX + Save flow
Week 5    | Result Preview + Run-now stub
Week 6    | Citation registry stub + drawer
Week 6+   | Polish, async states, error UX, telemetry
```

### Out of scope for v1 / v1.1
- **Engagements:** attach Ask IRA chat or saved workflow to a specific audit engagement.
- **Findings:** one-click create Finding entity from chat output.
- **Notification inbox:** workflow run completions / failures route to durable inbox (not just toasts).
- **External auditor RBAC:** read-only chat threads, no save/run.
- **Real connector registry:** beyond Tally Sync stub.

---

## 8. Open questions + assumptions

### Open questions (need decisions)

| # | Question | Why it matters | Owner | Deadline |
|---|---|---|---|---|
| 1 | Real query → workflow conversion rate target — is 15% baseline-justified or aspirational? | North-star calibration | Product | Pre-demo |
| 2 | When workflow-mode-locked thread receives a pure query, suggest "open new chat" or answer it inside workflow mode? | Mode-switching guardrails | Design | Mid-M1 |
| 3 | Chat thread sharing — can a user share a link to their Ask IRA thread? RBAC implications. | Collaboration scope | Product + Platform | M2 planning |
| 4 | Auto-naming threads — IRA generates title (deterministic? streamed?) or user names it? | Affects M1 P1 scope | Design | Pre-M1 |
| 5 | Workflow versioning — edit creates new version or in-place mutation? | Data model | Backend | M2 planning |
| 6 | Concurrent user limit per workspace — rate limiting needed? | Infrastructure cost | Platform | M2 planning |
| 7 | Context window per thread (50 turns / 100 KB cap) — at limit, truncate / force new chat / summarize? | UX at long-thread end | Product + ML | Mid-M1 |
| 8 | Configurable params validation — when checkpoints conflict (e.g., date_range configurable but SQL hardcodes it), refuse / auto-fix / warn? | Workflow correctness | ML + Product | Pre-workflow-mode build |
| 9 | What happens to attached files when chat is deleted? Cascade / soft-delete / retain for compliance? | Data retention | Legal + Backend | M2 planning |
| 10 | Trust signals (thumbs-up/down, citation CTR) — needed by alpha or post-pilot survey enough? | Quality measurement gap | Product | Pre-M2 |
| 11 | Pricing / metering — does Ask IRA usage count against a per-user quota? Where in UI? | Commercial model | Product | M2 planning |
| 12 | Failure mode when zero data sources connected — what does Ask IRA say in onboarding? | Onboarding gap | Design | M2 planning |

### Assumptions (taken as true; mark explicitly)

1. **One workspace per organization.** Multi-workspace switching exists at platform level; Ask IRA threads scoped to single workspace. No cross-workspace queries.
2. **Single language: English.** No localization in v1.
3. **Desktop-first, ≥1024px viewport.** Mobile / tablet not in scope.
4. **Single LLM model per environment.** No per-user model preference, no model picker.
5. **File parsing best-effort.** CSV/Excel/PDF up to 50 MB. Encrypted PDFs, scanned image-PDFs without OCR, password-protected files silently rejected with generic error.
6. **No PII redaction in v1.** Uploaded data treated as auditor-confidential; no automatic masking.
7. **Workspace canvas auto-scroll.** New auto-expanded item triggers scroll; user can override; auto-scroll resumes only when user is at bottom.
8. **Citations are non-editable.** IRA inserts; user clicks but cannot add / remove / re-attribute.
9. **`Save as workflow` is one-shot per chat.** Once a thread becomes a workflow thread, that chat's `Save as workflow` is consumed. Re-save happens via workspace footer `Save to Library`.
10. **No retroactive workflow creation from old chats.** `Save as workflow` only on current thread / current model context.
11. **Streaming uses SSE, not WebSocket.** Simpler infra, no bidirectional needs in v1.
12. **Run-now uses sample data (~1,000 rows), not full data.** Full runs happen from saved workflow page, not from inside Ask IRA.
13. **Action bar `Export / Dashboard / Reports` are stubs in v1.** Only `Save as workflow` is fully wired. Others show toasts (`coming soon`) on click.
14. **No keyboard shortcuts beyond standard.** `Cmd+Enter` to send; `Cmd+K` opens existing global search. No IRA-specific shortcuts.
15. **Toast positions follow existing app convention.** Bottom-right for success/info; top-center for persistent errors.

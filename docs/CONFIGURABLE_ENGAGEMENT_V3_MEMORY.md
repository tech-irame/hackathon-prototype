# Configurable Engagement V3 Memory

> Source of truth for the Configurable Engagement V3 redesign. Read before every prompt. Update after every decision.

---

## 1. Purpose

Configurable Engagement V3 redesigns Irame engagement from a fixed RACM/control-testing flow into a pattern-driven execution platform.

The platform must support:
- Compliance Control Testing
- Internal Audit Assignment
- Workflow Automation Project

The goal is full-fledged but controlled. We are not designing only for MVP, and we are not building an unlimited free-form project builder.

---

## 2. Core Product Principle

Engagement is the internal execution container.

Pattern type decides:
- user-facing label
- required scope objects
- setup fields
- workspace tabs
- execution flow
- review rules
- output type
- closure rules

Core model:

```
Engagement
→ pattern_type
→ pattern-specific config
→ pattern-specific workspace
→ pattern-specific outputs
```

---

## 3. Internal Object and User-Facing Labels

Internal object:
**Engagement**

User-facing labels:
- `compliance_control_testing` → **Engagement**
- `internal_audit_assignment` → **Audit Assignment**
- `workflow_automation_project` → **Project**

Do not create three disconnected systems.

---

## 4. Locked Engagement Patterns

### Pattern 1: Compliance Control Testing

Use for:
- SOX
- IFC
- ICOFR
- SOC 1
- SOC 2
- GDPR
- framework/control-driven testing

Core flow:
```
Create Engagement
→ Select Compliance Control Testing pattern
→ Select framework and audit type
→ Define scope
→ Choose control scope source
→ Create engagement snapshot
→ Configure testing input method
→ Requests / PBC
→ Upload samples/evidence/data
→ Execute testing
→ Attribute testing
→ Working paper
→ Review
→ Conclusion
→ Engagement summary
```

Control scope source options:
- RACM Version
- Selected Controls
- Imported Controls
- Manual Controls

Rules:
- SOX / IFC / ICOFR require RACM.
- Non-SOX compliance can use selected/imported/manual controls.
- Imported controls enter Control Library and are filterable by engagement/import source.
- Every control requires at least one attribute before testing.
- Reviewer approval is mandatory for compliance engagement.
- Working paper is mandatory.
- Conclusion values:
  - Effective
  - Partially Effective
  - Ineffective
  - Not Applicable

Testing input method options:
- Upload Selected Samples
- Generate Samples from Population
- Test Full Population
- Document-Based Testing
- No Sample-Based Testing

Important:
Engagement-level testing method is default. Control-level override should be allowed.

Do not use "Evidence Only" as UI label.
Use "Document-Based Testing" or "Upload Evidence as Test Items".

---

### Pattern 2: Internal Audit Assignment

Use for:
- process audits
- plant audits
- SOP reviews
- sub-process audits
- activity reviews
- vendor-specific audits
- internal audit assignments

Core flow:
```
Create Assignment
→ Define Scope
→ Announcement
→ Optional IDR
→ Analysis
→ Observations
→ Discussion / Management Response
→ Working Paper
→ Final Report
→ Action Plan
→ Closure
→ Optional linked follow-up assignment
```

Rules:
- RACM is optional.
- SOP should be selectable as a scope source.
- IDR is recommended but not mandatory.
- Observation/Finding section is mandatory, but finding count can be zero.
- Workflow/Q&A execution belongs mainly in Analysis.
- Working Paper is mandatory.
- Final Report is mandatory before closure.
- Action tracking stays in same engagement.
- Formal follow-up audit can be a linked engagement/assignment if needed.

Scope sources:
- Business Process
- Sub-process
- Activity
- SOP
- RACM
- Checklist
- Selected Workflows
- Custom Scope

Internal Audit workspace tabs:
- Overview
- Scope
- Announcement
- Requests / IDR
- Analysis
- Observations
- Discussion
- Working Paper
- Final Report
- Action Plan

---

### Pattern 3: Workflow Automation Project

Use for:
- expense validation
- passenger claim reconciliation
- FOP reconciliation
- vendor reconciliation
- MIS reporting
- speech audit review
- image analytics
- forensic image analytics
- any Irame automation project not necessarily tied to RACM/control testing

Core flow:
```
Create Project
→ Define scope
→ Select input data type
→ Choose automation setup mode
→ Upload/connect input data
→ Run Q&A/workflow/automation
→ Review output
→ Create cases for exceptions
→ Generate output report
→ Optional review/approval
→ Optional schedule
→ Complete or keep active
```

Rules:
- RACM is not required.
- Controls are not required.
- Workflow is not mandatory at creation.
- Workflow/Q&A/ad-hoc analysis is required before execution.
- Saved workflow is required for repeatable/scheduled automation.
- Q&A without saved workflow is allowed.
- Input types must support Excel/CSV, PDF, SQL, Image, Hybrid.
- Review/approval is configurable.
- Output report is required.
- Working paper is optional unless audit-sensitive.
- Exceptions should become cases.
- Integrate with existing Case Management; do not create duplicate case system.
- RACM/control linkage is optional reference only.
- Frequency/schedule is supported for recurring runs.

Automation setup modes:
- Select Existing Workflow
- Create New Workflow
- Use Q&A / Ad-hoc Analysis
- Upload Data First, Decide Later

Output types:
- Report
- Email
- Dashboard
- Case Management
- Downloadable File

Automation workspace tabs:
- Overview
- Input Data
- Automation Setup
- Runs
- Output Review
- Cases
- Reports
- Schedule
- Review (only if review is enabled)

---

## 5. Common Engagement Fields

Fields common across all patterns:
- id
- name
- pattern_type
- display_label
- description / objective
- owner_user_id
- reviewer_user_id
- business_process_id
- entity / location
- status
- stage
- planned_start_date
- planned_end_date
- actual_start_date
- actual_end_date
- created_at
- updated_at

Do not put every pattern-specific field directly on main Engagement.

Use pattern-specific config.

---

## 6. Pattern-Specific Config

Use an engagement_config / pattern config object.

### ComplianceConfig
- framework
- audit_type
- audit_period_start
- audit_period_end
- control_scope_source
- racm_version_id
- selected_control_ids
- import_batch_id
- default_testing_input_method
- allow_control_level_override
- reviewer_required

### InternalAuditConfig
- audit_period_start
- audit_period_end
- scope_level
- business_process_id
- sub_process_id
- sop_ids
- racm_version_id
- checklist_id
- process_owner
- idr_enabled
- announcement_required
- final_report_required
- action_tracking_enabled

### AutomationProjectConfig
- input_type
- automation_setup_mode
- workflow_ids
- output_types
- report_required
- review_required
- case_creation_enabled
- run_type
- frequency
- racm_reference_id
- control_reference_ids

---

## 7. Common Request Layer

Use one internal object:
**Engagement_Request**

User-facing labels change by pattern:
- Compliance → PBC / Evidence Requests
- Internal Audit → IDR
- Automation Project → Input Data Requests

Purpose:
Track what was requested, from whom, when, due date, received files, comments, and status.

Compliance also needs request management. Do not assume IDR only belongs to Internal Audit.

---

## 8. Status Model

Use:
- main status
- pattern-specific stage

Common high-level statuses:
- Draft
- Planned
- Active
- In Progress
- Pending Review
- Completed
- Closed
- On Hold

Compliance stages:
- Scope Configured
- Controls Ready
- Evidence Pending
- Testing In Progress
- Working Paper Ready
- Pending Review
- Concluded

Internal Audit stages:
- Announced
- IDR Pending
- Analysis In Progress
- Draft Issues
- In Discussion
- Final Report Issued
- Action Tracking
- Closed

Automation Project stages:
- Data Pending
- Workflow Not Configured
- Ready to Run
- Running
- Output Generated
- Cases Open
- Scheduled
- Completed
- Failed

---

## 9. Validation Rules

### Common
- name required
- owner required
- pattern_type required
- description/objective required
- required outputs must be complete before closure
- if review required, reviewer must be assigned

### Compliance
- SOX / IFC / ICOFR requires RACM
- every control must have attributes before testing
- reviewer approval required
- working paper required
- conclusion cannot happen before reviewer approval
- imported controls enter Control Library
- testing input method selected at engagement level as default
- control-level override allowed

### Internal Audit
- scope required
- announcement required
- IDR optional
- observations section required
- final report required before closure
- action plan required if observations exist

### Automation Project
- input type required
- automation setup mode required
- workflow not required at creation
- workflow/Q&A required before run
- output report required
- review configurable
- cases created only if exceptions exist or case creation enabled

---

## 10. Working Paper / Output Rules

**Compliance:**
- Control-level working paper mandatory
- Must show sample-level and attribute-level testing
- Attribute legend A/B/C allowed
- Evidence coverage matrix should avoid long repeated evidence lists
- Reviewer approval gates conclusion

**Internal Audit:**
- Working paper mandatory
- Focuses on scope, procedures, analysis, evidence, observations, reviewer comments, report references

**Automation Project:**
- Output report mandatory
- Working paper optional
- Report should show scope, input sources, workflow/Q&A used, run summary, exceptions, cases, output files, review if enabled

---

## 11. Case Management Integration

Do not build duplicate case management.

For Automation Project:
Workflow exception → create linked case in existing Case Management.

Minimum linking data:
- source_project_id
- source_run_id
- exception_id
- case_title
- case_description
- severity
- owner
- due_date
- output_reference

Project should show linked cases.

---

## 12. Implementation Strategy

Build in same repo, not separate repo.

Use new isolated folder:
```
src/components/engagement-configurable/
```

Do not modify old V2 until V3 shell is stable.

Recommended files later:
- configurableEngagementTypes.ts
- engagementPatterns.ts
- mockConfigurableEngagementData.ts
- configurableEngagementState.ts
- ConfigurableEngagementWizard.tsx
- ConfigurableEngagementWorkspace.tsx
- PatternWorkspaceRenderer.tsx
- README.md

Use feature flag or hidden route later.

---

## 13. What Not To Do

- Do not create separate repos.
- Do not create three disconnected modules.
- Do not force all patterns into compliance control testing flow.
- Do not force RACM for all engagements.
- Do not force controls for automation projects.
- Do not force existing workflow selection at project creation.
- Do not call Document-Based Testing "Evidence Only".
- Do not duplicate case management.
- Do not show all workspace tabs for all patterns.
- Do not delete old Execution V2.
- Do not route current Process Hub to V3 until explicitly instructed.

---

## 14. Open Questions

Track future unresolved decisions here.

Initial open questions:
- [ ] Should SOX and IFC both strictly require RACM, or should admin override exist?
- [ ] Should imported controls require approval before becoming active in Control Library?
- [ ] How should Partially Effective be derived or reviewer-selected?
- [ ] Which existing Case Management API/component should Automation Project integrate with?
- [ ] Should Audit Committee Deck be in controlled advanced or later release?
- [ ] Should frequency/schedule use existing workflow scheduling infrastructure?

---

## 15. Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Created Configurable Engagement V3 memory. Locked three engagement patterns: Compliance Control Testing, Internal Audit Assignment, Workflow Automation Project. Confirmed pattern-driven approach with one internal Engagement object and pattern-specific config/workspace/output. |
| 2026-05-12 | Created isolated module skeleton under src/components/engagement-configurable/. Added type definitions (configurableEngagementTypes.ts) for common engagement, pattern configs, all enums. Added pattern metadata definitions (engagementPatterns.ts) with workspace tabs and required outputs. Added mock placeholder data (3 engagements). Added lightweight state/validation helpers (configurableEngagementState.ts). No UI or routing implemented yet. |
| 2026-05-12 | Created ConfigurableEngagementWizard shell (4 steps): PatternSelectionStep (3 pattern cards with workspace tab previews), CommonDetailsStep (name/owner/reviewer/dates form), PatternConfigStep (Compliance: framework/scope/testing method, IA: scope/IDR/announcement, Automation: input/mode/outputs/schedule), ReviewCreateStep (summary + validation + local draft creation). Wizard is isolated and not wired to app routing yet. |
| 2026-05-12 | Wired wizard to dev-only preview route: view key `dev-configurable-engagement-v3`. Added to View type in useAppState.ts and App.tsx switch. Not in sidebar. Existing app flow unchanged. Access via console: call setView('dev-configurable-engagement-v3'). |
| 2026-05-13 | QA tested V3 Wizard. Bug fixed: dev route was inaccessible — added URL param support (`?view=dev-configurable-engagement-v3`) to `getInitialView()`. Code review confirmed: all 3 patterns render correctly, validation logic works, RACM warning triggers for SOX/IFC/ICOFR without RACM source, frequency conditional on recurring, report output locked, local draft creation works. No production flow changed. |
| 2026-05-13 | Created Configurable Engagement Workspace shell. WorkspaceHeader shows pattern icon/label/status/metadata. WorkspaceTabs renders pattern-specific tabs (Review hidden for automation when not required). WorkspaceOverview shows objective, config summary, readiness checklist, flow preview, required outputs. PatternPlaceholderTab shows contextual descriptions for all unbuilt tabs. PatternWorkspaceRenderer routes active tab. Wizard transitions to workspace on Create with info banner. All dev-only, not persisted. |
| 2026-05-13 | QA tested Wizard → Workspace shell flow. Code review verified: all 3 patterns create correctly and transition to workspace; Compliance shows 9 tabs with RACM warning validation; IA shows 10 tabs with IDR/announcement/final report checks; Automation shows 8 tabs (Review hidden when not required, 9 when required); readiness checklist correct per pattern; placeholder tabs have contextual descriptions; back-to-wizard preserves form state; Edit Setup button correctly hidden (no handler wired). Build passes. No bugs found, no production flow changed. |
| 2026-05-13 | Implemented Compliance Control Scope tab. Mock controls (C001-C004) with attributes, workflows, readiness. Scope source card shows RACM/Selected/Imported/Manual context. Control table with expandable detail showing attributes (A/B/C with assertion + workflow mapping), linked workflows (with coverage), and readiness checklist. RACM warning for SOX/IFC/ICOFR without RACM source. Stats bar: total/key/ready/needs setup/attributes/workflows. No testing actions added. |
| 2026-05-13 | QA tested Compliance Control Scope tab. Code review verified: stats correct (4 total, 4 key, 3 ready, 1 needs setup, 11 attrs, 7 workflows). RACM warning triggers for SOX+non-RACM source. C004 shows Needs Review with empty workflows handled gracefully. Scope source cards render for all 4 sources. Expandable detail shows attributes with mapping status, workflows with coverage, readiness checklist. No testing actions present. IA/Automation workspaces unaffected. Build passes. No bugs found, no production flow changed. |
| 2026-05-13 | Implemented Compliance Requests / PBC tab. 5 mock PBC requests with status/type/priority/linked control/attributes. Summary cards (total/pending/partial/received/overdue/draft). Status + type filters + search. Expandable request details with description, timeline, files, comments, overdue warning. Create PBC Request form (local state). Status actions: Mark Sent, Mark Received, Complete, Remind. Compliance uses "PBC / Evidence Requests" label. No evidence ingestion/testing wired yet. |
| 2026-05-13 | Lifted PBC request state to ConfigurableEngagementWorkspace level. Requests, create, and status updates now persist across tab switches. ComplianceWorkspaceState type defined in complianceRequestsData.ts. Tab component receives requests + callbacks as props. Prepared state shape for future Samples & Evidence integration. No backend persistence. |
| 2026-05-13 | Implemented Compliance Samples & Evidence tab. Input method-specific panels for all 5 methods (Upload Samples, Generate from Population, Full Population, Document-Based, No Sample-Based). Mock test item creation. Evidence repository with attach form (file name, type, control, attributes, source). PBC received-files handoff. Readiness checklist with Go to Attribute Testing CTA. State lifted to workspace level (batches + evidence persist across tabs). No attribute testing implemented yet. |
| 2026-05-13 | Fixed Samples & Evidence derived readiness logic. Added helpers: getControlAttributes, deriveTestItemEvidenceStatus, deriveTestItemAttributeCoverage. Evidence form now shows real attribute checkboxes per selected control + test item checkboxes. Test item table uses derived evidence status and attribute coverage. PBC handoff maps "All attributes" or specific A/B/C codes to real attribute IDs and links test items. Summary cards show readyItems count. Readiness checklist uses derived values. |
| 2026-05-13 | Implemented Compliance Attribute Testing tab. Sample × attribute matrix grouped by control with A/B/C columns. Clickable result cells open detail panel with evidence, notes, Pass/Fail/NA/Reset actions. Run Automated Checks simulates deterministic pass/fail for automated attributes (INV-1003 fails B/C). Bulk Mark Pending Manual → Pass. Derived sample results (PASS/FAIL/PENDING). Testing summary (7 KPIs). Testing status readiness panel. Failed attribute remark warning. State lifted to workspace level. No Working Paper/Review/Conclusion yet. |
| 2026-05-13 | QA tested Attribute Testing tab. Bug fixed: detail panel notes didn't sync when switching between cells (added key prop to force remount). Verified: locked state without samples, result initialization without duplication, automated checks, manual pass/fail/NA, bulk action safety, control filter, state persistence across tabs, sample result derivation. Build passes. No production flow changed. |
| 2026-05-13 | Implemented Compliance Working Paper tab. 11-section read-only audit document: WP header, control objective, test design, attribute legend (A/B/C codes), sample data summary, evidence coverage matrix (user/PBC vs system evidence separated), attribute testing matrix, expandable sample-level testing details, PBC request trace, review placeholder (Not Submitted), conclusion locked. Control selector for per-control working paper. Download Draft placeholder. Uses existing workspace state — no separate mock data. |
| 2026-05-13 | QA tested Compliance Working Paper tab. Code review verified: empty state without samples (clean message), control selector defaults safely (first control with test items), evidence counts correctly separated (user/PBC vs system), attribute testing matrix uses actual results, sample result derivation correct, PBC request trace matches linkedControlId safely, Review/Conclusion remain placeholders. Build passes. No bugs found, no production flow changed. |
| 2026-05-13 | Implemented Compliance Review tab. Control-level review: NOT_SUBMITTED → PENDING_REVIEW → APPROVED/REJECTED → resubmit. Readiness checklist gates submit (samples, testing complete, reviewer assigned). Testing package summary with View Working Paper CTA. Reviewer action panel (approve/reject with required comments for rejection). Review history timeline. Approved state shows Go to Conclusion CTA. Rejected state shows fix + resubmit flow. State lifted to workspace. No conclusion generation yet. |
| 2026-05-13 | Implemented Compliance Conclusion tab. Locked before approval. Derives recommended conclusion (Effective/Partially Effective/Ineffective/Not Applicable) from sample results with 20% fail threshold for partial. Failed attributes table. Finalize conclusion with selector + required remarks when differing from recommendation. Update conclusion with history. Conclusion state lifted to workspace. Summary cards show recommended vs final. Engagement summary not implemented yet. |
| 2026-05-13 | End-to-end QA for full Compliance Control Testing flow. Bug fixed: Conclusion tab ReadyToFinalizeView and FinalizedView didn't remount when switching controls (added key={selectedControlId} to prevent stale useState). Verified all 9 tabs: Control Scope, Requests/PBC, Samples & Evidence, Attribute Testing, Working Paper, Review, Conclusion work end-to-end. State persists across all tab switches. Review gates conclusion. Conclusion locked before approval. Build passes. No production flow changed. |
| 2026-05-13 | Implemented Compliance Summary tab. Engagement-level KPI rollup (scope/testing + review/conclusion). Testing progress with progress bar. Control rollup table (readiness, items, testing, failed, review, conclusion, next action). Exception/failed attribute table. Conclusion rollup with Effective/Partial/Ineffective/NA/Pending counts and engagement interpretation. Export Summary Report placeholder. All 9 compliance tabs now have real content. |
| 2026-05-13 | QA tested Compliance Summary tab. Verified: empty state (no testing data) shows correct pending counts, KPIs accurate after samples/testing/review/conclusion, control rollup table correct for all states, exceptions table shows failed attrs, conclusion rollup groups correctly, interpretation logic handles all combinations (all finalized, has ineffective, pending), export placeholder works. Build passes. No bugs found. Full Compliance Control Testing pattern is stable. |
| 2026-05-13 | Implemented Internal Audit Assignment Scope tab. Scope level selector (Process/Sub-process/Activity/Specific Element/Custom). Business process/sub-process/activity multi-select from mock data hierarchy. Scope sources: SOP/RACM/Checklist/Workflow multi-select (all optional, SOP recommended). Scope narrative (objective/in-scope/out-of-scope). Live preview card. Readiness checklist. Continue to Announcement CTA. State lifted to workspace (InternalAuditWorkspaceState). No other IA tabs implemented yet. |
| 2026-05-13 | QA tested IA Scope tab. 2 bugs fixed: (1) BP change called update() 3 times in one handler — only last won, losing BP change. Fixed with single onUpdateScope({...scope, bp, subProcessIds:[], activityIds:[]}). (2) Readiness hardcoded audit period and process owner to true — fixed to check actual config values. Verified: scope level switching, BP→sub-process→activity cascade, scope sources, narrative, preview, readiness, state persistence. Compliance pattern stable. Build passes. |
| 2026-05-13 | Implemented IA Announcement tab. Auto-generates draft from scope/engagement data. Editable recipients/CC/timeline/subject/body. Live preview card with professional letter format. Refresh from Scope button. Mark as Sent (gated on recipients+subject+body+scope readiness). Mark Acknowledged after sent. History timeline. Continue to Requests/IDR CTA after acknowledged. State lifted to workspace (InternalAuditAnnouncementState). No real email sending. |
| 2026-05-13 | QA tested IA Announcement tab. Verified: draft initialization from scope (runs once via initialized flag), editable fields with live preview, Refresh from Scope updates correctly, send gating (disabled when missing fields or scope Draft), sent state disables form, acknowledged state shows Continue CTA, history records all actions, state persists across tabs. Build passes. No bugs found. Compliance pattern stable. |
| 2026-05-13 | Implemented IA Requests / IDR tab. 5 mock IDR requests with scope linkage. Summary cards, status/type filters, search. Request table with expandable details (description, scope, files, comments, overdue warning). Create IDR Request form. Status actions (Send/Received/Complete/Remind). Add Received File inline. Proceed without IDR option. Continue to Analysis CTA. State lifted to workspace (InternalAuditRequestState). No real email/file upload. |
| 2026-05-13 | QA tested IA Requests / IDR tab. Verified: summary counts correct, status/type/search filters work, expandable details safe (overdue warning shows), create request works and persists, status transitions correct (DRAFT→SENT, PENDING→RECEIVED, PARTIAL→RECEIVED), add file transitions PENDING→PARTIAL, proceed-without-IDR enables CTA, Continue to Analysis navigates to placeholder, state persists across tabs. Build passes. No bugs found. Scope/Announcement/Compliance stable. |
| 2026-05-13 | Implemented IA Analysis tab. 4 analysis modes (Workflow/Q&A/Document Review/Data Review). Uses received IDR files as inputs. Create Analysis Run form with mode/files/workflow/question. Mock run simulation generates deterministic exceptions. Exception actions (Review/Dismiss/→Observation). Potential observations created from exceptions. Summary cards (6 KPIs). Available inputs from IDR. Runs table with expandable output. Continue to Observations CTA. State lifted to workspace. No real AI/workflow execution. |
| 2026-05-13 | QA tested IA Analysis tab. Verified: locked state without IDR inputs, received files appear as chips, proceed-without-IDR path works, all 4 modes create runs correctly, mock simulation generates appropriate exceptions, exception actions (Review/Dismiss/Convert) update state, potential observations created with correct linkage, summary counts update, state persists across tabs. Build passes. No bugs found. All prior IA tabs and Compliance stable. |
| 2026-05-13 | Implemented IA Observations tab. Convert potential observations from Analysis to formal observations. Create manual observations. Edit panel with severity/risk/root cause/impact/recommendation/owner/target date. Mark Ready for Discussion (validates required fields). Drop/Reopen. No-observations-confirmed flow. Discussion readiness checklist. Dismissed potential obs tracked. Summary cards (6 KPIs). State lifted to workspace (InternalAuditObservationsState). |
| 2026-05-13 | QA tested IA Observations tab. Verified: empty state without analysis (manual create available), potential obs convert/dismiss, formal obs table, edit panel key isolation, Mark Ready validation (silently blocks from table, shows in edit panel), Drop/Reopen status transitions, No Obs Confirmed (resets on create, re-available after all dropped), discussion readiness logic, state persistence. Build passes. No bugs found. All prior IA tabs and Compliance stable. |

---

## 16. Implementation Protocol

Before every future implementation step:
1. Read `docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md`
2. Identify exact scope of current prompt
3. List files you plan to modify
4. Modify only those files
5. Do not implement future stages unless explicitly requested
6. Do not infer extra functionality from context
7. Keep existing modules working
8. Keep app compiling
9. Update memory file if product decisions or implementation details change
10. End response with:
    - Files changed
    - What was implemented
    - What was intentionally not implemented
    - Risks / open questions
    - Next recommended prompt

**CRITICAL RULE: Context is not scope.**

#!/usr/bin/env bash
# Claude preflight review — runs before `git push` (or via `npm run review:local`).
# Hackathon prototype: gentle on tech, brutal on design/UX/redundancy conflicts.
#
# Behaviour:
#   1. Auto-rebase: if pushing main and the remote has new commits, fetch and
#      `git pull --rebase --autostash` first. Stops on conflict so you can
#      resolve manually.
#   2. Multi-page hard-review gate: if the push touches more than one page
#      (i.e. more than one sidebar destination), BLOCK until the author
#      supplies a one-line reason via an interactive prompt OR the
#      MULTI_PAGE_OK env var. Multi-page pushes also trigger a stricter
#      Claude rubric in step 3.
#   3. Claude review: focused on design / feature redundancy / UX gaps.
#      Advisory only for single-page pushes. For multi-page pushes, uses
#      a stricter rubric that forces per-page dropped-feature analysis and
#      a cross-page conflict check.
#
# Skip everything with:         SKIP_PREFLIGHT=1 git push
# Bypass the multi-page gate:   MULTI_PAGE_OK="<reason>" git push
#   (reason is required; empty string does NOT bypass)

set -uo pipefail

if [[ "${SKIP_PREFLIGHT:-}" == "1" ]]; then
  echo "preflight: SKIP_PREFLIGHT=1, skipping rebase + review"
  exit 0
fi

# ── 1. Auto-rebase on main ─────────────────────────────────────────────────

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

resolve_remote() {
  local r
  r=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null | cut -d/ -f1)
  if [[ -n "$r" ]] && git remote get-url "$r" >/dev/null 2>&1; then
    printf '%s' "$r"; return
  fi
  for cand in hackathon origin; do
    if git remote get-url "$cand" >/dev/null 2>&1; then
      printf '%s' "$cand"; return
    fi
  done
}

REMOTE=$(resolve_remote)

if [[ "$CURRENT_BRANCH" == "main" && -n "$REMOTE" ]]; then
  echo "preflight: fetching ${REMOTE}/main…"
  if ! git fetch "$REMOTE" main --quiet 2>/dev/null; then
    echo "preflight: fetch failed (offline?), skipping rebase."
  else
    BEHIND=$(git rev-list --count "HEAD..${REMOTE}/main" 2>/dev/null || echo "0")
    if [[ "$BEHIND" -gt 0 ]]; then
      printf '\npreflight: local main is behind %s/main by %s commit(s) — rebasing…\n\n' "$REMOTE" "$BEHIND"
      if git pull --rebase --autostash "$REMOTE" main; then
        printf '\npreflight: rebase clean. proceeding.\n'
      else
        cat <<MSG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  preflight: REBASE CONFLICT — push aborted
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your local commits conflict with new work on ${REMOTE}/main. To resolve:

  1. git status                       # see the conflicted files
  2. <fix the conflict markers>
  3. git add <files>
  4. git rebase --continue
  5. git push                         # this hook runs again

To bail out instead: git rebase --abort
To skip this hook for one push: SKIP_PREFLIGHT=1 git push

MSG
        exit 1
      fi
    else
      echo "preflight: up-to-date with ${REMOTE}/main."
    fi
  fi
fi

# ── 2. Multi-page hard-review gate ─────────────────────────────────────────
#
# Every sidebar nav entry counts as one "page". A push that touches 2+
# pages must be explicitly acknowledged — either interactively (type
# `YES <reason>`) or via MULTI_PAGE_OK="<reason>". Shared surfaces
# (sidebar, modals, shared components, CSS, hooks, config) do NOT count
# toward the page total, but are still included in the Claude review.

if [[ -n "$REMOTE" ]] && git rev-parse --verify "${REMOTE}/main" >/dev/null 2>&1; then
  BASE="${REMOTE}/main"
elif git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE="origin/main"
else
  BASE="HEAD~1"
fi

CHANGED=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || true)
NEW=$(git diff --name-only --diff-filter=A "$BASE"...HEAD 2>/dev/null || true)

if [[ -z "$CHANGED" ]]; then
  echo "preflight: no changes vs $BASE, skipping review"
  exit 0
fi

CHANGED_COUNT=$(printf '%s\n' "$CHANGED" | wc -l | tr -d ' ')

# Map a file path to a sidebar-level page name. Emits nothing for shared
# or non-page files (they're reviewed, but not counted as pages).
page_for() {
  case "$1" in
    src/components/chat/*)                       echo "Ask IRA" ;;
    src/components/home/*)                       echo "Home" ;;
    src/components/recents/*)                    echo "Recents" ;;
    src/components/audit/AuditPlanning*)         echo "Planning" ;;
    src/components/audit/AuditExecution*)        echo "Planning" ;;
    src/components/audit/BusinessProcesses*)     echo "Process Hub" ;;
    src/components/audit/RiskRegister*)          echo "Risk Register" ;;
    src/components/governance/*)                 echo "Control Library" ;;
    src/components/execution/*)                  echo "Control Library" ;;
    src/components/dashboard/*)                  echo "Dashboard" ;;
    src/components/reports/*)                    echo "Report" ;;
    src/components/workflow/*)                   echo "Workflow Library" ;;
    src/components/intelligence/*)               echo "AI Concierge" ;;
    src/components/concierge-workflow-builder/*) echo "AI Concierge" ;;
    src/components/knowledge/*)                  echo "Knowledge Hub" ;;
    src/components/data-sources/*)               echo "Knowledge Hub" ;;
    src/components/admin/*)                      echo "Admin" ;;
  esac
}

PAGE_FILE_ROWS=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  page=$(page_for "$f")
  [[ -z "$page" ]] && continue
  PAGE_FILE_ROWS+="${page}	${f}
"
done <<< "$CHANGED"

AFFECTED_PAGES=$(printf '%s' "$PAGE_FILE_ROWS" | awk -F'\t' 'NF>=2{print $1}' | sort -u)
NUM_PAGES=$(printf '%s' "$AFFECTED_PAGES" | grep -c . 2>/dev/null || true)
NUM_PAGES=${NUM_PAGES:-0}

STRICT_REVIEW=0
MULTI_PAGE_REASON=""

if (( NUM_PAGES > 1 )); then
  printf '\n'
  printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  printf '  ⚠  MULTI-PAGE PUSH — hard review required (%s pages)\n' "$NUM_PAGES"
  printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'
  while IFS= read -r page; do
    [[ -z "$page" ]] && continue
    printf '  • %s\n' "$page"
    printf '%s' "$PAGE_FILE_ROWS" | awk -F'\t' -v p="$page" '$1==p{print "      " $2}'
  done <<< "$AFFECTED_PAGES"
  printf '\n'

  if [[ -n "${MULTI_PAGE_OK:-}" ]]; then
    MULTI_PAGE_REASON="$MULTI_PAGE_OK"
    printf 'preflight: MULTI_PAGE_OK set — reason:\n  %s\n\n' "$MULTI_PAGE_REASON"
  else
    # Verify we can actually *read* from /dev/tty — [[ -r ]] lies on macOS
    # when there's no controlling terminal (git push piping stdin, ssh
    # without -t, etc.). Try a non-destructive open instead.
    if ! { : < /dev/tty; } 2>/dev/null; then
      cat <<MSG
preflight: MULTI-PAGE PUSH BLOCKED — no interactive terminal.

Re-run from an interactive shell, or set a non-empty reason:

  MULTI_PAGE_OK="<one-line reason>" git push

MSG
      exit 1
    fi

    cat <<'MSG'
This push touches 2+ pages — exactly the kind of change that silently
breaks another pod's work (dropped columns, moved tabs, restyled shared
components, etc.).

To continue, type:   YES <one-line reason>
  e.g.   YES global typography sweep — coordinated with design
         YES migrating audit/ tokens per Editorial spec

Anything else aborts the push.
To bypass in scripts: MULTI_PAGE_OK="<reason>" git push

MSG
    INPUT=""
    if ! IFS= read -r -p "Proceed? " INPUT < /dev/tty; then
      printf '\npreflight: could not read from terminal — aborting.\n\n'
      exit 1
    fi

    if [[ "$INPUT" =~ ^YES[[:space:]]+(.+)$ ]]; then
      MULTI_PAGE_REASON="${BASH_REMATCH[1]}"
      # Trim surrounding whitespace
      MULTI_PAGE_REASON="${MULTI_PAGE_REASON#"${MULTI_PAGE_REASON%%[![:space:]]*}"}"
      MULTI_PAGE_REASON="${MULTI_PAGE_REASON%"${MULTI_PAGE_REASON##*[![:space:]]}"}"
      if [[ -z "$MULTI_PAGE_REASON" ]]; then
        printf '\npreflight: no reason supplied after YES — aborting.\n\n'
        exit 1
      fi
      printf '\npreflight: multi-page reason accepted — "%s"\n\n' "$MULTI_PAGE_REASON"
    else
      printf '\npreflight: multi-page push aborted (no "YES <reason>" supplied).\n\n'
      exit 1
    fi
  fi

  STRICT_REVIEW=1
fi

# ── 3. Claude design / redundancy / UX review ──────────────────────────────

if ! command -v claude &> /dev/null; then
  echo "preflight: claude CLI not found — install with 'npm install -g @anthropic-ai/claude-code', then re-run."
  echo "preflight: skipping review (push proceeding)."
  exit 0
fi

printf '\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
if (( STRICT_REVIEW == 1 )); then
  printf '  Claude preflight review · STRICT (multi-page) · %s file(s) vs %s\n' "$CHANGED_COUNT" "$BASE"
else
  printf '  Claude preflight review · %s file(s) vs %s\n' "$CHANGED_COUNT" "$BASE"
fi
printf '  (set SKIP_PREFLIGHT=1 to skip · ~30-60s)\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

# Pipe prompt to claude via stdin so apostrophes/quotes inside the body are
# pure heredoc content (not re-parsed by bash via $(...) substitution).

if (( STRICT_REVIEW == 1 )); then
  claude -p <<EOF || echo "preflight: claude exited non-zero (advisory only — push will proceed)"
You are reviewing a HACKATHON PROTOTYPE push that touches MULTIPLE PAGES.
This is the kind of push that most often silently breaks another pod's work,
so your rubric is STRICTER than the default preflight.

Pods pushing here: multiple teams all push directly to main, each owning
different pages. A single push that touches 2+ pages needs explicit
cross-page justification.

The author has confirmed this is intentional with the reason:
  "${MULTI_PAGE_REASON}"

Your job is to stress-test that reason against the actual diff. Be brutally
specific — cite file:line on every finding. Do NOT raise perf / type-nits /
tests / accessibility / security / refactor opportunities (same exclusions
as the default preflight).

Instead, produce this structure exactly:

## Affected pages
${AFFECTED_PAGES}

## Per-page changes (user-visible only)
For EACH page above, answer:
  • Added: what new user-visible features / UI / behaviors appear
  • Modified: what changed for an existing user journey
  • Dropped: what disappeared (buttons, columns, tabs, sections, CTAs,
    copy, decorative elements) — even if the code was "cleanup"
Never mention code-level detail (class names, token names, LOC counts).
Only what a PM walking the app would notice.

## Cross-page conflicts
Call out anything like:
  • Same pattern used differently on two affected pages (e.g. page A
    gets flat cards, page B gets glassmorphism in the same push)
  • A feature moved from page A to page B without a redirect or mention
  • Global CSS / shared component change that unintentionally restyles
    a page NOT covered by the stated reason
  • A dropped element on one page that another page still links to
  • Two pages' mock data shapes diverging for the same entity

## Intent check
Given the author's reason "${MULTI_PAGE_REASON}", judge each affected page:
  • ✓ Clearly motivated by the stated reason
  • ⚠  Looks like collateral damage — file got touched but does not match
     the stated reason. Name the page and say what was incidentally changed.
  • 🚨 Contradicts the stated reason outright. Name it.

## Verdict
Exactly one of:
  ✅ Coordinated — push looks intentional on every affected page
  ⚠  Mixed — proceed but fix the called-out issues in a follow-up
  🚨 HARD STOP RECOMMENDED — at least one page is being changed
     incidentally and will regress another pod's work

End with a one-line recommendation to the author.

Use Read and Grep on src/ to ground every finding in the actual code.

Files changed in this push (vs ${BASE}):
${CHANGED}

New files added:
${NEW:-(none)}
EOF
else
  claude -p <<EOF || echo "preflight: claude exited non-zero (advisory only — push will proceed)"
You are reviewing a HACKATHON PROTOTYPE where multiple pods (teams) push directly to main.
This is a THROWAWAY DEMO. Your bias must match that.

DO NOT raise (be gentle / silent on these):
- Performance, scaling, bundle size, memoization
- Test coverage or missing tests
- Type safety nits, "any" usage, error handling, defensive coding
- Code style, naming, refactor opportunities, file organization
- Accessibility (unless something is genuinely broken to operate)
- Security (mocked-data app, no real secrets, no backend)

DO raise — BRUTALLY and SPECIFICALLY (these cause team friction):

1. **Design conflicts** — new visual choices that contradict what already exists in src/.
   Different colors, typography scales, spacing, component shapes, or card patterns
   from the established bento / charcoal / purple-accent system. Cite the existing
   reference (file:line) AND the diverging new code (file:line).

2. **Feature redundancy** — this push builds something that already exists in src/.
   Two views doing the same job, two ways to navigate to the same place, parallel
   mock data shapes for the same entity, duplicated component logic. Name both
   the existing thing and the new duplicate.

3. **UX / flow gaps** — user can enter a state but cannot exit it cleanly,
   navigation contradicts the existing pattern, a CTA leads nowhere, two screens
   share a name but mean different things, back navigation is broken, modal traps,
   inconsistent empty/loading states across sibling views.

Use Read and Grep on src/ to inspect the existing codebase before judging.
Cite file:line on both sides of every conflict. Be terse — bullet points only,
no preamble, no summary, no closing remarks.

If nothing material conflicts on these three axes, output exactly this single line:
✅ No design / redundancy / UX conflicts detected.

Files changed in this push (vs ${BASE}):
${CHANGED}

New files added:
${NEW:-(none)}
EOF
fi

printf '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
printf '  End preflight · push proceeding\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

exit 0

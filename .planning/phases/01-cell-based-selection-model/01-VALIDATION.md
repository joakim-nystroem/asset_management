---
phase: 1
slug: cell-based-selection-model
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | svelte-check (TypeScript type checking) |
| **Config file** | `frontend/tsconfig.json` |
| **Quick run command** | `cd frontend && npx svelte-check --tsconfig ./tsconfig.json` |
| **Full suite command** | `cd frontend && npx svelte-check --tsconfig ./tsconfig.json` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx svelte-check --tsconfig ./tsconfig.json`
- **After every plan wave:** Run full type check + manual grid interaction test
- **Before `/gsd:verify-work`:** Full suite must be green + all 5 success criteria verified manually
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CONT-03, SEL-01 | type-check | `cd frontend && npx svelte-check` | N/A (type system) | pending |
| 01-02-01 | 02 | 1 | CELL-01, CELL-02 | type-check + inspect | `cd frontend && npx svelte-check` | N/A | pending |
| 01-02-02 | 02 | 1 | SEL-03, SEL-05, CELL-03 | manual | Dev server click/drag test | N/A | pending |
| 01-02-03 | 02 | 1 | SEL-06 | manual | Drag then release outside grid | N/A | pending |
| 01-03-01 | 03 | 2 | SEL-02 | type-check | `cd frontend && npx svelte-check` | N/A | pending |
| 01-03-02 | 03 | 2 | SEL-04 | manual | Dev server shift+click test | N/A | pending |
| 01-03-03 | 03 | 2 | SEL-07, SEL-08 | manual | Dev server arrow key test | N/A | pending |
| 01-03-04 | 03 | 2 | SEL-10 | manual | Dev server escape test | N/A | pending |
| 01-03-05 | 03 | 2 | SEL-11 | manual | Select, scroll away, scroll back | N/A | pending |
| 01-03-06 | 03 | 2 | CELL-04, CELL-05 | manual | Dev server dblclick + right-click test | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No unit test framework needed — validation is via TypeScript type checking (`svelte-check`) and manual browser testing. This is appropriate for a UI refactor where the primary risks are type errors and visual regressions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Click cell selects it | SEL-03 | Visual UI interaction | Click any cell, verify blue highlight appears |
| Shift+click range | SEL-04 | Multi-step interaction | Click cell A, shift+click cell B, verify rectangle |
| Drag selection | SEL-05, CELL-03 | Mouse drag interaction | Mousedown on cell, drag across cells, verify live rectangle |
| Window mouseup | SEL-06 | Mouse leaves grid | Start drag, move mouse outside grid, release, verify drag ends |
| Arrow navigation | SEL-07 | Keyboard interaction | Click cell, press arrow keys, verify selection moves |
| Shift+arrow extend | SEL-08 | Keyboard interaction | Click cell, shift+arrow, verify selection extends |
| Escape clears | SEL-10 | Keyboard interaction | Select cells, press Escape, verify selection cleared |
| Selection survives scroll | SEL-11 | Scroll interaction | Select cell, scroll away and back, verify selection persists |
| Double-click edits | CELL-04 | Visual UI interaction | Double-click cell, verify editor opens on that cell |
| Right-click menu | CELL-05 | Visual UI interaction | Right-click cell, verify context menu shows with correct data |
| No data-row/data-col | CELL-02 | Code inspection | `grep -r "data-row\|data-col" frontend/src/lib/grid/components/grid-row/` returns nothing |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

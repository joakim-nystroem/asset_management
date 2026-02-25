# Project State

## Status
- **Milestone:** 1 — Architecture Rehaul
- **Current Phase:** None started (ready to plan Phase 1)
- **Last Action:** Codebase map created, planning infrastructure initialized

## Active Work
None — ready to begin `/gsd:plan-phase 1`

## Completed
- [x] Codebase map (`.planning/codebase/` — 7 documents, 1297 lines)
- [x] PROJECT.md, REQUIREMENTS.md, ROADMAP.md created

## Key Context
- Working dir: `/home/joakim/asset_management`
- Frontend: `frontend/` (SvelteKit, run svelte-check from here)
- API: `api/` (Go WebSocket server)
- Main grid page: `frontend/src/routes/+page.svelte` (~1200 lines)
- All managers: `frontend/src/lib/utils/` (singletons today → context tomorrow)
- Grid components: `frontend/src/lib/components/grid/`

## Phase Status
| Phase | Status | Plan |
|-------|--------|------|
| 1 | pending | not planned |
| 2 | pending | not planned |
| 3 | pending | not planned |
| 4 | pending | not planned |
| 5 | pending | not planned |
| 6 | pending | not planned |
| 7 | pending | not planned |

## Notes
- `.planning` is tracked in git (removed from .gitignore)
- `svelte-check` must run from `frontend/` directory
- MariaDB datetime format: `YYYY-MM-DD HH:MM:SS` (not ISO string)
- Svelte 5 `createContext` returns `[getter, setter]` tuple (added in 5.40, installed 5.49.1)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `PROJECT.md` for architecture, tech stack, conventions, and project-specific rules.
See `AUDIT_PLAN.md` for the current audit feature implementation plan.

## Build & Verify

```bash
# Frontend type checking (run from frontend/)
cd frontend && npx svelte-check --tsconfig ./tsconfig.json
# Expect: 0 errors, 4 pre-existing a11y warnings

# Go WebSocket server
cd ws && go build ./...
```

No formal test suite. These two commands are the verification gate.

## How to Work

### Approval first

Present your plan and get explicit approval before multi-file changes, architectural decisions, or delegating to agents. "Let me do it" is not approval. When the user gives a clear design direction, implement it directly — don't suggest alternatives or add layers.

### Build pass is not correctness

Code that compiles but violates the app's architectural patterns is wrong. Before considering work done: Does the data flow match the rest of the app? Does it follow established patterns in `PROJECT.md`? Are there obvious missing pieces? Always verify the code follows app patterns, not just that it builds.

### Verify before claiming

Never say "X is already handled" without tracing every path where X could occur. If unsure, say "I think X is covered by Y, let me verify" — don't state it as fact.

### Do exactly what's asked

Execute the instruction given. Don't add extra logic, move code around, or take "helpful" additional steps. If something will obviously break, mention it after completing the task — don't block on it. There is a reason the user mentioned it and has additional steps after the task.

### Be precise, not dramatic

Don't say "that's complex" or "there are many call sites" without counting first. Present the count, let the user judge. Separate mechanical effort (how much typing) from design decisions (behavioral tradeoffs) — don't conflate them into inflated estimates.

### No unnecessary abstractions

Don't create helpers, utilities, or wrapper functions that have no current consumer. Inline logic where it's used. Three similar lines are better than a premature helper.

### Commits

Never commit unless the user explicitly says to. Never ask "ready to commit?" — the user will say when. 

### Agents and discussion

During interactive sessions where the user is reviewing and approving each step, make edits directly — don't delegate to agents. The user's inline feedback in rejection dialogs doesn't surface back to the orchestrator.

### Keep docs in sync

Architecture or convention changes → update `PROJECT.md`. Behavioral rule changes → update this file.

# Features Research: Grid Interaction Feature Landscape

**Research date:** 2026-03-05
**Domain:** Spreadsheet-like grid interaction features

## Table Stakes (must work or users notice breakage)

All currently implemented unless noted.

### Selection
| Feature | Status | Complexity |
|---------|--------|------------|
| Click to select cell | EXISTS | Low |
| Drag to select range | EXISTS | Medium |
| Shift+click range select | EXISTS | Medium |
| Arrow key navigation | EXISTS | Low |
| Shift+arrow range extend | EXISTS | Medium |
| Ctrl+arrow jump to edge | EXISTS | Low |
| Escape to clear selection | EXISTS | Low |
| Selection survives scroll | EXISTS | Medium |
| Visual selection border | EXISTS | Low |

### Cell Editing
| Feature | Status | Complexity |
|---------|--------|------------|
| Double-click to edit | EXISTS | Low |
| F2 to edit | EXISTS | Low |
| Enter to save | EXISTS | Low |
| Escape to cancel | EXISTS | Low |
| Blur to save | EXISTS | Low |
| Dropdown for constrained columns | EXISTS | Medium |
| Autocomplete for free-text | EXISTS | Medium |

### Clipboard
| Feature | Status | Complexity |
|---------|--------|------------|
| Ctrl+C copy | EXISTS | Low |
| Ctrl+V paste | EXISTS | Medium |
| Copy visual overlay | EXISTS | Low |
| Context menu copy | EXISTS | Low |

### Keyboard
| Feature | Status | Complexity |
|---------|--------|------------|
| Global keyboard capture | PARTIAL | Medium |
| Current: requires focus on GridOverlays div. Planned global handler fixes this. |

### Visual Feedback
| Feature | Status | Complexity |
|---------|--------|------------|
| Dirty cell indicators | EXISTS | Low |
| Invalid cell warnings | EXISTS | Low |
| Multi-user cursors | EXISTS | Medium |

### Column Operations
| Feature | Status | Complexity |
|---------|--------|------------|
| Column resize | EXISTS | Medium |
| Sort (A-Z, Z-A) | EXISTS | Low |
| Header menu | EXISTS | Medium |
| Column filtering | EXISTS | Medium |

### Data Operations
| Feature | Status | Complexity |
|---------|--------|------------|
| Search | EXISTS | Low |
| Active filter panel | EXISTS | Medium |
| Commit changes | EXISTS | Medium |
| Discard changes | EXISTS | Low |
| New row creation | EXISTS | Medium |
| View selector | EXISTS | Low |
| Virtual scrolling | EXISTS | High |

## Differentiators (not yet implemented, nice to have)

| Feature | Status | Complexity | Dependency |
|---------|--------|------------|------------|
| Undo/Redo (Ctrl+Z/Y) | NOT IMPL | High | HistoryContext exists but empty |
| Tab to next cell during editing | NOT IMPL | Low | Cell-based selection model |
| Enter to next row during editing | NOT IMPL | Low | Cell-based selection model |
| Delete key clears selected cells | NOT IMPL | Medium | Cell-based selection model |
| Select all (Ctrl+A) | NOT IMPL | Low | Cell-based selection model |

**Critical dependency chain:** Cell-based selection model -> Per-cell buttons -> Global keyboard handler -> Undo/Redo

## Anti-Features (deliberately NOT building in this refactor)

| Feature | Reason |
|---------|--------|
| Formula support | Not a spreadsheet — asset data is flat |
| Inline row deletion | Destructive, needs admin workflow |
| Column reorder/hide | Scope creep — UI preference, not core |
| Frozen columns | Performance complexity, not needed for current column count |
| Cell merging | Not applicable to asset data model |
| Multi-sheet/tabs | Single asset table, views handle this |
| CSV export | Separate feature, not interaction |
| Conditional formatting | Visual complexity, defer |
| Server-side pagination | Virtual scroll handles this |
| Per-cell permissions | All users see same data |
| Collaborative editing (OT/CRDT) | WebSocket cursors are sufficient for now |
| Inline images/rich content | Text-only cells |
| Row grouping | Flat data model |

---
*Research completed: 2026-03-05*

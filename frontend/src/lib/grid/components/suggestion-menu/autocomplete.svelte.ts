// src/lib/utils/ui/autocomplete.svelte.ts

export function createAutocomplete() {
  let suggestions = $state<string[]>([]);
  let selectedIndex = $state(-1);
  let isVisible = $state(false);

  function updateSuggestions(
    data: Record<string, any>[],
    columnKey: string,
    inputValue: string
  ) {
    if (!inputValue || !inputValue.trim()) {
      suggestions = [];
      selectedIndex = -1;
      isVisible = false;
      return;
    }

    // Get unique values from the column
    const uniqueValues = new Set<string>();
    for (const item of data) {
      const value = String(item[columnKey] ?? "").trim();
      if (value) {
        uniqueValues.add(value);
      }
    }

    // Filter and sort matches (case-insensitive)
    const inputLower = inputValue.toLowerCase().trim();
    const matches = Array.from(uniqueValues)
      .filter(
        (value) =>
          value.toLowerCase().includes(inputLower) &&
          value.toLowerCase() !== inputLower
      )
      .sort((a, b) => {
        // Prioritize matches that start with the input
        const aStarts = a.toLowerCase().startsWith(inputLower);
        const bStarts = b.toLowerCase().startsWith(inputLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 6); // Limit to 6 suggestions

    suggestions = matches;
    selectedIndex = -1;
    isVisible = matches.length > 0;
  }

  function selectNext() {
    if (suggestions.length === 0) return;
    selectedIndex =
      selectedIndex >= suggestions.length - 1 ? 0 : selectedIndex + 1;
  }

  function selectPrevious() {
    if (suggestions.length === 0) return;
    selectedIndex =
      selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
  }

  function getSelectedValue(): string | null {
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      return suggestions[selectedIndex];
    }
    return null;
  }

  function clear() {
    suggestions = [];
    selectedIndex = -1;
    isVisible = false;
  }

  function setSelectedIndex(index: number) {
    selectedIndex = index;
  }

  return {
    get suggestions() {
      return suggestions;
    },
    get selectedIndex() {
      return selectedIndex;
    },
    get isVisible() {
      return isVisible;
    },
    get hasSelection() {
      return selectedIndex >= 0;
    },
    updateSuggestions,
    selectNext,
    selectPrevious,
    getSelectedValue,
    clear,
    setSelectedIndex,
  };
}

export type Autocomplete = ReturnType<typeof createAutocomplete>;

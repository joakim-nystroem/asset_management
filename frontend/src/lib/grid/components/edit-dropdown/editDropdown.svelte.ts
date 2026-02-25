// src/lib/utils/ui/editDropdown/editDropdown.svelte.ts

export function createEditDropdown() {
  let options = $state<string[]>([]);
  let selectedIndex = $state(0);
  let isVisible = $state(false);

  function show(availableOptions: string[], currentValue: string) {
    options = availableOptions;
    // Find the index of the current value
    const currentIndex = options.findIndex(opt => opt === currentValue);
    selectedIndex = currentIndex >= 0 ? currentIndex : 0;
    isVisible = true;
  }

  function selectNext() {
    if (options.length === 0) return;
    selectedIndex = selectedIndex >= options.length - 1 ? 0 : selectedIndex + 1;
  }

  function selectPrevious() {
    if (options.length === 0) return;
    selectedIndex = selectedIndex <= 0 ? options.length - 1 : selectedIndex - 1;
  }

  function getSelectedValue(): string | null {
    if (selectedIndex >= 0 && selectedIndex < options.length) {
      return options[selectedIndex];
    }
    return null;
  }

  function hide() {
    isVisible = false;
    options = [];
    selectedIndex = 0;
  }

  function setSelectedIndex(index: number) {
    selectedIndex = index;
  }

  return {
    get options() {
      return options;
    },
    get selectedIndex() {
      return selectedIndex;
    },
    get isVisible() {
      return isVisible;
    },
    show,
    selectNext,
    selectPrevious,
    getSelectedValue,
    hide,
    setSelectedIndex,
  };
}

export type EditDropdown = ReturnType<typeof createEditDropdown>;

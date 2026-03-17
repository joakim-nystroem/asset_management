// src/lib/grid/components/edit-dropdown/editDropdown.svelte.ts
// Self-contained dropdown state. Derives options from assetStore + editingCtx.
// Manages selectedIndex, filtering, and Tab cycling locally.

import { assetStore } from '$lib/data/assetStore.svelte';
import { columnConstraints } from '$lib/grid/validation';

// Map column key → assetStore list
function getOptionsForColumn(col: string): string[] {
  const constraint = columnConstraints[col];
  if (!constraint || constraint.type !== 'dropdown') return [];
  return constraint.options();
}

export function createEditDropdown() {
  let allOptions = $state<string[]>([]);
  let filteredOptions = $state<string[]>([]);
  let selectedIndex = $state(0);
  let tabAnchor = $state('');

  function open(editCol: string, currentValue: string) {
    allOptions = getOptionsForColumn(editCol);
    filteredOptions = allOptions;
    tabAnchor = currentValue;
    const idx = allOptions.findIndex(opt => opt === currentValue);
    selectedIndex = idx >= 0 ? idx : 0;
  }

  function filter(text: string) {
    tabAnchor = text;
    if (!text) {
      filteredOptions = allOptions;
      selectedIndex = 0;
      return;
    }
    const lower = text.toLowerCase();
    filteredOptions = allOptions.filter(opt => opt.toLowerCase().includes(lower));
    selectedIndex = 0;
  }

  function selectNext() {
    if (filteredOptions.length === 0) return;
    selectedIndex = selectedIndex >= filteredOptions.length - 1 ? 0 : selectedIndex + 1;
  }

  function selectPrevious() {
    if (filteredOptions.length === 0) return;
    selectedIndex = selectedIndex <= 0 ? filteredOptions.length - 1 : selectedIndex - 1;
  }

  function tabNext() {
    if (allOptions.length === 0) return;
    const lower = tabAnchor.toLowerCase();
    const matches = lower ? allOptions.filter(opt => opt.toLowerCase().includes(lower)) : allOptions;
    if (matches.length === 0) return;
    // Find current position in matches
    const currentValue = filteredOptions[selectedIndex] ?? '';
    const currentMatchIdx = matches.indexOf(currentValue);
    const nextIdx = currentMatchIdx >= matches.length - 1 ? 0 : currentMatchIdx + 1;
    // Update filtered to show matches, highlight the next one
    filteredOptions = matches;
    selectedIndex = nextIdx;
  }

  function tabPrevious() {
    if (allOptions.length === 0) return;
    const lower = tabAnchor.toLowerCase();
    const matches = lower ? allOptions.filter(opt => opt.toLowerCase().includes(lower)) : allOptions;
    if (matches.length === 0) return;
    const currentValue = filteredOptions[selectedIndex] ?? '';
    const currentMatchIdx = matches.indexOf(currentValue);
    const prevIdx = currentMatchIdx <= 0 ? matches.length - 1 : currentMatchIdx - 1;
    filteredOptions = matches;
    selectedIndex = prevIdx;
  }

  function getSelectedValue(): string | null {
    if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
      return filteredOptions[selectedIndex];
    }
    return null;
  }

  function isValidOption(value: string): boolean {
    return allOptions.includes(value);
  }

  function setSelectedIndex(index: number) {
    selectedIndex = index;
  }

  return {
    get options() { return filteredOptions; },
    get selectedIndex() { return selectedIndex; },
    open,
    filter,
    selectNext,
    selectPrevious,
    tabNext,
    tabPrevious,
    getSelectedValue,
    isValidOption,
    setSelectedIndex,
  };
}

export type EditDropdown = ReturnType<typeof createEditDropdown>;

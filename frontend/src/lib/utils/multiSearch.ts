// Splits pasted search-box text on comma, tab, or newline (Excel column/row
// copy shapes), trimming and dropping empties.
export function splitPastedSearchTerms(text: string): string[] {
  return text.split(/[,\t\r\n]+/).map(t => t.trim()).filter(Boolean);
}

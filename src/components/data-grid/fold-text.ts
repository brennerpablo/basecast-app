/**
 * Search folding for free-text matching: lowercase + accents stripped.
 *
 * Real datasets are inconsistently accented — one source writes "Ñandú
 * Solar", the next writes "NANDU SOLAR", and both reach the same column. A raw
 * `includes` then finds the value on one grid and returns zero on the next,
 * with nothing on screen to explain the difference.
 *
 * It folds only what every text search should fold (case and diacritics),
 * leaving punctuation and abbreviations alone, so it is safe on any column —
 * including the ones carrying "$ 500" or a formatted identifier.
 */
export function foldText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** `haystack` contains `needle`, both folded. Empty needle matches everything. */
export function foldIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return foldText(haystack).includes(foldText(needle));
}

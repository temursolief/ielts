/**
 * IELTS Academic Reading band score conversion.
 * Configurable: loaded from DB at runtime, with this as fallback.
 * Source: Official IELTS Academic Reading band descriptors (approximate).
 */

export const ACADEMIC_READING_BAND_TABLE: Record<number, number> = {
  39: 9.0, 40: 9.0,
  37: 8.5, 38: 8.5,
  35: 8.0, 36: 8.0,
  33: 7.5, 34: 7.5,
  30: 7.0, 31: 7.0, 32: 7.0,
  27: 6.5, 28: 6.5, 29: 6.5,
  23: 6.0, 24: 6.0, 25: 6.0, 26: 6.0,
  19: 5.5, 20: 5.5, 21: 5.5, 22: 5.5,
  15: 5.0, 16: 5.0, 17: 5.0, 18: 5.0,
  13: 4.5, 14: 4.5,
  10: 4.0, 11: 4.0, 12: 4.0,
  8: 3.5, 9: 3.5,
  6: 3.0, 7: 3.0,
  4: 2.5, 5: 2.5,
  2: 2.0, 3: 2.0,
  1: 1.0,
  0: 0.0,
};

/**
 * Convert raw score to estimated IELTS band.
 * Only applicable when totalQuestions is 40 (standard Academic Reading test).
 */
export function estimateBand(
  rawScore: number,
  totalQuestions: number,
  customTable?: Record<number, number>
): number | null {
  if (totalQuestions !== 40) return null; // Band estimate only for full tests

  const table = customTable ?? ACADEMIC_READING_BAND_TABLE;

  // Find exact match, or nearest lower
  for (let s = rawScore; s >= 0; s--) {
    if (table[s] !== undefined) return table[s];
  }
  return 0.0;
}

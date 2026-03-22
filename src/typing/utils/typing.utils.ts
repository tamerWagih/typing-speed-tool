/**
 * Arabic text normalization for typing test comparison.
 * Applied to both display text and typed input before accuracy comparison.
 */
export function normalizeArabic(text: string): string {
  return (
    text
      // Strip hamzat on alef: أ إ آ → ا
      .replace(/[أإآ]/g, 'ا')
      // Strip hamza on waw: ؤ → و
      .replace(/ؤ/g, 'و')
      // Strip hamza on ya: ئ → ي
      .replace(/ئ/g, 'ي')
      // Normalize alef maqsura: ى → ي
      .replace(/ى/g, 'ي')
      // Strip all tashkeel/diacritics (Unicode 0x064B-0x065F)
      .replace(/[\u064B-\u065F]/g, '')
      // Strip tatweel/kashida
      .replace(/\u0640/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Calculate WPM and accuracy for a typing trial.
 */
export function calculateResults(
  targetWords: string[],
  typedWords: string[],
  durationSeconds: number,
  language: string,
): {
  grossWpm: number;
  netWpm: number;
  accuracy: number;
  correctWords: number;
  totalWordsAttempted: number;
  errorCount: number;
} {
  const minutes = durationSeconds / 60;
  const totalWordsAttempted = typedWords.length;

  let correctWords = 0;
  let errorCount = 0;
  let totalCharsTyped = 0;

  for (let i = 0; i < typedWords.length; i++) {
    const typed = language === 'ar' ? normalizeArabic(typedWords[i]) : typedWords[i];
    const target =
      i < targetWords.length
        ? language === 'ar'
          ? normalizeArabic(targetWords[i])
          : targetWords[i]
        : '';

    totalCharsTyped += typedWords[i].length + 1; // +1 for space

    if (typed === target) {
      correctWords++;
    } else {
      errorCount++;
    }
  }

  // Gross WPM: all characters typed / 5 / minutes (industry standard: 5 chars = 1 word)
  const grossWpm = minutes > 0 ? Math.round(totalCharsTyped / 5 / minutes) : 0;

  // Net WPM: gross WPM minus penalty for errors
  const netWpm = Math.max(0, Math.round(grossWpm - errorCount / minutes));

  // Accuracy: word-level
  const accuracy =
    totalWordsAttempted > 0
      ? Math.round((correctWords / totalWordsAttempted) * 100)
      : 0;

  return {
    grossWpm,
    netWpm,
    accuracy,
    correctWords,
    totalWordsAttempted,
    errorCount,
  };
}

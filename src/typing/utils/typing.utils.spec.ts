import { normalizeArabic, calculateResults } from './typing.utils';

describe('normalizeArabic', () => {
  // ── Hamzat on Alef ──
  it('should normalize أ to ا', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
  });

  it('should normalize إ to ا', () => {
    expect(normalizeArabic('إسلام')).toBe('اسلام');
  });

  it('should normalize آ to ا', () => {
    expect(normalizeArabic('آمال')).toBe('امال');
  });

  it('should normalize mixed hamzat in a sentence', () => {
    expect(normalizeArabic('أحمد إبراهيم آمال')).toBe('احمد ابراهيم امال');
  });

  // ── Hamza on Waw and Ya ──
  it('should normalize ؤ to و', () => {
    expect(normalizeArabic('مؤمن')).toBe('مومن');
  });

  it('should normalize ئ to ي', () => {
    expect(normalizeArabic('نتائج')).toBe('نتايج');
  });

  // ── Alef Maqsura ──
  it('should normalize ى to ي', () => {
    expect(normalizeArabic('لدى')).toBe('لدي');
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('موسيقى')).toBe('موسيقي');
  });

  // ── Tashkeel / Diacritics ──
  it('should strip fatha', () => {
    expect(normalizeArabic('كَتَبَ')).toBe('كتب');
  });

  it('should strip kasra', () => {
    expect(normalizeArabic('بِسْمِ')).toBe('بسم');
  });

  it('should strip damma', () => {
    expect(normalizeArabic('كُتُبٌ')).toBe('كتب');
  });

  it('should strip shadda', () => {
    expect(normalizeArabic('محمَّد')).toBe('محمد');
  });

  it('should strip tanween', () => {
    expect(normalizeArabic('كتابًا')).toBe('كتابا');
  });

  it('should strip all tashkeel from a fully-vowelled sentence', () => {
    const input = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ';
    const expected = 'بسم الله الرحمن الرحيم';
    expect(normalizeArabic(input)).toBe(expected);
  });

  // ── Kashida / Tatweel ──
  it('should strip kashida', () => {
    expect(normalizeArabic('كتـــاب')).toBe('كتاب');
    expect(normalizeArabic('مـحـمـد')).toBe('محمد');
  });

  // ── Whitespace ──
  it('should normalize multiple spaces to single space', () => {
    expect(normalizeArabic('كلمة   أولى   ثانية')).toBe('كلمة اولي ثانية');
  });

  it('should trim leading/trailing whitespace', () => {
    expect(normalizeArabic('  مرحبا  ')).toBe('مرحبا');
  });

  // ── Edge Cases ──
  it('should handle empty string', () => {
    expect(normalizeArabic('')).toBe('');
  });

  it('should handle string with only diacritics', () => {
    expect(normalizeArabic('ً ٌ ٍ')).toBe('');
  });

  it('should not modify English text', () => {
    expect(normalizeArabic('hello world')).toBe('hello world');
  });

  it('should handle combined normalizations', () => {
    // إيجابية → ايجابية (hamza on alef)
    // الهادئة → الهاديه... actually ئ→ي, ة stays
    const input = 'الاستماع للموسيقى الهادئة';
    const expected = 'الاستماع للموسيقي الهاديه';
    // Actually ة is not normalized, let me fix: ئة → يه? No, ة stays as ة
    // ئ → ي only, ة is untouched
    expect(normalizeArabic(input)).toBe('الاستماع للموسيقي الهادية');
  });
});

describe('calculateResults', () => {
  // ── Basic English ──
  it('should calculate perfect accuracy for matching words', () => {
    const target = ['the', 'quick', 'brown', 'fox'];
    const typed = ['the', 'quick', 'brown', 'fox'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(4);
    expect(result.errorCount).toBe(0);
    expect(result.accuracy).toBe(100);
    expect(result.totalWordsAttempted).toBe(4);
  });

  it('should count errors for mismatched words', () => {
    const target = ['the', 'quick', 'brown', 'fox'];
    const typed = ['the', 'quik', 'brown', 'fax'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(2); // 'the' and 'brown' match
    expect(result.errorCount).toBe(2); // 'quik' and 'fax' wrong
    expect(result.accuracy).toBe(50);
  });

  it('should handle fewer typed words than target', () => {
    const target = ['the', 'quick', 'brown', 'fox', 'jumps'];
    const typed = ['the', 'quick'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(result.totalWordsAttempted).toBe(2);
    expect(result.accuracy).toBe(100);
  });

  it('should handle more typed words than target (extra words count as errors)', () => {
    const target = ['the', 'quick'];
    const typed = ['the', 'quick', 'extra'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(2);
    expect(result.errorCount).toBe(1); // 'extra' has no target → error
    expect(result.totalWordsAttempted).toBe(3);
  });

  // ── WPM Calculation ──
  it('should calculate gross WPM based on characters typed', () => {
    // "the quick brown fox" = 3+1 + 5+1 + 5+1 + 3+1 = 20 chars
    // 20 chars / 5 / 1 minute = 4 WPM
    const target = ['the', 'quick', 'brown', 'fox'];
    const typed = ['the', 'quick', 'brown', 'fox'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.grossWpm).toBe(4);
  });

  it('should calculate net WPM as gross - errors/minutes', () => {
    // 20 chars / 5 / 1 min = 4 gross WPM
    // 2 errors / 1 min = 2 penalty
    // net = 4 - 2 = 2
    const target = ['the', 'quick', 'brown', 'fox'];
    const typed = ['the', 'quik', 'brown', 'fax'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.grossWpm).toBe(4);
    expect(result.netWpm).toBe(2);
  });

  it('should never return negative net WPM', () => {
    const target = ['the'];
    const typed = ['xxx', 'yyy', 'zzz', 'aaa', 'bbb'];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.netWpm).toBeGreaterThanOrEqual(0);
  });

  it('should handle 30-second duration correctly', () => {
    // "the quick" = 3+1 + 5+1 = 10 chars
    // 10 / 5 / 0.5 min = 4 WPM
    const target = ['the', 'quick'];
    const typed = ['the', 'quick'];
    const result = calculateResults(target, typed, 30, 'en');

    expect(result.grossWpm).toBe(4);
  });

  // ── Arabic with Normalization ──
  it('should normalize Arabic words before comparison', () => {
    const target = ['أحمد', 'يلعب'];
    const typed = ['احمد', 'يلعب']; // typed without hamza
    const result = calculateResults(target, typed, 60, 'ar');

    expect(result.correctWords).toBe(2); // normalized match
    expect(result.accuracy).toBe(100);
  });

  it('should normalize alef maqsura in Arabic comparison', () => {
    const target = ['على', 'لدى'];
    const typed = ['علي', 'لدي']; // typed with ya instead of alef maqsura
    const result = calculateResults(target, typed, 60, 'ar');

    expect(result.correctWords).toBe(2);
    expect(result.accuracy).toBe(100);
  });

  it('should normalize hamza on ya in Arabic comparison', () => {
    const target = ['نتائج'];
    const typed = ['نتايج']; // ئ typed as ي
    const result = calculateResults(target, typed, 60, 'ar');

    expect(result.correctWords).toBe(1);
    expect(result.accuracy).toBe(100);
  });

  it('should ignore tashkeel in Arabic comparison', () => {
    const target = ['كَتَبَ'];
    const typed = ['كتب']; // typed without diacritics
    const result = calculateResults(target, typed, 60, 'ar');

    expect(result.correctWords).toBe(1);
    expect(result.accuracy).toBe(100);
  });

  // ── Edge Cases ──
  it('should handle empty typed input', () => {
    const target = ['the', 'quick'];
    const typed: string[] = [];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(0);
    expect(result.totalWordsAttempted).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.grossWpm).toBe(0);
    expect(result.netWpm).toBe(0);
  });

  it('should handle zero duration gracefully', () => {
    const target = ['the'];
    const typed = ['the'];
    const result = calculateResults(target, typed, 0, 'en');

    expect(result.grossWpm).toBe(0);
    expect(result.netWpm).toBe(0);
  });
});

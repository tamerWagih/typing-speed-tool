import { normalizeArabic, calculateResults } from './typing.utils';

// ═══════════════════════════════════════════════════════════
// normalizeArabic — every rule tested with REAL Arabic words
// ═══════════════════════════════════════════════════════════

describe('normalizeArabic', () => {
  // ── Hamzat on Alef (أ إ آ → ا) ──
  it('should normalize hamza-above-alef أ → ا', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('أفضل')).toBe('افضل');
    expect(normalizeArabic('أسهل')).toBe('اسهل');
  });

  it('should normalize hamza-below-alef إ → ا', () => {
    expect(normalizeArabic('إسلام')).toBe('اسلام');
    expect(normalizeArabic('إيجابية')).toBe('ايجابية');
  });

  it('should normalize alef-madda آ → ا', () => {
    expect(normalizeArabic('آمال')).toBe('امال');
    expect(normalizeArabic('القرآن')).toBe('القران');
  });

  // ── Hamza on Waw/Ya (ؤ → و, ئ → ي) ──
  it('should normalize hamza-on-waw ؤ → و', () => {
    expect(normalizeArabic('مؤمن')).toBe('مومن');
    expect(normalizeArabic('مسؤول')).toBe('مسوول');
  });

  it('should normalize hamza-on-ya ئ → ي', () => {
    expect(normalizeArabic('نتائج')).toBe('نتايج');
    expect(normalizeArabic('الكائنات')).toBe('الكاينات');
    expect(normalizeArabic('الهادئة')).toBe('الهادية');
  });

  // ── Alef Maqsura (ى → ي) ──
  it('should normalize alef-maqsura ى → ي', () => {
    expect(normalizeArabic('لدى')).toBe('لدي');
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('موسيقى')).toBe('موسيقي');
    expect(normalizeArabic('مستوى')).toBe('مستوي');
  });

  // ── Tashkeel / Diacritics ──
  it('should strip fatha (  َ )', () => {
    expect(normalizeArabic('كَتَبَ')).toBe('كتب');
  });

  it('should strip kasra (  ِ ) and sukun (  ْ )', () => {
    expect(normalizeArabic('بِسْمِ')).toBe('بسم');
  });

  it('should strip damma (  ُ ) and tanween (  ٌ )', () => {
    expect(normalizeArabic('كُتُبٌ')).toBe('كتب');
  });

  it('should strip shadda (  ّ )', () => {
    expect(normalizeArabic('محمَّد')).toBe('محمد');
    expect(normalizeArabic('اللَّه')).toBe('الله');
  });

  it('should strip tanween fath, damm, kasr', () => {
    expect(normalizeArabic('كتابًا')).toBe('كتابا');     // tanween fath
    expect(normalizeArabic('كتابٌ')).toBe('كتاب');       // tanween damm
    expect(normalizeArabic('كتابٍ')).toBe('كتاب');       // tanween kasr
  });

  it('should strip ALL tashkeel from a real Quran verse', () => {
    const input = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ';
    const expected = 'بسم الله الرحمن الرحيم';
    expect(normalizeArabic(input)).toBe(expected);
  });

  // ── Kashida / Tatweel (ـ) ──
  it('should strip kashida from decorated text', () => {
    expect(normalizeArabic('كتـــاب')).toBe('كتاب');
    expect(normalizeArabic('مـحـمـد')).toBe('محمد');
    expect(normalizeArabic('العربـــية')).toBe('العربية');
  });

  // ── Whitespace ──
  it('should normalize multiple spaces and trim', () => {
    expect(normalizeArabic('كلمة   أولى   ثانية')).toBe('كلمة اولي ثانية');
    expect(normalizeArabic('  مرحبا  ')).toBe('مرحبا');
    expect(normalizeArabic('\t كلمة \n')).toBe('كلمة');
  });

  // ── Edge Cases ──
  it('should handle empty string', () => {
    expect(normalizeArabic('')).toBe('');
  });

  it('should handle string with only diacritics and spaces', () => {
    expect(normalizeArabic('ً ٌ ٍ')).toBe('');
  });

  it('should not modify English text', () => {
    expect(normalizeArabic('hello world')).toBe('hello world');
  });

  // ── Real passage text from seed data ──
  it('should normalize a real Arabic passage excerpt correctly', () => {
    // This tests a real sentence that would appear in the typing test
    const passage = 'الاستماع إلى الموسيقى الهادئة يساعد على تحسين المزاج';
    const normalized = normalizeArabic(passage);
    // إلى → الي (hamza-below-alef + alef-maqsura)
    // الموسيقى → الموسيقي (alef-maqsura)
    // الهادئة → الهادية (hamza-on-ya)
    // على → علي (alef-maqsura)
    expect(normalized).toBe('الاستماع الي الموسيقي الهادية يساعد علي تحسين المزاج');
  });

  it('should ensure two users typing same word differently both match after normalization', () => {
    // User A types with hamza, User B types without — both should normalize to same
    const userA = normalizeArabic('إيجابية');
    const userB = normalizeArabic('ايجابية');
    expect(userA).toBe(userB);

    const userC = normalizeArabic('أبوابا');
    const userD = normalizeArabic('ابوابا');
    expect(userC).toBe(userD);
  });
});

// ═══════════════════════════════════════════════════════════
// calculateResults — realistic typing test scenarios
// ═══════════════════════════════════════════════════════════

describe('calculateResults', () => {
  // ── Real English scenario: full passage, 60 seconds ──
  it('should calculate correct results for a realistic 60-second English trial', () => {
    // Real passage: "The quick brown fox jumps over the lazy dog near the river bank"
    const target = 'The quick brown fox jumps over the lazy dog near the river bank'.split(' ');
    // Candidate types with 2 typos: "quikc" and "lazzy"
    const typed  = 'The quikc brown fox jumps over the lazzy dog near the river bank'.split(' ');
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.totalWordsAttempted).toBe(13);
    expect(result.correctWords).toBe(11);
    expect(result.errorCount).toBe(2);
    expect(result.accuracy).toBe(85); // 11/13 = 84.6 → rounds to 85
    // grossWpm: (3+1+5+1+5+1+3+1+5+1+4+1+3+1+5+1+3+1+4+1+3+1+5+1+4) / 5 / 1
    // Each word + 1 for space: sum of (len+1) for each word
    // 4+6+6+4+6+5+4+6+4+5+4+6+5 = 65 chars / 5 / 1 = 13 grossWpm
    expect(result.grossWpm).toBe(13);
    // netWpm = 13 - 2/1 = 11
    expect(result.netWpm).toBe(11);
  });

  it('should calculate correct results for a 30-second English trial', () => {
    // Candidate only types 6 words in 30 seconds
    const target = 'The quick brown fox jumps over the lazy dog'.split(' ');
    const typed  = 'The quick brown fox jumps over'.split(' ');
    const result = calculateResults(target, typed, 30, 'en');

    expect(result.totalWordsAttempted).toBe(6);
    expect(result.correctWords).toBe(6);
    expect(result.errorCount).toBe(0);
    expect(result.accuracy).toBe(100);
    // chars: 4+6+6+4+6+5 = 31 / 5 / 0.5min = 12.4 → rounds to 12
    expect(result.grossWpm).toBe(12);
    expect(result.netWpm).toBe(12); // no errors
  });

  // ── Real Arabic scenario with normalization ──
  it('should match Arabic words correctly after normalization in a real trial', () => {
    // Passage has hamzat and alef maqsura
    const target = ['القراءة', 'تفتح', 'أبوابا', 'كثيرة', 'لدى', 'الإنسان'];
    // Candidate types without hamza (common keyboard behavior)
    const typed   = ['القراءة', 'تفتح', 'ابوابا', 'كثيرة', 'لدي', 'الانسان'];
    const result = calculateResults(target, typed, 60, 'ar');

    // All should match after normalization:
    // أبوابا → ابوابا ✓
    // لدى → لدي ✓ (alef maqsura)
    // الإنسان → الانسان ✓ (hamza below alef)
    expect(result.correctWords).toBe(6);
    expect(result.errorCount).toBe(0);
    expect(result.accuracy).toBe(100);
  });

  it('should detect real Arabic typos even after normalization', () => {
    const target = ['الكائنات', 'الحية', 'تعيش', 'في', 'بيئات', 'مختلفة'];
    // Candidate mistypes two words
    const typed   = ['الكاينات', 'الحيه', 'تعيس', 'في', 'بيئات', 'مختلفة'];
    const result = calculateResults(target, typed, 60, 'ar');

    // الكائنات → الكاينات (both normalize to الكاينات) ✓
    // الحية vs الحيه: both should normalize equally? ة and ه are different chars, NOT normalized
    // تعيش vs تعيس: clearly a typo ✗
    expect(result.correctWords).toBe(4); // الكاينات, في, بيئات, مختلفة
    expect(result.errorCount).toBe(2);   // الحيه (ة≠ه) and تعيس (ش≠س)
  });

  // ── WPM formula verification ──
  it('should match the WPM formula: gross = chars/5/min, net = gross - errors/min', () => {
    // Precisely controlled: 5 words of 4 chars each = 5 * (4+1) = 25 chars
    const target = ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst'];
    const typed  = ['abcd', 'efgg', 'ijkl', 'mnop', 'qrst']; // 1 error
    const result = calculateResults(target, typed, 60, 'en');

    // grossWpm = 25 / 5 / 1 = 5
    expect(result.grossWpm).toBe(5);
    // netWpm = 5 - 1/1 = 4
    expect(result.netWpm).toBe(4);
    expect(result.accuracy).toBe(80); // 4/5
  });

  it('should scale WPM correctly with different durations', () => {
    // Same input, different durations → WPM should scale inversely
    const target = ['hello', 'world', 'test'];
    const typed  = ['hello', 'world', 'test'];
    // chars = 6+6+5 = 17

    const r60 = calculateResults(target, typed, 60, 'en');  // 17/5/1 = 3.4 → 3
    const r30 = calculateResults(target, typed, 30, 'en');  // 17/5/0.5 = 6.8 → 7
    const r120 = calculateResults(target, typed, 120, 'en'); // 17/5/2 = 1.7 → 2

    expect(r60.grossWpm).toBe(3);
    expect(r30.grossWpm).toBe(7);
    expect(r120.grossWpm).toBe(2);
    // All should have 100% accuracy
    expect(r60.accuracy).toBe(100);
    expect(r30.accuracy).toBe(100);
    expect(r120.accuracy).toBe(100);
  });

  // ── Candidate typed fewer words (ran out of time) ──
  it('should handle partial typing (candidate ran out of time)', () => {
    const target = 'The quick brown fox jumps over the lazy dog'.split(' ');
    const typed  = ['The', 'quick', 'brown']; // only typed 3 of 9 words
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.totalWordsAttempted).toBe(3);
    expect(result.correctWords).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(result.accuracy).toBe(100); // 3/3 of what they typed
  });

  // ── Candidate typed extra words beyond passage ──
  it('should count extra typed words beyond passage as errors', () => {
    const target = ['The', 'end'];
    const typed  = ['The', 'end', 'wait', 'more']; // typed beyond passage
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(2);
    expect(result.errorCount).toBe(2); // 'wait' and 'more' have no target
    expect(result.totalWordsAttempted).toBe(4);
    expect(result.accuracy).toBe(50); // 2/4
  });

  // ── Net WPM floor at 0 ──
  it('should clamp net WPM to zero (never negative) even with many errors', () => {
    // 3 wrong words of 4 chars each in 10 seconds
    // chars = 3 * (4+1) = 15, minutes = 10/60 = 0.1667
    // grossWpm = round(15 / 5 / 0.1667) = round(18) = 18
    // penalty = 3 / 0.1667 = 18
    // net = 18 - 18 = 0, clamped at 0
    // With more errors, net goes negative → clamped to 0
    const target = ['aaaa'];
    const typed = ['bbbb', 'cccc', 'dddd', 'eeee']; // 4 errors
    const result = calculateResults(target, typed, 10, 'en');
    // grossWpm = round(20/5/0.1667) = round(24) = 24
    // penalty = 4/0.1667 = 24
    // net = max(0, round(24-24)) = 0
    expect(result.netWpm).toBe(0);
    expect(result.errorCount).toBe(4);
    expect(result.correctWords).toBe(0);
    expect(result.accuracy).toBe(0);
  });

  // ── English does NOT use normalization ──
  it('should NOT apply Arabic normalization to English text', () => {
    const target = ['case', 'Sensitive'];
    const typed  = ['case', 'sensitive']; // lowercase vs uppercase
    const result = calculateResults(target, typed, 60, 'en');

    // English comparison is exact — 'Sensitive' ≠ 'sensitive'
    expect(result.correctWords).toBe(1);
    expect(result.errorCount).toBe(1);
  });

  // ── Edge: empty input ──
  it('should handle candidate who typed nothing', () => {
    const target = ['The', 'quick', 'brown'];
    const typed: string[] = [];
    const result = calculateResults(target, typed, 60, 'en');

    expect(result.correctWords).toBe(0);
    expect(result.totalWordsAttempted).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.grossWpm).toBe(0);
    expect(result.netWpm).toBe(0);
  });

  // ── Edge: zero duration ──
  it('should handle zero duration without crashing (NaN guard)', () => {
    const target = ['the'];
    const typed = ['the'];
    const result = calculateResults(target, typed, 0, 'en');

    expect(result.grossWpm).toBe(0);
    expect(result.netWpm).toBe(0);
    // accuracy still valid
    expect(result.accuracy).toBe(100);
    expect(result.correctWords).toBe(1);
  });

  // ── Edge: single word ──
  it('should work with a single word', () => {
    const result = calculateResults(['hello'], ['hello'], 60, 'en');
    expect(result.correctWords).toBe(1);
    expect(result.accuracy).toBe(100);
    // 6 chars / 5 / 1 = 1.2 → rounds to 1
    expect(result.grossWpm).toBe(1);
  });
});

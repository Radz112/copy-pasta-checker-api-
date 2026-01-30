import {
  generateVerdict,
  generateRoast,
  getScoreEmoji,
  generateSummary,
  SPECIAL_VERDICTS,
} from '../src/utils/verdict';

describe('Verdict Utils', () => {

  describe('generateVerdict', () => {

    test('should return Ctrl+C Masterclass for 95%+', () => {
      expect(generateVerdict(95)).toContain('Ctrl+C Masterclass');
      expect(generateVerdict(99.9)).toContain('Ctrl+C Masterclass');
      expect(generateVerdict(100)).toContain('Ctrl+C Masterclass');
    });

    test('should return appropriate verdict for 85-94%', () => {
      expect(generateVerdict(85)).toContain('changed the name');
      expect(generateVerdict(90)).toContain('changed the name');
      expect(generateVerdict(94.9)).toContain('changed the name');
    });

    test('should return appropriate verdict for 70-84%', () => {
      expect(generateVerdict(70)).toContain('effort was made');
      expect(generateVerdict(80)).toContain('effort was made');
    });

    test('should return Frankenstein for 50-69%', () => {
      expect(generateVerdict(50)).toContain('Frankenstein');
      expect(generateVerdict(65)).toContain('Frankenstein');
    });

    test('should return Custom Logic for <50%', () => {
      expect(generateVerdict(49)).toContain('Custom Logic');
      expect(generateVerdict(0)).toContain('Custom Logic');
      expect(generateVerdict(25)).toContain('Custom Logic');
    });

  });

  describe('generateRoast', () => {

    test('should return a non-empty string', () => {
      const roast = generateRoast(95);
      expect(typeof roast).toBe('string');
      expect(roast.length).toBeGreaterThan(0);
    });

    test('should return different roasts (randomness)', () => {
      const roasts = new Set<string>();
      // Generate multiple roasts and check for variety
      for (let i = 0; i < 20; i++) {
        roasts.add(generateRoast(95));
      }
      // Should have at least 2 different roasts
      expect(roasts.size).toBeGreaterThan(1);
    });

    test('should return roasts for all tiers', () => {
      expect(generateRoast(100).length).toBeGreaterThan(0);
      expect(generateRoast(90).length).toBeGreaterThan(0);
      expect(generateRoast(75).length).toBeGreaterThan(0);
      expect(generateRoast(55).length).toBeGreaterThan(0);
      expect(generateRoast(25).length).toBeGreaterThan(0);
    });

  });

  describe('getScoreEmoji', () => {

    test('should return pasta emoji for 95%+', () => {
      expect(getScoreEmoji(95)).toBe('🍝');
      expect(getScoreEmoji(100)).toBe('🍝');
    });

    test('should return clipboard emoji for 85-94%', () => {
      expect(getScoreEmoji(85)).toBe('📋');
      expect(getScoreEmoji(94)).toBe('📋');
    });

    test('should return neutral emoji for 70-84%', () => {
      expect(getScoreEmoji(70)).toBe('😐');
    });

    test('should return zombie emoji for 50-69%', () => {
      expect(getScoreEmoji(50)).toBe('🧟');
    });

    test('should return sparkle emoji for <50%', () => {
      expect(getScoreEmoji(49)).toBe('✨');
      expect(getScoreEmoji(0)).toBe('✨');
    });

  });

  describe('generateSummary', () => {

    test('should include score and match name', () => {
      const summary = generateSummary(95.5, 'PEPE', 'meme_coin');
      expect(summary).toContain('95.5%');
      expect(summary).toContain('PEPE');
    });

    test('should include appropriate emoji', () => {
      expect(generateSummary(96, 'Test', 'test')).toContain('🍝');
      expect(generateSummary(25, 'Test', 'test')).toContain('✨');
    });

  });

  describe('SPECIAL_VERDICTS', () => {

    test('should have all required special cases', () => {
      expect(SPECIAL_VERDICTS.PROXY_DETECTED).toBeDefined();
      expect(SPECIAL_VERDICTS.NO_CODE).toBeDefined();
      expect(SPECIAL_VERDICTS.FETCH_ERROR).toBeDefined();
      expect(SPECIAL_VERDICTS.SELF_MATCH).toBeDefined();
    });

    test('should never contain is_original: true', () => {
      const allVerdicts = JSON.stringify(SPECIAL_VERDICTS);
      expect(allVerdicts).not.toContain('is_original');
      expect(allVerdicts).not.toContain('original: true');
    });

  });

});

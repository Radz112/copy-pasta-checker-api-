import {
  generateVerdict,
  generateRoast,
  NO_CODE_VERDICT,
  NO_CODE_ROAST,
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
      for (let i = 0; i < 20; i++) {
        roasts.add(generateRoast(95));
      }
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

  describe('NO_CODE constants', () => {

    test('should have verdict and roast', () => {
      expect(NO_CODE_VERDICT).toContain('No Code');
      expect(NO_CODE_ROAST.length).toBeGreaterThan(0);
    });

  });

});

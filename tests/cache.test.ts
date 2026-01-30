import { analysisCache, AnalysisCache } from '../src/utils/cache';
import { AnalysisResponse } from '../src/types';

// Valid even-length hex strings for cache key generation
const HEX_A = '6080604052348015';
const HEX_B = '6080604052348016';
const HEX_C = '60806040523480ff';
const HEX_D = 'aabbccdd00112233';
const HEX_UNCACHED = 'ffffffffffffffff';

describe('Analysis Cache', () => {

  beforeEach(() => {
    analysisCache.clear();
    analysisCache.setEnabled(true);
  });

  const mockResult: AnalysisResponse['data'] = {
    token: '0x1234',
    chain: 'base',
    similarity_score: 95.5,
    match_name: 'PEPE',
    match_category: 'meme_coin',
    narrative_verdict: 'Test',
    roast: 'Test roast',
    is_proxy: false,
    proxy_implementation: null,
    bytecode_size: 1000,
    analysis_time_ms: 100,
  };

  describe('generateKey', () => {

    test('should generate consistent keys for same bytecode', () => {
      const key1 = analysisCache.generateKey(HEX_A);
      const key2 = analysisCache.generateKey(HEX_A);

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different bytecode', () => {
      const key1 = analysisCache.generateKey(HEX_A);
      const key2 = analysisCache.generateKey(HEX_B);

      expect(key1).not.toBe(key2);
    });

    test('should handle 0x prefix consistently', () => {
      const withPrefix = analysisCache.generateKey('0x6080604052');
      const withoutPrefix = analysisCache.generateKey('6080604052');

      expect(withPrefix).toBe(withoutPrefix);
    });

  });

  describe('get/set', () => {

    test('should store and retrieve results', () => {
      analysisCache.set(HEX_A, mockResult);
      const retrieved = analysisCache.get(HEX_A);

      expect(retrieved).toEqual(mockResult);
    });

    test('should return null for uncached bytecode', () => {
      const result = analysisCache.get(HEX_UNCACHED);
      expect(result).toBeNull();
    });

    test('should increment hit count on retrieval', () => {
      analysisCache.set(HEX_A, mockResult);

      analysisCache.get(HEX_A);
      analysisCache.get(HEX_A);
      analysisCache.get(HEX_A);

      const stats = analysisCache.getStats();
      expect(stats.totalHits).toBe(3);
    });

  });

  describe('has', () => {

    test('should return true for cached bytecode', () => {
      analysisCache.set(HEX_A, mockResult);

      expect(analysisCache.has(HEX_A)).toBe(true);
    });

    test('should return false for uncached bytecode', () => {
      expect(analysisCache.has(HEX_UNCACHED)).toBe(false);
    });

  });

  describe('enable/disable', () => {

    test('should not cache when disabled', () => {
      analysisCache.setEnabled(false);

      analysisCache.set(HEX_A, mockResult);

      expect(analysisCache.get(HEX_A)).toBeNull();
    });

    test('should cache when re-enabled', () => {
      analysisCache.setEnabled(false);
      analysisCache.setEnabled(true);

      analysisCache.set(HEX_A, mockResult);

      expect(analysisCache.get(HEX_A)).toEqual(mockResult);
    });

  });

  describe('clear', () => {

    test('should remove all entries', () => {
      analysisCache.set(HEX_A, mockResult);
      analysisCache.set(HEX_B, mockResult);
      analysisCache.set(HEX_C, mockResult);

      expect(analysisCache.getStats().entries).toBe(3);

      analysisCache.clear();

      expect(analysisCache.getStats().entries).toBe(0);
    });

  });

  describe('getStats', () => {

    test('should return correct statistics', () => {
      analysisCache.set(HEX_A, mockResult);
      analysisCache.set(HEX_B, mockResult);

      const stats = analysisCache.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.enabled).toBe(true);
      expect(stats.totalHits).toBe(0);
    });

  });

  describe('eviction', () => {

    test('should evict least valuable entry when maxEntries exceeded', () => {
      // Create a small cache with maxEntries = 3
      const smallCache = new AnalysisCache(3);

      // Fill the cache
      smallCache.set('aabbccdd00000001', mockResult);
      smallCache.set('aabbccdd00000002', mockResult);
      smallCache.set('aabbccdd00000003', mockResult);

      expect(smallCache.getStats().entries).toBe(3);

      // Add one more — should trigger eviction
      smallCache.set('aabbccdd00000004', mockResult);

      expect(smallCache.getStats().entries).toBe(3);
      // The new entry should be present
      expect(smallCache.has('aabbccdd00000004')).toBe(true);
    });

    test('should keep frequently accessed entries during eviction', () => {
      const smallCache = new AnalysisCache(3);

      smallCache.set('aabbccdd00000001', mockResult);
      smallCache.set('aabbccdd00000002', mockResult);
      smallCache.set('aabbccdd00000003', mockResult);

      // Access entry 1 many times to boost its hit count
      for (let i = 0; i < 10; i++) {
        smallCache.get('aabbccdd00000001');
      }

      // Add new entry — should evict one of the low-hit entries, not entry 1
      smallCache.set('aabbccdd00000004', mockResult);

      expect(smallCache.has('aabbccdd00000001')).toBe(true);
      expect(smallCache.has('aabbccdd00000004')).toBe(true);
    });

  });

});

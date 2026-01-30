import { analysisCache } from '../src/utils/cache';
import { AnalysisResponse } from '../src/types';

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
      const bytecode = '6080604052348015';
      const key1 = analysisCache.generateKey(bytecode);
      const key2 = analysisCache.generateKey(bytecode);

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different bytecode', () => {
      const key1 = analysisCache.generateKey('6080604052348015');
      const key2 = analysisCache.generateKey('6080604052348016');

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
      const bytecode = '6080604052';

      analysisCache.set(bytecode, mockResult);
      const retrieved = analysisCache.get(bytecode);

      expect(retrieved).toEqual(mockResult);
    });

    test('should return null for uncached bytecode', () => {
      const result = analysisCache.get('nonexistent');
      expect(result).toBeNull();
    });

    test('should increment hit count on retrieval', () => {
      const bytecode = '6080604052';
      analysisCache.set(bytecode, mockResult);

      analysisCache.get(bytecode);
      analysisCache.get(bytecode);
      analysisCache.get(bytecode);

      const stats = analysisCache.getStats();
      expect(stats.totalHits).toBe(3);
    });

  });

  describe('has', () => {

    test('should return true for cached bytecode', () => {
      const bytecode = '6080604052';
      analysisCache.set(bytecode, mockResult);

      expect(analysisCache.has(bytecode)).toBe(true);
    });

    test('should return false for uncached bytecode', () => {
      expect(analysisCache.has('nonexistent')).toBe(false);
    });

  });

  describe('enable/disable', () => {

    test('should not cache when disabled', () => {
      analysisCache.setEnabled(false);

      const bytecode = '6080604052';
      analysisCache.set(bytecode, mockResult);

      expect(analysisCache.get(bytecode)).toBeNull();
    });

    test('should cache when re-enabled', () => {
      analysisCache.setEnabled(false);
      analysisCache.setEnabled(true);

      const bytecode = '6080604052';
      analysisCache.set(bytecode, mockResult);

      expect(analysisCache.get(bytecode)).toEqual(mockResult);
    });

  });

  describe('clear', () => {

    test('should remove all entries', () => {
      analysisCache.set('code1', mockResult);
      analysisCache.set('code2', mockResult);
      analysisCache.set('code3', mockResult);

      expect(analysisCache.getStats().entries).toBe(3);

      analysisCache.clear();

      expect(analysisCache.getStats().entries).toBe(0);
    });

  });

  describe('getStats', () => {

    test('should return correct statistics', () => {
      analysisCache.set('code1', mockResult);
      analysisCache.set('code2', mockResult);

      const stats = analysisCache.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.enabled).toBe(true);
      expect(stats.totalHits).toBe(0);
    });

  });

});

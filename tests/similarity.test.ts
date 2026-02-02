import {
  chunkBytecode,
  jaccardSimilarity,
  preprocessLibrary,
  compareToLibrary,
} from '../src/utils/similarity';
import { LegendEntry } from '../src/types';

describe('Similarity Utils', () => {

  describe('chunkBytecode', () => {

    test('should create chunks of correct size', () => {
      const bytecode = '6080604052348015';
      const chunks = chunkBytecode(bytecode);

      expect(chunks.size).toBeGreaterThan(0);

      for (const chunk of chunks) {
        expect(chunk.length).toBe(8);
      }
    });

    test('should handle short bytecode', () => {
      const shortBytecode = '6080';
      const chunks = chunkBytecode(shortBytecode);

      expect(chunks.size).toBe(0);
    });

    test('should produce unique chunks', () => {
      const repeatingBytecode = '6060606060606060';
      const chunks = chunkBytecode(repeatingBytecode);

      expect(chunks.size).toBeLessThan(repeatingBytecode.length / 2);
    });

    test('should strip 0x prefix', () => {
      const withPrefix = '0x6080604052348015';
      const withoutPrefix = '6080604052348015';

      const chunksA = chunkBytecode(withPrefix);
      const chunksB = chunkBytecode(withoutPrefix);

      expect(chunksA).toEqual(chunksB);
    });

  });

  describe('jaccardSimilarity', () => {

    test('should return 100 for identical sets', () => {
      const set = new Set(['aaaa', 'bbbb', 'cccc']);
      expect(jaccardSimilarity(set, set)).toBe(100);
    });

    test('should return 0 for completely different sets', () => {
      const setA = new Set(['aaaa', 'bbbb']);
      const setB = new Set(['cccc', 'dddd']);
      expect(jaccardSimilarity(setA, setB)).toBe(0);
    });

    test('should return 50 for half overlap', () => {
      const setA = new Set(['aaaa', 'bbbb']);
      const setB = new Set(['bbbb', 'cccc']);
      expect(jaccardSimilarity(setA, setB)).toBeCloseTo(33.33, 1);
    });

    test('should handle empty sets', () => {
      const empty = new Set<string>();
      const nonEmpty = new Set(['aaaa']);

      expect(jaccardSimilarity(empty, empty)).toBe(100);
      expect(jaccardSimilarity(empty, nonEmpty)).toBe(0);
      expect(jaccardSimilarity(nonEmpty, empty)).toBe(0);
    });

  });

  describe('compareToLibrary', () => {

    const mockLibrary: LegendEntry[] = [
      {
        id: 'legend_a',
        name: 'Legend A',
        category: 'meme_coin',
        source_chain: 'ethereum_mainnet',
        source_address: '0xaaa',
        bytecode: '0x6080604052348015610010576000',
        bytecode_size: 15,
        fetched_at: '2024-01-01',
        note: 'Test legend A'
      },
      {
        id: 'legend_b',
        name: 'Legend B',
        category: 'router',
        source_chain: 'ethereum_mainnet',
        source_address: '0xbbb',
        bytecode: '0xf4f4f4f4f4f4f4f4f4f4f4f4f4f4',
        bytecode_size: 14,
        fetched_at: '2024-01-01',
        note: 'Test legend B'
      },
    ];

    test('should return sorted results', () => {
      const processedLibrary = preprocessLibrary(mockLibrary);
      const target = '0x6080604052348015610010576000';

      const results = compareToLibrary(target, processedLibrary);

      expect(results.length).toBe(2);
      expect(results[0].legend_id).toBe('legend_a');
      expect(results[0].similarity_score).toBeGreaterThan(results[1].similarity_score);
    });

    test('should identify exact match', () => {
      const processedLibrary = preprocessLibrary(mockLibrary);
      const target = mockLibrary[0].bytecode;

      const results = compareToLibrary(target, processedLibrary);

      expect(results[0].similarity_score).toBe(100);
      expect(results[0].legend_name).toBe('Legend A');
    });

  });

});

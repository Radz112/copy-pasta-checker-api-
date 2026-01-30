import { LegendEntry, SimilarityResult } from '../types';
import { normalizeBytecode } from './normalization';

/**
 * Chunk size for Jaccard comparison (in bytes)
 * 4 bytes captures opcode + typical operand patterns
 */
const CHUNK_SIZE_BYTES = 4;
const CHUNK_SIZE_HEX = CHUNK_SIZE_BYTES * 2; // 8 hex characters

/**
 * Splits bytecode into fixed-size chunks for set comparison
 *
 * @param bytecode - Normalized bytecode hex string (no 0x prefix)
 * @param chunkSize - Size of each chunk in hex characters (default: 8)
 * @returns Set of unique chunks
 */
export function chunkBytecode(bytecode: string, chunkSize: number = CHUNK_SIZE_HEX): Set<string> {
  const chunks = new Set<string>();
  const cleanBytecode = bytecode.replace('0x', '').toLowerCase();

  // Slide through bytecode with step of 2 (1 byte) for overlapping chunks
  // This creates more granular comparison
  for (let i = 0; i <= cleanBytecode.length - chunkSize; i += 2) {
    chunks.add(cleanBytecode.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Calculates Jaccard similarity between two sets
 *
 * Jaccard Index = |A ∩ B| / |A ∪ B|
 *
 * @param setA - First set of chunks
 * @param setB - Second set of chunks
 * @returns Similarity score from 0 to 100
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 100; // Both empty = identical
  }

  if (setA.size === 0 || setB.size === 0) {
    return 0; // One empty = no similarity
  }

  // Calculate intersection
  let intersectionSize = 0;
  for (const chunk of setA) {
    if (setB.has(chunk)) {
      intersectionSize++;
    }
  }

  // Calculate union: |A| + |B| - |A ∩ B|
  const unionSize = setA.size + setB.size - intersectionSize;

  // Jaccard Index as percentage
  return (intersectionSize / unionSize) * 100;
}

/**
 * Pre-processes library of legends for fast comparison
 * Normalizes and chunks each legend's bytecode
 */
export interface ProcessedLegend {
  entry: LegendEntry;
  normalizedBytecode: string;
  chunks: Set<string>;
}

export function preprocessLibrary(legends: LegendEntry[]): ProcessedLegend[] {
  return legends.map(legend => {
    const normResult = normalizeBytecode(legend.bytecode);
    return {
      entry: legend,
      normalizedBytecode: normResult.normalized,
      chunks: chunkBytecode(normResult.normalized),
    };
  });
}

/**
 * Compares target bytecode against all legends in the library
 * Returns sorted results with best match first
 *
 * @param targetBytecode - Raw bytecode to analyze
 * @param library - Pre-processed library of legends
 * @returns Array of similarity results, sorted by score descending
 */
export function compareToLibrary(
  targetBytecode: string,
  library: ProcessedLegend[]
): SimilarityResult[] {
  // Normalize and chunk the target
  const normResult = normalizeBytecode(targetBytecode);
  const targetChunks = chunkBytecode(normResult.normalized);

  // Compare against each legend
  const results: SimilarityResult[] = library.map(legend => {
    const score = jaccardSimilarity(targetChunks, legend.chunks);

    return {
      legend_id: legend.entry.id,
      legend_name: legend.entry.name,
      category: legend.entry.category,
      similarity_score: Math.round(score * 100) / 100, // Round to 2 decimal places
    };
  });

  // Sort by similarity score (highest first)
  return results.sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Gets the best match from the library
 *
 * @param targetBytecode - Raw bytecode to analyze
 * @param library - Pre-processed library of legends
 * @returns Best matching legend or null if no significant match
 */
export function getBestMatch(
  targetBytecode: string,
  library: ProcessedLegend[]
): SimilarityResult | null {
  const results = compareToLibrary(targetBytecode, library);

  if (results.length === 0) {
    return null;
  }

  return results[0];
}

/**
 * Quick similarity check without full library comparison
 * Useful for checking if two specific contracts are similar
 */
export function quickCompare(bytecodeA: string, bytecodeB: string): number {
  const normA = normalizeBytecode(bytecodeA);
  const normB = normalizeBytecode(bytecodeB);

  const chunksA = chunkBytecode(normA.normalized);
  const chunksB = chunkBytecode(normB.normalized);

  return jaccardSimilarity(chunksA, chunksB);
}

export default {
  chunkBytecode,
  jaccardSimilarity,
  preprocessLibrary,
  compareToLibrary,
  getBestMatch,
  quickCompare,
};

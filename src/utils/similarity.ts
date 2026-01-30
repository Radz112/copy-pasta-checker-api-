import { LegendEntry, SimilarityResult } from '../types';
import { normalizeBytecode } from './normalization';

const CHUNK_SIZE_HEX = 8; // 4 bytes = 8 hex chars

/**
 * Splits bytecode into overlapping 4-byte chunks (step = 1 byte).
 */
export function chunkBytecode(bytecode: string, chunkSize: number = CHUNK_SIZE_HEX): Set<string> {
  const chunks = new Set<string>();
  const clean = bytecode.replace('0x', '').toLowerCase();

  for (let i = 0; i <= clean.length - chunkSize; i += 2) {
    chunks.add(clean.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Jaccard Index = |A ∩ B| / |A ∪ B| * 100
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 100;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const chunk of setA) {
    if (setB.has(chunk)) intersection++;
  }

  return (intersection / (setA.size + setB.size - intersection)) * 100;
}

export interface ProcessedLegend {
  entry: LegendEntry;
  chunks: Set<string>;
}

export function preprocessLibrary(legends: LegendEntry[]): ProcessedLegend[] {
  return legends.map(legend => ({
    entry: legend,
    chunks: chunkBytecode(normalizeBytecode(legend.bytecode).normalized),
  }));
}

/**
 * Compares target bytecode against all legends.
 * Returns results sorted by similarity score descending.
 */
export function compareToLibrary(targetBytecode: string, library: ProcessedLegend[]): SimilarityResult[] {
  const targetChunks = chunkBytecode(normalizeBytecode(targetBytecode).normalized);

  return library
    .map(legend => ({
      legend_id: legend.entry.id,
      legend_name: legend.entry.name,
      category: legend.entry.category,
      similarity_score: Math.round(jaccardSimilarity(targetChunks, legend.chunks) * 100) / 100,
    }))
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Quick pairwise similarity check between two bytecodes.
 */
export function quickCompare(bytecodeA: string, bytecodeB: string): number {
  return jaccardSimilarity(
    chunkBytecode(normalizeBytecode(bytecodeA).normalized),
    chunkBytecode(normalizeBytecode(bytecodeB).normalized),
  );
}

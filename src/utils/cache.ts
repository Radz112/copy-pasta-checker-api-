import { keccak256 } from 'viem';
import { AnalysisResponse } from '../types';

interface CacheEntry {
  result: AnalysisResponse['data'];
  createdAt: number;
  hitCount: number;
}

export class AnalysisCache {
  private cache = new Map<string, CacheEntry>();
  private enabled = true;
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  generateKey(normalizedBytecode: string): string {
    const hex = normalizedBytecode.startsWith('0x')
      ? normalizedBytecode
      : `0x${normalizedBytecode}`;

    return keccak256(hex as `0x${string}`);
  }

  get(normalizedBytecode: string): AnalysisResponse['data'] | null {
    if (!this.enabled) return null;
    const entry = this.cache.get(this.generateKey(normalizedBytecode));
    if (entry) {
      entry.hitCount++;
      return entry.result;
    }
    return null;
  }

  set(normalizedBytecode: string, result: AnalysisResponse['data']): void {
    if (!this.enabled) return;
    if (this.cache.size >= this.maxEntries) this.evict();
    this.cache.set(this.generateKey(normalizedBytecode), {
      result,
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  has(normalizedBytecode: string): boolean {
    return this.cache.has(this.generateKey(normalizedBytecode));
  }

  private evict(): void {
    let worstKey: string | null = null;
    let worstScore = Infinity;

    for (const [key, entry] of this.cache) {
      const score = entry.hitCount * 1_000_000 - (Date.now() - entry.createdAt);
      if (score < worstScore) {
        worstScore = score;
        worstKey = key;
      }
    }

    if (worstKey) this.cache.delete(worstKey);
  }

  getStats() {
    let totalHits = 0;
    for (const entry of this.cache.values()) totalHits += entry.hitCount;
    return { entries: this.cache.size, enabled: this.enabled, maxEntries: this.maxEntries, totalHits };
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  clear(): void { this.cache.clear(); }
}

export const analysisCache = new AnalysisCache();

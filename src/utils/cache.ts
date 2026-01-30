import { keccak256, toHex } from 'viem';
import { AnalysisResponse } from '../types';

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  result: AnalysisResponse['data'];
  createdAt: number;
  hitCount: number;
}

/**
 * In-memory cache for analysis results
 * Key: keccak256 hash of normalized bytecode
 * Value: Analysis result with metadata
 */
class AnalysisCache {
  private cache: Map<string, CacheEntry>;
  private enabled: boolean;
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.cache = new Map();
    this.enabled = true;
    this.maxEntries = maxEntries;
  }

  /**
   * Generate cache key from normalized bytecode
   * Uses keccak256 for consistent hashing
   */
  generateKey(normalizedBytecode: string): string {
    const clean = normalizedBytecode.startsWith('0x')
      ? normalizedBytecode
      : `0x${normalizedBytecode}`;

    try {
      return keccak256(clean as `0x${string}`);
    } catch (error) {
      // Fallback for invalid hex
      const encoder = new TextEncoder();
      const data = encoder.encode(normalizedBytecode);
      let hash = 0;
      for (const byte of data) {
        hash = ((hash << 5) - hash) + byte;
        hash = hash & hash;
      }
      return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
    }
  }

  /**
   * Get cached result by bytecode
   */
  get(normalizedBytecode: string): AnalysisResponse['data'] | null {
    if (!this.enabled) return null;

    const key = this.generateKey(normalizedBytecode);
    const entry = this.cache.get(key);

    if (entry) {
      entry.hitCount++;
      return entry.result;
    }

    return null;
  }

  /**
   * Store result in cache
   */
  set(normalizedBytecode: string, result: AnalysisResponse['data']): void {
    if (!this.enabled) return;

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(normalizedBytecode);
    this.cache.set(key, {
      result,
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Check if bytecode is cached
   */
  has(normalizedBytecode: string): boolean {
    const key = this.generateKey(normalizedBytecode);
    return this.cache.has(key);
  }

  /**
   * Evict oldest entries (LRU-ish)
   */
  private evictOldest(): void {
    // Find entry with lowest hit count, or oldest if tied
    let oldestKey: string | null = null;
    let lowestScore = Infinity;

    for (const [key, entry] of this.cache) {
      // Score based on hit count and age
      const age = Date.now() - entry.createdAt;
      const score = entry.hitCount * 1000000 - age;

      if (score < lowestScore) {
        lowestScore = score;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    enabled: boolean;
    maxEntries: number;
    totalHits: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      entries: this.cache.size,
      enabled: this.enabled,
      maxEntries: this.maxEntries,
      totalHits,
    };
  }

  /**
   * Enable/disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Singleton instance
export const analysisCache = new AnalysisCache();

export default analysisCache;

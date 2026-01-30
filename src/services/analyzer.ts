import { config, getRpcUrl, SupportedChain } from '../config';
import { normalizeBytecode, isBytecodeMinimal, containsDelegateCall } from '../utils/normalization';
import { resolveImplementation, fetchBytecode } from '../utils/proxy';
import { preprocessLibrary, compareToLibrary, ProcessedLegend } from '../utils/similarity';
import { generateVerdict, generateRoast, SPECIAL_VERDICTS } from '../utils/verdict';
import { AnalysisResponse, ErrorResponse } from '../types';

// Pre-process library on startup for fast comparisons
let processedLibrary: ProcessedLegend[] | null = null;

function getProcessedLibrary(): ProcessedLegend[] {
  if (!processedLibrary) {
    processedLibrary = preprocessLibrary(config.library);
  }
  return processedLibrary;
}

// Simple in-memory cache (bytecode hash -> result)
const analysisCache = new Map<string, AnalysisResponse['data']>();

/**
 * Simple hash function for cache key
 */
function hashBytecode(bytecode: string): string {
  const clean = bytecode.replace('0x', '').toLowerCase();
  // Simple hash - in production use keccak256
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Main analysis function
 */
export async function analyzeToken(
  tokenAddress: string,
  chain: SupportedChain
): Promise<AnalysisResponse | ErrorResponse> {
  const startTime = Date.now();

  try {
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return {
        status: 'error',
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid token address format. Must be 0x followed by 40 hex characters.',
        },
      };
    }

    const rpcUrl = getRpcUrl(chain);

    // Fetch bytecode
    const rawBytecode = await fetchBytecode(tokenAddress, rpcUrl);

    if (!rawBytecode || rawBytecode === '0x') {
      return {
        status: 'success',
        data: {
          token: tokenAddress,
          chain,
          similarity_score: 0,
          match_name: 'N/A',
          match_category: 'none',
          narrative_verdict: SPECIAL_VERDICTS.NO_CODE.verdict,
          roast: SPECIAL_VERDICTS.NO_CODE.roast,
          is_proxy: false,
          proxy_implementation: null,
          bytecode_size: 0,
          analysis_time_ms: Date.now() - startTime,
        },
      };
    }

    // Check for minimal proxy (small bytecode with DELEGATECALL)
    if (isBytecodeMinimal(rawBytecode) && containsDelegateCall(rawBytecode)) {
      // Try to resolve proxy
      const resolved = await resolveImplementation(tokenAddress, rawBytecode, rpcUrl);

      if (resolved.is_proxy && !resolved.implementation_address) {
        return {
          status: 'success',
          data: {
            token: tokenAddress,
            chain,
            similarity_score: 0,
            match_name: 'Proxy Contract',
            match_category: 'proxy',
            narrative_verdict: SPECIAL_VERDICTS.PROXY_DETECTED.verdict,
            roast: SPECIAL_VERDICTS.PROXY_DETECTED.roast,
            is_proxy: true,
            proxy_implementation: null,
            bytecode_size: (rawBytecode.length - 2) / 2,
            analysis_time_ms: Date.now() - startTime,
          },
        };
      }
    }

    // Resolve any proxy to get implementation bytecode
    const resolved = await resolveImplementation(tokenAddress, rawBytecode, rpcUrl);
    const bytecodeToAnalyze = resolved.bytecode;

    // Check cache
    const cacheKey = hashBytecode(bytecodeToAnalyze);
    if (config.analysis.cacheEnabled && analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey)!;
      return {
        status: 'success',
        data: {
          ...cached,
          token: tokenAddress,
          chain,
          is_proxy: resolved.is_proxy,
          proxy_implementation: resolved.implementation_address,
          analysis_time_ms: Date.now() - startTime,
        },
      };
    }

    // Get processed library and compare
    const library = getProcessedLibrary();
    const results = compareToLibrary(bytecodeToAnalyze, library);

    const bestMatch = results[0];
    const similarityScore = bestMatch?.similarity_score || 0;
    const matchName = bestMatch?.legend_name || 'Unknown';
    const matchCategory = bestMatch?.category || 'unknown';

    // Generate verdict and roast
    const verdict = generateVerdict(similarityScore);
    const roast = generateRoast(similarityScore);

    const analysisResult = {
      token: tokenAddress,
      chain,
      similarity_score: similarityScore,
      match_name: matchName,
      match_category: matchCategory,
      narrative_verdict: verdict,
      roast,
      is_proxy: resolved.is_proxy,
      proxy_implementation: resolved.implementation_address,
      bytecode_size: (bytecodeToAnalyze.length - 2) / 2,
      analysis_time_ms: Date.now() - startTime,
    };

    // Cache the result
    if (config.analysis.cacheEnabled) {
      analysisCache.set(cacheKey, analysisResult);
    }

    return {
      status: 'success',
      data: analysisResult,
    };

  } catch (error) {
    console.error('Analysis error:', error);
    return {
      status: 'error',
      error: {
        code: 'ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    entries: analysisCache.size,
    enabled: config.analysis.cacheEnabled,
  };
}

/**
 * Clear the cache
 */
export function clearCache() {
  analysisCache.clear();
}

export default {
  analyzeToken,
  getCacheStats,
  clearCache,
};

import { config, getRpcUrl, SupportedChain } from '../config';
import { normalizeBytecode } from '../utils/normalization';
import { resolveImplementation, fetchBytecode } from '../utils/proxy';
import { preprocessLibrary, compareToLibrary, ProcessedLegend } from '../utils/similarity';
import { generateVerdict, generateRoast, SPECIAL_VERDICTS } from '../utils/verdict';
import { analysisCache } from '../utils/cache';
import { AnalysisResponse, ErrorResponse } from '../types';

let processedLibrary: ProcessedLegend[] | null = null;

function getProcessedLibrary(): ProcessedLegend[] {
  if (!processedLibrary) {
    processedLibrary = preprocessLibrary(config.library);
  }
  return processedLibrary;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function analyzeToken(
  tokenAddress: string,
  chain: SupportedChain
): Promise<AnalysisResponse | ErrorResponse> {
  const startTime = Date.now();

  try {
    if (!ADDRESS_RE.test(tokenAddress)) {
      return {
        status: 'error',
        error: { code: 'INVALID_ADDRESS', message: 'Invalid token address format. Must be 0x followed by 40 hex characters.' },
      };
    }

    const rpcUrl = getRpcUrl(chain);
    const rawBytecode = await fetchBytecode(tokenAddress, rpcUrl);

    if (!rawBytecode || rawBytecode === '0x') {
      return {
        status: 'success',
        data: {
          token: tokenAddress, chain, similarity_score: 0,
          match_name: 'N/A', match_category: 'none',
          narrative_verdict: SPECIAL_VERDICTS.NO_CODE.verdict,
          roast: SPECIAL_VERDICTS.NO_CODE.roast,
          is_proxy: false, proxy_implementation: null,
          bytecode_size: 0, analysis_time_ms: Date.now() - startTime,
        },
      };
    }

    // Resolve proxy chain once
    const resolved = await resolveImplementation(tokenAddress, rawBytecode, rpcUrl, config.analysis.maxProxyDepth);
    const bytecodeToAnalyze = resolved.bytecode;

    // Check keccak256 cache (keyed by normalized bytecode, not address)
    const normalized = normalizeBytecode(bytecodeToAnalyze).normalized;

    if (config.analysis.cacheEnabled) {
      const cached = analysisCache.get(normalized);
      if (cached) {
        return {
          status: 'success',
          data: {
            ...cached,
            token: tokenAddress, chain,
            is_proxy: resolved.is_proxy,
            proxy_implementation: resolved.implementation_address,
            analysis_time_ms: Date.now() - startTime,
          },
        };
      }
    }

    // Compare against library
    const results = compareToLibrary(bytecodeToAnalyze, getProcessedLibrary());
    const bestMatch = results[0];
    const score = bestMatch?.similarity_score || 0;

    const analysisResult = {
      token: tokenAddress,
      chain,
      similarity_score: score,
      match_name: bestMatch?.legend_name || 'Unknown',
      match_category: bestMatch?.category || 'unknown',
      narrative_verdict: generateVerdict(score),
      roast: generateRoast(score),
      is_proxy: resolved.is_proxy,
      proxy_implementation: resolved.implementation_address,
      bytecode_size: (bytecodeToAnalyze.length - 2) / 2,
      analysis_time_ms: Date.now() - startTime,
    };

    if (config.analysis.cacheEnabled) {
      analysisCache.set(normalized, analysisResult);
    }

    return { status: 'success', data: analysisResult };

  } catch (error) {
    console.error(`Analysis failed for ${tokenAddress} on ${chain}:`, error instanceof Error ? error.message : error);
    return {
      status: 'error',
      error: { code: 'ANALYSIS_FAILED', message: error instanceof Error ? error.message : 'Unknown error occurred' },
    };
  }
}

export function getCacheStats() {
  return analysisCache.getStats();
}

export function clearCache() {
  analysisCache.clear();
}

// Legend entry from library_of_legends.json
export interface LegendEntry {
  id: string;
  name: string;
  category: string;
  source_chain: string;
  source_address: string;
  bytecode: string;
  bytecode_size: number;
  fetched_at: string;
  note: string;
}

// Normalization result
export interface NormalizationResult {
  normalized: string;
  original_size: number;
  normalized_size: number;
  metadata_stripped: number;
  addresses_masked: number;
}

// Proxy detection result
export interface ProxyDetectionResult {
  is_proxy: boolean;
  proxy_type: 'eip1167' | 'eip1967' | 'none';
  implementation_address: string | null;
}

// Similarity comparison result
export interface SimilarityResult {
  legend_id: string;
  legend_name: string;
  category: string;
  similarity_score: number;
}

// Final API response
export interface AnalysisResponse {
  status: 'success' | 'error';
  data: {
    token: string;
    chain: string;
    similarity_score: number;
    match_name: string;
    match_category: string;
    narrative_verdict: string;
    roast: string;
    is_proxy: boolean;
    proxy_implementation: string | null;
    bytecode_size: number;
    analysis_time_ms: number;
  };
}

// Error response
export interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
  };
}

// APIX402 nested request body
export interface APIX402RequestBody {
  body?: {
    token: string;
    chain: string;
  };
  token?: string;
  chain?: string;
}

import { analyzeToken, clearCache } from '../src/services/analyzer';

// Mock at the RPC boundary — not the analyzer
jest.mock('../src/utils/proxy', () => {
  const actual = jest.requireActual('../src/utils/proxy');
  return {
    ...actual,
    fetchBytecode: jest.fn(),
    resolveImplementation: jest.fn(),
  };
});

const { fetchBytecode, resolveImplementation } = require('../src/utils/proxy');

// A realistic ERC20 bytecode snippet (long enough to not be flagged as minimal)
const FAKE_BYTECODE = '0x' + '6080604052'.repeat(100);

beforeEach(() => {
  clearCache();
  jest.clearAllMocks();
});

describe('analyzeToken (integration)', () => {

  test('should reject invalid address format', async () => {
    const result = await analyzeToken('not-an-address', 'base');
    expect(result.status).toBe('error');
    expect('error' in result && result.error.code).toBe('INVALID_ADDRESS');
  });

  test('should handle no-code address', async () => {
    fetchBytecode.mockResolvedValue(null);
    const result = await analyzeToken('0x0000000000000000000000000000000000000001', 'base');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.similarity_score).toBe(0);
      expect(result.data.match_name).toBe('N/A');
      expect(result.data.bytecode_size).toBe(0);
    }
  });

  test('should run full pipeline: fetch -> resolve -> normalize -> compare -> verdict', async () => {
    fetchBytecode.mockResolvedValue(FAKE_BYTECODE);
    resolveImplementation.mockResolvedValue({
      bytecode: FAKE_BYTECODE,
      is_proxy: false,
      proxy_type: 'none',
      implementation_address: null,
      resolution_depth: 0,
    });

    const result = await analyzeToken('0x0000000000000000000000000000000000000001', 'base');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(typeof result.data.similarity_score).toBe('number');
      expect(result.data.similarity_score).toBeGreaterThanOrEqual(0);
      expect(result.data.similarity_score).toBeLessThanOrEqual(100);
      expect(typeof result.data.narrative_verdict).toBe('string');
      expect(result.data.narrative_verdict.length).toBeGreaterThan(0);
      expect(typeof result.data.roast).toBe('string');
      expect(result.data.roast.length).toBeGreaterThan(0);
      expect(typeof result.data.match_name).toBe('string');
      expect(typeof result.data.bytecode_size).toBe('number');
      expect(result.data.bytecode_size).toBeGreaterThan(0);
      expect(typeof result.data.analysis_time_ms).toBe('number');
      expect(result.data.is_proxy).toBe(false);
      expect(result.data.proxy_implementation).toBeNull();
    }
  });

  test('should report proxy when resolved', async () => {
    const implAddress = '0x0000000000000000000000000000000000000099';
    fetchBytecode.mockResolvedValue(FAKE_BYTECODE);
    resolveImplementation.mockResolvedValue({
      bytecode: FAKE_BYTECODE,
      is_proxy: true,
      proxy_type: 'eip1967',
      implementation_address: implAddress,
      resolution_depth: 1,
    });

    const result = await analyzeToken('0x0000000000000000000000000000000000000001', 'base');

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.is_proxy).toBe(true);
      expect(result.data.proxy_implementation).toBe(implAddress);
    }
  });

  test('should return cached result on second call', async () => {
    fetchBytecode.mockResolvedValue(FAKE_BYTECODE);
    resolveImplementation.mockResolvedValue({
      bytecode: FAKE_BYTECODE,
      is_proxy: false,
      proxy_type: 'none',
      implementation_address: null,
      resolution_depth: 0,
    });

    const result1 = await analyzeToken('0x0000000000000000000000000000000000000001', 'base');
    const result2 = await analyzeToken('0x0000000000000000000000000000000000000002', 'base');

    expect(result1.status).toBe('success');
    expect(result2.status).toBe('success');
    if (result1.status === 'success' && result2.status === 'success') {
      // Same bytecode -> same score from cache
      expect(result2.data.similarity_score).toBe(result1.data.similarity_score);
      expect(result2.data.match_name).toBe(result1.data.match_name);
      // But token address should reflect the second call
      expect(result2.data.token).toBe('0x0000000000000000000000000000000000000002');
    }
  });

  test('should handle RPC failure gracefully', async () => {
    fetchBytecode.mockRejectedValue(new Error('RPC timeout'));

    const result = await analyzeToken('0x0000000000000000000000000000000000000001', 'base');

    expect(result.status).toBe('error');
    expect('error' in result && result.error.code).toBe('ANALYSIS_FAILED');
  });

});

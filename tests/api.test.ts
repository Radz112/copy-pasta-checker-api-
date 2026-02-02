import request from 'supertest';

jest.mock('../src/services/analyzer', () => ({
  analyzeToken: jest.fn().mockResolvedValue({
    status: 'success',
    data: {
      token: '0x1234567890123456789012345678901234567890',
      chain: 'base',
      similarity_score: 95.5,
      match_name: 'PEPE (Original)',
      match_category: 'meme_coin',
      narrative_verdict: 'Ctrl+C Masterclass',
      roast: 'This dev did not even change the variable names.',
      is_proxy: false,
      proxy_implementation: null,
      bytecode_size: 4500,
      analysis_time_ms: 150,
    },
  }),
}));

jest.mock('../src/utils/cache', () => ({
  analysisCache: {
    getStats: jest.fn().mockReturnValue({ entries: 0, enabled: true, maxEntries: 10000, totalHits: 0 }),
  },
}));

import app from '../src/index';

describe('API Endpoints', () => {

  describe('GET /health', () => {

    test('should return health status with all fields', async () => {
      const response = await request(app).get('/health');

      expect([200, 503]).toContain(response.status);
      expect(['healthy', 'degraded']).toContain(response.body.status);
      expect(response.body.service).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.rpc).toBeDefined();
      expect(['connected', 'unreachable']).toContain(response.body.rpc);
      expect(response.body.cache).toBeDefined();
    });

  });

  describe('GET /api/v1/similarity', () => {

    test('should return 200 with endpoint info', async () => {
      const response = await request(app).get('/api/v1/similarity');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.endpoint).toBeDefined();
      expect(response.body.endpoint.method).toBe('POST');
      expect(response.body.endpoint.price_usd).toBeDefined();
      expect(response.body.endpoint.pay_to_address).toBeDefined();
      expect(response.body.endpoint.supported_chains).toBeDefined();
      expect(response.body.endpoint.request_format).toBeDefined();
      expect(response.body.endpoint.response_format).toBeDefined();
    });

  });

  describe('POST /api/v1/similarity', () => {

    test('should handle direct format { token, chain }', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({
          token: '0x1234567890123456789012345678901234567890',
          chain: 'base',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.similarity_score).toBeDefined();
    });

    test('should handle APIX402 nested format { body: { token, chain } }', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({
          body: {
            token: '0x1234567890123456789012345678901234567890',
            chain: 'base',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    test('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({ chain: 'base' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should return 400 for missing chain', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({ token: '0x1234567890123456789012345678901234567890' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CHAIN');
    });

    test('should return 400 for invalid chain', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({
          token: '0x1234567890123456789012345678901234567890',
          chain: 'solana',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CHAIN');
    });

    test('should return proper response structure', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({
          token: '0x1234567890123456789012345678901234567890',
          chain: 'base',
        });

      expect(response.body.data).toMatchObject({
        token: expect.any(String),
        chain: expect.any(String),
        similarity_score: expect.any(Number),
        match_name: expect.any(String),
        match_category: expect.any(String),
        narrative_verdict: expect.any(String),
        roast: expect.any(String),
        is_proxy: expect.any(Boolean),
        bytecode_size: expect.any(Number),
        analysis_time_ms: expect.any(Number),
      });
    });

    test('should return 404 for unknown endpoints', async () => {
      const response = await request(app).get('/api/v1/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should include rate limit headers on API routes', async () => {
      const response = await request(app)
        .post('/api/v1/similarity')
        .send({
          token: '0x1234567890123456789012345678901234567890',
          chain: 'base',
        });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

  });

});

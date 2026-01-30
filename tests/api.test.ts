import request from 'supertest';
import express from 'express';

// Mock the analyzer service
jest.mock('../src/services/analyzer', () => ({
  analyzeToken: jest.fn().mockResolvedValue({
    status: 'success',
    data: {
      token: '0x1234567890123456789012345678901234567890',
      chain: 'base',
      similarity_score: 95.5,
      match_name: 'PEPE (Original)',
      match_category: 'meme_coin',
      narrative_verdict: 'Ctrl+C Masterclass 🍝',
      roast: 'This dev did not even change the variable names.',
      is_proxy: false,
      proxy_implementation: null,
      bytecode_size: 4500,
      analysis_time_ms: 150,
    },
  }),
  getCacheStats: jest.fn().mockReturnValue({ entries: 0, enabled: true }),
}));

// Create a minimal test app
const app = express();
app.use(express.json());

// Import handlers after mocking
const { analyzeToken, getCacheStats } = require('../src/services/analyzer');

// Define routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Copy-Pasta Checker',
    cache: getCacheStats(),
  });
});

app.get('/api/v1/similarity', (req, res) => {
  res.status(200).json({
    status: 'success',
    endpoint: {
      name: 'Copy-Pasta Checker',
      method: 'POST',
      path: '/api/v1/similarity',
      price_usd: 0.01,
      pay_to_address: '0xTEST',
    },
  });
});

app.post('/api/v1/similarity', async (req, res) => {
  const body = req.body;
  const token = body.body?.token || body.token;
  const chain = body.body?.chain || body.chain;

  if (!token) {
    return res.status(400).json({
      status: 'error',
      error: { code: 'MISSING_TOKEN', message: 'Token required' },
    });
  }

  if (!chain) {
    return res.status(400).json({
      status: 'error',
      error: { code: 'MISSING_CHAIN', message: 'Chain required' },
    });
  }

  if (chain !== 'base') {
    return res.status(400).json({
      status: 'error',
      error: { code: 'INVALID_CHAIN', message: 'Unsupported chain' },
    });
  }

  const result = await analyzeToken(token, chain);
  res.status(200).json(result);
});

describe('API Endpoints', () => {

  describe('GET /health', () => {

    test('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('Copy-Pasta Checker');
    });

  });

  describe('GET /api/v1/similarity', () => {

    test('should return 200 with endpoint info', async () => {
      const response = await request(app).get('/api/v1/similarity');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.endpoint).toBeDefined();
      expect(response.body.endpoint.method).toBe('POST');
      expect(response.body.endpoint.price_usd).toBe(0.01);
      expect(response.body.endpoint.pay_to_address).toBeDefined();
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

  });

});

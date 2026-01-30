import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isValidChain } from './config';
import { analyzeToken, getCacheStats } from './services/analyzer';
import { getClient } from './utils/proxy';
import { APIX402RequestBody } from './types';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  },
});
app.use('/api/', limiter);

// Request logging middleware with duration
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${duration}ms`);
  });
  next();
});

/**
 * Health check endpoint — verifies RPC connectivity using the cached client
 */
app.get('/health', async (req: Request, res: Response) => {
  let rpcStatus: 'connected' | 'unreachable';
  try {
    await getClient(config.baseRpcUrl).getChainId();
    rpcStatus = 'connected';
  } catch {
    rpcStatus = 'unreachable';
  }

  const status = rpcStatus === 'connected' ? 'healthy' : 'degraded';
  res.status(rpcStatus === 'connected' ? 200 : 503).json({
    status,
    service: config.apix402.apiName,
    version: config.apix402.apiVersion,
    timestamp: new Date().toISOString(),
    rpc: rpcStatus,
    cache: getCacheStats(),
  });
});

/**
 * GET /api/v1/similarity
 * Returns endpoint info for APIX402 validation
 */
app.get('/api/v1/similarity', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    endpoint: {
      name: config.apix402.apiName,
      version: config.apix402.apiVersion,
      description: config.apix402.description,
      method: 'POST',
      path: '/api/v1/similarity',
      price_usd: config.apix402.priceUsd,
      pay_to_address: config.apix402.payToAddress,
      supported_chains: config.supportedChains,
      request_format: {
        token: 'string (0x-prefixed address)',
        chain: 'string (base)',
      },
      response_format: {
        status: 'success | error',
        data: {
          token: 'string',
          chain: 'string',
          similarity_score: 'number (0-100)',
          match_name: 'string',
          match_category: 'string',
          narrative_verdict: 'string',
          roast: 'string',
          is_proxy: 'boolean',
          proxy_implementation: 'string | null',
          bytecode_size: 'number',
          analysis_time_ms: 'number',
        },
      },
    },
  });
});

/**
 * POST /api/v1/similarity
 * Main analysis endpoint
 * Handles both APIX402 nested format and direct format
 */
app.post('/api/v1/similarity', async (req: Request, res: Response) => {
  try {
    const body = req.body as APIX402RequestBody;

    // Handle APIX402 nested body format: { body: { token, chain } }
    // Also handle direct format: { token, chain }
    const token = body.body?.token || body.token;
    const chain = body.body?.chain || body.chain;

    // Validate required fields
    if (!token) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token address is required. Provide as { token: "0x..." } or { body: { token: "0x..." } }',
        },
      });
    }

    if (!chain) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'MISSING_CHAIN',
          message: 'Chain is required. Supported chains: ' + config.supportedChains.join(', '),
        },
      });
    }

    // Validate chain
    if (!isValidChain(chain)) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_CHAIN',
          message: `Unsupported chain: ${chain}. Supported chains: ${config.supportedChains.join(', ')}`,
        },
      });
    }

    // Run analysis
    const result = await analyzeToken(token, chain);

    // Return appropriate status code
    if (result.status === 'error') {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Request error:', error);
    return res.status(500).json({
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
  });
});

/**
 * Error handler
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Only start the server when run directly (not imported for testing)
if (require.main === module) {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`
🍝 Copy-Pasta Checker API
========================
Version: ${config.apix402.apiVersion}
Port: ${PORT}
Environment: ${config.nodeEnv}
Pay-To Address: ${config.apix402.payToAddress}
Price: ${config.apix402.priceUsd} per call
Supported Chains: ${config.supportedChains.join(', ')}
Library Legends: ${config.library.length}

Endpoints:
  GET  /health              - Health check
  GET  /api/v1/similarity   - Endpoint info (APIX402 validation)
  POST /api/v1/similarity   - Analyze token bytecode
    `);
  });
}

export default app;

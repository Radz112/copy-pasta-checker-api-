import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, isValidChain } from './config';
import { analyzeToken } from './services/analyzer';
import { APIX402RequestBody } from './types';

const app = express();
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

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

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${Date.now() - start}ms`);
  });
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Copy-Pasta Checker',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

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

app.post('/api/v1/similarity', async (req: Request, res: Response) => {
  console.log("RAW BODY:", JSON.stringify(req.body));
  try {
    const body = req.body as APIX402RequestBody;
    let token: string | undefined;
    let chain: string | undefined;

    if (body.body?.token) {
      token = body.body.token;
      chain = body.body.chain;
    } else if (body.query && typeof body.query === 'string') {
      const params = new URLSearchParams(body.query);
      token = params.get('token') || undefined;
      chain = params.get('chain') || undefined;
    } else {
      token = body.token;
      chain = body.chain;
    }

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

    if (!isValidChain(chain)) {
      return res.status(400).json({
        status: 'error',
        error: {
          code: 'INVALID_CHAIN',
          message: `Unsupported chain: ${chain}. Supported chains: ${config.supportedChains.join(', ')}`,
        },
      });
    }

    const result = await analyzeToken(token, chain);

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

app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
  });
});

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

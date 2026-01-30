# Copy-Pasta Checker API 🍝

The Laziness Detector - Exposes copy-paste token launches by comparing bytecode against the Library of Legends.

## Quick Start
```bash
# Install dependencies
npm install

# Fetch Library of Legends (run once)
npm run fetch-legends

# Start development server
npm run dev

# Run tests
npm test
```

## Configuration

Create a `.env` file:
```bash
# RPC Endpoints
BASE_RPC_URL=https://mainnet.base.org

# Server
PORT=3000
NODE_ENV=development

# APIX402
APIX402_PAY_TO_ADDRESS=0xYOUR_WALLET_ADDRESS
API_PRICE_USD=0.01
```

## API Endpoints

### GET /health
Health check endpoint.

### GET /api/v1/similarity
Returns endpoint info for APIX402 validation.

### POST /api/v1/similarity
Analyzes token bytecode for similarity.

**Request (Direct):**
```json
{
  "token": "0x...",
  "chain": "base"
}
```

**Request (APIX402 Nested):**
```json
{
  "body": {
    "token": "0x...",
    "chain": "base"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "token": "0x...",
    "chain": "base",
    "similarity_score": 95.5,
    "match_name": "PEPE (Original)",
    "match_category": "meme_coin",
    "narrative_verdict": "Ctrl+C Masterclass 🍝",
    "roast": "This dev didn't even change the variable names.",
    "is_proxy": false,
    "proxy_implementation": null,
    "bytecode_size": 4500,
    "analysis_time_ms": 150
  }
}
```

## APIX402 Registration

1. Deploy API to production
2. Visit https://apix402.fun
3. Register new API:
   - Name: Copy-Pasta Checker
   - Endpoint: `https://your-domain.com/api/v1/similarity`
   - Price: $0.01
   - Pay-To Address: Your wallet

## Testing
```bash
# All tests
npm test

# By phase
npm run test:phase1  # Normalization
npm run test:phase2  # Proxy detection
npm run test:phase3  # Similarity
npm run test:phase4  # Verdict
npm run test:phase5  # API
```

## Deployment

### Docker
```bash
npm run build
docker build -t copy-pasta-checker .
docker run -p 3000:3000 --env-file .env copy-pasta-checker
```

### Render
Push to a Git repo connected to Render. The `render.yaml` blueprint handles the rest.
Set `BASE_RPC_URL` and `APIX402_PAY_TO_ADDRESS` as secret environment variables in the Render dashboard.

## License

MIT

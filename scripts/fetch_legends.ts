import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const client = createPublicClient({
  chain: mainnet,
  transport: http(), // Uses public RPC - replace with paid RPC for production
});

// The "Legends" - Original contracts we want to catch copies of
const LEGENDS = [
  {
    name: "PEPE (Original)",
    category: "meme_coin",
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    note: "The classic tax-free meme token pattern"
  },
  {
    name: "Uniswap V2 Router",
    category: "router",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    note: "Standard router used by 99% of DEX clones"
  },
  {
    name: "SafeMoon (Ethereum)",
    category: "reflect_token",
    address: "0xc63E6bccd96fC0a777524BeCC8ee1fa049Bf81c5",
    note: "SafeMoon reflect/tax token pattern on Ethereum"
  },
  {
    name: "WETH (Standard ERC20)",
    category: "token_standard",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    note: "Standard 1:1 wrapped implementation"
  },
  {
    name: "OpenZeppelin ERC20",
    category: "token_standard",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC as reference
    note: "Standard OpenZeppelin ERC20 implementation"
  }
];

const OUTPUT_PATH = path.join(__dirname, '../src/config/library_of_legends.json');

// --- TYPES ---
interface LegendEntry {
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

// --- LOGIC ---
async function fetchLegends(): Promise<void> {
  console.log("🍝 Fetching Bytecode for Library of Legends...\n");

  const library: LegendEntry[] = [];

  for (const legend of LEGENDS) {
    process.stdout.write(`Fetching ${legend.name}... `);

    try {
      const bytecode = await client.getBytecode({
        address: legend.address as `0x${string}`
      });

      if (!bytecode || bytecode === '0x') {
        console.log("❌ Failed (No code found)");
        continue;
      }

      const id = legend.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[()]/g, '');

      library.push({
        id,
        name: legend.name,
        category: legend.category,
        source_chain: "ethereum_mainnet",
        source_address: legend.address,
        bytecode: bytecode,
        bytecode_size: (bytecode.length - 2) / 2, // Subtract '0x', divide by 2 for bytes
        fetched_at: new Date().toISOString(),
        note: legend.note
      });

      console.log(`✅ Done (${(bytecode.length - 2) / 2} bytes)`);

    } catch (error) {
      console.log(`❌ Error: ${(error as Error).message}`);
    }
  }

  // Ensure directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Save to JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(library, null, 2));

  console.log(`\n🎉 Library saved to: ${OUTPUT_PATH}`);
  console.log(`📚 Total Legends: ${library.length}`);
}

fetchLegends().catch(console.error);

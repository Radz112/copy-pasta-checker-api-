import dotenv from 'dotenv';
import { LegendEntry } from '../types';

dotenv.config();

let libraryOfLegends: LegendEntry[] = [];
try {
  libraryOfLegends = require('./library_of_legends.json');
} catch {
  console.warn('Warning: library_of_legends.json not found. Run npm run fetch-legends first.');
}

function cleanEnv(value: string | undefined, fallback: string): string {
  return (value || fallback).trim().replace(/^=/, '');
}

export const config = {
  port: parseInt(cleanEnv(process.env.PORT, '3000'), 10),
  nodeEnv: cleanEnv(process.env.NODE_ENV, 'development'),

  baseRpcUrl: cleanEnv(process.env.BASE_RPC_URL, 'https://mainnet.base.org'),
  ethereumRpcUrl: cleanEnv(process.env.ETHEREUM_RPC_URL, 'https://eth.llamarpc.com'),

  apix402: {
    payToAddress: cleanEnv(process.env.APIX402_PAY_TO_ADDRESS, '0xYOUR_WALLET_ADDRESS_HERE'),
    priceUsd: parseFloat(process.env.API_PRICE_USD || '0.01'),
    apiName: 'Copy-Pasta Checker',
    apiVersion: '1.0.0',
    description: 'The Laziness Detector - Exposes copy-paste token launches by comparing bytecode against Library of Legends',
  },

  supportedChains: ['base', 'ethereum'] as const,

  maxProxyDepth: 3,

  library: libraryOfLegends,
};

export type SupportedChain = typeof config.supportedChains[number];

export function isValidChain(chain: string): chain is SupportedChain {
  return config.supportedChains.includes(chain as SupportedChain);
}

export function getRpcUrl(chain: SupportedChain): string {
  switch (chain) {
    case 'ethereum':
      return config.ethereumRpcUrl;
    case 'base':
    default:
      return config.baseRpcUrl;
  }
}

import { createPublicClient, http, getAddress, Hex } from 'viem';
import { base } from 'viem/chains';
import { ProxyDetectionResult } from '../types';

/**
 * EIP-1967 Implementation Slot
 * keccak256("eip1967.proxy.implementation") - 1
 */
const EIP1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;

/**
 * EIP-1167 Minimal Proxy bytecode patterns
 * These are the standard clone factory patterns
 */
const EIP1167_PATTERNS = {
  // Standard EIP-1167 prefix (before target address)
  PREFIX: '363d3d373d3d3d363d73',
  // Standard EIP-1167 suffix (after target address)
  SUFFIX: '5af43d82803e903d91602b57fd5bf3',
  // Full length of minimal proxy bytecode (in hex chars, without 0x)
  FULL_LENGTH: 90, // 45 bytes
} as const;

/**
 * Alternative clone patterns used by some factories
 */
const CLONE_PATTERNS = [
  // OpenZeppelin Clones
  '363d3d373d3d3d363d73',
  // Optionality clone
  '363d3d373d3d3d3d60368038038091363936013d73',
] as const;

/**
 * Creates a Viem client for the specified chain
 */
function getClient(rpcUrl?: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl || process.env.BASE_RPC_URL),
  });
}

/**
 * Detects if bytecode is an EIP-1167 Minimal Proxy (Clone)
 *
 * EIP-1167 proxies have a standard bytecode format:
 * 363d3d373d3d3d363d73[20-byte-address]5af43d82803e903d91602b57fd5bf3
 *
 * @param bytecode - Raw bytecode hex string
 * @returns Implementation address if detected, null otherwise
 */
export function detectEIP1167(bytecode: string): string | null {
  const code = bytecode.toLowerCase().replace('0x', '');

  // Check for standard EIP-1167 pattern
  if (code.startsWith(EIP1167_PATTERNS.PREFIX)) {
    // Extract the 20-byte (40 hex char) implementation address
    const addressStart = EIP1167_PATTERNS.PREFIX.length;
    const addressEnd = addressStart + 40;

    if (code.length >= addressEnd) {
      const addressHex = code.slice(addressStart, addressEnd);

      // Verify suffix if bytecode is complete
      const expectedSuffix = code.slice(addressEnd);
      if (expectedSuffix.startsWith(EIP1167_PATTERNS.SUFFIX.toLowerCase()) ||
          code.length === EIP1167_PATTERNS.FULL_LENGTH) {
        try {
          return getAddress(`0x${addressHex}`);
        } catch {
          return null;
        }
      }
    }
  }

  // Check alternative clone patterns
  for (const pattern of CLONE_PATTERNS) {
    const idx = code.indexOf(pattern.toLowerCase());
    if (idx !== -1) {
      const addressStart = idx + pattern.length;
      const addressEnd = addressStart + 40;
      if (code.length >= addressEnd) {
        try {
          return getAddress(`0x${code.slice(addressStart, addressEnd)}`);
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

/**
 * Detects if contract is an EIP-1967 Transparent/UUPS Proxy
 * by reading the implementation storage slot
 *
 * @param address - Contract address to check
 * @param rpcUrl - Optional RPC URL
 * @returns Implementation address if detected, null otherwise
 */
export async function detectEIP1967(
  address: string,
  rpcUrl?: string
): Promise<string | null> {
  const client = getClient(rpcUrl);

  try {
    const implementationSlot = await client.getStorageAt({
      address: address as `0x${string}`,
      slot: EIP1967_IMPLEMENTATION_SLOT,
    });

    if (!implementationSlot || implementationSlot === '0x' + '0'.repeat(64)) {
      return null;
    }

    // Extract address from the 32-byte slot value (last 20 bytes)
    const addressHex = '0x' + implementationSlot.slice(-40);

    // Verify it's not zero address
    if (addressHex === '0x' + '0'.repeat(40)) {
      return null;
    }

    return getAddress(addressHex);
  } catch (error) {
    console.error('EIP-1967 detection error:', error);
    return null;
  }
}

/**
 * Quick heuristic check for proxy patterns in bytecode
 * Used as a fast pre-filter before more expensive RPC calls
 */
export function hasProxyCharacteristics(bytecode: string): boolean {
  const code = bytecode.toLowerCase().replace('0x', '');

  // Very short bytecode is suspicious
  if (code.length < 400) { // < 200 bytes
    return true;
  }

  // Contains DELEGATECALL (0xf4)
  if (code.includes('f4')) {
    // Additional heuristic: DELEGATECALL near the start suggests proxy
    const firstDelegateCall = code.indexOf('f4');
    if (firstDelegateCall < 200) { // Within first 100 bytes
      return true;
    }
  }

  // Starts with common proxy patterns
  const proxyPrefixes = [
    '363d3d37', // EIP-1167
    '3660', // Some proxy variants
    '366000', // Minimal proxy variants
  ];

  return proxyPrefixes.some(prefix => code.startsWith(prefix));
}

/**
 * Main proxy detection function
 * Attempts to detect and resolve proxy implementations
 *
 * @param address - Contract address
 * @param bytecode - Contract bytecode
 * @param rpcUrl - Optional RPC URL
 * @returns Proxy detection result
 */
export async function detectProxy(
  address: string,
  bytecode: string,
  rpcUrl?: string
): Promise<ProxyDetectionResult> {
  // First, check for EIP-1167 (can be done from bytecode alone)
  const eip1167Impl = detectEIP1167(bytecode);
  if (eip1167Impl) {
    return {
      is_proxy: true,
      proxy_type: 'eip1167',
      implementation_address: eip1167Impl,
    };
  }

  // If bytecode has proxy characteristics, check EIP-1967
  if (hasProxyCharacteristics(bytecode)) {
    const eip1967Impl = await detectEIP1967(address, rpcUrl);
    if (eip1967Impl) {
      return {
        is_proxy: true,
        proxy_type: 'eip1967',
        implementation_address: eip1967Impl,
      };
    }
  }

  return {
    is_proxy: false,
    proxy_type: 'none',
    implementation_address: null,
  };
}

/**
 * Fetches bytecode for an address
 */
export async function fetchBytecode(
  address: string,
  rpcUrl?: string
): Promise<string | null> {
  const client = getClient(rpcUrl);

  try {
    const bytecode = await client.getBytecode({
      address: address as `0x${string}`,
    });
    return bytecode || null;
  } catch (error) {
    console.error('Bytecode fetch error:', error);
    return null;
  }
}

/**
 * Resolves proxy to implementation bytecode
 * Returns original bytecode if not a proxy
 *
 * @param address - Contract address
 * @param bytecode - Contract bytecode
 * @param rpcUrl - Optional RPC URL
 * @param maxDepth - Maximum proxy resolution depth (prevents infinite loops)
 */
export async function resolveImplementation(
  address: string,
  bytecode: string,
  rpcUrl?: string,
  maxDepth: number = 3
): Promise<{
  bytecode: string;
  is_proxy: boolean;
  proxy_type: 'eip1167' | 'eip1967' | 'none';
  implementation_address: string | null;
  resolution_depth: number;
}> {
  let currentBytecode = bytecode;
  let currentAddress = address;
  let depth = 0;
  let proxyResult: ProxyDetectionResult = {
    is_proxy: false,
    proxy_type: 'none',
    implementation_address: null,
  };

  while (depth < maxDepth) {
    const detection = await detectProxy(currentAddress, currentBytecode, rpcUrl);

    if (!detection.is_proxy || !detection.implementation_address) {
      break;
    }

    proxyResult = detection;
    depth++;

    // Fetch implementation bytecode
    const implBytecode = await fetchBytecode(detection.implementation_address, rpcUrl);
    if (!implBytecode || implBytecode === '0x') {
      break;
    }

    currentBytecode = implBytecode;
    currentAddress = detection.implementation_address;
  }

  return {
    bytecode: currentBytecode,
    is_proxy: proxyResult.is_proxy,
    proxy_type: proxyResult.proxy_type,
    implementation_address: proxyResult.implementation_address,
    resolution_depth: depth,
  };
}

export default {
  detectEIP1167,
  detectEIP1967,
  detectProxy,
  fetchBytecode,
  resolveImplementation,
  hasProxyCharacteristics,
};

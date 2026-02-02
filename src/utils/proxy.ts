import { createPublicClient, http, getAddress, Hex } from 'viem';
import { ProxyDetectionResult } from '../types';
import { config } from '../config';

interface RpcClient {
  getStorageAt(args: { address: `0x${string}`; slot: Hex }): Promise<Hex | undefined>;
  getBytecode(args: { address: `0x${string}` }): Promise<`0x${string}` | undefined>;
  getChainId(): Promise<number>;
}

const EIP1967_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;

const ZERO_ADDR = '0x' + '0'.repeat(40);
const ZERO_SLOT = '0x' + '0'.repeat(64);

const EIP1167 = {
  PREFIX: '363d3d373d3d3d363d73',
  SUFFIX: '5af43d82803e903d91602b57fd5bf3',
  FULL_LENGTH: 90,
} as const;

const ALT_CLONE_PATTERN = '363d3d373d3d3d3d60368038038091363936013d73';

const PROXY_PREFIXES = ['363d3d37', '3660', '366000'] as const;

const clientCache = new Map<string, RpcClient>();

export function getClient(rpcUrl?: string): RpcClient {
  const url = rpcUrl || config.baseRpcUrl;
  let client = clientCache.get(url);
  if (!client) {
    client = createPublicClient({ transport: http(url) }) as unknown as RpcClient;
    clientCache.set(url, client);
  }
  return client;
}

function extractAddress(hex: string, start: number): string | null {
  if (hex.length < start + 40) return null;
  return getAddress(`0x${hex.slice(start, start + 40)}`);
}

export function detectEIP1167(bytecode: string): string | null {
  const code = bytecode.toLowerCase().replace('0x', '');

  if (code.startsWith(EIP1167.PREFIX)) {
    const addrEnd = EIP1167.PREFIX.length + 40;
    if (code.length >= addrEnd) {
      const suffix = code.slice(addrEnd);
      if (suffix.startsWith(EIP1167.SUFFIX) || code.length === EIP1167.FULL_LENGTH) {
        return extractAddress(code, EIP1167.PREFIX.length);
      }
    }
  }

  const idx = code.indexOf(ALT_CLONE_PATTERN);
  if (idx !== -1) {
    return extractAddress(code, idx + ALT_CLONE_PATTERN.length);
  }

  return null;
}

export async function detectEIP1967(address: string, rpcUrl?: string): Promise<string | null> {
  const slot = await getClient(rpcUrl).getStorageAt({
    address: address as `0x${string}`,
    slot: EIP1967_SLOT,
  });

  if (!slot || slot === ZERO_SLOT) return null;

  const addr = '0x' + slot.slice(-40);
  if (addr === ZERO_ADDR) return null;

  return getAddress(addr);
}

export function hasProxyCharacteristics(bytecode: string): boolean {
  const code = bytecode.toLowerCase().replace('0x', '');

  if (code.length < 400) return true;
  if (PROXY_PREFIXES.some(p => code.startsWith(p))) return true;

  const buf = Buffer.from(code.slice(0, 200), 'hex');
  let i = 0;
  while (i < buf.length) {
    const op = buf[i];
    if (op === 0xf4) return true;
    if (op >= 0x60 && op <= 0x7f) {
      i += 1 + (op - 0x60 + 1);
      continue;
    }
    i++;
  }

  return false;
}

export async function detectProxy(
  address: string,
  bytecode: string,
  rpcUrl?: string
): Promise<ProxyDetectionResult> {
  const eip1167Impl = detectEIP1167(bytecode);
  if (eip1167Impl) {
    return { is_proxy: true, proxy_type: 'eip1167', implementation_address: eip1167Impl };
  }

  if (hasProxyCharacteristics(bytecode)) {
    const eip1967Impl = await detectEIP1967(address, rpcUrl);
    if (eip1967Impl) {
      return { is_proxy: true, proxy_type: 'eip1967', implementation_address: eip1967Impl };
    }
  }

  return { is_proxy: false, proxy_type: 'none', implementation_address: null };
}

export async function fetchBytecode(address: string, rpcUrl?: string): Promise<string | null> {
  const bytecode = await getClient(rpcUrl).getBytecode({ address: address as `0x${string}` });
  return bytecode || null;
}

export async function resolveImplementation(
  address: string,
  bytecode: string,
  rpcUrl?: string,
  maxDepth: number = 5
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
  let lastProxy: ProxyDetectionResult = { is_proxy: false, proxy_type: 'none', implementation_address: null };

  while (depth < maxDepth) {
    let detection: ProxyDetectionResult;
    try {
      detection = await detectProxy(currentAddress, currentBytecode, rpcUrl);
    } catch (error) {
      console.warn('Proxy detection failed at depth', depth, error instanceof Error ? error.message : error);
      break;
    }
    if (!detection.is_proxy || !detection.implementation_address) break;

    lastProxy = detection;
    depth++;

    let implBytecode: string | null;
    try {
      implBytecode = await fetchBytecode(detection.implementation_address, rpcUrl);
    } catch (error) {
      console.warn('Implementation fetch failed at depth', depth, error instanceof Error ? error.message : error);
      break;
    }
    if (!implBytecode || implBytecode === '0x') break;

    currentBytecode = implBytecode;
    currentAddress = detection.implementation_address;
  }

  return {
    bytecode: currentBytecode,
    is_proxy: lastProxy.is_proxy,
    proxy_type: lastProxy.proxy_type,
    implementation_address: lastProxy.implementation_address,
    resolution_depth: depth,
  };
}

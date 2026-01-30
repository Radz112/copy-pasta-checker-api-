import { NormalizationResult } from '../types';

/**
 * EVM Opcodes we care about for address masking
 */
const OPCODES = {
  PUSH20: 0x73,  // Pushes 20 bytes (address) onto stack
  PUSH32: 0x7f,  // Pushes 32 bytes onto stack (sometimes contains addresses)
} as const;

/**
 * Known metadata patterns (CBOR encoded)
 * - Solc metadata starts with 0xa264 (ipfs) or 0xa265 (bzzr)
 * - Ends with 0x0033 (solc version marker)
 */
const METADATA_PATTERNS = {
  SOLC_CBOR_PREFIX: ['a264', 'a265'],
  SOLC_SUFFIX: '0033',
} as const;

/**
 * Strips the '0x' prefix from a hex string if present
 */
function stripHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/**
 * Converts a hex string to a Buffer for byte-level manipulation
 */
function hexToBuffer(hex: string): Buffer {
  return Buffer.from(stripHexPrefix(hex), 'hex');
}

/**
 * Converts a Buffer back to a hex string (without 0x prefix)
 */
function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}

/**
 * Strips CBOR-encoded metadata from the end of bytecode
 *
 * Solidity compiler appends metadata in CBOR format:
 * - Last 2 bytes = length of CBOR data (big-endian uint16)
 * - The CBOR data contains ipfs/swarm hash and solc version
 *
 * @param bytecode - Raw bytecode buffer
 * @returns Bytecode with metadata stripped
 */
function stripMetadata(bytecode: Buffer): { stripped: Buffer; bytesRemoved: number } {
  if (bytecode.length < 2) {
    return { stripped: bytecode, bytesRemoved: 0 };
  }

  // Read last 2 bytes as big-endian uint16 (CBOR length)
  const cborLength = bytecode.readUInt16BE(bytecode.length - 2);

  // Sanity check: CBOR length should be reasonable (< 200 bytes typically)
  // and should not exceed bytecode length
  if (cborLength > 0 && cborLength < 200 && cborLength + 2 <= bytecode.length) {
    // Verify it looks like CBOR metadata by checking for known prefixes
    const metadataStart = bytecode.length - 2 - cborLength;
    const metadataHex = bytecode.slice(metadataStart, metadataStart + 2).toString('hex');

    if (METADATA_PATTERNS.SOLC_CBOR_PREFIX.some(prefix => metadataHex.startsWith(prefix))) {
      // Valid metadata found - strip it
      const stripped = bytecode.slice(0, metadataStart);
      return { stripped, bytesRemoved: cborLength + 2 };
    }
  }

  // Fallback: Try to find metadata by pattern matching
  const hexStr = bufferToHex(bytecode);

  for (const prefix of METADATA_PATTERNS.SOLC_CBOR_PREFIX) {
    const lastIndex = hexStr.lastIndexOf(prefix);
    if (lastIndex !== -1 && hexStr.endsWith(METADATA_PATTERNS.SOLC_SUFFIX)) {
      const stripped = Buffer.from(hexStr.slice(0, lastIndex), 'hex');
      return { stripped, bytesRemoved: (hexStr.length - lastIndex) / 2 };
    }
  }

  return { stripped: bytecode, bytesRemoved: 0 };
}

/**
 * Masks all hardcoded addresses in bytecode with zeros
 *
 * This enables fuzzy matching where two contracts with identical logic
 * but different hardcoded addresses (owner, router, etc.) will match.
 *
 * Targets PUSH20 opcode (0x73) which pushes 20-byte addresses onto stack.
 *
 * @param bytecode - Bytecode buffer (metadata already stripped)
 * @returns Masked bytecode and count of addresses masked
 */
function maskAddresses(bytecode: Buffer): { masked: Buffer; addressesMasked: number } {
  const masked = Buffer.from(bytecode); // Clone to avoid mutation
  let addressesMasked = 0;
  let i = 0;

  while (i < masked.length) {
    const opcode = masked[i];

    if (opcode === OPCODES.PUSH20) {
      // Next 20 bytes are an address - mask them with zeros
      if (i + 20 < masked.length) {
        for (let j = 1; j <= 20; j++) {
          masked[i + j] = 0x00;
        }
        addressesMasked++;
        i += 21; // Skip opcode + 20 bytes
        continue;
      }
    }

    // Handle other PUSH operations to skip their data correctly
    // PUSH1 (0x60) to PUSH32 (0x7f)
    if (opcode >= 0x60 && opcode <= 0x7f) {
      const pushSize = opcode - 0x60 + 1;
      i += 1 + pushSize;
      continue;
    }

    i++;
  }

  return { masked, addressesMasked };
}

/**
 * Main normalization function
 *
 * Transforms raw bytecode into a normalized form suitable for comparison:
 * 1. Strips metadata (IPFS/Swarm hashes, solc version)
 * 2. Masks hardcoded addresses with zeros
 *
 * @param rawHex - Raw bytecode hex string (with or without 0x prefix)
 * @returns Normalized bytecode and statistics
 */
export function normalizeBytecode(rawHex: string): NormalizationResult {
  // Handle empty or invalid input
  if (!rawHex || rawHex === '0x' || rawHex === '') {
    return {
      normalized: '',
      original_size: 0,
      normalized_size: 0,
      metadata_stripped: 0,
      addresses_masked: 0,
    };
  }

  const originalBuffer = hexToBuffer(rawHex);
  const originalSize = originalBuffer.length;

  // Step 1: Strip CBOR metadata
  const { stripped, bytesRemoved } = stripMetadata(originalBuffer);

  // Step 2: Mask addresses
  const { masked, addressesMasked } = maskAddresses(stripped);

  const normalizedHex = bufferToHex(masked);

  return {
    normalized: normalizedHex,
    original_size: originalSize,
    normalized_size: masked.length,
    metadata_stripped: bytesRemoved,
    addresses_masked: addressesMasked,
  };
}

/**
 * Quick check if bytecode is too small to be meaningful
 * Very small bytecode is often a proxy or placeholder
 */
export function isBytecodeMinimal(bytecode: string): boolean {
  const stripped = stripHexPrefix(bytecode);
  return stripped.length / 2 < 200; // Less than 200 bytes
}

/**
 * Check if bytecode contains DELEGATECALL opcode
 * Indicator of proxy pattern
 */
export function containsDelegateCall(bytecode: string): boolean {
  const stripped = stripHexPrefix(bytecode).toLowerCase();
  // DELEGATECALL opcode is 0xf4
  return stripped.includes('f4');
}

export default {
  normalizeBytecode,
  isBytecodeMinimal,
  containsDelegateCall,
};

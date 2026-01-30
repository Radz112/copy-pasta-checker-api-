import { NormalizationResult } from '../types';

const PUSH20 = 0x73;

const CBOR_PREFIXES = ['a264', 'a265'] as const;
const CBOR_SUFFIX = '0033';

function stripHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/**
 * Strips CBOR-encoded metadata from the end of bytecode.
 * Last 2 bytes encode the CBOR length as big-endian uint16.
 */
function stripMetadata(bytecode: Buffer): { stripped: Buffer; bytesRemoved: number } {
  if (bytecode.length < 2) {
    return { stripped: bytecode, bytesRemoved: 0 };
  }

  const cborLength = bytecode.readUInt16BE(bytecode.length - 2);

  if (cborLength > 0 && cborLength < 200 && cborLength + 2 <= bytecode.length) {
    const metadataStart = bytecode.length - 2 - cborLength;
    const metadataHex = bytecode.slice(metadataStart, metadataStart + 2).toString('hex');

    if (CBOR_PREFIXES.some(prefix => metadataHex.startsWith(prefix))) {
      return { stripped: bytecode.slice(0, metadataStart), bytesRemoved: cborLength + 2 };
    }
  }

  // Fallback: pattern match for known CBOR structure
  const hexStr = bytecode.toString('hex');
  for (const prefix of CBOR_PREFIXES) {
    const lastIndex = hexStr.lastIndexOf(prefix);
    if (lastIndex !== -1 && hexStr.endsWith(CBOR_SUFFIX)) {
      return {
        stripped: Buffer.from(hexStr.slice(0, lastIndex), 'hex'),
        bytesRemoved: (hexStr.length - lastIndex) / 2,
      };
    }
  }

  return { stripped: bytecode, bytesRemoved: 0 };
}

/**
 * Masks all PUSH20 (0x73) address operands with zeros.
 * Correctly skips PUSH1-PUSH32 operand data to avoid false matches.
 */
function maskAddresses(bytecode: Buffer): { masked: Buffer; addressesMasked: number } {
  const masked = Buffer.from(bytecode);
  let addressesMasked = 0;
  let i = 0;

  while (i < masked.length) {
    const opcode = masked[i];

    if (opcode === PUSH20 && i + 20 < masked.length) {
      for (let j = 1; j <= 20; j++) masked[i + j] = 0x00;
      addressesMasked++;
      i += 21;
      continue;
    }

    // Skip PUSH1 (0x60) through PUSH32 (0x7f) operand bytes
    if (opcode >= 0x60 && opcode <= 0x7f) {
      i += 1 + (opcode - 0x60 + 1);
      continue;
    }

    i++;
  }

  return { masked, addressesMasked };
}

/**
 * Normalizes bytecode for comparison:
 * 1. Strips CBOR metadata (IPFS/Swarm hashes, solc version)
 * 2. Masks hardcoded addresses (PUSH20) with zeros
 */
export function normalizeBytecode(rawHex: string): NormalizationResult {
  if (!rawHex || rawHex === '0x') {
    return { normalized: '', original_size: 0, normalized_size: 0, metadata_stripped: 0, addresses_masked: 0 };
  }

  const originalBuffer = Buffer.from(stripHexPrefix(rawHex), 'hex');
  const { stripped, bytesRemoved } = stripMetadata(originalBuffer);
  const { masked, addressesMasked } = maskAddresses(stripped);

  return {
    normalized: masked.toString('hex'),
    original_size: originalBuffer.length,
    normalized_size: masked.length,
    metadata_stripped: bytesRemoved,
    addresses_masked: addressesMasked,
  };
}

export function isBytecodeMinimal(bytecode: string): boolean {
  return stripHexPrefix(bytecode).length / 2 < 200;
}

/**
 * Walks EVM opcodes to detect DELEGATECALL (0xf4).
 * Properly skips PUSH1-PUSH32 operand data to avoid false matches.
 */
export function containsDelegateCall(bytecode: string): boolean {
  const hex = stripHexPrefix(bytecode).toLowerCase();
  const buf = Buffer.from(hex, 'hex');
  let i = 0;

  while (i < buf.length) {
    const op = buf[i];
    if (op === 0xf4) return true;

    // Skip PUSH1 (0x60) through PUSH32 (0x7f) operand bytes
    if (op >= 0x60 && op <= 0x7f) {
      i += 1 + (op - 0x60 + 1);
      continue;
    }

    i++;
  }

  return false;
}

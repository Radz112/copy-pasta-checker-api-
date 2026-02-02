const PUSH20 = 0x73;

const CBOR_PREFIXES = ['a264', 'a265'] as const;
const CBOR_SUFFIX = '0033';

function stripHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/** Last 2 bytes encode the CBOR length as big-endian uint16. */
function stripMetadata(bytecode: Buffer): Buffer {
  if (bytecode.length < 2) return bytecode;

  const cborLength = bytecode.readUInt16BE(bytecode.length - 2);

  if (cborLength > 0 && cborLength < 200 && cborLength + 2 <= bytecode.length) {
    const metadataStart = bytecode.length - 2 - cborLength;
    const metadataHex = bytecode.slice(metadataStart, metadataStart + 2).toString('hex');

    if (CBOR_PREFIXES.some(prefix => metadataHex.startsWith(prefix))) {
      return bytecode.slice(0, metadataStart);
    }
  }

  // Fallback: pattern match for known CBOR structure
  const hexStr = bytecode.toString('hex');
  for (const prefix of CBOR_PREFIXES) {
    const lastIndex = hexStr.lastIndexOf(prefix);
    if (lastIndex !== -1 && hexStr.endsWith(CBOR_SUFFIX)) {
      return Buffer.from(hexStr.slice(0, lastIndex), 'hex');
    }
  }

  return bytecode;
}

/** Masks PUSH20 (0x73) address operands with zeros, skipping PUSHn operand data. */
function maskAddresses(bytecode: Buffer): Buffer {
  const masked = Buffer.from(bytecode);
  let i = 0;

  while (i < masked.length) {
    const opcode = masked[i];

    if (opcode === PUSH20 && i + 20 < masked.length) {
      for (let j = 1; j <= 20; j++) masked[i + j] = 0x00;
      i += 21;
      continue;
    }

    // Skip PUSH1–PUSH32 operand bytes
    if (opcode >= 0x60 && opcode <= 0x7f) {
      i += 1 + (opcode - 0x60 + 1);
      continue;
    }

    i++;
  }

  return masked;
}

export function normalizeBytecode(rawHex: string): string {
  if (!rawHex || rawHex === '0x') return '';

  const buf = Buffer.from(stripHexPrefix(rawHex), 'hex');
  return maskAddresses(stripMetadata(buf)).toString('hex');
}

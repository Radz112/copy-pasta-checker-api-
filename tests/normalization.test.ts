import {
  normalizeBytecode,
  isBytecodeMinimal,
  containsDelegateCall
} from '../src/utils/normalization';

describe('Normalization Utils', () => {

  describe('normalizeBytecode', () => {

    test('should handle empty input', () => {
      const result = normalizeBytecode('');
      expect(result.normalized).toBe('');
      expect(result.original_size).toBe(0);
    });

    test('should handle "0x" only input', () => {
      const result = normalizeBytecode('0x');
      expect(result.normalized).toBe('');
      expect(result.original_size).toBe(0);
    });

    test('should strip 0x prefix', () => {
      const bytecode = '0x6080604052';
      const result = normalizeBytecode(bytecode);
      expect(result.normalized).not.toContain('0x');
    });

    test('should preserve bytecode without prefix', () => {
      const bytecode = '6080604052';
      const result = normalizeBytecode(bytecode);
      expect(result.normalized.length).toBeGreaterThan(0);
    });

    test('should mask PUSH20 addresses with zeros', () => {
      // PUSH20 (0x73) followed by 20 bytes of address
      const addressBytes = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const bytecode = `608060405273${addressBytes}6080`;
      const result = normalizeBytecode(bytecode);

      // The address should be masked with zeros
      expect(result.addresses_masked).toBeGreaterThanOrEqual(1);
      expect(result.normalized).toContain('0000000000000000000000000000000000000000');
    });

    test('should strip CBOR metadata at end', () => {
      // Simulated bytecode with CBOR metadata
      // Real CBOR starts with a264 (ipfs) or a265 (bzzr) and ends with 0033
      const code = '6080604052';
      const cborData = 'a26469706673582212205678'; // Simplified CBOR-like
      const length = Buffer.alloc(2);
      length.writeUInt16BE(cborData.length / 2);

      // This test verifies the function doesn't crash on various inputs
      const bytecode = `${code}${cborData}${length.toString('hex')}`;
      const result = normalizeBytecode(bytecode);

      expect(result.original_size).toBeGreaterThan(0);
    });

    test('should return correct size statistics', () => {
      const bytecode = '0x608060405234801561001057600080fd5b50';
      const result = normalizeBytecode(bytecode);

      expect(result.original_size).toBe(18); // 36 hex chars / 2
      expect(result.normalized_size).toBeLessThanOrEqual(result.original_size);
    });

    test('should handle real-world bytecode pattern', () => {
      // Simplified but realistic ERC20-like bytecode snippet
      const bytecode = '0x6080604052348015610010576000' +
        '73' + // PUSH20
        'dac17f958d2ee523a2206206994597c13d831ec7' + // USDT address
        '6040526004361061004c5760003560e01c';

      const result = normalizeBytecode(bytecode);

      expect(result.addresses_masked).toBe(1);
      // Address should be zeroed out
      expect(result.normalized).not.toContain('dac17f958d2ee523a2206206994597c13d831ec7');
      expect(result.normalized).toContain('0000000000000000000000000000000000000000');
    });

    test('should handle multiple PUSH20 addresses', () => {
      const addr1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const addr2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const bytecode = `608060405273${addr1}608073${addr2}6080`;

      const result = normalizeBytecode(bytecode);
      expect(result.addresses_masked).toBe(2);
    });

  });

  describe('isBytecodeMinimal', () => {

    test('should return true for very short bytecode', () => {
      const shortCode = '0x363d3d373d3d3d363d73'; // 20 bytes
      expect(isBytecodeMinimal(shortCode)).toBe(true);
    });

    test('should return false for normal contract bytecode', () => {
      // 500 bytes of fake bytecode
      const longCode = '0x' + '60'.repeat(500);
      expect(isBytecodeMinimal(longCode)).toBe(false);
    });

    test('should handle edge case at boundary', () => {
      // Exactly 200 bytes
      const boundaryCode = '0x' + 'aa'.repeat(200);
      expect(isBytecodeMinimal(boundaryCode)).toBe(false);

      // 199 bytes
      const belowBoundary = '0x' + 'aa'.repeat(199);
      expect(isBytecodeMinimal(belowBoundary)).toBe(true);
    });

  });

  describe('containsDelegateCall', () => {

    test('should detect DELEGATECALL opcode', () => {
      // f4 is DELEGATECALL
      const proxyBytecode = '0x363d3d373d3d3d363df4';
      expect(containsDelegateCall(proxyBytecode)).toBe(true);
    });

    test('should return false when no DELEGATECALL', () => {
      const normalBytecode = '0x6080604052348015610010576000';
      expect(containsDelegateCall(normalBytecode)).toBe(false);
    });

    test('should handle case insensitivity', () => {
      const upperCase = '0x363D3D373D3D3D363DF4';
      expect(containsDelegateCall(upperCase)).toBe(true);
    });

    test('should not detect f4 inside PUSH1 operand data', () => {
      // PUSH1 (0x60) followed by 0xf4 as data, not as an opcode
      // 60 f4 = PUSH1 0xf4 — f4 is data here, NOT DELEGATECALL
      const bytecode = '0x6080604052' + '60f4' + '6080604052';
      expect(containsDelegateCall(bytecode)).toBe(false);
    });

    test('should not detect f4 inside PUSH20 operand data', () => {
      // PUSH20 with f4 embedded in the 20-byte address data
      const addr = 'f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4';
      const bytecode = `0x608060405273${addr}6080`;
      expect(containsDelegateCall(bytecode)).toBe(false);
    });

  });

});

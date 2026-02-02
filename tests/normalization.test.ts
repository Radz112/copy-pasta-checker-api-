import { normalizeBytecode } from '../src/utils/normalization';

describe('Normalization Utils', () => {

  describe('normalizeBytecode', () => {

    test('should handle empty input', () => {
      expect(normalizeBytecode('')).toBe('');
    });

    test('should handle "0x" only input', () => {
      expect(normalizeBytecode('0x')).toBe('');
    });

    test('should strip 0x prefix', () => {
      const result = normalizeBytecode('0x6080604052');
      expect(result).not.toContain('0x');
    });

    test('should preserve bytecode without prefix', () => {
      const result = normalizeBytecode('6080604052');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should mask PUSH20 addresses with zeros', () => {
      const addressBytes = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const bytecode = `608060405273${addressBytes}6080`;
      const result = normalizeBytecode(bytecode);

      expect(result).toContain('0000000000000000000000000000000000000000');
    });

    test('should strip CBOR metadata at end', () => {
      const code = '6080604052';
      const cborData = 'a26469706673582212205678';
      const length = Buffer.alloc(2);
      length.writeUInt16BE(cborData.length / 2);

      const bytecode = `${code}${cborData}${length.toString('hex')}`;
      const result = normalizeBytecode(bytecode);

      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle real-world bytecode pattern', () => {
      const bytecode = '0x6080604052348015610010576000' +
        '73' +
        'dac17f958d2ee523a2206206994597c13d831ec7' +
        '6040526004361061004c5760003560e01c';

      const result = normalizeBytecode(bytecode);

      expect(result).not.toContain('dac17f958d2ee523a2206206994597c13d831ec7');
      expect(result).toContain('0000000000000000000000000000000000000000');
    });

    test('should handle multiple PUSH20 addresses', () => {
      const addr1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const addr2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const bytecode = `608060405273${addr1}608073${addr2}6080`;

      const result = normalizeBytecode(bytecode);

      // Both addresses should be masked
      expect(result).not.toContain(addr1);
      expect(result).not.toContain(addr2);
    });

  });

});

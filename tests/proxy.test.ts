import {
  detectEIP1167,
  hasProxyCharacteristics
} from '../src/utils/proxy';

describe('Proxy Detection Utils', () => {

  describe('detectEIP1167', () => {

    test('should detect standard EIP-1167 minimal proxy', () => {
      // Standard EIP-1167 bytecode with implementation address
      const implAddress = 'bebebebebebebebebebebebebebebebebebebebe';
      const bytecode = `0x363d3d373d3d3d363d73${implAddress}5af43d82803e903d91602b57fd5bf3`;

      const result = detectEIP1167(bytecode);
      expect(result).toBe('0xBEbeBeBEbeBebeBeBEBEbebEBeBeBebeBeBebebe');
    });

    test('should return null for non-proxy bytecode', () => {
      const normalBytecode = '0x6080604052348015610010576000';
      const result = detectEIP1167(normalBytecode);
      expect(result).toBeNull();
    });

    test('should handle lowercase and uppercase hex', () => {
      const implAddress = 'ABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD';
      const bytecode = `0x363d3d373d3d3d363d73${implAddress}5af43d82803e903d91602b57fd5bf3`;

      const result = detectEIP1167(bytecode);
      expect(result).toBe('0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD');
    });

    test('should handle bytecode without 0x prefix', () => {
      const implAddress = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const bytecode = `363d3d373d3d3d363d73${implAddress}5af43d82803e903d91602b57fd5bf3`;

      const result = detectEIP1167(bytecode);
      expect(result).toBe('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa');
    });

  });

  describe('hasProxyCharacteristics', () => {

    test('should identify short bytecode as potential proxy', () => {
      const shortBytecode = '0x363d3d373d3d3d363df4'; // Very short
      expect(hasProxyCharacteristics(shortBytecode)).toBe(true);
    });

    test('should identify EIP-1167 prefix', () => {
      const eip1167Start = '0x363d3d37608060405234';
      expect(hasProxyCharacteristics(eip1167Start)).toBe(true);
    });

    test('should return false for normal contract bytecode', () => {
      // Long bytecode without proxy characteristics
      const normalBytecode = '0x6080604052' + '34'.repeat(500);
      expect(hasProxyCharacteristics(normalBytecode)).toBe(false);
    });

    test('should detect DELEGATECALL at start', () => {
      // DELEGATECALL (f4) within first 100 bytes
      const proxyLikeBytecode = '0x6080604052f4' + '00'.repeat(300);
      expect(hasProxyCharacteristics(proxyLikeBytecode)).toBe(true);
    });

    test('should not match f4 inside PUSH1 operand data', () => {
      // PUSH1 (0x60) followed by 0xf4 as data — f4 is NOT an opcode here
      // Long enough to not trigger the "short bytecode" heuristic (>200 hex chars)
      // Does not start with a proxy prefix
      const bytecode = '0x6080604052' + '60f4' + '00'.repeat(300);
      expect(hasProxyCharacteristics(bytecode)).toBe(false);
    });

  });

});

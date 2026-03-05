const { isValidABN, isValidNMI, isValidMIRN } = require('../src/validators/helpers');

describe('Validator Helpers', () => {
  describe('ABN validation', () => {
    test('valid 11-digit ABN passes', () => expect(isValidABN('12345678901')).toBe(true));
    test('too short ABN fails', () => expect(isValidABN('1234567890')).toBe(false));
    test('non-numeric ABN fails', () => expect(isValidABN('1234567890X')).toBe(false));
    test('empty string fails', () => expect(isValidABN('')).toBe(false));
  });

  describe('NMI validation', () => {
    test('valid 10-digit NMI passes', () => expect(isValidNMI('1234567890')).toBe(true));
    test('valid 11-digit NMI passes', () => expect(isValidNMI('12345678901')).toBe(true));
    test('too short NMI fails', () => expect(isValidNMI('123456789')).toBe(false));
    test('too long NMI fails', () => expect(isValidNMI('123456789012')).toBe(false));
  });

  describe('MIRN validation', () => {
    test('valid 10-digit MIRN passes', () => expect(isValidMIRN('1234567890')).toBe(true));
    test('valid 11-digit MIRN passes', () => expect(isValidMIRN('12345678901')).toBe(true));
  });
});

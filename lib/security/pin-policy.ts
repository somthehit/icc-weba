import crypto from 'crypto';

/**
 * Validates PIN strength according to Nepal Retail ERP & POS Security Policies:
 * - Must be 4 to 6 digits
 * - Rejects repeated digits (e.g. 0000, 1111)
 * - Rejects sequential ascending/descending digits (e.g. 1234, 4321, 123456)
 * - Rejects birth year patterns (e.g. 1970-2029)
 * - Rejects simple mirrored or keypad patterns (e.g. 1212, 2580)
 */
export function validatePinStrength(pin: string): { valid: boolean; reason?: string } {
  const cleanPin = String(pin || '').trim();

  if (!/^\d{4,6}$/.test(cleanPin)) {
    return { valid: false, reason: 'PIN must be between 4 and 6 digits only.' };
  }

  // 1. All same digits (0000, 1111, ...)
  if (/^(\d)\1+$/.test(cleanPin)) {
    return { valid: false, reason: 'Trivial PIN: Repeated digits (e.g. 1111, 0000) are not permitted.' };
  }

  // 2. Sequential numbers forward or backward (1234, 2345, 4321, 654321)
  const forwardSeq = '0123456789012345';
  const reverseSeq = '9876543210987654';
  if (forwardSeq.includes(cleanPin) || reverseSeq.includes(cleanPin)) {
    return { valid: false, reason: 'Trivial PIN: Sequential digits (e.g. 1234, 4321) are easily guessed.' };
  }

  // 3. Birth year patterns (1960 - 2029)
  if (cleanPin.length === 4) {
    const yearVal = parseInt(cleanPin, 10);
    if (yearVal >= 1960 && yearVal <= 2029) {
      return { valid: false, reason: 'Weak PIN: Calendar year pattern (e.g. 1998, 2002) is not permitted.' };
    }
  }

  // 4. Common keypad patterns
  const trivialPatterns = ['1212', '1010', '2020', '2580', '1379', '1470', '9876', '1122', '3344'];
  if (trivialPatterns.includes(cleanPin)) {
    return { valid: false, reason: 'Weak PIN: Common keypad pattern is prohibited.' };
  }

  return { valid: true };
}

/**
 * Generates a non-trivial 6-digit temporary PIN for maker-checker reset flow.
 * Guaranteed to pass validatePinStrength.
 */
export function generateSecureTempPin(): string {
  while (true) {
    // Generate 6 random digits
    const num = crypto.randomInt(100000, 999999).toString();
    if (validatePinStrength(num).valid) {
      return num;
    }
  }
}

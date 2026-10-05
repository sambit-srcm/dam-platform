import { describe, expect, it } from 'vitest';
import { passwordError } from '../password';

describe('passwordError', () => {
  it('asks for at least 8 characters', () => {
    expect(passwordError('short', 'short')).toBe('Use at least 8 characters');
  });

  it('rejects a password longer than 128 characters', () => {
    const long = 'a'.repeat(129);
    expect(passwordError(long, long)).toBe('Password is too long');
  });

  it('rejects a confirmation that does not match', () => {
    expect(passwordError('correct-horse', 'correct-horses')).toBe(
      'Passwords do not match',
    );
  });

  it('accepts a matching password of the right length', () => {
    expect(passwordError('correct-horse', 'correct-horse')).toBeNull();
  });
});

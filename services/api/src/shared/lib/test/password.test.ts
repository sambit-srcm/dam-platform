import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../password.ts';

describe('storing passwords', () => {
  it('never keeps the password itself', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).not.toContain('correct horse battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('accepts the right password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('wrong password', stored)).toBe(false);
  });

  it('stores the same password differently each time', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
  });

  it('rejects a stored value that is not in our format', async () => {
    expect(await verifyPassword('anything', 'plaintext')).toBe(false);
    expect(await verifyPassword('anything', 'bcrypt$abc$def')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$onlysalt')).toBe(false);
  });
});

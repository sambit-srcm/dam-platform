import { describe, expect, it } from 'vitest';
import {
  createUser,
  findUserByEmail,
  findUserById,
} from '../auth.repository.ts';
import { alice } from '../../../test/helpers.ts';
import { fakeDb } from '../../../test/support.ts';

describe('saving a new user', () => {
  it('stores the email and password hash and gives back the saved user', async () => {
    const saved = { id: 'u1', email: 'a@b.com' };
    const { db, stepsOf, argsOf } = fakeDb([saved]);

    const user = await createUser(db, {
      email: 'a@b.com',
      passwordHash: 'hash',
    });

    expect(user).toEqual(saved);
    expect(stepsOf(0)).toEqual(['insert', 'values', 'returning']);
    expect(argsOf(0, 'values')).toEqual([
      { email: 'a@b.com', passwordHash: 'hash' },
    ]);
  });
});

describe('finding a user by email', () => {
  it('gives back the user when one has that email', async () => {
    const { db, stepsOf } = fakeDb([alice]);

    expect(await findUserByEmail(db, 'a@b.com')).toEqual(alice);
    expect(stepsOf(0)).toEqual(['select', 'from', 'where']);
  });

  it('gives back nothing when nobody has that email', async () => {
    const { db } = fakeDb([]);

    expect(await findUserByEmail(db, 'nobody@b.com')).toBeUndefined();
  });
});

describe('finding a user by id', () => {
  it('gives back the user when the id exists', async () => {
    const { db } = fakeDb([alice]);

    expect(await findUserById(db, alice.id)).toEqual(alice);
  });

  it('gives back nothing when the id does not exist', async () => {
    const { db } = fakeDb([]);

    expect(await findUserById(db, 'missing')).toBeUndefined();
  });
});

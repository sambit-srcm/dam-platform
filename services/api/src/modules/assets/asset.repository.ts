import { assets, type NewAsset, type Db } from '@dam/db';

export async function createAsset(db: Db, values: NewAsset) {
  const [asset] = await db.insert(assets).values(values).returning();
  return asset!;
}

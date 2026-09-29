import type { AssetStatus } from '@dam/db';

// The statuses where a finished object actually exists in storage
export const HAS_OBJECT: AssetStatus[] = ['uploaded', 'processing', 'ready'];

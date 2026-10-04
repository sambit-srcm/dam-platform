import { defineConfig } from 'vitest/config';

// Separate from the unit suite so `pnpm test` does not need a running database.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

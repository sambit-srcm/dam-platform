import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 40,
        lines: 50,
      },
    },
  },
});

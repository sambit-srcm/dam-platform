import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**', '**/*.d.ts'],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 40,
        lines: 50,
      },
      reporter: ['text', 'html'],
    },
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});

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
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      AMQP_URL: 'amqp://localhost',
      MINIO_ENDPOINT: 'localhost',
      MINIO_ROOT_USER: 'test',
      MINIO_ROOT_PASSWORD: 'test-password',
      MINIO_BUCKET: 'test-bucket',
    },
  },
});

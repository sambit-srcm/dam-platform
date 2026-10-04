import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.integration.ts',
        'src/test/**',
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 40,
        lines: 50,
      },
      reporter: ['text', 'html'],
    },
    // Fake settings, so no test can reach a real database or bucket
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      RATE_LIMIT_ENABLED: 'false',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      AMQP_URL: 'amqp://localhost',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256', // gitleaks:allow (fake test value)
      MINIO_ENDPOINT: 'localhost',
      MINIO_ROOT_USER: 'test',
      MINIO_ROOT_PASSWORD: 'test-password',
      MINIO_BUCKET: 'test-bucket',
    },
  },
});

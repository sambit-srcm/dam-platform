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
      RABBITMQ_MGMT_URL: 'http://rabbit.test:15672',
      RABBITMQ_USER: 'guest',
      RABBITMQ_PASSWORD: 'secret',
      STACK_NAME: 'dam-platform',
    },
  },
});

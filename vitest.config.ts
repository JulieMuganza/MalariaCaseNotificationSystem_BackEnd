import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/malaria_notification_test?schema=public',
      JWT_ACCESS_SECRET: 'test-access-secret-min-32-chars-long!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars!!',
      APP_BASE_URL: 'http://localhost:3000',
      FRONTEND_URL: 'http://localhost:5173',
      BCRYPT_ROUNDS: '4',
    },
  },
});

// Test setup for the server (Vitest + Supertest).
// Tests do not need a database or a .env file: the values below are fake and only used by tests,
// and the database is replaced by a small mock in each test file.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      BASE_URL: 'http://localhost:5173',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      ALLOWED_EMAIL_DOMAIN: 'metropolia.fi',
      INITIAL_ADMIN_EMAIL: 'first.admin@metropolia.fi',
      MAIL_TRANSPORT: 'mailpit',
      MAIL_FROM: 'Metropolia Furniture <no-reply@example.com>',
    },
  },
});

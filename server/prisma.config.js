// Prisma CLI configuration (Prisma 7). Used by prisma generate / migrate.
// Prisma 7 does not read .env by itself, so we load the repo-root .env here.
// In Docker and on the servers there is no .env file: the variables come from the environment.
import {config} from 'dotenv';
import {defineConfig, env} from 'prisma/config';

config({path: '../.env', quiet: true});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

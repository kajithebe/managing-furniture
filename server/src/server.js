// Entry point: checks the environment, starts the HTTP server and stops it cleanly.
import {env} from './config/env.js';
import {createApp} from './app.js';
import {prisma} from './db.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`Server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Docker sends SIGTERM on stop; Ctrl+C sends SIGINT.
// Finish open requests, close the database connections, then exit.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}

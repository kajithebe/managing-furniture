// Entry point: checks the environment, starts the HTTP server and stops it cleanly.
import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { startReminderJob } from './jobs/reminders.js';

const app = createApp();

// Express 5 passes a startup error (e.g. port in use) to this callback.
const server = app.listen(env.PORT, (err) => {
  if (err) {
    console.error(`Server could not start on port ${env.PORT}: ${err.message}`);
    process.exit(1);
  }
  console.info(`Server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Reminders and "not yet returned" emails, every 5 minutes (MF-20).
const reminderTask = startReminderJob();

// Docker sends SIGTERM on stop; Ctrl+C sends SIGINT.
// Finish open requests, close the database connections, then exit.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    reminderTask.stop();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}

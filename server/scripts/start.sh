#!/bin/sh
# Starts the app in the Docker image (Render demo and Metropolia).
# 1. Bring the database up to date, 2. seed what is missing (safe to repeat), 3. start the server.
# Extra arguments go to the seed: the Render demo starts with "sh scripts/start.sh --demo".
set -e

node_modules/.bin/prisma migrate deploy
node prisma/seed.js "$@"

# exec: the server replaces this shell, so it receives Docker's stop signal (SIGTERM)
# and can close its connections cleanly.
exec node src/server.js
# Managing Furniture: one image with the API and the built screens (02 › Deployment).
# The same image runs on the Render demo and at Metropolia; only environment variables differ.

# --- 1. Build the React client ---
FROM node:24-slim AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- 2. The server, with the built client next to it ---
FROM node:24-slim
# Prisma's migration engine needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app/server

# Production packages only (prisma is one: it runs the migrations on start).
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./
# Generating the Prisma client needs no database; the URL only has to look valid.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build node_modules/.bin/prisma generate

# Express serves this folder (server/src/app.js › client/dist).
COPY --from=client /app/client/dist /app/client/dist

# Do not run as root.
USER node
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
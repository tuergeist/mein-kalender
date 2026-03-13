FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/sync-worker/package.json ./packages/sync-worker/
COPY packages/web/package.json ./packages/web/

RUN npm install

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY packages/sync-worker ./packages/sync-worker
COPY packages/web ./packages/web

RUN npx turbo build --filter=@calendar-sync/shared
RUN cd packages/api && npx prisma generate

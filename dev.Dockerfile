FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/web/package.json ./packages/web/

RUN npm install

COPY packages/backend ./packages/backend
COPY packages/web ./packages/web

RUN cd packages/backend && npx prisma generate

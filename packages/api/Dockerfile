FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
RUN npm install --workspace=packages/api --workspace=packages/shared

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY package.json turbo.json ./
RUN npx turbo build --filter=@calendar-sync/shared
RUN cd packages/api && npx prisma generate && npx tsc

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/packages/shared/dist ./node_modules/@calendar-sync/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@calendar-sync/shared/

EXPOSE 4200
ENV PORT=4200

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]

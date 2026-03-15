FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
RUN npm install --workspace=packages/backend

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/backend ./packages/backend
COPY package.json ./
RUN cd packages/backend && npx prisma generate && npx tsc

FROM base AS runner-api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/prisma ./prisma
EXPOSE 4200
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]

FROM base AS runner-worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/prisma ./prisma
CMD ["node", "dist/worker.js"]

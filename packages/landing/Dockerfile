FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/landing/package.json ./packages/landing/
RUN npm install --workspace=packages/landing

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/landing ./packages/landing
COPY package.json turbo.json ./
RUN cd packages/landing && npx astro build

FROM nginx:alpine AS runner
COPY --from=builder /app/packages/landing/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

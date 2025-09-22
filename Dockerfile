# syntax=docker/dockerfile:1

FROM node:18-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json tsconfig.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

FROM deps AS build
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3333
CMD ["sh", "-c", "npm run db:migrate && npm run start"]

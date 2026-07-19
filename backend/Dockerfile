FROM node:20-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --ignore-scripts

FROM dependencies AS build
WORKDIR /app
COPY backend backend
RUN npm run prisma:generate --workspace=backend && npm run build --workspace=backend

# Manual operations image: migrations and one-time ADMIN bootstrap.
# It is never used as the public backend runtime.
FROM dependencies AS operations
ENV NODE_ENV=production
WORKDIR /app
COPY backend backend
RUN npm run prisma:generate --workspace=backend
USER node
CMD ["npm", "run", "prisma:validate", "--workspace=backend"]

FROM node:20-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/backend/server.js ./server.js
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server.js"]

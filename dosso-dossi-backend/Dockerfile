# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN ./node_modules/.bin/prisma generate \
    && npm run build \
    && cp -R prisma/seed-data dist/prisma/seed-data

# Keep only runtime dependencies and the exact locked Prisma CLI. The CLI is
# used by the explicit migration step; migrations never run on API startup.
RUN npm pkg set "dependencies.prisma=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && npm pkg delete devDependencies.prisma \
    && npm prune --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
# Docker populates a NEW uploads volume from these versioned product assets.
# Existing volumes retain their contents; deployment never replaces uploads.
COPY --chown=node:node uploads/products ./uploads/products
RUN chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/src/index.js"]

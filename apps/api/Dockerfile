# Imagen de la API de Tower para Cloud Run.
# Contexto de build: la RAÍZ del monorepo (ver cloudbuild.yaml).

# ============ Builder ============
FROM node:20-alpine AS builder
# openssl: lo exige Prisma en Alpine. python3/make/g++: compilar bcrypt nativo.
RUN apk add --no-cache openssl python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/

# --ignore-scripts omite el binario nativo de bcrypt; se recompila explícito.
RUN npm install --workspace @tower/api --ignore-scripts --legacy-peer-deps \
  && npm rebuild bcrypt

COPY apps/api apps/api
RUN cd apps/api && npx prisma generate && npx nest build

# ============ Runtime ============
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# npm workspaces hoistea todo a /app/node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 8080
# Las migraciones se aplican al arrancar: si fallan, la revisión no sirve tráfico.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

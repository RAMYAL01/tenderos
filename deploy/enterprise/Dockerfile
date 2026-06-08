# Enterprise app image — Next.js + poppler (for on-prem VLM OCR rasterization).
# Build from the repo root:
#   docker build -f deploy/enterprise/Dockerfile -t registry.internal/tenderos:enterprise .

FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# Build with a dummy Clerk key so prerender succeeds; real auth is OIDC at runtime.
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# poppler-utils provides `pdftoppm`, required by the local-vision OCR path.
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
# `prisma migrate deploy` then start — run migrations against the on-prem DB first.
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push; npm run start"]

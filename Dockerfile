# node:sqlite needs Node 24 (package.json "engines")
FROM node:24-slim

WORKDIR /app

# vite and esbuild are needed at runtime: vite preview serves the app and
# the database server bundles src/store.ts with esbuild on startup.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* values into the bundle at build time.
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

ENV NODE_ENV=production

EXPOSE 4173

CMD ["sh", "./docker/start.sh"]

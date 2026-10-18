# node:sqlite needs Node 24 (package.json "engines")
FROM node:24-slim

WORKDIR /app

# esbuild is needed at runtime: the server bundles src/store.ts's validator on startup.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* values into the bundle at build time.
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

ENV NODE_ENV=production

EXPOSE 4173

CMD ["node", "server/app.mjs"]

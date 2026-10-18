#!/bin/sh
set -e
# Database and rate servers listen on loopback only; vite preview proxies to them.
node server/sqlite.mjs &
node server/rates.mjs &
exec npx vite preview --host 0.0.0.0 --port 4173

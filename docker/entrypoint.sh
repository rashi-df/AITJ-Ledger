#!/bin/sh
set -e

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Running database seed..."
./node_modules/.bin/tsx prisma/seed.ts

echo "Starting server..."
exec node server.js

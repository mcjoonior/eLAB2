#!/bin/sh
set -e

echo "Running Prisma db push..."
npx prisma db push --skip-generate

# Only seed if the database is empty (no users exist)
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c); p.\$disconnect(); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "Database is empty — running seed..."
  npx prisma db seed
else
  echo "Database already has data ($USER_COUNT users) — skipping seed."
fi

echo "Starting server..."
exec node dist/index.js

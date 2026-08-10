#!/bin/sh
# Roda a cada start do contêiner: aplica migrações do Prisma (idempotente) e, só na
# primeira execução (banco ainda inexistente no volume), popula os dados iniciais.
set -e

DB_FILE="/app/data/dev.db"
PRIMEIRA_VEZ=0
if [ ! -f "$DB_FILE" ]; then
  PRIMEIRA_VEZ=1
fi

npx prisma migrate deploy

if [ "$PRIMEIRA_VEZ" = "1" ]; then
  echo ">> Banco novo — rodando 'npm run db:seed' pela primeira vez."
  npm run db:seed
fi

exec "$@"

#!/bin/sh
# Roda a cada start do contêiner: aplica migrações do Prisma (idempotente) e garante os
# cadastros iniciais/complementares. Os dois seeds também são idempotentes, então um volume
# já existente ou criado antes do entrypoint não fica sem a base da Programação.
set -e

npx prisma migrate deploy

echo ">> Garantindo frentes e funções da Programação."
npm run db:seed
echo ">> Garantindo cadastro complementar de funcionários e veículos."
npm run db:import-cadastro

exec "$@"

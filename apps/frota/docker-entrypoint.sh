#!/bin/sh
# O "npm run seed" é seguro de rodar toda vez: ele confere se já existe veículo cadastrado
# e não faz nada se o banco já tiver dados (ver src/db/seed.ts). Só popula de fato na
# primeira execução, quando o volume /app/dados ainda está vazio.
set -e

npm run seed

exec "$@"

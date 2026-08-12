# Imagem de produção da Programação, para rodar num VPS via docker compose (ver DEPLOY.md
# na raiz do repositório). Instala TODAS as dependências (incluindo as de desenvolvimento)
# porque o "prisma migrate deploy" e o "db:seed" do entrypoint dependem do Prisma CLI e do
# tsx, que só existem em devDependencies.
FROM node:24-slim

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# O Next.js grava estes valores dentro do JavaScript do navegador durante o "next build" —
# por isso precisam chegar como build arg (ver .env.example na raiz), não só como variável
# de ambiente do contêiner em execução.
ARG NEXT_PUBLIC_URL_PORTAL
ARG NEXT_PUBLIC_URL_APP
ARG NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_URL_PAINEL
ARG NEXT_PUBLIC_URL_RH
ARG NEXT_PUBLIC_URL_ESTOQUE
ARG NEXT_PUBLIC_URL_PROGRAMACAO
ARG NEXT_PUBLIC_URL_ALOJAMENTOS
ARG NEXT_PUBLIC_URL_FROTA

RUN npx prisma generate && npm run build

RUN groupadd --system app \
  && useradd --system --gid app --create-home app \
  && mkdir -p /app/data \
  && chown -R app:app /app \
  && chmod +x /app/docker-entrypoint.sh

USER app
ENV NODE_ENV=production
EXPOSE 3007

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]

# Imagem de produção do Frota, para rodar num VPS via docker compose (ver DEPLOY.md na raiz
# do repositório). Diferente dos outros módulos, o Frota não usa Prisma: o banco é SQLite
# puro via node:sqlite (módulo embutido do Node, estável a partir da 24 — por isso a mesma
# versão do Node é usada aqui), sem compilação nativa. As tabelas são criadas sozinhas no
# boot (ver src/db/conexao.ts), então não precisa de passo de migração.
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci

COPY . .

# Frota é publicado pelo gateway Go sob /frota. Os NEXT_PUBLIC_* precisam existir já no
# build porque o Next.js os inclui no JavaScript entregue ao navegador.
ARG NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_URL_APP
ARG NEXT_PUBLIC_URL_PORTAL
ARG NEXT_PUBLIC_URL_PAINEL
ARG NEXT_PUBLIC_URL_RH
ARG NEXT_PUBLIC_URL_ESTOQUE
ARG NEXT_PUBLIC_URL_PROGRAMACAO
ARG NEXT_PUBLIC_URL_ALOJAMENTOS
ARG NEXT_PUBLIC_URL_FROTA
RUN npm run build

RUN groupadd --system app \
  && useradd --system --gid app --create-home app \
  && mkdir -p /app/dados /app/.next/standalone/public/anexos \
  && chown -R app:app /app \
  && chmod +x /app/docker-entrypoint.sh

USER app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/dados/frota.db
ENV PASTA_ANEXOS=/app/.next/standalone/public/anexos
ENV FORCA_HTTPS=1
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", ".next/standalone/server.js"]

# Serviço de WhatsApp dos Alojamentos.
#
# Precisa de máquina que fique LIGADA: mantém uma conexão permanente com o WhatsApp.
# Não funciona em Vercel, Netlify ou qualquer plataforma serverless — lá o processo morre
# entre requisições, e a conexão morre junto. Use VPS, Fly.io, Railway, Render (Web Service)
# ou um contêiner em nuvem.

FROM node:24-alpine

WORKDIR /app

# `git` porque o Baileys 6.x puxa o `libsignal` direto de um repositório.
RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# A sessão do WhatsApp é o pareamento do número. Em volume, e não na imagem: sem isso, todo
# deploy apaga o pareamento e alguém precisa ler o QR de novo.
VOLUME ["/app/sessao"]
ENV PASTA_SESSAO=/app/sessao

ENV PORTA_WHATSAPP=3006
EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:3006/saude || exit 1

CMD ["npx", "tsx", "src/index.ts"]
